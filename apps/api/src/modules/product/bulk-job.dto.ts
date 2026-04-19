import { z } from 'zod';

export const DispatchPublishDto = z.object({
  templateId: z.string().uuid(),
  shopIds: z.array(z.string().uuid()).min(1),
  priceCentsOverrides: z.record(z.string().uuid(), z.number().int().positive()).optional(),
  semiSitesByShop: z.record(z.string().uuid(), z.array(z.number().int().positive())).optional(),
  freightTemplatesByShop: z.record(z.string().uuid(), z.string().min(1)).optional(),
});
export type DispatchPublishInput = z.infer<typeof DispatchPublishDto>;
