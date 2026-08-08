-- 20260809_public_ids.sql
-- Official SafePay Public ID system.
--
-- Every user-facing entity gets a standardized public identifier of the form
--   PREFIX-XXXXXXXXXXXX
-- (3-letter prefix, hyphen, exactly 12 digits, e.g. ORD-123456789012).
-- Internal UUID primary keys and all foreign-key relationships are untouched.
--
-- Prefix mapping (spec):
--   ORD  orders                 PAY  payments (payment_transactions)
--   TXN  transactions           REF  refunds
--   DSP  disputes               WDR  withdrawals
--   PYO  merchant payouts       TKT  support tickets
--   CUS  customers (profiles)   MER  merchants
--   KYC  KYC records            NTF  notifications
--   DOC  attachments            ESC  n/a (no escrow entity table; escrow_status on orders)

-- ===========================================================================
-- 1) Collision-free generator
--    A single registry table is the source of truth for issued public IDs.
--    Because the registry PK guarantees uniqueness, generated IDs can never
--    collide with each other OR with backfilled values.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.public_id_registry (
  public_id   text PRIMARY KEY,
  entity      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.generate_public_id(p_prefix text, p_entity text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id  text;
  v_num bigint;
BEGIN
  FOR i IN 1..20 LOOP
    v_num := floor(random() * 1000000000000)::bigint;          -- 0 .. 999,999,999,999
    v_id  := p_prefix || '-' || lpad(v_num::text, 12, '0');
    BEGIN
      INSERT INTO public.public_id_registry (public_id, entity)
      VALUES (v_id, p_entity);
      RETURN v_id;
    EXCEPTION
      WHEN unique_violation THEN
        NULL; -- retry with a fresh number
    END;
  END LOOP;
  RAISE EXCEPTION 'Could not generate a unique public id for prefix %', p_prefix;
END;
$$;

-- The registry is an internal bookkeeping table. It is RLS-guarded (Supabase
-- enables RLS on new tables by default) so anon/authenticated can never touch
-- it directly; writes happen only through the SECURITY DEFINER generator
-- above (which bypasses RLS as the function owner).
ALTER TABLE public.public_id_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_id_registry FROM anon, authenticated;

-- ===========================================================================
-- 2) Helper to add a public-id column + backfill + unique index + trigger
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.add_public_id_column(
  p_table   text,
  p_column  text,
  p_prefix  text,
  p_entity  text
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I text', p_table, p_column);
  EXECUTE format(
    'UPDATE public.%I SET %I = public.generate_public_id(%L, %L) WHERE %I IS NULL',
    p_table, p_column, p_prefix, p_entity, p_column
  );
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET NOT NULL', p_table, p_column);
  EXECUTE format(
    'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I(%I)',
    'uq_' || p_table || '_' || p_column, p_table, p_column
  );
END;
$$;

-- ===========================================================================
-- 3) Apply columns + backfill + unique indexes
-- ===========================================================================
SELECT public.add_public_id_column('orders',               'public_order_id',        'ORD', 'order');
SELECT public.add_public_id_column('payment_transactions', 'public_payment_id',      'PAY', 'payment');
SELECT public.add_public_id_column('refunds',              'public_refund_id',       'REF', 'refund');
SELECT public.add_public_id_column('disputes',             'public_dispute_id',      'DSP', 'dispute');
SELECT public.add_public_id_column('merchant_payouts',     'public_payout_id',       'PYO', 'payout');
SELECT public.add_public_id_column('support_tickets',      'public_ticket_id',       'TKT', 'support_ticket');
SELECT public.add_public_id_column('notifications',        'public_notification_id', 'NTF', 'notification');
SELECT public.add_public_id_column('profiles',             'public_customer_id',     'CUS', 'customer');
SELECT public.add_public_id_column('merchants',            'public_merchant_id',     'MER', 'merchant');
SELECT public.add_public_id_column('kyc_records',          'public_kyc_id',          'KYC', 'kyc');
SELECT public.add_public_id_column('ticket_attachments',   'public_document_id',     'DOC', 'attachment');
SELECT public.add_public_id_column('dispute_files',        'public_document_id',     'DOC', 'attachment');
SELECT public.add_public_id_column('withdrawals',          'public_withdrawal_id',   'WDR', 'withdrawal');

-- wallet_transactions: TXN for every ledger row, WDR additionally for withdrawals
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS public_transaction_id text;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS public_withdrawal_id text;
UPDATE public.wallet_transactions
  SET public_transaction_id = public.generate_public_id('TXN', 'transaction')
  WHERE public_transaction_id IS NULL;
UPDATE public.wallet_transactions
  SET public_withdrawal_id = public.generate_public_id('WDR', 'withdrawal')
  WHERE type = 'withdrawal' AND public_withdrawal_id IS NULL;
ALTER TABLE public.wallet_transactions ALTER COLUMN public_transaction_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_transactions_public_transaction_id
  ON public.wallet_transactions(public_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_transactions_public_withdrawal_id
  ON public.wallet_transactions(public_withdrawal_id) WHERE public_withdrawal_id IS NOT NULL;

-- Registry completeness: register every public id that already exists in the
-- tables (e.g. ids issued by older client-side generators before this
-- migration). ON CONFLICT keeps already-registered ids untouched.
INSERT INTO public.public_id_registry (public_id, entity)
SELECT pid, entity FROM (
  SELECT public_order_id AS pid, 'order' AS entity FROM public.orders
  UNION ALL SELECT public_payment_id, 'payment' FROM public.payment_transactions
  UNION ALL SELECT public_refund_id, 'refund' FROM public.refunds
  UNION ALL SELECT public_dispute_id, 'dispute' FROM public.disputes
  UNION ALL SELECT public_payout_id, 'payout' FROM public.merchant_payouts
  UNION ALL SELECT public_ticket_id, 'support_ticket' FROM public.support_tickets
  UNION ALL SELECT public_notification_id, 'notification' FROM public.notifications
  UNION ALL SELECT public_customer_id, 'customer' FROM public.profiles
  UNION ALL SELECT public_merchant_id, 'merchant' FROM public.merchants
  UNION ALL SELECT public_kyc_id, 'kyc' FROM public.kyc_records
  UNION ALL SELECT public_document_id, 'attachment' FROM public.ticket_attachments
  UNION ALL SELECT public_document_id, 'attachment' FROM public.dispute_files
  UNION ALL SELECT public_withdrawal_id, 'withdrawal' FROM public.withdrawals
  UNION ALL SELECT public_transaction_id, 'transaction' FROM public.wallet_transactions
) u
ON CONFLICT (public_id) DO NOTHING;

-- ===========================================================================
-- 4) INSERT triggers so every new record gets a public id automatically
--    (database-side generation satisfies the server/db-side requirement for
--     financial entities regardless of which code path inserts the row).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.set_public_order_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_order_id := COALESCE(NEW.public_order_id, public.generate_public_id('ORD', 'order'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_order_id ON public.orders;
CREATE TRIGGER set_public_order_id BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_public_order_id();

CREATE OR REPLACE FUNCTION public.set_public_payment_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_payment_id := COALESCE(NEW.public_payment_id, public.generate_public_id('PAY', 'payment'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_payment_id ON public.payment_transactions;
CREATE TRIGGER set_public_payment_id BEFORE INSERT ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_public_payment_id();

CREATE OR REPLACE FUNCTION public.set_public_refund_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_refund_id := COALESCE(NEW.public_refund_id, public.generate_public_id('REF', 'refund'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_refund_id ON public.refunds;
CREATE TRIGGER set_public_refund_id BEFORE INSERT ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_public_refund_id();

CREATE OR REPLACE FUNCTION public.set_public_dispute_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_dispute_id := COALESCE(NEW.public_dispute_id, public.generate_public_id('DSP', 'dispute'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_dispute_id ON public.disputes;
CREATE TRIGGER set_public_dispute_id BEFORE INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_public_dispute_id();

CREATE OR REPLACE FUNCTION public.set_public_payout_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_payout_id := COALESCE(NEW.public_payout_id, public.generate_public_id('PYO', 'payout'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_payout_id ON public.merchant_payouts;
CREATE TRIGGER set_public_payout_id BEFORE INSERT ON public.merchant_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_public_payout_id();

CREATE OR REPLACE FUNCTION public.set_public_ticket_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_ticket_id := COALESCE(NEW.public_ticket_id, public.generate_public_id('TKT', 'support_ticket'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_ticket_id ON public.support_tickets;
CREATE TRIGGER set_public_ticket_id BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_public_ticket_id();

CREATE OR REPLACE FUNCTION public.set_public_notification_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_notification_id := COALESCE(NEW.public_notification_id, public.generate_public_id('NTF', 'notification'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_notification_id ON public.notifications;
CREATE TRIGGER set_public_notification_id BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_public_notification_id();

CREATE OR REPLACE FUNCTION public.set_public_customer_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_customer_id := COALESCE(NEW.public_customer_id, public.generate_public_id('CUS', 'customer'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_customer_id ON public.profiles;
CREATE TRIGGER set_public_customer_id BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_public_customer_id();

CREATE OR REPLACE FUNCTION public.set_public_merchant_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_merchant_id := COALESCE(NEW.public_merchant_id, public.generate_public_id('MER', 'merchant'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_merchant_id ON public.merchants;
CREATE TRIGGER set_public_merchant_id BEFORE INSERT ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.set_public_merchant_id();

CREATE OR REPLACE FUNCTION public.set_public_kyc_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_kyc_id := COALESCE(NEW.public_kyc_id, public.generate_public_id('KYC', 'kyc'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_kyc_id ON public.kyc_records;
CREATE TRIGGER set_public_kyc_id BEFORE INSERT ON public.kyc_records
  FOR EACH ROW EXECUTE FUNCTION public.set_public_kyc_id();

CREATE OR REPLACE FUNCTION public.set_public_document_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_document_id := COALESCE(NEW.public_document_id, public.generate_public_id('DOC', 'attachment'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_document_id ON public.ticket_attachments;
CREATE TRIGGER set_public_document_id BEFORE INSERT ON public.ticket_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_public_document_id();
DROP TRIGGER IF EXISTS set_public_document_id ON public.dispute_files;
CREATE TRIGGER set_public_document_id BEFORE INSERT ON public.dispute_files
  FOR EACH ROW EXECUTE FUNCTION public.set_public_document_id();

CREATE OR REPLACE FUNCTION public.set_public_wallet_tx_ids() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_transaction_id := COALESCE(NEW.public_transaction_id, public.generate_public_id('TXN', 'transaction'));
  IF NEW.type = 'withdrawal' THEN
    NEW.public_withdrawal_id := COALESCE(NEW.public_withdrawal_id, public.generate_public_id('WDR', 'withdrawal'));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_wallet_tx_ids ON public.wallet_transactions;
CREATE TRIGGER set_public_wallet_tx_ids BEFORE INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_public_wallet_tx_ids();

CREATE OR REPLACE FUNCTION public.set_public_withdrawal_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_withdrawal_id := COALESCE(NEW.public_withdrawal_id, public.generate_public_id('WDR', 'withdrawal'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_withdrawal_id ON public.withdrawals;
CREATE TRIGGER set_public_withdrawal_id BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.set_public_withdrawal_id();

-- ===========================================================================
-- 5) Notifications now reference the PUBLIC ids (links stay internal UUIDs)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.notify_refund_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'processing' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Refund Processing',
        'Refund ' || COALESCE(NEW.public_refund_id, NEW.id) || ' of ' || NEW.currency || ' ' || NEW.amount || ' is being processed.',
        'info',
        '/refunds/' || NEW.id
      );
    ELSIF NEW.status IN ('completed', 'success') THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Refund Completed',
        'Refund ' || COALESCE(NEW.public_refund_id, NEW.id) || ' of ' || NEW.currency || ' ' || NEW.amount || ' has been credited to your account.',
        'success',
        '/refunds/' || NEW.id || '/success'
      );
    ELSIF NEW.status = 'failed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.customer_id,
        'Refund Failed',
        'Refund ' || COALESCE(NEW.public_refund_id, NEW.id) || ' failed: ' || COALESCE(NEW.failure_reason, 'Your refund could not be processed. Please contact support.'),
        'error',
        '/refunds/' || NEW.id || '/failed'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refund_status_change_notification ON public.refunds;
CREATE TRIGGER refund_status_change_notification
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_refund_status_change();

CREATE OR REPLACE FUNCTION public.notify_support_ticket_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_link    text;
  v_enabled boolean;
BEGIN
  v_link := CASE
    WHEN NEW.merchant_id IS NOT NULL THEN '/merchant-support/' || NEW.id
    ELSE '/help/tickets/' || NEW.id
  END;

  SELECT COALESCE((SELECT push_notifications FROM public.user_preferences WHERE user_id = NEW.customer_id), true)
    INTO v_enabled;

  IF v_enabled THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.customer_id,
      'Support Ticket Created',
      'Ticket ' || COALESCE(NEW.public_ticket_id, NEW.id) || ' "' || NEW.subject || '" has been submitted. Our team will get back to you soon.',
      'info',
      v_link
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS support_ticket_created_notification ON public.support_tickets;
CREATE TRIGGER support_ticket_created_notification
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_ticket_created();

CREATE OR REPLACE FUNCTION public.notify_support_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer      uuid;
  v_merchant_user uuid;
  v_cust_enabled  boolean;
  v_merch_enabled boolean;
  v_ticket_id     text;
BEGIN
  SELECT t.customer_id, m.user_id, t.public_ticket_id
    INTO v_customer, v_merchant_user, v_ticket_id
  FROM public.support_tickets t
  LEFT JOIN public.merchants m ON m.id = t.merchant_id
  WHERE t.id = NEW.ticket_id;

  SELECT COALESCE((SELECT push_notifications FROM public.user_preferences WHERE user_id = v_customer), true)
    INTO v_cust_enabled;
  SELECT COALESCE((SELECT push_notifications FROM public.user_preferences WHERE user_id = v_merchant_user), true)
    INTO v_merch_enabled;

  IF NEW.sender_type <> 'customer' AND v_customer IS NOT NULL AND NEW.sender_id <> v_customer AND v_cust_enabled THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_customer, 'Support Reply', 'You have a new reply on ticket ' || COALESCE(v_ticket_id, NEW.ticket_id::text) || '.', 'info', '/help/tickets/' || NEW.ticket_id);
  END IF;

  IF v_merchant_user IS NOT NULL AND NEW.sender_id <> v_merchant_user AND v_merch_enabled THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (v_merchant_user, 'Support Reply', 'You have a new reply on ticket ' || COALESCE(v_ticket_id, NEW.ticket_id::text) || '.', 'info', '/merchant-support/' || NEW.ticket_id);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS support_ticket_reply_notification ON public.ticket_messages;
CREATE TRIGGER support_ticket_reply_notification
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_ticket_reply();

-- Grant usage so REST/anonymous inserts keep working (functions are SECURITY
-- DEFINER and already run with elevated rights; grants are for completeness).
GRANT USAGE ON SCHEMA public TO anon, authenticated;
