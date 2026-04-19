import { http } from './http';

export interface Product {
  id: string;
  shopId: string;
  platformProductId: string;
  title: string;
  status: string;
  lastSyncedAt: string;
  shop: { id: string; displayName: string | null; platformShopId: string; shopType: string };
}

export const productsApi = {
  list: (q: { shopId?: string; status?: string; search?: string; page?: number; pageSize?: number } = {}) =>
    http<{ total: number; page: number; pageSize: number; items: Product[] }>('/products', { query: q }),
};
