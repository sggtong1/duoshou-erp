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

export const BatchRejectDto = z.object({
  reviewIds: z.array(z.string().uuid()).min(1).max(50),
  counterPriceCents: z.record(z.string().uuid(), z.number().int().positive()),
});
export type BatchRejectInput = z.infer<typeof BatchRejectDto>;
