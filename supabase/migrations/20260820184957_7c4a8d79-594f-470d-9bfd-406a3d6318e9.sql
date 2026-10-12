CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_pair_idx ON public.chat_messages (sender_id, receiver_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_linked_pair(_sender uuid, _receiver uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trusted_contacts tc
    WHERE tc.sender_id = _sender AND tc.receiver_id = _receiver
      AND tc.is_active AND tc.link_status = 'accepted'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_linked_pair(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_linked_pair(uuid, uuid) TO authenticated;

CREATE POLICY chat_messages_select_participant ON public.chat_messages
FOR SELECT TO authenticated
USING (auth.uid() IN (sender_id, receiver_id));

CREATE POLICY chat_messages_insert_participant ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND auth.uid() IN (sender_id, receiver_id)
  AND public.is_linked_pair(sender_id, receiver_id)
);

CREATE POLICY chat_messages_update_recipient ON public.chat_messages
FOR UPDATE TO authenticated
USING (auth.uid() IN (sender_id, receiver_id) AND author_id <> auth.uid())
WITH CHECK (auth.uid() IN (sender_id, receiver_id) AND author_id <> auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;