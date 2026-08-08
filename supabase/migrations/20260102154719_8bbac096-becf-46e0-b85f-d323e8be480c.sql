-- Create storage bucket for dispute files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('dispute-files', 'dispute-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for dispute files
CREATE POLICY "Users can upload dispute files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'dispute-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view dispute files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'dispute-files');

CREATE POLICY "Users can delete their dispute files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'dispute-files' AND auth.uid() IS NOT NULL);

-- Create dispute_files table
CREATE TABLE public.dispute_files (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    upload_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on dispute_files
ALTER TABLE public.dispute_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for dispute_files
CREATE POLICY "Users can view dispute files for their disputes"
ON public.dispute_files
FOR SELECT
USING (
    dispute_id IN (
        SELECT id FROM public.disputes WHERE customer_id IN (SELECT id FROM profiles)
    )
);

CREATE POLICY "Users can insert dispute files for their disputes"
ON public.dispute_files
FOR INSERT
WITH CHECK (
    dispute_id IN (
        SELECT id FROM public.disputes WHERE customer_id IN (SELECT id FROM profiles)
    )
);

CREATE POLICY "Users can delete their dispute files"
ON public.dispute_files
FOR DELETE
USING (
    dispute_id IN (
        SELECT id FROM public.disputes WHERE customer_id IN (SELECT id FROM profiles)
    )
);

-- Create dispute_updates table for timeline
CREATE TABLE public.dispute_updates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    update_type TEXT NOT NULL DEFAULT 'status_change',
    actor_type TEXT NOT NULL DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on dispute_updates
ALTER TABLE public.dispute_updates ENABLE ROW LEVEL SECURITY;

-- RLS policies for dispute_updates
CREATE POLICY "Users can view updates for their disputes"
ON public.dispute_updates
FOR SELECT
USING (
    dispute_id IN (
        SELECT id FROM public.disputes WHERE customer_id IN (SELECT id FROM profiles)
    )
);

CREATE POLICY "Allow insert for dispute updates"
ON public.dispute_updates
FOR INSERT
WITH CHECK (true);

-- Create dispute_comments table for messages
CREATE TABLE public.dispute_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    message TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on dispute_comments
ALTER TABLE public.dispute_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for dispute_comments
CREATE POLICY "Users can view comments for their disputes"
ON public.dispute_comments
FOR SELECT
USING (
    dispute_id IN (
        SELECT id FROM public.disputes WHERE customer_id IN (SELECT id FROM profiles)
    )
);

CREATE POLICY "Users can insert comments for their disputes"
ON public.dispute_comments
FOR INSERT
WITH CHECK (
    dispute_id IN (
        SELECT id FROM public.disputes WHERE customer_id IN (SELECT id FROM profiles)
    )
);

-- Add new columns to disputes table for enhanced functionality
ALTER TABLE public.disputes
ADD COLUMN IF NOT EXISTS issue_type TEXT,
ADD COLUMN IF NOT EXISTS merchant_not_responded BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC,
ADD COLUMN IF NOT EXISTS refund_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.disputes;