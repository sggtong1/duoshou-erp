import { http } from './http';

export interface TemuGoodsVariant {
  productSkuId: number;
  msku: string;
  parentSpecName: string;
  parentSpecId: number;
  specName: string;
  attr: string;
  shippingMode?: number;
  virtualStock: number;
}

export interface TemuGoodsGroup {
  productId: number;
  productSkcId: number;
  productName: string;
  extCode: string;
  mainImageUrl: string;
  skcSiteStatus: number;
  lifecycleStatus?: number;
  lifecycleStatusLabel?: string;
  createdAt: number;
  jitMode: 'jit' | 'semi' | 'normal' | null;
  bindSites: Array<{ siteId: number; siteName: string }>;
  variants: TemuGoodsVariant[];
}

export interface ListGoodsResult {
  total: number;
  page: number;
  pageSize: number;
  groups: TemuGoodsGroup[];
}

export interface ListGoodsParams {
  shopId: string;
  page?: number;
  pageSize?: number;
  productName?: string;
  skcExtCode?: string;
  siteId?: number;
  skcSiteStatus?: 0 | 1;
  matchJitMode?: boolean;
}

export const temuApi = {
  listGoods(params: ListGoodsParams, signal?: AbortSignal) {
    return http<ListGoodsResult>('/temu/goods', {
      query: {
        shopId: params.shopId,
        page: params.page,
        pageSize: params.pageSize,
        productName: params.productName,
        skcExtCode: params.skcExtCode,
        siteId: params.siteId,
        skcSiteStatus: params.skcSiteStatus,
        matchJitMode: params.matchJitMode,
      },
      signal,
    });
  },
};
