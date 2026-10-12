CREATE POLICY "chat media participants can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND auth.uid()::text IN ((storage.foldername(name))[1], (storage.foldername(name))[2])
);

CREATE POLICY "chat media participants can read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND auth.uid()::text IN ((storage.foldername(name))[1], (storage.foldername(name))[2])
);

CREATE POLICY "chat media owners can delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-media' AND owner = auth.uid());