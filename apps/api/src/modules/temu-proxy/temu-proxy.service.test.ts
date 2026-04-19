import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemuProxyService } from './temu-proxy.service';

describe('TemuProxyService.getCategoryChildren', () => {
  let clientFactory: any;
  let mockClient: any;
  beforeEach(() => {
    mockClient = { call: vi.fn() };
    clientFactory = { forShop: vi.fn().mockResolvedValue(mockClient) };
  });

  it('returns normalized children for a parent catId', async () => {
    mockClient.call.mockResolvedValue({
      goodsCatsList: [
        { catId: 100, catName: 'Electronics', isLeaf: false },
        { catId: 101, catName: 'Apparel', isLeaf: false },
      ],
    });
    const svc = new TemuProxyService(clientFactory);
    const r = await svc.getCategoryChildren('shop-1', 0);
    expect(r).toEqual([
      { catId: 100, catName: 'Electronics', isLeaf: false },
      { catId: 101, catName: 'Apparel', isLeaf: false },
    ]);
    expect(mockClient.call).toHaveBeenCalledWith('bg.goods.cats.get', { parentCatId: 0 });
  });

  it('falls back to list when goodsCatsList is missing', async () => {
    mockClient.call.mockResolvedValue({
      list: [
        { catId: 200, catName: 'Test', isLeaf: true },
      ],
    });
    const svc = new TemuProxyService(clientFactory);
    const r = await svc.getCategoryChildren('shop-1', 99);
    expect(r).toHaveLength(1);
    expect(r[0].catId).toBe(200);
    expect(r[0].isLeaf).toBe(true);
  });

  it('getCategoryAttrs passes catId through to bg.goods.attrs.get', async () => {
    mockClient.call.mockResolvedValue({ attrs: [] });
    const svc = new TemuProxyService(clientFactory);
    await svc.getCategoryAttrs('shop-1', 1234);
    expect(mockClient.call).toHaveBeenCalledWith('bg.goods.attrs.get', { catId: 1234 });
  });
});
