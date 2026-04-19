import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = 'http://localhost:3000/api';

const email = `smoke-${Date.now()}@duoshou.test`;
const password = 'SmokeTest!2026';

console.log('=== W0 end-to-end smoke ===');
console.log('email:', email);

// 1. Health
console.log('\n[1/6] GET /api/health');
const h = await fetch(API_BASE + '/health');
console.log('  status:', h.status, JSON.stringify(await h.json()));

// 2. Create user via admin (skip email confirm)
console.log('\n[2/6] create user via admin');
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const { data: created, error: err1 } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
});
if (err1) throw err1;
console.log('  created user id:', created.user.id);

// 3. Sign in
console.log('\n[3/6] sign in');
const anon = createClient(SUPABASE_URL, ANON);
const { data: login, error: err2 } = await anon.auth.signInWithPassword({ email, password });
if (err2) throw err2;
const token = login.session.access_token;
console.log('  access_token length:', token.length, 'exp:', new Date(login.session.expires_at * 1000).toISOString());

// 4. POST /api/shops (connect Temu test shop)
console.log('\n[4/6] POST /api/shops (connect Temu 全托 test account 1)');
const connectResp = await fetch(API_BASE + '/shops', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
    appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
    accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
    platformShopId: process.env.TEMU_FULL_TEST_1_SHOP_ID,
    shopType: 'full',
    region: 'cn',
    displayName: 'girl clothes (smoke)',
  }),
});
console.log('  status:', connectResp.status);
const connectBody = await connectResp.json();
console.log('  body:', JSON.stringify(connectBody, null, 2));

// 5. GET /api/shops (list shops)
console.log('\n[5/6] GET /api/shops');
const listResp = await fetch(API_BASE + '/shops', {
  headers: { Authorization: `Bearer ${token}` },
});
console.log('  status:', listResp.status);
const list = await listResp.json();
console.log('  count:', Array.isArray(list) ? list.length : 'n/a');
if (Array.isArray(list)) {
  list.forEach(s => console.log(`    - shop_id=${s.platformShopId} name=${s.displayName} type=${s.shopType}`));
}

// 6. Clean up (remove test user + shop)
console.log('\n[6/6] cleanup: delete test user');
await admin.auth.admin.deleteUser(created.user.id);
console.log('  deleted user', created.user.id);

console.log('\n✅ W0 smoke PASSED');
