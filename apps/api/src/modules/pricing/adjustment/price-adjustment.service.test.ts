import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PriceAdjustmentService } from './price-adjustment.service';

describe('PriceAdjustmentService.listPlatformOrders', () => {
  it('queries full adjustment orders and normalizes rows', async () => {
    const prisma: any = {
      shop: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'shop-1',
          orgId: 'org-1',
          platform: 'temu',
          platformShopId: 'mall-1',
          displayName: 'Main shop',
          shopType: 'full',
          region: 'cn',
        }),
      },
    };
    const client = {
      call: vi.fn().mockResolvedValue({
        result: {
          total: 1,
          list: [{
            priceOrderSn: 'PO-1',
            status: 1,
            productName: 'Case',
            newSupplyPrice: '1234',
            priceCurrency: 'CNY',
            skuInfoItemList: [{ productSkuId: 101, price: 1000, spec: 'black' }],
          }],
        },
      }),
    };
    const svc = new PriceAdjustmentService(prisma, { forShop: vi.fn().mockResolvedValue(client) } as any);

    const res = await svc.listPlatformOrders('org-1', { shopId: 'shop-1' });

    expect(client.call).toHaveBeenCalledWith('bg.full.adjust.price.page.query', {
      pageNo: 1,
      pageSize: 20,
      status: 1,
    });
    expect(res.items[0]).toMatchObject({
      priceOrderSn: 'PO-1',
      shopName: 'Main shop',
      statusLabel: '待供应商确认',
      newSupplyPriceCents: 1234,
    });
    expect(res.items[0].skuInfo[0].productSkuId).toBe('101');
  });
});

describe('PriceAdjustmentService.batchReview', () => {
  it('uses full-managed approval payload', async () => {
    const prisma: any = {
      shop: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'shop-1',
          orgId: 'org-1',
          platform: 'temu',
          platformShopId: 'mall-1',
          shopType: 'full',
          region: 'cn',
        }),
      },
    };
    const client = { call: vi.fn().mockResolvedValue({ success: true, result: {} }) };
    const svc = new PriceAdjustmentService(prisma, { forShop: vi.fn().mockResolvedValue(client) } as any);

    const res = await svc.batchReview('org-1', { shopId: 'shop-1', result: 1, orderSns: ['PO-1'] });

    expect(client.call).toHaveBeenCalledWith('bg.full.adjust.price.batch.review', {
      adjustList: [{ result: 1, priceOrderSn: 'PO-1' }],
    });
    expect(res.results[0]).toMatchObject({ priceOrderSn: 'PO-1', ok: true });
  });

  it('rejects full-managed rejection because Temu only supports approval', async () => {
    const prisma: any = {
      shop: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'shop-1',
          orgId: 'org-1',
          platform: 'temu',
          platformShopId: 'mall-1',
          shopType: 'full',
          region: 'cn',
        }),
      },
    };
    const svc = new PriceAdjustmentService(prisma, { forShop: vi.fn() } as any);

    await expect(svc.batchReview('org-1', { shopId: 'shop-1', result: 2, orderSns: ['PO-1'] }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
