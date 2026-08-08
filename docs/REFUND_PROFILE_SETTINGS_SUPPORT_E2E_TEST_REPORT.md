# Refund + Profile + Settings + Support E2E Test Report

**Date:** 2026-08-08
**Project:** Safepay (supabase project `jcxhagmfbezpgrxdxfvs`)
**Scope:** Refund lifecycle (initiated → processing → success, failure + retry, terminal-state guard), profile CRUD (customer + merchant), settings (notification/privacy preferences upsert + gating), support tickets (conversations, attachments, close, merchant tickets), merchant refunds view, authorization guards, concurrency, DB integrity, refresh persistence, and wallet consistency after refunds.

## Verdict

**ALL BUSINESS-RULE ASSERTIONS PASS.**

| Metric | Count |
|---|---|
| Total assertions | 115 |
| Pass | 115 |
| Fail | 0 |
| Warnings | 0 |

## Business Rules Verified

1. **Profile CRUD** — customer and merchant profile PATCH persists (name, address, city, avatar, country, business category/phone/city).
2. **Refund lifecycle** — refund is created in `initiated`, transitions to `processing`, then `success`; the app terminal state is the literal `success` (RefundInitiated.tsx redirects on `success`/`failed`, RefundSuccess.tsx renders only for `success`).
3. **Success handling** — `completed_at` is stamped on success (BEFORE-UPDATE trigger), a **Refund Completed** notification (`type=success`) is created with link `/refunds/<id>/success`, and `transaction_id` / `receipt_url` persist.
4. **Failure + retry** — `failed` stores `failure_reason`, `retry_allowed=true`, emits a Refund Failed notification (`/refunds/<id>/failed`); retry returns to `processing`, clears `failure_reason`, and can reach `success` again; exactly one `Refund Processing` notification per transition.
5. **Terminal-state guard** — a refund in `success` **cannot** be rolled back to `processing`/`failed` (DB trigger rejects with HTTP 400; status stays `success`).
6. **Refund events** — every lifecycle step records a `refund_events` row (created / processing / failed / retry / completed), no loss, no dupes.
7. **Order sync** — the order moves to `status=refunded` + `escrow_status=refunded` on successful refund.
8. **Settings** — `user_preferences` upsert via PostgREST `on_conflict=user_id` (single row, no duplicates), privacy flags persist (`email_notifications`, `profile_visibility`, `show_activity`), re-upsert merges/updates the existing row.
9. **Notification-preference gating** — `push_notifications=false` suppresses both ticket-created and reply notifications; re-enabling restores them.
10. **Support conversations** — customer/merchant/admin messages persist; self-replies produce **no** notification; admin replies notify the counterparty with correct link (`/help/tickets/<id>` customer, `/merchant-support/<id>` merchant); ticket close (`status=closed`) persists.
11. **Attachments** — `ticket_attachments` rows link file to message with `file_name`/`file_size`/`message_id` intact.
12. **Merchant refunds view** — merchant sees all refunds on their orders via the orders→refunds join, including retried refunds, with status matching DB and full detail (amount/method/payment_details).
13. **Authorization guards (app-level)** — cross-account reads return empty (customer filter excludes merchant ticket and vice-versa); list queries never leak tickets across accounts.
14. **Concurrency** — 10 parallel message inserts all persist (no loss); 5 parallel ticket inserts all succeed with unique ids.
15. **DB integrity** — no orphan messages/attachments/notifications/refund_events/refunds, no negative wallet values, exactly one `Refund Initiated` notification per refund.
16. **Refresh persistence** — refund status/`completed_at`, closed ticket, privacy prefs, and event history all survive a simulated reload (DB is the source of truth).
17. **Wallet consistency** — merchant `balance` = sum of completed credits − refunds reversed at INSERT; customer wallet balance and ledger net to zero (refunds settle to the original method, not the wallet).

## Section Results

| # | Section | Result |
|---|---|---|
| Setup | Reset + logins + wallet/prefs baselines | PASS (6) |
| 1 | Profile CRUD (customer + merchant persistence) | PASS (9) |
| 2 | Refund lifecycle (initiated → processing → success) | PASS (16) |
| 3 | Refund failure + retry → success | PASS (12) |
| 4 | Terminal-state guard (success cannot reopen) | PASS (3) |
| 5 | Settings (user_preferences upsert + privacy) | PASS (8) |
| 6 | Notification preference gating (push toggle) | PASS (6) |
| 7 | Support conversations + attachments + close | PASS (13) |
| 8 | Merchant refunds view (joined through orders) | PASS (4) |
| 9 | Authorization guards (app-level row filters) | PASS (5) |
| 10 | Concurrency (parallel message + ticket inserts) | PASS (4) |
| 11 | DB integrity (orphans / negative values / refs) | PASS (8) |
| 12 | UI code validation (static) | PASS (13) |
| 13 | Refresh / state persistence (DB truth) | PASS (5) |
| 14 | Wallet consistency after refunds (merchant side) | PASS (3) |

## Root-Cause Fixes Applied During This Effort

The prior E2E run found that a successful refund produced **no** `Refund Completed` notification and `completed_at` was never stamped. Two new migrations were written and applied live, then fully verified by this run:

### `supabase/migrations/20260809_refund_success_completion.sql`
- Rewrote `notify_refund_status_change()` to handle the app's terminal `success` state (keeping `'completed'` for backward compatibility): sets `completed_at`, emits a **Refund Completed** notification with `type=success` and link `/refunds/<id>/success`, and is now a **BEFORE UPDATE** trigger so `completed_at` persists.
- Added `guard_refund_terminal_state()` + `refund_terminal_state_guard` trigger: any UPDATE that would move a refund off `success` is rejected (400). Verified live: rollback attempts on a successful refund are blocked and the row stays `success`.

### `supabase/migrations/20260809_support_and_settings.sql` (re-applied with policy additions)
- Added RLS policies for `ticket_messages`, `ticket_attachments`, and `user_preferences` (INSERT WITH CHECK, SELECT/UPDATE via `profiles` / `support_tickets` existence qualifiers) — anon INSERT of `ticket_messages` now passes RLS (previously 42501) and `user_preferences` upsert returns 201/200.

### New pages wired up (verified statically, section 12)
- Routes registered in `src/App.tsx`: `/settings/notifications`, `/settings/privacy`, `/help/tickets/:ticketId`, `/merchant-support`, `/merchant-support/:ticketId`, `/merchant-refunds`, `/merchant-refunds/:refundId`, `/merchant-settings`.
- New page components: `NotificationSettings.tsx`, `PrivacySettings.tsx`, `SupportTicketDetail.tsx`, `MerchantSupport.tsx`, `MerchantSupportTicket.tsx`, `MerchantRefunds.tsx`, `MerchantRefundDetail.tsx`, `MerchantSettings.tsx`.

## Findings

No open business-rule failures. The only issues found this run were **harness defects**, now fixed:

- **Harness:** `@(Invoke-Api ...).Body` member-access enumeration collapses to `$null` for empty result sets → "expect 0 rows" assertions (9.1/9.2) now use a `BodyOf()` helper returning `@()`.
- **Harness:** `Db()`'s catch block wrote diagnostics via `Write-Output`, which was captured by `@(Db ...)` and inflated `.Count` (11.8 reported 2 instead of 0). Now uses `Write-Host` so error diagnostics never pollute return values.
- **Harness:** 11.8 queried `refund_id` (nonexistent column; PK is `id`) — corrected to `r.id`.
- **Harness:** upsert re-run now sends `Prefer: resolution=merge-duplicates` (PostgREST requirement) and accepts 200/201; `Select-Object -ExpandProperty` over hashtable job results replaced with `ForEach-Object` (PowerShell 5.1 quirk).

## Regression Status

| Suite | Total | Pass | Fail | WARN (known) |
|---|---|---|---|---|
| Refund + Profile + Settings + Support (this run) | 115 | 115 | 0 | 0 |
| Wallet flow E2E (regression) | 76 | 74 | 0 | 2 |
| Dispute system E2E (regression) | 126 | 124 | 0 | 2 |

The two wallet WARNs (no idempotency guard on `merchant_payouts.transaction_id`; anon-key can PATCH financial tables) and the two dispute WARNs (permissive RLS on `disputes`/related tables) are pre-existing, documented findings — unchanged by this effort. The refund/profile/settings/support suite introduced **no** regressions to the wallet or dispute flows (all assertions still pass).

## How to Re-run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Temp\opencode\refund-profile-e2e.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Temp\opencode\wallet-e2e.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Temp\opencode\dispute-e2e.ps1"
```

Uses isolated test users only (`+919111111111` / `+919222222222`, password `test123`); each run begins by resetting the test users' data (tickets, messages, refunds, orders, notifications, wallets) so no production data is touched.
