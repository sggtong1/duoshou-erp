import { z } from 'zod';

// Schema is input=output (no defaults / no transforms) so ZodValidationPipe's
// ZodSchema<T> contract holds. Post-parse normalization lives in the service.
export const DashboardSummaryFilter = z.object({
  platform: z.enum(['temu', 'tiktok', 'mercadolibre', 'shopee', 'amazon']).optional(),
  region: z.enum(['cn', 'pa']).optional(),
  shopIds: z.string().optional(),
  timeRange: z.enum(['today', '7d', '30d']).optional(),
});
export type DashboardSummaryFilterInput = z.infer<typeof DashboardSummaryFilter>;
