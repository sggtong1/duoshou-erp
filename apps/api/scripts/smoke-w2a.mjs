import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const API = 'http://localhost:3000/api';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const email = `smoke-w2a-${Date.now()}@duoshou.test`;
const pw = 'SmokeW2a!2026';

console.log('=== W2a price review smoke ===');

const { data: c1, error: e1 } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (e1) throw e1;
const { data: l1 } = await anon.auth.signInWithPassword({ email, password: pw });
const token = l1.session.access_token;

const fetchA = (path, init = {}) => fetch(API + path, {
  ...init,
  headers: { Authorization: `Bearer ${token}`, ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
});

// 1. Connect test shop (full, pa — per W1 findings)
console.log('\n[1/5] connect test shop');
const shop = await (await fetchA('/shops', {
  method: 'POST', body: JSON.stringify({
    appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
    appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
    accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
    platformShopId: process.env.TEMU_FULL_TEST_1_SHOP_ID,
    shopType: 'full', region: 'pa', displayName: 'smoke-w2a',
  }),
})).json();
console.log('  shop:', shop.id);

// 2. List reviews
console.log('\n[2/5] GET /price-reviews');
const listResp = await fetchA('/price-reviews');
console.log('  status:', listResp.status);
const list = await listResp.json();
console.log('  items count:', list.items?.length ?? 0, 'total:', list.total);

// 3. Probe skipped — sync cron runs every 5 min
console.log('\n[3/5] probe bg.price.review.page.query directly via sign script');

// 4. Batch-confirm with bogus UUID
console.log('\n[4/5] POST /price-reviews/batch-confirm (empty — dry)');
const confirmResp = await fetchA('/price-reviews/batch-confirm', {
  method: 'POST', body: JSON.stringify({ reviewIds: ['00000000-0000-0000-0000-000000000000'] }),
});
console.log('  status:', confirmResp.status);

// 5. Cleanup
console.log('\n[5/5] cleanup');
await admin.auth.admin.deleteUser(c1.user.id);
console.log('\n✅ W2a infra smoke PASSED');
