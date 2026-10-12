-- role enum
CREATE TYPE public.app_role AS ENUM ('sender', 'receiver');
CREATE TYPE public.request_status AS ENUM ('sent', 'delivered', 'seen', 'help_provided');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'sender',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_role_is(_role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = _role);
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_select_receivers" ON public.profiles FOR SELECT TO authenticated USING (public.current_role_is('receiver'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.help_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  gesture_code TEXT NOT NULL DEFAULT 'HELP',
  message TEXT NOT NULL DEFAULT 'I NEED HELP',
  status public.request_status NOT NULL DEFAULT 'sent',
  source TEXT NOT NULL DEFAULT 'app',
  delivered_at TIMESTAMPTZ,
  seen_at TIMESTAMPTZ,
  helped_at TIMESTAMPTZ,
  responder_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.help_requests TO authenticated;
GRANT ALL ON public.help_requests TO service_role;
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "help_requests_select_own" ON public.help_requests FOR SELECT TO authenticated USING (sender_id = auth.uid());
CREATE POLICY "help_requests_select_receiver" ON public.help_requests FOR SELECT TO authenticated USING (public.current_role_is('receiver'));
CREATE POLICY "help_requests_insert_own" ON public.help_requests FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "help_requests_update_receiver" ON public.help_requests FOR UPDATE TO authenticated USING (public.current_role_is('receiver')) WITH CHECK (public.current_role_is('receiver'));

CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'ESP32 Glove',
  api_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devices_own" ON public.devices FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.gesture_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  help_request_id UUID REFERENCES public.help_requests(id) ON DELETE SET NULL,
  gesture_code TEXT NOT NULL,
  gesture_message TEXT NOT NULL DEFAULT '',
  sensor_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'app',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.gesture_events TO authenticated;
GRANT ALL ON public.gesture_events TO service_role;
ALTER TABLE public.gesture_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gesture_events_select_own" ON public.gesture_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "gesture_events_select_receiver" ON public.gesture_events FOR SELECT TO authenticated USING (public.current_role_is('receiver'));
CREATE POLICY "gesture_events_insert_own" ON public.gesture_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER help_requests_updated_at BEFORE UPDATE ON public.help_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- profile auto-creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'sender')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- realtime
ALTER TABLE public.help_requests REPLICA IDENTITY FULL;
ALTER TABLE public.gesture_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.help_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gesture_events;

CREATE INDEX help_requests_sender_idx ON public.help_requests(sender_id, created_at DESC);
CREATE INDEX help_requests_created_idx ON public.help_requests(created_at DESC);
CREATE INDEX gesture_events_user_idx ON public.gesture_events(user_id, created_at DESC);