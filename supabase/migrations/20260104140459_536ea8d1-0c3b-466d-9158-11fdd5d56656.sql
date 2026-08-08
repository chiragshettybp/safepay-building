-- Create merchant_bank_accounts table
CREATE TABLE public.merchant_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  branch TEXT,
  account_type TEXT NOT NULL DEFAULT 'savings',
  is_default BOOLEAN NOT NULL DEFAULT false,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create merchant_payouts table
CREATE TABLE public.merchant_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.merchant_bank_accounts(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'processing',
  notes TEXT,
  failure_reason TEXT,
  transaction_id TEXT,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchant_bank_accounts
CREATE POLICY "Merchants can view their own bank accounts"
  ON public.merchant_bank_accounts
  FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id IN (SELECT id FROM profiles)
  ));

CREATE POLICY "Merchants can insert their own bank accounts"
  ON public.merchant_bank_accounts
  FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE user_id IN (SELECT id FROM profiles)
  ));

CREATE POLICY "Merchants can update their own bank accounts"
  ON public.merchant_bank_accounts
  FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id IN (SELECT id FROM profiles)
  ));

CREATE POLICY "Merchants can delete their own bank accounts"
  ON public.merchant_bank_accounts
  FOR DELETE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id IN (SELECT id FROM profiles)
  ));

-- RLS policies for merchant_payouts
CREATE POLICY "Merchants can view their own payouts"
  ON public.merchant_payouts
  FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id IN (SELECT id FROM profiles)
  ));

CREATE POLICY "Merchants can insert their own payouts"
  ON public.merchant_payouts
  FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE user_id IN (SELECT id FROM profiles)
  ));

CREATE POLICY "Merchants can update their own payouts"
  ON public.merchant_payouts
  FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE user_id IN (SELECT id FROM profiles)
  ));

-- Create indexes
CREATE INDEX idx_merchant_bank_accounts_merchant_id ON public.merchant_bank_accounts(merchant_id);
CREATE INDEX idx_merchant_payouts_merchant_id ON public.merchant_payouts(merchant_id);
CREATE INDEX idx_merchant_payouts_status ON public.merchant_payouts(status);
CREATE INDEX idx_merchant_payouts_created_at ON public.merchant_payouts(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_bank_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_payouts;

-- Function to ensure only one default bank account per merchant
CREATE OR REPLACE FUNCTION ensure_single_default_bank_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.merchant_bank_accounts
    SET is_default = false
    WHERE merchant_id = NEW.merchant_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for single default bank account
CREATE TRIGGER ensure_single_default_bank_account_trigger
  AFTER INSERT OR UPDATE ON public.merchant_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_bank_account();

-- Function to update merchant wallet on payout
CREATE OR REPLACE FUNCTION process_merchant_payout()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new payout is created, update wallet
  IF TG_OP = 'INSERT' THEN
    UPDATE public.merchant_wallets
    SET 
      balance = balance - NEW.amount,
      pending_balance = pending_balance + NEW.amount,
      last_updated = now()
    WHERE merchant_id = NEW.merchant_id;
  -- When payout is completed, update totals
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.merchant_wallets
    SET 
      pending_balance = pending_balance - NEW.amount,
      total_withdrawn = total_withdrawn + NEW.amount,
      last_updated = now()
    WHERE merchant_id = NEW.merchant_id;
  -- When payout fails, refund to balance
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'failed' AND OLD.status != 'failed' THEN
    UPDATE public.merchant_wallets
    SET 
      balance = balance + NEW.amount,
      pending_balance = pending_balance - NEW.amount,
      last_updated = now()
    WHERE merchant_id = NEW.merchant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for payout processing
CREATE TRIGGER process_merchant_payout_trigger
  AFTER INSERT OR UPDATE ON public.merchant_payouts
  FOR EACH ROW
  EXECUTE FUNCTION process_merchant_payout();