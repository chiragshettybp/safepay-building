
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'shipped';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_shipment';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS escrow_status TEXT NOT NULL DEFAULT 'held',
  ADD COLUMN IF NOT EXISTS merchant_avatar TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT,
  ADD COLUMN IF NOT EXISTS carrier TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders(order_number) WHERE order_number IS NOT NULL;

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE public.kyc_records
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS kyc_level TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS id_type TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.order_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE,
  merchant_id UUID NOT NULL,
  tracking_number TEXT NOT NULL,
  courier_partner TEXT NOT NULL,
  shipment_date DATE,
  estimated_delivery DATE,
  status TEXT NOT NULL DEFAULT 'in_transit',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_tracking TO authenticated;
GRANT ALL ON public.order_tracking TO service_role;
ALTER TABLE public.order_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view their order tracking" ON public.order_tracking
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_tracking.order_id AND o.customer_id = auth.uid()));

CREATE POLICY "Merchants manage their order tracking" ON public.order_tracking
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_tracking.order_id AND o.merchant_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_tracking.order_id AND o.merchant_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  order_id UUID,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own payment transactions" ON public.payment_transactions
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customers insert own payment transactions" ON public.payment_transactions
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  bank_account_id UUID,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own withdrawals" ON public.withdrawals
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Customers insert own withdrawals" ON public.withdrawals
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.merchant_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.merchant_activity TO authenticated;
GRANT ALL ON public.merchant_activity TO service_role;
ALTER TABLE public.merchant_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own activity" ON public.merchant_activity
  FOR SELECT TO authenticated USING (merchant_id = auth.uid());
CREATE POLICY "Merchants insert own activity" ON public.merchant_activity
  FOR INSERT TO authenticated WITH CHECK (merchant_id = auth.uid());
