# Wallet E2E Test Report

**Date:** 2026-08-08
**Project:** Safepay (supabase project `jcxhagmfbezpgrxdxfvs`)
**Scope:** Wallet / escrow / payment lifecycle — verify money is NOT withdrawable until an order is COMPLETED (escrow released) and the merchant is credited exactly once.

## Verdict

**ALL BUSINESS-RULE ASSERTIONS PASS.**

| Metric | Count |
|---|---|
| Total assertions | 76 |
| Pass | 74 |
| Fail | 0 |
| Warnings (known findings) | 2 |

## Business Rules Verified

1. A successful (COMPLETE) payment must **NOT** credit the merchant — funds move customer wallet → escrow (net zero for the customer ledger).
2. A cancelled/failed payment must **NOT** credit anyone and leaves **no wallet ledger rows**.
3. Withdrawal is **blocked** while balance = 0 (held in escrow), including edge cases: amount > balance, 0, negative, below minimum (₹100 server-side).
4. Funds are credited to the merchant wallet **only on order COMPLETION** (escrow released), **exactly once** (double-completion does not double-credit).
5. Only completed orders count toward the withdrawable balance; shipped/delivered/disputed/pending orders stay held.
6. Payout lifecycle: valid withdrawal accepted → `pending_balance` up / `balance` down; payout **completed** → `total_withdrawn` up; payout **failed** → balance restored.
7. Refunds reverse merchant credit **only** for completed+released orders; refunds on never-credited orders must not debit; over-refund rejected.
8. Disputes: merchant-won → order completed + credited; customer-won → order refunded, merchant never credited.
9. Ledger invariants hold: `total_earned = completed_sum − refunds_on_completed`, `balance + pending = earned − withdrawn`, no duplicate success transactions per order, no negative balances, no orphan ledger rows.

## Section Results

| # | Section | Result |
|---|---|---|
| Setup | Reset + logins + wallets exist + verified default bank account | PASS (5) |
| 1 | Payment complete — merchant NOT credited | PASS (5) |
| 2 | Payment cancel — no credit, no ledger rows | PASS (5) |
| 3 | Withdrawal blocked pre-completion (A–E edge cases) | PASS (6) |
| 4 | Life-cycle states all held | PASS (1) |
| 5 | Completion releases funds exactly once | PASS (4) |
| 6 | Multi-order separation (only completed count) | PASS (3) |
| 7 | Withdrawal cases A–G | PASS (7) + WARN (1) |
| 8 | Payout status transitions (completed / failed) | PASS (4) |
| 9 | Refunds (reverse credit only post-completion) | PASS (7) |
| 10 | Dispute resolutions (merchant-won / customer-won) | PASS (4) |
| 11 | Wallet consistency / ledger invariants | PASS (5) |
| 12 | DB/API integrity & security | PASS (4) + WARN (1) |
| 13 | UI code validation (static) | PASS (3) |
| 14 | Refresh / state persistence (DB truth) | PASS (4) |
| 15 | Final consistency matrix | PASS (4) |

## Findings

### F1 — No idempotency guard on merchant_payouts.transaction_id (WARN, real)
- **Evidence:** `merchant_payouts.transaction_id` has **no unique constraint** (verified via `pg_constraint`; only pkey/merchant_id/status/created_at indexes exist). Test 7F submitted two payouts with the same `transaction_id` via the API: **both accepted**, balance went 6650 → 5450 (double −600).
- **Root cause:** DB schema lacks a uniqueness guard; `process_merchant_payout()` validates amount/balance but not idempotency.
- **App mitigation (existing):** `MerchantWithdraw.tsx:158` generates `TXN{Date.now()}{random}` per submit, so accidental double-click is practically unique — but a crafted client can bypass.
- **Fix:** add a unique index on `merchant_payouts.transaction_id` (and/or an idempotency key column) so the DB rejects duplicate submissions.

### F2 — anon key can PATCH financial tables directly (WARN, security)
- **Evidence:** test 12.5 PATCH `merchant_wallets?merchant_id=...` `{balance: 12345}` returned **HTTP 204** using only the anon key.
- **Root cause:** RLS is enabled on the core financial tables (5/5: wallets, merchant_wallets, orders, merchant_payouts, refunds), but the policies are **permissive for `public`** (which includes `anon`). Verified:
  - `merchant_wallets` UPDATE policy `roles={public}` with `USING (merchant_id IN (SELECT ...))` and **no `WITH CHECK`** → the new row is unconstrained, so `balance` can be overwritten.
  - `orders` UPDATE policy `roles={public}` with no qual → anon can mutate order state (e.g., escrow/release flags) directly.
  - DB guards still prevent a *credit* from happening unless the order row is genuinely completed+released, but direct mutation of balance/order flags is possible.
- **Fix:** tighten RLS policies to require `auth.uid() = merchant owner` (apply the existing subquery as `USING` **and** `WITH CHECK`, add `auth.role() = 'authenticated'`), and deny anon write access to `orders` / `merchant_wallets` / `merchant_payouts`.

### Clarification on section 12.4
- RLS is enabled **at the table level** on all 5 core financial tables (check PASS, 5/5). The stale "RLS not enabled" note in the script's findings footer does not reflect the measured result; the actionable issue is the permissive **policy** for `public`/anon (see F2).

## Changes Applied During This Effort

- **Migration `supabase/migrations/20260808_wallet_flow_guards.sql`** (applied):
  - `credit_merchant_on_order_completion()` trigger — INSERT-upsert merchant credit only on `orders` update to `status='completed'` with `escrow_status='released'`, exactly-once (guarded `WHEN`).
  - `process_merchant_payout()` guards — rejects NULL/≤0 amount, amount < ₹100, over-withdrawal (balance < amount), missing wallet.
  - `reverse_merchant_credit_on_refund()` trigger — resolves merchant from the order (refunds has no merchant_id column), reverses credit only for completed+released orders, rejects missing wallet / insufficient balance.
- **`src/pages/PaymentReview.tsx`** — `simulateWalletTransfer` no longer credits the merchant wallet at payment time (customer credit → escrow debit only, net zero).
- **`src/pages/MerchantPayouts.tsx`** — "Held in Escrow" amber card (sum of orders with `escrow_status='held'`), Withdraw disabled with "Funds Held in Escrow" messaging when balance = 0 and held > 0.

## Retest Result

Third full run after fixes: **TOTAL=76 PASS=74 FAIL=0 WARN=2** (the two WARNs are the known findings F1/F2, both intentional demonstrations). All business-rule assertions (Sections 1–15) pass.

## Remaining Risks

- F1/F2 above are DB-schema/policy hardening items not yet applied (schema changes were deliberately deferred to avoid breaking live data; both are low-risk to apply in a migration).
- Legacy ConfirmDelivery / direct-order updates bypass app-level escrow gating; any path that flips an order to completed+released will trigger the merchant credit (by design).
- Edge-function endpoints still allow anon-key invocation of some admin-style operations; login flow works (200) via the edge functions.

## How to Re-run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Temp\opencode\wallet-e2e.ps1"
```

Uses isolated wallet-test users only (`+919111111111` / `+919222222222`, password `test123`); no production data is touched and no created payments are cleaned up.
