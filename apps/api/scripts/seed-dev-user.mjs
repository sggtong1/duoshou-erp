// 幂等地创建/确保一个常驻 dev 测试账号,挂到现有 BI org 作为 owner。
// 跑多次安全,已存在就跳过。
//
// Usage:  cd apps/api && node scripts/seed-dev-user.mjs
//
// 登录:   email/password 见下面 DEV_EMAIL / DEV_PASSWORD 常量,
//         前端走 supabase signInWithPassword,或脚本里:
//           const { data } = await anon.auth.signInWithPassword({ email, password });
//           const token = data.session.access_token;
//
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import { randomUUID } from 'node:crypto';

loadDotenv({ path: '.env.development' });

const DEV_EMAIL = 'dev-tester@duoshou.test';
const DEV_PASSWORD = 'DuoshouDev!2026';
const BI_ORG_ID = '503a9c8d-1976-475a-85fe-0d65af3c71d5';

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

console.log('=== seed dev tester ===');
console.log('  email:    ', DEV_EMAIL);
console.log('  password: ', DEV_PASSWORD);
console.log('  org_id:   ', BI_ORG_ID);

// 1. 确保 BI org 存在
const orgCheck = await admin.from('bi_org_daily').select('org_id').eq('org_id', BI_ORG_ID).limit(1);
if (orgCheck.error) throw orgCheck.error;
if (!orgCheck.data?.length) {
  console.error(`✗ org ${BI_ORG_ID} 没有 BI 数据。是否同步脚本灌的是别的 org_id?`);
  process.exit(2);
}

// 2. 确保 supabase auth user 存在 (幂等: 已存在则查 id)
let userId;
const create = await admin.auth.admin.createUser({
  email: DEV_EMAIL,
  password: DEV_PASSWORD,
  email_confirm: true,
});
if (create.error) {
  // 已存在: 用 listUsers 找
  if (/already|exist|registered/i.test(create.error.message)) {
    let page = 1;
    while (true) {
      const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (list.error) throw list.error;
      const found = list.data.users.find((u) => u.email === DEV_EMAIL);
      if (found) { userId = found.id; break; }
      if (list.data.users.length < 200) break;
      page++;
    }
    if (!userId) throw new Error(`createUser said exists but listUsers can't find ${DEV_EMAIL}`);
    console.log('  auth user: exists', userId);
  } else {
    throw create.error;
  }
} else {
  userId = create.data.user.id;
  console.log('  auth user: created', userId);
}

// 3. 业务 user 表 upsert
const upUser = await admin.from('user').upsert({ id: userId, email: DEV_EMAIL, auth_provider: 'supabase' });
if (upUser.error) throw upUser.error;
console.log('  public.user: upserted');

// 4. member 表 upsert (user_id + org_id 复合唯一)
//    没有自然 upsert 入口 — 先查再插入,避免唯一约束冲突时报错。
const existing = await admin.from('member').select('id, role').eq('user_id', userId).eq('org_id', BI_ORG_ID).maybeSingle();
if (existing.error) throw existing.error;
if (existing.data) {
  console.log('  member: exists', existing.data.id, 'role:', existing.data.role);
} else {
  const ins = await admin.from('member').insert({ id: randomUUID(), user_id: userId, org_id: BI_ORG_ID, role: 'owner' });
  if (ins.error) throw ins.error;
  console.log('  member: inserted as owner');
}

console.log('\n✅ dev tester ready. Login with:');
console.log('   email:    ', DEV_EMAIL);
console.log('   password: ', DEV_PASSWORD);
