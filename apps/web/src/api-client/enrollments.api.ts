import { http } from './http';

export interface EnrollmentItem {
  shopId: string;
  platformSkuId: string;
  skuTitle?: string;
  activityPriceCents: number;
  currency?: string;
}

export interface Enrollment {
  id: string;
  shopId: string;
  activityId: string;
  sessionId: string | null;
  platformSkuId: string;
  skuTitle: string | null;
  activityPriceCents: number | null;
  currency: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'failed';
  rejectReason: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  error: any;
  shop: { id: string; displayName: string | null; platformShopId: string };
  activity: { id: string; title: string | null; region: string; platformActivityId: string };
}

export interface SubmitResult {
  total: number;
  results: Array<{ shopId: string; platformSkuId: string; ok: boolean; enrollmentId?: string; error?: string }>;
}

export const enrollmentsApi = {
  list: (q: { activityId?: string; shopId?: string; status?: string; page?: number; pageSize?: number } = {}) =>
    http<{ total: number; page: number; pageSize: number; items: Enrollment[] }>('/enrollments', { query: q }),
  submit: (body: { activityId: string; sessionId?: string; items: EnrollmentItem[] }) =>
    http<SubmitResult>('/enrollments/submit', { method: 'POST', body: JSON.stringify(body) }),
  refresh: (id: string) => http<Enrollment>('/enrollments/' + id + '/refresh', { method: 'POST' }),
  syncNow: () => http<{ accepted: boolean; startedAt: string }>('/enrollments/sync/now', { method: 'POST' }),
};
