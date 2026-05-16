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

// Temu selectStatus 映射 — 标签为业内常见取值 best-guess，建议按你的 Temu 文档校准:
//   1 选品中    2 待审核    3 审核驳回    4 已通过(待加站点)
//   5 已下架    6 售卖中    7 待加入站点  8 加站点失败    9 已加入站点
function lifecycleLabel(code: number): string {
  switch (code) {
    case 1: return '选品中';
    case 2: return '待审核';
    case 3: return '审核驳回';
    case 4: return '已通过';
    case 5: return '已下架';
    case 6: return '售卖中';
    case 7: return '待加入站点';
    case 8: return '加站点失败';
    case 9: return '已加入站点';
    default: return code ? `状态${code}` : '';
  }
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

    // SMMS 服务商凭证走 PA 网关 (.glo 前缀)；CN 直连卖家凭证走原始接口名。
    const interfaceType =
      client.ctx.region === 'pa' ? 'bg.glo.goods.list.get' : 'bg.goods.list.get';
    const res: any = await client.call(interfaceType, params);
    const list: any[] = res?.data ?? [];
    const total = Number(res?.totalItemNum ?? res?.total ?? res?.totalCount ?? list.length);

    const groups: TemuGoodsGroup[] = list.map((item) => {
      const jit = item?.productJitMode ?? {};
      const semi = item?.productSemiManaged ?? null;
      let jitMode: TemuGoodsGroup['jitMode'] = 'normal';
      if (item?.matchSkcJitMode === true || jit?.matchJitMode === true) jitMode = 'jit';
      else if (semi && Object.keys(semi).length > 0) jitMode = 'semi';

      const sites = Array.isArray(item?.bindSites) ? item.bindSites : [];

      const variants: TemuGoodsVariant[] = (item?.productSkuSummaries ?? []).map((sku: any) => {
        const specs: any[] = Array.isArray(sku?.productSkuSpecList) ? sku.productSkuSpecList : [];
        const parentSpec = specs[0] ?? {};
        const childSpec = specs[1] ?? {};
        const parentName = String(parentSpec?.specName ?? '');
        const childName = String(childSpec?.specName ?? '');
        return {
          productSkuId: Number(sku?.productSkuId ?? 0),
          msku: String(sku?.extCode ?? ''),
          parentSpecName: parentName,
          parentSpecId: Number(parentSpec?.parentSpecId ?? 0),
          specName: childName,
          attr: [parentName, childName].filter(Boolean).join(' / '),
          shippingMode: sku?.productSkuShippingMode != null ? Number(sku.productSkuShippingMode) : undefined,
          virtualStock: Number(sku?.virtualStock ?? 0),
        };
      });

      return {
        productId: Number(item?.productId ?? 0),
        productSkcId: Number(item?.productSkcId ?? 0),
        productName: String(item?.productName ?? ''),
        extCode: String(item?.extCode ?? ''),
        mainImageUrl: String(item?.mainImageUrl ?? ''),
        skcSiteStatus: Number(item?.skcSiteStatus ?? -1),
        createdAt: Number(item?.createdAt ?? 0),
        jitMode,
        bindSites: sites.map((s: any) => ({
          siteId: Number(s?.siteId ?? 0),
          siteName: String(s?.siteName ?? ''),
        })),
        variants,
      };
    });

    // 1 次 batch 调拿生命周期状态（response 形如 dataList[].skcList[].selectStatus），失败不阻塞
    const allSkuIds = groups.flatMap((g) => g.variants.map((v) => v.productSkuId)).filter(Boolean);
    if (allSkuIds.length > 0) {
      try {
        const statusRes: any = await client.call(
          client.ctx.region === 'pa' ? 'bg.glo.product.search' : 'bg.product.search',
          { productSkuIdList: allSkuIds, pageNum: 1, pageSize: allSkuIds.length },
        );
        const statusList: any[] = statusRes?.dataList ?? statusRes?.data ?? statusRes?.list ?? [];
        const skcToStatus = new Map<number, number>();
        for (const it of statusList) {
          for (const skc of it?.skcList ?? []) {
            const id = Number(skc?.skcId ?? 0);
            const code = Number(skc?.selectStatus ?? 0);
            if (id) skcToStatus.set(id, code);
          }
        }
        for (const g of groups) {
          const code = skcToStatus.get(g.productSkcId);
          if (code != null) {
            g.lifecycleStatus = code;
            g.lifecycleStatusLabel = lifecycleLabel(code);
          }
        }
      } catch {
        // best-effort
      }
    }

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
