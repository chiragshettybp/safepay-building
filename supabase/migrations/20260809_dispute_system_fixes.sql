-- 20260809_dispute_system_fixes.sql
-- Dispute system hardening:
--  1) Exactly-once: only one ACTIVE dispute per order
--  2) Exactly-once: at most one refund per dispute
--  3) Widen disputes.status CHECK to the full set used by the app + triggers
--  4) Notify the merchant when a dispute is created on their order
--  5) Notify the customer when the merchant responds (comment)
--  6) Fix resolution value matching in notify_dispute_status_change
--  7) resolve_dispute(): idempotent admin settlement of a dispute
--       merchant_won    -> order completed + escrow released (merchant credited)
--       partial_refund  -> order completed + escrow released (credited) then
--                          refund row reverses the refunded portion
--       customer_won    -> order refunded + escrow refunded (full refund)

-- 1) One active dispute per order (closed/rejected disputes may be re-raised)
CREATE UNIQUE INDEX IF NOT EXISTS disputes_order_active_uq
  ON public.disputes (order_id)
  WHERE status NOT IN ('closed', 'rejected');

-- 2) At most one refund per dispute
CREATE UNIQUE INDEX IF NOT EXISTS refunds_dispute_id_uq
  ON public.refunds (dispute_id)
  WHERE dispute_id IS NOT NULL;

-- 3) Widen the status CHECK constraint
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
ALTER TABLE public.disputes ADD CONSTRAINT disputes_status_check
  CHECK (status = ANY (ARRAY['open','under_review','info_required','escalated','resolved','closed','rejected']::text[]));

-- 4) Notify the merchant when a dispute is created on one of their orders
CREATE OR REPLACE FUNCTION public.notify_merchant_on_dispute_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant_user uuid;
BEGIN
  SELECT m.user_id INTO v_merchant_user
  FROM public.orders o
  JOIN public.merchants m ON m.id = o.merchant_id
  WHERE o.id = NEW.order_id;

  IF v_merchant_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_merchant_user,
      'New Dispute',
      'A dispute has been opened on one of your orders. Please respond.',
      'warning',
      '/merchant-dispute-response/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS merchant_dispute_created_notification ON public.disputes;
CREATE TRIGGER merchant_dispute_created_notification
  AFTER INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.notify_merchant_on_dispute_created();

-- 5) Notify the customer when the merchant posts a response comment
CREATE OR REPLACE FUNCTION public.notify_customer_on_merchant_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer uuid;
  v_merchant_user uuid;
  v_merchant_id uuid;
BEGIN
  SELECT o.customer_id, m.user_id, m.id INTO v_customer, v_merchant_user, v_merchant_id
  FROM public.disputes d
  JOIN public.orders o ON o.id = d.order_id
  JOIN public.merchants m ON m.id = o.merchant_id
  WHERE d.id = NEW.dispute_id;

  IF v_customer IS NOT NULL
     AND NEW.is_admin = false
     AND (NEW.user_id = v_merchant_user OR NEW.user_id = v_merchant_id) THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_customer,
      'Merchant Responded',
      'The merchant has responded to your dispute.',
      'info',
      '/disputes/' || NEW.dispute_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS customer_notified_on_merchant_comment ON public.dispute_comments;
CREATE TRIGGER customer_notified_on_merchant_comment
  AFTER INSERT ON public.dispute_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_customer_on_merchant_comment();

-- 6) Fix resolution value matching (app uses customer_won / merchant_won / partial_refund)
CREATE OR REPLACE FUNCTION public.notify_dispute_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If status changed to resolved and has a resolution, notify the customer
  IF NEW.status = 'resolved' AND NEW.resolution IS NOT NULL THEN
    IF NEW.resolution IN ('customer_won', 'customer_favor') THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.customer_id, 'Dispute Resolved - Customer Favored', 'Your dispute has been resolved in your favor. Your refund is being processed.', 'success', '/disputes/' || NEW.id);
    ELSIF NEW.resolution IN ('merchant_won', 'merchant_favor') THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.customer_id, 'Dispute Resolved - Merchant Favored', 'Your dispute has been resolved in the merchant''s favor.', 'info', '/disputes/' || NEW.id);
    ELSIF NEW.resolution = 'partial_refund' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.customer_id, 'Dispute Resolved - Partial Refund', 'Your dispute has been resolved with a partial refund.', 'info', '/disputes/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 7) Admin settlement of a dispute (exactly-once, escrow-safe)
CREATE OR REPLACE FUNCTION public.resolve_dispute(
  p_dispute_id uuid,
  p_resolution text,
  p_refund_amount numeric DEFAULT NULL,
  p_admin_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dispute public.disputes%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_merchant_user uuid;
  v_refund_amount numeric;
  v_refund_id uuid;
BEGIN
  IF p_resolution NOT IN ('customer_won', 'merchant_won', 'partial_refund') THEN
    RAISE EXCEPTION 'Invalid resolution %', p_resolution;
  END IF;

  SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispute % not found', p_dispute_id;
  END IF;
  IF v_dispute.status = 'resolved' THEN
    RAISE EXCEPTION 'Dispute % is already resolved', p_dispute_id;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_dispute.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', v_dispute.order_id;
  END IF;

  -- Validate refund amount rules
  IF p_resolution = 'customer_won' THEN
    v_refund_amount := COALESCE(p_refund_amount, v_order.amount);
    IF v_refund_amount <> v_order.amount THEN
      RAISE EXCEPTION 'Customer win must refund the full order amount';
    END IF;
  ELSIF p_resolution = 'merchant_won' THEN
    IF COALESCE(p_refund_amount, 0) > 0 THEN
      RAISE EXCEPTION 'Merchant win must not create a refund';
    END IF;
    v_refund_amount := 0;
  ELSE -- partial_refund
    v_refund_amount := COALESCE(p_refund_amount, 0);
    IF v_refund_amount <= 0 THEN
      RAISE EXCEPTION 'Partial refund requires an amount greater than zero';
    END IF;
    IF v_refund_amount >= v_order.amount THEN
      RAISE EXCEPTION 'Partial refund must be less than the order amount';
    END IF;
  END IF;
  IF v_refund_amount > v_order.amount THEN
    RAISE EXCEPTION 'Refund amount cannot exceed order amount';
  END IF;

  -- Exactly-once guard: atomically transition to resolved
  UPDATE public.disputes
     SET status = 'resolved',
         resolution = p_resolution,
         refund_amount = CASE WHEN p_resolution = 'merchant_won' THEN NULL ELSE v_refund_amount END,
         refund_transaction_id = CASE WHEN p_resolution = 'merchant_won' THEN NULL
                                      ELSE 'RFND-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) END,
         resolved_at = now(),
         admin_notes = COALESCE(p_admin_notes, v_dispute.admin_notes),
         updated_at = now()
   WHERE id = p_dispute_id AND status <> 'resolved';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispute % is already resolved', p_dispute_id;
  END IF;

  IF p_resolution IN ('merchant_won', 'partial_refund') THEN
    -- Escrow released to merchant (completion trigger credits merchant wallet).
    -- For partial_refund the refund row below then reverses the refunded portion.
    UPDATE public.orders
       SET status = 'completed', escrow_status = 'released', updated_at = now()
     WHERE id = v_dispute.order_id;
  ELSE
    -- customer_won: escrow returned to customer; refund record drives wallet reversal + notification
    UPDATE public.orders
       SET status = 'refunded', escrow_status = 'refunded', updated_at = now()
     WHERE id = v_dispute.order_id;
  END IF;

  IF p_resolution <> 'merchant_won' THEN
    INSERT INTO public.refunds (order_id, dispute_id, customer_id, amount, currency, status, reason)
    VALUES (v_dispute.order_id, v_dispute.id, v_order.customer_id, v_refund_amount,
            COALESCE(v_order.currency, 'INR'), 'initiated',
            'Dispute resolution - ' || p_resolution)
    RETURNING id INTO v_refund_id;

    INSERT INTO public.refund_events (refund_id, title, description, event_type, status)
    VALUES (v_refund_id, 'Refund Initiated', 'Refund initiated as part of dispute resolution.', 'initiated', 'initiated');
  END IF;

  -- Resolution timeline entry
  INSERT INTO public.dispute_updates (dispute_id, title, description, update_type, actor_type)
  VALUES (
    p_dispute_id,
    'Dispute Resolved',
    'Resolution: ' || p_resolution ||
    CASE WHEN p_resolution <> 'merchant_won'
         THEN ' | Refund: ' || v_refund_amount::text || ' ' || COALESCE(v_order.currency, 'INR')
         ELSE '' END,
    'status_change',
    'admin'
  );

  -- Notify the merchant of the financial outcome
  SELECT m.user_id INTO v_merchant_user FROM public.merchants m WHERE m.id = v_order.merchant_id;
  IF v_merchant_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_merchant_user,
      'Dispute Resolved',
      CASE p_resolution
        WHEN 'merchant_won' THEN 'Dispute resolved in your favor. Funds for order #' || v_order.order_number || ' released.'
        WHEN 'customer_won' THEN 'Dispute resolved in the customer''s favor for order #' || v_order.order_number || '. Refund of ' || v_refund_amount::text || ' ' || COALESCE(v_order.currency, 'INR') || ' processed.'
        ELSE 'Dispute resolved with a partial refund of ' || v_refund_amount::text || ' ' || COALESCE(v_order.currency, 'INR') || ' for order #' || v_order.order_number || '.'
      END,
      'info',
      '/merchant-dispute-result/' || p_dispute_id
    );
  END IF;

  RETURN jsonb_build_object(
    'dispute_id', p_dispute_id,
    'resolution', p_resolution,
    'refund_amount', v_refund_amount,
    'refund_id', v_refund_id
  );
END;
$function$;
