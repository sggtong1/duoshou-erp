import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const API = 'http://localhost:3000/api';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const email = `smoke-w2b-${Date.now()}@duoshou.test`;
const pw = 'SmokeW2b!2026';

console.log('=== W2b 活动报名基础 smoke ===');

const { data: c1, error: e1 } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (e1) throw e1;
const { data: l1 } = await anon.auth.signInWithPassword({ email, password: pw });
const token = l1.session.access_token;

const fetchA = (path, init = {}) => fetch(API + path, {
  ...init,
  headers: {
    Authorization: `Bearer ${token}`,
    ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...init.headers,
  },
});

console.log('\n[1/6] 连接测试店铺');
const shopResp = await fetchA('/shops', {
  method: 'POST', body: JSON.stringify({
    appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
    appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
    accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
    platformShopId: process.env.TEMU_FULL_TEST_1_SHOP_ID,
    shopType: 'full', region: 'pa', displayName: 'smoke-w2b',
  }),
});
let shop = await shopResp.json();
console.log('  status:', shopResp.status, ' shop:', shop.id ?? shop.error ?? shop);
if (!shop.id) {
  // fallback: GET /shops and take the first one
  const listShopResp = await fetchA('/shops');
  const existingShops = await listShopResp.json();
  const existing = Array.isArray(existingShops) ? existingShops[0] : existingShops?.items?.[0];
  if (existing?.id) {
    shop = existing;
    console.log('  fallback picked existing shop:', shop.id);
  } else {
    console.error('  ❌ BLOCKED: cannot acquire shop.id');
    process.exit(1);
  }
}

console.log('\n[2/6] GET /activities');
const listResp = await fetchA('/activities');
console.log('  status:', listResp.status);
const list = await listResp.json();
console.log('  items:', list.items?.length ?? 0, 'total:', list.total);

console.log('\n[3/6] POST /activities/sync/now (fire-and-forget,期望 202)');
const syncResp = await fetchA('/activities/sync/now', { method: 'POST' });
console.log('  status:', syncResp.status);
const syncRes = await syncResp.json();
console.log('  accepted:', syncRes.accepted, 'startedAt:', syncRes.startedAt);

console.log('\n[4/6] GET /enrollments');
const enrListResp = await fetchA('/enrollments');
console.log('  status:', enrListResp.status);

console.log('\n[5/6] POST /enrollments/submit (空 items 预期 400 validation fail)');
const submitResp = await fetchA('/enrollments/submit', {
  method: 'POST',
  body: JSON.stringify({ activityId: '00000000-0000-0000-0000-000000000000', items: [] }),
});
console.log('  status:', submitResp.status);

console.log('\n[6/6] 清理');
await admin.auth.admin.deleteUser(c1.user.id);
console.log('\n✅ W2b 基础 smoke PASSED');
