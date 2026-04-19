import { describe, it, expect } from 'vitest';
import { pricingEndpoints } from './pricing-endpoints';

describe('pricingEndpoints', () => {
  it('full+cn uses CN bg.price.review.*', () => {
    const e = pricingEndpoints({ shopType: 'full', region: 'cn' });
    expect(e.listReviews).toBe('bg.price.review.page.query');
    expect(e.confirmReview).toBe('bg.price.review.confirm');
    expect(e.rejectReview).toBe('bg.price.review.reject');
    expect(e.submitAdjustment).toBe('bg.full.adjust.price.batch.review');
    expect(e.listAdjustments).toBe('bg.full.adjust.price.page.query');
    expect(e.priceHistory).toBe('bg.goods.price.list.get');
  });

  it('full+pa uses CN bg.price.review.* (no PA full variant exists)', () => {
    const e = pricingEndpoints({ shopType: 'full', region: 'pa' });
    expect(e.listReviews).toBe('bg.price.review.page.query');
    expect(e.priceHistory).toBe('bg.glo.goods.price.list.get');
  });

  it('semi+pa uses PA bg.semi.price.review.*.order', () => {
    const e = pricingEndpoints({ shopType: 'semi', region: 'pa' });
    expect(e.listReviews).toBe('bg.semi.price.review.page.query.order');
    expect(e.confirmReview).toBe('bg.semi.price.review.confirm.order');
    expect(e.rejectReview).toBe('bg.semi.price.review.reject.order');
    expect(e.submitAdjustment).toBe('bg.semi.adjust.price.batch.review.order');
    expect(e.priceHistory).toBe('bg.glo.goods.price.list.get');
  });

  it('semi+cn routes to PA .order variants and logs deviation', () => {
    const e = pricingEndpoints({ shopType: 'semi', region: 'cn' });
    expect(e.listReviews).toBe('bg.semi.price.review.page.query.order');
    expect(e.submitAdjustment).toBe('bg.semi.adjust.price.batch.review');
  });
});
