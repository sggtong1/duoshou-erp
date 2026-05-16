import { z } from 'zod';

export const ListReviewsFilter = z.object({
  shopId: z.string().uuid().optional(),
  status: z.enum(['pending', 'confirmed', 'rejected', 'expired']).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListReviewsFilterInput = z.infer<typeof ListReviewsFilter>;

export const BatchConfirmDto = z.object({
  reviewIds: z.array(z.string().uuid()).min(1).max(50),
});
export type BatchConfirmInput = z.infer<typeof BatchConfirmDto>;

export const RejectReasonDto = z.object({
  type: z.number().int().min(0).max(8),
  reason: z.string().min(1).max(300),
});

export const RejectReviewItemDto = z.object({
  reviewId: z.string().uuid(),
  counterPriceCents: z.number().int().positive().optional(),
  priceItems: z.array(z.object({
    productSkuId: z.union([z.string().min(1), z.number().int().positive()]),
    priceCents: z.number().int().positive(),
  })).min(1).max(100).optional(),
  reasons: z.array(RejectReasonDto).min(1).max(20).optional(),
  externalLinks: z.array(z.string().url()).max(5).optional(),
});
export type RejectReviewItemInput = z.infer<typeof RejectReviewItemDto>;

export const BatchRejectDto = z.object({
  reviewIds: z.array(z.string().uuid()).min(1).max(50).optional(),
  counterPriceCents: z.record(z.string().uuid(), z.number().int().positive()).optional(),
  items: z.array(RejectReviewItemDto).min(1).max(50).optional(),
}).refine((v) => !!v.items?.length || (!!v.reviewIds?.length && !!v.counterPriceCents), {
  message: 'items or reviewIds + counterPriceCents is required',
});
export type BatchRejectInput = z.infer<typeof BatchRejectDto>;
