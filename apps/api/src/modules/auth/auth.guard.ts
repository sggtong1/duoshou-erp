import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

// Stable UUID for the local dev user when DEV_AUTH_BYPASS=1.
// tenant.resolveForUser() auto-creates the org+member on first call,
// so this just needs to stay constant across restarts.
const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEV_USER_EMAIL = 'dev@local';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = auth.slice(7);

    if (process.env.DEV_AUTH_BYPASS === '1' && (token === 'demo' || token === 'dev')) {
      req.user = { id: DEV_USER_ID, email: DEV_USER_EMAIL };
      return true;
    }

    // Supabase Auth removed during mini-postgres cutover 2026-05-16.
    // Future real-user auth (JWT verification etc.) plugs in here.
    throw new UnauthorizedException('Auth not configured');
  }
}
