import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Queue, Worker } from 'bullmq';
import { makeRedisClient } from './redis';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.development' });

describe('queue infrastructure', () => {
  let queue: Queue;
  let worker: Worker;

  afterAll(async () => {
    await worker?.close();
    await queue?.close();
  });

  it('round-trips a job through a BullMQ queue', async () => {
    queue = new Queue('test-queue', { connection: makeRedisClient(), prefix: 'duoshou-test' });
    const processed: any[] = [];
    worker = new Worker(
      'test-queue',
      async (job) => { processed.push(job.data); return { echoed: job.data }; },
      { connection: makeRedisClient(), prefix: 'duoshou-test' },
    );
    await queue.add('echo', { hello: 'world' });
    // Wait for processing
    for (let i = 0; i < 20; i++) {
      if (processed.length > 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(processed).toHaveLength(1);
    expect(processed[0]).toEqual({ hello: 'world' });
  }, 30000);
});
