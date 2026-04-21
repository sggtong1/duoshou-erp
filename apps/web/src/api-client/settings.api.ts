import { http } from './http';

export interface OrgSettings {
  lowStockThreshold: number;
  lowStockDaysThreshold: number;
}

export const settingsApi = {
  get: () => http<OrgSettings>('/settings'),
  update: (patch: Partial<OrgSettings>) =>
    http<OrgSettings>('/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
};
