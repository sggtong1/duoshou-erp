import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Stable UUID for the local dev user when DEV_AUTH_BYPASS=1.
// tenant.resolveForUser auto-creates the org+member on first call, so this just
// needs to stay constant across restarts.
const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEV_USER_EMAIL = 'dev@local';

@Injectable()
export class AuthGuard implements CanActivate {
  private supabase: SupabaseClient | null = null;

  private client(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
      this.supabase = createClient(url, key, { auth: { persistSession: false } });
    }
    return this.supabase;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = auth.slice(7);

    // Dev bypass: when DEV_AUTH_BYPASS=1 and frontend sends `Bearer demo`/`dev`,
    // skip Supabase verification and inject a stable local user.
    if (process.env.DEV_AUTH_BYPASS === '1' && (token === 'demo' || token === 'dev')) {
      req.user = { id: DEV_USER_ID, email: DEV_USER_EMAIL };
      return true;
    }

    const { data, error } = await this.client().auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException(error?.message ?? 'Invalid token');
    }
    req.user = { id: data.user.id, email: data.user.email };
    return true;
  }
}
