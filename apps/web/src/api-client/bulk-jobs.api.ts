import { http } from './http';

export interface BulkJobItem {
  id: string;
  shopId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  resultProductId: string | null;
  error: any;
  shop: { id: string; displayName: string | null; platformShopId: string; shopType: string };
}

export interface BulkJob {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total: number;
  succeeded: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items?: BulkJobItem[];
}

export interface DispatchPublishInput {
  templateId: string;
  shopIds: string[];
  priceCentsOverrides?: Record<string, number>;
  semiSitesByShop?: Record<string, number[]>;
  freightTemplatesByShop?: Record<string, string>;
}

export const bulkJobsApi = {
  dispatchPublish: (input: DispatchPublishInput) =>
    http<BulkJob>('/bulk-jobs/publish', { method: 'POST', body: JSON.stringify(input) }),
  list: () => http<BulkJob[]>('/bulk-jobs'),
  get: (id: string) => http<BulkJob>('/bulk-jobs/' + id),
};
