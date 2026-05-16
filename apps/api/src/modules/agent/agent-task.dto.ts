import { z } from 'zod';

// ── Task kinds 白名单 ─────────────────────────────────────────────────
// 让 controller 拒绝任意 kind 字符串，避免误派任务
export const TASK_KINDS = [
  // 读类（采集）
  'scrape:activity-data',
  'scrape:settlement',
  'scrape:flux-analysis',
  'scrape:sales-30d',
  'scrape:declared-price',
  'scrape:marketing-activity',
  'scrape:promo',
  // 写类（提交）
  'submit:activity-enroll',
  'submit:price-confirm',
  'submit:price-reject',
] as const;
export type TaskKind = typeof TASK_KINDS[number];

export const TASK_STATUSES = [
  'pending', 'claimed', 'running', 'success', 'failed', 'cancelled',
] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

// ── 创建任务（来自 ERP UI） ──────────────────────────────────────────
export const CreateTaskDto = z.object({
  shopId: z.string().uuid().nullable().optional(),
  kind: z.enum(TASK_KINDS),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  priority: z.number().int().min(0).max(10).optional().default(0),
  maxAttempts: z.number().int().min(1).max(10).optional().default(3),
});
export type CreateTaskInput = z.infer<typeof CreateTaskDto>;

// ── 列表 query ───────────────────────────────────────────────────────
export const ListTasksDto = z.object({
  shopId: z.string().uuid().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  kind: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export type ListTasksInput = z.infer<typeof ListTasksDto>;

// ── 插件原子领取 ─────────────────────────────────────────────────────
export const ClaimTasksDto = z.object({
  pluginInstanceId: z.string().min(8).max(128),
  shopIds: z.array(z.string().uuid()).optional(),  // null/缺省 = 不限店铺
  limit: z.number().int().min(1).max(20).optional().default(5),
  leaseSeconds: z.number().int().min(30).max(3600).optional().default(300),
});
export type ClaimTasksInput = z.infer<typeof ClaimTasksDto>;

// ── 插件上报结果 ─────────────────────────────────────────────────────
export const ReportResultDto = z.object({
  pluginInstanceId: z.string().min(8).max(128),
  status: z.enum(['success', 'failed']),
  result: z.unknown().optional(),
  errorCode: z.string().max(64).optional(),
  errorMessage: z.string().max(2000).optional(),
});
export type ReportResultInput = z.infer<typeof ReportResultDto>;

// ── Heartbeat / 续租 ────────────────────────────────────────────────
export const HeartbeatDto = z.object({
  pluginInstanceId: z.string().min(8).max(128),
  leaseSeconds: z.number().int().min(30).max(3600).optional().default(300),
  progress: z.number().min(0).max(100).optional(),
  message: z.string().max(500).optional(),
});
export type HeartbeatInput = z.infer<typeof HeartbeatDto>;
