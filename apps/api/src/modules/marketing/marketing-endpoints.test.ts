import { describe, it, expect } from 'vitest';
import { marketingEndpoints } from './marketing-endpoints';

describe('marketingEndpoints', () => {
  it('cn 用基础 bg.marketing.activity.* 方法名', () => {
    const e = marketingEndpoints({ region: 'cn' });
    expect(e.listActivities).toBe('bg.marketing.activity.list.get');
    expect(e.activityDetail).toBe('bg.marketing.activity.detail.get');
    expect(e.listSessions).toBe('bg.marketing.activity.session.list.get');
    expect(e.listProducts).toBe('bg.marketing.activity.product.get');
    expect(e.submitEnroll).toBe('bg.marketing.activity.enroll.submit');
    expect(e.listEnrollments).toBe('bg.marketing.activity.enroll.list.get');
  });

  it('pa 用 .global 后缀', () => {
    const e = marketingEndpoints({ region: 'pa' });
    expect(e.listActivities).toBe('bg.marketing.activity.list.get.global');
    expect(e.activityDetail).toBe('bg.marketing.activity.detail.get.global');
    expect(e.listSessions).toBe('bg.marketing.activity.session.list.get.global');
    expect(e.listProducts).toBe('bg.marketing.activity.product.get.global');
    expect(e.submitEnroll).toBe('bg.marketing.activity.enroll.submit.global');
    expect(e.listEnrollments).toBe('bg.marketing.activity.enroll.list.get.global');
  });
});
