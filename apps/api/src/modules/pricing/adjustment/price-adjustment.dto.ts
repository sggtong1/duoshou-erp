import { z } from 'zod';

export const SubmitAdjustmentDto = z.object({
  shopId: z.string().uuid(),
  items: z.array(z.object({
    platformSkuId: z.string().min(1),
    newPriceCents: z.number().int().positive(),
    skuTitle: z.string().optional(),
    currency: z.string().optional(),
  })).min(1).max(50),
});
export type SubmitAdjustmentInput = z.infer<typeof SubmitAdjustmentDto>;

export const BatchReviewAdjustmentDto = z.object({
  shopId: z.string().uuid(),
  result: z.union([z.literal(1), z.literal(2)]),
  orderSns: z.array(z.string().min(1)).min(1).max(50),
  rejectReasons: z.record(z.string().min(1)).optional(),
});
export type BatchReviewAdjustmentInput = z.infer<typeof BatchReviewAdjustmentDto>;

export interface ListAdjustmentOrdersFilter {
  shopId?: string;
  status?: number;
  page?: number;
  pageSize?: number;
  priceOrderSn?: string;
  search?: string;
  priceType?: number;
  source?: number;
  siteId?: number;
  createdAtBegin?: number;
  createdAtEnd?: number;
}
