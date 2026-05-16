import { http } from './http';

export interface PriceAdjustmentOrder {
  id: string;
  shopId: string;
  platformOrderId: string | null;
  platformSkuId: string;
  skuTitle: string | null;
  oldPriceCents: number | null;
  newPriceCents: number;
  currency: string | null;
  status: 'submitted' | 'approved' | 'rejected' | 'failed';
  submittedAt: string;
  resolvedAt: string | null;
  error: any;
}

export interface SubmitAdjustmentItem {
  platformSkuId: string;
  newPriceCents: number;
  skuTitle?: string;
  currency?: string;
}

export interface AdjustmentSkuInfo {
  productSkuId: string | null;
  skuExtCode: string | null;
  spec: string | null;
  priceCents: number | null;
  currency: string | null;
}

export interface AdjustmentOrder {
  id: string;
  platform: string;
  shopId: string;
  shopName: string;
  platformShopId: string;
  shopType: string;
  region: string;
  priceOrderSn: string;
  skcId: string | null;
  skcExtCode: string | null;
  productId: string | null;
  productName: string | null;
  priceType: number | null;
  adjustReason: string | null;
  source: string | null;
  newSupplyPriceCents: number | null;
  priceCurrency: string | null;
  rejectReason: string | null;
  trafficLowExpose: boolean | null;
  siteNameList: string[];
  imageList: string[];
  createdAt: string | null;
  skuInfo: AdjustmentSkuInfo[];
  rawStatus: number | null;
  statusLabel: string;
}

export interface SupplierPriceItem {
  productSkuId: string | null;
  productSkcId: string | null;
  productId: string | null;
  currencyType: string | null;
  supplierPriceCents: number | null;
  siteSupplierPrices: Array<{
    siteId: number | null;
    supplierPriceCents: number | null;
    priceReviewStatus: number | null;
  }>;
}

export const priceAdjustmentsApi = {
  submit: (shopId: string, items: SubmitAdjustmentItem[]) =>
    http<any>('/price-adjustments', { method: 'POST', body: JSON.stringify({ shopId, items }) }),
  list: () => http<PriceAdjustmentOrder[]>('/price-adjustments'),
  listOrders: (q: {
    shopId?: string;
    status?: number;
    page?: number;
    pageSize?: number;
    priceOrderSn?: string;
    search?: string;
    priceType?: number;
    source?: number;
    siteId?: number;
    createdAtBegin?: number;
    createdAtEnd?: number;
  } = {}) =>
    http<{ total: number; page: number; pageSize: number; items: AdjustmentOrder[] }>(
      '/price-adjustments/orders',
      { query: q },
    ),
  batchReview: (shopId: string, result: 1 | 2, orderSns: string[], rejectReasons?: Record<string, string>) =>
    http<{ total: number; results: Array<{ priceOrderSn: string; ok: boolean; error?: string }>; platformResponse: any }>(
      '/price-adjustments/batch-review',
      { method: 'POST', body: JSON.stringify({ shopId, result, orderSns, rejectReasons }) },
    ),
  supplierPrices: (shopId: string, productSkuIds: string[]) =>
    http<{ shop: any; items: SupplierPriceItem[]; platformResponse: any }>(
      '/price-adjustments/supplier-prices',
      { query: { shopId, productSkuIds: productSkuIds.join(',') } },
    ),
};
