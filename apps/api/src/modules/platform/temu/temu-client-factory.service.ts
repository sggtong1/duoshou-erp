import { Injectable } from '@nestjs/common';
import { TemuClient } from '@duoshou/temu-sdk';
import { PrismaService } from '../../../infra/prisma.service';
import { sharedRedis } from '../../../infra/redis';
import { decrypt } from '../../../infra/crypto';

@Injectable()
export class TemuClientFactoryService {
  constructor(private prisma: PrismaService) {}

  async forShop(shopId: string): Promise<TemuClient> {
    const shop = await (this.prisma as any).shop.findUniqueOrThrow({
      where: { id: shopId },
      include: { creds: true },
    });
    const key = process.env.CREDS_ENCRYPTION_KEY;
    if (!key) throw new Error('CREDS_ENCRYPTION_KEY not set');

    const creds = shop.creds;
    const appKey = decrypt(Buffer.from(creds.appKeyEncrypted), key);
    const appSecret = decrypt(Buffer.from(creds.appSecretEncrypted), key);
    const accessToken = decrypt(Buffer.from(creds.accessTokenEncrypted), key);

    return new TemuClient(
      {
        appKey,
        appSecret,
        accessToken,
        region: shop.region as 'cn' | 'pa',
        shopId: shop.platformShopId,
      },
      { redis: sharedRedis(), qps: 5, burst: 5 },
    );
  }
}
