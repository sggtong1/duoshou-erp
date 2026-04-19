import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const SUPABASE_URL = 'https://kivdxnlpjtzgmbhzusrd.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdmR4bmxwanR6Z21iaHp1c3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDU0NjAsImV4cCI6MjA5MjEyMTQ2MH0.9bCdKvobI5ehAKMyXJKzatihsPUdoKe7aiYQK6MRBZ8';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpdmR4bmxwanR6Z21iaHp1c3JkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0NTQ2MCwiZXhwIjoyMDkyMTIxNDYwfQ.TjHZsHw1R2S0HTJNctzsPPreyv-iQ_fo_fy5DKaedKg';

console.log('=== Supabase verification ===');

console.log('\n[1] URL reachable...');
try {
  const r = await fetch(SUPABASE_URL + '/auth/v1/health', { headers: { apikey: ANON } });
  console.log(`  status=${r.status}`);
  const txt = await r.text();
  console.log(`  body: ${txt.slice(0, 200)}`);
} catch (e) {
  console.log(`  FAIL: ${e.message}`);
}

console.log('\n[2] Anon key check (auth settings)...');
try {
  const r = await fetch(SUPABASE_URL + '/auth/v1/settings', {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  console.log(`  status=${r.status}`);
  const j = await r.json();
  console.log(`  external providers: ${Object.keys(j.external || {}).slice(0,5).join(',')}`);
  console.log(`  signup disabled: ${j.disable_signup}`);
} catch (e) {
  console.log(`  FAIL: ${e.message}`);
}

console.log('\n[3] Service role key check (admin users list)...');
try {
  const supa = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const { data, error } = await supa.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) throw error;
  console.log(`  OK — currently ${data.users.length} user(s) in project`);
} catch (e) {
  console.log(`  FAIL: ${e.message}`);
}

const DB_URL_ENC = 'postgresql://postgres:OL6892364sg%29@db.kivdxnlpjtzgmbhzusrd.supabase.co:5432/postgres';
console.log('\n[4] Postgres direct connection...');
const { Client } = pg;
const c = new Client({ connectionString: DB_URL_ENC, ssl: { rejectUnauthorized: false } });
try {
  await c.connect();
  const r = await c.query('select version() as ver, now() as ts, current_database() as db');
  console.log(`  OK — db=${r.rows[0].db}`);
  console.log(`  version: ${r.rows[0].ver.slice(0, 80)}...`);
  console.log(`  server time: ${r.rows[0].ts.toISOString()}`);
  await c.end();
} catch (e) {
  console.log(`  FAIL: ${e.message}`);
}

console.log('\nDONE');
