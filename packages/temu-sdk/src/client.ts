import type { Redis } from 'ioredis';
import { callTemuApi, type TemuCallContext, type TemuMethodSpec, TemuApiError } from './http-client';
import { createRateLimiter, type RateLimiter } from './rate-limiter';

// Lazy import so this file doesn't fail to compile when generated/ is absent
// (e.g. in a fresh checkout before codegen runs).
// eslint-disable-next-line @typescript-eslint/no-var-requires
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore generated at build time
import { TEMU_API_REGISTRY } from './generated/methods';

export interface TemuClientOptions {
  redis: Redis;
  qps?: number;
  burst?: number;
}

/**
 * TemuClient composes rate limiting, signing, retry, and HTTP transport for a single shop's context.
 *
 * Usage:
 * ```
 * const client = new TemuClient({ appKey, appSecret, accessToken, region, shopId }, { redis });
 * const info = await client.call<{}, MallInfoGetRes>('bg.mall.info.get', {});
 * // or via generated methods:
 * import { methods } from '@duoshou/temu-sdk';
 * const info2 = await methods.bgMallInfoGet(client.ctx, {});
 * ```
 *
 * Call through `call()` whenever possible — it applies per-shop rate limiting.
 * Calling generated methods directly bypasses rate limiting (used only for
 * one-off validation flows like initial credential-check).
 */
export class TemuClient {
  private limiter: RateLimiter;

  constructor(
    public readonly ctx: TemuCallContext,
    opts: TemuClientOptions,
  ) {
    this.limiter = createRateLimiter(opts.redis, {
      qps: opts.qps ?? 5,
      burst: opts.burst ?? 5,
    });
  }

  async call<Req extends object, Res>(
    interfaceType: string,
    req: Req,
  ): Promise<Res> {
    const reg = (TEMU_API_REGISTRY as Record<string, { region: 'cn' | 'pa'; requestUrl: string; interfaceName: string }>)[interfaceType];
    if (!reg) throw new Error(`Unknown Temu interface: ${interfaceType}`);
    await this.limiter.acquire(`temu:${this.ctx.shopId}`, 1);
    return callTemuApi<Req, Res>(this.ctx, {
      interfaceType,
      region: reg.region,
      requestUrl: reg.requestUrl,
    }, req);
  }
}
