import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CREDS_ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/=]{44}$/, '32-byte base64 (44 chars)'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});
export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid env:', parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}
