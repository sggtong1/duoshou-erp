export interface ShopContext {
  shopType: 'full' | 'semi';
  region: 'cn' | 'pa';
  /** Required for semi-managed shops */
  siteIds?: number[];
  freightTemplateId?: string;
}

export interface PublishOptions {
  priceCentsOverride: number | null;
}

export interface TemuGoodsAddPayload {
  productName: string;
  catId: number;
  productDescription?: string;
  productPropertyReqs: Array<{
    propertyId: number;
    propertyName: string;
    valueUnit: string;
    values: Array<{ value: string }>;
  }>;
  productSpecPropertyReqs: any[];
  mainProductSkuSpecReqs: Array<{ parentSpecId: number; parentSpecName: string; specId: number; specName: string }>;
  productImageReqs: Array<{ imageUrl: string; isPrimary: boolean }>;
  productOuterPackageReq: { length: number; width: number; height: number; weight: number };
  productSkcReqs: Array<{
    productImageReqs: Array<{ imageUrl: string; isPrimary: boolean }>;
    productSpecReqs: any[];
    productSkuReqs: Array<{
      productSkuSpecReqs: any[];
      supplierPrice?: string;
      siteSupplierPrices?: Array<{ siteId: number; supplierPrice: string }>;
      productSkuStockQuantityReqs: Array<{ quantity: number }>;
    }>;
  }>;
  productSemiManagedReq?: {
    bindSiteIds: number[];
    semiManagedSiteMode: number;
    semiLanguageStrategy: number;
  };
  productShipmentReq?: { freightTemplateId: string; shipmentLimitSecond: number };
}

/**
 * Build a Temu goods.add request body from a saved ProductTemplate row.
 *
 * Key rules (verified against Temu's docs/references/temu/199__...发布流程.md):
 *  - Prices are passed as string representations of cents (no decimal point).
 *  - Non-apparel flow: productSpecPropertyReqs=[], mainProductSkuSpecReqs is the
 *    fixed placeholder, single SKC, single SKU.
 *  - Full-managed: SKU uses supplierPrice.
 *  - Semi-managed: SKU uses siteSupplierPrices (one per bindSiteId) and the
 *    payload includes productSemiManagedReq + productShipmentReq.
 */
export function buildTemuGoodsAddPayload(
  template: any,
  shop: ShopContext,
  opts: PublishOptions,
): TemuGoodsAddPayload {
  if (template.shopTypeTarget !== shop.shopType) {
    throw new Error(
      `Shop-type mismatch: template target is '${template.shopTypeTarget}' but shop is '${shop.shopType}'`,
    );
  }
  if (shop.shopType === 'semi' && (!shop.siteIds?.length || !shop.freightTemplateId)) {
    throw new Error('Semi-managed shops require siteIds and freightTemplateId');
  }

  const priceCents = Number(opts.priceCentsOverride ?? template.suggestedPriceCents);
  const priceStr = String(priceCents);

  const images: Array<{ imageUrl: string; isPrimary: boolean }> = [
    { imageUrl: String(template.mainImageUrl), isPrimary: true },
    ...((template.carouselImageUrls as string[]) ?? []).map((u) => ({
      imageUrl: String(u),
      isPrimary: false,
    })),
  ];

  const productPropertyReqs = Object.entries(
    (template.attributes as Record<string, string>) ?? {},
  ).map(([k, v]) => ({
    propertyId: 0,
    propertyName: k,
    valueUnit: '',
    values: [{ value: String(v) }],
  }));

  const skuReq: TemuGoodsAddPayload['productSkcReqs'][number]['productSkuReqs'][number] = {
    productSkuSpecReqs: [],
    productSkuStockQuantityReqs: [{ quantity: 0 }],
  };

  if (shop.shopType === 'full') {
    skuReq.supplierPrice = priceStr;
  } else {
    skuReq.siteSupplierPrices = (shop.siteIds ?? []).map((siteId) => ({
      siteId,
      supplierPrice: priceStr,
    }));
  }

  const pkg = template.outerPackage as {
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    weightG: number;
  };

  const payload: TemuGoodsAddPayload = {
    productName: String(template.name),
    catId: Number(template.temuCategoryId),
    productDescription: template.description ?? '',
    productPropertyReqs,
    productSpecPropertyReqs: [],
    mainProductSkuSpecReqs: [
      { parentSpecId: 0, parentSpecName: '', specId: 0, specName: '' },
    ],
    productImageReqs: images,
    productOuterPackageReq: {
      length: pkg.lengthMm,
      width: pkg.widthMm,
      height: pkg.heightMm,
      weight: pkg.weightG,
    },
    productSkcReqs: [
      {
        productImageReqs: images,
        productSpecReqs: [],
        productSkuReqs: [skuReq],
      },
    ],
  };

  if (shop.shopType === 'semi') {
    payload.productSemiManagedReq = {
      bindSiteIds: shop.siteIds!,
      semiManagedSiteMode: 2,
      semiLanguageStrategy: 0,
    };
    payload.productShipmentReq = {
      freightTemplateId: shop.freightTemplateId!,
      shipmentLimitSecond: 86400,
    };
  }

  return payload;
}
