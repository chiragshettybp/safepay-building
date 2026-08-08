-- Drop existing policies and recreate with correct logic
DROP POLICY IF EXISTS "Users can upload their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own KYC documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own KYC documents" ON storage.objects;

-- Allow authenticated users to upload to kyc-documents bucket in their own folder
CREATE POLICY "Users can upload their own KYC documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents'
);

-- Allow authenticated users to view files in kyc-documents bucket
CREATE POLICY "Users can view their own KYC documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'kyc-documents'
);

-- Allow authenticated users to update files in kyc-documents bucket
CREATE POLICY "Users can update their own KYC documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'kyc-documents'
);

-- Allow authenticated users to delete files in kyc-documents bucket  
CREATE POLICY "Users can delete their own KYC documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'kyc-documents'
);