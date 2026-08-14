-- =============================================================================
-- 20260814_checkout_links.sql
-- Reusable checkout links (see checkout.md).
--
-- A checkout link is now a PARENT/SOURCE entity that can receive unlimited
-- independent orders. The link stays active until:
--   * the merchant disables it (status -> 'inactive'),
--   * its configured expiration policy passes (expires_at < now() -> 'expired'),
--   * an administrator disables it (status -> 'cancelled').
--
-- Architecture:  Checkout Link -> Checkout Session -> Customer -> Payment -> Order
-- Every customer interaction creates its OWN checkout session
-- (checkout_sessions.checkout_link_id), its own payment transaction and its own
-- order. Sessions, transactions and orders remain single-use (their own unique
-- keys); ONLY the link is reusable.
--
-- Adds:
--   checkout_links, checkout_link_items
--   + checkout_sessions.checkout_link_id
--   + functions: create_checkout_link, update_checkout_link,
--     set_checkout_link_status, list_checkout_links, get_checkout_link,
--     open_checkout_link (public), create_checkout_session gains a
--     p_checkout_link_id parameter
--   + legacy backfill so previously shared session-token URLs keep working
-- =============================================================================

-- =============================================================================
-- 1) checkout_links
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.checkout_links (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_link_id       TEXT,
  token                TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  merchant_id          UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  title                TEXT,
  status               TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','inactive','expired','cancelled')),
  requires_shipping    BOOLEAN NOT NULL DEFAULT false,
  collect_email        BOOLEAN NOT NULL DEFAULT false,
  shipping_amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  discount_amount      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  expires_at           TIMESTAMPTZ,
  session_expiry_hours INTEGER NOT NULL DEFAULT 24 CHECK (session_expiry_hours BETWEEN 1 AND 168),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS checkout_links_token_key ON public.checkout_links(token);
CREATE INDEX IF NOT EXISTS idx_checkout_links_merchant ON public.checkout_links(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_links_status ON public.checkout_links(status);

ALTER TABLE public.checkout_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view their checkout links"
  ON public.checkout_links FOR SELECT
  USING (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)));

CREATE POLICY "Merchants update their checkout links"
  ON public.checkout_links FOR UPDATE
  USING (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)))
  WITH CHECK (merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p)));

CREATE TRIGGER update_checkout_links_updated_at
  BEFORE UPDATE ON public.checkout_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LNK- public id
CREATE OR REPLACE FUNCTION public.set_public_link_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.public_link_id := COALESCE(NEW.public_link_id, public.generate_public_id('LNK', 'checkout_link'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS set_public_link_id ON public.checkout_links;
CREATE TRIGGER set_public_link_id BEFORE INSERT ON public.checkout_links
  FOR EACH ROW EXECUTE FUNCTION public.set_public_link_id();

-- =============================================================================
-- 2) checkout_link_items (reusable product/service template)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.checkout_link_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id             UUID NOT NULL REFERENCES public.checkout_links(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_checkout_link_items_link ON public.checkout_link_items(link_id);

ALTER TABLE public.checkout_link_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view items of their checkout links"
  ON public.checkout_link_items FOR SELECT
  USING (link_id IN (
    SELECT l.id FROM public.checkout_links l
    WHERE l.merchant_id IN (SELECT m.id FROM public.merchants m WHERE m.user_id IN (SELECT p.id FROM public.profiles p))
  ));

-- =============================================================================
-- 3) Sessions now belong to a link
-- =============================================================================
ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS checkout_link_id UUID REFERENCES public.checkout_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_link ON public.checkout_sessions(checkout_link_id, created_at DESC);

-- =============================================================================
-- 4) create_checkout_link(merchant, title, items[], fees, flags, expiry)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_checkout_link(
  p_merchant_id          UUID,
  p_title                TEXT DEFAULT NULL,
  p_items                JSONB DEFAULT NULL,
  p_shipping_amount      NUMERIC DEFAULT 0,
  p_discount_amount      NUMERIC DEFAULT 0,
  p_tax_amount           NUMERIC DEFAULT 0,
  p_requires_shipping    BOOLEAN DEFAULT false,
  p_collect_email        BOOLEAN DEFAULT false,
  p_expires_at           TIMESTAMPTZ DEFAULT NULL,
  p_session_expiry_hours INTEGER DEFAULT NULL
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
  v_link_id  uuid;
  v_token    text;
  v_public   text;
  v_session_expiry integer;
  v_title    text;
BEGIN
  SELECT * INTO v_merchant FROM public.merchants WHERE id = p_merchant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MERCHANT_NOT_FOUND'; END IF;
  IF v_merchant.verification_status <> 'approved' OR NOT v_merchant.is_active THEN
    RAISE EXCEPTION 'MERCHANT_NOT_ELIGIBLE';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS';
  END IF;

  FOR v_item IN
    SELECT COALESCE(x.item_name, '')            AS item_name,
           COALESCE(x.unit_price, 0)::numeric   AS unit_price,
           COALESCE(x.quantity, 0)::int         AS quantity,
           COALESCE(x.discount, 0)::numeric     AS discount,
           COALESCE(x.tax_amount, 0)::numeric   AS tax_amount
    FROM jsonb_to_recordset(p_items) AS x(
      item_name text, unit_price numeric, quantity int, discount numeric, tax_amount numeric)
  LOOP
    IF length(btrim(v_item.item_name)) = 0 THEN RAISE EXCEPTION 'ITEM_NAME_REQUIRED'; END IF;
    IF length(btrim(v_item.item_name)) > 200 THEN RAISE EXCEPTION 'ITEM_NAME_TOO_LONG'; END IF;
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

  IF p_shipping_amount < 0 OR p_shipping_amount > 1000000 THEN RAISE EXCEPTION 'INVALID_SHIPPING'; END IF;
  IF p_tax_amount < 0 OR p_tax_amount > 1000000 THEN RAISE EXCEPTION 'INVALID_TAX'; END IF;
  IF p_discount_amount < 0 OR p_discount_amount > v_subtotal THEN RAISE EXCEPTION 'INVALID_DISCOUNT'; END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN RAISE EXCEPTION 'INVALID_LINK_EXPIRY'; END IF;

  PERFORM public.get_merchant_checkout_config(p_merchant_id);
  SELECT * INTO v_cfg FROM public.merchant_checkout_config WHERE merchant_id = p_merchant_id;
  v_session_expiry := COALESCE(p_session_expiry_hours, v_cfg.session_expiry_hours, 24);
  IF v_session_expiry < 1 OR v_session_expiry > 168 THEN RAISE EXCEPTION 'INVALID_EXPIRY'; END IF;

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');

  INSERT INTO public.checkout_links (
    merchant_id, title, requires_shipping, collect_email,
    shipping_amount, discount_amount, tax_amount, expires_at, session_expiry_hours
  )
  VALUES (
    p_merchant_id, v_title, p_requires_shipping, p_collect_email,
    p_shipping_amount, p_discount_amount, p_tax_amount, p_expires_at, v_session_expiry
  )
  RETURNING id, token, public_link_id INTO v_link_id, v_token, v_public;

  INSERT INTO public.checkout_link_items (
    link_id, item_name, variant_label, variant_attributes, sku,
    unit_price, quantity, discount, tax_amount, line_total
  )
  SELECT v_link_id, x.item_name, x.variant_label, x.variant_attributes, x.sku,
         x.unit_price, x.quantity,
         COALESCE(x.discount,0), COALESCE(x.tax_amount,0),
         round(COALESCE(x.unit_price,0) * COALESCE(x.quantity,0) - COALESCE(x.discount,0) + COALESCE(x.tax_amount,0), 2)
  FROM jsonb_to_recordset(p_items) AS x(
    item_name text, variant_label text, variant_attributes jsonb, sku text,
    unit_price numeric, quantity int, discount numeric, tax_amount numeric);

  RETURN jsonb_build_object(
    'id', v_link_id,
    'public_link_id', v_public,
    'token', v_token,
    'title', v_title,
    'status', 'active',
    'expires_at', p_expires_at,
    'session_expiry_hours', v_session_expiry,
    'created_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_checkout_link(UUID, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, TIMESTAMPTZ, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.create_checkout_link(UUID, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, TIMESTAMPTZ, INTEGER) FROM anon, authenticated, public;

-- =============================================================================
-- 5) update_checkout_link — merchant edits the reusable link template
--    Only non-NULL params are applied; items are replaced when provided.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_checkout_link(
  p_merchant_id          UUID,
  p_link_id              UUID,
  p_title                TEXT DEFAULT NULL,
  p_items                JSONB DEFAULT NULL,
  p_shipping_amount      NUMERIC DEFAULT NULL,
  p_discount_amount      NUMERIC DEFAULT NULL,
  p_tax_amount           NUMERIC DEFAULT NULL,
  p_requires_shipping    BOOLEAN DEFAULT NULL,
  p_collect_email        BOOLEAN DEFAULT NULL,
  p_expires_at           TIMESTAMPTZ DEFAULT NULL,
  p_session_expiry_hours INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.checkout_links%ROWTYPE;
  v_subtotal NUMERIC(12,2) := 0;
BEGIN
  SELECT * INTO v_link FROM public.checkout_links WHERE id = p_link_id AND merchant_id = p_merchant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LINK_NOT_FOUND'; END IF;

  IF p_shipping_amount IS NOT NULL AND (p_shipping_amount < 0 OR p_shipping_amount > 1000000) THEN
    RAISE EXCEPTION 'INVALID_SHIPPING';
  END IF;
  IF p_tax_amount IS NOT NULL AND (p_tax_amount < 0 OR p_tax_amount > 1000000) THEN
    RAISE EXCEPTION 'INVALID_TAX';
  END IF;
  IF p_session_expiry_hours IS NOT NULL AND (p_session_expiry_hours < 1 OR p_session_expiry_hours > 168) THEN
    RAISE EXCEPTION 'INVALID_EXPIRY';
  END IF;

  -- When replacing items, validate against the effective discount bound.
  IF p_items IS NOT NULL THEN
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'NO_ITEMS';
    END IF;
    SELECT COALESCE(sum(x.unit_price * x.quantity), 0) INTO v_subtotal
    FROM jsonb_to_recordset(p_items) AS x(item_name text, unit_price numeric, quantity int);
    IF COALESCE(p_discount_amount, v_link.discount_amount) < 0
       OR COALESCE(p_discount_amount, v_link.discount_amount) > v_subtotal THEN
      RAISE EXCEPTION 'INVALID_DISCOUNT';
    END IF;
  END IF;

  UPDATE public.checkout_links SET
    title             = CASE WHEN p_title IS NOT NULL THEN NULLIF(btrim(p_title), '') ELSE title END,
    shipping_amount   = COALESCE(p_shipping_amount, shipping_amount),
    discount_amount   = COALESCE(p_discount_amount, discount_amount),
    tax_amount        = COALESCE(p_tax_amount, tax_amount),
    requires_shipping = COALESCE(p_requires_shipping, requires_shipping),
    collect_email     = COALESCE(p_collect_email, collect_email),
    expires_at        = CASE WHEN p_expires_at IS NOT NULL THEN p_expires_at ELSE expires_at END,
    session_expiry_hours = COALESCE(p_session_expiry_hours, session_expiry_hours),
    updated_at        = now()
  WHERE id = p_link_id;

  IF p_items IS NOT NULL THEN
    DELETE FROM public.checkout_link_items WHERE link_id = p_link_id;
    INSERT INTO public.checkout_link_items (
      link_id, item_name, variant_label, variant_attributes, sku,
      unit_price, quantity, discount, tax_amount, line_total
    )
    SELECT p_link_id, x.item_name, x.variant_label, x.variant_attributes, x.sku,
           x.unit_price, x.quantity,
           COALESCE(x.discount,0), COALESCE(x.tax_amount,0),
           round(COALESCE(x.unit_price,0) * COALESCE(x.quantity,0) - COALESCE(x.discount,0) + COALESCE(x.tax_amount,0), 2)
    FROM jsonb_to_recordset(p_items) AS x(
      item_name text, variant_label text, variant_attributes jsonb, sku text,
      unit_price numeric, quantity int, discount numeric, tax_amount numeric);
  END IF;

  RETURN jsonb_build_object('id', p_link_id, 'updated', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_checkout_link(UUID, UUID, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, TIMESTAMPTZ, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.update_checkout_link(UUID, UUID, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, TIMESTAMPTZ, INTEGER) FROM anon, authenticated, public;

-- =============================================================================
-- 6) set_checkout_link_status — merchant enable / disable (reusable link toggle)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_checkout_link_status(
  p_merchant_id UUID,
  p_link_id     UUID,
  p_status      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.checkout_links%ROWTYPE;
BEGIN
  SELECT * INTO v_link FROM public.checkout_links WHERE id = p_link_id AND merchant_id = p_merchant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LINK_NOT_FOUND'; END IF;
  IF p_status NOT IN ('active', 'inactive') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;

  UPDATE public.checkout_links SET status = p_status, updated_at = now() WHERE id = p_link_id;
  RETURN jsonb_build_object('id', p_link_id, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_checkout_link_status(UUID, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.set_checkout_link_status(UUID, UUID, TEXT) FROM anon, authenticated, public;

-- =============================================================================
-- 7) list_checkout_links(merchant) — links + aggregate revenue/orders metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION public.list_checkout_links(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                   l.id,
      'public_link_id',       l.public_link_id,
      'token',                l.token,
      'title',                l.title,
      'status',               l.status,
      'expires_at',           l.expires_at,
      'session_expiry_hours', l.session_expiry_hours,
      'created_at',           l.created_at,
      'updated_at',           l.updated_at,
      'sessions_count',       (SELECT count(*) FROM public.checkout_sessions s WHERE s.checkout_link_id = l.id),
      'orders_count',         (SELECT count(*) FROM public.checkout_sessions s WHERE s.checkout_link_id = l.id AND s.status = 'completed'),
      'success_payments',     (SELECT count(*) FROM public.payment_transactions t JOIN public.checkout_sessions s ON s.id = t.session_id WHERE s.checkout_link_id = l.id AND t.status = 'success'),
      'failed_payments',      (SELECT count(*) FROM public.payment_transactions t JOIN public.checkout_sessions s ON s.id = t.session_id WHERE s.checkout_link_id = l.id AND t.status = 'failed'),
      'revenue',              COALESCE((SELECT sum(s.final_amount) FROM public.checkout_sessions s WHERE s.checkout_link_id = l.id AND s.status = 'completed'), 0),
      'last_activity_at',     (SELECT max(s.created_at) FROM public.checkout_sessions s WHERE s.checkout_link_id = l.id)
    ) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM public.checkout_links l
  WHERE l.merchant_id = p_merchant_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_checkout_links(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.list_checkout_links(UUID) FROM anon, authenticated, public;

-- =============================================================================
-- 8) get_checkout_link(merchant, link) — link + items + session/order ledger
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_checkout_link(p_merchant_id UUID, p_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link     public.checkout_links%ROWTYPE;
  v_items    jsonb;
  v_sessions jsonb;
BEGIN
  SELECT * INTO v_link FROM public.checkout_links WHERE id = p_link_id AND merchant_id = p_merchant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'LINK_NOT_FOUND'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', i.id, 'item_name', i.item_name, 'variant_label', i.variant_label,
      'variant_attributes', i.variant_attributes, 'sku', i.sku,
      'unit_price', i.unit_price, 'quantity', i.quantity,
      'discount', i.discount, 'tax_amount', i.tax_amount, 'line_total', i.line_total
    ) ORDER BY i.created_at, i.id), '[]'::jsonb)
  INTO v_items
  FROM public.checkout_link_items i WHERE i.link_id = v_link.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id',               s.id,
      'public_checkout_id', s.public_checkout_id,
      'status',           s.status,
      'final_amount',     s.final_amount,
      'currency',         s.currency,
      'guest_name',       s.guest_name,
      'guest_phone',      s.guest_phone,
      'guest_email',      s.guest_email,
      'created_at',       s.created_at,
      'completed_at',     s.completed_at,
      'order_id',         s.order_id,
      'order_public_id',  o.public_order_id,
      'order_number',     o.order_number
    ) ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO v_sessions
  FROM public.checkout_sessions s
  LEFT JOIN public.orders o ON o.id = s.order_id
  WHERE s.checkout_link_id = v_link.id;

  RETURN jsonb_build_object(
    'id',                   v_link.id,
    'public_link_id',       v_link.public_link_id,
    'token',                v_link.token,
    'title',                v_link.title,
    'status',               v_link.status,
    'requires_shipping',    v_link.requires_shipping,
    'collect_email',        v_link.collect_email,
    'shipping_amount',      v_link.shipping_amount,
    'discount_amount',      v_link.discount_amount,
    'tax_amount',           v_link.tax_amount,
    'expires_at',           v_link.expires_at,
    'session_expiry_hours', v_link.session_expiry_hours,
    'created_at',           v_link.created_at,
    'updated_at',           v_link.updated_at,
    'items',                v_items,
    'sessions',             v_sessions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_checkout_link(UUID, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.get_checkout_link(UUID, UUID) FROM anon, authenticated, public;

-- =============================================================================
-- 9) create_checkout_session — add p_checkout_link_id so sessions opened from a
--    link carry the link FK (atomic, single call).
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
  p_metadata         JSONB DEFAULT NULL,
  p_checkout_link_id UUID DEFAULT NULL
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

  IF p_checkout_link_id IS NOT NULL THEN
    PERFORM 1 FROM public.checkout_links
      WHERE id = p_checkout_link_id AND merchant_id = p_merchant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LINK_NOT_FOUND';
    END IF;
  END IF;

  PERFORM public.get_merchant_checkout_config(p_merchant_id);
  SELECT * INTO v_cfg FROM public.merchant_checkout_config WHERE merchant_id = p_merchant_id;

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

  v_shipping := COALESCE(p_shipping_amount, 0);
  v_discount := COALESCE(p_discount_amount, 0);
  v_tax      := COALESCE(p_tax_amount, 0);
  IF v_shipping < 0 OR v_shipping > 1000000 THEN RAISE EXCEPTION 'INVALID_SHIPPING'; END IF;
  IF v_tax < 0 OR v_tax > 1000000 THEN RAISE EXCEPTION 'INVALID_TAX'; END IF;
  IF v_discount < 0 OR v_discount > v_subtotal THEN RAISE EXCEPTION 'INVALID_DISCOUNT'; END IF;

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
    expires_at, metadata, checkout_link_id
  )
  VALUES (
    p_merchant_id, v_subtotal, v_discount, v_shipping, v_tax, v_fee, v_final,
    p_requires_shipping, p_collect_email, v_expires, p_metadata, p_checkout_link_id
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

GRANT EXECUTE ON FUNCTION public.create_checkout_session(UUID, JSONB, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, INTEGER, JSONB, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.create_checkout_session(UUID, JSONB, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, BOOLEAN, INTEGER, JSONB, UUID) FROM anon, authenticated, public;

-- =============================================================================
-- 10) open_checkout_link(link_token, session_token) — the ONLY public read path
--     for checkout links. Validates the link + merchant, resumes the caller's
--     own active session when provided, otherwise creates a brand-new checkout
--     session from the link template. Never reuses another customer's session.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.open_checkout_link(p_link_token TEXT, p_session_token TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link      public.checkout_links%ROWTYPE;
  v_merchant  public.merchants%ROWTYPE;
  v_session   public.checkout_sessions%ROWTYPE;
  v_items     jsonb;
  v_created   jsonb;
  v_payload   jsonb;
  v_resumed   boolean := false;
BEGIN
  SELECT * INTO v_link FROM public.checkout_links WHERE token = p_link_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('not_found', true);
  END IF;

  SELECT * INTO v_merchant FROM public.merchants WHERE id = v_link.merchant_id;
  IF v_merchant.verification_status <> 'approved' OR NOT v_merchant.is_active THEN
    RETURN jsonb_build_object('error', 'MERCHANT_NOT_ELIGIBLE');
  END IF;

  IF v_link.status <> 'active' THEN
    RETURN jsonb_build_object('error', 'LINK_NOT_ACTIVE', 'status', v_link.status);
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    UPDATE public.checkout_links SET status = 'expired', updated_at = now()
      WHERE id = v_link.id AND status = 'active';
    RETURN jsonb_build_object('error', 'LINK_EXPIRED');
  END IF;

  -- Resume ONLY the caller's own active session for this link (same-browser
  -- refresh / reopen). A completed/failed/expired session never blocks a fresh
  -- purchase: a new session is created instead.
  IF p_session_token IS NOT NULL THEN
    SELECT * INTO v_session FROM public.checkout_sessions
      WHERE token = p_session_token AND checkout_link_id = v_link.id;
    IF FOUND AND v_session.status = 'active' AND v_session.expires_at > now() THEN
      v_resumed := true;
    END IF;
  END IF;

  IF NOT v_resumed THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'item_name', i.item_name, 'variant_label', i.variant_label,
        'variant_attributes', i.variant_attributes, 'sku', i.sku,
        'unit_price', i.unit_price, 'quantity', i.quantity,
        'discount', i.discount, 'tax_amount', i.tax_amount
      )), '[]'::jsonb)
    INTO v_items
    FROM public.checkout_link_items i WHERE i.link_id = v_link.id;

    IF jsonb_array_length(v_items) = 0 THEN
      RETURN jsonb_build_object('error', 'LINK_NO_ITEMS');
    END IF;

    v_created := public.create_checkout_session(
      v_link.merchant_id, v_items,
      v_link.shipping_amount, v_link.discount_amount, v_link.tax_amount,
      v_link.requires_shipping, v_link.collect_email, v_link.session_expiry_hours,
      NULL, v_link.id
    );

    SELECT * INTO v_session FROM public.checkout_sessions
      WHERE id = (v_created->>'id')::uuid;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'SESSION_CREATE_FAILED');
    END IF;
  END IF;

  v_payload := public.get_public_checkout_session(v_session.token);

  RETURN v_payload || jsonb_build_object(
    'resumed', v_resumed,
    'link', jsonb_build_object(
      'id',               v_link.id,
      'public_link_id',   v_link.public_link_id,
      'title',            v_link.title,
      'token',            v_link.token,
      'status',           v_link.status,
      'expires_at',       v_link.expires_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_checkout_link(TEXT, TEXT) TO anon, authenticated;

-- =============================================================================
-- 11) Legacy backfill — turn every existing one-shot session into a reusable
--     link so previously shared URLs keep working and merchants keep their
--     history. Session tokens become link tokens (continuity), completed/failed
--     sessions become active reusable links (the whole point of this change);
--     only explicitly expired/cancelled sessions become inactive links.
-- =============================================================================
INSERT INTO public.checkout_links (
  merchant_id, title, status, requires_shipping, collect_email,
  shipping_amount, discount_amount, tax_amount, expires_at, session_expiry_hours,
  token, created_at, updated_at
)
SELECT
  s.merchant_id,
  'Legacy payment link ' || s.public_checkout_id,
  CASE WHEN s.status IN ('expired', 'cancelled') THEN 'inactive' ELSE 'active' END,
  s.requires_shipping,
  s.collect_email,
  s.shipping_amount,
  s.discount_amount,
  s.tax_amount,
  NULL,
  24,
  s.token,
  s.created_at,
  now()
FROM public.checkout_sessions s
WHERE NOT EXISTS (SELECT 1 FROM public.checkout_links l WHERE l.token = s.token);

INSERT INTO public.checkout_link_items (
  link_id, item_name, variant_label, variant_attributes, sku,
  unit_price, quantity, discount, tax_amount, line_total
)
SELECT
  l.id, i.item_name, i.variant_label, i.variant_attributes, i.sku,
  i.unit_price, i.quantity, i.discount, i.tax_amount, i.line_total
FROM public.checkout_items i
JOIN public.checkout_sessions s ON s.id = i.session_id
JOIN public.checkout_links l ON l.token = s.token
WHERE NOT EXISTS (
  SELECT 1 FROM public.checkout_link_items x WHERE x.link_id = l.id
);

UPDATE public.checkout_sessions s
SET checkout_link_id = l.id
FROM public.checkout_links l
WHERE l.token = s.token AND s.checkout_link_id IS NULL;
