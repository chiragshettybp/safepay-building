import { config } from 'dotenv';
config({ path: '.env.local' });
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const URL = `https://api.supabase.com/v1/projects/${ref}/database/query`;
const dir = join(__dirname, '..', 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

async function run(sql) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 1200)}`);
  }
  return text;
}

const target = process.argv[2];

try {
  const res = await run('select version();');
  console.log('Management API reachable with access token.', res.slice(0, 160));
} catch (err) {
  console.error('Sanity check failed:', err.message);
  process.exit(1);
}

for (const f of files) {
  if (target && f.slice(0, 14).localeCompare(target.slice(0, 14)) < 0) continue;
  const sql = readFileSync(join(dir, f), 'utf8');
  process.stdout.write(`Applying ${f} ... `);
  try {
    await run(sql);
    console.log('OK');
  } catch (err) {
    console.log('FAILED');
    console.error(err.message);
    console.error(`Stopping at ${f}. Remaining ${files.length - files.indexOf(f) - 1} files not applied.`);
    process.exit(1);
  }
}

console.log('All migrations applied.');
