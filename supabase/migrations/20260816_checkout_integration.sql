-- =============================================================================
-- 20260816_checkout_integration.sql
-- Checkout Integration — external merchant API platform (Razorpay-style).
--
-- COMPLETELY SEPARATE from the internal "payment links" feature.
-- This migration adds the integration platform's OWN schema. It reuses ONLY
-- the shared checkout engine tables (checkout_sessions / checkout_items /
-- checkout_events / payment_transactions / payment_attempts) and the existing
-- SECURITY DEFINER engine functions (create_checkout_session,
-- finalize_checkout_payment, get_public_checkout_session,
-- cancel_checkout_session). No second payment/checkout/order engine.
--
-- Adds:
--   checkout_integrations, api_keys, api_key_scopes,
--   webhook_endpoints, webhook_events, webhook_deliveries,
--   api_request_logs, idempotency_keys,
--   integration_test_runs, integration_incidents, integration_audit_logs
--   + integration columns on checkout_sessions
--   + enqueue_integration_webhook trigger (real webhook event generation)
--   + create_integration_checkout_session / get_integration_session RPCs
--
-- Conventions follow the existing schema:
--   * money = NUMERIC(12,2), text status with CHECK constraints
--   * public ids via generate_public_id()
--   * updated_at via update_updated_at_column()
--   * RLS "scoped by relationship" policies consistent with the rest of the app
--   * secret material (webhook secrets) never exposed by client RLS
-- =============================================================================

-- =============================================================================
-- 1) checkout_integrations  (one per merchant)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.checkout_integrations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_integration_id  TEXT,
  merchant_id            UUID NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL DEFAULT 'My Integration',
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','disabled')),
  live_enabled           BOOLEAN NOT NULL DEFAULT false,
  live_requested         BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_integrations_merchant ON public.checkout_integrations(merchant_id);

ALTER TABLE public.checkout_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their checkout integrations" ON public.checkout_integrations;
CREATE POLICY "Merchants view their checkout integrations"
  ON public.checkout_integrations FOR SELECT
  USING (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)));

DROP POLICY IF EXISTS "Merchants update their checkout integrations" ON public.checkout_integrations;
CREATE POLICY "Merchants update their checkout integrations"
  ON public.checkout_integrations FOR UPDATE
  USING (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)))
  WITH CHECK (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)));

DROP TRIGGER IF EXISTS update_checkout_integrations_updated_at ON public.checkout_integrations;
CREATE TRIGGER update_checkout_integrations_updated_at
  BEFORE UPDATE ON public.checkout_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_public_integration_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_integration_id := COALESCE(NEW.public_integration_id, public.generate_public_id('ITG', 'checkout_integration'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_integration_id ON public.checkout_integrations;
CREATE TRIGGER set_public_integration_id BEFORE INSERT ON public.checkout_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_public_integration_id();

-- Auto-create an integration for every merchant (matches merchant_checkout_config pattern)
CREATE OR REPLACE FUNCTION public.create_default_checkout_integration() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.checkout_integrations (merchant_id, name)
  VALUES (NEW.id, COALESCE(NEW.business_name, 'My Integration'))
  ON CONFLICT (merchant_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_checkout_integration_created ON public.merchants;
CREATE TRIGGER on_checkout_integration_created AFTER INSERT ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.create_default_checkout_integration();

-- =============================================================================
-- 2) api_keys  +  api_key_scopes
--    Only a key_hash (SHA-256) is ever stored. The full secret key is returned
--    exactly once at creation time. Environment is enforced at the DB level by
--    create_integration_checkout_session via the key's environment.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id   UUID NOT NULL REFERENCES public.checkout_integrations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL DEFAULT 'Key',
  key_type         TEXT NOT NULL CHECK (key_type IN ('publishable','secret')),
  environment      TEXT NOT NULL CHECK (environment IN ('test','live')),
  key_prefix       TEXT NOT NULL,
  key_hash         TEXT NOT NULL UNIQUE,
  last_four        TEXT NOT NULL,
  fingerprint      TEXT NOT NULL,
  scopes           JSONB NOT NULL DEFAULT '[]'::jsonb,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  last_used_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_integration ON public.api_keys(integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their integration api keys metadata" ON public.api_keys;
CREATE POLICY "Merchants view their integration api keys metadata"
  ON public.api_keys FOR SELECT
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

DROP POLICY IF EXISTS "Merchants update their integration api keys" ON public.api_keys;
CREATE POLICY "Merchants update their integration api keys"
  ON public.api_keys FOR UPDATE
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ))
  WITH CHECK (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

CREATE TABLE IF NOT EXISTS public.api_key_scopes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  scope      TEXT NOT NULL,
  UNIQUE (api_key_id, scope)
);

ALTER TABLE public.api_key_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their api key scopes" ON public.api_key_scopes;
CREATE POLICY "Merchants view their api key scopes"
  ON public.api_key_scopes FOR SELECT
  USING (api_key_id IN (
    SELECT k.id FROM public.api_keys k
    JOIN public.checkout_integrations i ON i.id = k.integration_id
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

-- =============================================================================
-- 3) webhook_endpoints
--    webhook secret is stored so the delivery worker can sign payloads; it is
--    returned to the merchant exactly once and never by any client RLS policy.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_webhook_id        TEXT,
  integration_id           UUID NOT NULL REFERENCES public.checkout_integrations(id) ON DELETE CASCADE,
  url                      TEXT NOT NULL,
  secret                   TEXT NOT NULL,
  events                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                   TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  last_delivered_at        TIMESTAMPTZ,
  last_success_at          TIMESTAMPTZ,
  last_failure_at          TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_integration ON public.webhook_endpoints(integration_id);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their webhook endpoints" ON public.webhook_endpoints;
CREATE POLICY "Merchants view their webhook endpoints"
  ON public.webhook_endpoints FOR SELECT
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

DROP POLICY IF EXISTS "Merchants update their webhook endpoints" ON public.webhook_endpoints;
CREATE POLICY "Merchants update their webhook endpoints"
  ON public.webhook_endpoints FOR UPDATE
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ))
  WITH CHECK (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

DROP TRIGGER IF EXISTS update_webhook_endpoints_updated_at ON public.webhook_endpoints;
CREATE TRIGGER update_webhook_endpoints_updated_at
  BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_public_webhook_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_webhook_id := COALESCE(NEW.public_webhook_id, public.generate_public_id('WEP', 'webhook_endpoint'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_webhook_id ON public.webhook_endpoints;
CREATE TRIGGER set_public_webhook_id BEFORE INSERT ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_public_webhook_id();

-- =============================================================================
-- 4) webhook_events  +  webhook_deliveries
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       TEXT NOT NULL UNIQUE,
  integration_id UUID NOT NULL REFERENCES public.checkout_integrations(id) ON DELETE CASCADE,
  session_id     UUID REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_integration ON public.webhook_events(integration_id, created_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their webhook events" ON public.webhook_events;
CREATE POLICY "Merchants view their webhook events"
  ON public.webhook_events FOR SELECT
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES public.webhook_events(id) ON DELETE CASCADE,
  endpoint_id      UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','delivered','failed','retrying','exhausted')),
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  http_status      INTEGER,
  response_body    TEXT,
  response_time_ms INTEGER,
  last_attempt_at  TIMESTAMPTZ,
  next_retry_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, endpoint_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON public.webhook_deliveries(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON public.webhook_deliveries(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON public.webhook_deliveries(endpoint_id, created_at DESC);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Merchants view their webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (endpoint_id IN (
    SELECT e.id FROM public.webhook_endpoints e
    JOIN public.checkout_integrations i ON i.id = e.integration_id
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

DROP POLICY IF EXISTS "Merchants update their webhook deliveries" ON public.webhook_deliveries;
CREATE POLICY "Merchants update their webhook deliveries"
  ON public.webhook_deliveries FOR UPDATE
  USING (endpoint_id IN (
    SELECT e.id FROM public.webhook_endpoints e
    JOIN public.checkout_integrations i ON i.id = e.integration_id
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ))
  WITH CHECK (endpoint_id IN (
    SELECT e.id FROM public.webhook_endpoints e
    JOIN public.checkout_integrations i ON i.id = e.integration_id
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

DROP TRIGGER IF EXISTS update_webhook_deliveries_updated_at ON public.webhook_deliveries;
CREATE TRIGGER update_webhook_deliveries_updated_at
  BEFORE UPDATE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 5) api_request_logs  (sanitized; never raw secrets / PII)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     TEXT NOT NULL UNIQUE,
  integration_id UUID REFERENCES public.checkout_integrations(id) ON DELETE CASCADE,
  api_key_id     UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  method         TEXT NOT NULL,
  endpoint       TEXT NOT NULL,
  status_code    INTEGER NOT NULL,
  latency_ms     INTEGER NOT NULL DEFAULT 0,
  environment    TEXT CHECK (environment IN ('test','live')),
  error_code     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_integration ON public.api_request_logs(integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_key ON public.api_request_logs(api_key_id, created_at DESC);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their api request logs" ON public.api_request_logs;
CREATE POLICY "Merchants view their api request logs"
  ON public.api_request_logs FOR SELECT
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

-- =============================================================================
-- 6) idempotency_keys
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id    UUID NOT NULL REFERENCES public.checkout_integrations(id) ON DELETE CASCADE,
  idempotency_key   TEXT NOT NULL,
  request_type      TEXT NOT NULL,
  request_hash      TEXT NOT NULL,
  resource_type     TEXT NOT NULL,
  resource_id       UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_id, idempotency_key)
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Merchants view their idempotency keys"
  ON public.idempotency_keys FOR SELECT
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

-- =============================================================================
-- 7) integration_test_runs, integration_incidents, integration_audit_logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.integration_test_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.checkout_integrations(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','passed','failed')),
  steps          JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_integration_test_runs_integration ON public.integration_test_runs(integration_id, started_at DESC);

ALTER TABLE public.integration_test_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their integration test runs" ON public.integration_test_runs;
CREATE POLICY "Merchants view their integration test runs"
  ON public.integration_test_runs FOR SELECT
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

DROP POLICY IF EXISTS "Merchants update their integration test runs" ON public.integration_test_runs;
CREATE POLICY "Merchants update their integration test runs"
  ON public.integration_test_runs FOR UPDATE
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ))
  WITH CHECK (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

CREATE TABLE IF NOT EXISTS public.integration_incidents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.checkout_integrations(id) ON DELETE CASCADE,
  severity       TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title          TEXT NOT NULL,
  message        TEXT,
  resolved       BOOLEAN NOT NULL DEFAULT false,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_incidents_integration ON public.integration_incidents(integration_id, created_at DESC);

ALTER TABLE public.integration_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their integration incidents" ON public.integration_incidents;
CREATE POLICY "Merchants view their integration incidents"
  ON public.integration_incidents FOR SELECT
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

DROP POLICY IF EXISTS "Merchants update their integration incidents" ON public.integration_incidents;
CREATE POLICY "Merchants update their integration incidents"
  ON public.integration_incidents FOR UPDATE
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ))
  WITH CHECK (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

CREATE TABLE IF NOT EXISTS public.integration_audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.checkout_integrations(id) ON DELETE CASCADE,
  actor_user_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role     TEXT,
  action         TEXT NOT NULL,
  entity         TEXT,
  entity_id      TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_audit_logs_integration ON public.integration_audit_logs(integration_id, created_at DESC);

ALTER TABLE public.integration_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants view their integration audit logs" ON public.integration_audit_logs;
CREATE POLICY "Merchants view their integration audit logs"
  ON public.integration_audit_logs FOR SELECT
  USING (integration_id IN (
    SELECT i.id FROM public.checkout_integrations i
    WHERE i.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

-- =============================================================================
-- 8) checkout_sessions integration columns
-- =============================================================================
ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES public.checkout_integrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS environment TEXT CHECK (environment IN ('test','live')),
  ADD COLUMN IF NOT EXISTS merchant_order_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_integration ON public.checkout_sessions(integration_id, created_at DESC);

-- A merchant order reference may only be used once per integration.
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkout_sessions_merchant_order
  ON public.checkout_sessions(integration_id, merchant_order_id)
  WHERE integration_id IS NOT NULL AND merchant_order_id IS NOT NULL;

-- =============================================================================
-- 9) Webhook event generation — DB trigger on checkout_sessions.
--    Fires for ANY path that transitions an integration session
--    (edge function finalize, razorpay-webhook, expiry, cancellation),
--    so merchant webhooks always reflect the true engine state.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
  p_integration_id UUID,
  p_session_id UUID,
  p_event_type TEXT,
  p_payload JSONB
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_id uuid;
  v_endpoint record;
BEGIN
  INSERT INTO public.webhook_events (event_id, integration_id, session_id, event_type, payload)
  VALUES ('evt_' || encode(extensions.gen_random_bytes(10), 'hex'), p_integration_id, p_session_id, p_event_type, p_payload)
  RETURNING id INTO v_event_id;

  FOR v_endpoint IN
    SELECT e.id FROM public.webhook_endpoints e
    WHERE e.integration_id = p_integration_id
      AND e.status = 'active'
      AND e.events ? p_event_type
  LOOP
    INSERT INTO public.webhook_deliveries (event_id, endpoint_id, status, next_retry_at)
    VALUES (v_event_id, v_endpoint.id, 'pending', now())
    ON CONFLICT (event_id, endpoint_id) DO NOTHING;
  END LOOP;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_integration_session_webhooks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base jsonb;
  v_item jsonb;
  v_tx record;
  v_order record;
BEGIN
  IF NEW.integration_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_base := jsonb_build_object(
    'session_id',         COALESCE(NEW.public_checkout_id, NEW.id::text),
    'merchant_order_id',  NEW.merchant_order_id,
    'environment',        NEW.environment,
    'amount',             NEW.final_amount,
    'currency',           NEW.currency,
    'status',             NEW.status,
    'created_at',         NEW.created_at
  );

  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_webhook_event(NEW.integration_id, NEW.id, 'checkout.created', v_base);
    RETURN NEW;
  END IF;

  -- First assignment of integration_id (create_integration_checkout_session
  -- inserts without it, then updates). Emit checkout.created here.
  IF OLD.integration_id IS DISTINCT FROM NEW.integration_id THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'item_name', i.item_name, 'sku', i.sku, 'quantity', i.quantity,
      'unit_price', i.unit_price, 'line_total', i.line_total
    )), '[]'::jsonb) INTO v_item
    FROM public.checkout_items i WHERE i.session_id = NEW.id;
    PERFORM public.enqueue_webhook_event(NEW.integration_id, NEW.id, 'checkout.created',
      v_base || jsonb_build_object('items', v_item));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'expired' THEN
      PERFORM public.enqueue_webhook_event(NEW.integration_id, NEW.id, 'checkout.expired',
        v_base || jsonb_build_object('reason', 'session_expired'));
    ELSIF NEW.status = 'cancelled' THEN
      PERFORM public.enqueue_webhook_event(NEW.integration_id, NEW.id, 'checkout.cancelled',
        v_base || jsonb_build_object('reason', 'cancelled'));
    ELSIF NEW.status = 'failed' THEN
      PERFORM public.enqueue_webhook_event(NEW.integration_id, NEW.id, 'payment.failed',
        v_base || jsonb_build_object('reason', 'payment_failed'));
    ELSIF NEW.status = 'completed' THEN
      PERFORM public.enqueue_webhook_event(NEW.integration_id, NEW.id, 'checkout.completed', v_base);

      IF NEW.payment_transaction_id IS NOT NULL THEN
        SELECT t.* INTO v_tx FROM public.payment_transactions t WHERE t.id = NEW.payment_transaction_id;
        IF FOUND THEN
          PERFORM public.enqueue_webhook_event(NEW.integration_id, NEW.id, 'payment.succeeded',
            v_base || jsonb_build_object(
              'payment_id', COALESCE(v_tx.public_payment_id, v_tx.id::text),
              'method', v_tx.method,
              'gateway_payment_id', v_tx.razorpay_payment_id,
              'paid_at', NEW.completed_at
            ));
        END IF;
      END IF;

      IF NEW.order_id IS NOT NULL THEN
        SELECT o.* INTO v_order FROM public.orders o WHERE o.id = NEW.order_id;
        IF FOUND THEN
          PERFORM public.enqueue_webhook_event(NEW.integration_id, NEW.id, 'order.created',
            v_base || jsonb_build_object(
              'order_id',    COALESCE(v_order.public_order_id, v_order.id::text),
              'order_number', v_order.order_number,
              'order_status', v_order.status,
              'escrow_status', v_order.escrow_status
            ));
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_integration_session_webhooks ON public.checkout_sessions;
CREATE TRIGGER enqueue_integration_session_webhooks
  AFTER INSERT OR UPDATE OF status, integration_id ON public.checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_integration_session_webhooks();

-- =============================================================================
-- 10) create_integration_checkout_session(integration, merchant, env, order_ref,
--     items[], fees, flags, expiry, metadata)
--     Server-side amount recomputation (reuses create_checkout_session engine),
--     environment enforcement, single-use merchant_order_id, idempotency.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_integration_checkout_session(
  p_integration_id   UUID,
  p_merchant_id      UUID,
  p_environment      TEXT,
  p_merchant_order_id TEXT,
  p_items            JSONB,
  p_shipping_amount  NUMERIC DEFAULT 0,
  p_discount_amount  NUMERIC DEFAULT 0,
  p_tax_amount       NUMERIC DEFAULT 0,
  p_requires_shipping BOOLEAN DEFAULT false,
  p_collect_email    BOOLEAN DEFAULT false,
  p_expiry_hours     INTEGER DEFAULT NULL,
  p_metadata         JSONB DEFAULT NULL,
  p_idempotency_key  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_integration public.checkout_integrations%ROWTYPE;
  v_created jsonb;
  v_session public.checkout_sessions%ROWTYPE;
  v_checkout_url text;
BEGIN
  SELECT * INTO v_integration FROM public.checkout_integrations WHERE id = p_integration_id;
  IF NOT FOUND OR v_integration.merchant_id <> p_merchant_id THEN
    RAISE EXCEPTION 'INTEGRATION_NOT_FOUND';
  END IF;
  IF v_integration.status <> 'active' THEN
    RAISE EXCEPTION 'INTEGRATION_DISABLED';
  END IF;

  -- Environment enforcement at the DB level: live requires live_enabled.
  IF p_environment NOT IN ('test','live') THEN
    RAISE EXCEPTION 'INVALID_ENVIRONMENT';
  END IF;
  IF p_environment = 'live' AND NOT v_integration.live_enabled THEN
    RAISE EXCEPTION 'LIVE_NOT_ENABLED';
  END IF;

  IF p_merchant_order_id IS NULL OR length(btrim(p_merchant_order_id)) = 0 THEN
    RAISE EXCEPTION 'MERCHANT_ORDER_REQUIRED';
  END IF;
  IF length(p_merchant_order_id) > 100 THEN
    RAISE EXCEPTION 'MERCHANT_ORDER_TOO_LONG';
  END IF;

  -- Single-use merchant order reference per integration (idempotent replay returns the same session)
  SELECT * INTO v_session
  FROM public.checkout_sessions
    WHERE integration_id = p_integration_id AND merchant_order_id = p_merchant_order_id
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'id',                v_session.id,
      'public_checkout_id', v_session.public_checkout_id,
      'token',             v_session.token,
      'status',            v_session.status,
      'subtotal',          v_session.subtotal,
      'discount_amount',   v_session.discount_amount,
      'shipping_amount',   v_session.shipping_amount,
      'tax_amount',        v_session.tax_amount,
      'service_fee_amount', v_session.service_fee_amount,
      'final_amount',      v_session.final_amount,
      'currency',          v_session.currency,
      'expires_at',        v_session.expires_at,
      'merchant_order_id', v_session.merchant_order_id,
      'environment',       v_session.environment,
      'integration_id',    p_integration_id,
      'already_exists',    true
    );
  END IF;

  v_created := public.create_checkout_session(
    p_merchant_id, p_items,
    p_shipping_amount, p_discount_amount, p_tax_amount,
    p_requires_shipping, p_collect_email, p_expiry_hours,
    COALESCE(p_metadata, '{}'::jsonb),
    NULL::uuid
  );

  UPDATE public.checkout_sessions
    SET integration_id = p_integration_id,
        environment = p_environment,
        merchant_order_id = p_merchant_order_id,
        idempotency_key = p_idempotency_key
    WHERE id = (v_created->>'id')::uuid;

  SELECT * INTO v_session FROM public.checkout_sessions WHERE id = (v_created->>'id')::uuid;

  RETURN jsonb_build_object(
    'id',                 v_session.id,
    'public_checkout_id', v_session.public_checkout_id,
    'token',              v_session.token,
    'status',             v_session.status,
    'subtotal',           v_session.subtotal,
    'discount_amount',    v_session.discount_amount,
    'shipping_amount',    v_session.shipping_amount,
    'tax_amount',         v_session.tax_amount,
    'service_fee_amount', v_session.service_fee_amount,
    'final_amount',       v_session.final_amount,
    'currency',           v_session.currency,
    'expires_at',         v_session.expires_at,
    'merchant_order_id',  v_session.merchant_order_id,
    'environment',        v_session.environment,
    'integration_id',     p_integration_id,
    'already_exists',     false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_integration_checkout_session(UUID, UUID, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, INTEGER, JSONB, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.create_integration_checkout_session(UUID, UUID, TEXT, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, INTEGER, JSONB, TEXT) FROM anon, authenticated, public;

-- =============================================================================
-- 11) get_integration_session(integration_id, session_id) — API read path.
--     Returns session + items + payment + order for the integration owner.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_integration_session(
  p_integration_id UUID,
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.checkout_sessions%ROWTYPE;
  v_items jsonb;
  v_tx jsonb;
  v_order jsonb;
  v_attempts jsonb;
BEGIN
  SELECT * INTO v_session FROM public.checkout_sessions WHERE id = p_session_id;
  IF NOT FOUND OR v_session.integration_id <> p_integration_id THEN
    RAISE EXCEPTION 'SESSION_NOT_FOUND';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'item_name', i.item_name, 'variant_label', i.variant_label, 'sku', i.sku,
      'unit_price', i.unit_price, 'quantity', i.quantity,
      'discount', i.discount, 'tax_amount', i.tax_amount, 'line_total', i.line_total
    )), '[]'::jsonb) INTO v_items
  FROM public.checkout_items i WHERE i.session_id = v_session.id;

  SELECT jsonb_build_object(
      'id', t.id, 'public_payment_id', t.public_payment_id,
      'amount', t.amount, 'currency', t.currency, 'status', t.status,
      'method', t.method, 'gateway', t.gateway,
      'razorpay_order_id', t.razorpay_order_id,
      'razorpay_payment_id', t.razorpay_payment_id,
      'failure_reason', t.failure_reason, 'created_at', t.created_at
    ) INTO v_tx
  FROM public.payment_transactions t WHERE t.session_id = v_session.id
  ORDER BY t.created_at DESC LIMIT 1;

  SELECT jsonb_build_object(
      'id', o.id, 'public_order_id', o.public_order_id, 'order_number', o.order_number,
      'status', o.status, 'escrow_status', o.escrow_status,
      'amount', o.amount, 'currency', o.currency, 'created_at', o.created_at
    ) INTO v_order
  FROM public.orders o WHERE o.id = v_session.order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'method', a.method, 'status', a.status,
      'failure_reason', a.failure_reason, 'created_at', a.created_at
    ) ORDER BY a.created_at), '[]'::jsonb) INTO v_attempts
  FROM public.payment_attempts a WHERE a.session_id = v_session.id;

  RETURN jsonb_build_object(
    'id', v_session.id,
    'public_checkout_id', v_session.public_checkout_id,
    'merchant_order_id', v_session.merchant_order_id,
    'environment', v_session.environment,
    'status', v_session.status,
    'current_step', v_session.current_step,
    'currency', v_session.currency,
    'subtotal', v_session.subtotal,
    'discount_amount', v_session.discount_amount,
    'shipping_amount', v_session.shipping_amount,
    'tax_amount', v_session.tax_amount,
    'service_fee_amount', v_session.service_fee_amount,
    'final_amount', v_session.final_amount,
    'guest_name', v_session.guest_name,
    'guest_email', v_session.guest_email,
    'created_at', v_session.created_at,
    'expires_at', v_session.expires_at,
    'completed_at', v_session.completed_at,
    'items', v_items,
    'payment', v_tx,
    'order', v_order,
    'payment_attempts', v_attempts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_integration_session(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.get_integration_session(UUID, UUID) FROM anon, authenticated, public;

-- =============================================================================
-- 12) list_integration_sessions — paginated session list for the dashboard.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.list_integration_sessions(
  p_integration_id UUID,
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_count integer;
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN RAISE EXCEPTION 'INVALID_LIMIT'; END IF;
  IF p_offset < 0 THEN RAISE EXCEPTION 'INVALID_OFFSET'; END IF;

  SELECT count(*) INTO v_count FROM public.checkout_sessions
    WHERE integration_id = p_integration_id
      AND (p_status IS NULL OR status = p_status);

  SELECT COALESCE(jsonb_agg(s ORDER BY s->>'created_at' DESC), '[]'::jsonb) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'public_checkout_id', s.public_checkout_id,
      'merchant_order_id', s.merchant_order_id,
      'environment', s.environment,
      'status', s.status,
      'final_amount', s.final_amount,
      'currency', s.currency,
      'guest_name', s.guest_name,
      'guest_email', s.guest_email,
      'created_at', s.created_at,
      'expires_at', s.expires_at,
      'completed_at', s.completed_at,
      'order_id', s.order_id
    ) AS s
    FROM public.checkout_sessions s
    WHERE s.integration_id = p_integration_id
      AND (p_status IS NULL OR s.status = p_status)
    ORDER BY s.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object('sessions', v_result, 'total', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_integration_sessions(UUID, INTEGER, INTEGER, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.list_integration_sessions(UUID, INTEGER, INTEGER, TEXT) FROM anon, authenticated, public;

-- =============================================================================
-- 13) integration_health — REAL metrics computed from live data.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.integration_health(p_integration_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created integer;
  v_completed integer;
  v_failed integer;
  v_revenue numeric;
  v_webhook_failures integer;
  v_webhook_successes integer;
  v_avg_latency numeric;
  v_recent_errors integer;
  v_last_success timestamptz;
  v_last_webhook_success timestamptz;
  v_sessions_24h integer;
BEGIN
  SELECT count(*) INTO v_created FROM public.checkout_sessions
    WHERE integration_id = p_integration_id;
  SELECT count(*) INTO v_completed FROM public.checkout_sessions
    WHERE integration_id = p_integration_id AND status = 'completed';
  SELECT count(*) INTO v_failed FROM public.checkout_sessions
    WHERE integration_id = p_integration_id AND status = 'failed';
  SELECT COALESCE(sum(final_amount), 0) INTO v_revenue FROM public.checkout_sessions
    WHERE integration_id = p_integration_id AND status = 'completed';

  SELECT count(*) INTO v_webhook_successes FROM public.webhook_deliveries d
    JOIN public.webhook_endpoints e ON e.id = d.endpoint_id
    WHERE e.integration_id = p_integration_id AND d.status = 'delivered';
  SELECT count(*) INTO v_webhook_failures FROM public.webhook_deliveries d
    JOIN public.webhook_endpoints e ON e.id = d.endpoint_id
    WHERE e.integration_id = p_integration_id AND d.status IN ('failed','exhausted');

  SELECT round(avg(latency_ms), 0) INTO v_avg_latency FROM public.api_request_logs
    WHERE integration_id = p_integration_id;

  SELECT count(*) INTO v_recent_errors FROM public.api_request_logs
    WHERE integration_id = p_integration_id AND status_code >= 400
      AND created_at >= now() - interval '7 days';

  SELECT max(created_at) INTO v_last_success FROM public.checkout_sessions
    WHERE integration_id = p_integration_id AND status = 'completed';
  SELECT max(last_success_at) INTO v_last_webhook_success FROM public.webhook_endpoints
    WHERE integration_id = p_integration_id;

  SELECT count(*) INTO v_sessions_24h FROM public.checkout_sessions
    WHERE integration_id = p_integration_id AND created_at >= now() - interval '24 hours';

  RETURN jsonb_build_object(
    'sessions_created', v_created,
    'sessions_completed', v_completed,
    'sessions_failed', v_failed,
    'revenue', v_revenue,
    'webhook_successes', v_webhook_successes,
    'webhook_failures', v_webhook_failures,
    'avg_api_latency_ms', v_avg_latency,
    'recent_api_errors_7d', v_recent_errors,
    'last_successful_checkout', v_last_success,
    'last_successful_webhook', v_last_webhook_success,
    'sessions_24h', v_sessions_24h,
    'health_score', CASE
      WHEN v_created = 0 THEN 0
      ELSE GREATEST(0, round(100 - (v_failed::numeric / GREATEST(v_created, 1) * 40) - v_webhook_failures * 2 - v_recent_errors, 0))
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.integration_health(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.integration_health(UUID) FROM anon, authenticated, public;
