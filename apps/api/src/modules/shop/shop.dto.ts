import { z } from 'zod';

export const ConnectShopDto = z.object({
  appKey: z.string().min(16, 'appKey looks too short'),
  appSecret: z.string().min(16),
  accessToken: z.string().min(16),
  shopType: z.enum(['full', 'semi']),
  region: z.enum(['cn', 'pa']),
  displayName: z.string().optional(),
});
export type ConnectShopInput = z.infer<typeof ConnectShopDto>;

export const ShopResponseSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string(),
  platform: z.string(),
  platformShopId: z.string(),
  shopType: z.string(),
  region: z.string(),
  displayName: z.string().nullable(),
  status: z.string(),
  connectedAt: z.date(),
});
export type ShopResponse = z.infer<typeof ShopResponseSchema>;
