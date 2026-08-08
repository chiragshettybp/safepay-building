-- Create order_tracking table for shipment tracking
CREATE TABLE public.order_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  tracking_number text NOT NULL,
  courier_partner text NOT NULL,
  shipment_date timestamptz,
  estimated_delivery timestamptz,
  actual_delivery timestamptz,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

-- Create tracking updates table for history
CREATE TABLE public.tracking_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id uuid NOT NULL REFERENCES public.order_tracking(id) ON DELETE CASCADE,
  status text NOT NULL,
  location text,
  description text,
  updated_by text NOT NULL DEFAULT 'merchant',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create delivery_proofs table
CREATE TABLE public.delivery_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  file_urls text[] NOT NULL DEFAULT '{}',
  delivery_notes text,
  delivery_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_tracking
CREATE POLICY "Merchants can view their order tracking"
  ON public.order_tracking FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id IN (SELECT id FROM public.profiles)
  ));

CREATE POLICY "Merchants can insert their order tracking"
  ON public.order_tracking FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id IN (SELECT id FROM public.profiles)
  ));

CREATE POLICY "Merchants can update their order tracking"
  ON public.order_tracking FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id IN (SELECT id FROM public.profiles)
  ));

-- RLS policies for tracking_updates
CREATE POLICY "Merchants can view their tracking updates"
  ON public.tracking_updates FOR SELECT
  USING (tracking_id IN (
    SELECT id FROM public.order_tracking WHERE merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id IN (SELECT id FROM public.profiles)
    )
  ));

CREATE POLICY "Allow insert for tracking updates"
  ON public.tracking_updates FOR INSERT
  WITH CHECK (true);

-- RLS policies for delivery_proofs
CREATE POLICY "Merchants can view their delivery proofs"
  ON public.delivery_proofs FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id IN (SELECT id FROM public.profiles)
  ));

CREATE POLICY "Merchants can insert their delivery proofs"
  ON public.delivery_proofs FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id IN (SELECT id FROM public.profiles)
  ));

CREATE POLICY "Merchants can update their delivery proofs"
  ON public.delivery_proofs FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id IN (SELECT id FROM public.profiles)
  ));

-- Create storage bucket for delivery proofs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-proofs',
  'delivery-proofs',
  true,
  20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4']
);

-- Storage policies for delivery proofs bucket
CREATE POLICY "Merchants can upload delivery proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'delivery-proofs');

CREATE POLICY "Anyone can view delivery proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'delivery-proofs');

CREATE POLICY "Merchants can delete their delivery proofs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'delivery-proofs');

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_proofs;