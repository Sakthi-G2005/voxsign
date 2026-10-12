DROP POLICY chat_messages_insert_participant ON public.chat_messages;
DROP FUNCTION public.is_linked_pair(uuid, uuid);

CREATE POLICY chat_messages_insert_participant ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND auth.uid() IN (sender_id, receiver_id)
  AND EXISTS (
    SELECT 1 FROM public.trusted_contacts tc
    WHERE tc.sender_id = chat_messages.sender_id
      AND tc.receiver_id = chat_messages.receiver_id
      AND tc.is_active AND tc.link_status = 'accepted'
  )
);