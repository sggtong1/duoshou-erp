import { http } from './http';

export interface ShopVisibilityEntry {
  shopId: string;
  shopName: string | null;
  canEnroll: boolean;
  lastSeenAt?: string;
}

export interface ActivitySession {
  id: string;
  activityId: string;
  platformSessionId: string;
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  status: string;
}

export interface Activity {
  id: string;
  platformActivityId: string;
  region: 'cn' | 'pa';
  title: string | null;
  activityType: string | null;
  startAt: string | null;
  endAt: string | null;
  enrollStartAt: string | null;
  enrollEndAt: string | null;
  status: 'open' | 'closed' | 'archived';
  shopVisibility: ShopVisibilityEntry[];
  shopCount: number;
  enrolledShopCount: number;
  enrolledSkuCount: number;
  sessions?: ActivitySession[];
}

export interface ActivityProduct {
  platformSkuId: string;
  platformProductId: string | null;
  skuTitle: string | null;
  currentPriceCents: number | null;
  stockQty: number | null;
  currency: string | null;
}

export const activitiesApi = {
  list: (q: {
    region?: string; status?: string; search?: string; shopId?: string;
    startAfter?: string; startBefore?: string; page?: number; pageSize?: number;
  } = {}) =>
    http<{ total: number; page: number; pageSize: number; items: Activity[] }>('/activities', { query: q }),
  get: (id: string) => http<Activity>('/activities/' + id),
  products: (id: string, shopId: string) =>
    http<{ cached: boolean; items: ActivityProduct[]; fetchedAt: string }>(
      '/activities/' + id + '/products',
      { query: { shopId } },
    ),
  syncNow: () => http<{ accepted: boolean; startedAt: string }>('/activities/sync/now', { method: 'POST' }),
};
