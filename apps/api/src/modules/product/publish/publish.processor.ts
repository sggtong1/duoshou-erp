import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { makeRedisClient } from '../../../infra/redis';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { buildTemuGoodsAddPayload } from './temu-goods-payload-builder';

@Injectable()
export class PublishProcessor implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger(PublishProcessor.name);
  private worker: Worker | null = null;

  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  onModuleInit() {
    const concurrency = Number(process.env.PUBLISH_CONCURRENCY ?? 4);
    this.worker = new Worker(
      'product-publish',
      async (job: Job) => this.handle(job),
      {
        connection: makeRedisClient(),
        prefix: process.env.QUEUE_PREFIX ?? 'duoshou',
        concurrency,
      },
    );
    this.worker.on('completed', (j) => this.logger.log(`job ${j.id} completed`));
    this.worker.on('failed', (j, e) => this.logger.error(`job ${j?.id} failed: ${e.message}`));
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handle(job: Job) {
    const {
      itemId,
      shopId,
      templateId,
      orgId,
      priceCentsOverride,
      semiSiteIds,
      freightTemplateId,
      categoryIdChain,
    } = job.data;

    await (this.prisma as any).bulkJobItem.update({
      where: { id: itemId },
      data: { status: 'running' },
    });

    try {
      const template = await (this.prisma as any).productTemplate.findFirst({
        where: { id: templateId, orgId },
      });
      if (!template) throw new Error(`Template ${templateId} missing`);

      const shop = await (this.prisma as any).shop.findUnique({ where: { id: shopId } });
      if (!shop) throw new Error(`Shop ${shopId} missing`);

      const payload = buildTemuGoodsAddPayload(
        template,
        {
          shopType: shop.shopType,
          region: shop.region,
          siteIds: semiSiteIds ?? undefined,
          freightTemplateId: freightTemplateId ?? undefined,
        },
        {
          priceCentsOverride: priceCentsOverride ?? null,
          categoryIdChain: categoryIdChain ?? [],
        },
      );

      const client = await this.clientFactory.forShop(shopId);
      const interfaceType = shop.region === 'pa' ? 'bg.glo.goods.add' : 'bg.goods.add';
      const res: any = await client.call(interfaceType, payload);

      const platformProductId = String(res?.productId ?? res?.spuId ?? '');
      if (!platformProductId) {
        throw new Error(`Temu ${interfaceType} returned no productId: ${JSON.stringify(res)}`);
      }

      const product = await (this.prisma as any).product.create({
        data: {
          orgId,
          shopId,
          templateId,
          platformProductId,
          title: template.name,
          status: res?.status ?? 'active',
          commonAttrs: template.attributes,
          platformSpecific: res,
        },
      });

      await this.prisma.$transaction([
        (this.prisma as any).bulkJobItem.update({
          where: { id: itemId },
          data: { status: 'succeeded', resultProductId: product.id },
        }),
        (this.prisma as any).bulkJob.update({
          where: { id: job.data.jobId },
          data: { succeeded: { increment: 1 } },
        }),
      ]);

      await this.maybeFinishJob(job.data.jobId);
    } catch (err: any) {
      this.logger.error(`item ${itemId} failed: ${err.message}`);
      await this.prisma.$transaction([
        (this.prisma as any).bulkJobItem.update({
          where: { id: itemId },
          data: {
            status: 'failed',
            error: {
              message: err.message,
              stack: err.stack?.slice(0, 2000),
              errorCode: err.errorCode ?? null,
            },
          },
        }),
        (this.prisma as any).bulkJob.update({
          where: { id: job.data.jobId },
          data: { failed: { increment: 1 } },
        }),
      ]);
      await this.maybeFinishJob(job.data.jobId);
      throw err;  // let BullMQ honour attempts=3
    }
  }

  private async maybeFinishJob(jobId: string) {
    const job = await (this.prisma as any).bulkJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    if (job.succeeded + job.failed >= job.total) {
      await (this.prisma as any).bulkJob.update({
        where: { id: jobId },
        data: {
          status: job.failed === 0 ? 'completed' : job.succeeded === 0 ? 'failed' : 'completed',
          completedAt: new Date(),
        },
      });
    }
  }
}
