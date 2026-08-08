-- Create KYC records table
CREATE TABLE public.kyc_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  kyc_level TEXT NOT NULL DEFAULT 'none',
  full_legal_name TEXT,
  date_of_birth DATE,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT DEFAULT 'India',
  id_type TEXT,
  id_number TEXT,
  id_front_url TEXT,
  id_back_url TEXT,
  selfie_url TEXT,
  address_proof_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('not_started', 'incomplete', 'submitted', 'pending_review', 'approved', 'rejected')),
  CONSTRAINT valid_kyc_level CHECK (kyc_level IN ('none', 'basic', 'verified'))
);

-- Enable RLS
ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own KYC records"
ON public.kyc_records
FOR SELECT
USING (customer_id IN (SELECT profiles.id FROM profiles));

CREATE POLICY "Users can insert their own KYC records"
ON public.kyc_records
FOR INSERT
WITH CHECK (customer_id IN (SELECT profiles.id FROM profiles));

CREATE POLICY "Users can update their own KYC records"
ON public.kyc_records
FOR UPDATE
USING (customer_id IN (SELECT profiles.id FROM profiles));

-- Add trigger for updated_at
CREATE TRIGGER update_kyc_records_updated_at
BEFORE UPDATE ON public.kyc_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kyc_records;

-- Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for KYC documents
CREATE POLICY "Users can upload their own KYC documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own KYC documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own KYC documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add avatar_url to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Create storage bucket for profile avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (bucket_id = 'avatars');