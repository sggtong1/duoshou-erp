export interface MarketingContext {
  region: 'cn' | 'pa';
}

export interface MarketingEndpoints {
  listActivities: string;
  activityDetail: string;
  listSessions: string;
  listProducts: string;
  submitEnroll: string;
  listEnrollments: string;
}

export function marketingEndpoints(ctx: MarketingContext): MarketingEndpoints {
  const suffix = ctx.region === 'pa' ? '.global' : '';
  return {
    listActivities: `bg.marketing.activity.list.get${suffix}`,
    activityDetail: `bg.marketing.activity.detail.get${suffix}`,
    listSessions: `bg.marketing.activity.session.list.get${suffix}`,
    listProducts: `bg.marketing.activity.product.get${suffix}`,
    submitEnroll: `bg.marketing.activity.enroll.submit${suffix}`,
    listEnrollments: `bg.marketing.activity.enroll.list.get${suffix}`,
  };
}
