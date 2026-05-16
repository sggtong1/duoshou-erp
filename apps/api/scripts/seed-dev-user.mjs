// 幂等 seed: 确保 AuthGuard 在 DEV_AUTH_BYPASS=1 + Bearer demo 模式下
// 注入的 dev 用户 (id = DEV_USER_ID 00000000-0000-4000-8000-000000000001)
// 在 user 表存在,并作为 owner 加入到 BI org (mini.duoshou 上的)。
//
// Usage:  cd apps/api && node scripts/seed-dev-user.mjs
//
// 跑多次安全,已存在就跳过。
//
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEV_USER_EMAIL = 'dev@local';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set in apps/api/.env.development');
  process.exit(2);
}

const client = new pg.Client(process.env.DATABASE_URL);
await client.connect();

console.log('=== seed dev tester (mini-postgres) ===');
console.log('  user id:  ', DEV_USER_ID);
console.log('  email:    ', DEV_USER_EMAIL);

try {
  // 1. 选 org_id, 优先级:
  //    a) agent_task 表行最多的 org (反映 Bearer demo / Chrome 扩展派单的实际工作 org)
  //    b) fallback: bi_org_daily 行最多的 org (BI 数据归属)
  //    c) fallback: organization 表里随便一个
  // 这个优先级避免把 DEV_USER_ID 关联到只有历史 BI 而无业务数据的 org。
  let orgId;
  let orgSource;
  const fromAgent = await client.query(`
    SELECT org_id FROM agent_task GROUP BY org_id ORDER BY count(*) DESC LIMIT 1
  `);
  if (fromAgent.rows.length) {
    orgId = fromAgent.rows[0].org_id;
    orgSource = 'agent_task';
  } else {
    const fromBi = await client.query(`
      SELECT org_id FROM bi_org_daily GROUP BY org_id ORDER BY count(*) DESC LIMIT 1
    `);
    if (fromBi.rows.length) {
      orgId = fromBi.rows[0].org_id;
      orgSource = 'bi_org_daily';
    } else {
      const anyOrg = await client.query(`SELECT id FROM organization ORDER BY created_at DESC LIMIT 1`);
      if (!anyOrg.rows.length) {
        console.error('✗ organization 表是空的, db 没数据? STOP');
        process.exit(3);
      }
      orgId = anyOrg.rows[0].id;
      orgSource = 'organization (fallback)';
    }
  }
  console.log(`  org_id:    ${orgId}  (from ${orgSource})`);

  // 2. 清理 DEV_USER_ID 关联到其它 org 的孤儿 member (history artifact)
  const cleanup = await client.query(
    `DELETE FROM member WHERE user_id = $1 AND org_id != $2 RETURNING id, org_id`,
    [DEV_USER_ID, orgId],
  );
  if (cleanup.rowCount > 0) {
    for (const r of cleanup.rows) {
      console.log(`  cleaned:  removed orphan member ${r.id} (was in org ${r.org_id})`);
    }
  }

  // 2. upsert public.user
  await client.query(
    `INSERT INTO "user" (id, email, auth_provider)
     VALUES ($1, $2, 'dev-bypass')
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [DEV_USER_ID, DEV_USER_EMAIL],
  );
  console.log('  user:     upserted');

  // 3. ensure member (user_id + org_id 是复合唯一)
  const existing = await client.query(
    `SELECT id, role FROM member WHERE user_id = $1 AND org_id = $2`,
    [DEV_USER_ID, orgId],
  );
  if (existing.rows.length) {
    console.log('  member:   exists', existing.rows[0].id, 'role:', existing.rows[0].role);
  } else {
    const memberId = randomUUID();
    await client.query(
      `INSERT INTO member (id, user_id, org_id, role) VALUES ($1, $2, $3, 'owner')`,
      [memberId, DEV_USER_ID, orgId],
    );
    console.log('  member:   inserted as owner', memberId);
  }

  console.log('\n✅ dev user ready. NestJS AuthGuard 接受 Authorization: Bearer demo');
} finally {
  await client.end();
}
