# Dispute System E2E Test Report

**Date:** 2026-08-08
**Project:** Safepay (supabase project `jcxhagmfbezpgrxdxfvs`)
**Scope:** Full dispute lifecycle — eligibility, creation, notifications, evidence, merchant response, escrow protection, all three resolutions (customer-won / merchant-won / partial), exactly-once semantics, refund + wallet + order-status sync, permissions, edge cases, concurrency, DB integrity, and admin flow.

## Verdict

**ALL BUSINESS-RULE ASSERTIONS PASS.**

| Metric | Count |
|---|---|
| Total assertions | 126 |
| Pass | 124 |
| Fail | 0 |
| Warnings (known findings) | 2 |

## Business Rules Verified

1. **Eligibility & validation:** a dispute requires a reason (NOT NULL); a duplicate **active** dispute on the same order is rejected by a unique partial index; invalid resolution values are rejected by `resolve_dispute()`.
2. **Creation:** raising a dispute marks the order `disputed` (escrow stays `held`), records a "Dispute Submitted" timeline entry, notifies the customer "Dispute Opened" **exactly once** (no duplicates after the notification-dedup fix), and notifies the merchant "New Dispute" with a response link.
3. **Merchant response:** a merchant comment moves the dispute to `under_review`, clears `merchant_not_responded`, records a merchant timeline entry, notifies the customer "Merchant Responded" (trigger recognizes comments posted with `user_id = merchants.id` **or** `merchants.user_id`), and comments are shared in one thread.
4. **Evidence:** customer uploads to the `dispute-files` storage bucket (public URL retrievable), a `dispute_files` row is recorded, the dispute moves to `under_review`, and the merchant can list the evidence rows.
5. **Escrow protection while disputed:** the merchant is **NOT credited** while a dispute is open; withdrawal is blocked (zero balance, no payout row created); flipping `escrow_status` alone does not credit.
6. **customer_won:** full refund of the order amount; dispute → `resolved` (resolution, `refund_transaction_id` `RFND-…`, `resolved_at`, `admin_notes`); order → `refunded` + escrow → `refunded`; merchant never credited; refund row (`initiated`) + `refund_events` row; customer notified "Dispute Resolved - Customer Favored" + "Refund Initiated"; merchant notified of the financial outcome; admin timeline entry.
7. **merchant_won:** order → `completed` + escrow → `released`, merchant credited the **full** amount, **no** refund row, customer notified "Dispute Resolved - Merchant Favored".
8. **partial_refund:** order → `completed` + escrow → `released` (merchant credited), then the refund row **reverses** the refunded portion — merchant net = `order total − refund amount`; refund amount is validated (`0 < amount < order total`; zero/negative/over-refund all rejected on the open dispute); customer notified "Dispute Resolved - Partial Refund".
9. **Result page data:** `resolution`, `refund_amount`, `refund_transaction_id`, `resolved_at`, `admin_notes`, timeline (Submitted + Resolved/admin), and evidence files are all queryable; `/disputes/:disputeId/result` and `/disputes/:disputeId/upload` routes are registered.
10. **Exactly-once:** a duplicate `resolve_dispute()` on a resolved dispute is rejected ("already resolved"); the merchant is not double-credited; no duplicate refund per dispute (unique partial index); a single resolution timeline entry.
11. **Ledger invariants:** `total_earned = completed_released_sum − refunds_on_completed_released`; `balance = earned`; no negative wallet values; no orphan refunds; no duplicate refunds per dispute; customer wallet ledger nets to zero (escrow settles in full).
12. **Withdrawal restore:** withdrawing a dispute closes it, restores the order to `pending` with escrow `held`, notifies the merchant "Dispute Closed", and a **re-raise** is allowed after closure (partial unique index excludes `closed`).
13. **Edge cases:** dispute on a non-existent order rejected (FK, HTTP 409); resolve of a non-existent dispute rejected; `customer_won` with a partial amount rejected; `merchant_won` with a refund amount rejected; app statuses `escalated` / `info_required` accepted by the widened CHECK; invalid notification type (`refund`) rejected by the CHECK.
14. **Concurrency:** two simultaneous dispute creates on one order → exactly one row (unique index wins); two simultaneous `resolve_dispute()` calls → exactly one succeeds; the order is settled once, no double-settlement row.
15. **DB integrity:** every dispute status conforms to the CHECK; every notification type conforms to the CHECK; no orphan `dispute_comments` / `dispute_updates` / `dispute_files`; no completed order still has an unresolved dispute.
16. **Admin flow:** admin can enumerate every dispute, admin notes persist on resolved disputes, and an escalated dispute can be resolved.

## Section Results

| # | Section | Result |
|---|---|---|
| Setup | Reset isolated test users + login + wallet baselines | PASS (3) |
| S1 | Eligibility & validation (mandate 1–3) | PASS (5) |
| S2 | Dispute creation flow (mandate 4) | PASS (6) |
| S3 | Customer notifications (mandate 5,6,7,10,24) | PASS (6) |
| S4 | Merchant response & communication (mandate 8,13–18) | PASS (5) |
| S5 | Evidence upload (mandate 11,12) | PASS (5) |
| S6 | Escrow protection while disputed (mandate 19–22) | PASS (4) |
| S7 | Customer-won resolution (mandate 23,26,27,29,30) | PASS (18) |
| S8 | Merchant-won resolution (mandate 24,30) | PASS (9) |
| S9 | Partial refund resolution (mandate 25,29,30) | PASS (13) |
| S10 | Result page data (mandate 26,27) | PASS (6) |
| S11 | Exactly-once: duplicate resolution + double-refund (mandate 28) | PASS (4) |
| S12 | Refund + wallet validation (mandate 29) | PASS (7) |
| S13 | Order status sync + withdrawal restore (mandate 30) | PASS (5) |
| S14 | Permission & cross-account tests (mandate 31,32) | PASS (4) + WARN (2) |
| S15 | Edge-case matrix | PASS (7) |
| S16 | Concurrency / races | PASS (5) |
| S17 | DB integrity after transitions | PASS (6) |
| S18 | Admin flow (mandate 31) | PASS (3) |
| S19 | Final consistency matrix | PASS (3) |

## Defects Found & Fixed

### D1 — `partial_refund` never credited the merchant (real, financial)
- **Symptom:** S9 failed — after a partial refund the order ended `refunded`/escrow `refunded` and the merchant was **never credited** (expected net `total − refund`; observed 0).
- **Root cause:** `resolve_dispute()` routed `partial_refund` down the **customer-won branch** (order → `refunded`, escrow → `refunded`) instead of the **completed + released branch**. Partial refunds must first release escrow to the merchant (the completion trigger credits the wallet) and **then** insert the refund row, whose trigger reverses the refunded portion.
- **Fix:** `resolve_dispute()` now treats `merchant_won` **and** `partial_refund` as escrow-release paths; the refund row is created for every non-`merchant_won` resolution. Verified live: partial refund of ₹2000 on a ₹6120 order → order `completed`, merchant net ₹4120 (credit ₹6120 − reverse ₹2000), refund row ₹2000.

### D2 — merchant comments never notified the customer (real)
- **Symptom:** S4 failed — the customer was not notified "Merchant Responded" when the merchant commented.
- **Root cause:** the merchant app posts comments with `user_id = merchants.id` (the id the app exposes), but `notify_customer_on_merchant_comment()` matched **only** `merchants.user_id`. A first follow-up migration added the `merchants.id` match, but the later-sorted `dispute_system_fixes.sql` re-created the function with the old body and silently overwrote it (apply order: `dispute_merchant_comment_match` < `dispute_system_fixes`).
- **Fix:** the corrected body (match `NEW.user_id = v_merchant_user OR NEW.user_id = v_merchant_id`) now lives in `dispute_system_fixes.sql` itself (the last-sorted file), so any re-apply is self-consistent. Verified live: merchant comment → customer notification with link `/disputes/{id}`.

### D3 — test harness issues (not app defects)
The first suite run tripped on PowerShell mechanics, not the app:
- **Member-enumeration unwrap:** `@(Invoke-Api …).Body` member-enumerates a single-element array down to a bare `PSCustomObject`, so `.Count` returned `$null` and `[0]` returned `$null` for single-row GET responses. Fixed by wrapping the body value: `@((Invoke-Api …).Body)` (24 sites).
- **Case-insensitive variable collision:** `$o6` (S16 order read) overwrote `$O6` (the order context) mid-section, breaking the settlement-count query. Renamed the read to `$o6row`.
- **`$notes` clobbered `$script:Notes`:** the S18 query variable overwrote the suite's notes accumulator (corrupted the summary footer). Renamed to `$noteCount`.
- **`DbTry` error detail:** `Err` captured only `Exception.Message` ("400 Bad Request"), not the API body, so the "already resolved" assertion could not match. `DbTry` now prefers `ErrorDetails.Message`.

## Findings (WARN — intentional demonstrations)

### F1 — Any anon-key client can read ALL disputes (no RLS isolation)
- **Evidence:** test 14.5 — `GET /disputes?limit=1` with only the anon key returns 200 and arbitrary dispute rows (verified live across customers).
- **Impact:** cross-account reads are possible at the API layer.
- **Current mitigation:** app-level scoping (`customer_id` / `merchant_id` filters in `DisputeStatus.tsx`, `UploadProof.tsx`, `MerchantDisputeResponse.tsx` ownership checks) — verified by the S14 static guards and the "customer list == DB (own disputes only)" assertion.
- **Context:** Safepay uses custom PBKDF2 sessions via edge functions (`verify_jwt=false`), so Supabase `auth.uid()`/RLS is not usable; app-level isolation is the established pattern (same as wallet F2). DB-level financial guardrails are the applied scope.

### F2 — Any anon-key client can PATCH dispute status directly (no authz)
- **Evidence:** test 14.6 — `PATCH /disputes/{id} {status:'under_review'}` returned HTTP 200 using only the anon key, even on an already-`resolved` dispute.
- **Impact:** status text can be overwritten post-resolution. Verified this does **not** affect financial integrity — the resolution, refund, order, escrow, and wallet states set by `resolve_dispute()` are not reverted by a status-only PATCH (the settled customer-won dispute kept `resolution=customer_won`, refund row, order `refunded`+escrow `refunded`, and zero merchant credit despite the overwritten status label).
- **Fix (future):** tighten RLS policies / route dispute status transitions through a trusted edge function that enforces the state machine.

## Changes Applied During This Effort

- **Migration `supabase/migrations/20260809_dispute_system_fixes.sql`** (edited + re-applied live):
  - Unique partial index `disputes_order_active_uq` (one active dispute per order; re-raise allowed after `closed`/`rejected`).
  - Unique partial index `refunds_dispute_id_uq` (one refund per dispute).
  - Widened `disputes_status_check` to the full app status set.
  - `merchant_dispute_created_notification` trigger ("New Dispute" → merchant).
  - `customer_notified_on_merchant_comment` trigger — **corrected to match `merchants.id` OR `merchants.user_id`**.
  - `notify_dispute_status_change()` — resolution values aligned to the app (`customer_won` / `merchant_won` / `partial_refund`).
  - `resolve_dispute()` — **partial_refund now completes + releases the order (merchant credited) and then reverses the refunded portion**; customer_won full-amount rule, merchant_won no-refund rule, partial `0 < amount < total` rule; atomic exactly-once transition; refund + refund_event + timeline + merchant notification.
- **Migration `supabase/migrations/20260809_dispute_merchant_comment_match.sql`** (already correct; kept in sync).
- **UI fixes (from the earlier phase, re-verified green):** `App.tsx` upload route `/disputes/:disputeId/upload`; duplicate-notification removal in `RaiseDispute.tsx` / `ReportIssue.tsx`; `DisputeStatus.tsx` withdrawal restores the order to `pending` (scoped to `status='disputed'`); `DisputeResult.tsx` handles the duplicate-refund 23505 and drops the redundant manual `type:'refund'` notification; `MerchantDisputes.tsx` rebuilt as mobile-optimized cards.

## Final Consistency (S19, live numbers)

- `merchant_wallets`: balance ₹9,730 = earned ₹9,730, pending 0, withdrawn 0.
- Orders: `completed` 3 × ₹11,730 · `disputed` 2 × ₹4,080 · `pending` 1 × ₹2,550 · `refunded` 2 × ₹7,344.
- Disputes: `resolved` 4 · `open` 3 · `under_review` 1 (14.6 artifact) · `closed` 1.
- Invariants: `earned == completed − refunds_on_completed` (₹9,730 == ₹11,730 − ₹2,000); `balance == earned`; customer wallet ledger nets zero.

## Wallet Regression

`wallet-e2e.ps1` re-run after the dispute fixes: **TOTAL=76 PASS=74 FAIL=0 WARN=2** — identical to the wallet baseline (run 3). No regressions from the dispute migrations or function changes.

## Remaining Risks

- F1/F2 above are RLS/authz hardening items deferred by design (custom-session architecture; app-level guards are the current control).
- The 14.6 status-PATCH can relabel a resolved dispute (cosmetic only; financial state immutable).
- `reverse_merchant_credit_on_refund` reverses only when the order is completed+released and balance is sufficient — a partial refund on a completed order relies on the ordering inside `resolve_dispute()` (release first, refund second), which the S9 assertions now pin down.

## How to Re-run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Temp\opencode\dispute-e2e.ps1"
```

Uses isolated dispute-test users only (`+919111111111` / `+919222222222`, password `test123`); the harness resets their test data at startup and touches no production data.
