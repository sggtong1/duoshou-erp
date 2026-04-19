import pg from 'pg';
const { Client } = pg;

const PROJECT_REF = 'kivdxnlpjtzgmbhzusrd';
const PASSWORD = 'OL6892364sg%29';

// Try (cluster, region) combinations
const COMBOS = [];
for (const cluster of ['aws-0', 'aws-1', 'aws-2']) {
  for (const region of ['ap-southeast-1', 'ap-northeast-1', 'ap-southeast-2', 'us-east-1', 'us-east-2', 'us-west-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'ap-south-1']) {
    COMBOS.push({ cluster, region });
  }
}

for (const { cluster, region } of COMBOS) {
  for (const port of [6543]) {  // try transaction pooler only first
    const url = `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@${cluster}-${region}.pooler.supabase.com:${port}/postgres`;
    process.stdout.write(`[${cluster}-${region}:${port}] `);
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 5000, query_timeout: 5000, connectionTimeoutMillis: 5000 });
    try {
      await c.connect();
      const r = await c.query('select 1 as ok');
      console.log(`✅ OK`);
      await c.end();
      console.log(`\n👉 USE THIS DATABASE_URL:\npostgresql://postgres.${PROJECT_REF}:${PASSWORD}@${cluster}-${region}.pooler.supabase.com:${port}/postgres\n`);
      process.exit(0);
    } catch (e) {
      console.log(`✗ ${e.message?.slice(0, 80)}`);
      try { await c.end(); } catch {}
    }
  }
}
console.log('\nNo pooler URL worked');
