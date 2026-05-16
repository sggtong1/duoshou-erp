import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma.service';
import { TemuClientFactoryService } from '../../platform/temu/temu-client-factory.service';
import { pricingEndpoints } from '../pricing-endpoints';
import type {
  BatchReviewAdjustmentInput,
  ListAdjustmentOrdersFilter,
  SubmitAdjustmentInput,
} from './price-adjustment.dto';

function parseCents(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function normalizeStatus(status: any) {
  const raw = Number(status);
  const labelMap: Record<number, string> = {
    0: '待调价',
    1: '待供应商确认',
    2: '调价成功',
    3: '调价失败',
  };
  return {
    rawStatus: Number.isFinite(raw) ? raw : null,
    statusLabel: Number.isFinite(raw) ? labelMap[raw] ?? String(raw) : '未知',
  };
}

function normalizeSkuInfo(list: any[]) {
  return list.map((sku) => ({
    productSkuId: sku.productSkuId != null ? String(sku.productSkuId) : null,
    skuExtCode: sku.skuExtCode ?? null,
    spec: sku.spec ?? null,
    priceCents: parseCents(sku.price),
    currency: sku.priceCurrency ?? null,
  }));
}

function normalizeAdjustmentOrder(raw: any, shop: any) {
  const skuInfo = normalizeSkuInfo(raw.skuInfoItemList ?? raw.skuInfoList ?? []);
  const status = normalizeStatus(raw.status);
  const createdAt = raw.orderCreateTime ? new Date(Number(raw.orderCreateTime)).toISOString() : null;
  return {
    id: `${shop.id}:${raw.priceOrderSn ?? ''}`,
    platform: shop.platform,
    shopId: shop.id,
    shopName: shop.displayName ?? shop.platformShopId,
    platformShopId: shop.platformShopId,
    shopType: shop.shopType,
    region: shop.region,
    priceOrderSn: raw.priceOrderSn ? String(raw.priceOrderSn) : '',
    skcId: raw.skcId != null ? String(raw.skcId) : null,
    skcExtCode: raw.skcExtCode ?? null,
    productId: raw.productId != null ? String(raw.productId) : null,
    productName: raw.productName ?? null,
    priceType: raw.priceType ?? null,
    adjustReason: raw.adjustReason ?? null,
    source: raw.source ?? null,
    newSupplyPriceCents: parseCents(raw.newSupplyPrice),
    priceCurrency: raw.priceCurrency ?? null,
    rejectReason: raw.rejectReason ?? null,
    trafficLowExpose: typeof raw.trafficLowExpose === 'boolean' ? raw.trafficLowExpose : null,
    siteNameList: Array.isArray(raw.siteNameList) ? raw.siteNameList.map((x: any) => String(x)) : [],
    imageList: Array.isArray(raw.imageList) ? raw.imageList.map((x: any) => String(x)) : [],
    createdAt,
    skuInfo,
    platformPayload: raw,
    ...status,
  };
}

function normalizeFailedOrders(value: any): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  if ('$key' in value && '$value' in value) return { [String(value.$key)]: String(value.$value) };
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]));
}

function parseSkuIds(value: string): number[] {
  return value
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x > 0);
}

@Injectable()
export class PriceAdjustmentService {
  constructor(
    private prisma: PrismaService,
    private clientFactory: TemuClientFactoryService,
  ) {}

  async listPlatformOrders(orgId: string, filter: ListAdjustmentOrdersFilter) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
    const shops = await this.resolveShops(orgId, filter.shopId);
    const items: any[] = [];
    let total = 0;

    for (const shop of shops) {
      const ep = pricingEndpoints({ shopType: shop.shopType, region: shop.region });
      const client = await this.clientFactory.forShop(shop.id);
      const req = this.buildListOrdersRequest(shop, filter, page, pageSize);
      const res: any = await client.call(ep.listAdjustments, req);
      const result = res?.result ?? {};
      const list = result.list ?? result.priceAdjustOrderList ?? [];
      total += Number(result.total ?? list.length ?? 0);
      items.push(...list.map((raw: any) => normalizeAdjustmentOrder(raw, shop)));
    }

    const filtered = filter.search
      ? items.filter((item) => [item.productName, item.priceOrderSn, item.skcExtCode]
        .some((x) => String(x ?? '').toLowerCase().includes(filter.search!.toLowerCase())))
      : items;

    return { total: filter.shopId ? total : filtered.length, page, pageSize, items: filtered };
  }

  async batchReview(orgId: string, input: BatchReviewAdjustmentInput) {
    const shop = await this.resolveShop(orgId, input.shopId);
    if (shop.shopType === 'full' && input.result !== 1) {
      throw new BadRequestException('Full-managed adjustment orders only support approval');
    }

    const ep = pricingEndpoints({ shopType: shop.shopType, region: shop.region });
    const client = await this.clientFactory.forShop(shop.id);
    const payload = shop.shopType === 'full'
      ? { adjustList: input.orderSns.map((priceOrderSn) => ({ result: 1, priceOrderSn })) }
      : {
          batchResult: input.result,
          submitOrders: input.orderSns,
          ...(input.rejectReasons ? { rejectReasons: input.rejectReasons } : {}),
        };

    const res: any = await client.call(ep.submitAdjustment, payload);
    const successOrders = new Set((res?.result?.successOrders ?? []).map((x: any) => String(x)));
    const failedOrders = normalizeFailedOrders(res?.result?.failedOrders);
    const hasPerOrderResult = successOrders.size > 0 || Object.keys(failedOrders).length > 0;
    return {
      total: input.orderSns.length,
      platformResponse: res,
      results: input.orderSns.map((priceOrderSn) => ({
        priceOrderSn,
        ok: hasPerOrderResult ? successOrders.has(priceOrderSn) && !failedOrders[priceOrderSn] : res?.success !== false,
        error: failedOrders[priceOrderSn],
      })),
    };
  }

  async getSupplierPrices(orgId: string, shopId: string, productSkuIds: string) {
    const shop = await this.resolveShop(orgId, shopId);
    const ids = parseSkuIds(productSkuIds);
    if (!ids.length) throw new BadRequestException('productSkuIds is required');
    if (ids.length > 50) throw new BadRequestException('productSkuIds supports up to 50 ids');

    const ep = pricingEndpoints({ shopType: shop.shopType, region: shop.region });
    const client = await this.clientFactory.forShop(shop.id);
    const res: any = await client.call(ep.priceHistory, { productSkuIds: ids });
    const list = res?.result?.productSkuSupplierPriceList ?? [];
    return {
      shop: {
        id: shop.id,
        platform: shop.platform,
        displayName: shop.displayName,
        platformShopId: shop.platformShopId,
        shopType: shop.shopType,
        region: shop.region,
      },
      items: list.map((item: any) => ({
        productSkuId: item.productSkuId != null ? String(item.productSkuId) : null,
        productSkcId: item.productSkcId != null ? String(item.productSkcId) : null,
        productId: item.productId != null ? String(item.productId) : null,
        currencyType: item.currencyType ?? null,
        supplierPriceCents: parseCents(item.supplierPrice),
        siteSupplierPrices: (item.siteSupplierPrices ?? []).map((site: any) => ({
          siteId: site.siteId ?? null,
          supplierPriceCents: parseCents(site.supplierPrice),
          priceReviewStatus: site.priceReviewStatus ?? null,
        })),
      })),
      platformResponse: res,
    };
  }

  async submit(orgId: string, input: SubmitAdjustmentInput) {
    void orgId;
    void input;
    throw new BadRequestException('Active price-change creation is not supported by the current API set; use batch-review for existing adjustment orders');
  }

  async list(orgId: string, limit = 50) {
    const items = await (this.prisma as any).priceAdjustmentOrder.findMany({
      where: { orgId },
      include: { shop: { select: { displayName: true, platformShopId: true } } },
      orderBy: { submittedAt: 'desc' },
      take: limit,
    });
    return items.map((i: any) => ({
      ...i,
      oldPriceCents: i.oldPriceCents != null ? Number(i.oldPriceCents) : null,
      newPriceCents: Number(i.newPriceCents),
    }));
  }

  private async resolveShop(orgId: string, shopId: string) {
    const shop = await (this.prisma as any).shop.findFirst({
      where: { id: shopId, orgId, status: 'active' },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    if (shop.platform !== 'temu') throw new BadRequestException('Current price adapter only supports Temu shops');
    return shop;
  }

  private async resolveShops(orgId: string, shopId?: string) {
    if (shopId) return [await this.resolveShop(orgId, shopId)];
    return (this.prisma as any).shop.findMany({
      where: { orgId, status: 'active', platform: 'temu' },
      orderBy: { connectedAt: 'desc' },
    });
  }

  private buildListOrdersRequest(shop: any, filter: ListAdjustmentOrdersFilter, page: number, pageSize: number) {
    const req: any = { pageNo: page, pageSize };
    if (filter.priceOrderSn) req.priceOrderSn = [filter.priceOrderSn];
    if (filter.priceType !== undefined) req.priceType = filter.priceType;
    if (filter.source !== undefined) req.source = filter.source;
    if (filter.createdAtBegin !== undefined) req.createdAtBegin = filter.createdAtBegin;
    if (filter.createdAtEnd !== undefined) req.createdAtEnd = filter.createdAtEnd;
    if (shop.shopType === 'full') {
      req.status = filter.status ?? 1;
    } else {
      if (filter.status !== undefined) req.status = filter.status;
      if (filter.siteId !== undefined) req.siteId = filter.siteId;
    }
    return req;
  }
}
