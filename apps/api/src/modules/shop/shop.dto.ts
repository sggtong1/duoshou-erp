import { z } from 'zod';

export const ConnectShopDto = z.object({
  appKey: z.string().min(16, 'appKey looks too short'),
  appSecret: z.string().min(16),
  accessToken: z.string().min(16),
  platformShopId: z.string().min(1, 'Temu shop id is required'),
  shopType: z.enum(['full', 'semi']),
  region: z.enum(['cn', 'pa']),
  displayName: z.string().optional(),
});
export type ConnectShopInput = z.infer<typeof ConnectShopDto>;

export const TestConnectionDto = z.object({
  appKey: z.string().min(1),
  appSecret: z.string().min(1),
  accessToken: z.string().min(1),
  platformShopId: z.string().min(1),
  shopType: z.enum(['full', 'semi']),
  region: z.enum(['cn', 'pa']),
});
export type TestConnectionInput = z.infer<typeof TestConnectionDto>;

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
