import { Global, Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { makeRedisClient } from './redis';

export const QUEUE_PREFIX = process.env.QUEUE_PREFIX ?? 'duoshou';

export const PUBLISH_QUEUE_TOKEN = 'PUBLISH_QUEUE';

const queueFactory = {
  provide: PUBLISH_QUEUE_TOKEN,
  useFactory: () => {
    return new Queue('product-publish', {
      connection: makeRedisClient(),
      prefix: QUEUE_PREFIX,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400 },
      },
    });
  },
};

@Global()
@Module({
  providers: [queueFactory],
  exports: [queueFactory],
})
export class QueueModule {}
