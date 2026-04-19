import Redis from 'ioredis';

let _shared: Redis | null = null;

export function sharedRedis(): Redis {
  if (_shared) return _shared;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is not set');
  _shared = new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: null,  // required by BullMQ
    enableReadyCheck: false,
  });
  _shared.on('error', (e) => console.error('[redis] error', e.message));
  return _shared;
}

export function makeRedisClient(): Redis {
  // BullMQ Worker + Queue each need their own dedicated connection.
  const url = process.env.REDIS_URL!;
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
