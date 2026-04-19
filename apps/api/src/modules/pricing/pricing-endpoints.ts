export interface ShopPricingCtx {
  shopType: 'full' | 'semi';
  region: 'cn' | 'pa';
}

export interface PricingEndpoints {
  listReviews: string;
  confirmReview: string;
  rejectReview: string;
  listAdjustments: string;
  submitAdjustment: string;
  priceHistory: string;
}

export function pricingEndpoints(ctx: ShopPricingCtx): PricingEndpoints {
  const isPa = ctx.region === 'pa';
  if (ctx.shopType === 'full') {
    return {
      listReviews: 'bg.price.review.page.query',
      confirmReview: 'bg.price.review.confirm',
      rejectReview: 'bg.price.review.reject',
      listAdjustments: 'bg.full.adjust.price.page.query',
      submitAdjustment: 'bg.full.adjust.price.batch.review',
      priceHistory: isPa ? 'bg.glo.goods.price.list.get' : 'bg.goods.price.list.get',
    };
  }
  return {
    listReviews: 'bg.semi.price.review.page.query.order',
    confirmReview: 'bg.semi.price.review.confirm.order',
    rejectReview: 'bg.semi.price.review.reject.order',
    listAdjustments: 'bg.semi.adjust.price.page.query',
    submitAdjustment: isPa ? 'bg.semi.adjust.price.batch.review.order' : 'bg.semi.adjust.price.batch.review',
    priceHistory: isPa ? 'bg.glo.goods.price.list.get' : 'bg.goods.price.list.get',
  };
}
