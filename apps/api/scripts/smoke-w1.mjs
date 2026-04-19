import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API = 'http://localhost:3000/api';

const email = `smoke-w1-${Date.now()}@duoshou.test`;
const password = 'SmokeW1!2026';

console.log('=== W1 end-to-end smoke ===');
console.log('email:', email);

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

// 1. Register + login
console.log('\n[1/7] register + login');
const { data: created, error: e1 } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (e1) throw e1;
const anon = createClient(SUPABASE_URL, ANON);
const { data: login, error: e2 } = await anon.auth.signInWithPassword({ email, password });
if (e2) throw e2;
const token = login.session.access_token;

function authFetch(path, init = {}) {
  const isJsonBody = typeof init.body === 'string';
  return fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
}

// 2. Connect Temu test shop
console.log('\n[2/7] connect Temu test shop');
const connectResp = await authFetch('/shops', {
  method: 'POST',
  body: JSON.stringify({
    appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
    appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
    accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
    platformShopId: process.env.TEMU_FULL_TEST_1_SHOP_ID,
    shopType: 'full',
    region: 'pa',
    displayName: 'smoke-w1',
  }),
});
if (connectResp.status !== 201 && connectResp.status !== 200) {
  console.error('shop connect failed:', await connectResp.text());
  await admin.auth.admin.deleteUser(created.user.id);
  process.exit(1);
}
const shop = await connectResp.json();
console.log('  shop id:', shop.id, 'platform id:', shop.platformShopId);

// 3. Find a leaf category via DFS
console.log('\n[3/7] traverse categories to find a leaf');
async function findLeaf(parent = 0, path = []) {
  const r = await authFetch(`/temu/categories?shopId=${shop.id}&parentCatId=${parent}`);
  if (!r.ok) { console.error('categories fetch failed:', await r.text()); return null; }
  const list = await r.json();
  if (!Array.isArray(list) || list.length === 0) return null;
  const leaf = list.find((c) => c.isLeaf);
  if (leaf) return { ...leaf, path: [...path, leaf.catName] };
  const first = list[0];
  return findLeaf(first.catId, [...path, first.catName]);
}
const leaf = await findLeaf();
if (!leaf) {
  console.log('no leaf category found — perhaps no categories visible to test shop');
  await admin.auth.admin.deleteUser(created.user.id);
  process.exit(1);
}
console.log('  leaf catId:', leaf.catId, 'path:', leaf.path.join(' / '));

// 4. Create a template
console.log('\n[4/7] create template');
const tplResp = await authFetch('/product-templates', {
  method: 'POST',
  body: JSON.stringify({
    name: `Smoke Product ${Date.now()}`,
    description: 'W1 smoke test product — please delete',
    temuCategoryId: leaf.catId,
    temuCategoryPath: leaf.path,
    shopTypeTarget: 'full',
    mainImageUrl: 'https://via.placeholder.com/800x800.png',
    carouselImageUrls: [],
    suggestedPriceCents: 999,
    attributes: { Brand: 'Test' },
    outerPackage: { lengthMm: 100, widthMm: 100, heightMm: 100, weightG: 300 },
  }),
});
if (tplResp.status !== 201 && tplResp.status !== 200) {
  console.error('template create failed:', await tplResp.text());
  await admin.auth.admin.deleteUser(created.user.id);
  process.exit(1);
}
const template = await tplResp.json();
console.log('  template id:', template.id);

// 5. Dispatch publish
console.log('\n[5/7] dispatch publish');
const dispResp = await authFetch('/bulk-jobs/publish', {
  method: 'POST',
  body: JSON.stringify({ templateId: template.id, shopIds: [shop.id] }),
});
if (dispResp.status !== 201 && dispResp.status !== 200) {
  console.error('dispatch failed:', await dispResp.text());
  await admin.auth.admin.deleteUser(created.user.id);
  process.exit(1);
}
const job = await dispResp.json();
console.log('  job id:', job.id, 'total:', job.total);

// 6. Poll until done
console.log('\n[6/7] poll job');
let final;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const r = await authFetch('/bulk-jobs/' + job.id);
  if (!r.ok) { console.error('poll err:', r.status); continue; }
  const j = await r.json();
  process.stdout.write(`  tick ${i}: status=${j.status} ok=${j.succeeded} fail=${j.failed}\n`);
  if (j.status === 'completed' || j.status === 'failed') { final = j; break; }
}
if (!final) {
  console.log('\n❌ job did not settle within 2 minutes');
  await admin.auth.admin.deleteUser(created.user.id);
  process.exit(1);
}
console.log('\n  final status:', final.status);
if (final.items?.length) {
  for (const it of final.items) {
    console.log(`    - shop=${it.shop?.platformShopId} status=${it.status}`, it.error ? `ERR: ${it.error.message}` : '');
  }
}

// 7. Cleanup
console.log('\n[7/7] cleanup: delete test user');
await admin.auth.admin.deleteUser(created.user.id);

if (final.status !== 'completed') {
  console.log('\n⚠️ W1 smoke did NOT end clean — review the item error above');
  console.log('   Most likely cause: Temu rejected goods.add due to missing required attribute, bad image url, or non-leaf category.');
  process.exit(1);
}
console.log('\n✅ W1 smoke PASSED');
