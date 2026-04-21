import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkuSnapshotSyncService } from './sku-snapshot-sync.service';

describe('SkuSnapshotSyncService.syncShop', () => {
  let prisma: any, clientFactory: any, mockClient: any;

  beforeEach(() => {
    mockClient = {
      call: vi.fn().mockResolvedValue({
        total: 1,
        subOrderList: [{
          productName: 'Test SPU',
          skuQuantityDetailList: [
            {
              productSkuId: 11901729009,
              skuExtCode: '11',
              className: '灰色-iPhone 14 Pro Max',
              todaySaleVolume: 3,
              lastSevenDaysSaleVolume: 15,
              lastThirtyDaysSaleVolume: 60,
              totalSaleVolume: 120,
              supplierPrice: null,
              inventoryNumInfo: {
                warehouseInventoryNum: 30,
                waitReceiveNum: 5,
                waitOnShelfNum: 0,
                waitDeliveryInventoryNum: 2,
              },
            },
          ],
        }],
      }),
    };
    clientFactory = { forShop: vi.fn().mockResolvedValue(mockClient) };
    prisma = {
      shop: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'shop-1', orgId: 'org-1', shopType: 'full', region: 'pa',
          status: 'active', displayName: 'Test',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      shopSkuSnapshot: {
        upsert: vi.fn(),
      },
    };
  });

  it('展开 subOrderList[i].skuQuantityDetailList,每个 SKU upsert 一次', async () => {
    const svc = new SkuSnapshotSyncService(prisma, clientFactory);
    const touched = await svc.syncShop('shop-1');
    expect(touched).toBe(1);
    expect(prisma.shopSkuSnapshot.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.shopSkuSnapshot.upsert.mock.calls[0][0];
    expect(call.where.shopId_platformSkuId).toEqual({
      shopId: 'shop-1',
      platformSkuId: '11901729009',
    });
    expect(call.create.todaySaleVolume).toBe(3);
    expect(call.create.sales7dVolume).toBe(15);
    expect(call.create.sales30dVolume).toBe(60);
    expect(call.create.totalSaleVolume).toBe(120);
    expect(call.create.warehouseQty).toBe(30);
    expect(call.create.waitReceiveQty).toBe(5);
    expect(call.create.avgDailySales).toBe(2);      // 60/30
    expect(call.create.daysRemaining).toBe(15);     // 30/2
    expect(call.create.supplierPriceCents).toBeNull();
  });

  it('半托店跳过(shopType !== full)', async () => {
    prisma.shop.findUnique = vi.fn().mockResolvedValue({
      id: 'shop-s1', orgId: 'org-1', shopType: 'semi', region: 'pa', status: 'active',
    });
    const svc = new SkuSnapshotSyncService(prisma, clientFactory);
    const touched = await svc.syncShop('shop-s1');
    expect(touched).toBe(0);
    expect(prisma.shopSkuSnapshot.upsert).not.toHaveBeenCalled();
  });

  it('supplierPrice 为正数时换算 cents', async () => {
    mockClient.call = vi.fn().mockResolvedValue({
      total: 1,
      subOrderList: [{
        productName: 'X',
        skuQuantityDetailList: [{
          productSkuId: 1,
          todaySaleVolume: 0,
          lastSevenDaysSaleVolume: 0,
          lastThirtyDaysSaleVolume: 0,
          totalSaleVolume: 0,
          supplierPrice: 12.99,
          inventoryNumInfo: { warehouseInventoryNum: 0 },
        }],
      }],
    });
    const svc = new SkuSnapshotSyncService(prisma, clientFactory);
    await svc.syncShop('shop-1');
    const call = prisma.shopSkuSnapshot.upsert.mock.calls[0][0];
    expect(call.create.supplierPriceCents).toBe(1299n);
  });

  it('sales30dVolume=0 时 daysRemaining=null', async () => {
    mockClient.call = vi.fn().mockResolvedValue({
      total: 1,
      subOrderList: [{
        productName: 'X',
        skuQuantityDetailList: [{
          productSkuId: 1,
          todaySaleVolume: 0,
          lastSevenDaysSaleVolume: 0,
          lastThirtyDaysSaleVolume: 0,
          totalSaleVolume: 0,
          supplierPrice: null,
          inventoryNumInfo: { warehouseInventoryNum: 50 },
        }],
      }],
    });
    const svc = new SkuSnapshotSyncService(prisma, clientFactory);
    await svc.syncShop('shop-1');
    const call = prisma.shopSkuSnapshot.upsert.mock.calls[0][0];
    expect(call.create.avgDailySales).toBe(0);
    expect(call.create.daysRemaining).toBeNull();
  });

  it('Temu API 失败在分页内 break,不抛,返回 0', async () => {
    mockClient.call = vi.fn().mockRejectedValue(new Error('Temu 429 rate limit'));
    const svc = new SkuSnapshotSyncService(prisma, clientFactory);
    const touched = await svc.syncShop('shop-1');
    expect(touched).toBe(0);
  });
});
