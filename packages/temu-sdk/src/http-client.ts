import { sign } from './signing';
import { withRetry } from './retry-policy';

// Gateway URLs verified from docs/references/temu/195__开发者文档_开发指南_分区说明.md
// and docs/references/temu/197__开发者文档_开发指南_基本信息.md:
//   CN: https://openapi.kuajingmaihuo.com  (接口地址: .../openapi/router)
//   PA: https://openapi-b-partner.temu.com  (接口地址: .../openapi/router)
// NOTE: plan assumed PA = openapi-b-global.temu.com — that is the GLOBAL region gateway.
//       PA gateway is openapi-b-partner.temu.com per docs.
const GATEWAY_URLS: Record<'cn' | 'pa', string> = {
  cn: 'https://openapi.kuajingmaihuo.com',
  pa: 'https://openapi-b-partner.temu.com',
};

export interface TemuCallContext {
  appKey: string;
  appSecret: string;
  accessToken: string;
  region: 'cn' | 'pa';
  shopId: string;
}

export interface TemuMethodSpec {
  interfaceType: string;
  region: string;
  requestUrl: string;
}

export class TemuApiError extends Error {
  constructor(public errorCode: number, message: string, public rawBody?: unknown) {
    super(`Temu API ${errorCode}: ${message}`);
    this.name = 'TemuApiError';
  }
}

export async function callTemuApi<Req extends object, Res>(
  ctx: TemuCallContext,
  spec: TemuMethodSpec,
  req: Req,
): Promise<Res> {
  return withRetry(async () => {
    const body: Record<string, unknown> = {
      type: spec.interfaceType,
      app_key: ctx.appKey,
      access_token: ctx.accessToken,
      data_type: 'JSON',
      timestamp: Math.floor(Date.now() / 1000).toString(),
      version: 'V1',
      ...(req as object),
    };
    body.sign = sign(body, ctx.appSecret);

    const gatewayRegion = (ctx.region === 'pa' ? 'pa' : 'cn') as 'cn' | 'pa';
    const url = GATEWAY_URLS[gatewayRegion] + spec.requestUrl;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new TemuApiError(resp.status, `HTTP ${resp.status}`, await resp.text());
    }
    const json = (await resp.json()) as {
      success: boolean;
      errorCode?: number;
      errorMsg?: string;
      result?: Res;
    };
    if (!json.success) {
      const err = new TemuApiError(json.errorCode ?? -1, json.errorMsg ?? 'unknown', json);
      (err as any).errorCode = json.errorCode;
      throw err;
    }
    return json.result as Res;
  });
}
