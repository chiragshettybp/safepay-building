
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expected_delivery DATE;
ALTER TABLE public.kyc_records ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS resolution TEXT,
  ADD COLUMN IF NOT EXISTS refund_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.dispute_updates
  ADD COLUMN IF NOT EXISTS update_type TEXT,
  ADD COLUMN IF NOT EXISTS actor_type TEXT;

-- Allow customer_id to substitute for user_id on kyc_records when only one is provided
ALTER TABLE public.kyc_records ALTER COLUMN user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_kyc_user_customer_id()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.customer_id IS NOT NULL THEN
    NEW.user_id := NEW.customer_id;
  ELSIF NEW.customer_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.customer_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kyc_sync_user_customer ON public.kyc_records;
CREATE TRIGGER kyc_sync_user_customer
  BEFORE INSERT OR UPDATE ON public.kyc_records
  FOR EACH ROW EXECUTE FUNCTION public.sync_kyc_user_customer_id();
