-- Create refunds table
CREATE TABLE public.refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id),
  dispute_id UUID REFERENCES public.disputes(id),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'initiated',
  reason TEXT NOT NULL,
  failure_reason TEXT,
  retry_allowed BOOLEAN DEFAULT true,
  payment_method TEXT,
  payment_details TEXT,
  transaction_id TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create refund_events table for timeline
CREATE TABLE public.refund_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  refund_id UUID NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'status_change',
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for refunds
CREATE POLICY "Users can view their own refunds"
ON public.refunds FOR SELECT
USING (customer_id IN (SELECT id FROM profiles));

CREATE POLICY "Users can insert refunds"
ON public.refunds FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own refunds"
ON public.refunds FOR UPDATE
USING (customer_id IN (SELECT id FROM profiles));

-- RLS Policies for refund_events
CREATE POLICY "Users can view refund events for their refunds"
ON public.refund_events FOR SELECT
USING (refund_id IN (SELECT id FROM refunds WHERE customer_id IN (SELECT id FROM profiles)));

CREATE POLICY "Allow insert for refund events"
ON public.refund_events FOR INSERT
WITH CHECK (true);

-- Enable realtime for refunds
ALTER PUBLICATION supabase_realtime ADD TABLE refunds;
ALTER PUBLICATION supabase_realtime ADD TABLE refund_events;

-- Add trigger for updated_at
CREATE TRIGGER update_refunds_updated_at
BEFORE UPDATE ON public.refunds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();