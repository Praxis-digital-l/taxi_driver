DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_allowed_file_extensions_check'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_allowed_file_extensions_check
      CHECK (
        lower(file_key) ~ '[.](pdf|jpg|jpeg|png|webp|heic|heif)$'
      );
  END IF;
END $$;

DROP POLICY IF EXISTS "Users upload own docs" ON storage.objects;

CREATE POLICY "Users upload own docs" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND lower(name) ~ '[.](pdf|jpg|jpeg|png|webp|heic|heif)$'
);
