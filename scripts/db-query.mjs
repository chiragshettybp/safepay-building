import { config } from 'dotenv';
config({ path: '.env.local' });
import { readFileSync } from 'node:fs';

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const file = process.argv[2];
if (!ref || !token || !file) {
  console.error('Usage: node scripts/db-query.mjs <sql-file>');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${text.slice(0, 1200)}`);
  process.exit(1);
}
console.log(text);
