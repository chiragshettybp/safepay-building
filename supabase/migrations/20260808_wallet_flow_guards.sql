-- =============================================================================
-- Wallet flow: money must NOT be withdrawable until an order is COMPLETED.
--
--  1. The merchant wallet is now credited ONLY when an order transitions to
--     'completed' with escrow 'released' (DB trigger, exactly-once). Payments
--     into escrow no longer credit the merchant at payment time.
--  2. process_merchant_payout rejects invalid (<= 0 / NULL) amounts and
--     over-withdrawals (amount > available balance).
--  3. Refunds reverse the merchant credit when the order was already completed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Credit merchant wallet on order completion (exactly-once)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_merchant_on_order_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: only credit on the completed+released transition. The trigger WHEN
  -- clause already restricts firing; this is belt & suspenders.
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.escrow_status = 'released' THEN
    INSERT INTO public.merchant_wallets (merchant_id, balance, total_earned, currency, last_updated)
    VALUES (NEW.merchant_id, NEW.amount, NEW.amount, COALESCE(NEW.currency, 'INR'), now())
    ON CONFLICT (merchant_id) DO UPDATE
      SET balance      = public.merchant_wallets.balance + NEW.amount,
          total_earned = public.merchant_wallets.total_earned + NEW.amount,
          last_updated = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_merchant_on_order_completion_trigger ON public.orders;
CREATE TRIGGER credit_merchant_on_order_completion_trigger
  AFTER UPDATE OF status, escrow_status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.escrow_status = 'released')
  EXECUTE FUNCTION public.credit_merchant_on_order_completion();

-- -----------------------------------------------------------------------------
-- 2. Guarded merchant payout processing (no over-withdrawal / invalid amounts)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_merchant_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Invalid payout amount: %', NEW.amount;
  END IF;

  -- Minimum withdrawal amount (matches PAYMENT_CONSTANTS.MIN_WITHDRAWAL_AMOUNT)
  IF NEW.amount < 100 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is 100';
  END IF;

  -- When a new payout is created, update wallet
  IF TG_OP = 'INSERT' THEN
    SELECT balance INTO v_balance
    FROM public.merchant_wallets
    WHERE merchant_id = NEW.merchant_id;

    IF v_balance IS NULL THEN
      RAISE EXCEPTION 'Merchant wallet not found for merchant %', NEW.merchant_id;
    END IF;

    IF v_balance < NEW.amount THEN
      RAISE EXCEPTION 'Insufficient balance: available % < requested %', v_balance, NEW.amount;
    END IF;

    UPDATE public.merchant_wallets
    SET
      balance = balance - NEW.amount,
      pending_balance = pending_balance + NEW.amount,
      last_updated = now()
    WHERE merchant_id = NEW.merchant_id;
  -- When payout is completed, update totals
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE public.merchant_wallets
    SET
      pending_balance = pending_balance - NEW.amount,
      total_withdrawn = total_withdrawn + NEW.amount,
      last_updated = now()
    WHERE merchant_id = NEW.merchant_id;
  -- When payout fails, refund to balance
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN
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

-- -----------------------------------------------------------------------------
-- 3. Refunds reverse the merchant credit when the order was already completed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_merchant_credit_on_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order       public.orders%ROWTYPE;
  v_merchant_id uuid;
  v_balance     numeric;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Only reverse if the merchant was credited for this order (i.e. the order
  -- was completed and escrow released). Pre-completion refunds are already
  -- consistent: the merchant was never credited.
  IF v_order.status = 'completed' AND v_order.escrow_status = 'released' THEN
    -- The refunds table has no merchant_id column; resolve it from the order.
    v_merchant_id := v_order.merchant_id;

    SELECT balance INTO v_balance
    FROM public.merchant_wallets
    WHERE merchant_id = v_merchant_id;

    IF v_balance IS NULL THEN
      RAISE EXCEPTION 'Merchant wallet not found for merchant %', v_merchant_id;
    END IF;

    IF v_balance < NEW.amount THEN
      RAISE EXCEPTION 'Insufficient merchant balance to reverse refund for order %', NEW.order_id;
    END IF;

    UPDATE public.merchant_wallets
    SET balance      = balance - NEW.amount,
        total_earned = GREATEST(total_earned - NEW.amount, 0),
        last_updated = now()
    WHERE merchant_id = v_merchant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reverse_merchant_credit_on_refund_trigger ON public.refunds;
CREATE TRIGGER reverse_merchant_credit_on_refund_trigger
  AFTER INSERT ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.reverse_merchant_credit_on_refund();
