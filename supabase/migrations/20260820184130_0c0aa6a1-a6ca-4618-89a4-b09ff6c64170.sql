-- 1. Lock down SECURITY DEFINER functions callable by signed-in users
REVOKE EXECUTE ON FUNCTION public.current_role_is(public.app_role) FROM authenticated;

DROP FUNCTION IF EXISTS public.escalate_help_request(uuid);

CREATE OR REPLACE FUNCTION public.escalate_help_request(_request_id uuid, _caller_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req public.help_requests%ROWTYPE;
  timeout_secs integer;
  stale_count integer;
BEGIN
  IF _caller_id IS NULL THEN RETURN false; END IF;

  SELECT * INTO req FROM public.help_requests WHERE id = _request_id;
  IF req.id IS NULL OR req.sender_id <> _caller_id THEN RETURN false; END IF;
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
END; $function$;

REVOKE ALL ON FUNCTION public.escalate_help_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_help_request(uuid, uuid) TO service_role;

-- 2. Explicit delete control on help_requests (owner only)
CREATE POLICY "help_requests_delete_own"
ON public.help_requests
FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- 3. Explicit, tightly scoped insert/delete control on notifications
CREATE POLICY "notifications_sender_insert"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.help_requests hr
    WHERE hr.id = notifications.help_request_id AND hr.sender_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.trusted_contacts tc
    WHERE tc.sender_id = auth.uid()
      AND tc.receiver_id = notifications.receiver_id
      AND tc.is_active
      AND tc.link_status = 'accepted'
  )
);

CREATE POLICY "notifications_sender_delete"
ON public.notifications
FOR DELETE
TO authenticated
USING (sender_id = auth.uid());
