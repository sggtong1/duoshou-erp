import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { TemuClient, methods, type TemuCallContext } from '@duoshou/temu-sdk';
import { PrismaService } from '../../infra/prisma.service';
import { encrypt } from '../../infra/crypto';
import type { ConnectShopInput } from './shop.dto';

/** Shim the generated method. If codegen hasn't run, this errors at runtime, not compile time. */
const bgMallInfoGet: (ctx: TemuCallContext, req: any) => Promise<any> = (methods as any).bgMallInfoGet;

@Injectable()
export class ShopService {
  private redis: Redis;

  constructor(private prisma: PrismaService) {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true });
  }

  async connect(orgId: string, input: ConnectShopInput) {
    // 1. Validate credentials via bg.mall.info.get (no rate-limiting for first-time connect,
    //    shop_id isn't known yet).
    const ctx: TemuCallContext = {
      appKey: input.appKey,
      appSecret: input.appSecret,
      accessToken: input.accessToken,
      region: input.region,
      shopId: 'pending',
    };

    // Credential check: bg.mall.info.get returns { semiManagedMall, isThriftStore }.
    // It doesn't expose shop_id but throws on invalid credentials, so we use it
    // purely as a validity probe. The caller supplies platformShopId (every
    // Temu merchant knows their own id from the seller center).
    let mallInfo: any;
    try {
      mallInfo = await bgMallInfoGet(ctx, {} as any);
    } catch (e: any) {
      throw new BadRequestException(`Temu credential validation failed: ${e.message ?? e}`);
    }

    // Cross-check the declared shopType matches what Temu reports
    const reportedSemi = !!mallInfo?.semiManagedMall;
    if (reportedSemi && input.shopType !== 'semi') {
      throw new BadRequestException(`Shop type mismatch: Temu reports semi-managed, you declared '${input.shopType}'`);
    }
    if (!reportedSemi && input.shopType !== 'full') {
      throw new BadRequestException(`Shop type mismatch: Temu reports full-managed, you declared '${input.shopType}'`);
    }

    const platformShopId = input.platformShopId;

    // 2. Encrypt and persist credentials
    const key = process.env.CREDS_ENCRYPTION_KEY;
    if (!key) throw new Error('CREDS_ENCRYPTION_KEY is not set');

    // Prisma Bytes requires Uint8Array<ArrayBuffer>; Node Buffer is
    // Uint8Array<ArrayBufferLike> (TS 5.7+ generic distinguishes these).
    // Allocate a fresh ArrayBuffer, copy bytes, and return with the narrowed
    // generic type.
    const toBytes = (buf: Buffer): Uint8Array<ArrayBuffer> => {
      const ab = new ArrayBuffer(buf.length);
      const view = new Uint8Array(ab);
      view.set(buf);
      return view;
    };

    const creds = await this.prisma.shopCredentials.create({
      data: {
        appKeyEncrypted: toBytes(encrypt(input.appKey, key)),
        appSecretEncrypted: toBytes(encrypt(input.appSecret, key)),
        accessTokenEncrypted: toBytes(encrypt(input.accessToken, key)),
      },
    });

    // 3. Upsert Shop
    const existing = await this.prisma.shop.findUnique({
      where: {
        orgId_platform_platformShopId: {
          orgId,
          platform: 'temu',
          platformShopId,
        },
      },
    });

    if (existing) {
      // Update: swap credential ref + display name + re-activate
      const updated = await this.prisma.shop.update({
        where: { id: existing.id },
        data: {
          credsVaultRef: creds.id,
          displayName: input.displayName ?? existing.displayName,
          status: 'active',
        },
      });
      // Delete orphaned previous credentials row
      await this.prisma.shopCredentials.delete({ where: { id: existing.credsVaultRef } }).catch(() => {});
      return updated;
    }

    return this.prisma.shop.create({
      data: {
        orgId,
        platform: 'temu',
        platformShopId,
        shopType: input.shopType,
        region: input.region,
        displayName: input.displayName,
        credsVaultRef: creds.id,
      },
    });
  }

  async list(orgId: string) {
    return this.prisma.shop.findMany({
      where: { orgId },
      orderBy: { connectedAt: 'desc' },
    });
  }
}
