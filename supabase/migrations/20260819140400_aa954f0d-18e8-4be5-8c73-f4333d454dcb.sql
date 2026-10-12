-- profiles extensions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS notify_all_contacts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_timeout_seconds integer NOT NULL DEFAULT 60;

CREATE TYPE public.link_status AS ENUM ('unlinked','pending','accepted','declined');
CREATE TYPE public.notification_status AS ENUM ('pending','sent','delivered','seen','accepted','declined','expired');

CREATE TABLE public.trusted_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  relationship text NOT NULL DEFAULT 'Caregiver',
  phone text,
  email text,
  priority integer NOT NULL DEFAULT 1,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  verified boolean NOT NULL DEFAULT false,
  link_status public.link_status NOT NULL DEFAULT 'unlinked',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_contacts TO authenticated;
GRANT ALL ON public.trusted_contacts TO service_role;
ALTER TABLE public.trusted_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY trusted_contacts_sender_all ON public.trusted_contacts FOR ALL TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());
CREATE POLICY trusted_contacts_receiver_select ON public.trusted_contacts FOR SELECT TO authenticated
  USING (receiver_id = auth.uid());
CREATE POLICY trusted_contacts_receiver_update ON public.trusted_contacts FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid()) WITH CHECK (receiver_id = auth.uid());

CREATE INDEX idx_trusted_contacts_sender ON public.trusted_contacts(sender_id, priority);
CREATE INDEX idx_trusted_contacts_receiver ON public.trusted_contacts(receiver_id);
CREATE INDEX idx_trusted_contacts_email ON public.trusted_contacts(lower(email));
CREATE TRIGGER trusted_contacts_updated_at BEFORE UPDATE ON public.trusted_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- help_requests routing columns
ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS assigned_receiver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notification_status public.notification_status NOT NULL DEFAULT 'pending';

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  help_request_id uuid NOT NULL REFERENCES public.help_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trusted_contact_id uuid REFERENCES public.trusted_contacts(id) ON DELETE SET NULL,
  notification_type text NOT NULL DEFAULT 'emergency',
  status public.notification_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  seen_at timestamptz,
  responded_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_sender_select ON public.notifications FOR SELECT TO authenticated
  USING (sender_id = auth.uid());
CREATE POLICY notifications_receiver_select ON public.notifications FOR SELECT TO authenticated
  USING (receiver_id = auth.uid());
CREATE POLICY notifications_receiver_update ON public.notifications FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid()) WITH CHECK (receiver_id = auth.uid());

CREATE INDEX idx_notifications_receiver ON public.notifications(receiver_id, created_at DESC);
CREATE INDEX idx_notifications_request ON public.notifications(help_request_id);

-- restrict help_requests visibility to the assigned/notified caregiver only
DROP POLICY IF EXISTS help_requests_select_receiver ON public.help_requests;
DROP POLICY IF EXISTS help_requests_update_receiver ON public.help_requests;

CREATE POLICY help_requests_select_assigned ON public.help_requests FOR SELECT TO authenticated
  USING (
    assigned_receiver_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.notifications n WHERE n.help_request_id = help_requests.id AND n.receiver_id = auth.uid())
  );
CREATE POLICY help_requests_update_assigned ON public.help_requests FOR UPDATE TO authenticated
  USING (
    assigned_receiver_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.notifications n WHERE n.help_request_id = help_requests.id AND n.receiver_id = auth.uid())
  )
  WITH CHECK (
    assigned_receiver_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.notifications n WHERE n.help_request_id = help_requests.id AND n.receiver_id = auth.uid())
  );

-- gesture events only visible to linked caregivers of that request
DROP POLICY IF EXISTS gesture_events_select_receiver ON public.gesture_events;
CREATE POLICY gesture_events_select_assigned ON public.gesture_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.help_request_id = gesture_events.help_request_id AND n.receiver_id = auth.uid()
    )
  );

-- profiles visibility limited to linked relationships
DROP POLICY IF EXISTS profiles_select_receivers ON public.profiles;
CREATE POLICY profiles_select_linked ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trusted_contacts tc
      WHERE (tc.sender_id = profiles.id AND tc.receiver_id = auth.uid())
         OR (tc.receiver_id = profiles.id AND tc.sender_id = auth.uid())
    )
  );

-- capture email/phone on signup and auto-link pending caregiver invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'sender'),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.trusted_contacts tc
     SET receiver_id = NEW.id,
         link_status = 'pending'
   WHERE tc.receiver_id IS NULL
     AND tc.link_status IN ('unlinked','pending')
     AND (
       lower(tc.email) = lower(NEW.email)
       OR (tc.phone IS NOT NULL AND tc.phone = NULLIF(NEW.raw_user_meta_data ->> 'phone',''))
     );

  RETURN NEW;
END; $function$;

-- backfill emails for existing users
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;

-- routing: notify only linked trusted caregivers
CREATE OR REPLACE FUNCTION public.dispatch_help_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  req public.help_requests%ROWTYPE;
  notify_all boolean;
  c RECORD;
  first_receiver uuid;
BEGIN
  SELECT * INTO req FROM public.help_requests WHERE id = _request_id;
  IF req.id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(notify_all_contacts, false) INTO notify_all FROM public.profiles WHERE id = req.sender_id;

  FOR c IN
    SELECT tc.* FROM public.trusted_contacts tc
    WHERE tc.sender_id = req.sender_id
      AND tc.is_active
      AND tc.receiver_id IS NOT NULL
      AND tc.link_status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.help_request_id = req.id AND n.receiver_id = tc.receiver_id
      )
    ORDER BY tc.is_primary DESC, tc.priority ASC, tc.created_at ASC
  LOOP
    INSERT INTO public.notifications (help_request_id, sender_id, receiver_id, trusted_contact_id, status)
    VALUES (req.id, req.sender_id, c.receiver_id, c.id, 'sent');
    IF first_receiver IS NULL THEN first_receiver := c.receiver_id; END IF;
    EXIT WHEN NOT notify_all;
  END LOOP;

  IF first_receiver IS NOT NULL THEN
    UPDATE public.help_requests
       SET assigned_receiver_id = first_receiver,
           notification_status = 'sent'
     WHERE id = req.id;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.dispatch_help_request(uuid) FROM public, anon;

CREATE OR REPLACE FUNCTION public.on_help_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.dispatch_help_request(NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER help_requests_dispatch AFTER INSERT ON public.help_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_help_request_created();

-- escalation: only the sender can escalate their own stale request
CREATE OR REPLACE FUNCTION public.escalate_help_request(_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  req public.help_requests%ROWTYPE;
  timeout_secs integer;
  stale_count integer;
BEGIN
  SELECT * INTO req FROM public.help_requests WHERE id = _request_id;
  IF req.id IS NULL OR req.sender_id <> auth.uid() THEN RETURN false; END IF;
  IF req.status = 'help_provided' THEN RETURN false; END IF;

  SELECT COALESCE(escalation_timeout_seconds, 60) INTO timeout_secs FROM public.profiles WHERE id = req.sender_id;

  UPDATE public.notifications
     SET status = 'expired'
   WHERE help_request_id = req.id
     AND status IN ('pending','sent','delivered','seen')
     AND created_at < now() - make_interval(secs => timeout_secs);
  GET DIAGNOSTICS stale_count = ROW_COUNT;

  IF stale_count = 0 THEN RETURN false; END IF;

  PERFORM public.dispatch_help_request(req.id);
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.escalate_help_request(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.escalate_help_request(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trusted_contacts;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.trusted_contacts REPLICA IDENTITY FULL;