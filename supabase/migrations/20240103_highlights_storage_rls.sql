-- Enable RLS on storage.objects for highlights bucket
-- This migration fixes the "new row violates row-level security policy" error

-- Policy: Users can upload their own highlight files
CREATE POLICY "Users can upload their own highlights"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can view all highlight files (public read)
CREATE POLICY "Anyone can view highlight files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'highlights');

-- Policy: Users can update their own highlight files
CREATE POLICY "Users can update their own highlights"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own highlight files
CREATE POLICY "Users can delete their own highlights"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'highlights' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
