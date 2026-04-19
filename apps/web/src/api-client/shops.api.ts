import { http } from './http';

export interface Shop {
  id: string;
  platform: string;
  platformShopId: string;
  shopType: 'full' | 'semi';
  region: 'cn' | 'pa';
  displayName: string | null;
  status: string;
  connectedAt: string;
}

export const shopsApi = {
  list: () => http<Shop[]>('/shops'),
  connect: (input: {
    appKey: string;
    appSecret: string;
    accessToken: string;
    platformShopId: string;
    shopType: 'full' | 'semi';
    region: 'cn' | 'pa';
    displayName?: string;
  }) => http<Shop>('/shops', { method: 'POST', body: JSON.stringify(input) }),
};
