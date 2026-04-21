import { z } from 'zod';

export const UpdateSettingsDto = z.object({
  lowStockThreshold: z.number().int().min(0).max(100000).optional(),
  lowStockDaysThreshold: z.number().int().min(0).max(365).optional(),
});
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsDto>;
