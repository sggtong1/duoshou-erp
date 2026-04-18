# 舵手 ERP v1 设计方案

- **状态**: 头脑风暴完成，待用户 final review
- **日期**: 2026-04-18
- **作者**: Claude + mx4c
- **适用范围**: v1 首版上架 Temu 应用市场；v1.5 / v2 仅做路线图约束

---

## 1. 背景 & 定位

**一句话**: 舵手 ERP 是面向 Temu 多店铺卖家的「跨店聚合 + 批量操作」SaaS 工作台，以**三方应用**形式发布到 Temu 应用市场，供商家授权安装。

**触发**: 用户（Temu 服务商主账号持有者）已通过 Temu 开发者权限审核，需要填写 MMS 应用发布表、提交一款真实 SaaS 上线运行；应用名称已定为「舵手ERP」。

**差异化 = 三个硬卖点**：
1. **跨店聚合视角**——所有看板（核价单 / 库存 / 活动 / 销售）天然是多店合并视图，商家无需切账号切店铺
2. **批量操作工作流**——不是"每个 API 单次封装"，而是"一次操作影响多店多 SKU"的任务编排
3. **伪 Webhook 事件总线**——Temu 没给 webhook，我们用智能轮询 + 变更检测让商家体验"实时通知"（核价单到达、活动开放、库存低、价格变化）

## 2. 目标用户

- **核心**: 管理 3–30 家 Temu 店铺的中小商家 / MCN / 品牌代运营团队
- **店铺类型**: 全托管（Full-managed）+ 半托管（Semi-managed）通吃
- **次要**: v2 起扩展到跨平台多店（Amazon / Shopee / Shein）场景

不是目标用户：单店铺自用商家（价值不够）、百店以上规模的大品牌（需求深度超过 v1 能力）。

## 3. 产品路线图（阶梯式）

### v1（2–4 周）— 全托+半托通吃的 4 大模块

| # | 模块 | 解决的痛点 |
|---|---|---|
| 1 | 跨店发品中心 | 一条货品信息一键同步发到 N 家店，带智能类目映射、多站点分发、批量改图改属性 |
| 2 | 核价调价工作台 | 跨店聚合核价单到一个看板、批量确认/拒绝；半托调价批处理；价格变动通知 |
| 3 | 活动日历+批量报名 | 日历视图看所有站点活动，跨店跨品批量报名，一键操作 |
| 4 | 多店库存看板 | SKU 维度跨店跨仓聚合表、低库存预警、跨店一键调整 |

v1 不做备货发货、不做广告、不做 BI——这些放 v1.5 / v2。

### v1.5（再 3–4 周）— 面向全托深挖

5. **广告管理**（仅全托，API 已限定 `bg.glo.searchrec.ad.*`）
6. **销售数据 BI**（主要基于 `bg.goods.salesv2.get` 全托数据 + 自定义聚合）
7. **多店订单/提醒中心**（伪 Webhook 事件汇总、消息中心、通知渠道配置）

### v2（再 4–6 周）

8. 备货&发货履约台（全托专属）
9. 售后/退货/质检管理
10. 多平台扩展（Amazon / Shopee / Shein），复用数据中立 schema

## 4. 商业模式

**完全免费走量战略**，v1 不做计费系统：
- 所有功能对所有授权商家免费开放
- 架构上留「功能开关 / 配额」的钩子，但 v1 不启用
- 未来变现路径（不在 v1 范围）：Temu 应用市场分成 / 增值服务 / 数据看板付费版 / 定制开发

## 5. 账号与租户模型

```
User ──── Member ──── Organization ──── Shop
(登录者)  (角色位)   (商家主体)        (Temu 店铺)
                                        │
                                        ├─ platform: 'temu'（v2 扩）
                                        ├─ shop_type: 'full'|'semi'
                                        ├─ region: 'cn'|'pa'
                                        ├─ platform_shop_id
                                        └─ creds_vault_ref → KMS 加密凭据
```

**MVP 表现**：`Organization` 下所有 `Member` 同权限，共看所有 `Shop`。

**预留字段**：`Member.role` 枚举 `owner/admin/staff`，v1 默认 `owner`，不启用分权 UI。

**架构灵活度**：一个 User 可加入多个 Organization（帮 A 商家打工的同时兼职 B 商家）——实际不多但保留扩展。

## 6. v1 四模块映射到 Temu API

### 6.1 跨店发品中心

| 用户动作 | 调用的 API |
|---|---|
| 新建货品模板 | 本地保存（不调 API） |
| 类目选择 | `bg.goods.cats.get` / `bg.goods.category.match` / `bg.goods.category.mapping` |
| 属性填写 | `bg.goods.attrs.get` |
| 尺码表 | `bg.goods.sizecharts.class.get` / `bg.goods.sizecharts.meta.get` / `bg.goods.sizecharts.create` / `bg.goods.sizecharts.template.create` |
| 图片上传 | `bg.goods.image.upload.global` / `bg.goods.video.upload.sign.get.global` |
| 批量发品 | `bg.glo.goods.add` (PA) / `bg.goods.add` (CN)，按 shop.region 分发 |
| 查询进度 | `bg.glo.product.search` / `bg.product.search` |
| 编辑已发品 | `bg.goods.update` / `bg.goods.edit` / `bg.goods.edit.pictures.submit` / `bg.goods.edit.task.apply`+`bg.goods.edit.task.submit` |

**工作流**: 模板 → 选店 → 差异化映射（站点/价格/类目） → 批量提交 → 伪 Webhook 跟进进度 → 失败重试

### 6.2 核价调价工作台

| 用户动作 | 调用的 API |
|---|---|
| 拉取待处理核价单 | `bg.price.review.page.query` (全托) / `bg.semi.price.review.page.query.order` (半托) |
| 批量确认 | `bg.price.review.confirm` / `bg.semi.price.review.confirm.order` |
| 批量拒绝 | `bg.price.review.reject` / `bg.semi.price.review.reject.order` |
| 历史价格 | `bg.goods.price.list.get` / `bg.glo.goods.price.list.get` |
| 主动调价（半托） | `bg.semi.adjust.price.batch.review` / `bg.semi.adjust.price.page.query` |
| 主动调价（全托） | `bg.full.adjust.price.batch.review` / `bg.full.adjust.price.page.query` |
| 建议申报价 | `bg.goods.suggest.supplyprice.get`（自研专属，单店 100 次/天） |

**伪 Webhook 事件**：`price.review.received`、`price.changed`、`price.review.expiring`

### 6.3 活动日历+批量报名

| 用户动作 | 调用的 API |
|---|---|
| 活动列表 | `bg.marketing.activity.list.get` / `.get.global` |
| 活动详情 | `bg.marketing.activity.detail.get` / `.get.global` |
| 场次 | `bg.marketing.activity.session.list.get` / `.get.global` |
| 可报名商品 | `bg.marketing.activity.product.get` / `.get.global` |
| 批量报名 | `bg.marketing.activity.enroll.submit` / `.submit.global` |
| 报名结果 | `bg.marketing.activity.enroll.list.get` / `.get.global` |

**工作流**: 日历视图 → 点活动查可报名商品 → 多选跨店商品 → 提交报名 → 结果看板

**伪 Webhook 事件**：`activity.opened`、`activity.enrollment.approved`、`activity.enrollment.rejected`

### 6.4 多店库存看板

| 用户动作 | 调用的 API |
|---|---|
| SKU 库存列表 | `bg.goods.quantity.get` / `bg.btg.goods.stock.quantity.get` |
| 更新库存 | `bg.goods.quantity.update` / `bg.btg.goods.stock.quantity.update` |
| 仓库列表 | `bg.goods.warehouse.list.get` / `bg.btg.goods.stock.warehouse.list.get` |
| 路线库存 | `bg.goods.routestock.add` / `bg.btg.goods.stock.route.add` |
| JIT 虚拟库存 | `bg.virtualinventoryjit.get/edit` / `bg.qtg.stock.virtualinventoryjit.get/edit` |

**伪 Webhook 事件**: `inventory.low`, `inventory.out_of_stock`, `inventory.restocked`

## 7. 系统架构

### 7.1 总体拓扑

```
┌─────────────────────────────────────────────────────┐
│ Vue 3 SPA (Naive UI) — 商家端控制台 + 小型服务商后台   │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS / WebSocket
┌─────────────────▼───────────────────────────────────┐
│ NestJS Monolith                                      │
│ ├─ HTTP Controllers (REST /api/v1/*)                 │
│ ├─ WebSocket Gateway (实时事件推前端)                 │
│ ├─ Business Modules                                  │
│ │   ├─ ProductModule                                 │
│ │   ├─ PriceModule                                   │
│ │   ├─ ActivityModule                                │
│ │   └─ InventoryModule                               │
│ ├─ Platform Adapters: PlatformClient 接口             │
│ │   └─ TemuClient(impl) ← 代码生成器产出              │
│ ├─ Internal Event Bus (NestJS EventEmitter)          │
│ └─ BullMQ Worker (同进程): Polling / BulkOp / Retry   │
└─┬────────────────┬───────────────────┬──────────────┘
  │                │                   │
┌─▼──────┐  ┌──────▼────┐      ┌───────▼─────────────┐
│ PG     │  │ Redis     │      │ External Services   │
│(Supa)  │  │ - 限速    │      │ - Temu Open API     │
│        │  │ - 缓存    │      │ - 邮件/飞书/钉钉     │
│        │  │ - 队列    │      │ - Sentry            │
└────────┘  └───────────┘      └─────────────────────┘
```

### 7.2 关键设计决策

1. **单体 MVP**：所有业务模块共享一个 NestJS 进程；队列 Worker 起步同进程跑，规模化后拆成独立 Worker 进程
2. **Platform Adapter 层是唯一抽象点**：v1 只有 `TemuClient`，v2 加 `AmazonClient` 只在这里扩；业务服务层依赖 `PlatformXxxClient` 接口而非具体实现
3. **RateLimitedClient 装饰器**：对 Temu API 的调用必须经过此装饰器，Redis token bucket 按 shop 维度限 3–5 qps，溢出自动排队
4. **幂等键**：批量操作的每条子任务带 `idempotency_key`（`{org_id}:{bulk_job_id}:{item_id}:{op_type}` 的 SHA256），失败重试不会重复提交
5. **凭据隔离**：店铺的 `app_key / app_secret / access_token` 用 AES-256-GCM 加密存表，master key 放服务器 env；`creds_vault_ref` 字段是凭据 row 的指针，日志里永远不打印明文

## 8. 数据模型（核心表）

### 8.1 身份 & 租户

```sql
create table user (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text,
  auth_provider text not null default 'supabase',
  created_at timestamptz default now()
);

create table organization (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table member (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references "user"(id),
  org_id uuid not null references organization(id),
  role text not null default 'owner',  -- owner|admin|staff (v1 只用 owner)
  created_at timestamptz default now(),
  unique(user_id, org_id)
);
```

### 8.2 平台接入层

```sql
create table shop (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organization(id),
  platform text not null check (platform in ('temu')),  -- v2 扩
  platform_shop_id text not null,
  shop_type text not null check (shop_type in ('full','semi')),
  region text not null check (region in ('cn','pa')),
  display_name text,
  creds_vault_ref uuid not null references shop_credentials(id),
  access_token_expires_at timestamptz,
  status text not null default 'active',
  connected_at timestamptz default now(),
  unique(org_id, platform, platform_shop_id)
);
create index shop_org_platform_idx on shop(org_id, platform);

create table shop_credentials (
  id uuid primary key default gen_random_uuid(),
  app_key_encrypted bytea not null,
  app_secret_encrypted bytea not null,
  access_token_encrypted bytea not null,
  encryption_version int not null default 1,
  created_at timestamptz default now()
);
```

### 8.3 业务对象（平台中立）

```sql
create table product_template (
  id uuid primary key,
  org_id uuid not null,
  name text not null,
  common_attrs jsonb not null default '{}',
  platform_specific jsonb not null default '{}',  -- Temu 的怪字段塞这
  created_at timestamptz default now()
);

create table product (
  id uuid primary key,
  org_id uuid not null,
  shop_id uuid not null references shop(id),
  template_id uuid references product_template(id),
  platform text not null,
  platform_product_id text not null,
  title text,
  status text,
  common_attrs jsonb not null default '{}',
  platform_specific jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(shop_id, platform_product_id)
);
create index product_org_platform_idx on product(org_id, platform);

create table sku (
  id uuid primary key,
  product_id uuid not null references product(id),
  platform_sku_id text not null,
  barcode text,
  price_cents bigint,
  stock int,
  spec jsonb not null default '{}',
  unique(product_id, platform_sku_id)
);

create table price_review (
  id uuid primary key,
  org_id uuid not null,
  shop_id uuid not null,
  platform_review_id text not null,
  sku_id uuid references sku(id),
  current_price_cents bigint,
  proposed_price_cents bigint,
  status text not null default 'pending',  -- pending|confirmed|rejected|expired
  received_at timestamptz default now(),
  resolved_at timestamptz,
  unique(shop_id, platform_review_id)
);

create table activity (
  id uuid primary key,
  org_id uuid not null,
  shop_id uuid not null,
  platform_activity_id text not null,
  type text,
  title text,
  site_list jsonb,
  period tstzrange,
  enrollment_status text,
  unique(shop_id, platform_activity_id)
);

create table activity_enrollment (
  id uuid primary key,
  activity_id uuid not null references activity(id),
  product_id uuid references product(id),
  status text,
  submitted_at timestamptz default now()
);

create table inventory_snapshot (
  id bigserial primary key,
  shop_id uuid not null,
  sku_id uuid references sku(id),
  warehouse_id text,
  qty int,
  snapshot_at timestamptz default now()
) partition by range (snapshot_at);
-- 月分区 (inventory_snapshot_2026_04, ...)

create table inventory_alert (
  id uuid primary key,
  org_id uuid not null,
  sku_id uuid,
  level text not null check (level in ('low','out','recovered')),
  triggered_at timestamptz default now(),
  acknowledged_at timestamptz
);
```

### 8.4 事件 & 任务

```sql
create table event (
  id uuid primary key,
  org_id uuid not null,
  shop_id uuid,
  type text not null,  -- price.review.received / activity.opened / inventory.low ...
  payload jsonb not null,
  dispatched_at timestamptz default now()
) partition by range (dispatched_at);

create table polling_cursor (
  id uuid primary key,
  shop_id uuid not null,
  resource_type text not null,  -- price_review / activity / inventory / ...
  last_poll_at timestamptz,
  next_poll_at timestamptz,
  last_state_hash text,  -- 稳定哈希用于变更检测
  unique(shop_id, resource_type)
);

create table bulk_job (
  id uuid primary key,
  org_id uuid not null,
  type text not null,  -- listing_bulk_create / price_bulk_confirm / ...
  total int not null default 0,
  succeeded int not null default 0,
  failed int not null default 0,
  status text not null default 'pending',  -- pending|running|completed|failed
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table bulk_job_item (
  id uuid primary key,
  job_id uuid not null references bulk_job(id),
  ref_id text,
  status text not null default 'pending',
  idempotency_key text not null,
  error jsonb,
  created_at timestamptz default now()
);
create index bulk_job_item_job_idx on bulk_job_item(job_id, status);
```

### 8.5 索引 / 分区要点

- **租户隔离**: 所有业务表用 `(org_id, ...)` 复合索引
- **时序表分区**: `inventory_snapshot` / `event` 按月分区（Postgres declarative partitioning）
- **Supabase RLS**: 所有业务表开 Row Level Security，策略基于 `auth.uid()` → `member.org_id` 推导租户；后端 NestJS 用 service_role key 绕过 RLS 做跨租户运维

## 9. API 代码生成器（舵手特色技术资产）

### 9.1 输入

214 篇 Temu 接口文档的 `interfaceDocument` JSON（我们已经抓到 `/tmp/temu-fetch/docs/` + 原始结构在 `peek-iface.json` 验证过）：

```json
{
  "interfaceType": "bg.goods.add",
  "interfaceName": "上传供应商货品",
  "requestUrl": "/openapi/router",
  "commonRequestParam": [...],
  "requestParam": [
    {"paramType": 4, "paramName": "type", "required": true, "desc": "...", "openParamList": null},
    {"paramType": 6, "paramName": "productSemiManagedReq", "required": false, "openParamList": [...]}
  ],
  "responseParam": [...]
}
```

`paramType` 枚举：1=number, 4=string, 6=object, 8=array（还需在 W0 验证完整映射表）。

### 9.2 输出

```
packages/temu-sdk/
├─ src/
│  ├─ generated/
│  │  ├─ types.ts           ← 所有 Request / Response TypeScript 类型
│  │  └─ methods.ts         ← 214 个方法签名 + 调用胶水
│  ├─ signing.ts            ← 签名算法实现（来自「签名规则」文档）
│  ├─ rate-limiter.ts       ← Redis token bucket
│  ├─ retry-policy.ts       ← 重试策略（按错误码分类）
│  └─ client.ts             ← TemuClient 类，组合以上
├─ spec/                    ← 输入：214 篇接口 JSON schema
└─ codegen.ts               ← 生成器，~300 行 TS
```

### 9.3 收益

- 业务代码：`await temu(shop).bg_goods_add({ productName, ... })` — 全类型提示
- 接口变更：重跑 `pnpm codegen` 一键同步
- 文档：产出 `docs/temu-api-reference.generated.md` 作为项目内查阅

**不使用 OpenAPI Generator**：Temu 没给 OpenAPI spec，他们的 `paramType` 枚举 + `openParamList` 嵌套结构是私有格式，我们写 300 行自己的 codegen 比适配通用工具更准。

## 10. 伪 Webhook 事件总线

### 10.1 轮询分档

| 优先级 | 轮询周期 | 资源类型 |
|---|---|---|
| P1 | 1 分钟 | price_review（核价单到达）、activity（活动开放） |
| P2 | 10 分钟 | inventory（库存变化）、goods_status（货品状态） |
| P3 | 1 小时 | sales（销售数据）、aftersale（退货/质检）、settlement |

### 10.2 变更检测

```
PollScheduler(BullMQ cron) → TemuClient.list(rate-limited)
          │
          ▼
ChangeDetector:
  1. 对 list 响应做稳定哈希（只保留业务字段，忽略时间戳）
  2. 查 polling_cursor.last_state_hash
  3. 不同 → 计算 diff → 生成 N 条 Event
  4. 更新 last_state_hash + next_poll_at
          │
          ▼
EventBus (NestJS EE)
  ├→ 写入 event 表（持久化 + 查询）
  ├→ WebSocket 推前端（在线用户秒级看见）
  └→ NotificationDispatcher → 邮件 / 飞书 / 钉钉 webhook
```

### 10.3 事件命名约定

`{domain}.{verb}`，如 `price.review.received` / `activity.opened` / `inventory.low` / `inventory.restocked` / `price.changed` / `goods.listing.succeeded` / `goods.listing.failed`

## 11. 部署拓扑 & 代码仓库结构

### 11.1 Monorepo 布局（pnpm workspaces）

```
duoshou-erp/
├─ apps/
│  ├─ api/                  NestJS 后端（HTTP + WS + Workers 同进程起步）
│  │  ├─ src/
│  │  │  ├─ modules/        business modules: product, price, activity, inventory
│  │  │  ├─ platform/       PlatformClient 接口 + adapter 注册
│  │  │  ├─ infra/          redis / queue / ratelimit / crypto
│  │  │  └─ events/         事件总线 / WebSocket gateway / 通知渠道
│  │  └─ test/
│  └─ web/                  Vue 3 SPA (Naive UI)
│     ├─ src/
│     │  ├─ pages/
│     │  ├─ components/
│     │  ├─ stores/         Pinia
│     │  └─ api-client/     apps/api 的 REST client（类型复用 packages/shared-types）
│     └─ test/
├─ packages/
│  ├─ temu-sdk/             代码生成产物：214 个 Temu API 方法 + 签名/限速/重试
│  │  ├─ src/generated/     codegen 输出（不手工改）
│  │  ├─ spec/              输入 JSON schema（从 /tmp/temu-fetch/docs 移入）
│  │  └─ codegen.ts         生成器脚本
│  └─ shared-types/         前后端共享 DTO 类型（手写 + codegen 混合）
├─ docs/
│  ├─ superpowers/
│  │  ├─ specs/             设计 spec（本文档所在）
│  │  └─ plans/             实施计划（writing-plans 产出）
│  └─ references/temu/      Temu 官方文档归档（_index.md 等）
├─ infra/
│  ├─ docker/               Dockerfile + compose
│  └─ deploy/               部署脚本、nginx conf
├─ .env.development.example
├─ .env.production.example
├─ pnpm-workspace.yaml
└─ package.json
```

### 11.2 运行时拓扑

```
duoshou.868818.xyz
       │ Cloudflare (HTTPS / CDN / WAF)
       ▼
┌─────────────────────────────────────────┐
│ App 服务器 (阿里云 ECS 2C4G 起步)         │
│ Docker Compose:                         │
│   - nginx (反代 + 静态 Vue 构建产物)      │
│   - nest-api    (NestJS HTTP + WS)      │
│   - nest-worker (BullMQ workers)        │
│   - redis                               │
│   - (可选) prometheus + grafana          │
└─────────────────┬───────────────────────┘
                  │ 南北通
┌─────────────────▼───────────────────────┐
│ Supabase (PostgreSQL + Auth + Storage)   │
│ - DB (主库)                              │
│ - Auth (起步)                            │
│ - Storage (测试期图片)                   │
└──────────────────────────────────────────┘

+ 第三方：Sentry（错误追踪）、飞书/钉钉（通知）
```

**CI/CD**: GitHub Actions → SSH 部署到 ECS (`docker compose pull && docker compose up -d`)。起步不用 K8s。

**域名**: 
- `duoshou.868818.xyz` → 商家端 SPA + API
- 后期需要可加 `api.duoshou.868818.xyz`（若 API 单独做网关）、`admin.duoshou.868818.xyz`（服务商内部看板）

## 12. 发布里程碑

| 周 | 里程碑 | 交付物 |
|---|---|---|
| **W0** | 地基完工 | 代码脚手架 (monorepo 结构)、代码生成器产出 214 个 TS API 方法、OAuth/授权接入流通、租户&店铺数据模型、限速+重试组件、Supabase 接入、CI/CD 可部署到 ECS |
| **W1** | 跨店发品中心 | 货品模板 CRUD、批量发品工作流、类目/属性/尺码表联动、上传组件、进度跟踪、失败重试 |
| **W2a** | 核价调价工作台 | 多店核价聚合、批量确认/拒绝、调价申请、历史价格曲线、伪 Webhook「核价单到达」事件 |
| **W2b** | 活动日历+报名 | 活动日历视图、跨站点过滤、批量报名、报名结果看板、伪 Webhook「活动开放」事件 |
| **W3** | 库存看板 + 伪 Webhook 全量 | SKU 跨店跨仓表、低库存预警、WebSocket 实时推送、通知渠道（邮件/飞书） |
| **W4** | 测试 + 提审 + 上线 | E2E 测试（OAuth 全流程 + 关键业务）、Temu 应用发布表填报、提审、修 bug 迭代、**发布到 Temu 应用市场** |

**风险缓冲**：
- W0 是硬边界，代码生成器做不出会拖整个计划
- Temu 审核常见来回 1–2 轮、每轮 3–7 天；W4 测试 + 提审并行走，不等审过再开 v1.5

## 13. 技术选型（ADR 摘要）

| ID | 决策 | 理由 |
|---|---|---|
| ADR-1 | 后端 NestJS + TS | 聚合 N 店铺 API 是 I/O 密集场景，Node 事件循环为此而生；TS 前后端共享 DTO |
| ADR-2 | 前端 Vue 3 + Naive UI | 国内开发者最熟；Naive UI 大表格/批量操作组件成熟 |
| ADR-3 | PG 起步 Supabase 托管 | 用户熟悉 Supabase；DAO 层抽象，后期迁国内云 PG 是几天工作 |
| ADR-4 | 多平台抽象：数据中立 + API Temu 绑 + UI Temu 专用 | 平衡 v1 速度与 v2 扩展成本 |
| ADR-5 | 单体 NestJS 起步 | 2C4G 够跑；规模化再拆 |
| ADR-6 | 代码生成器自写而非 OpenAPI Generator | Temu 私有 schema，自写 300 行更准 |
| ADR-7 | 伪 Webhook = 智能轮询 + 变更检测 + 内部事件总线 | Temu 无 webhook，必须补这层 |
| ADR-8 | Supabase Auth 起步 | 用户指定；后期切 Better Auth / Lucia 难度不大 |
| ADR-9 | 凭据 AES-256-GCM 加密，master key 放 env | 起步简单；规模化后接 KMS |
| ADR-10 | Shell/Redis token bucket 限速 | 每 shop 3-5 qps 限制，Redis 原子操作实现 |

## 14. 开放问题（待 W0 验证 / 实施中决策）

| # | 问题 | 处理策略 |
|---|---|---|
| 1 | Temu 三方应用的商家授权流是 **OAuth redirect** 还是 **手动复制 access_token**？ | W0 第 1 天验证：试跑一次三方应用授权流，确定 UX |
| 2 | `paramType` 枚举的完整映射表（1/4/6/8 之外是否还有值） | W0 代码生成器开发时从 214 个 JSON 聚合去重提取 |
| 3 | Supabase 境外托管的延迟在国内是否可接受？ | W0 部署后用真实商家凭据压测 20 店并发；>500ms 考虑改用国内 PG |
| 4 | 每个 Temu 接口的真实 QPS 上限（文档写 3-5 qps/店） | W0 用测试账号压测确认，写入 `rate-limiter.ts` 配置 |
| 5 | 图片 / 视频文件的存储策略：Supabase Storage 够用吗 | v1 够用（测试期流量小），v1.5 前切 OSS |
| 6 | Member 角色权限 v2 启用时 UI 怎么表达？ | v2 设计阶段再做，v1 只预留字段 |
| 7 | 应用审核被拒最可能的原因（合规/隐私/功能完整度） | W4 提审前对照 Temu 审核清单自检 |

## 15. 非目标（YAGNI 删除）

以下明确**不在 v1 范围**，防止 scope creep：
- 备货单 / 发货单 / 装箱发货（v2）
- 广告创建/修改（v1.5）
- 销售数据 BI（v1.5）
- 售后/退货/质检管理（v2）
- 多平台（Amazon / Shopee）接入（v2）
- 付费分档 / 计费系统
- 英文 / 多语言 UI
- Member 角色权限细分（v2）
- 移动端 App（Web 响应式起步）
- 公开 API / Webhook 对外（舵手自己对别人不提供 API）
- 大规模数据导入/导出（Excel 批量上传走基础版即可，高级映射 v1.5）

## 16. 附录

### A. 参考资料

- `/tmp/temu-fetch/docs/_index.md` — 214 篇 Temu 官方文档的索引（待移入 `docs/references/temu/` 并 commit）
- `/tmp/temu-fetch/docs/_trees.json` — 完整目录树
- `/tmp/temu-fetch/docs/_leaves.json` — 所有 documentId + directoryId 映射

### B. 凭据管理

测试账号来源：Temu 官方在文档中心提供 2 个全托 + 3 个半托沙箱账号，字段为 `app_key / app_secret / access_token / shop_id / shop_name`。

**凭据入口规范**：
- `.env.development`（gitignored）：实际凭据放这里，开发者自己从 Temu 文档复制
- `.env.development.example`（in git）：字段名 + 占位符，新成员照着填
- `.env.production`：通过运维管道注入（W4 上线前建立，不落盘）
- **永远不把凭据写进 spec / plan / commit message / 日志**

`.env.development.example` 示例结构：
```
# Temu 全托测试账号 1（girl clothes, shop_id=1052202882）
TEMU_FULL_TEST_1_APP_KEY=
TEMU_FULL_TEST_1_APP_SECRET=
TEMU_FULL_TEST_1_ACCESS_TOKEN=
TEMU_FULL_TEST_1_SHOP_ID=1052202882

# Temu 半托测试账号 1, 2, 3 同理...
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgresql://...
# Redis
REDIS_URL=redis://localhost:6379
# 凭据加密
CREDS_ENCRYPTION_KEY=  # 32 字节 base64
```

### C. 术语表

- **全托管 (Full-managed)**: Temu 负责物流、履约、定价建议；卖家只负责供货
- **半托管 (Semi-managed)**: 卖家自行履约到海外仓，Temu 负责流量/支付
- **JIT (Just-In-Time)**: 虚拟库存模式，接单后再备货
- **CN 网关 / PA 网关**: Temu API 分中国站(CN)和 Global(PA) 两套接入点
- **SPU / SKC / SKU**: 商品 → 颜色款式组 → 单一规格组合（Temu 特有 SKC 概念）
