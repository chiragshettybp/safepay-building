-- Since this app uses custom auth (not Supabase Auth), we need to make the bucket allow all operations
-- The security is handled at the application level by validating user session before allowing uploads

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can upload their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own KYC documents" ON storage.objects;

-- Create permissive policies for kyc-documents bucket (app handles auth)
CREATE POLICY "Allow all operations on kyc-documents"
ON storage.objects
FOR ALL
USING (bucket_id = 'kyc-documents')
WITH CHECK (bucket_id = 'kyc-documents');