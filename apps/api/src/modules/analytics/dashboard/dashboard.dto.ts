import { z } from 'zod';

export const DashboardSummaryFilter = z.object({
  platform: z.enum(['temu', 'tiktok', 'mercadolibre', 'shopee', 'amazon']).optional(),
  region: z.enum(['cn', 'pa']).optional(),
  shopIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)),
  timeRange: z.enum(['today', '7d', '30d']).default('30d'),
});
export type DashboardSummaryFilterInput = z.infer<typeof DashboardSummaryFilter>;
