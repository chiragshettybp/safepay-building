# SafePay Checkout — Technical & Functional Specification

> Status: **implemented** · Last updated: 2026-08-13
> Companion planning doc: `checkoutphases.md`

This document is the single source of truth for the **SafePay Hosted Checkout & Merchant Settlement** feature. A developer or AI agent must be able to implement or extend the feature from this document alone, without guessing.

---

## 1. Feature Scope & Purpose

### What it is

A **hosted checkout** for Indian D2C merchants. A merchant creates a **checkout session** containing an immutable snapshot of an order (items, variants, quantities, unit prices, discounts, shipping, tax). The merchant shares a **checkout link** (`/checkout/:token`) with a customer. The customer — logged in **or guest** — opens the link, reviews the frozen order, enters contact/shipping details, pays through the SafePay payment layer, and receives a confirmed order. Funds are held in escrow (`orders.escrow_status = 'held'`), then released to the merchant wallet when the order is completed and delivery confirmed (existing escrow model). Merchants can then withdraw via the existing payout flow.

### Why it exists

The existing app has a **manual, single-item, customer-logged-in-only** payment form (`/payment/new`). There is:
- no way for a merchant to create a shareable checkout link,
- no multi-item / variant-aware order snapshot,
- no guest checkout (customers must have an account),
- no per-merchant checkout configuration,
- no checkout analytics.

This feature closes those gaps and turns SafePay from "customer pays a merchant" into "merchant sells to a customer via SafePay checkout" — while reusing the existing escrow, order, wallet, payout, dispute, and notification systems.

### Out of scope (explicitly)

- Admin portal / admin review of payouts (exists as a separate known gap).
- Real inventory deduction and reservation (only the order snapshot is stored; inventory is the merchant's responsibility).
- Email/SMS delivery of checkout links (in-app copy-link only).
- COD (cash on delivery) — prepaid methods only, matching the existing gateway model.
- Automatic gateway payout processing (existing `merchant_payouts` flow is reused; a real bank-transfer executor is out of scope and documented as a gap).
- Regulatory escrow-accounting. The app models escrow via `orders.escrow_status` (an existing convention). Real RBI payment-aggregator/escrow compliance is a business/legal dependency, not a software one.

---

## 2. Actors & Permissions

| Actor | Definition | Can | Cannot |
|---|---|---|---|
| **Customer** | A logged-in SafePay user (`useAuth()`); or a **guest** who completes checkout without logging in | Open a checkout link, review items, enter details, pay, receive order confirmation, later view the order in their account (when linked) | Modify the frozen amount/items, access another customer's order, alter payment state |
| **Merchant** | A logged-in SafePay merchant (`useMerchantAuth()`, `merchant.verificationStatus === 'approved'` && `isActive`) | Create checkout sessions, view own sessions + analytics, copy/share links, see orders and payouts created from checkouts | Modify platform payment state, access another merchant's sessions |
| **System** | Server-side SQL functions + edge functions using the service-role key | Create orders on verified payment, finalize payments, notify, expire sessions | Nothing client-side can impersonate this role |

There is **no admin role** in this feature; admin settlement exists today only as the `resolve_dispute()` SQL function with no UI (unchanged).

### Authorization rules

- **Public checkout page** (`/checkout/:token`) requires **no session** — the token is the capability. RLS on `checkout_sessions` allows anonymous `SELECT` **only for active/valid sessions by token** and does **not** expose the merchant's other data.
- **Payment initiation/finalization** is done exclusively by the `checkout-payment` edge function (service role) which validates the token and session server-side.
- **Merchant pages** are wrapped in `MerchantProtectedRoute` and RLS scopes all merchant queries to `merchants.user_id IN profiles` (existing convention).
- **Customer order view** is scoped by `orders.customer_id` (existing RLS).

---

## 3. System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          MERCHANT STORE                            │
│  (MerchantCheckout / MerchantCheckoutCreate pages in this app)     │
└───────────────────────────────┬────────────────────────────────────┘
                                │ creates session (immutable snapshot)
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                      checkout_sessions + checkout_items            │
│         token (unguessable) → public link /checkout/:token         │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                    PUBLIC HOSTED CHECKOUT PAGE                     │
│  Step: review order snapshot → customer details → payment method    │
└───────────────────────────────┬────────────────────────────────────┘
                                │ create-payment (server validates,      │
                                │ creates payment_transactions pending)   │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                     checkout-payment edge function                  │
│   • validates session/amount/expiry server-side                     │
│   • creates payment_transactions (pending) + payment_attempts       │
│   • returns Razorpay order (real mode) or test-mode handshake       │
└───────────────────────────────┬────────────────────────────────────┘
                                │ customer pays (Razorpay modal / test)
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                    VERIFIED PAYMENT (2 paths)                       │
│  A) razorpay-webhook (HMAC-signed, idempotent)  ← source of truth   │
│  B) verify-payment action (HMAC + Razorpay API verification)        │
└───────────────────────────────┬────────────────────────────────────┘
                                │ finalize_checkout_payment (SQL, atomic)
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  orders (+order_items snapshot) · payment_transactions success      │
│  checkout_sessions → completed · customer associated · notifications│
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  ESCROW + SETTLEMENT (reuses existing model)                        │
│  pending/held → shipped → delivered → completed/released            │
│  → merchant_wallets credited (trigger) → merchant_payouts withdrawal│
└────────────────────────────────────────────────────────────────────┘
```

**The most important rule:** the frontend redirect is **never** the source of truth for payment success. Payment success is only recorded after server-side verification (webhook with HMAC signature + idempotency, or edge-function verification against the gateway API).

---

## 4. Data Model

### 4.1 New tables (created by migration `supabase/migrations/20260813_checkout_system.sql`)

#### `checkout_sessions`
| column | type | notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `public_checkout_id` | text | `CHK-XXXXXXXXXXXX` via existing `generate_public_id()` trigger |
| `token` | text UNIQUE | 64-char random hex; used in public link; unguessable |
| `merchant_id` | uuid FK → merchants | owner |
| `customer_id` | uuid nullable FK → profiles | set if a logged-in customer opens the link |
| `guest_name` / `guest_phone` / `guest_email` | text nullable | filled from checkout details form |
| `status` | text | `active` \| `expired` \| `completed` \| `failed` \| `abandoned` (default `active`) |
| `current_step` | text | `details` \| `payment` \| `confirmation` (default `details`) |
| `currency` | text default `INR` | |
| `subtotal` / `discount_amount` / `shipping_amount` / `tax_amount` / `service_fee_amount` / `final_amount` | numeric(12,2) | frozen at creation; recomputed server-side on create, never from client |
| `shipping_address` | jsonb nullable | {full_name, phone, line1, line2, city, state, pincode, country} |
| `selected_payment_method` | text nullable | `upi` \| `card` \| `netbanking` \| `wallet` |
| `requires_shipping` | boolean | from merchant config at creation |
| `collect_email` | boolean | from merchant config |
| `expires_at` | timestamptz | created_at + config.session_expiry_hours (default 24h) |
| `payment_transaction_id` | uuid nullable FK → payment_transactions | latest attempt |
| `order_id` | uuid nullable FK → orders | set on finalization |
| `completed_at` | timestamptz nullable | |
| `metadata` | jsonb nullable | merchant order ref, notes |
| `created_at` / `updated_at` | timestamptz | |

**Invariants:** `final_amount = subtotal − discount_amount + shipping_amount + tax_amount + service_fee_amount`. All money columns are locked at creation and are **never modified by the client**.

#### `checkout_items` (order snapshot line items)
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → checkout_sessions (cascade) | |
| `item_name` | text | snapshot |
| `variant_label` | text nullable | e.g. "Black / M" |
| `variant_attributes` | jsonb nullable | e.g. `{"color":"Black","size":"M"}` |
| `sku` | text nullable | snapshot |
| `unit_price` | numeric(12,2) | snapshot — price at session creation |
| `quantity` | int ≥ 1 | |
| `discount` | numeric(12,2) default 0 | line-level |
| `tax_amount` | numeric(12,2) default 0 | line-level |
| `line_total` | numeric(12,2) | `(unit_price × quantity) − discount + tax_amount` |
| `created_at` | timestamptz | |

Snapshot semantics: later price changes in the merchant store do **not** affect an existing session (the session is frozen). Checkout items are copied into `order_items` on payment.

#### `checkout_events` (audit trail of steps)
`id`, `session_id` (FK cascade), `event_type` (e.g. `created`, `details_submitted`, `payment_started`, `payment_verified`, `completed`, `expired`), `step`, `event_data` jsonb, `created_at`.

#### `payment_attempts`
`id`, `session_id` (FK), `payment_transaction_id` (FK), `method` text, `status` (`initiated` \| `processing` \| `success` \| `failed` \| `cancelled`), `failure_reason` text, `metadata` jsonb, `created_at`, `updated_at`. One per payment initiation; supports retries (multiple attempts per session).

#### `payment_webhook_logs` (gateway idempotency)
`id`, `gateway` default `razorpay`, `gateway_event_id` text **UNIQUE**, `event_type` text, `payload` jsonb, `status` (`received` \| `processed` \| `ignored` \| `error`), `error` text, `processed_at`. The unique `gateway_event_id` makes duplicate webhook delivery harmless.

#### `merchant_checkout_config`
| column | default | notes |
|---|---|---|
| `id` uuid PK | | |
| `merchant_id` uuid FK, UNIQUE | | one row per merchant |
| `guest_checkout_enabled` | true | when false, only logged-in customers can complete |
| `email_required` | false | when true, email is mandatory |
| `shipping_required` | false | when true, shipping address form is shown |
| `payment_cards_enabled` / `payment_upi_enabled` / `payment_netbanking_enabled` / `payment_wallets_enabled` | true | payment method availability |
| `session_expiry_hours` | 24 | session lifetime |
| `service_fee_percent` | 2 | applied to `final_amount` (displayed to customer; matches existing 2% convention) |
| `success_url` / `cancel_url` | null | optional external redirect targets |
| `notification_email` | null | reserved for future email notifications |
| `created_at` / `updated_at` | | |

A config row is auto-created by a trigger when a merchant is created (defaults above).

#### `order_items`
Copy of checkout items at purchase time. `id`, `order_id` FK → orders (cascade), `item_name`, `variant_label`, `variant_attributes`, `sku`, `unit_price`, `quantity`, `discount`, `tax_amount`, `line_total`, `created_at`. RLS mirrors `orders` (customer owns, merchant sees own).

### 4.2 Changes to existing tables

- `orders`: add `checkout_session_id uuid` (nullable FK → checkout_sessions), `item_count int DEFAULT 1`.
- `orders`: partial unique index `orders_checkout_session_id_uq ON orders(checkout_session_id) WHERE checkout_session_id IS NOT NULL` — **hard guarantee that one checkout session produces at most one order**.
- `payment_transactions`: add `session_id uuid` (nullable FK → checkout_sessions), `gateway text DEFAULT 'razorpay'`, `method text`; partial unique index `payment_transactions_razorpay_payment_id_uq ON payment_transactions(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL` (idempotency for gateway payments).

### 4.3 RLS summary

| table | policy |
|---|---|
| `checkout_sessions` | `SELECT`: anon/authenticated where `token = current token` **and** `status IN ('active')`; merchant SELECT/UPDATE own (`merchant_id` in own merchants); INSERT/UPDATE allowed only for merchant-owned rows (app uses edge function with service role for creation, but merchant UI needs SELECT+UPDATE for cancelling sessions) |
| `checkout_items` | `SELECT`: anon where parent session is active & token matches; merchant own. INSERT not exposed publicly (created via service-role path) |
| `checkout_events` | `SELECT`: merchant own; INSERT service-role only (anon blocked) |
| `payment_attempts` | `INSERT`: any (used by edge function as service role anyway); `SELECT`: merchant own session |
| `payment_webhook_logs` | no public access (service role only) |
| `merchant_checkout_config` | merchant own SELECT/UPDATE; INSERT trigger handles creation |
| `order_items` | customer own order, merchant own order (mirror `orders`) |
| `orders`, `payment_transactions` | unchanged existing policies + `payment_transactions.session_id` selectable by merchant owner of session |

---

## 5. Checkout Session Lifecycle (state machine)

```
                     ┌────────────┐
                     │   active   │
                     └─────┬──────┘
            details form   │
                     ┌─────▼──────┐
                     │   details  │  (current_step)
                     └─────┬──────┘
            pay initiated   │
                     ┌─────▼──────┐
                     │  payment   │   (payment_transactions pending)
                     └─────┬──────┘
            verified        │        ┌──────────────┐
            (webhook/API) ──┤──────► │  completed   │  order_id set
                     ┌─────▼──────┐   └──────────────┘
                     │  failed    │  (retry allowed → back to payment)
                     └────────────┘
  active → expired   (expires_at passed)
  active → cancelled (merchant cancels; only if no order)
  active → abandoned (never completed before expiry; derived)
```

- `status` values: `active`, `expired`, `completed`, `failed`, `cancelled`, `abandoned`.
- `current_step` values: `details`, `payment`, `confirmation`.
- **Never** allow: `completed → active`, or a second order from one session (unique index), or a second payment on a `completed` session.
- Transition enforcement is server-side only (SQL functions + edge function). The UI never mutates `status`/`order_id` directly.

---

## 6. Payment State Machine

Reuses `payment_transactions.status` (`pending`, `success`, `failed`, `refunded`) plus `payment_attempts.status`:

```
pending ──verify──► success   (only via server-side verification)
   │                    │
   ├──cancel/fail────► failed
   └──timeout────────► failed (or stays pending until webhook reconciles)
```

- `pending → success` happens **only** in `finalize_checkout_payment()` (SQL, service-role invoked).
- `success` is terminal (refunds use the `refunds` table + existing triggers).
- `failed → success` is impossible: finalization requires status `pending` **or** an already-`success` (idempotent re-run) transaction; never `failed`.

---

## 7. Complete User Flows

### 7.1 Merchant: create & share a checkout session

1. Merchant logs in → taps **Checkout** (bottom nav) → `/merchant-checkout`.
2. Sees analytics strip (sessions created, completed, conversion rate, revenue from completed checkout orders) + list of sessions (public id, status badge, amount, created date) + **New Checkout Session** button.
3. **Create session** (`/merchant-checkout/create`):
   - **Items** — dynamic rows: item name*, variant label (optional), SKU (optional), unit price (₹)*, quantity* (≥1). Add/remove item rows. Repeats of the same item allowed (kept as separate lines).
   - **Shipping** — amount (default 0), toggled with **Require shipping address** checkbox.
   - **Discount** — amount (default 0; must be ≤ subtotal; a warning shows if discount ≥ subtotal).
   - **Tax** — amount (default 0).
   - **Collect email** toggle (default from merchant config).
   - **Expiry** — hours (default from config, min 1, max 168).
   - **Order reference / notes** (optional, stored in `metadata`).
   - Totals preview recomputed live: `subtotal`, `−discount`, `+shipping`, `+tax`, `+service fee (config%)`, `= final`.
   - Submit → server-side totals recomputation (never trusts client totals) → session created (`status=active`, `current_step=details`).
4. **Success view** shows: the checkout link `{origin}/checkout/{token}` with **Copy link**, **Open checkout** (new tab), and the public `CHK-` id. Also a note that a `MERCHANT_ORDER_REF` in metadata is preserved.
5. Merchant can **cancel** an active session from the list/details (only when `order_id IS NULL` and not `completed`). Cancelled sessions cannot be paid.

### 7.2 Customer: complete a checkout (guest or logged in)

1. Opens `/checkout/:token`.
2. Page validates the session server-side (via a lightweight public read). Outcomes:
   - **Valid & active** → render checkout.
   - **Expired** → expired state (message + "contact merchant", no payment).
   - **Completed** → "This order was already completed" + link to view order if the customer is the owner (or success summary).
   - **Cancelled/failed** → cancelled state.
   - **Unknown token** → not-found state.
3. **Step 1 — Review** (default): shows merchant branding (name, logo if present), the frozen item list (name, variant, qty × unit price, line total), totals (subtotal, discount, shipping, tax, service fee with tooltip, final). Items and totals are **read-only**.
4. **Step 2 — Details**: form with full name*, phone* (10-digit Indian mobile, normalized to `91` format consistent with app), email (required only if `collect_email`/`email_required`), and if `requires_shipping`: line1*, city*, state*, pincode* (6 digits), country (default India). If the customer is logged in, fields **prefill** from `profiles`/`customer_addresses`-style snapshot (name/phone/email). Validation client-side (zod) **and** server-side in the edge function.
5. **Step 3 — Payment**: payment method selection cards (UPI / Card / Netbanking / Wallet) filtered by merchant config. **Pay** button. If the customer is **not** logged in, a subtle "Continue as guest" option and a "Login to SafePay" link.
6. **Payment initiation**: calls `checkout-payment` → `create-payment`.
   - Server validates: token, session `active` + not expired, merchant active, `final_amount` from DB (never from client), guest checkout allowed (config), method enabled (config), details valid.
   - Server creates `payment_transactions` (`status=pending`, `amount=session.final_amount`, `session_id`, `method`), `payment_attempts` (`initiated`), updates `session.current_step='payment'`, logs `checkout_events`.
   - Real mode: returns `razorpay_order_id` + `key_id`; client opens the Razorpay modal.
   - Test mode (gateway not configured / `CHECKOUT_TEST_MODE=true`): returns `mode:'test'`; client shows the existing app-style **Complete / Cancel** test layer.
7. **Payment completion**:
   - Real: on `payment.success` from Razorpay modal, client calls `checkout-payment` → `verify-payment` with the razorpay payment id + signature. Server HMAC-verifies and cross-checks via Razorpay API, then calls `finalize_checkout_payment()`.
   - Test: client calls `verify-payment` with `mode:'test'` (server-enforced in test mode only).
   - `finalize_checkout_payment()` atomically: marks transaction `success`, creates `orders` (`status='pending'`, `escrow_status='held'`, `checkout_session_id`, `item_count`), copies `checkout_items` → `order_items`, sets `session.order_id` + `status='completed'` + `current_step='confirmation'` + `completed_at`, logs `checkout_events`, notifies merchant + customer.
   - **Customer association** (idempotent): if `customer_id` on session is set, order links to it. Otherwise, find `profiles` by phone; if found link, else create a **guest profile** (`account_source='payment_link'`, `account_claimed=false`, random unusable password hash) and link. The existing `profiles.phone` UNIQUE index makes this race-safe (conflict → re-select).
8. **Success screen** (`/checkout/:token/success` or inline): confetti/check, order public id (`ORD-…`), amount, merchant name, "Your payment was successful" + **View order** (if logged in → `/orders/:id`), and "Continue" (goes to merchant `success_url` if configured). The page derives state from the server (token → session → order) so a refresh shows the same result.
9. **Failure/cancel**: session stays `active` (or `failed` status for record), `payment_attempts` marked `failed/cancelled`, customer sees an error + **Retry payment** (new attempt) or **Back to details**.

### 7.3 Post-checkout

- Customer orders appear in `/orders`, `/transactions`, wallet views via existing code (they are normal `orders`/`payment_transactions` rows).
- `OrderDetails` shows the item snapshot from `order_items` (new integration) when present.
- Merchant sees checkout-created orders in `/merchant-orders` and can manage tracking/delivery as today; confirming delivery releases escrow and credits the wallet (existing triggers).
- Merchant withdraws from `/merchant-payouts` (existing flow).

---

## 8. Edge Function: `checkout-payment`

New edge function `supabase/functions/checkout-payment/index.ts` (`verify_jwt=false`, service-role). Actions (POST JSON `{ action, ... }`):

### `create-payment`
Input: `{ token, name, phone, email?, shippingAddress?, method, testMode? }`.
1. Look up session by `token`. 404 if missing; reject if `status != 'active'`; reject if `expires_at < now()` (→ mark `expired`); reject if merchant inactive.
2. Validate customer details (name ≥ 2 chars, phone = 10-digit India → normalize `91XXXX`; email format if required; shipping fields per `requires_shipping`).
3. Validate `method` ∈ enabled set from `merchant_checkout_config` (and `guest_checkout_enabled` when no `customer_id`).
4. Persist `guest_name/phone/email`, `shipping_address`, `selected_payment_method` on session.
5. **Amount is always `session.final_amount` read from DB.** Never from request.
6. Insert `payment_transactions` (pending), `payment_attempts` (initiated). Update `current_step='payment'`. Log event.
7. If real Razorpay (`RAZORPAY_KEY_ID`/`SECRET` present and not `testMode`): create Razorpay order (`amount=final_amount×100` paise, `receipt=session CHK id`) and return `{ mode:'razorpay', razorpayOrderId, keyId, transactionId }`.
8. Else return `{ mode:'test', transactionId }`.

### `verify-payment`
Input: `{ token, transactionId, razorpayPaymentId?, razorpaySignature?, razorpayOrderId?, mode? }`.
1. Load session + transaction by id (must belong to session).
2. Reject if transaction already `success` (idempotent OK — see #4 below) or session already completed → return current order (safe re-entry).
3. **Verification**:
   - Real mode: verify HMAC-SHA256 signature over `razorpay_order_id|razorpay_payment_id` with `RAZORPAY_KEY_SECRET` **and** confirm via `GET /v1/payments/{id}` that `status ∈ {captured, authorized}`. Both must pass.
   - Test mode (only when `CHECKOUT_TEST_MODE=true` and `razorpayPaymentId` is absent or prefixed `test_`): simulate success.
4. Call `SELECT public.finalize_checkout_payment(p_transaction_id, p_gateway_payment_id, p_gateway_signature)` via service role. The SQL function is **idempotent**: if order already exists for the session it returns the existing order instead of creating a second one.
5. Return `{ success:true, order: {...}, publicOrderId }`.

### `cancel-payment`
Input: `{ token, transactionId, reason }`. Marks transaction `failed` + attempt `cancelled` (only if still `pending`). Session remains `active` for retry.

### `get-status`
Input: `{ token }`. Returns session + current transaction + order (if any). Used by the success page and refresh/back handling so the UI can always re-derive authoritative state.

### Security notes
- All actions take the public `token` as the capability; no auth header needed (public checkout).
- Never returns gateway secrets or other merchants' data.
- Amount is never accepted from the client.
- `finalize_checkout_payment` is `SECURITY DEFINER`; direct RPC invocation by anon is **revoked** (only the edge function and triggers call it).

---

## 9. SQL Functions (migration)

### `public.finalize_checkout_payment(p_transaction_id uuid, p_gateway_payment_id text, p_gateway_signature text) RETURNS jsonb`
`SECURITY DEFINER`, transaction-safe.
1. Load transaction; if not found → error. Guard: only finalize when `status IN ('pending','success')` (never `failed`).
2. Load session via `transaction.session_id`; if `session.order_id IS NOT NULL` → **idempotent return** of existing order.
3. `UPDATE payment_transactions SET status='success', razorpay_payment_id=COALESCE(...), razorpay_signature=..., order_id=<created> WHERE id=... AND status='pending'` (only transition if pending).
4. Resolve `customer_id`: session's `customer_id`, else profile by `guest_phone`, else create guest profile (`account_source='payment_link'`, `account_claimed=false`, random hash).
5. Insert `orders` (status `pending`, escrow `held`, `checkout_session_id`, `item_count`, `product_name` = first item name or "Checkout order", `amount = transaction.amount`, `currency`, `merchant_id`). Unique index guarantees single order per session (conflict → return existing).
6. Copy `checkout_items` → `order_items`.
7. Update session: `status='completed'`, `order_id`, `current_step='confirmation'`, `completed_at`, `payment_transaction_id`.
8. Notifications: merchant (`New order {ORD-…} from checkout`), customer (if profile exists: `Order confirmed`).
9. Return `{ order_id, order_number, public_order_id, created }`.

### `public.expire_checkout_sessions() RETURNS integer`
Batch: sets `status='expired'` where `status='active' AND expires_at < now()`; logs `checkout_events`; returns count. Called by the edge function on `create-payment`/`get-status` (lazy expiration) so no scheduler is required.

### `public.checkout_analytics(p_merchant_id uuid) RETURNS jsonb`
Aggregates for a merchant: `sessions_created`, `sessions_completed`, `conversion_rate`, `revenue (sum of final_amount of completed)`, `avg_order_value`, `by_status` breakdown. Used by the merchant dashboard.

### `public.create_merchant_checkout_config_trigger()`
`AFTER INSERT ON merchants` → insert default config row.

### Triggers
- `set_public_checkout_id` BEFORE INSERT on `checkout_sessions` (`CHK-` prefix via `generate_public_id`).
- `checkout_created_event` AFTER INSERT on `checkout_sessions` → `checkout_events` (`created`).
- `update_*_updated_at` on all new tables (existing helper).

---

## 10. UI Components & Routes

### New routes (`src/App.tsx`)
| Route | Page | Guard |
|---|---|---|
| `/checkout/:token` | `src/pages/PublicCheckout.tsx` | public |
| `/checkout/:token/success` | `src/pages/PublicCheckoutSuccess.tsx` | public |
| `/merchant-checkout` | `src/pages/MerchantCheckout.tsx` | `MerchantProtectedRoute` |
| `/merchant-checkout/create` | `src/pages/MerchantCheckoutCreate.tsx` | `MerchantProtectedRoute` |
| `/merchant-checkout/:sessionId` | `src/pages/MerchantCheckoutDetails.tsx` | `MerchantProtectedRoute` |

### New shared helpers
- `src/lib/checkout.ts`: `createCheckoutToken()`, type interfaces for session/items/events, `CHECKOUT_METHODS` labels/icons, `validatePhone`, normalization helpers, `buildCheckoutLink(session)`.
- `src/hooks/useCheckoutSession.ts`: loads session by token, subscribes to realtime changes (for payment status on the success page), exposes `{ session, items, loading, error, refresh }`.

### UI states (mandatory on every relevant surface)
- **Loading**: `FullPageLoading` / `LoadingSpinner` / skeleton cards while fetching session/orders.
- **Empty**: merchant checkout list with no sessions → `EmptyState` + CTA to create one.
- **Success**: success page with confetti, order id, amount, next actions.
- **Error**: session not found / expired / completed / cancelled / server errors → dedicated inline panels with clear copy + retry where applicable.
- **Disabled**: payment buttons disabled while submitting or when terms not agreed (mirrors `PaymentReview`); create-session submit disabled when items invalid.

### Styling conventions (must match existing app)
- Public checkout: `mobile-page` pattern with `sticky-header`, `max-w-md mx-auto`, `bottom-action` sticky CTA — identical language to `PaymentReview.tsx`.
- Merchant pages: header + `MerchantBottomNav` + `min-h-[100dvh] bg-background flex flex-col` (pattern from `MerchantDashboard.tsx`).
- Money: `formatAmount()` from `src/lib/format.ts`; IDs via `PublicIdBadge`; status pills via `StatusBadge`.
- Toasts: customer pages → `@/lib/toast`; merchant pages → `sonner`.

---

## 11. Validation Rules

| Field | Rule |
|---|---|
| item name | required, ≤ 200 chars |
| variant label | optional, ≤ 200 chars |
| sku | optional, ≤ 100 chars |
| unit price | required, > 0, ≤ 1000000 |
| quantity | int 1..9999 |
| shipping | ≥ 0 |
| discount | ≥ 0, ≤ subtotal (create) |
| tax | ≥ 0 |
| session expiry | 1..168 hours |
| full name (details) | required, ≥ 2 chars |
| phone | 10-digit Indian mobile → normalize `91…` |
| email | required iff `email_required`/`collect_email`; RFC format |
| pincode | 6 digits iff shipping required |
| final_amount | ≥ ₹1; ≤ ₹100,000 (server clamp) |
| payment method | must be in merchant config enabled set |

**Server-side recomputation:** on `create-session`, the edge function/merchant path recomputes `subtotal = Σ unit_price×qty`, `line_total`, `final_amount` and **ignores** any totals supplied by the client.

---

## 12. Business Rules

1. Only `verification_status='approved'` + `is_active=true` merchants can create sessions.
2. One session → at most one order (unique index). One session → exactly one successful payment (guarded in finalize).
3. Session amount is immutable after creation. Any UI that shows it is display-only.
4. A customer may retry payment any number of times before expiry; each retry is a new `payment_attempt`.
5. Guest checkout controlled by `merchant_checkout_config.guest_checkout_enabled`.
6. Merchant wallet is credited only when order completes + escrow released (existing trigger) — checkout orders follow the same rule.
7. Cancelled/expired/abandoned sessions never create orders.
8. If a payment succeeds server-side but the customer's browser closed, the order still exists (finalize is server-side); the success page re-derives from `get-status` on revisit.
9. Duplicate webhook/verify calls are harmless (idempotency via unique `gateway_event_id`, unique `razorpay_payment_id`, and finalize's order-exists guard).

---

## 13. Edge Cases & Failure Scenarios

| Scenario | Behavior |
|---|---|
| Session expired while customer is on the page | `create-payment` marks it `expired`; page shows expired panel |
| Token invalid | 404 not-found panel |
| Session already completed + browser re-opens link | Page shows "already completed" + order summary (server-derived) |
| Payment fails | `payment_attempts` failed; session stays `active`; customer can retry or cancel; cancel marks session `failed` (only before order) |
| Browser closed after payment | Webhook/verify already finalized; `get-status` returns completed; success page shows result on revisit |
| Customer refreshes mid-checkout | Server state re-derived (`get-status`); details/payment steps preserved in `sessionStorage` per session token |
| Customer presses back after paying | Success page/order link is the target; back guard on success page (see §14) |
| Double-click Pay | `isSubmittingRef` guard + server-side: second `create-payment` creates a new attempt but only one can finalize (order-exists guard) |
| Duplicate webhook delivery | `payment_webhook_logs.gateway_event_id` UNIQUE → ignored |
| Gateway timeout / delayed webhook | transaction stays `pending`; the delayed webhook or `verify-payment` reconciles it; never marked failed by client |
| Guest phone matches existing user | order linked to that user (idempotent, race-safe via phone UNIQUE) |
| Guest phone matches two concurrent checkouts | profile insert conflict → re-select existing; no duplicate profiles |
| Merchant disabled mid-checkout | `create-payment` rejects (merchant inactive); existing active sessions surface an error |
| Session cancelled by merchant while paying | `create-payment`/`verify` rejects `status != active`; page shows cancelled |
| Discount ≥ subtotal | blocked at creation (validation) |
| Zero-quantity / negative price | blocked at creation (validation) |
| Currency not INR | only INR is supported in UI (server accepts `session.currency`) |
| fee percent = 0 | allowed; fee line hidden when 0 |

---

## 14. Refresh / Back / Abandon / Retry Semantics

- **Refresh on checkout steps**: details + payment progress persisted to `sessionStorage` keyed by token (`checkout:{token}`), so refresh restores the form and step. Payment step refetches `get-status` first.
- **Back from payment**: allowed only while transaction is `pending` and not submitted; back returns to details, then `create-payment` may create a fresh attempt on re-submit.
- **Abandon**: sessions simply expire per `expires_at` (lazy `expire_checkout_sessions()` on next touch). Abandoned = active sessions past expiry.
- **Retry after failure**: explicit **Retry** button → new `create-payment` attempt (fresh transaction id), old attempt stays `failed`.
- **Back after success**: the success route is entered via redirect; the previous step button is replaced by **Continue** to avoid re-initiation. `sessionStorage` success flag cleared on entry.
- **Duplicate submit**: guarded by ref + server idempotency.

---

## 15. Notifications

Created server-side (in `finalize_checkout_payment`):
- **Merchant** (`notifications` row for `merchants.user_id`): `"New order {ORD-…} · {amount}"` type `success`, link `/merchant-order/{orderId}`.
- **Customer** (when a profile is linked): `"Order confirmed {ORD-…}"` type `success`, link `/orders/{orderId}`.
- Checkout events are NOT user notifications (they live in `checkout_events`).

Existing `notify_order_status_change`, escrow triggers, dispute/refund triggers continue to apply to checkout orders automatically.

---

## 16. Merchant Analytics (Checkout dashboard)

Computed by `checkout_analytics(merchant_id)`:
- sessions created (all time / last 30 days)
- sessions completed
- conversion rate = completed / created (×100)
- revenue = Σ `final_amount` of completed sessions
- average order value = revenue / completed
- by-status breakdown (active / completed / expired / failed / cancelled)
Displayed as `metric-card` grid on `/merchant-checkout`.

---

## 17. Dependencies on Existing Features

| Depends on | How |
|---|---|
| `merchant_auth` (custom auth) | merchant pages + `MerchantProtectedRoute` |
| `auth` (custom customer auth) | prefill + order linking + customer order view |
| `orders` + escrow model | checkout orders flow through it; wallet credit trigger |
| `payment_transactions` | payment records |
| `merchant_wallets` / `merchant_payouts` | settlement & withdrawal (unchanged) |
| `public_id_registry`/`generate_public_id` | `CHK-` ids |
| `notifications` | merchant/customer notifications |
| `order_events` | order lifecycle events (auto) |
| `razorpay` + `razorpay-webhook` edge functions | real gateway (existing; enhanced webhook optional) |
| `formatAmount` / `StatusBadge` / `PublicIdBadge` / ui kit | design consistency |

---

## 18. Security Considerations

1. **Amount integrity**: amount always read from DB; client totals ignored.
2. **Token as capability**: 64-hex unguessable token; no enumeration (single-row lookup; no list exposure to anon).
3. **Payment finalization**: only service-role code (edge function) + `SECURITY DEFINER` SQL may transition `pending → success`; anon/authenticated RPC to `finalize_checkout_payment` is `REVOKE`d.
4. **Signature verification** (real mode): HMAC-SHA256 + gateway API cross-check, constant-time compare.
5. **Webhook idempotency**: unique `gateway_event_id`.
6. **RLS**: guest `SELECT` on sessions restricted to `token = auth-less lookup` via RPC/edge function; the REST layer never lists sessions by merchant without merchant auth.
7. **Secrets**: gateway keys, service-role key, webhook secret exist only in edge-function env / `.env.local` — never in client bundles or DB.
8. **Guest profiles**: created with unusable random hash + `account_claimed=false`; they cannot log in and hold no privileged data.
9. **No mass data exposure**: `checkout_events`, `payment_webhook_logs`, `payment_attempts` are not publicly writable.

---

## 19. "Fully Working" Definition (acceptance)

A merchant can:
1. Open `/merchant-checkout`, see analytics + empty state, and create a multi-item checkout session with variants, shipping, discount, tax.
2. Copy and open the checkout link (in incognito) and complete checkout as a **guest** and as a **logged-in customer**.
3. See the order appear in `/merchant-orders` and be notified; manage tracking/delivery; escrow releases and wallet balance increases on delivery confirmation (existing behavior).
4. See the customer's `ORD-…` on the success screen and in the customer's `/orders`.

A customer can:
5. Complete a guest checkout without an account and later, on logging in with the same phone, see the order in `/orders`.
6. Refresh, go back, retry a failed payment, and re-open the link — always landing on a correct, server-derived state.
7. Never change the amount or items.

The system:
8. Produces at most one order per session, exactly-once notifications, no duplicate payments (idempotency proven by repeating webhook/verify).
9. Expires stale sessions and never lets them pay.
10. Passes `npm run lint` and `npm run build` cleanly.

---

## 20. Assumptions

- Payment gateway credentials may be absent → **test mode** is the default runtime path (mirrors the app's existing `RAZORPAY_ENABLED = false` convention). All code paths for real mode are implemented and gated by env config.
- `profiles.phone` is the canonical customer identifier for guest linking (existing schema).
- Merchant fee is display-level (existing convention); platform revenue accounting is out of scope.
- The connected Supabase project is the runtime; migrations in `supabase/migrations/` are the source of truth and are applied via the Management API/`supabase db push` (not tracked remotely).
