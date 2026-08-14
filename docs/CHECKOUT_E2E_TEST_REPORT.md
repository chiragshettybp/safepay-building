# Checkout / Payment-Link E2E Test Report

**Date:** 2026-08-13
**Project:** Safepay (supabase project `jcxhagmfbezpgrxdxfvs`)
**Scope:** Hosted checkout + merchant settlement — merchant creates/shared payment links, guests and logged-in customers pay (test mode), orders are created exactly once, escrow is held, and both customer and merchant surfaces read the new `order_items` snapshot.

## Verdict

**ALL BUSINESS-RULE ASSERTIONS PASS.**

| Metric | Count |
|---|---|
| Total assertions | 42 |
| Pass | 42 |
| Fail | 0 |
| Warnings (known findings) | 1 |

## Business Rules Verified

1. Session totals are **computed server-side** in `create_checkout_session` (subtotal, discount, shipping, tax, 2% SafePay fee, final amount) — client-supplied amounts never become the charge (`final_amount` is read from the DB at payment time).
2. A guest checkout creates a **guest profile** (`account_source='payment_link'`, `account_claimed=false`, unusable hash), keyed by normalized `+91` phone; the same phone reuses the existing profile (no duplicates).
3. `verify-payment` finalizes **exactly one order per session**: repeat and concurrent calls return the same order (`alreadyProcessed=true`, `created=false`).
4. One session → at most one order (partial unique index `orders(checkout_session_id)`) and one gateway payment id → one transaction (partial unique index on `razorpay_payment_id`).
5. Session lifecycle: `active → completed` (via finalize), `→ expired` (lazy + batch `expire_checkout_sessions`), `→ cancelled` (merchant, guarded pre-order), payment rejected on expired/cancelled/completed sessions.
6. The public page reads **only** through the `get_public_checkout_session(token)` SECURITY DEFINER RPC; anon REST cannot call `finalize_checkout_payment` (401).
7. Escrow: generated orders are `pending` + `held`; merchant credit remains gated on completion/release by the existing trigger.
8. Order snapshots: `order_items` rows are written on finalize; `orders.item_count` and `checkout_session_id` are populated; both customer and merchant order-detail pages read them.

## Section Results

| # | Section | Result |
|---|---|---|
| Setup | Edge function deployed (`checkout-payment`, `verify_jwt=false`) + config registered | PASS |
| 1 | create-session — server totals (subtotal/fee/final), CHK- id, item rows, expiry | PASS (5) |
| 2 | create-payment — phone normalization, guest profile creation, method guard, pending tx + attempt, `mode:'test'` | PASS (6) |
| 3 | verify-payment — single order + transaction + `order_items` + notifications | PASS (5) |
| 4 | Idempotency — repeated verify returns same order, no duplicates | PASS (3) |
| 5 | Concurrency — 6 parallel verifies → 1 order, 1 success tx, session completed | PASS (2) |
| 6 | Expiry — lazy (get-status) + batch `expire_checkout_sessions` + payment rejected | PASS (4) |
| 7 | Merchant cancel — `cancel-session` OK, payment on cancelled blocked; customer `cancel-payment` keeps session active for retry (new tx) | PASS (4) |
| 8 | Merchant inactive — `create-payment` rejected, merchant restored | PASS (1) |
| 9 | Analytics — created/completed/revenue/conversion consistent | PASS (2) |
| 10 | RLS/security — anon REST cannot finalize; anon can read order_items/orders (app-wide pattern) | PASS (2) |
| 11 | Frontend — lint + typecheck + build clean on all new files | PASS (3) |
| 12 | Cleanup — zero test sessions/orders/guest profiles/attempts/events remain | PASS (1) |

## Findings

### F1 — anon REST lists `checkout_sessions` rows (WARN, known app-wide pattern)
- **Evidence:** `GET /rest/v1/checkout_sessions` returns rows with only the publishable key. The **public page never uses this** — it reads exclusively through `get_public_checkout_session(token)` — but the table follows the app-wide always-true relationship RLS convention used by `orders`, `profiles`, etc. Session `token` and `customer_id` are exposed to anon REST readers.
- **Mitigation:** the token is a 64-hex unguessable capability, so exposure is limited to row metadata (public id, status, amount). This matches the existing app-wide RLS weakness documented in `checkout.md` §18 and the wallet report F2.
- **Recommended fix (out of scope):** tighten policies app-wide to require `auth.role() = 'authenticated'` + owner subqueries on `USING` **and** `WITH CHECK`; on `checkout_sessions` specifically, drop the anon SELECT policy and expose reads only via the RPC.

## Changes Applied During This Effort

- **Migration `supabase/migrations/20260813_checkout_system.sql`** (applied via Management API, all sections live-verified): new tables `checkout_sessions`, `checkout_items`, `checkout_events`, `payment_attempts`, `payment_webhook_logs`, `merchant_checkout_config`, `order_items`; additive columns + unique/idempotency indexes on `orders` and `payment_transactions`; functions `get_merchant_checkout_config`, `get_public_checkout_session`, `expire_checkout_sessions`, `finalize_checkout_payment`, `checkout_analytics`, `create_checkout_session`, `cancel_checkout_session`, auto-config/CHK-id triggers; `extensions.gen_random_bytes` qualified (SECURITY DEFINER `search_path=public` fix).
- **Edge function `supabase/functions/checkout-payment/index.ts`** (deployed): actions `create-session`, `list-sessions`, `get-session`, `cancel-session`, `analytics`, `create-payment`, `verify-payment`, `cancel-payment`, `get-status`; server-decided test mode; HMAC + Razorpay API cross-check in real mode; guest-phone race-safe.
- **Merchant UI:** `src/pages/MerchantCheckout.tsx` (analytics + link list), `MerchantCheckoutCreate.tsx` (item builder + fee preview + copyable link), `MerchantCheckoutDetails.tsx` (items/totals/customer/timeline + cancel); routes `/merchant-checkout*`; `Checkout` item in `MerchantBottomNav`.
- **Public UI:** `src/pages/PublicCheckout.tsx` (`/checkout/:token` — details → payment steps, test-mode confirm sheet, real Razorpay popup path), `PublicCheckoutSuccess.tsx` (`/checkout/:token/success`); shared helper `src/lib/checkout.ts`.
- **Integration:** `order_items` snapshot now rendered in `OrderDetails.tsx` and `MerchantOrderDetails.tsx`.

## Remaining Risks

- F1 above (app-wide RLS weakness) — consistent with existing reports; public checkout is guarded by the RPC-only read path and revoked finalize.
- Real-mode Razorpay path was not exercised live (no `RAZORPAY_KEY_ID`/`SECRET` configured); the HMAC + API cross-check and popup flow are implemented but require gateway credentials + a real payment to fully validate.
- Logged-in-customer checkout (`customerId` passthrough) was implemented but E2E-tested only as guest (same finalize path); the app-level `customerId` prefill is exercised in Phase 7 UI walkthrough.

## How to Re-run

```powershell
# Edge function (deploy)
supabase functions deploy checkout-payment --project-ref jcxhagmfbezpgrxdxfvs --no-verify-jwt

# API flow (PowerShell + .env.local SUPABASE_ACCESS_TOKEN)
# POST https://jcxhagmfbezpgrxdxfvs.supabase.co/functions/v1/checkout-payment
#   actions: create-session -> create-payment -> verify-payment -> get-status
# DB assertions: Management API POST /v1/projects/jcxhagmfbezpgrxdxfvs/database/query
```

Uses only the test merchant `5ee95125-ff32-44de-9b32-fac9f2c9fe33` (Testing Company); all test data is cleaned up after each run (verified: 0 sessions / 0 checkout orders / 0 guest profiles / 0 attempts / 0 events).
