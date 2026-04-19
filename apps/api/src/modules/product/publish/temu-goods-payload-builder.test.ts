import { describe, it, expect } from 'vitest';
import { buildTemuGoodsAddPayload } from './temu-goods-payload-builder';

const baseTemplate = {
  id: 'tpl-1',
  orgId: 'org-1',
  name: 'Test Mug',
  description: 'A lovely ceramic mug',
  temuCategoryId: 1234n,
  temuCategoryPath: ['Home', 'Kitchen', 'Mugs'],
  shopTypeTarget: 'full',
  mainImageUrl: 'https://example.com/main.jpg',
  carouselImageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  suggestedPriceCents: 999n,
  attributes: { Brand: 'Generic', Material: 'Ceramic' },
  outerPackage: { lengthMm: 100, widthMm: 100, heightMm: 100, weightG: 300 },
} as any;

const defaultOpts = { priceCentsOverride: null, categoryIdChain: [123, 456, 1234] };

describe('buildTemuGoodsAddPayload (PA shape)', () => {
  it('builds full-managed PA payload: productName, cat1-10Id, materialImgUrl, images in SKC', () => {
    const p = buildTemuGoodsAddPayload(baseTemplate, { shopType: 'full', region: 'pa' }, defaultOpts);

    expect(p.productName).toBe('Test Mug');

    // Category chain: 3 levels filled, rest padded with 0
    expect(p.cat1Id).toBe(123);
    expect(p.cat2Id).toBe(456);
    expect(p.cat3Id).toBe(1234);
    expect(p.cat4Id).toBe(0);
    expect(p.cat5Id).toBe(0);
    expect(p.cat10Id).toBe(0);

    // materialImgUrl = main image
    expect(p.materialImgUrl).toBe('https://example.com/main.jpg');

    // Images are inside productSkcReqs, not top-level
    expect(p.productSkcReqs).toHaveLength(1);
    expect(p.productSkcReqs[0].productImageReqs).toHaveLength(3); // main + 2 carousel
    expect(p.productSkcReqs[0].productImageReqs[0]).toEqual({
      imageUrl: 'https://example.com/main.jpg',
      isPrimary: true,
    });

    // No top-level catId or productImageReqs (old CN shape)
    expect(p.catId).toBeUndefined();
    expect(p.productImageReqs).toBeUndefined();

    expect(p.productOuterPackageReq).toEqual({ length: 100, width: 100, height: 100, weight: 300 });
    expect(p.productSemiManagedReq).toBeUndefined();
    expect(p.productShipmentReq).toBeUndefined();
  });

  it('productSpecPropertyReqs has placeholder with parentSpecId=0, specId=0', () => {
    const p = buildTemuGoodsAddPayload(baseTemplate, { shopType: 'full', region: 'pa' }, defaultOpts);
    expect(p.productSpecPropertyReqs).toHaveLength(1);
    expect(p.productSpecPropertyReqs[0]).toEqual({
      parentSpecId: 0,
      parentSpecName: '',
      specId: 0,
      specName: '',
    });
  });

  it('productPropertyReqs mapped from template.attributes', () => {
    const p = buildTemuGoodsAddPayload(baseTemplate, { shopType: 'full', region: 'pa' }, defaultOpts);
    expect(p.productPropertyReqs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ propertyName: 'Brand' }),
        expect.objectContaining({ propertyName: 'Material' }),
      ]),
    );
  });

  it('adds Brand placeholder when template.attributes is empty', () => {
    const t = { ...baseTemplate, attributes: {} };
    const p = buildTemuGoodsAddPayload(t, { shopType: 'full', region: 'pa' }, defaultOpts);
    expect(p.productPropertyReqs).toHaveLength(1);
    expect(p.productPropertyReqs[0].propertyName).toBe('Brand');
    expect(p.productPropertyReqs[0].values[0].value).toBe('Generic');
  });

  it('applies per-shop price override', () => {
    const p = buildTemuGoodsAddPayload(
      baseTemplate,
      { shopType: 'full', region: 'pa' },
      { ...defaultOpts, priceCentsOverride: 1500 },
    );
    expect(p.productSkcReqs[0].productSkuReqs[0].supplierPrice).toBe('1500');
  });

  it('builds semi-managed payload with productSemiManagedReq + productShipmentReq + siteSupplierPrices', () => {
    const t = { ...baseTemplate, shopTypeTarget: 'semi' };
    const p = buildTemuGoodsAddPayload(
      t,
      { shopType: 'semi', region: 'pa', siteIds: [100], freightTemplateId: 'FT-1' },
      defaultOpts,
    );
    expect(p.productSemiManagedReq).toBeDefined();
    expect(p.productSemiManagedReq.bindSiteIds).toEqual([100]);
    expect(p.productShipmentReq).toEqual({ freightTemplateId: 'FT-1', shipmentLimitSecond: 86400 });
    expect(p.productSkcReqs[0].productSkuReqs[0].supplierPrice).toBeUndefined();
    expect(p.productSkcReqs[0].productSkuReqs[0].siteSupplierPrices).toEqual([
      { siteId: 100, supplierPrice: '999' },
    ]);
  });

  it('throws when semi shop missing siteIds or freightTemplateId', () => {
    const t = { ...baseTemplate, shopTypeTarget: 'semi' };
    expect(() =>
      buildTemuGoodsAddPayload(t, { shopType: 'semi', region: 'pa' } as any, defaultOpts),
    ).toThrow(/siteIds|freightTemplateId/i);
  });

  it('throws on shop-type mismatch (full template → semi shop)', () => {
    expect(() =>
      buildTemuGoodsAddPayload(
        baseTemplate,
        { shopType: 'semi', region: 'pa', siteIds: [100], freightTemplateId: 'FT-1' },
        defaultOpts,
      ),
    ).toThrow(/mismatch|target/i);
  });

  it('throws when categoryIdChain is empty', () => {
    expect(() =>
      buildTemuGoodsAddPayload(baseTemplate, { shopType: 'full', region: 'pa' }, {
        ...defaultOpts,
        categoryIdChain: [],
      }),
    ).toThrow(/categoryIdChain required/i);
  });

  it('throws when categoryIdChain has more than 10 levels', () => {
    expect(() =>
      buildTemuGoodsAddPayload(baseTemplate, { shopType: 'full', region: 'pa' }, {
        ...defaultOpts,
        categoryIdChain: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      }),
    ).toThrow(/max 10 levels/i);
  });

  it('single-level chain: cat1Id set, cat2Id..cat10Id all 0', () => {
    const p = buildTemuGoodsAddPayload(baseTemplate, { shopType: 'full', region: 'pa' }, {
      ...defaultOpts,
      categoryIdChain: [999],
    });
    expect(p.cat1Id).toBe(999);
    for (let i = 2; i <= 10; i++) {
      expect(p[`cat${i}Id`]).toBe(0);
    }
  });
});
