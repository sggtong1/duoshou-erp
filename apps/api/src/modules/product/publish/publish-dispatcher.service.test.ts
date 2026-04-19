import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublishDispatcherService } from './publish-dispatcher.service';

/** A TemuClient stub whose call() handles bg.goods.cats.get traversal. */
function makeTemuClientStub(categoryTree: Record<number, Array<{ catId: number; catName: string }>>) {
  return {
    call: vi.fn(async (method: string, params: any) => {
      if (method === 'bg.goods.cats.get') {
        const parentCatId = Number(params.parentCatId ?? 0);
        return { categoryDTOList: categoryTree[parentCatId] ?? [] };
      }
      return {};
    }),
  };
}

// A two-level tree: root 0 → [{ catId:100, catName:'Home' }] → [{ catId:200, catName:'Kitchen' }]
const defaultTree = {
  0: [{ catId: 100, catName: 'Home' }],
  100: [{ catId: 200, catName: 'Kitchen' }],
};

describe('PublishDispatcherService.dispatch', () => {
  let prisma: any, queue: any, clientFactory: any;
  beforeEach(() => {
    prisma = {
      productTemplate: { findFirst: vi.fn() },
      shop: { findMany: vi.fn() },
      bulkJob: { create: vi.fn() },
      bulkJobItem: { createMany: vi.fn(), findMany: vi.fn() },
      $transaction: vi.fn().mockImplementation(async (fn) => fn(prisma)),
    };
    queue = { add: vi.fn(), addBulk: vi.fn() };
    clientFactory = {
      forShop: vi.fn().mockResolvedValue(makeTemuClientStub(defaultTree)),
    };
  });

  function makeSvc() {
    return new PublishDispatcherService(prisma, queue, clientFactory);
  }

  it('creates BulkJob + one BulkJobItem per matching shop, enqueues them', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1', orgId: 'org-1', shopTypeTarget: 'full',
      temuCategoryPath: ['Home', 'Kitchen'], temuCategoryId: 200n,
    });
    prisma.shop.findMany.mockResolvedValue([
      { id: 'shop-1', orgId: 'org-1', shopType: 'full' },
      { id: 'shop-2', orgId: 'org-1', shopType: 'full' },
    ]);
    prisma.bulkJob.create.mockResolvedValue({ id: 'job-1' });
    prisma.bulkJobItem.createMany.mockResolvedValue({ count: 2 });
    prisma.bulkJobItem.findMany.mockResolvedValue([
      { id: 'item-1', shopId: 'shop-1', idempotencyKey: 'k1' },
      { id: 'item-2', shopId: 'shop-2', idempotencyKey: 'k2' },
    ]);

    const svc = makeSvc();
    const job = await svc.dispatch('org-1', 'tpl-1', ['shop-1', 'shop-2'], {});
    expect(job.id).toBe('job-1');
    expect(prisma.bulkJob.create).toHaveBeenCalled();
    expect(prisma.bulkJobItem.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(queue.addBulk).toHaveBeenCalled();
    const enqueued = queue.addBulk.mock.calls[0][0];
    expect(enqueued).toHaveLength(2);
    expect(enqueued[0].name).toBe('publish-item');
  });

  it('includes resolved categoryIdChain in each enqueued job', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1', orgId: 'org-1', shopTypeTarget: 'full',
      temuCategoryPath: ['Home', 'Kitchen'], temuCategoryId: 200n,
    });
    prisma.shop.findMany.mockResolvedValue([
      { id: 'shop-1', orgId: 'org-1', shopType: 'full' },
    ]);
    prisma.bulkJob.create.mockResolvedValue({ id: 'job-1' });
    prisma.bulkJobItem.createMany.mockResolvedValue({ count: 1 });
    prisma.bulkJobItem.findMany.mockResolvedValue([
      { id: 'item-1', shopId: 'shop-1', idempotencyKey: 'k1' },
    ]);

    const svc = makeSvc();
    await svc.dispatch('org-1', 'tpl-1', ['shop-1'], {});
    const enqueued = queue.addBulk.mock.calls[0][0];
    expect(enqueued[0].data.categoryIdChain).toEqual([100, 200]);
  });

  it('filters out shops whose shopType does not match template', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1', orgId: 'org-1', shopTypeTarget: 'full',
      temuCategoryPath: ['Home', 'Kitchen'], temuCategoryId: 200n,
    });
    prisma.shop.findMany.mockResolvedValue([
      { id: 'shop-1', orgId: 'org-1', shopType: 'full' },
      { id: 'shop-2', orgId: 'org-1', shopType: 'semi' },
    ]);
    prisma.bulkJob.create.mockResolvedValue({ id: 'job-1' });
    prisma.bulkJobItem.createMany.mockResolvedValue({ count: 1 });
    prisma.bulkJobItem.findMany.mockResolvedValue([
      { id: 'item-1', shopId: 'shop-1', idempotencyKey: 'k1' },
    ]);

    const svc = makeSvc();
    await svc.dispatch('org-1', 'tpl-1', ['shop-1', 'shop-2'], {});
    const enqueued = queue.addBulk.mock.calls[0][0];
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0].data.shopId).toBe('shop-1');
  });

  it('throws NotFound if template does not belong to org', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue(null);
    const svc = makeSvc();
    await expect(svc.dispatch('org-1', 'bad', ['shop-1'], {})).rejects.toThrow(/not found/i);
  });

  it('throws when no shops match template shop-type', async () => {
    prisma.productTemplate.findFirst.mockResolvedValue({
      id: 'tpl-1', orgId: 'org-1', shopTypeTarget: 'full',
      temuCategoryPath: ['Home', 'Kitchen'], temuCategoryId: 200n,
    });
    prisma.shop.findMany.mockResolvedValue([
      { id: 'shop-2', orgId: 'org-1', shopType: 'semi' },
    ]);
    const svc = makeSvc();
    await expect(svc.dispatch('org-1', 'tpl-1', ['shop-2'], {})).rejects.toThrow(/no shops match/i);
  });
});
