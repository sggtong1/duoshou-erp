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

export interface TestConnectionInput {
  appKey: string;
  appSecret: string;
  accessToken: string;
  platformShopId: string;
  shopType: 'full' | 'semi';
  region: 'cn' | 'pa';
}

export interface TestConnectionResult {
  ok: boolean;
  shopInfo?: any;
  error?: string;
}

export const shopsApi = {
  list: () => http<Shop[]>('/shops'),
  connect: (input: TestConnectionInput & { displayName?: string }) =>
    http<Shop>('/shops', { method: 'POST', body: JSON.stringify(input) }),
  testConnection: (input: TestConnectionInput) =>
    http<TestConnectionResult>('/shops/test-connection', { method: 'POST', body: JSON.stringify(input) }),
  disconnect: (id: string) =>
    http<{ ok: boolean }>('/shops/' + id, { method: 'DELETE' }),
};
