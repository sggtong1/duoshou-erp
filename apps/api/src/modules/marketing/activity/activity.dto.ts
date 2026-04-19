import { z } from 'zod';

export const ListActivitiesFilter = z.object({
  region: z.enum(['cn', 'pa']).optional(),
  status: z.enum(['open', 'closed', 'archived']).optional(),
  search: z.string().optional(),
  shopId: z.string().uuid().optional(),
  startAfter: z.string().datetime().optional(),
  startBefore: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListActivitiesFilterInput = z.infer<typeof ListActivitiesFilter>;
