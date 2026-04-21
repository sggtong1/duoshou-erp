# BI Dashboard MVP 设计方案

- **状态**: 头脑风暴完成,待实施
- **日期**: 2026-04-21
- **作者**: Claude + mx4c
- **前置**: W0–W2b.5 + Public Beta 部署就位(`duoshouerp.868818.xyz` 上线中)
- **定位变更**: 项目从"跨店写入类 ERP"重定位为"**跨店 BI 看板**"
- **下一步**: `superpowers:writing-plans` 生成实施 plan

---

## 1. 背景 & 定位

Public Beta 过程中验证到:
- Temu 写入类 API(发品 / 调价 / 活动报名)需要复杂嵌套数据和真实 shop state 才能跑通,W2b 活动 sync 首次真调炸掉
- 商家对写入操作普遍更信任 Temu 卖家中心官方 UI,舵手作为第三方写入不容易拿到信任溢价
- 真正稀缺的是**跨店聚合的数据视角** —— Temu 官方后台没有,这才是舵手的 unique value proposition(顶层 spec § 1 差异化 #1 其实一直指向这里)

**一句话**: 放弃多数写入类功能,把能拿到的 Temu 读取类 API 聚合成一个跨店运营看板(BI Dashboard),让商家 3 秒看到全店销售/库存健康度。

**范围**: V1 MVP 只做**一个 Dashboard 首页**(单 spec、单 plan)。上线拿用户反馈后再决定扩展。

---

## 2. 目标 & 非目标

### 目标(MVP 内)

- 用户登录 → 默认首页 `/` 就是 Dashboard
- 一屏看到 4 个 KPI + 30 天销售趋势 + TOP 10 热销 + 库存预警
- 支持「全部店铺合并」默认视图 + 单店下钻(顶部下拉筛选)
- 用户可自定义低库存阈值
- 每小时 cron 自动同步 + 用户可「立即同步」触发即时拉取
- 左侧 sidebar 导航:Dashboard / 店铺管理 / 我的商品 / 核价提醒(只读) / 设置

### 非目标(推 V2+)

- 销售下钻页(SKU / 时段 / 自定义 range)
- 库存下钻页(死库存、补货建议)
- 广告 ROI 页(仅全托 PA)
- 订单履约看板
- 店铺综合健康评分
- 同比 / 环比 "月级" 对比
- **半托店支持**(Temu 半托暂无销售 API)
- 硬删老写入类后端代码(先只 soft delete 前端入口)
- 硬删老的 product_template / bulk_job / activity* / price_adjustment_order 表

---

## 3. 关键设计决策

| # | 决策 | 选中 | 理由 |
|---|---|---|---|
| 1 | Scope 分解策略 | **单 MVP**(Dashboard 首页一个页) | 避免 W2b 式多模块同时炸;上线拿反馈再扩 |
| 2 | Layout | **Layout A**:4 KPI + 30 天折线 + TOP 10 表 + 库存预警表 | 信息密度适中,MVP 够用不浪费 |
| 3 | 数据同步策略 | **每小时 cron + DB 缓存 + 「立即同步」按钮** | 平衡 Temu 配额 / 响应速度 / 新鲜度 |
| 4 | 老模块处理 | **Soft delete 前端入口**,后端代码留 git 历史 | 产品定位清晰,UX 聚焦 BI;将来可复活 |
| 5 | 跨店视角 | **聚合默认 + 单店下钻** | 体现核心卖点 + 保留下钻刚需 |
| 6 | 图表库 | **Apache ECharts**(按需 import) | 生态最全、Dashboard 工业标准,单图 ~150 KB |
| 7 | 导航结构 | **左侧 sidebar 5 项**(Dashboard / 店铺 / 商品 / 核价 / 设置) | 标准中后台 Dashboard 布局,用户熟悉 |
| 8 | 同步反馈 UX | **立即同步 5 秒 × 12 次轮询**(最长 1 分钟自动停) | 可感知的新鲜度反馈,不会无限轮询 |
| 9 | 核价提醒位置 | **Dashboard 右下 floating tip**(不占 KPI 卡片) | 次要信息不干扰主结构 |
| 10 | Diag-first 流程 | **plan 首个 task 写 diag 脚本真调 Temu**,验证响应 shape 再写 sync | W2b 教训:避免 spec 假设 shape 跟真实 API 不符 |

---

## 4. 架构 & 文件结构

### 后端新增 `apps/api/src/modules/analytics/`

```
analytics/
├─ analytics.module.ts
├─ sales/
│  ├─ sales-sync.service.ts       (每小时 @Cron;调 bg.goods.salesv2.get;upsert SalesSnapshot)
│  ├─ sales-sync.service.test.ts
│  └─ sales-sync.cron.ts
├─ inventory/
│  ├─ inventory-sync.service.ts   (每小时 @Cron;调 bg.goods.quantity.get;upsert InventorySnapshot + 算 daysRemaining)
│  ├─ inventory-sync.service.test.ts
│  └─ inventory-sync.cron.ts
├─ dashboard/
│  ├─ dashboard.service.ts        (聚合 + 返回 Dashboard 全部数据)
│  ├─ dashboard.service.test.ts
│  ├─ dashboard.controller.ts     (GET /summary + POST /sync/now)
│  └─ dashboard.dto.ts
└─ settings/
   ├─ settings.service.ts          (OrgSettings CRUD)
   ├─ settings.controller.ts       (GET + PATCH /settings)
   └─ settings.dto.ts

apps/api/scripts/
├─ diag-sales-api.mjs              (plan 首 task:用真实凭据调 bg.goods.salesv2.get,打印响应 shape)
└─ diag-inventory-api.mjs          (同上,调 bg.goods.quantity.get)
```

### 前端新增 `apps/web/src/pages/`

```
pages/dashboard/
├─ DashboardPage.vue                    (/)
└─ components/
   ├─ DashboardHeader.vue              店铺筛选 + 立即同步 + 数据时间戳
   ├─ KpiCard.vue                       通用 KPI 卡片
   ├─ SalesTrendChart.vue               ECharts 30 天折线
   ├─ TopProductsTable.vue              TOP 10 热销
   └─ LowStockAlertsTable.vue           库存预警

pages/settings/
└─ SettingsPage.vue                     (/settings) 低库存阈值等

layouts/
└─ MainLayout.vue                       左 sidebar 导航 + 右 main 内容区(新建)

api-client/dashboard.api.ts
api-client/settings.api.ts
stores/dashboard.ts
stores/settings.ts

router/index.ts                         改造(见 § 7)
```

### 删除的前端文件

```
apps/web/src/pages/HomePage.vue                        ❌ 整个删除
apps/web/src/pages/HomePage.test.ts                    ❌
apps/web/src/pages/products/TemplateListPage.vue       ❌ soft delete(router 不注册)
apps/web/src/pages/products/TemplateEditorPage.vue     ❌ 同上
apps/web/src/pages/bulk-jobs/BulkJobProgressPage.vue   ❌
apps/web/src/pages/price-adjustments/
  PriceAdjustmentSubmitPage.vue                        ❌
apps/web/src/pages/activities/ActivityListPage.vue     ❌
apps/web/src/pages/activities/ActivityDetailPage.vue   ❌
apps/web/src/pages/enrollments/EnrollmentListPage.vue  ❌
```

### 改造的前端文件

```
apps/web/src/pages/price-reviews/PriceReviewInboxPage.vue  改造:删除批量同意/拒绝按钮,改成只读列表 + "如需操作请去 Temu 卖家中心" banner
apps/web/src/pages/price-reviews/PriceReviewDetailPage.vue  改造:同上
apps/web/src/pages/products/ProductListPage.vue             无改动(本来就只读)
```

---

## 5. 数据模型

### 新增 Prisma 模型

```prisma
model SalesSnapshot {
  id              String   @id @default(uuid())
  orgId           String   @map("org_id")
  shopId          String   @map("shop_id")
  snapshotDate    DateTime @map("snapshot_date") @db.Date
  gmvCents        BigInt   @default(0) @map("gmv_cents")
  orderCount      Int      @default(0) @map("order_count")
  unitSold        Int      @default(0) @map("unit_sold")
  currency        String   @default("USD")
  lastSyncedAt    DateTime @default(now()) @updatedAt @map("last_synced_at")
  platformPayload Json?    @map("platform_payload")

  org  Organization @relation(fields: [orgId], references: [id])
  shop Shop         @relation(fields: [shopId], references: [id])

  @@unique([shopId, snapshotDate])
  @@index([orgId, snapshotDate])
  @@map("sales_snapshot")
}

model InventorySnapshot {
  id              String   @id @default(uuid())
  orgId           String   @map("org_id")
  shopId          String   @map("shop_id")
  platformSkuId   String   @map("platform_sku_id")
  skuTitle        String?  @map("sku_title")
  quantity        Int      @default(0)
  avgDailySales   Float?   @map("avg_daily_sales")
  daysRemaining   Float?   @map("days_remaining")
  lastSyncedAt    DateTime @default(now()) @updatedAt @map("last_synced_at")
  platformPayload Json?    @map("platform_payload")

  org  Organization @relation(fields: [orgId], references: [id])
  shop Shop         @relation(fields: [shopId], references: [id])

  @@unique([shopId, platformSkuId])
  @@index([orgId, quantity])
  @@map("inventory_snapshot")
}

model OrgSettings {
  orgId                   String   @id @map("org_id")
  lowStockThreshold       Int      @default(10) @map("low_stock_threshold")
  lowStockDaysThreshold   Int      @default(7)  @map("low_stock_days_threshold")
  updatedAt               DateTime @default(now()) @updatedAt @map("updated_at")

  org Organization @relation(fields: [orgId], references: [id])
  @@map("org_settings")
}
```

### Back-refs

- `Organization`:`salesSnapshots SalesSnapshot[]`、`inventorySnapshots InventorySnapshot[]`、`settings OrgSettings?`
- `Shop`:`salesSnapshots SalesSnapshot[]`、`inventorySnapshots InventorySnapshot[]`

### 关键设计点

1. **SalesSnapshot 日粒度**。cron 每小时覆盖当日那一行;过去 30 天首次 backfill,后续只增量覆盖近 3 天(防 Temu 事后更正)。
2. **InventorySnapshot 只存最新**(非时间序列,MVP YAGNI)。每小时 cron 覆盖;`avgDailySales` / `daysRemaining` 冗余存(Dashboard 查询快),cron 从 SalesSnapshot 过去 7 天反算。
3. **OrgSettings 单行**。UI 在 `/settings` 页 CRUD。不做 per-shop 阈值(YAGNI)。
4. **BigInt 只在 gmvCents**(跟 W1/W2a 一致);orderCount、unitSold 用 Int。
5. **platformPayload 落盘作审计**,但 Dashboard API 返回前 `omit: { platformPayload: true }`(W2b 同款教训,别让 Temu 原始响应穿到浏览器)。

---

## 6. API 端点

| 方法 | 路径 | 入参 | 响应 |
|---|---|---|---|
| GET | `/api/dashboard/summary` | `shopId?`(可选,单店过滤) | 见下 |
| POST | `/api/dashboard/sync/now` | — | `{ accepted: true, startedAt }`(202)|
| GET | `/api/settings` | — | `{ lowStockThreshold, lowStockDaysThreshold }` |
| PATCH | `/api/settings` | `{ lowStockThreshold?, lowStockDaysThreshold? }` | 更新后的 settings |

### `GET /api/dashboard/summary` 响应

```typescript
{
  kpis: {
    todayGmvCents: number;                  // 今日 GMV(分)
    todayGmvDeltaPct: number | null;        // 相对昨日 ↑/↓%(null 表示昨日数据缺)
    todayOrderCount: number;
    todayOrderDeltaPct: number | null;
    last7dGmvCents: number;                 // 过去 7 日累计
    last7dGmvDeltaPct: number | null;       // 相对前 7 日(第 8-14 天)
    lowStockCount: number;                  // 达到阈值的 SKU 总数
  };
  salesTrend: Array<{                       // 30 天按日
    date: string;                           // 'YYYY-MM-DD'
    gmvCents: number;
    orderCount: number;
  }>;
  topProducts: Array<{                      // TOP 10 今日热销,unitSold 降序
    platformSkuId: string;
    skuTitle: string | null;
    shopId: string;
    shopName: string | null;
    unitSold: number;
    gmvCents: number;
  }>;
  lowStockAlerts: Array<{                   // 按 daysRemaining 升序(最急的在前)
    platformSkuId: string;
    skuTitle: string | null;
    shopId: string;
    shopName: string | null;
    quantity: number;
    avgDailySales: number | null;
    daysRemaining: number | null;
  }>;
  pendingPriceReviews: number;              // reuse W2a,count 待处理核价单
  dataFreshness: string;                    // 最新 lastSyncedAt(ISO)
}
```

### 同步行为

**SalesSyncCron @EVERY_HOUR**(跟 `EnrollmentSyncCron` 同构的 @Cron 装饰器):
- 获取 Redis 锁 `lock:sales-sync` TTL 30min
- 遍历 org 下所有 `status='active'` + `shopType='full'` shop
- per-shop 调 `bg.goods.salesv2.get` 拉近 7 天
- upsert SalesSnapshot by (shopId, snapshotDate)
- release lock

**InventorySyncCron @EVERY_HOUR** + 15 分钟偏移(避免跟 sales cron 同时打 Temu):
- 锁 `lock:inventory-sync`
- per-shop 调 `bg.goods.quantity.get`
- 从 SalesSnapshot 反算 `avgDailySales`
- upsert InventorySnapshot by (shopId, platformSkuId)

**POST /dashboard/sync/now**:fire-and-forget 202,后台 `void salesSync + inventorySync`。

**Shop 连接后即时同步**(UX 优化):`ShopController.connect` 成功后 `void salesSync.syncShop(shopId) + inventorySync.syncShop(shopId)`(不阻塞 HTTP 响应)。避免用户新连店后首页空白等一小时。

---

## 7. 前端细节

### DashboardPage.vue 布局

```
┌── MainLayout ────────────────────────────────────────────────────┐
│ ┌─ sidebar ──┐ ┌─── main ──────────────────────────────────────┐│
│ │📊 Dashboard│ │ ┌─ DashboardHeader ─────────────────────────┐││
│ │🏪 店铺管理 │ │ │ [全部店铺▾]        数据时间:15:00 [🔄立即同步]│││
│ │📦 我的商品 │ │ └─────────────────────────────────────────┘││
│ │🔔 核价提醒 │ │ ┌─ KpiCard ─┬─ KpiCard ─┬─ KpiCard ─┬─ KpiCard ┐││
│ │⚙️ 设置      │ │ │ 今日 GMV   │ 今日订单   │ 7日 GMV   │ 低库存     │││
│ │             │ │ │ $12,348    │ 142        │ $78,912   │ ⚠ 23       │││
│ │             │ │ │ ↑ 8.4%     │ ↑ 12%      │ ↑ 3.1%    │            │││
│ │             │ │ └────────────┴────────────┴────────────┴────────────┘││
│ │             │ │ ┌─ SalesTrendChart(30 天 ECharts 折线)──────┐││
│ │             │ │ │                                            │││
│ │             │ │ └─────────────────────────────────────────┘││
│ │             │ │ ┌─ TopProductsTable ─┬─ LowStockAlertsTable ┐││
│ │             │ │ │ TOP 10 今日热销    │ 库存预警             │││
│ │             │ │ └─────────────────┴─────────────────────┘││
│ │             │ │            📋 你有 14 条待处理核价单(floating)│││
│ └────────────┘ └────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### ECharts 集成

按需 import(`echarts/core` + `LineChart` + `GridComponent` + `TooltipComponent` + `LegendComponent` + `CanvasRenderer`)。bundle 增量 ~150 KB。

通过 `vue-echarts` 包装 `<v-chart>` 组件,option 响应式绑定。

### 老模块 soft delete(router)

删除 router 的 6 个 route 注册 + 对应 import + 删除 HomePage.vue。保留 routes:
- `/` → `DashboardPage`
- `/login` → `LoginPage`
- `/shops` → `ShopsListPage`
- `/shops/new` → `ShopsConnectPage`
- `/products` → `ProductListPage`
- `/price-reviews` → `PriceReviewInboxPage`(改造为只读)
- `/price-reviews/:id` → `PriceReviewDetailPage`(改造为只读)
- `/settings` → `SettingsPage`

### router guard 保持(强制 onboarding)

现有 router guard 检查 `hasActiveShop`,无店 redirect `/shops/new`。保留。

### 「立即同步」轮询

```typescript
async function onSyncNow() {
  syncing.value = true;
  await dashboardApi.syncNow();  // 202 accepted
  // 轮询:每 5 秒查一次 summary,若 dataFreshness 变了就停,最多 12 次(1 分钟)
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const latest = await dashboardApi.summary(shopId.value);
    if (latest.dataFreshness !== data.value?.dataFreshness) {
      data.value = latest;
      break;
    }
  }
  syncing.value = false;
}
```

---

## 8. 错误处理 & 单元测试覆盖

### Cron 错误处理

- per-shop try/catch(一店失败不影响其他店)
- Redis 锁失败降级为 "skip 本轮 cron"
- Temu API 失败 warn log + 当轮跳过该店
- platformPayload 永远落盘(留 raw 审计)

### 数据空态

- SalesSnapshot 全空 → KPI 显示 `—`,趋势图显示 "暂无数据"
- InventorySnapshot 全空 → 库存预警表显示 "暂无数据"
- 用户刚连店、cron 未跑完 → 首页空态 + "数据同步中 🔄"
- Dashboard 自检每 30 秒 refetch 一次直到有数据(最多 10 次)

### 单元测试覆盖

- `sales-sync.service.test.ts`:
  - upsert by (shopId, snapshotDate) 幂等
  - 半托店跳过(`shopType !== 'full'`)
  - Temu API 失败该店 skip,不抛
- `inventory-sync.service.test.ts`:
  - avgDailySales 从过去 7 天 SalesSnapshot 计算正确
  - avgDailySales = 0 时 daysRemaining = null
- `dashboard.service.test.ts`:
  - orgId 隔离(多 org 数据不串)
  - shopId 过滤正确
  - today vs yesterday delta pct 计算正确
  - lastSyncedAt 取所有 snapshot 最新值
- `settings.service.test.ts`:
  - 首次读无 row → 返回默认值 + create row
  - PATCH 部分字段不覆盖未传字段

---

## 9. 风险 & 已知限制

1. **`bg.goods.salesv2.get` 响应 shape 未验证** —— plan 首 task 必须 diag 脚本真调(W2b 教训)
2. **半托店隐性排除** —— UI 需要明确提示("本 Dashboard 暂只支持全托管店")
3. **Temu 配额**:10 店 × 24 小时 × 2 API = 480 次/日;如果后期有用户连 30+ 店,要评估配额或分片 cron
4. **初次 Dashboard 空白**:新连店到 cron 跑完最多 1 小时;已有优化方案(shop connect 触发即时 sync + 前端空态自检 refetch)
5. **`daysRemaining` 精度**:过去 7 天均销量反算,新 SKU 或周末销量异常会抖动
6. **老模块代码仍在 repo**:soft delete 只改 router,后端 module 仍会启动。MVP 不影响;V2 再决定是否硬删

---

## 10. 验收标准

- **A. Dashboard 能拉真实数据**:刷新 Temu access_token → 连全托店 → 等 cron 跑完(≤ 1 小时)或手动「立即同步」→ 看到 4 KPI 数字、30 天趋势折线、TOP 热销表至少 1 行
- **B. 单店切换生效**:顶部下拉切到具体店,所有数据变化(若只 1 家店可跳过)
- **C. 阈值 CRUD**:`/settings` 把 `lowStockThreshold` 从 10 改到 20 → 回 Dashboard `lowStockCount` 立即变化

---

## 11. Done — 接下来

- 进入 `superpowers:writing-plans`,把本设计拆成实施 plan
- 预估 12-14 个 task:
  - T1: diag 脚本验证 sales + inventory API shape
  - T2: Prisma 模型 + 迁移
  - T3: SalesSyncService + cron + 单测
  - T4: InventorySyncService + cron + 单测
  - T5: DashboardService + 单测
  - T6: DashboardController + SettingsController
  - T7: Shop connect 后即时同步 hook
  - T8: 老模块 router/HomePage soft delete + PriceReview 改造为只读
  - T9: MainLayout(左 sidebar 导航)
  - T10: Web api-client + stores
  - T11: DashboardPage + 5 个子组件(含 ECharts)
  - T12: SettingsPage
  - T13: 基础 smoke + tag

## 已知 V2 候选(本 MVP 外)

- 销售下钻页(SKU / 时段 / 自定义 range)
- 库存下钻页(死库存、补货建议、趋势图)
- 广告 ROI 页(全托 PA `bg.glo.searchrec.ad.reports.*`)
- 订单履约看板(备货发货 API 组)
- 店铺健康综合评分
- 半托店支持(等 Temu 出半托销售 API)
- 月级 / 季度同比对比
- 老模块硬删(Prisma 表 drop + service/controller 删除)
