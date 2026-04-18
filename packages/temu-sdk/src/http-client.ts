// Minimal stub for codegen output to compile. Full implementation in W0-T6.

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

export async function callTemuApi<Req, Res>(
  _ctx: TemuCallContext,
  _spec: TemuMethodSpec,
  _req: Req,
): Promise<Res> {
  throw new Error('callTemuApi not implemented yet — see W0-T6');
}
