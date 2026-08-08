-- Create merchant activity table for activity feed
CREATE TABLE public.merchant_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  activity_type text NOT NULL DEFAULT 'order',
  title text NOT NULL,
  description text,
  reference_id uuid,
  reference_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on merchant_activity
ALTER TABLE public.merchant_activity ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchant_activity
CREATE POLICY "Merchants can view their own activity"
  ON public.merchant_activity FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id IN (SELECT id FROM public.profiles)
  ));

CREATE POLICY "Allow insert for merchant activity"
  ON public.merchant_activity FOR INSERT
  WITH CHECK (true);

-- Enable realtime for merchant_activity
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_activity;