ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_type text CHECK (attachment_type IN ('audio','image','video')),
  ADD COLUMN IF NOT EXISTS attachment_mime text,
  ADD COLUMN IF NOT EXISTS attachment_duration integer;

ALTER TABLE public.chat_messages ALTER COLUMN body SET DEFAULT '';