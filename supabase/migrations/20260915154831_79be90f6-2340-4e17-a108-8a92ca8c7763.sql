CREATE OR REPLACE FUNCTION public.chat_messages_restrict_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path
     OR NEW.attachment_type IS DISTINCT FROM OLD.attachment_type
     OR NEW.attachment_mime IS DISTINCT FROM OLD.attachment_mime
     OR NEW.attachment_duration IS DISTINCT FROM OLD.attachment_duration
  THEN
    RAISE EXCEPTION 'Only read_at may be updated on chat messages';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_restrict_update_trg ON public.chat_messages;
CREATE TRIGGER chat_messages_restrict_update_trg
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_messages_restrict_update();

DROP POLICY IF EXISTS chat_messages_update_recipient ON public.chat_messages;
CREATE POLICY chat_messages_update_recipient ON public.chat_messages
FOR UPDATE TO authenticated
USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)) AND author_id <> auth.uid() AND read_at IS NULL)
WITH CHECK (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)) AND author_id <> auth.uid() AND read_at IS NOT NULL);