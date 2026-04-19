import { http } from './http';

export interface PriceAdjustmentOrder {
  id: string;
  shopId: string;
  platformOrderId: string | null;
  platformSkuId: string;
  skuTitle: string | null;
  oldPriceCents: number | null;
  newPriceCents: number;
  currency: string | null;
  status: 'submitted' | 'approved' | 'rejected' | 'failed';
  submittedAt: string;
  resolvedAt: string | null;
  error: any;
}

export interface SubmitAdjustmentItem {
  platformSkuId: string;
  newPriceCents: number;
  skuTitle?: string;
  currency?: string;
}

export const priceAdjustmentsApi = {
  submit: (shopId: string, items: SubmitAdjustmentItem[]) =>
    http<any>('/price-adjustments', { method: 'POST', body: JSON.stringify({ shopId, items }) }),
  list: () => http<PriceAdjustmentOrder[]>('/price-adjustments'),
};
