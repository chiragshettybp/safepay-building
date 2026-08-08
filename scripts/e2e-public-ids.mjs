// e2e-public-ids.mjs
// SafePay Public ID system — end-to-end harness.
//
// Phase A: bulk-insert 100+ rows per user-facing entity (with NO public id
//          supplied) and rely on the DB triggers to auto-generate them.
// Phase B: verify format (PREFIX-12DIGITS), 100% fill, per-table and global
//          uniqueness, per-entity prefix mapping, and the WDR-conditional rule.
// Phase C: verify the ownership-qualifier pattern (search by public id works
//          for the owner; public id alone is NOT an access key), and that no
//          RLS policy / FK constraint ever references a public_* column.
// Phase D: FK-safe cleanup + restore wallet balances + registry cleanup.
//
// Usage:  node scripts/e2e-public-ids.mjs [rowsPerEntity]

import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('C:/Users/chirag bp/Videos/safepay/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const URL = `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`;
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
};

async function run(sql) {
  const res = await fetch(URL, { method: 'POST', headers, body: JSON.stringify({ query: sql }) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 2000)}`);
  return JSON.parse(text);
}

const ROWS = Number(process.argv[2]) || 120;
const CUSTOMER = 'ec25694c-9749-4efc-85d1-f47a05cab9d4';
const MERCHANT_USER = 'e043c858-ffee-46a3-a1ca-24c619d7b57f';
const MERCHANT = 'acb3b3f5-0900-4969-8111-07a59a39f184';
const REGEX = /^[A-Z]{3}-[0-9]{12}$/;

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  [${detail}]` : ''}`);
  if (!ok) failures++;
};

// ===========================================================================
// Setup / seed ids / cutoff
// ===========================================================================
const walletRow = await run(`SELECT id FROM public.wallets WHERE customer_id = '${CUSTOMER}'`);
if (!walletRow[0]) throw new Error('Customer wallet not found');
const WALLET = walletRow[0].id;

const mw = await run(`SELECT id, balance, pending_balance FROM public.merchant_wallets WHERE merchant_id = '${MERCHANT}'`);
if (!mw[0]) throw new Error('Merchant wallet not found');
const MERCHANT_WALLET = mw[0];
const BANK = await run(`SELECT id FROM public.merchant_bank_accounts WHERE merchant_id = '${MERCHANT}' AND is_default = true LIMIT 1`);
if (!BANK[0]) throw new Error('Merchant default bank account not found');

const cutoffRow = await run(`SELECT COALESCE(max(created_at), now()) AS m FROM public.public_id_registry`);
const CUTOFF = cutoffRow[0].m;

// Crash-resilience: persist the wallet snapshot so a run that dies mid-Phase-A
// can be recovered by `cleanup` (which restores the ORIGINAL baseline instead
// of the corrupted current values).
const SNAPSHOT_FILE = 'C:/Users/CHIRAG~1/AppData/Local/Temp/opencode/pidbulk-wallet-snapshot.json';
const { writeFileSync, existsSync, unlinkSync } = await import('node:fs');
const loadSnapshot = () => JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'));
const saveSnapshot = () => {
  writeFileSync(SNAPSHOT_FILE, JSON.stringify({
    balance: MERCHANT_WALLET.balance,
    pending_balance: MERCHANT_WALLET.pending_balance,
    cutoff: CUTOFF,
  }));
  console.log(`wallet snapshot saved (balance=${MERCHANT_WALLET.balance} pending=${MERCHANT_WALLET.pending_balance} cutoff=${CUTOFF})`);
};

const RESTORE_WALLET = async (balance, pending) => {
  await run(`UPDATE public.merchant_wallets SET balance = ${balance}, pending_balance = ${pending} WHERE id = '${MERCHANT_WALLET.id}'`);
};

// ---------------------------------------------------------------------------
// Cleanup-only mode: removes leftovers from a previous run (fresh cutoff)
// ---------------------------------------------------------------------------
const NOTIF_DELETE = `DELETE FROM public.notifications n
WHERE n.user_id IN ('${CUSTOMER}', '${MERCHANT_USER}')
  AND (
    n.title LIKE 'PIDBULK%' OR n.message LIKE '%PIDBULK%'
    OR (n.link LIKE '/refunds/%'           AND NOT EXISTS (SELECT 1 FROM public.refunds r WHERE '/refunds/' || r.id = n.link))
    OR (n.link LIKE '/orders/%'            AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE '/orders/' || o.id = n.link))
    OR (n.link LIKE '/help/tickets/%'      AND NOT EXISTS (SELECT 1 FROM public.support_tickets s WHERE '/help/tickets/' || s.id = n.link))
    OR (n.link LIKE '/merchant-support/%'  AND NOT EXISTS (SELECT 1 FROM public.support_tickets s WHERE '/merchant-support/' || s.id = n.link))
    OR (n.link LIKE '/disputes/%'          AND NOT EXISTS (SELECT 1 FROM public.disputes d WHERE '/disputes/' || d.id = n.link))
    OR (n.link LIKE '/merchant-dispute-response/%' AND NOT EXISTS (SELECT 1 FROM public.disputes d WHERE '/merchant-dispute-response/' || d.id = n.link))
    OR (n.link LIKE '/merchant-dispute-result/%'   AND NOT EXISTS (SELECT 1 FROM public.disputes d WHERE '/merchant-dispute-result/' || d.id = n.link))
  )`;

const CLEANUP = async () => {
  const snap = existsSync(SNAPSHOT_FILE) ? loadSnapshot() : { balance: MERCHANT_WALLET.balance, pending_balance: MERCHANT_WALLET.pending_balance, cutoff: CUTOFF };
  const statements = [
    `DELETE FROM public.dispute_files WHERE file_name LIKE 'PIDBULK%'`,
    `DELETE FROM public.refunds WHERE reason = 'PIDBULK harness'`,
    `DELETE FROM public.payment_transactions WHERE razorpay_order_id LIKE 'PIDBULK-PAY-%'`,
    `DELETE FROM public.wallet_transactions WHERE description = 'PIDBULK harness'`,
    `DELETE FROM public.ticket_attachments WHERE file_name LIKE 'PIDBULK%'`,
    `DELETE FROM public.support_tickets WHERE subject LIKE 'PIDBULK-TKT-%'`,
    `DELETE FROM public.withdrawals WHERE transaction_id LIKE 'PIDBULK-WDR-%'`,
    `DELETE FROM public.merchant_payouts WHERE notes = 'PIDBULK harness'`,
    `DELETE FROM public.disputes WHERE reason = 'PIDBULK harness'`,
    `DELETE FROM public.order_events WHERE order_id IN (SELECT id FROM public.orders WHERE order_number LIKE 'PIDBULK-ORD-%')`,
    `DELETE FROM public.orders WHERE order_number LIKE 'PIDBULK-ORD-%'`,
    `DELETE FROM public.kyc_records WHERE admin_notes = 'PIDBULK harness'`,
    `DELETE FROM public.merchant_wallets WHERE merchant_id IN (SELECT id FROM public.merchants WHERE business_name LIKE 'PIDBULK-BIZ-%')`,
    `DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM public.profiles WHERE phone LIKE '90000000%' OR phone LIKE '91000000%')`,
    `DELETE FROM public.merchants WHERE business_name LIKE 'PIDBULK-BIZ-%'`,
    `DELETE FROM public.wallets WHERE customer_id IN (SELECT id FROM public.profiles WHERE phone LIKE '90000000%' OR phone LIKE '91000000%')`,
    `DELETE FROM public.profiles WHERE phone LIKE '90000000%' OR phone LIKE '91000000%'`,
    NOTIF_DELETE,
    `DELETE FROM public.public_id_registry r WHERE NOT EXISTS (
       SELECT 1 FROM public.orders WHERE public_order_id = r.public_id
       UNION ALL SELECT 1 FROM public.payment_transactions WHERE public_payment_id = r.public_id
       UNION ALL SELECT 1 FROM public.refunds WHERE public_refund_id = r.public_id
       UNION ALL SELECT 1 FROM public.disputes WHERE public_dispute_id = r.public_id
       UNION ALL SELECT 1 FROM public.merchant_payouts WHERE public_payout_id = r.public_id
       UNION ALL SELECT 1 FROM public.support_tickets WHERE public_ticket_id = r.public_id
       UNION ALL SELECT 1 FROM public.notifications WHERE public_notification_id = r.public_id
       UNION ALL SELECT 1 FROM public.profiles WHERE public_customer_id = r.public_id
       UNION ALL SELECT 1 FROM public.merchants WHERE public_merchant_id = r.public_id
       UNION ALL SELECT 1 FROM public.kyc_records WHERE public_kyc_id = r.public_id
       UNION ALL SELECT 1 FROM public.ticket_attachments WHERE public_document_id = r.public_id
       UNION ALL SELECT 1 FROM public.dispute_files WHERE public_document_id = r.public_id
       UNION ALL SELECT 1 FROM public.withdrawals WHERE public_withdrawal_id = r.public_id
       UNION ALL SELECT 1 FROM public.wallet_transactions WHERE public_transaction_id = r.public_id
     )`,
  ];
  for (const sql of statements) await run(sql);
  await RESTORE_WALLET(snap.balance, snap.pending_balance);
  if (existsSync(SNAPSHOT_FILE)) unlinkSync(SNAPSHOT_FILE);
  const leftover = (await run(`SELECT
    (SELECT count(*) FROM public.orders WHERE order_number LIKE 'PIDBULK%') AS a,
    (SELECT count(*) FROM public.refunds WHERE reason = 'PIDBULK harness') AS b,
    (SELECT count(*) FROM public.disputes WHERE reason = 'PIDBULK harness') AS c,
    (SELECT count(*) FROM public.support_tickets WHERE subject LIKE 'PIDBULK%') AS d,
    (SELECT count(*) FROM public.merchant_payouts WHERE notes = 'PIDBULK harness') AS e,
    (SELECT count(*) FROM public.profiles WHERE phone LIKE '90000000%' OR phone LIKE '91000000%') AS f,
    (SELECT count(*) FROM public.merchants WHERE business_name LIKE 'PIDBULK-BIZ-%') AS g,
    (SELECT count(*) FROM public.notifications WHERE created_at > now() - interval '1 day' AND user_id IN ('${CUSTOMER}', '${MERCHANT_USER}') AND title LIKE 'PIDBULK%') AS h`))[0];
  console.log(`cleanup done: orders=${leftover.a} refunds=${leftover.b} disputes=${leftover.c} tickets=${leftover.d} payouts=${leftover.e} profiles=${leftover.f} merchants=${leftover.g} notifs=${leftover.h}`);
};

if (process.argv[2] === 'cleanup') {
  await CLEANUP();
  console.log('cleanup-only run complete');
  process.exit(0);
}

console.log(`rows/entity=${ROWS} customerWallet=${WALLET} merchantWallet=${MERCHANT_WALLET.id} bank=${BANK[0].id}`);
console.log('--- Phase A: bulk insert (DB triggers auto-generate public ids) ---');

const inserts = [];
inserts.push(`INSERT INTO public.orders (customer_id, order_number, merchant_name, product_name, amount, currency, status, escrow_status, merchant_id)
  SELECT '${CUSTOMER}', 'PIDBULK-ORD-' || lpad(i::text, 4, '0'), 'PIDBULK Merchant', 'PIDBULK product ' || i,
         (100 + (i % 9000))::numeric, 'INR', 'pending', 'held', '${MERCHANT}'
  FROM generate_series(1, ${ROWS}) i`);

inserts.push(`INSERT INTO public.payment_transactions (customer_id, order_id, amount, currency, status, customer_phone, razorpay_order_id)
  SELECT '${CUSTOMER}', o.id, o.amount, 'INR', 'success', '+919111111111', 'PIDBULK-PAY-' || o.rn
  FROM (SELECT id, amount, row_number() OVER (ORDER BY created_at) AS rn FROM public.orders WHERE order_number LIKE 'PIDBULK-ORD-%') o`);

inserts.push(`INSERT INTO public.refunds (order_id, customer_id, amount, currency, status, reason)
  SELECT o.id, '${CUSTOMER}', o.amount, 'INR', 'initiated', 'PIDBULK harness'
  FROM public.orders o WHERE o.order_number LIKE 'PIDBULK-ORD-%'`);

inserts.push(`INSERT INTO public.disputes (order_id, customer_id, reason, description, issue_type)
  SELECT o.id, '${CUSTOMER}', 'PIDBULK harness', 'PIDBULK harness dispute', 'not_received'
  FROM public.orders o WHERE o.order_number LIKE 'PIDBULK-ORD-%'`);

// fund the merchant wallet so process_merchant_payout (balance check) passes;
// restored in Phase D cleanup
saveSnapshot();
await run(`UPDATE public.merchant_wallets SET balance = balance + 2000000 WHERE id = '${MERCHANT_WALLET.id}'`);

inserts.push(`INSERT INTO public.merchant_payouts (merchant_id, bank_account_id, amount, currency, status, notes)
  SELECT '${MERCHANT}', '${BANK[0].id}', (100 + (i % 5000))::numeric, 'INR', 'processing', 'PIDBULK harness'
  FROM generate_series(1, ${ROWS}) i`);

inserts.push(`INSERT INTO public.support_tickets (customer_id, subject, category, description, merchant_id)
  SELECT '${CUSTOMER}', 'PIDBULK-TKT-' || lpad(i::text, 4, '0'), 'general', 'PIDBULK harness ticket', '${MERCHANT}'
  FROM generate_series(1, ${ROWS}) i`);

inserts.push(`INSERT INTO public.notifications (user_id, title, message, type)
  SELECT '${CUSTOMER}', 'PIDBULK notification', 'PIDBULK harness notification ' || i, 'info'
  FROM generate_series(1, ${ROWS}) i`);

inserts.push(`INSERT INTO public.wallet_transactions (wallet_id, customer_id, type, amount, currency, description, status)
  SELECT '${WALLET}', '${CUSTOMER}', CASE WHEN i % 3 = 0 THEN 'withdrawal' ELSE 'credit' END,
         (10 + (i % 500))::numeric, 'INR', 'PIDBULK harness', 'success'
  FROM generate_series(1, ${ROWS}) i`);

inserts.push(`INSERT INTO public.withdrawals (customer_id, amount, status, transaction_id)
  SELECT '${CUSTOMER}', (50 + (i % 1000))::numeric, 'processing', 'PIDBULK-WDR-' || lpad(i::text, 4, '0')
  FROM generate_series(1, ${ROWS}) i`);

inserts.push(`INSERT INTO public.ticket_attachments (ticket_id, file_name, file_url)
  SELECT t.id, 'PIDBULK-attachment-' || row_number() OVER (ORDER BY t.created_at) || '.pdf', 'https://example.com/pidbulk.pdf'
  FROM public.support_tickets t WHERE t.subject LIKE 'PIDBULK-TKT-%'`);

inserts.push(`INSERT INTO public.dispute_files (dispute_id, file_url, file_name)
  SELECT d.id, 'https://example.com/pidbulk.png', 'PIDBULK-proof-' || row_number() OVER (ORDER BY d.created_at) || '.png'
  FROM public.disputes d WHERE d.reason = 'PIDBULK harness'`);

inserts.push(`INSERT INTO public.profiles (phone, password_hash, full_name)
  SELECT '90000000' || lpad(i::text, 5, '0'), 'PIDBULK-hash', 'PIDBULK Customer ' || i
  FROM generate_series(1, ${ROWS}) i`);

inserts.push(`INSERT INTO public.profiles (phone, password_hash, full_name)
  SELECT '91000000' || lpad(i::text, 5, '0'), 'PIDBULK-hash', 'PIDBULK Merchant ' || i
  FROM generate_series(1, ${ROWS}) i`);

inserts.push(`INSERT INTO public.merchants (user_id, business_name, business_category, business_email, business_phone, verification_status)
  SELECT p.id, 'PIDBULK-BIZ-' || p.phone, 'general', 'biz-' || p.phone || '@test.example', p.phone, 'pending'
  FROM public.profiles p WHERE p.phone LIKE '91000000%' AND p.password_hash = 'PIDBULK-hash'`);

inserts.push(`INSERT INTO public.kyc_records (customer_id, status, kyc_level, full_legal_name, admin_notes)
  SELECT '${CUSTOMER}', 'submitted', 'basic', 'PIDBULK User ' || i, 'PIDBULK harness'
  FROM generate_series(1, ${ROWS}) i`);

for (const sql of inserts) {
  await run(sql);
}
console.log(`inserted ${inserts.length} batches x ${ROWS} rows`);

// ===========================================================================
// Phase B: per-entity verification over the WHOLE table
// ===========================================================================
console.log('--- Phase B: format / fill / uniqueness / prefix ---');
const entities = [
  ['orders', 'public_order_id', 'ORD'],
  ['payment_transactions', 'public_payment_id', 'PAY'],
  ['refunds', 'public_refund_id', 'REF'],
  ['disputes', 'public_dispute_id', 'DSP'],
  ['merchant_payouts', 'public_payout_id', 'PYO'],
  ['support_tickets', 'public_ticket_id', 'TKT'],
  ['notifications', 'public_notification_id', 'NTF'],
  ['profiles', 'public_customer_id', 'CUS'],
  ['merchants', 'public_merchant_id', 'MER'],
  ['kyc_records', 'public_kyc_id', 'KYC'],
  ['ticket_attachments', 'public_document_id', 'DOC'],
  ['dispute_files', 'public_document_id', 'DOC'],
  ['withdrawals', 'public_withdrawal_id', 'WDR'],
];

let batchRows = 0;
for (const [table, col, prefix] of entities) {
  const r = (await run(`SELECT
    (SELECT count(*) FROM public.${table}) AS total,
    (SELECT count(*) FROM public.${table} WHERE ${col} IS NULL) AS missing,
    (SELECT count(*) FROM public.${table} WHERE ${col} IS NOT NULL AND ${col} !~ '^[A-Z]{3}-[0-9]{12}$') AS bad_format,
    (SELECT count(*) FROM (SELECT ${col} FROM public.${table} GROUP BY ${col} HAVING count(*) > 1) d) AS dupes,
    (SELECT count(*) FROM public.${table} WHERE left(${col}, 3) <> '${prefix}') AS wrong_prefix,
    (SELECT count(*) FROM public.${table} WHERE ${col} IS NOT NULL) AS filled`))[0];
  const ok = r.missing === 0 && r.bad_format === 0 && r.dupes === 0 && r.wrong_prefix === 0;
  check(`table ${table}.${col} (prefix ${prefix})`, ok,
    `total=${r.total} filled=${r.filled} missing=${r.missing} badFormat=${r.bad_format} dupes=${r.dupes} wrongPrefix=${r.wrong_prefix}`);
  batchRows += r.filled;
}

const wt = (await run(`SELECT
  (SELECT count(*) FROM public.wallet_transactions) AS total,
  (SELECT count(*) FROM public.wallet_transactions WHERE public_transaction_id IS NULL) AS txn_missing,
  (SELECT count(*) FROM public.wallet_transactions WHERE public_transaction_id !~ '^[A-Z]{3}-[0-9]{12}$') AS txn_bad,
  (SELECT count(*) FROM public.wallet_transactions WHERE left(public_transaction_id, 3) <> 'TXN') AS txn_prefix,
  (SELECT count(*) FROM (SELECT public_transaction_id FROM public.wallet_transactions GROUP BY public_transaction_id HAVING count(*) > 1) d) AS txn_dupes,
  (SELECT count(*) FROM public.wallet_transactions WHERE type = 'withdrawal') AS withdrawals,
  (SELECT count(*) FROM public.wallet_transactions WHERE type = 'withdrawal' AND public_withdrawal_id IS NULL) AS wdr_missing,
  (SELECT count(*) FROM public.wallet_transactions WHERE type = 'withdrawal' AND (public_withdrawal_id IS NULL OR public_withdrawal_id !~ '^[A-Z]{3}-[0-9]{12}$')) AS wdr_bad,
  (SELECT count(*) FROM public.wallet_transactions WHERE type = 'withdrawal' AND left(public_withdrawal_id, 3) <> 'WDR') AS wdr_prefix,
  (SELECT count(*) FROM public.wallet_transactions WHERE type <> 'withdrawal' AND public_withdrawal_id IS NOT NULL) AS wdr_on_nonwithdrawal,
  (SELECT count(*) FROM (SELECT public_withdrawal_id FROM public.wallet_transactions WHERE public_withdrawal_id IS NOT NULL GROUP BY public_withdrawal_id HAVING count(*) > 1) d) AS wdr_dupes`))[0];
check('wallet_transactions.public_transaction_id (TXN)', wt.txn_missing === 0 && wt.txn_bad === 0 && wt.txn_dupes === 0 && wt.txn_prefix === 0,
  `total=${wt.total} missing=${wt.txn_missing} bad=${wt.txn_bad} dupes=${wt.txn_dupes} wrongPrefix=${wt.txn_prefix}`);
check('wallet_transactions.public_withdrawal_id (WDR, withdrawals only)', wt.wdr_missing === 0 && wt.wdr_bad === 0 && wt.wdr_dupes === 0 && wt.wdr_prefix === 0 && wt.wdr_on_nonwithdrawal === 0,
  `withdrawals=${wt.withdrawals} missing=${wt.wdr_missing} bad=${wt.wdr_bad} dupes=${wt.wdr_dupes} wrongPrefix=${wt.wdr_prefix} onNonWithdrawal=${wt.wdr_on_nonwithdrawal}`);

const reg = (await run(`SELECT count(*) AS n, count(DISTINCT public_id) AS d, count(*) FILTER (WHERE public_id !~ '^[A-Z]{3}-[0-9]{12}$') AS bad FROM public.public_id_registry`))[0];
check('registry global uniqueness + format', reg.n === reg.d && reg.bad === 0, `total=${reg.n} distinct=${reg.d} bad=${reg.bad}`);

// registry entries exist for every batch row's public id (join back to the tables)
const regCover = (await run(`
  WITH all_ids AS (
    SELECT public_order_id AS pid FROM public.orders
    UNION ALL SELECT public_payment_id FROM public.payment_transactions
    UNION ALL SELECT public_refund_id FROM public.refunds
    UNION ALL SELECT public_dispute_id FROM public.disputes
    UNION ALL SELECT public_payout_id FROM public.merchant_payouts
    UNION ALL SELECT public_ticket_id FROM public.support_tickets
    UNION ALL SELECT public_notification_id FROM public.notifications
    UNION ALL SELECT public_customer_id FROM public.profiles
    UNION ALL SELECT public_merchant_id FROM public.merchants
    UNION ALL SELECT public_kyc_id FROM public.kyc_records
    UNION ALL SELECT public_document_id FROM public.ticket_attachments
    UNION ALL SELECT public_document_id FROM public.dispute_files
    UNION ALL SELECT public_withdrawal_id FROM public.withdrawals
    UNION ALL SELECT public_transaction_id FROM public.wallet_transactions
  )
  SELECT (SELECT count(*) FROM all_ids) AS n,
         (SELECT count(*) FROM all_ids a WHERE NOT EXISTS (SELECT 1 FROM public.public_id_registry r WHERE r.public_id = a.pid)) AS missing
`))[0];
check('every public id registered', regCover.missing === 0, `ids=${regCover.n} notInRegistry=${regCover.missing}`);

// ===========================================================================
// Phase C: security / ownership / search-by-public-id semantics
// ===========================================================================
console.log('--- Phase C: ownership qualifier + policy/FK hygiene ---');

const sample = (await run(`SELECT public_order_id AS pid, id FROM public.orders WHERE order_number LIKE 'PIDBULK-ORD-%' LIMIT 1`))[0];
const other = (await run(`SELECT id FROM public.profiles WHERE phone = '9000000000001' LIMIT 1`))[0];
const sec = (await run(`
  SELECT
    (SELECT count(*) FROM public.orders WHERE public_order_id = '${sample.pid}' AND customer_id = '${CUSTOMER}') AS owned,
    (SELECT count(*) FROM public.orders WHERE public_order_id = '${sample.pid}' AND customer_id = '${other.id}') AS foreign,
    (SELECT count(*) FROM public.orders WHERE public_order_id = 'ORD-000000000000') AS bogus
`))[0];
check('search by public id + owner qualifier returns the row', sec.owned === 1, `owned=${sec.owned}`);
check('same public id + different owner returns nothing (id != access key)', sec.foreign === 0, `foreign=${sec.foreign}`);
check('bogus public id is a safe no-match', sec.bogus === 0, `bogus=${sec.bogus}`);

const pol = (await run(`
  SELECT count(*) AS n FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual IS NOT NULL AND qual::text ILIKE '%public\\_%' ESCAPE '\\'
         OR with_check IS NOT NULL AND with_check::text ILIKE '%public\\_%' ESCAPE '\\')
`))[0];
check('no RLS policy references a public_* column', pol.n === 0, `policies=${pol.n}`);

const fk = (await run(`
  SELECT count(*) AS n FROM information_schema.key_column_usage k
  JOIN information_schema.constraint_column_usage c
    ON k.constraint_name = c.constraint_name AND k.table_schema = c.table_schema
  WHERE k.constraint_schema = 'public' AND c.column_name LIKE 'public\\_%'
    AND k.table_name <> 'public_id_registry'
`))[0];
check('no FK constraint references a public_* column', fk.n === 0, `fks=${fk.n}`);

// entropy: detect SEQUENTIAL enumeration (runs of >=3 consecutive suffixes in
// one prefix). Leading-zero ids are expected (~10%) from lpad of random numbers.
const entropy = (await run(`
  WITH nums AS (
    SELECT left(public_id, 3) AS pfx, substr(public_id, 5)::bigint AS n
    FROM public.public_id_registry
  ), consec AS (
    SELECT pfx, n, n - row_number() OVER (PARTITION BY pfx ORDER BY n) AS grp FROM nums
  )
  SELECT (SELECT count(*) FROM (SELECT pfx, grp, count(*) AS c FROM consec GROUP BY pfx, grp HAVING count(*) >= 3) r) AS runs,
         (SELECT count(DISTINCT n) FROM nums) AS distinct_suffixes
`))[0];
check('suffixes are random (no runs of 3+ consecutive)', entropy.runs === 0,
  `consecutiveRuns=${entropy.runs} distinctSuffixes=${entropy.distinct_suffixes}`);

// ===========================================================================
// Phase D: cleanup
// ===========================================================================
console.log('--- Phase D: cleanup ---');

const cleanups = [
  `DELETE FROM public.dispute_files WHERE file_name LIKE 'PIDBULK%'`,
  `DELETE FROM public.refunds WHERE reason = 'PIDBULK harness'`,
  `DELETE FROM public.payment_transactions WHERE razorpay_order_id LIKE 'PIDBULK-PAY-%'`,
  `DELETE FROM public.wallet_transactions WHERE description = 'PIDBULK harness'`,
  `DELETE FROM public.ticket_attachments WHERE file_name LIKE 'PIDBULK%'`,
  `DELETE FROM public.support_tickets WHERE subject LIKE 'PIDBULK-TKT-%'`,
  `DELETE FROM public.withdrawals WHERE transaction_id LIKE 'PIDBULK-WDR-%'`,
  `DELETE FROM public.merchant_payouts WHERE notes = 'PIDBULK harness'`,
  `DELETE FROM public.disputes WHERE reason = 'PIDBULK harness'`,
  `DELETE FROM public.order_events WHERE order_id IN (SELECT id FROM public.orders WHERE order_number LIKE 'PIDBULK-ORD-%')`,
  `DELETE FROM public.orders WHERE order_number LIKE 'PIDBULK-ORD-%'`,
  `DELETE FROM public.kyc_records WHERE admin_notes = 'PIDBULK harness'`,
  `DELETE FROM public.merchant_wallets WHERE merchant_id IN (SELECT id FROM public.merchants WHERE business_name LIKE 'PIDBULK-BIZ-%')`,
  `DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM public.profiles WHERE phone LIKE '90000000%' OR phone LIKE '91000000%')`,
  `DELETE FROM public.merchants WHERE business_name LIKE 'PIDBULK-BIZ-%'`,
  `DELETE FROM public.wallets WHERE customer_id IN (SELECT id FROM public.profiles WHERE phone LIKE '90000000%' OR phone LIKE '91000000%')`,
  `DELETE FROM public.profiles WHERE phone LIKE '90000000%' OR phone LIKE '91000000%'`,
  NOTIF_DELETE,
  `DELETE FROM public.public_id_registry r WHERE NOT EXISTS (
     SELECT 1 FROM public.orders WHERE public_order_id = r.public_id
     UNION ALL SELECT 1 FROM public.payment_transactions WHERE public_payment_id = r.public_id
     UNION ALL SELECT 1 FROM public.refunds WHERE public_refund_id = r.public_id
     UNION ALL SELECT 1 FROM public.disputes WHERE public_dispute_id = r.public_id
     UNION ALL SELECT 1 FROM public.merchant_payouts WHERE public_payout_id = r.public_id
     UNION ALL SELECT 1 FROM public.support_tickets WHERE public_ticket_id = r.public_id
     UNION ALL SELECT 1 FROM public.notifications WHERE public_notification_id = r.public_id
     UNION ALL SELECT 1 FROM public.profiles WHERE public_customer_id = r.public_id
     UNION ALL SELECT 1 FROM public.merchants WHERE public_merchant_id = r.public_id
     UNION ALL SELECT 1 FROM public.kyc_records WHERE public_kyc_id = r.public_id
     UNION ALL SELECT 1 FROM public.ticket_attachments WHERE public_document_id = r.public_id
     UNION ALL SELECT 1 FROM public.dispute_files WHERE public_document_id = r.public_id
     UNION ALL SELECT 1 FROM public.withdrawals WHERE public_withdrawal_id = r.public_id
     UNION ALL SELECT 1 FROM public.wallet_transactions WHERE public_transaction_id = r.public_id
   )`,
];
for (const sql of cleanups) await run(sql);

// restore merchant wallet balances moved by process_merchant_payout during the harness
await RESTORE_WALLET(MERCHANT_WALLET.balance, MERCHANT_WALLET.pending_balance);
if (existsSync(SNAPSHOT_FILE)) unlinkSync(SNAPSHOT_FILE);

const post = (await run(`SELECT
  (SELECT count(*) FROM public.orders WHERE order_number LIKE 'PIDBULK%') AS orders,
  (SELECT count(*) FROM public.refunds WHERE reason = 'PIDBULK harness') AS refunds,
  (SELECT count(*) FROM public.disputes WHERE reason = 'PIDBULK harness') AS disputes,
  (SELECT count(*) FROM public.support_tickets WHERE subject LIKE 'PIDBULK%') AS tickets,
  (SELECT count(*) FROM public.merchant_payouts WHERE notes = 'PIDBULK harness') AS payouts,
  (SELECT count(*) FROM public.profiles WHERE phone LIKE '90000000%' OR phone LIKE '91000000%') AS profiles,
  (SELECT count(*) FROM public.merchants WHERE business_name LIKE 'PIDBULK-BIZ-%') AS merchants,
  (SELECT count(*) FROM public.notifications n WHERE n.user_id IN ('${CUSTOMER}', '${MERCHANT_USER}')
     AND (n.title LIKE 'PIDBULK%' OR n.message LIKE '%PIDBULK%'
          OR (n.link LIKE '/refunds/%'           AND NOT EXISTS (SELECT 1 FROM public.refunds r WHERE '/refunds/' || r.id = n.link))
          OR (n.link LIKE '/orders/%'            AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE '/orders/' || o.id = n.link))
          OR (n.link LIKE '/help/tickets/%'      AND NOT EXISTS (SELECT 1 FROM public.support_tickets s WHERE '/help/tickets/' || s.id = n.link))
          OR (n.link LIKE '/merchant-support/%'  AND NOT EXISTS (SELECT 1 FROM public.support_tickets s WHERE '/merchant-support/' || s.id = n.link))
          OR (n.link LIKE '/disputes/%'          AND NOT EXISTS (SELECT 1 FROM public.disputes d WHERE '/disputes/' || d.id = n.link))
          OR (n.link LIKE '/merchant-dispute-response/%' AND NOT EXISTS (SELECT 1 FROM public.disputes d WHERE '/merchant-dispute-response/' || d.id = n.link))
          OR (n.link LIKE '/merchant-dispute-result/%'   AND NOT EXISTS (SELECT 1 FROM public.disputes d WHERE '/merchant-dispute-result/' || d.id = n.link)))) AS notifs,
  (SELECT count(*) FROM public.public_id_registry r WHERE NOT EXISTS (
     SELECT 1 FROM public.orders WHERE public_order_id = r.public_id
     UNION ALL SELECT 1 FROM public.payment_transactions WHERE public_payment_id = r.public_id
     UNION ALL SELECT 1 FROM public.refunds WHERE public_refund_id = r.public_id
     UNION ALL SELECT 1 FROM public.disputes WHERE public_dispute_id = r.public_id
     UNION ALL SELECT 1 FROM public.merchant_payouts WHERE public_payout_id = r.public_id
     UNION ALL SELECT 1 FROM public.support_tickets WHERE public_ticket_id = r.public_id
     UNION ALL SELECT 1 FROM public.notifications WHERE public_notification_id = r.public_id
     UNION ALL SELECT 1 FROM public.profiles WHERE public_customer_id = r.public_id
     UNION ALL SELECT 1 FROM public.merchants WHERE public_merchant_id = r.public_id
     UNION ALL SELECT 1 FROM public.kyc_records WHERE public_kyc_id = r.public_id
     UNION ALL SELECT 1 FROM public.ticket_attachments WHERE public_document_id = r.public_id
     UNION ALL SELECT 1 FROM public.dispute_files WHERE public_document_id = r.public_id
     UNION ALL SELECT 1 FROM public.withdrawals WHERE public_withdrawal_id = r.public_id
     UNION ALL SELECT 1 FROM public.wallet_transactions WHERE public_transaction_id = r.public_id
   )) AS registry,
  (SELECT balance FROM public.merchant_wallets WHERE id = '${MERCHANT_WALLET.id}') AS wallet_balance`))[0];
const clean = post.orders + post.refunds + post.disputes + post.tickets + post.payouts + post.profiles + post.merchants + post.notifs + post.registry === 0
  && Number(post.wallet_balance) === Number(MERCHANT_WALLET.balance);
check('cleanup complete (no leftovers, wallet restored)', clean,
  `orders=${post.orders} refunds=${post.refunds} disputes=${post.disputes} tickets=${post.tickets} payouts=${post.payouts} profiles=${post.profiles} merchants=${post.merchants} notifs=${post.notifs} registry=${post.registry} balance=${post.wallet_balance}`);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
