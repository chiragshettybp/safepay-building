-- Fix function search_path for ensure_single_default_bank_account
CREATE OR REPLACE FUNCTION ensure_single_default_bank_account()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.merchant_bank_accounts
    SET is_default = false
    WHERE merchant_id = NEW.merchant_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix function search_path for process_merchant_payout
CREATE OR REPLACE FUNCTION process_merchant_payout()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;