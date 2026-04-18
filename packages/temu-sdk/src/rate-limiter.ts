import type { Redis } from 'ioredis';

export interface RateLimiterConfig {
  qps: number;
  burst: number;
}

export interface RateLimiter {
  acquire(key: string, tokens: number): Promise<void>;
}

const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local qps = tonumber(ARGV[2])
local burst = tonumber(ARGV[3])
local want = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_refill_ms')
local tokens = tonumber(data[1])
if tokens == nil then tokens = burst end
local last_refill = tonumber(data[2])
if last_refill == nil then last_refill = now_ms end

local elapsed = math.max(0, now_ms - last_refill)
local refilled = math.min(burst, tokens + (elapsed / 1000.0) * qps)

if refilled >= want then
  local remaining = refilled - want
  redis.call('HMSET', key, 'tokens', remaining, 'last_refill_ms', now_ms)
  redis.call('EXPIRE', key, 60)
  return {1, 0}
else
  local deficit = want - refilled
  local wait_ms = math.ceil((deficit / qps) * 1000)
  return {0, wait_ms}
end
`;

export function createRateLimiter(redis: Redis, cfg: RateLimiterConfig): RateLimiter {
  return {
    async acquire(key: string, tokens = 1): Promise<void> {
      for (;;) {
        const result = (await (redis as any).eval(
          LUA_TOKEN_BUCKET,
          1,
          `rl:${key}`,
          Date.now().toString(),
          cfg.qps.toString(),
          cfg.burst.toString(),
          tokens.toString(),
        )) as [number, number];
        const [ok, waitMs] = result;
        if (ok === 1) return;
        await new Promise((r) => setTimeout(r, waitMs));
      }
    },
  };
}
