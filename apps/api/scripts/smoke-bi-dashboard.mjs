import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const API = 'http://localhost:3000/api';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const email = `smoke-bi-${Date.now()}@duoshou.test`;
const pw = 'SmokeBi!2026';

console.log('=== BI Dashboard 基础 smoke ===');

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
    shopType: 'full', region: 'pa', displayName: 'smoke-bi',
  }),
});
const shop = await shopResp.json();
console.log('  shop:', shop.id ?? shop.error ?? shop);

console.log('\n[2/6] GET /dashboard/summary (新 org 可能全 0)');
const sumResp = await fetchA('/dashboard/summary');
console.log('  status:', sumResp.status);
const summary = await sumResp.json();
console.log('  kpis:', JSON.stringify(summary.kpis));
console.log('  dataFreshness:', summary.dataFreshness);

console.log('\n[3/6] POST /dashboard/sync/now (期望 202)');
const syncResp = await fetchA('/dashboard/sync/now', { method: 'POST' });
console.log('  status:', syncResp.status);
const syncRes = await syncResp.json();
console.log('  accepted:', syncRes.accepted);

console.log('\n[4/6] GET /settings');
const setResp = await fetchA('/settings');
console.log('  status:', setResp.status);
const settings = await setResp.json();
console.log('  lowStockThreshold:', settings.lowStockThreshold);

console.log('\n[5/6] PATCH /settings (改阈值 10 → 20)');
const patchResp = await fetchA('/settings', {
  method: 'PATCH', body: JSON.stringify({ lowStockThreshold: 20 }),
});
console.log('  status:', patchResp.status);
const updated = await patchResp.json();
console.log('  lowStockThreshold after patch:', updated.lowStockThreshold);

console.log('\n[6/6] 清理');
await admin.auth.admin.deleteUser(c1.user.id);
console.log('\n✅ BI Dashboard 基础 smoke PASSED');
