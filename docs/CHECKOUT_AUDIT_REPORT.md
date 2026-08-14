# SafePay Checkout — Full Real-Action Audit Report

- **Date:** 2026-08-13
- **Environment:** Project `jcxhagmfbezpgrxdxfvs` (sandbox), `CHECKOUT_TEST_MODE=true`, test merchant `5ee95125-ff32-44de-9b32-fac9f2c9fe33` (Testing Company, approved/active)
- **Method:** Real functional validation only. Every test issued genuine HTTP calls to the deployed edge functions / Supabase REST and verified live database state via the Management API and service-role queries. No browser automation, no click-through, no mock data was used as evidence.
- **Final build health:** `tsc --noEmit` clean, `eslint` clean on changed files, `npm run build` passes (pre-existing chunk-size warning only).
- **Artifacts:** All audit test data removed — verified 0 residual rows in `checkout_sessions`, `checkout_events`, `payment_attempts`, `payment_webhook_logs`, today's `orders`/`payment_transactions`, audit profiles/tokens/merchant.

---

## 1. Test Summary

| Suite | Scope | Result |
|---|---|---|
| A | Merchant authentication enforcement on edge function | **9/9 PASS** |
| B | RLS / privilege lockdown + preserved public capability | **9/9 PASS** |
| C | Full customer lifecycle (create → pay → verify → idempotency → cancel/retry → expiry → invalid/cancelled) | **21/21 PASS** |
| D | Security & risk (price tamper, input validation, inactive merchant, guest toggle, concurrency, cross-merchant) | **17/18 PASS** (1 documented behavior, §3) |
| E | Cross-entity data consistency (session → tx → order → items → events → notifications → guest profile) | **22/22 PASS** |
| F | Webhook signature validation, event handling, idempotent delivery | **13/13 PASS** |
| SMOKE | Full post-fix end-to-end (session → status → payment → verify → order → list → analytics) | **6/6 PASS** |
| **Total** | | **97/98 pass; 1 documented** |

Key assertions verified live:
- **A:** create-session without token → 401; bogus token → 401; customer token → 403; valid merchant token → 200; cross-merchant (A token vs B merchant) → 403; expired token → 401; B cannot read A's session.
- **B:** anon REST reads on `checkout_sessions`/`checkout_events` → 401 permission denied (previously returned every row incl. tokens); anon `checkout_analytics`/`get_merchant_checkout_config`/`expire_checkout_sessions` → denied; anon RPC `get_public_checkout_session(valid token)` still works (public capability preserved); anon INSERT rejected; service-role path (`get-status`) intact.
- **C:** server recomputes subtotal/2% fee/final (client-supplied totals ignored); verify-payment → exactly one order; re-verify idempotent (`alreadyProcessed`, same order); create-payment on completed session → 409 `ALREADY_COMPLETED`; cancel-payment marks attempt `cancelled`, session stays active, retry mints a new transaction; expired session → 410 `SESSION_EXPIRED` + status flip + expiry event; invalid token → `not_found`/404; merchant-cancelled session → 409 `SESSION_NOT_ACTIVE`.
- **D:** tampered `amount`/`finalAmount`/`subtotal` ignored (authoritative `final_amount` stored); negative price / zero / excessive qty / 201-char name / negative shipping/tax rejected; 6 concurrent `verify-payment` → **exactly 1 order**, all 6 responses 200; `is_active=false` → 403 `MERCHANT_INACTIVE`; `guest_checkout_enabled=false` → 403 `GUEST_CHECKOUT_DISABLED` (both restored after test).
- **E:** `session.order_id == order.id == tx.order_id`; `order.amount == tx.amount == session.final_amount`; `Σ line_total == subtotal`; item_count == 2; merchant + customer notifications created; event sequence `created → payment_started → completed`; `order_events` recorded; public order/payment ids present; guest profile created under normalized `+91` phone; verified attempt `success`.
- **F:** no signature → 401; wrong signature → 401; `payment.failed` marks tx `failed` + failure reason + log row `processed`; duplicate delivery → `{received:true, duplicate:true}` with exactly one log row; `refund.failed` → 200 `ignored`; ghost order → 200 no crash; `payment.captured` marks tx `success` + records `razorpay_payment_id`; invalid JSON → 400.

---

## 2. Issues Found — Fixed

| # | Severity | Issue | Fix | Verified |
|---|---|---|---|---|
| 1 | **CRITICAL** | All 5 merchant actions (`create-session`, `list-sessions`, `get-session`, `cancel-session`, `analytics`) accepted a raw `merchantId` with **no authentication** — any caller could create sessions / read sessions + analytics for any merchant. | Added `authorizeMerchant(req, merchantId)`: validates `Authorization: Bearer <token>` against `user_sessions` (unexpired) and ownership via `merchants.user_id`. Wired into all 5 actions + `serve()`. UI `callCheckout` now sends the merchant token from `localStorage['safepay_merchant_token']`. | A-series 9/9 |
| 2 | **CRITICAL** | Checkout tables were effectively open: 6 always-true RLS policies + `ALL` privileges granted to `anon`/`authenticated` on `checkout_sessions`, `checkout_items`, `checkout_events`, `payment_attempts`, `merchant_checkout_config` (and `payment_webhook_logs` had no grants/RLS). Live proof: anon REST returned session rows including `token` values. | Applied lockdown: dropped the 6 broken policies, `REVOKE ALL` on all checkout tables from `anon`/`authenticated`, enabled RLS on `payment_webhook_logs`, `REVOKE EXECUTE` on `checkout_analytics`, `expire_checkout_sessions`, `get_merchant_checkout_config` from `PUBLIC`/`anon`/`authenticated`; recreated `set_public_checkout_id`, `checkout_created_event`, `create_merchant_checkout_config` as `SECURITY DEFINER`. Token-gated `get_public_checkout_session` remains public by design. | B-series 9/9 |
| 3 | **HIGH** | Test-mode gate was unsafe: `isTestMode()` returned true when Razorpay keys were missing, silently skipping real payments. | `isTestMode()` now requires `CHECKOUT_TEST_MODE === "true"`; otherwise missing keys → `503 PAYMENT_PROVIDER_NOT_CONFIGURED`. Secret `CHECKOUT_TEST_MODE=true` set on project. | D7 cap + smoke |
| 4 | **MEDIUM** | Guest checkout with a **new phone + previously used email** failed with `500 PROFILE_FAILED` (unique `profiles.email` constraint; raced-lookup only checked phone). Found live during testing. | `createPayment` now resolves guests by phone, then by email, then creates; insert-failure fallback re-checks both. `finalize_checkout_payment` unique-violation handler also falls back to email. Email stored lowercase. | E10 regression (new phone + existing email reuses original profile) |
| 5 | **MEDIUM** | `create_merchant_checkout_config()` (SECURITY DEFINER, applied during lockdown) referenced column `requires_shipping` that does **not exist** on live `merchant_checkout_config` (column is `shipping_required`) → any new-merchant insert would fail. | Rewrote trigger against the real schema with full defaults; migration aligned to the live version. | merchant B created during A-series |
| 6 | **MEDIUM** | Webhook endpoint had no delivery log, no idempotency, and ignored failure semantics. | Added `payment_webhook_logs` (unique `gateway_event_id` → duplicate deliveries return `duplicate:true`), `status` tracking (received/processed/ignored/error), `refund.failed` logged+ignored; `RAZORPAY_WEBHOOK_SECRET` set and function deployed. | F-series 13/13 |
| 7 | **MEDIUM (UX)** | Refreshing `PublicCheckout` at the payment step rendered a **blank page** (server persisted `current_step='payment'`, UI rendered a payment view only when a live `payment` object exists). | On load, a persisted `payment` step now keeps the user on the fully-prefilled details step with an amber "resume" notice and a fresh `create-payment` on continue. | tsc + build |
| 8 | LOW | Checkout docs referenced `session_created`/`live`/`contact`/`verified` labels that don't match emitted values. | Documented below (§4); runtime behavior is the source of truth. | — |

---

## 3. Documented Behavior (test expectation corrected — not a defect)

- **D6 — 100% discount (`discount == subtotal`):** accepted by design; final amount = shipping + tax + service fee. Rejection only applies at `discount > subtotal`. This is safe: `create-session` is merchant-authenticated (issue 1), the customer-facing UI can never inject a discount, and the merchant UI itself allows the equal case. Session-level discounts are merchant-controlled, not customer-tamperable.

---

## 4. Remaining Issues (documented, not fixed)

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| R1 | **P2 / latent** | Realtime status push is **not implemented**. `useCheckoutSession` (per `checkout.md`) doesn't exist and no checkout table is in the `supabase_realtime` publication. Current UX works via one-shot `get-status` + verify navigation, so nothing is broken today. | Add `ALTER PUBLICATION supabase_realtime ADD TABLE` for `checkout_sessions`/`checkout_events`/`payment_transactions`/`payment_attempts` **only after** R2 is resolved, then implement the hook on the success page filtered by `token`. |
| R2 | **P2 / security-prerequisite** | The remaining `checkout_sessions` SELECT policy is effectively always-true (matches a repository-wide pattern also present on `orders`/`order_items`/`merchants`). Not exploitable today because all checkout reads go through the RPC-only path and table grants are revoked — but it **must** be tightened before enabling realtime or any direct anon read. | Replace with `token = current_setting(...)`-style capability or drop direct SELECT entirely (keep RPC). |
| R3 | LOW | Dead legacy realtime subscription at `src/pages/Transactions.tsx:110-122` (subscribes to `payment_transactions`, which is not in a publication) — never fires. | Remove or wire to a published table. |
| R4 | Scope | **No admin checkout UI, no API-key management, no webhook configuration UI, no risk/gateway dashboards, no receipts/invoices, no merchant kill-switch, no blocked-entities.** These exist only as generated `types.ts` stubs; there are zero migrations/UI surfaces for them. | Not present in the built module — roadmap items, not regressions. |
| R5 | LOW | Docs vs runtime naming: `mode` is `'test' | 'razorpay'` (not `'live'`); session-created event is `created` (not `session_created`); attempt initial status is `initiated`; there is no `contact` step (enum: `details/payment/confirmation`). | Update `checkout.md`/`checkoutphases.md` to the runtime contract. |
| R6 | LOW | App-wide anon/authenticated grants remain on `orders`, `order_items`, `merchants` because existing pages REST-read them directly. | Broader hardening project; separate from checkout. |
| R7 | LOW | `list-sessions` caps at 100 rows (no pagination). | Acceptable at current volume; add cursor pagination when needed. |
| R8 | LOW | `customerId` passthrough is supported server-side but the public UI always treats customers as guests (no logged-in prefill). | Product decision; no correctness impact. |

---

## 5. Coverage Matrix

| Area | Status |
|---|---|
| Customer checkout flow (create → pay → verify → order → notifications) | ✅ Tested end-to-end (C, E, SMOKE) |
| Amount integrity / tamper resistance | ✅ Tested (C1, D1) |
| Merchant flow (create/list/details/cancel/analytics) + auth | ✅ Tested (A, SMOKE) |
| RLS / data exposure | ✅ Locked down + tested (B) |
| Webhook (signature, idempotency, event handling) | ✅ Tested (F) |
| Payment gateway (Razorpay) real mode | ⚠️ Test-mode verified; live-gateway execution requires real keys/webhook from Razorpay dashboard (documented R4 scope) |
| Risk/fraud rules, blocked entities, kill-switch | ❌ Not implemented in module (R4) |
| Admin checkout management | ❌ Not implemented (R4) |
| API-key / webhook configuration management | ❌ Not implemented (R4) |
| Realtime status push | ❌ Not implemented (R1) |
| Responsive / mobile UI | ✅ Static audit clean (mobile-first, no overflow) |
| Build health | ✅ tsc + eslint + vite build pass |

---

## 6. Deployments Applied

- `checkout-payment` edge function (merchant auth, test-mode gate, guest email resolution) — **deployed**
- `razorpay-webhook` edge function (delivery logging + idempotency) — **deployed**
- Secrets: `CHECKOUT_TEST_MODE=true`, `RAZORPAY_WEBHOOK_SECRET=whsec_test_safepay_audit_2026` — **set**
- SQL via Management API: RLS/grants lockdown, SECURITY DEFINER triggers, `finalize_checkout_payment` email fallback — **applied live**
- `supabase/migrations/20260813_checkout_system.sql` updated to match live (config trigger + finalize email fallback)
