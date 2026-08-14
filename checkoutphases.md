# SafePay Checkout — Implementation Phases

> Companion to `checkout.md`. Ordered from foundation → complete feature. Each phase has objective, build list, acceptance criteria, and testing requirements. **Do not start a phase until the previous one's exit criteria are met.**

---

## Phase 1 — Foundation: Database schema & server functions

**Objective:** Create every table, constraint, trigger, RLS policy, and SQL function the feature needs, without touching existing tables beyond additive columns.

**Build:**
- Migration file `supabase/migrations/20260813_checkout_system.sql`:
  - `checkout_sessions` (status/current_step enums as text with CHECK, token UNIQUE, money columns, expiry, FKs).
  - `checkout_items` (snapshot line items).
  - `checkout_events`, `payment_attempts`, `payment_webhook_logs` (unique `gateway_event_id`), `merchant_checkout_config` (defaults + auto-create trigger), `order_items`.
  - `ALTER orders ADD checkout_session_id uuid, item_count int DEFAULT 1`; partial unique index on `orders(checkout_session_id)`.
  - `ALTER payment_transactions ADD session_id uuid, gateway text DEFAULT 'razorpay', method text`; partial unique index on `razorpay_payment_id`.
  - RLS policies (guest token-based read; merchant own; service-role-only writes for sensitive tables).
  - `set_public_checkout_id` trigger (`CHK-` via `generate_public_id`).
  - Functions: `finalize_checkout_payment(uuid,text,text) RETURNS jsonb` (SECURITY DEFINER, atomic, idempotent, order-exists guard, guest profile creation, notifications), `expire_checkout_sessions()`, `checkout_analytics(uuid)`, `create_merchant_checkout_config()` trigger function.
  - `REVOKE EXECUTE ... ON FUNCTION finalize_checkout_payment FROM anon, authenticated`.
- Apply the migration to the live project via the Supabase Management API (`/v1/projects/{ref}/database/query`) — do **not** run `supabase db push` (would replay 47 old migrations).

**Backend/DB work:** all of the above.
**Frontend/UI work:** none.
**Depends on:** existing `public_id_registry`, `update_updated_at_column`, orders/wallet/payout models.

**Expected behavior:** tables exist and are queryable with the service role; anon can read a session by token; a session insert auto-gets `CHK-` id + `created` event; two sessions can't share an order; finalize is idempotent.

**Acceptance criteria:**
1. `checkout_sessions`, `checkout_items`, `order_items`, `payment_webhook_logs`, `payment_attempts`, `merchant_checkout_config`, `checkout_events` exist with correct columns.
2. Inserting a session yields `public_checkout_id` = `CHK-…` and one `checkout_events` row.
3. Anon (publishable key) can `SELECT` a session by token; cannot list sessions.
4. Calling `finalize_checkout_payment` twice for the same transaction returns the same order id, creates one order + one set of order_items.
5. `expire_checkout_sessions()` marks stale active sessions `expired`.

**Testing requirements:** SQL assertions via Management API (create session → insert items → finalize twice → verify single order; attempt second order for same session via direct insert → unique violation).

**Exit criteria:** All 5 acceptance criteria pass with SQL-only tests.

---

## Phase 2 — Checkout payment engine (edge function)

**Objective:** Server-side payment orchestration with validation, verification, and idempotency.

**Build:**
- `supabase/functions/checkout-payment/index.ts` with `create-payment`, `verify-payment`, `cancel-payment`, `get-status`.
- Register in `supabase/config.toml` (`verify_jwt = false`).
- HMAC-SHA256 verification + Razorpay API cross-check in real mode; test-mode gating via `CHECKOUT_TEST_MODE` env (default true when no `RAZORPAY_KEY_*`).
- Server-side validation: token→session, status, expiry, merchant active, guest allowed, method enabled, details valid, amount from DB.
- Guest profile creation path (idempotent by `profiles.phone`).
- Env vars documented in `checkout.md`.

**Backend/DB work:** function wiring to `finalize_checkout_payment`, `expire_checkout_sessions`.
**Frontend/UI work:** none (function tested via HTTP).
**Depends on:** Phase 1.

**Expected behavior:** POST `create-payment` for a valid session returns `mode:'test'` + transactionId (or razorpay order in real mode); `verify-payment` finalizes once; `cancel-payment` marks failed; `get-status` returns authoritative state.

**Acceptance criteria:**
1. `create-payment` rejects expired / completed / cancelled / unknown-token sessions with distinct error codes.
2. `create-payment` rejects a disabled payment method and a disallowed guest when config says so.
3. Amount in `payment_transactions` equals `session.final_amount` regardless of client payload.
4. `verify-payment` (test mode) creates exactly one order; second call returns the same order without a new notification.
5. `cancel-payment` doesn't finalize; a later `verify-payment` on the cancelled transaction is rejected.

**Testing requirements:** HTTP tests with `curl`/`Invoke-RestMethod` against the deployed function for happy + each rejection + idempotency.
**Exit criteria:** 1–5 pass against the deployed function; deployment via `supabase functions deploy checkout-payment`.

---

## Phase 3 — Merchant checkout (session creation & management UI)

**Objective:** Let merchants create, view, share, and cancel checkout sessions with full validation.

**Build:**
- `src/pages/MerchantCheckout.tsx` (`/merchant-checkout`): analytics `metric-card` grid from `checkout_analytics`; session list (public id, status `StatusBadge`, amount, date); empty state; CTA.
- `src/pages/MerchantCheckoutCreate.tsx` (`/merchant-checkout/create`): dynamic item rows (name/variant/sku/price/qty), shipping + require-shipping toggle, discount, tax, collect-email, expiry hours, order reference; live totals preview; zod validation; client-recomputed totals AND server-recomputed totals; success view with **Copy link** / **Open checkout**.
- `src/pages/MerchantCheckoutDetails.tsx` (`/merchant-checkout/:sessionId`): full snapshot, link, share/copy, cancel (guarded), payment/order link when completed.
- Register routes in `App.tsx` (MerchantProtectedRoute); add `Checkout` to `MerchantBottomNav`; link from `MerchantDashboard`.
- `src/lib/checkout.ts` helpers (types, token builder, methods, phone/validation, link builder).

**Backend/DB work:** `checkout_analytics` call; session create/insert (service path through edge function is not needed — session creation can go through the merchant RLS path with server-side recomputation in a SQL `REVOKE`-safe way; **decision:** create via edge function action `create-session` to guarantee server-side totals recomputation). Add `create-session` action to `checkout-payment` edge function.
**Frontend/UI work:** all pages above.
**Depends on:** Phases 1–2.

**Expected behavior:** merchant creates a session, sees `CHK-` id + link, copies it, opens it; cancels it; analytics update.

**Acceptance criteria:**
1. Cannot create with invalid items (missing name, price ≤ 0, qty < 1, discount ≥ subtotal).
2. Server recomputes totals; tampered totals in request are ignored.
3. Link opens the checkout page (Phase 4 target) and shows frozen items.
4. Cancel only allowed pre-order; cancelled session can't be paid.
5. Analytics match manually inserted data.

**Testing requirements:** manual UI flow + verify stored totals equal server recomputation; verify a merchant can't see another merchant's sessions.
**Exit criteria:** 1–5 pass.

---

## Phase 4 — Public hosted checkout (customer + guest flow)

**Objective:** Complete customer-facing checkout: review → details → payment → success, with all states.

**Build:**
- `src/pages/Checkout.tsx` (`/checkout/:token`): session load + validation (not-found / expired / completed / cancelled states); Step Review (frozen items + totals + merchant branding); Step Details (name/phone/email/shipping with validation, prefill when logged in); Step Payment (method cards filtered by config, guest vs login note); Pay via `checkout-payment` `create-payment`; Razorpay modal when `mode:'razorpay'`, test Complete/Cancel layer when `mode:'test'`; `verify-payment` on success; Retry on failure.
- `src/pages/CheckoutSuccess.tsx` (`/checkout/:token/success`): server-derived success, confetti, `ORD-…`, amount, merchant, view-order / continue.
- `src/hooks/useCheckoutSession.ts` (load + realtime subscription).
- `sessionStorage` persistence for refresh/back per token.
- Register routes in `App.tsx` (public).

**Backend/DB work:** none beyond Phase 2 (uses existing edge function).
**Frontend/UI work:** all above.
**Depends on:** Phases 1–3.

**Expected behavior:** guest and logged-in customers complete checkout; success shows order; refresh/back/reopen land on correct state.

**Acceptance criteria:**
1. Guest checkout completes without login; order linked to a new guest profile.
2. Logged-in customer's details prefill; order links to their profile.
3. Failed test payment shows retry; retry works.
4. Expired session shows expired panel and never opens payment.
5. Completed session re-opened shows "already completed" + order summary.
6. Refresh on details/payment restores state; back after success doesn't re-initiate.
7. Cannot change amount or items from the client (network tab test).

**Testing requirements:** full manual E2E in incognito + logged-in; refresh/back matrix.
**Exit criteria:** 1–7 pass.

---

## Phase 5 — Integration with existing customer/merchant surfaces

**Objective:** Checkout orders feel native everywhere.

**Build:**
- `OrderDetails.tsx`: render `order_items` snapshot when present (items, variant, qty, line totals) under the product section.
- `MerchantOrderDetails.tsx`: same snapshot view for merchants.
- Customer `/orders` list: already works (orders rows) — verify checkout orders appear with correct merchant/product name; add `item_count` display.
- Notifications: verify merchant "New order" + customer "Order confirmed" appear in `/notifications` (server-generated in Phase 1 finalize).
- `MerchantDashboard` quick action for Checkout (already added in Phase 3).

**Backend/DB work:** none (read-only integrations).
**Frontend/UI work:** OrderDetails, MerchantOrderDetails edits.
**Depends on:** Phase 4.

**Expected behavior:** a checkout order opened from customer `/orders` and merchant `/merchant-orders` shows its line items; notifications navigate correctly.

**Acceptance criteria:**
1. Customer order detail shows all items with prices/qty for a multi-item checkout order.
2. Merchant order detail shows the same.
3. Merchant receives the "New order" notification with correct link.
4. No regression: orders created via `/payment/new` (no order_items) render exactly as before.

**Testing requirements:** create orders both ways; compare render.
**Exit criteria:** 1–4 pass.

---

## Phase 6 — Edge cases, reliability & hardening

**Objective:** Prove the system is robust under duplicates, failures, and abuse.

**Build/verify:**
- Webhook idempotency: repeat `verify-payment` and (if reachable) replay webhook payloads → single order, single notification, single success transaction.
- Duplicate Pay clicks → single successful finalization.
- Concurrent `verify-payment` calls → one order (rely on `orders(checkout_session_id)` unique + finalize guard).
- Expiry across sessions (`expire_checkout_sessions`).
- Cancelled merchant → payment rejected.
- Guest phone race → no duplicate profiles.
- Add defensive guards where gaps are found (e.g., finalize rejecting `failed` transactions, payment_transactions insert amount clamp).

**Backend/DB work:** any guard fixes.
**Frontend/UI work:** any state bug fixes.
**Depends on:** Phases 4–5.

**Acceptance criteria:**
1. Duplicate/replayed verification never duplicates money records.
2. No path lets an unauthenticated client set payment to success directly (RPC revoked, RLS enforced — test with anon key).
3. All error paths show correct UI (no unhandled exceptions).

**Testing requirements:** scripted duplicate calls, anon-key attempts, concurrent requests.
**Exit criteria:** 1–3 pass.

---

## Phase 7 — Final verification & production readiness

**Objective:** Full E2E acceptance + static checks.

**Build:**
- Run `npm run lint` and `npm run build`; fix all findings.
- Full E2E: merchant creates session → guest pays (test mode) → order created + notified → merchant delivers → escrow released → wallet credited → withdrawal requested (existing flow) → verify customer `/orders` + `/transactions`.
- Repeat as logged-in customer.
- Test expired/cancelled/completed/unknown-token states on the public page.
- Update `checkout.md`/`checkoutphases.md` if behavior drifted.

**Backend/DB work:** none expected.
**Frontend/UI work:** fixes from lint/build/E2E.
**Depends on:** Phase 6.

**Acceptance criteria (== "fully working" per `checkout.md` §19):**
1. Merchant can create/share/manage sessions and see analytics.
2. Guest + logged-in customers complete checkout; orders appear on both sides.
3. Idempotency proven; no duplicate orders/payments/notifications.
4. Expired/stale sessions blocked.
5. Refresh/back/retry/reopen all server-correct.
6. `npm run lint` and `npm run build` clean.
