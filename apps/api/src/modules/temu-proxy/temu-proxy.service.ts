import { Injectable } from '@nestjs/common';
import { TemuClientFactoryService } from '../platform/temu/temu-client-factory.service';

export interface TemuCategory {
  catId: number;
  catName: string;
  isLeaf: boolean;
}

export interface ListGoodsQuery {
  page?: number;
  pageSize?: number;
  productName?: string;
  productSkcIds?: number[];
  bindSiteIds?: number[];
  skcSiteStatus?: 0 | 1;
  matchJitMode?: boolean;
  quickSellAgtSignStatus?: 0 | 1;
  skcExtCode?: string;
  isSupportPersonalization?: boolean;
  createdAtStart?: number;
  createdAtEnd?: number;
  cat1Id?: number;
  cat2Id?: number;
  cat3Id?: number;
  cat4Id?: number;
  cat5Id?: number;
  cat6Id?: number;
  cat7Id?: number;
  cat8Id?: number;
  cat9Id?: number;
  cat10Id?: number;
}

export interface TemuGoodsVariant {
  productSkuId: number;
  msku: string;
  parentSpecName: string;
  parentSpecId: number;
  specName: string;
  attr: string;
  shippingMode?: number;
}

export interface TemuGoodsGroup {
  productId: number;
  productName: string;
  extCode: string;
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

@Injectable()
export class TemuProxyService {
  constructor(private clientFactory: TemuClientFactoryService) {}

  async listGoods(shopId: string, query: ListGoodsQuery = {}): Promise<ListGoodsResult> {
    const client = await this.clientFactory.forShop(shopId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const params: Record<string, unknown> = { page, pageSize };
    for (const k of [
      'productName',
      'productSkcIds',
      'bindSiteIds',
      'skcSiteStatus',
      'matchJitMode',
      'quickSellAgtSignStatus',
      'skcExtCode',
      'isSupportPersonalization',
      'createdAtStart',
      'createdAtEnd',
      'cat1Id',
      'cat2Id',
      'cat3Id',
      'cat4Id',
      'cat5Id',
      'cat6Id',
      'cat7Id',
      'cat8Id',
      'cat9Id',
      'cat10Id',
    ] as const) {
      const v = (query as any)[k];
      if (v !== undefined && v !== null && v !== '') params[k] = v;
    }

    const res: any = await client.call('bg.goods.list.get', params);
    const list: any[] = res?.data ?? [];
    const total = Number(res?.totalItemNum ?? res?.total ?? res?.totalCount ?? list.length);

    const groups: TemuGoodsGroup[] = list.map((item) => {
      const jit = item?.productJitMode ?? {};
      const semi = item?.productSemiManaged ?? null;
      let jitMode: TemuGoodsGroup['jitMode'] = 'normal';
      if (jit?.matchJitMode === true) jitMode = 'jit';
      else if (semi && Object.keys(semi).length > 0) jitMode = 'semi';

      const sites = Array.isArray(item?.bindSites) ? item.bindSites : [];

      const variants: TemuGoodsVariant[] = (item?.productSkuSummaries ?? []).map((sku: any) => ({
        productSkuId: Number(sku?.productSkuId ?? 0),
        msku: String(sku?.extCode ?? ''),
        parentSpecName: String(sku?.parentSpecName ?? ''),
        parentSpecId: Number(sku?.parentSpecId ?? 0),
        specName: String(sku?.specName ?? ''),
        attr: [sku?.parentSpecName, sku?.specName].filter(Boolean).join(' / '),
        shippingMode: sku?.productSkuShippingMode != null ? Number(sku.productSkuShippingMode) : undefined,
      }));

      return {
        productId: Number(item?.productId ?? 0),
        productName: String(item?.productName ?? ''),
        extCode: String(item?.extCode ?? ''),
        createdAt: Number(item?.createdAt ?? 0),
        jitMode,
        bindSites: sites.map((s: any) => ({
          siteId: Number(s?.siteId ?? 0),
          siteName: String(s?.siteName ?? ''),
        })),
        variants,
      };
    });

    return { total, page, pageSize, groups };
  }

  async getCategoryChildren(shopId: string, parentCatId: number): Promise<TemuCategory[]> {
    const client = await this.clientFactory.forShop(shopId);
    const res: any = await client.call('bg.goods.cats.get', { parentCatId });
    const list = res?.categoryDTOList ?? res?.goodsCatsList ?? res?.list ?? [];
    return (list as any[]).map((c) => ({
      catId: Number(c.catId),
      catName: String(c.catName ?? c.catEnName ?? ''),
      isLeaf: !!c.isLeaf,
    }));
  }

  async getCategoryAttrs(shopId: string, catId: number): Promise<any> {
    const client = await this.clientFactory.forShop(shopId);
    return await client.call('bg.goods.attrs.get', { catId });
  }

  async uploadImage(shopId: string, imageBase64: string, filename?: string): Promise<{ url: string }> {
    const client = await this.clientFactory.forShop(shopId);
    const res: any = await client.call('bg.goods.image.upload.global', {
      imageBase64,
      fileName: filename,
    });
    const url = res?.url ?? res?.imageUrl ?? res?.fullUrl;
    if (!url) throw new Error(`Temu image upload returned no url: ${JSON.stringify(res)}`);
    return { url };
  }
}
