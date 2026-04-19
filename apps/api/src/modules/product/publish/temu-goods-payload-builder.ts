export interface ShopContext {
  shopType: 'full' | 'semi';
  region: 'cn' | 'pa';
  /** Required for semi-managed shops */
  siteIds?: number[];
  freightTemplateId?: string;
}

export interface PublishOptions {
  priceCentsOverride: number | null;
  /** Full category id chain from root to leaf, e.g. [root_id, ..., leaf_id]. Length 1-10. */
  categoryIdChain: number[];
}

/**
 * Build a Temu bg.glo.goods.add request body from a saved ProductTemplate row.
 *
 * This builder targets the PA gateway shape required for international (PA) shops:
 *  - cat1Id..cat10Id: full breadcrumb chain (pad with 0 for unused levels)
 *  - materialImgUrl: reuse main image url
 *  - productSpecPropertyReqs: placeholder required even for non-apparel single SKU
 *  - productPropertyReqs: template.attributes mapped (placeholder if empty)
 *  - productSkcReqs: single SKC with images + single SKU
 *  - Prices are string representations of cents (no decimal point)
 *  - Full-managed: SKU uses supplierPrice
 *  - Semi-managed: SKU uses siteSupplierPrices + productSemiManagedReq + productShipmentReq
 */
export function buildTemuGoodsAddPayload(template: any, shop: ShopContext, opts: PublishOptions): any {
  if (template.shopTypeTarget !== shop.shopType) {
    throw new Error(
      `Shop-type mismatch: template target is '${template.shopTypeTarget}' but shop is '${shop.shopType}'`,
    );
  }
  if (shop.shopType === 'semi' && (!shop.siteIds?.length || !shop.freightTemplateId)) {
    throw new Error('Semi-managed shops require siteIds and freightTemplateId');
  }
  if (!opts.categoryIdChain?.length) {
    throw new Error('categoryIdChain required (from root to leaf)');
  }
  if (opts.categoryIdChain.length > 10) {
    throw new Error('categoryIdChain max 10 levels');
  }

  const priceCents = Number(opts.priceCentsOverride ?? template.suggestedPriceCents);
  const priceStr = String(priceCents);

  // Build cat1Id..cat10Id — pad shorter chains with 0
  const catIds: Record<string, number> = {};
  for (let i = 1; i <= 10; i++) {
    catIds[`cat${i}Id`] = opts.categoryIdChain[i - 1] ?? 0;
  }

  const mainImage = String(template.mainImageUrl);
  const images: Array<{ imageUrl: string; isPrimary: boolean }> = [
    { imageUrl: mainImage, isPrimary: true },
    ...((template.carouselImageUrls as string[]) ?? []).map((u) => ({ imageUrl: String(u), isPrimary: false })),
  ];

  const productPropertyReqs = Object.entries((template.attributes as Record<string, string>) ?? {}).map(
    ([k, v]) => ({
      propertyId: 0,
      propertyName: k,
      valueUnit: '',
      values: [{ value: String(v) }],
    }),
  );
  // productPropertyReqs must not be empty — if no attributes, add a placeholder
  if (productPropertyReqs.length === 0) {
    productPropertyReqs.push({
      propertyId: 0,
      propertyName: 'Brand',
      valueUnit: '',
      values: [{ value: 'Generic' }],
    });
  }

  // productSpecPropertyReqs — for non-apparel single-SKU flows, Temu requires at least
  // one placeholder with parentSpecId=0 and specId=0.
  const productSpecPropertyReqs = [
    { parentSpecId: 0, parentSpecName: '', specId: 0, specName: '' },
  ];

  const skuReq: any = {
    productSkuSpecReqs: [],
    productSkuStockQuantityReqs: [{ quantity: 0 }],
  };

  if (shop.shopType === 'full') {
    skuReq.supplierPrice = priceStr;
  } else {
    skuReq.siteSupplierPrices = (shop.siteIds ?? []).map((siteId) => ({ siteId, supplierPrice: priceStr }));
  }

  const pkg = template.outerPackage as {
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    weightG: number;
  };

  const payload: any = {
    productName: String(template.name),
    ...catIds,
    materialImgUrl: mainImage,
    productPropertyReqs,
    productSpecPropertyReqs,
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
