import { z } from 'zod';

export const DashboardSummaryFilter = z.object({
  shopId: z.string().uuid().optional(),
});
export type DashboardSummaryFilterInput = z.infer<typeof DashboardSummaryFilter>;
