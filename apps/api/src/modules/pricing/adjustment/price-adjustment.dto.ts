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
