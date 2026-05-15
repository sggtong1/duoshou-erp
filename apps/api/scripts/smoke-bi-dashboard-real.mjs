// 一次性 smoke: 调用 /api/dashboard/summary 验证 bi_* 表数据接通。
// 做法: 创建一个测试 user, 用 service role 把它加为「BI 数据所在 org」的 owner, 然后用其 JWT 调 API。
// 完事后清理 member + user。
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { randomUUID } from 'node:crypto';

loadDotenv({ path: '.env.development' });

const API = 'http://localhost:4000/api';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const email = `smoke-bi-real-${Date.now()}@duoshou.test`;
const pw = 'SmokeBi!2026';

console.log('=== BI Dashboard real-data smoke ===');

// 1. 找 BI 数据所在的 org_id (任取一行即可,通常单 org)
const r = await admin.from('bi_org_daily').select('org_id').limit(1);
if (r.error) throw r.error;
if (!r.data?.length) throw new Error('bi_org_daily is empty — sync_bi.py 未运行?');
const orgId = r.data[0].org_id;
console.log('  BI orgId:', orgId);

// 2. 创建测试 user
const { data: c1, error: e1 } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (e1) throw e1;
const userId = c1.user.id;
console.log('  test user:', userId, email);

// 3. upsert user 到业务表 + insert member 加入到 BI org
const upUser = await admin.from('user').upsert({ id: userId, email, auth_provider: 'supabase' });
if (upUser.error) throw upUser.error;
const insMember = await admin.from('member').insert({ id: randomUUID(), user_id: userId, org_id: orgId, role: 'owner' });
if (insMember.error) throw insMember.error;
console.log('  member created (owner of', orgId, ')');

// 4. 登录拿 token
const { data: l1, error: lErr } = await anon.auth.signInWithPassword({ email, password: pw });
if (lErr) throw lErr;
const token = l1.session.access_token;

// 5. 调 dashboard summary
async function get(path) {
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

let final;
try {
  for (const tr of ['today', '7d', '30d']) {
    const { status, body } = await get(`/dashboard/summary?timeRange=${tr}`);
    console.log(`\n[/dashboard/summary?timeRange=${tr}] status=${status}`);
    if (status !== 200) { console.log('  body:', body); continue; }
    console.log('  kpis:', JSON.stringify(body.kpis));
    console.log('  salesTrend.today:', JSON.stringify(body.salesTrend.today));
    console.log('  platformComparison count:', body.platformComparison.length);
    console.log('  shopRanking count:', body.shopRanking.length, '(first:', JSON.stringify(body.shopRanking[0] ?? null), ')');
    console.log('  regionDistribution:', JSON.stringify(body.regionDistribution));
    console.log('  topSkus count:', body.topSkus.length, '(first:', JSON.stringify(body.topSkus[0] ?? null), ')');
    console.log('  productDetails.total:', body.productDetails.total);
    console.log('  alerts:', JSON.stringify(body.alerts), 'lowStockAlerts:', body.lowStockAlerts.length);
    console.log('  dataFreshness:', body.dataFreshness);
    console.log('  appliedFilter:', JSON.stringify(body.appliedFilter));
    final = body;
  }
} finally {
  // 6. 清理
  console.log('\n=== cleanup ===');
  await admin.from('member').delete().eq('user_id', userId).eq('org_id', orgId);
  await admin.auth.admin.deleteUser(userId);
  // 不删 public.user 让外键 cascade 自然处理(或留着无害)。
  console.log('  done');
}

console.log('\n✅ Smoke completed.');
