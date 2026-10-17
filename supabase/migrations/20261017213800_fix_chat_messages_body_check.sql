-- Fix chat_messages_body_check constraint to allow empty or null body when an attachment is present
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_body_check;

ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_body_check CHECK (
  (char_length(body) BETWEEN 1 AND 2000)
  OR (attachment_path IS NOT NULL AND (body IS NULL OR char_length(body) <= 2000))
);
