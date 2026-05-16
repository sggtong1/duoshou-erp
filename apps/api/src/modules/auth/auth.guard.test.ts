import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const makeCtx = (headers: any) => {
    const req: any = { headers };
    return {
      ctx: { switchToHttp: () => ({ getRequest: () => req }) } as any,
      req,
    };
  };

  const originalBypass = process.env.DEV_AUTH_BYPASS;
  beforeEach(() => {
    delete process.env.DEV_AUTH_BYPASS;
  });
  afterEach(() => {
    if (originalBypass === undefined) delete process.env.DEV_AUTH_BYPASS;
    else process.env.DEV_AUTH_BYPASS = originalBypass;
  });

  it('rejects missing bearer', async () => {
    const guard = new AuthGuard();
    const { ctx } = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(/bearer/i);
  });

  it('rejects wrong auth scheme', async () => {
    const guard = new AuthGuard();
    const { ctx } = makeCtx({ authorization: 'Basic xxx' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/bearer/i);
  });

  it('rejects when DEV_AUTH_BYPASS not set even with Bearer demo', async () => {
    const guard = new AuthGuard();
    const { ctx } = makeCtx({ authorization: 'Bearer demo' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/not configured/i);
  });

  it('accepts Bearer demo when DEV_AUTH_BYPASS=1', async () => {
    process.env.DEV_AUTH_BYPASS = '1';
    const guard = new AuthGuard();
    const { ctx, req } = makeCtx({ authorization: 'Bearer demo' });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(req.user).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'dev@local',
    });
  });

  it('accepts Bearer dev when DEV_AUTH_BYPASS=1', async () => {
    process.env.DEV_AUTH_BYPASS = '1';
    const guard = new AuthGuard();
    const { ctx, req } = makeCtx({ authorization: 'Bearer dev' });
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(req.user.id).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('rejects non-demo/dev tokens even when DEV_AUTH_BYPASS=1', async () => {
    process.env.DEV_AUTH_BYPASS = '1';
    const guard = new AuthGuard();
    const { ctx } = makeCtx({ authorization: 'Bearer some-random-jwt' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/not configured/i);
  });
});
