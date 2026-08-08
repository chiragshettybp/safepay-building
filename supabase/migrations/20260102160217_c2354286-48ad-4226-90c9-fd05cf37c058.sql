-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can upload dispute files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their dispute files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view dispute files" ON storage.objects;

-- Create permissive policies for the public bucket
-- Since the bucket is public and we validate on the app level, allow uploads
CREATE POLICY "Anyone can upload to dispute-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dispute-files');

CREATE POLICY "Anyone can view dispute-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'dispute-files');

CREATE POLICY "Anyone can delete from dispute-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'dispute-files');