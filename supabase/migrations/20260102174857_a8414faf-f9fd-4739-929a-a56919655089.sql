-- Create payment_transactions table for Razorpay integration
CREATE TABLE public.payment_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own payment transactions"
ON public.payment_transactions
FOR SELECT
USING (customer_id IN (SELECT profiles.id FROM profiles));

CREATE POLICY "Users can insert their own payment transactions"
ON public.payment_transactions
FOR INSERT
WITH CHECK (customer_id IN (SELECT profiles.id FROM profiles));

CREATE POLICY "Users can update their own payment transactions"
ON public.payment_transactions
FOR UPDATE
USING (customer_id IN (SELECT profiles.id FROM profiles));

-- Updated at trigger
CREATE TRIGGER update_payment_transactions_updated_at
BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_payment_transactions_customer ON public.payment_transactions(customer_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX idx_payment_transactions_razorpay_order ON public.payment_transactions(razorpay_order_id);