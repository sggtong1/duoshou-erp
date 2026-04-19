import { z } from 'zod';

export const SubmitEnrollmentDto = z.object({
  activityId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  items: z.array(z.object({
    shopId: z.string().uuid(),
    platformSkuId: z.string().min(1),
    skuTitle: z.string().optional(),
    activityPriceCents: z.number().int().positive(),
    currency: z.string().optional(),
  })).min(1).max(200),
});
export type SubmitEnrollmentInput = z.infer<typeof SubmitEnrollmentDto>;

export const ListEnrollmentsFilter = z.object({
  activityId: z.string().uuid().optional(),
  shopId: z.string().uuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'withdrawn', 'failed']).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListEnrollmentsFilterInput = z.infer<typeof ListEnrollmentsFilter>;
