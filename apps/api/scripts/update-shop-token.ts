/**
 * One-off: update access_token for the most recently connected active full
 * PA shop. Re-encrypts and rewrites ShopCredentials.accessTokenEncrypted.
 *
 * Usage: cd apps/api && pnpm exec ts-node --transpile-only \
 *           scripts/update-shop-token.ts <new_access_token>
 */
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { encrypt } from '../src/infra/crypto';

async function main() {
  const newToken = process.argv[2];
  if (!newToken) {
    console.error('usage: update-shop-token.ts <new_access_token>');
    process.exit(1);
  }
  const key = process.env.CREDS_ENCRYPTION_KEY;
  if (!key) {
    console.error('CREDS_ENCRYPTION_KEY not set');
    process.exit(2);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any) as any;
  const shop = await prisma.shop.findFirst({
    where: { status: 'active', shopType: 'full', region: 'pa' },
    orderBy: { connectedAt: 'desc' },
    include: { creds: true },
  });
  if (!shop) {
    console.error('no active full PA shop found');
    process.exit(3);
  }
  console.log(`updating token for shop ${shop.id} (${shop.displayName ?? shop.platformShopId})`);

  const updated = await prisma.shopCredentials.update({
    where: { id: shop.credsVaultRef },
    data: { accessTokenEncrypted: encrypt(newToken, key) },
  });
  console.log(`ShopCredentials.id=${updated.id} updated. token length=${newToken.length}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
