/**
 * One-off probe: verify which marketing endpoint variant the PA shop's token
 * can access. Per Temu docs, activity.list.get is stored in CN region — try
 * both `.global` and no-suffix variants to see which returns data.
 *
 * Run: cd apps/api && pnpm exec ts-node scripts/probe-marketing-sync.ts
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma.service';
import { TemuClientFactoryService } from '../src/modules/platform/temu/temu-client-factory.service';

const ENDPOINTS = [
  // Non-global (CN-stored) variants
  'bg.marketing.activity.list.get',
  'bg.marketing.activity.detail.get',
  'bg.marketing.activity.session.list.get',
  'bg.marketing.activity.product.get',
  'bg.marketing.activity.enroll.list.get',
  // Global variants (kept for reference)
  'bg.marketing.activity.list.get.global',
  'bg.marketing.activity.enroll.list.get.global',
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService) as any;
  const clientFactory = app.get(TemuClientFactoryService);

  const shop = await prisma.shop.findFirst({
    where: { status: 'active', shopType: 'full', region: 'pa' },
    orderBy: { connectedAt: 'desc' },
  });
  if (!shop) {
    console.error('no active full PA shop found — connect one first');
    process.exit(2);
  }
  console.log(`shop: ${shop.id} (${shop.displayName ?? shop.platformShopId}) region=${shop.region}\n`);

  const client = await clientFactory.forShop(shop.id);

  for (const ep of ENDPOINTS) {
    process.stdout.write(`-- ${ep.padEnd(58)} `);
    try {
      const params: any = ep.includes('detail') ? { activityId: 'PROBE' } :
                         ep.includes('product') ? { activityId: 'PROBE', pageNo: 1, pageSize: 1 } :
                         ep.includes('session') ? { activityId: 'PROBE' } :
                         { pageNo: 1, pageSize: 5 };
      const res: any = await client.call(ep, params);
      const list = res?.activityList ?? res?.enrollList ?? res?.list ?? res?.sessionList ?? res?.productList ?? null;
      if (Array.isArray(list)) {
        console.log(`OK count=${list.length}${list.length > 0 ? ' keys=' + Object.keys(list[0]).sort().slice(0, 12).join(',') : ''}`);
        if (list.length > 0) {
          console.log('   sample:', JSON.stringify(list[0]).slice(0, 600));
        }
      } else {
        console.log(`OK (no list field) topKeys=${Object.keys(res ?? {}).slice(0, 8).join(',')}`);
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.log(`ERR ${msg.slice(0, 120)}`);
    }
  }

  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
