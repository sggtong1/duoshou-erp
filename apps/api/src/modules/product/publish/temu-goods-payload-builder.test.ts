import { describe, it, expect } from 'vitest';
import { buildTemuGoodsAddPayload } from './temu-goods-payload-builder';

const baseTemplate = {
  id: 'tpl-1',
  orgId: 'org-1',
  name: 'Test Mug',
  description: 'A lovely ceramic mug',
  temuCategoryId: 1234n,
  temuCategoryPath: ['Home', 'Kitchen'],
  shopTypeTarget: 'full',
  mainImageUrl: 'https://example.com/main.jpg',
  carouselImageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  suggestedPriceCents: 999n,
  attributes: { Brand: 'Generic', Material: 'Ceramic' },
  outerPackage: { lengthMm: 100, widthMm: 100, heightMm: 100, weightG: 300 },
} as any;

describe('buildTemuGoodsAddPayload', () => {
  it('builds full-managed payload: productName, catId, images, attrs, SKC with supplierPrice in cents-as-string', () => {
    const p = buildTemuGoodsAddPayload(
      baseTemplate,
      { shopType: 'full', region: 'cn' },
      { priceCentsOverride: null },
    );
    expect(p.productName).toBe('Test Mug');
    expect(p.catId).toBe(1234);
    expect(p.productImageReqs).toHaveLength(3); // main + 2 carousel
    expect(p.productImageReqs[0]).toEqual({ imageUrl: 'https://example.com/main.jpg', isPrimary: true });
    expect(p.productImageReqs[1]).toEqual({ imageUrl: 'https://example.com/a.jpg', isPrimary: false });
    expect(p.productSkcReqs).toHaveLength(1);
    expect(p.productSkcReqs[0].productSkuReqs).toHaveLength(1);
    expect(p.productSkcReqs[0].productSkuReqs[0].supplierPrice).toBe('999');
    expect(p.productOuterPackageReq).toEqual({ length: 100, width: 100, height: 100, weight: 300 });
    expect(p.productPropertyReqs).toEqual(expect.arrayContaining([
      expect.objectContaining({ propertyName: 'Brand' }),
      expect.objectContaining({ propertyName: 'Material' }),
    ]));
    expect(p.productSemiManagedReq).toBeUndefined();
    expect(p.productShipmentReq).toBeUndefined();
  });

  it('applies per-shop price override', () => {
    const p = buildTemuGoodsAddPayload(
      baseTemplate,
      { shopType: 'full', region: 'cn' },
      { priceCentsOverride: 1500 },
    );
    expect(p.productSkcReqs[0].productSkuReqs[0].supplierPrice).toBe('1500');
  });

  it('builds semi-managed payload with productSemiManagedReq + productShipmentReq + siteSupplierPrices', () => {
    const t = { ...baseTemplate, shopTypeTarget: 'semi' };
    const p = buildTemuGoodsAddPayload(
      t,
      { shopType: 'semi', region: 'pa', siteIds: [100], freightTemplateId: 'FT-1' },
      { priceCentsOverride: null },
    );
    expect(p.productSemiManagedReq).toBeDefined();
    expect(p.productSemiManagedReq!.bindSiteIds).toEqual([100]);
    expect(p.productShipmentReq).toEqual({ freightTemplateId: 'FT-1', shipmentLimitSecond: 86400 });
    expect(p.productSkcReqs[0].productSkuReqs[0].supplierPrice).toBeUndefined();
    expect(p.productSkcReqs[0].productSkuReqs[0].siteSupplierPrices).toEqual([
      { siteId: 100, supplierPrice: '999' },
    ]);
  });

  it('throws when semi shop missing siteIds or freightTemplateId', () => {
    const t = { ...baseTemplate, shopTypeTarget: 'semi' };
    expect(() =>
      buildTemuGoodsAddPayload(t, { shopType: 'semi', region: 'pa' } as any, { priceCentsOverride: null }),
    ).toThrow(/siteIds|freightTemplateId/i);
  });

  it('throws on shop-type mismatch (full template → semi shop)', () => {
    expect(() =>
      buildTemuGoodsAddPayload(
        baseTemplate,
        { shopType: 'semi', region: 'pa', siteIds: [100], freightTemplateId: 'FT-1' },
        { priceCentsOverride: null },
      ),
    ).toThrow(/mismatch|target/i);
  });

  it('non-apparel fixed mainProductSkuSpecReqs (parentSpecId=0, specId=0)', () => {
    const p = buildTemuGoodsAddPayload(
      baseTemplate,
      { shopType: 'full', region: 'cn' },
      { priceCentsOverride: null },
    );
    expect(p.mainProductSkuSpecReqs).toEqual([
      { parentSpecId: 0, parentSpecName: '', specId: 0, specName: '' },
    ]);
  });
});
