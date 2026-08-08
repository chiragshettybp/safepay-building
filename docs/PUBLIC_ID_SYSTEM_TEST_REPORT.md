# SafePay Public ID System — Test Report

**Date:** 2026-08-09
**Project:** Safepay (Supabase project `jcxhagmfbezpgrxdxfvs`)
**Scope:** Official public ID system across the whole app — standardized `PREFIX-12DIGITS` identifiers for every user-facing entity (e.g. `ORD-123456789012`), database-side generation for financial entities, centralized frontend utilities/badges, UI/routes/search/copy/notifications updates, live-migration verification, 100+-per-entity stress harness, and full regression suites.

## Verdict

**ALL CHECKS PASSED.**

| Harness | Total | Pass | Fail | Warnings |
|---|---|---|---|---|
| Public-ID stress harness (E2E, 120 rows/entity) | 21 | 21 | 0 | 0 |
| Wallet flow regression | 76 | 74 | 0 | 2 (pre-existing findings) |
| Dispute flow regression | 126 | 124 | 0 | 2 (pre-existing findings) |
| Refund + profile + settings + support regression | 115 | 115 | 0 | 0 |
| Final live verification (steady state) | 17 | 17 | 0 | 0 |

## Spec (contract) Verified

- **Format:** uppercase `PREFIX` + hyphen + exactly 12 numeric digits → `^[A-Z]{3}-[0-9]{12}$`.
- **Prefix map:** `ORD` orders · `TXN` wallet transactions · `PAY` payment transactions · `REF` refunds · `DSP` disputes · `WDR` withdrawals · `PYO` merchant payouts · `TKT` support tickets · `CUS` profiles · `MER` merchants · `KYC` kyc_records · `NTF` notifications · `DOC` attachments/dispute files. (`ESC` has no entity table — escrow status lives on orders.)
- **Rules enforced:**
  - Internal UUID PKs and all FK relationships untouched; public ids live in separate `public_*` columns.
  - Financial entities generate ids **server/db-side** via a BEFORE-INSERT trigger + a collision-resistant registry (`public_id_registry` is the source of truth; generator retries on `unique_violation`, raises after 20 tries). Client generator is fallback-only for transient UX.
  - Uniqueness guaranteed by a registry PK plus per-column unique indexes.
  - Search by public id; copy copies the public id only; React `key`/route params stay on internal UUIDs.
  - Authorization never weakened — a public id is **not** an access key (ownership qualifier tests below).
  - `wallet_transactions` gets `TXN` on every ledger row and additionally `WDR` only for `type='withdrawal'`.

## Harness: 100+ Rows Per Entity (`scripts/e2e-public-ids.mjs`)

Phase A bulk-inserts 120 rows × 15 batches into every user-facing table **without supplying any public id**, relying purely on DB triggers. Phase B/C verify over the whole table; Phase D cleans up and restores the merchant wallet.

| Check | Result |
|---|---|
| 13 entity tables: format `PREFIX-12DIGITS`, 100% fill, no dupes, correct prefix (ORD/PAY/REF/DSP/PYO/TKT/NTF/CUS/MER/KYC/DOC/WDR) | PASS (13) |
| `wallet_transactions.public_transaction_id` (TXN): fill/format/unique/prefix | PASS |
| `wallet_transactions.public_withdrawal_id` (WDR): only on withdrawals, never on non-withdrawals, unique | PASS |
| Registry global uniqueness + format (`2379 distinct`) | PASS |
| Every table public id registered in the registry (`2339 ids, 0 missing`) | PASS |
| Search by public id + owner qualifier returns the row (`owned=1`) | PASS |
| Same public id + different owner returns nothing — id ≠ access key (`foreign=0`) | PASS |
| Bogus public id is a safe no-match | PASS |
| No RLS policy references a `public_*` column | PASS |
| No FK constraint references a `public_*` column | PASS |
| Suffixes random — no runs of 3+ consecutive (no sequential enumeration) | PASS |
| Cleanup complete, no leftovers, merchant wallet restored | PASS |

## Bugs Found by the Harness (and Fixed)

1. **DOC entities missing auto-generate trigger.** `add_public_id_column` set `public_document_id NOT NULL` for `ticket_attachments`/`dispute_files` but no trigger existed, so inserts violated NOT NULL. Fixed with a `set_public_document_id` BEFORE-INSERT trigger (migration + applied live).
2. **Registry RLS blocked every anon/authenticated insert.** Supabase enabled RLS on `public_id_registry` (new-table default) with zero policies, so the BEFORE-INSERT triggers' registry write failed for anon/app inserts — *every* new order/payment/refund/etc. would fail. Fixed by making `generate_public_id` **SECURITY DEFINER** and `REVOKE ALL` on the registry from `anon, authenticated`. Verified with an anon REST smoke test (order/payment/refund inserts return 201 with auto-generated `ORD-…`/`PAY-…`/`REF-…`).
3. **Registry completeness.** Pre-migration, client-generated public ids existed in tables but were never registered. Added a registry-completeness backfill (`INSERT … ON CONFLICT DO NOTHING`) so the registry is the exact set of all table public ids.
4. **Harness robustness.** Crash-resilient wallet snapshot (persisted to a file so a run that dies mid-Phase-A can be recovered by `cleanup`), and orphan-guarded registry + notification cleanup replacing time-window deletes (which could otherwise delete legitimate backfill entries).

## Regression Suites (no regressions introduced)

- **Wallet flow** (`wallet-e2e.ps1`): 74 PASS / 0 FAIL / 2 WARN. The two WARNs — duplicate `merchant_payouts.transaction_id` has no idempotency guard (7F) and anon-key can PATCH `merchant_wallets` (12.5) — are **pre-existing documented findings**, unchanged.
- **Dispute flow** (`dispute-e2e.ps1`): 124 PASS / 0 FAIL / 2 WARN. The two WARNs — permissive RLS on `disputes`/related tables (14.5, 14.6) — are **pre-existing documented findings**, unchanged.
- **Refund + profile + settings + support** (`refund-profile-e2e.ps1`): 115 PASS / 0 FAIL / 0 WARN.

## Migration (`supabase/migrations/20260809_public_ids.sql`)

Applied + verified live. Contents: registry table + SECURITY DEFINER generator; `add_public_id_column` helper (column + backfill + NOT NULL + unique index); columns for all 13 tables + wallet TXN/WDR; registry-completeness backfill; BEFORE-INSERT triggers for every entity (incl. the DOC fix); `notify_refund_status_change` and support-ticket notification functions rewritten to reference public ids in messages while keeping internal-UUID links.

## Frontend

- `src/lib/public-ids.ts` — `PUBLIC_ID_PREFIXES`, `isPublicId`, `generatePublicId` (fallback-only), `publicIdOf(row, publicColumn, prefix, legacyColumn?)`, types.
- `src/components/ui/public-id-badge.tsx` — `PublicIdBadge` component + type re-exports (lint-clean).
- 37 customer + merchant pages updated: headers/list rows/cards/badges/search/copy now use public ids; session payloads carry public ids through payment flows; `MerchantWithdraw` no longer generates client `TXN…` ids (DB trigger generates `public_payout_id`); React render keys and route params intentionally remain internal UUIDs.
- Two production builds pass green; lint clean on new files (pre-existing `no-explicit-any` in older pages untouched).

## Final Live Verification (steady state after cleanup)

All 13 entity tables: 0 missing / 0 bad format / 0 dupes / 0 wrong prefix. Registry is the exact set of table ids (`122 = 122`, 0 missing, 0 orphans). WDR conditional holds. No RLS policy references a `public_*` column. Merchant wallet at the post-regression state `balance = 3160 = earned`, `pending 0`, `withdrawn 0` (internally consistent).

## Files

- `supabase/migrations/20260809_public_ids.sql`
- `scripts/e2e-public-ids.mjs`
- `src/lib/public-ids.ts`, `src/components/ui/public-id-badge.tsx`
- 37 modified pages under `src/pages/` (see git status for the full list)
