import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceReviewService } from './price-review.service';

describe('PriceReviewService.list', () => {
  let prisma: any;
  beforeEach(() => {
    prisma = {
      priceReview: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([
          { id: 'r1', shopId: 's1', status: 'pending', currentPriceCents: 1000n, suggestedPriceCents: 900n },
          { id: 'r2', shopId: 's1', status: 'pending', currentPriceCents: 500n, suggestedPriceCents: 450n },
        ]),
      },
    };
  });

  it('scopes by orgId', async () => {
    const svc = new PriceReviewService(prisma, {} as any);
    const r = await svc.list('org-1', {});
    expect(prisma.priceReview.findMany.mock.calls[0][0].where.orgId).toBe('org-1');
    expect(r.items).toHaveLength(2);
    expect(typeof r.items[0].currentPriceCents).toBe('number');
  });

  it('applies shopId filter', async () => {
    const svc = new PriceReviewService(prisma, {} as any);
    await svc.list('org-1', { shopId: 'shop-1' });
    expect(prisma.priceReview.findMany.mock.calls[0][0].where.shopId).toBe('shop-1');
  });

  it('serializes BigInt fields as numbers', async () => {
    const svc = new PriceReviewService(prisma, {} as any);
    const r = await svc.list('org-1', {});
    for (const item of r.items) {
      expect(typeof item.currentPriceCents).toBe('number');
      expect(typeof item.suggestedPriceCents).toBe('number');
    }
  });
});

describe('PriceReviewService.batchConfirm', () => {
  let prisma: any, clientFactory: any, mockClient: any;
  beforeEach(() => {
    mockClient = { call: vi.fn().mockResolvedValue({ success: true }) };
    clientFactory = { forShop: vi.fn().mockResolvedValue(mockClient) };
    prisma = {
      priceReview: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'r1', orgId: 'org-1', shopId: 'shop-1', platformOrderId: '1001', shop: { shopType: 'full', region: 'cn' } },
        ]),
        update: vi.fn(),
      },
    };
  });

  it('calls confirm API per review and updates status', async () => {
    const svc = new PriceReviewService(prisma, clientFactory);
    await svc.batchConfirm('org-1', ['r1']);
    expect(mockClient.call).toHaveBeenCalledWith('bg.price.review.confirm', { orderId: 1001 });
    expect(prisma.priceReview.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({ status: 'confirmed' }),
    });
  });
});
