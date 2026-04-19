import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../infra/prisma.service';
import { PUBLISH_QUEUE_TOKEN } from '../../../infra/queue.module';

export interface DispatchOptions {
  priceCentsOverrides?: Record<string, number>;
  semiSitesByShop?: Record<string, number[]>;
  freightTemplatesByShop?: Record<string, string>;
}

@Injectable()
export class PublishDispatcherService {
  constructor(
    private prisma: PrismaService,
    @Inject(PUBLISH_QUEUE_TOKEN) private queue: Queue,
  ) {}

  async dispatch(
    orgId: string,
    templateId: string,
    shopIds: string[],
    opts: DispatchOptions,
  ) {
    const template = await (this.prisma as any).productTemplate.findFirst({
      where: { id: templateId, orgId },
    });
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    const shops = await (this.prisma as any).shop.findMany({
      where: { id: { in: shopIds }, orgId },
    });

    const matching = shops.filter((s: any) => s.shopType === template.shopTypeTarget);
    if (matching.length === 0) {
      throw new Error('No shops match the template shop-type target');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const job = await tx.bulkJob.create({
        data: {
          orgId,
          type: 'product_publish',
          templateId,
          total: matching.length,
          status: 'running',
          startedAt: new Date(),
        },
      });

      const items = matching.map((s: any) => ({
        jobId: job.id,
        shopId: s.id,
        idempotencyKey: crypto
          .createHash('sha256')
          .update(`${orgId}:${job.id}:${templateId}:${s.id}:product_publish`)
          .digest('hex'),
      }));
      await tx.bulkJobItem.createMany({ data: items });

      const persistedItems = await tx.bulkJobItem.findMany({ where: { jobId: job.id } });

      await this.queue.addBulk(
        persistedItems.map((it: any) => ({
          name: 'publish-item',
          data: {
            jobId: job.id,
            itemId: it.id,
            orgId,
            templateId,
            shopId: it.shopId,
            priceCentsOverride: opts.priceCentsOverrides?.[it.shopId] ?? null,
            semiSiteIds: opts.semiSitesByShop?.[it.shopId] ?? null,
            freightTemplateId: opts.freightTemplatesByShop?.[it.shopId] ?? null,
          },
          opts: { jobId: it.idempotencyKey },
        })),
      );

      return job;
    });
  }
}
