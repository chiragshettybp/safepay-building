-- =============================================================================
-- 20260813_checkout_system.sql
-- SafePay Hosted Checkout & Merchant Settlement (see checkout.md / checkoutphases.md)
--
-- Adds:
--   checkout_sessions, checkout_items, checkout_events, payment_attempts,
--   payment_webhook_logs, merchant_checkout_config, order_items
--   + additive columns on orders / payment_transactions
--   + SECURITY DEFINER functions: get_public_checkout_session,
--     get_merchant_checkout_config, finalize_checkout_payment,
--     expire_checkout_sessions, checkout_analytics
--
-- Conventions followed from the existing schema:
--   * money = NUMERIC(12,2), text status with CHECK constraints
--   * public ids via generate_public_id('CHK','checkout')
--   * updated_at via update_updated_at_column()
--   * RLS "scoped by relationship" policies consistent with the rest of the app
--   * the public checkout page reads ONLY through get_public_checkout_session(token)
--     so sessions are never enumerable by anon REST list requests
-- =============================================================================

-- =============================================================================
-- 1) checkout_sessions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_checkout_id    TEXT,
  token                 TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  merchant_id           UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name            TEXT,
  guest_phone           TEXT,
  guest_email           TEXT,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','expired','completed','failed','cancelled','abandoned')),
  current_step          TEXT NOT NULL DEFAULT 'details'
                          CHECK (current_step IN ('details','payment','confirmation')),
  currency              TEXT NOT NULL DEFAULT 'INR',
  subtotal              NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  shipping_amount       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  tax_amount            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  service_fee_amount    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (service_fee_amount >= 0),
  final_amount          NUMERIC(12,2) NOT NULL CHECK (final_amount >= 0),
  shipping_address      JSONB,
  selected_payment_method TEXT,
  requires_shipping     BOOLEAN NOT NULL DEFAULT false,
  collect_email         BOOLEAN NOT NULL DEFAULT false,
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  payment_transaction_id UUID,
  order_id              UUID,
  completed_at          TIMESTAMPTZ,
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_token_key ON public.checkout_sessions(token);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_merchant ON public.checkout_sessions(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_status ON public.checkout_sessions(status);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- The public checkout page must never list sessions; it reads only through the
-- get_public_checkout_session(token) SECURITY DEFINER function. Merchants can
-- see their own sessions via RLS (app-wide convention).
CREATE POLICY "Merchants view their checkout sessions"
  ON public.checkout_sessions FOR SELECT
  USING (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)));

CREATE POLICY "Merchants update their checkout sessions"
  ON public.checkout_sessions FOR UPDATE
  USING (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)))
  WITH CHECK (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)));

CREATE TRIGGER update_checkout_sessions_updated_at
  BEFORE UPDATE ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CHK- public id
CREATE OR REPLACE FUNCTION public.set_public_checkout_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_checkout_id := COALESCE(NEW.public_checkout_id, public.generate_public_id('CHK', 'checkout'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_checkout_id ON public.checkout_sessions;
CREATE TRIGGER set_public_checkout_id BEFORE INSERT ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_public_checkout_id();

-- Audit trail seed event
CREATE OR REPLACE FUNCTION public.checkout_created_event() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.checkout_events (session_id, event_type, step, event_data)
  VALUES (NEW.id, 'created', 'details',
          jsonb_build_object('final_amount', NEW.final_amount, 'currency', NEW.currency));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS checkout_created_event ON public.checkout_sessions;
CREATE TRIGGER checkout_created_event AFTER INSERT ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.checkout_created_event();

-- =============================================================================
-- 2) checkout_items (immutable order snapshot line items)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.checkout_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  item_name           TEXT NOT NULL,
  variant_label       TEXT,
  variant_attributes  JSONB,
  sku                 TEXT,
  unit_price          NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity            INTEGER NOT NULL CHECK (quantity >= 1),
  discount            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_amount          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total          NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_items_session ON public.checkout_items(session_id);

ALTER TABLE public.checkout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view items of their checkout sessions"
  ON public.checkout_items FOR SELECT
  USING (session_id IN (
    SELECT s.id FROM public.checkout_sessions s
    WHERE s.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

-- =============================================================================
-- 3) checkout_events (audit trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.checkout_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  step        TEXT,
  event_data  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_events_session ON public.checkout_events(session_id, created_at);

ALTER TABLE public.checkout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view events of their checkout sessions"
  ON public.checkout_events FOR SELECT
  USING (session_id IN (
    SELECT s.id FROM public.checkout_sessions s
    WHERE s.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

-- =============================================================================
-- 4) payment_attempts (one row per payment initiation; retries supported)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES public.checkout_sessions(id) ON DELETE CASCADE,
  payment_transaction_id  UUID,
  method                  TEXT,
  status                  TEXT NOT NULL DEFAULT 'initiated'
                            CHECK (status IN ('initiated','processing','success','failed','cancelled')),
  failure_reason          TEXT,
  metadata                JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_session ON public.payment_attempts(session_id, created_at DESC);

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view attempts of their checkout sessions"
  ON public.payment_attempts FOR SELECT
  USING (session_id IN (
    SELECT s.id FROM public.checkout_sessions s
    WHERE s.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

CREATE TRIGGER update_payment_attempts_updated_at
  BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 5) payment_webhook_logs (gateway event idempotency)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.payment_webhook_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway           TEXT NOT NULL DEFAULT 'razorpay',
  gateway_event_id  TEXT NOT NULL UNIQUE,
  event_type        TEXT,
  payload           JSONB,
  status            TEXT NOT NULL DEFAULT 'received'
                      CHECK (status IN ('received','processed','ignored','error')),
  error             TEXT,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_webhook_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_webhook_logs FROM anon, authenticated;

-- =============================================================================
-- 6) merchant_checkout_config (one row per merchant, defaults)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.merchant_checkout_config (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id                 UUID NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
  guest_checkout_enabled      BOOLEAN NOT NULL DEFAULT true,
  email_required              BOOLEAN NOT NULL DEFAULT false,
  shipping_required           BOOLEAN NOT NULL DEFAULT false,
  payment_cards_enabled       BOOLEAN NOT NULL DEFAULT true,
  payment_upi_enabled         BOOLEAN NOT NULL DEFAULT true,
  payment_netbanking_enabled  BOOLEAN NOT NULL DEFAULT true,
  payment_wallets_enabled     BOOLEAN NOT NULL DEFAULT true,
  session_expiry_hours        INTEGER NOT NULL DEFAULT 24 CHECK (session_expiry_hours BETWEEN 1 AND 168),
  service_fee_percent         NUMERIC(5,2) NOT NULL DEFAULT 2.00 CHECK (service_fee_percent BETWEEN 0 AND 100),
  success_url                 TEXT,
  cancel_url                  TEXT,
  notification_email          TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_checkout_config_merchant ON public.merchant_checkout_config(merchant_id);

ALTER TABLE public.merchant_checkout_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view their checkout config"
  ON public.merchant_checkout_config FOR SELECT
  USING (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)));

CREATE POLICY "Merchants update their checkout config"
  ON public.merchant_checkout_config FOR UPDATE
  USING (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)))
  WITH CHECK (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)));

CREATE TRIGGER update_merchant_checkout_config_updated_at
  BEFORE UPDATE ON public.merchant_checkout_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create config for new merchants
CREATE OR REPLACE FUNCTION public.create_merchant_checkout_config() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.merchant_checkout_config (merchant_id, guest_checkout_enabled, email_required,
    shipping_required, session_expiry_hours, service_fee_percent,
    payment_upi_enabled, payment_cards_enabled, payment_netbanking_enabled, payment_wallets_enabled)
  VALUES (NEW.id, true, false, false, 24, 2, true, true, true, true)
  ON CONFLICT (merchant_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_merchant_checkout_config_created ON public.merchants;
CREATE TRIGGER on_merchant_checkout_config_created AFTER INSERT ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.create_merchant_checkout_config();

-- =============================================================================
-- 7) order_items (copy of the checkout snapshot at purchase time)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_name           TEXT NOT NULL,
  variant_label       TEXT,
  variant_attributes  JSONB,
  sku                 TEXT,
  unit_price          NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity            INTEGER NOT NULL CHECK (quantity >= 1),
  discount            NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_amount          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total          NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view items of their orders"
  ON public.order_items FOR SELECT
  USING (order_id IN (SELECT o.id FROM public.orders o WHERE o.customer_id IN (SELECT p.id FROM public.profiles p)));

CREATE POLICY "Merchants view items of their orders"
  ON public.order_items FOR SELECT
  USING (order_id IN (SELECT o.id FROM public.orders o WHERE o.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))));

-- =============================================================================
-- 8) Additive columns on existing tables + idempotency guards
-- =============================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_session_id UUID REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_count INTEGER NOT NULL DEFAULT 1;

-- Hard guarantee: one checkout session => at most one order.
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_session_id_key
  ON public.orders(checkout_session_id) WHERE checkout_session_id IS NOT NULL;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gateway TEXT NOT NULL DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS method TEXT;

-- Idempotency: a gateway payment id may be recorded exactly once.
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_razorpay_payment_id_key
  ON public.payment_transactions(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_session ON public.payment_transactions(session_id);

-- =============================================================================
-- 9) get_merchant_checkout_config (upsert defaults for legacy merchants + read)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_merchant_checkout_config(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.merchant_checkout_config%ROWTYPE;
BEGIN
  INSERT INTO public.merchant_checkout_config (merchant_id)
  VALUES (p_merchant_id)
  ON CONFLICT (merchant_id) DO NOTHING;

  SELECT * INTO v_row FROM public.merchant_checkout_config WHERE merchant_id = p_merchant_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'merchant_id',              v_row.merchant_id,
    'guest_checkout_enabled',   v_row.guest_checkout_enabled,
    'email_required',           v_row.email_required,
    'shipping_required',        v_row.shipping_required,
    'payment_cards_enabled',    v_row.payment_cards_enabled,
    'payment_upi_enabled',      v_row.payment_upi_enabled,
    'payment_netbanking_enabled', v_row.payment_netbanking_enabled,
    'payment_wallets_enabled',  v_row.payment_wallets_enabled,
    'session_expiry_hours',     v_row.session_expiry_hours,
    'service_fee_percent',      v_row.service_fee_percent,
    'success_url',              v_row.success_url,
    'cancel_url',               v_row.cancel_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_merchant_checkout_config(UUID) TO anon, authenticated;

-- =============================================================================
-- 10) get_public_checkout_session(token) — the ONLY public read path
--     Lazily expires stale sessions and returns session + items + merchant +
--     config (+ order when completed) for a single unguessable token.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_public_checkout_session(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.checkout_sessions%ROWTYPE;
  v_merchant public.merchants%ROWTYPE;
  v_config JSONB;
  v_items JSONB;
  v_order JSONB;
  v_final NUMERIC(12,2);
BEGIN
  SELECT * INTO v_session FROM public.checkout_sessions WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('not_found', true);
  END IF;

  -- Lazy expiry
  IF v_session.status = 'active' AND v_session.expires_at < now() THEN
    UPDATE public.checkout_sessions
      SET status = 'expired', updated_at = now()
      WHERE id = v_session.id AND status = 'active';
    INSERT INTO public.checkout_events (session_id, event_type, step, event_data)
      VALUES (v_session.id, 'expired', v_session.current_step, jsonb_build_object('reason', 'session_expired'));
    v_session.status := 'expired';
  END IF;

  SELECT * INTO v_merchant FROM public.merchants WHERE id = v_session.merchant_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id',             i.id,
      'item_name',      i.item_name,
      'variant_label',  i.variant_label,
      'variant_attributes', i.variant_attributes,
      'sku',            i.sku,
      'unit_price',     i.unit_price,
      'quantity',       i.quantity,
      'discount',       i.discount,
      'tax_amount',     i.tax_amount,
      'line_total',     i.line_total
    ) ORDER BY i.created_at, i.id), '[]'::jsonb)
    INTO v_items
  FROM public.checkout_items i WHERE i.session_id = v_session.id;

  v_config := public.get_merchant_checkout_config(v_session.merchant_id);

  v_order := NULL;
  IF v_session.order_id IS NOT NULL THEN
    SELECT jsonb_build_object(
        'id',              o.id,
        'public_order_id', o.public_order_id,
        'order_number',    o.order_number,
        'status',          o.status,
        'escrow_status',   o.escrow_status,
        'amount',          o.amount,
        'currency',        o.currency,
        'product_name',    o.product_name,
        'created_at',      o.created_at
      )
      INTO v_order
    FROM public.orders o WHERE o.id = v_session.order_id;
  END IF;

  RETURN jsonb_build_object(
    'not_found', false,
    'session', jsonb_build_object(
      'id',                       v_session.id,
      'public_checkout_id',       v_session.public_checkout_id,
      'token',                    v_session.token,
      'status',                   v_session.status,
      'current_step',             v_session.current_step,
      'currency',                 v_session.currency,
      'subtotal',                 v_session.subtotal,
      'discount_amount',          v_session.discount_amount,
      'shipping_amount',          v_session.shipping_amount,
      'tax_amount',               v_session.tax_amount,
      'service_fee_amount',       v_session.service_fee_amount,
      'final_amount',             v_session.final_amount,
      'requires_shipping',        v_session.requires_shipping,
      'collect_email',            v_session.collect_email,
      'expires_at',               v_session.expires_at,
      'completed_at',             v_session.completed_at,
      'guest_name',               v_session.guest_name,
      'guest_phone',              v_session.guest_phone,
      'guest_email',              v_session.guest_email,
      'shipping_address',         v_session.shipping_address,
      'selected_payment_method',  v_session.selected_payment_method,
      'created_at',               v_session.created_at,
      'order_id',                 v_session.order_id,
      'payment_transaction_id',   v_session.payment_transaction_id
    ),
    'items',    v_items,
    'merchant', jsonb_build_object(
      'id',               v_merchant.id,
      'public_merchant_id', v_merchant.public_merchant_id,
      'business_name',    v_merchant.business_name,
      'business_logo_url', v_merchant.business_logo_url,
      'business_category', v_merchant.business_category,
      'verification_status', v_merchant.verification_status,
      'is_active',        v_merchant.is_active
    ),
    'config',   v_config,
    'order',    v_order
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_checkout_session(TEXT) TO anon, authenticated;

-- =============================================================================
-- 11) expire_checkout_sessions() — batch expiry (edge function / admin path)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.expire_checkout_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE public.checkout_sessions
      SET status = 'expired', updated_at = now()
      WHERE status = 'active' AND expires_at < now()
      RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired;

  INSERT INTO public.checkout_events (session_id, event_type, step, event_data)
  SELECT s.id, 'expired', s.current_step, jsonb_build_object('reason', 'batch_expiry')
  FROM public.checkout_sessions s
  WHERE s.status = 'expired'
    AND NOT EXISTS (SELECT 1 FROM public.checkout_events e
                    WHERE e.session_id = s.id AND e.event_type = 'expired');

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_checkout_sessions() TO anon, authenticated;

-- =============================================================================
-- 12) finalize_checkout_payment(p_transaction_id, p_gateway_payment_id, p_gateway_signature)
--     Atomic, idempotent, exactly-once order creation for a checkout session.
--     ONLY the service-role edge function may call this (revoked from anon).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.finalize_checkout_payment(
  p_transaction_id UUID,
  p_gateway_payment_id TEXT DEFAULT NULL,
  p_gateway_signature  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx       public.payment_transactions%ROWTYPE;
  v_session  public.checkout_sessions%ROWTYPE;
  v_merchant public.merchants%ROWTYPE;
  v_customer_id uuid;
  v_order_id  uuid;
  v_order_number TEXT;
  v_public_order TEXT;
  v_product_name TEXT;
  v_item_names TEXT;
  v_first_item public.checkout_items%ROWTYPE;
BEGIN
  -- Load transaction; must exist and be pending or already-success (idempotent rerun)
  SELECT * INTO v_tx FROM public.payment_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TX_NOT_FOUND';
  END IF;

  IF v_tx.status NOT IN ('pending', 'success') THEN
    RAISE EXCEPTION 'TX_NOT_FINALIZABLE: %', v_tx.status;
  END IF;

  IF v_tx.session_id IS NULL THEN
    RAISE EXCEPTION 'TX_NOT_CHECKOUT';
  END IF;

  SELECT * INTO v_session FROM public.checkout_sessions WHERE id = v_tx.session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  -- Idempotent: if this session already produced an order, return it unchanged.
  IF v_session.order_id IS NOT NULL THEN
    SELECT public_order_id, order_number INTO v_public_order, v_order_number
      FROM public.orders WHERE id = v_session.order_id;
    RETURN jsonb_build_object(
      'order_id', v_session.order_id,
      'order_number', v_order_number,
      'public_order_id', v_public_order,
      'created', false
    );
  END IF;

  -- Mark the transaction success exactly once (guarded UPDATE).
  IF v_tx.status = 'pending' THEN
    UPDATE public.payment_transactions
      SET status = 'success',
          razorpay_payment_id = COALESCE(p_gateway_payment_id, razorpay_payment_id),
          razorpay_signature  = COALESCE(p_gateway_signature, razorpay_signature),
          updated_at = now()
      WHERE id = p_transaction_id AND status = 'pending';
  END IF;

  SELECT * INTO v_merchant FROM public.merchants WHERE id = v_session.merchant_id;

  -- Resolve the customer: session.customer_id, else match guest phone, else create guest profile.
  v_customer_id := v_session.customer_id;
  IF v_customer_id IS NULL AND v_session.guest_phone IS NOT NULL THEN
    SELECT id INTO v_customer_id FROM public.profiles WHERE phone = v_session.guest_phone;
  END IF;
  IF v_customer_id IS NULL THEN
    IF v_session.guest_phone IS NULL THEN
      RAISE EXCEPTION 'CUSTOMER_UNRESOLVED: session % has no customer_id and no guest_phone', v_session.id;
    END IF;
    BEGIN
      INSERT INTO public.profiles (phone, password_hash, email, full_name, account_source, account_claimed)
      VALUES (
        v_session.guest_phone,
        'guest:' || encode(extensions.gen_random_bytes(24), 'hex'),
        NULLIF(v_session.guest_email, ''),
        NULLIF(v_session.guest_name, ''),
        'payment_link',
        false
      )
      RETURNING id INTO v_customer_id;
    EXCEPTION WHEN unique_violation THEN
      -- Phone raced with another checkout/signup; reuse the existing profile.
      SELECT id INTO v_customer_id FROM public.profiles WHERE phone = v_session.guest_phone;
      IF v_customer_id IS NULL AND v_session.guest_email IS NOT NULL THEN
        SELECT id INTO v_customer_id FROM public.profiles
          WHERE lower(email) = lower(v_session.guest_email);
      END IF;
    END;
  END IF;

  -- Product label + order number
  SELECT * INTO v_first_item FROM public.checkout_items
    WHERE session_id = v_session.id ORDER BY created_at, id LIMIT 1;
  v_product_name := COALESCE(v_first_item.item_name, 'Checkout order');
  SELECT string_agg(i.item_name, ', ' ORDER BY i.created_at, i.id) INTO v_item_names
    FROM public.checkout_items i WHERE i.session_id = v_session.id;

  v_order_number := public.generate_public_id('ORD', 'order');

  -- Create the order. Concurrency is handled: unique index on
  -- orders(checkout_session_id) means a racing finalize creates no second order.
  BEGIN
    INSERT INTO public.orders (
      customer_id, order_number, merchant_id, merchant_name, merchant_avatar,
      product_name, product_description, amount, currency, status, escrow_status,
      checkout_session_id, item_count,
      notes
    )
    VALUES (
      v_customer_id,
      v_order_number,
      v_merchant.id,
      COALESCE(v_merchant.business_name, 'Merchant'),
      v_merchant.business_logo_url,
      v_product_name,
      COALESCE(v_item_names, v_product_name),
      v_tx.amount,
      COALESCE(v_tx.currency, 'INR'),
      'pending',
      'held',
      v_session.id,
      (SELECT count(*)::int FROM public.checkout_items WHERE session_id = v_session.id),
      'Checkout session ' || COALESCE(v_session.public_checkout_id, v_session.id::text)
    )
    RETURNING id, public_order_id INTO v_order_id, v_public_order;
  EXCEPTION WHEN unique_violation THEN
    -- Another finalize won the race; return the existing order.
    SELECT id, public_order_id INTO v_order_id, v_public_order
      FROM public.orders WHERE checkout_session_id = v_session.id;
  END;

  -- Copy snapshot line items to the order
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order_id) THEN
    INSERT INTO public.order_items (order_id, item_name, variant_label, variant_attributes, sku, unit_price, quantity, discount, tax_amount, line_total)
    SELECT v_order_id, item_name, variant_label, variant_attributes, sku, unit_price, quantity, discount, tax_amount, line_total
    FROM public.checkout_items WHERE session_id = v_session.id;
  END IF;

  -- Link transaction -> order
  UPDATE public.payment_transactions
    SET order_id = v_order_id, updated_at = now()
    WHERE id = p_transaction_id;

  -- Complete the session exactly once
  UPDATE public.checkout_sessions
    SET status = 'completed',
        order_id = v_order_id,
        payment_transaction_id = p_transaction_id,
        current_step = 'confirmation',
        completed_at = now(),
        updated_at = now()
    WHERE id = v_session.id AND status <> 'completed';

  INSERT INTO public.checkout_events (session_id, event_type, step, event_data)
  VALUES (v_session.id, 'completed', 'confirmation',
          jsonb_build_object('order_id', v_order_id, 'public_order_id', v_public_order));

  -- Notifications
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_merchant.user_id,
    'New order from checkout',
    'Order ' || v_public_order || ' · ' || COALESCE(v_tx.currency, 'INR') || ' ' || v_tx.amount,
    'success',
    '/merchant-order/' || v_order_id
  );

  IF v_customer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_customer_id,
      'Order confirmed',
      'Order ' || v_public_order || ' has been confirmed. Payment secured in SafePay escrow.',
      'success',
      '/orders/' || v_order_id
    );
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'public_order_id', v_public_order,
    'created', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_checkout_payment(UUID, TEXT, TEXT) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.finalize_checkout_payment(UUID, TEXT, TEXT) TO service_role;

-- =============================================================================
-- 13) checkout_analytics(merchant_id) — merchant dashboard metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION public.checkout_analytics(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created         INTEGER;
  v_completed       INTEGER;
  v_expired         INTEGER;
  v_failed          INTEGER;
  v_cancelled       INTEGER;
  v_active          INTEGER;
  v_revenue         NUMERIC;
  v_last30          INTEGER;
  v_conversion      NUMERIC(6,2);
  v_aov             NUMERIC(12,2);
BEGIN
  SELECT count(*) INTO v_created    FROM public.checkout_sessions WHERE merchant_id = p_merchant_id;
  SELECT count(*) INTO v_completed  FROM public.checkout_sessions WHERE merchant_id = p_merchant_id AND status = 'completed';
  SELECT count(*) INTO v_expired    FROM public.checkout_sessions WHERE merchant_id = p_merchant_id AND status = 'expired';
  SELECT count(*) INTO v_failed     FROM public.checkout_sessions WHERE merchant_id = p_merchant_id AND status = 'failed';
  SELECT count(*) INTO v_cancelled  FROM public.checkout_sessions WHERE merchant_id = p_merchant_id AND status = 'cancelled';
  SELECT count(*) INTO v_active     FROM public.checkout_sessions WHERE merchant_id = p_merchant_id AND status = 'active';
  SELECT COALESCE(sum(final_amount), 0) INTO v_revenue
    FROM public.checkout_sessions WHERE merchant_id = p_merchant_id AND status = 'completed';
  SELECT count(*) INTO v_last30 FROM public.checkout_sessions
    WHERE merchant_id = p_merchant_id AND created_at >= now() - interval '30 days';

  v_conversion := CASE WHEN v_created > 0 THEN round((v_completed::numeric / v_created) * 100, 2) ELSE 0 END;
  v_aov := CASE WHEN v_completed > 0 THEN round(v_revenue / v_completed, 2) ELSE 0 END;

  RETURN jsonb_build_object(
    'sessions_created',  v_created,
    'sessions_completed', v_completed,
    'sessions_expired',  v_expired,
    'sessions_failed',   v_failed,
    'sessions_cancelled', v_cancelled,
    'sessions_active',   v_active,
    'sessions_last_30',  v_last30,
    'conversion_rate',   v_conversion,
    'revenue',           v_revenue,
    'average_order_value', v_aov
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkout_analytics(UUID) TO anon, authenticated;

-- =============================================================================
-- 14) create_checkout_session(merchant, items[], fees, flags) — atomic creation
--     with server-side total recomputation. Merchant-facing (edge function calls
--     this with the service role). Amounts sent by the client are IGNORED except
--     as overrides for shipping/discount/tax; subtotal and final are recomputed.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_checkout_session(
  p_merchant_id      UUID,
  p_items            JSONB,
  p_shipping_amount  NUMERIC DEFAULT 0,
  p_discount_amount  NUMERIC DEFAULT 0,
  p_tax_amount       NUMERIC DEFAULT 0,
  p_requires_shipping BOOLEAN DEFAULT false,
  p_collect_email    BOOLEAN DEFAULT false,
  p_expiry_hours     INTEGER DEFAULT NULL,
  p_metadata         JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant public.merchants%ROWTYPE;
  v_cfg      public.merchant_checkout_config%ROWTYPE;
  v_item     record;
  v_subtotal NUMERIC(12,2) := 0;
  v_fee      NUMERIC(12,2) := 0;
  v_final    NUMERIC(12,2) := 0;
  v_session  uuid;
  v_token    text;
  v_public   text;
  v_expiry   integer;
  v_expires  timestamptz;
  v_shipping NUMERIC(12,2) := 0;
  v_discount NUMERIC(12,2) := 0;
  v_tax      NUMERIC(12,2) := 0;
BEGIN
  SELECT * INTO v_merchant FROM public.merchants WHERE id = p_merchant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MERCHANT_NOT_FOUND';
  END IF;
  IF v_merchant.verification_status <> 'approved' OR NOT v_merchant.is_active THEN
    RAISE EXCEPTION 'MERCHANT_NOT_ELIGIBLE';
  END IF;

  PERFORM public.get_merchant_checkout_config(p_merchant_id);
  SELECT * INTO v_cfg FROM public.merchant_checkout_config WHERE merchant_id = p_merchant_id;

  -- Items: must be a non-empty array; recompute subtotal server-side
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS';
  END IF;

  FOR v_item IN
    SELECT COALESCE(x.item_name, '')              AS item_name,
           x.variant_label                        AS variant_label,
           x.variant_attributes                   AS variant_attributes,
           x.sku                                  AS sku,
           COALESCE(x.unit_price, 0)::numeric     AS unit_price,
           COALESCE(x.quantity, 0)::int           AS quantity,
           COALESCE(x.discount, 0)::numeric       AS discount,
           COALESCE(x.tax_amount, 0)::numeric     AS tax_amount
    FROM jsonb_to_recordset(p_items) AS x(
      item_name text, variant_label text, variant_attributes jsonb, sku text,
      unit_price numeric, quantity int, discount numeric, tax_amount numeric)
  LOOP
    IF length(btrim(v_item.item_name)) = 0 THEN
      RAISE EXCEPTION 'ITEM_NAME_REQUIRED';
    END IF;
    IF length(btrim(v_item.item_name)) > 200 THEN
      RAISE EXCEPTION 'ITEM_NAME_TOO_LONG';
    END IF;
    IF v_item.unit_price IS NULL OR v_item.unit_price <= 0 OR v_item.unit_price > 1000000 THEN
      RAISE EXCEPTION 'INVALID_ITEM_PRICE: %', v_item.item_name;
    END IF;
    IF v_item.quantity IS NULL OR v_item.quantity < 1 OR v_item.quantity > 9999 THEN
      RAISE EXCEPTION 'INVALID_ITEM_QTY: %', v_item.item_name;
    END IF;
    IF v_item.discount < 0 OR v_item.tax_amount < 0 THEN
      RAISE EXCEPTION 'INVALID_ITEM_TOTALS: %', v_item.item_name;
    END IF;
    v_subtotal := v_subtotal + round(v_item.unit_price * v_item.quantity, 2);
  END LOOP;

  -- Session-level shipping/discount/tax clamps
  v_shipping := COALESCE(p_shipping_amount, 0);
  v_discount := COALESCE(p_discount_amount, 0);
  v_tax      := COALESCE(p_tax_amount, 0);
  IF v_shipping < 0 OR v_shipping > 1000000 THEN RAISE EXCEPTION 'INVALID_SHIPPING'; END IF;
  IF v_tax < 0 OR v_tax > 1000000 THEN RAISE EXCEPTION 'INVALID_TAX'; END IF;
  IF v_discount < 0 OR v_discount > v_subtotal THEN RAISE EXCEPTION 'INVALID_DISCOUNT'; END IF;

  -- Service fee + final amount (fee on subtotal, matches app convention)
  v_fee := round(v_subtotal * COALESCE(v_cfg.service_fee_percent, 2) / 100, 2);
  v_final := round(v_subtotal - v_discount + v_shipping + v_tax + v_fee, 2);
  IF v_final < 1 OR v_final > 100000 THEN
    RAISE EXCEPTION 'AMOUNT_OUT_OF_RANGE: %', v_final;
  END IF;

  v_expiry := COALESCE(p_expiry_hours, v_cfg.session_expiry_hours, 24);
  IF v_expiry < 1 OR v_expiry > 168 THEN RAISE EXCEPTION 'INVALID_EXPIRY'; END IF;
  v_expires := now() + v_expiry * interval '1 hour';

  INSERT INTO public.checkout_sessions (
    merchant_id, subtotal, discount_amount, shipping_amount, tax_amount,
    service_fee_amount, final_amount, requires_shipping, collect_email,
    expires_at, metadata
  )
  VALUES (
    p_merchant_id, v_subtotal, v_discount, v_shipping, v_tax, v_fee, v_final,
    p_requires_shipping, p_collect_email, v_expires, p_metadata
  )
  RETURNING id, token, public_checkout_id INTO v_session, v_token, v_public;

  INSERT INTO public.checkout_items (
    session_id, item_name, variant_label, variant_attributes, sku,
    unit_price, quantity, discount, tax_amount, line_total
  )
  SELECT v_session, x.item_name, x.variant_label, x.variant_attributes, x.sku,
         COALESCE(x.unit_price,0), COALESCE(x.quantity,0),
         COALESCE(x.discount,0), COALESCE(x.tax_amount,0),
         round(COALESCE(x.unit_price,0) * COALESCE(x.quantity,0) - COALESCE(x.discount,0) + COALESCE(x.tax_amount,0), 2)
  FROM jsonb_to_recordset(p_items) AS x(
    item_name text, variant_label text, variant_attributes jsonb, sku text,
    unit_price numeric, quantity int, discount numeric, tax_amount numeric);

  RETURN jsonb_build_object(
    'id',               v_session,
    'public_checkout_id', v_public,
    'token',            v_token,
    'subtotal',         v_subtotal,
    'discount_amount',  v_discount,
    'shipping_amount',  v_shipping,
    'tax_amount',       v_tax,
    'service_fee_amount', v_fee,
    'final_amount',     v_final,
    'expires_at',       v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_checkout_session(UUID, JSONB, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, INTEGER, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.create_checkout_session(UUID, JSONB, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, INTEGER, JSONB) FROM anon, authenticated, public;

-- =============================================================================
-- 15) cancel_checkout_session(session, merchant) — guarded merchant cancellation
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cancel_checkout_session(
  p_session_id UUID,
  p_merchant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.checkout_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.checkout_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_session.merchant_id <> p_merchant_id THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;
  IF v_session.order_id IS NOT NULL OR v_session.status NOT IN ('active', 'failed') THEN
    RAISE EXCEPTION 'SESSION_NOT_CANCELLABLE';
  END IF;

  UPDATE public.checkout_sessions
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_session_id AND order_id IS NULL;

  INSERT INTO public.checkout_events (session_id, event_type, step, event_data)
  VALUES (p_session_id, 'cancelled', v_session.current_step,
          jsonb_build_object('reason', 'merchant_cancelled'));

  RETURN jsonb_build_object('cancelled', true, 'session_id', p_session_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_checkout_session(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.cancel_checkout_session(UUID, UUID) FROM anon, authenticated, public;
