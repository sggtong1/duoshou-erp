import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const makeCtx = (headers: any) => ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as any;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
  });

  it('rejects missing bearer', async () => {
    const guard = new AuthGuard();
    await expect(guard.canActivate(makeCtx({}))).rejects.toThrow(/bearer/i);
  });

  it('rejects wrong auth scheme', async () => {
    const guard = new AuthGuard();
    await expect(guard.canActivate(makeCtx({ authorization: 'Basic xxx' }))).rejects.toThrow(/bearer/i);
  });

  it('extracts user from valid token', async () => {
    const guard = new AuthGuard();
    // Mock the internal supabase client
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });
    (guard as any).supabase = { auth: { getUser: mockGetUser } };

    const req = { headers: { authorization: 'Bearer valid_token' } };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect((req as any).user).toEqual({ id: 'user-123', email: 'test@example.com' });
    expect(mockGetUser).toHaveBeenCalledWith('valid_token');
  });

  it('rejects on Supabase error', async () => {
    const guard = new AuthGuard();
    (guard as any).supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: {}, error: { message: 'expired' } }) },
    };
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer xxx' } }) }) } as any;
    await expect(guard.canActivate(ctx)).rejects.toThrow(/expired/);
  });
});
