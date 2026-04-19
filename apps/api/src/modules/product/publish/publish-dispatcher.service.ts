import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../infra/prisma.service';
import { PUBLISH_QUEUE_TOKEN } from '../../../infra/queue.module';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';

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
    private clientFactory: TemuClientFactoryService,
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

    // Resolve category chain once using the first matching shop
    const categoryIdChain = await this.resolveCategoryChain(
      matching[0].id,
      template.temuCategoryPath ?? [],
      template.temuCategoryId,
    );

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
            categoryIdChain,
          },
          opts: { jobId: it.idempotencyKey },
        })),
      );

      return job;
    });
  }

  /**
   * Resolve a full numeric category id chain by traversing the Temu category tree
   * level-by-level using the path names stored on the template.
   *
   * For PA shops, Temu requires cat1Id..cat10Id (the full breadcrumb chain).
   * The template only stores `temuCategoryPath` (array of names) and `temuCategoryId`
   * (leaf id), so we traverse the tree to collect each level's numeric id.
   */
  private async resolveCategoryChain(
    shopId: string,
    pathNames: string[],
    leafCatId: bigint | number,
  ): Promise<number[]> {
    if (!pathNames?.length) {
      // Fallback: just use leaf id as single-element chain
      return [Number(leafCatId)];
    }

    const client = await this.clientFactory.forShop(shopId);
    const chain: number[] = [];
    let currentParent = 0;

    for (const name of pathNames) {
      const res: any = await client.call('bg.goods.cats.get', { parentCatId: currentParent });
      const list: any[] = res?.categoryDTOList ?? res?.goodsCatsList ?? res?.list ?? [];
      const found = list.find(
        (c: any) => (c.catName ?? c.catEnName ?? '') === name,
      );
      if (!found) {
        throw new Error(`Category step '${name}' not found under parent ${currentParent}`);
      }
      chain.push(Number(found.catId));
      currentParent = Number(found.catId);
    }

    // Verify the last id matches the leaf stored on the template
    if (chain.length > 0 && chain[chain.length - 1] !== Number(leafCatId)) {
      throw new Error(
        `Category chain last id ${chain[chain.length - 1]} != leaf ${leafCatId}`,
      );
    }

    return chain;
  }
}
