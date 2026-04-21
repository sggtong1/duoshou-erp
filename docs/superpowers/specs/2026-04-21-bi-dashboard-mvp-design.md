# BI Dashboard MVP 设计方案

- **状态**: 头脑风暴完成,diag 后修订 v2,待实施
- **日期**: 2026-04-21
- **作者**: Claude + mx4c
- **前置**: W0–W2b.5 + Public Beta 部署就位(`duoshouerp.868818.xyz` 上线中)
- **定位变更**: 项目从"跨店写入类 ERP"重定位为"**跨店 BI 看板**"
- **修订 v2**: 首个 plan task 原定是"写 diag 真调验证 API shape",写 plan 前先手动跑了 diag。结果发现 `bg.goods.salesv2.get` 实际是"SKU 维度销售+库存快照",**不是**日级 GMV/订单数时间序列 —— spec v1 的数据模型和指标预设被推翻,本 v2 据此重写 § 2 / § 3 / § 4 / § 5 / § 6 / § 7 / § 10。
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
- 一屏看到 4 个 KPI + 销售对比图 + TOP 排行图 + TOP 10 热销表 + 库存预警表
- KPI 均为**件数维度**(今日/7日/30日销量件数 + 低库存 SKU 数);不含金额/订单数(Temu salesv2 API 不提供,V2 引入订单 API 再补)
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
| 2 | Layout(v2 修订) | 4 KPI 卡片(件数)+ **销售对比图**(今日/7日/30日 3 段柱状)+ **TOP 30 日销量排行**(水平 bar)+ TOP 10 表 + 库存预警表 | v1 的"30 天日 GMV 折线"因 salesv2 无日级数据放弃;改为同等信息密度的 2 图 + 2 表 |
| 3 | 数据同步策略 | **每小时 cron + DB 缓存 + 「立即同步」按钮** | 平衡 Temu 配额 / 响应速度 / 新鲜度 |
| 4 | 老模块处理 | **Soft delete 前端入口**,后端代码留 git 历史 | 产品定位清晰,UX 聚焦 BI;将来可复活 |
| 5 | 跨店视角 | **聚合默认 + 单店下钻** | 体现核心卖点 + 保留下钻刚需 |
| 6 | 图表库 | **Apache ECharts**(按需 import) | 生态最全、Dashboard 工业标准,单图 ~150 KB |
| 7 | 导航结构 | **左侧 sidebar 5 项**(Dashboard / 店铺 / 商品 / 核价 / 设置) | 标准中后台 Dashboard 布局,用户熟悉 |
| 8 | 同步反馈 UX | **立即同步 5 秒 × 12 次轮询**(最长 1 分钟自动停) | 可感知的新鲜度反馈,不会无限轮询 |
| 9 | 核价提醒位置 | **Dashboard 右下 floating tip**(不占 KPI 卡片) | 次要信息不干扰主结构 |
| 10 | Diag-first 流程 | **spec 阶段已手动 diag 真调**,非 plan 首 task(提前一步发现 shape 不符) | W2b 教训避免重犯;spec v2 已基于真实 response shape 写 |
| 11(新)| 指标单位 | **件数维度**(今日销量 / 7日销量 / 30日销量) | Temu `bg.goods.salesv2.get` 不返金额/订单数;金额留 V2 订单 API |
| 12(新)| 数据模型 | **单表 `ShopSkuSnapshot`**(销售+库存合表) | salesv2 返回已把销量 + inventoryNumInfo 合一;两表拆不必要 |
| 13(新)| 销售图表替代 | 2 张小图:**今日/7日/30日销量 3 段对比柱** + **TOP 20 SKU 30日销量排行水平条** | 无日级序列无法画折线;这两图共同表达"量的节奏 + 主力 SKU" |

---

## 4. 架构 & 文件结构

### 后端新增 `apps/api/src/modules/analytics/`

```
analytics/
├─ analytics.module.ts
├─ snapshot/
│  ├─ sku-snapshot-sync.service.ts       (每小时 @Cron;调 bg.goods.salesv2.get 分页全量;upsert ShopSkuSnapshot,
│  │                                      同步时从 inventoryNumInfo.warehouseInventoryNum 取库存、
│  │                                      从 lastThirtyDaysSaleVolume 反算 avgDailySales + daysRemaining)
│  ├─ sku-snapshot-sync.service.test.ts
│  └─ sku-snapshot-sync.cron.ts
├─ dashboard/
│  ├─ dashboard.service.ts        (聚合 + 返回 Dashboard 全部数据)
│  ├─ dashboard.service.test.ts
│  ├─ dashboard.controller.ts     (GET /summary + POST /sync/now)
│  └─ dashboard.dto.ts
└─ settings/
   ├─ settings.service.ts          (OrgSettings CRUD)
   ├─ settings.controller.ts       (GET + PATCH /settings)
   └─ settings.dto.ts

# 注:spec v1 规划的 diag 脚本在 spec 阶段已人工跑过,结果写入本文档;
#     plan 不再独立起一个 "写 diag 脚本" 的 task。
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

### 新增 Prisma 模型(diag 后 v2)

```prisma
model ShopSkuSnapshot {
  id                   String   @id @default(uuid())
  orgId                String   @map("org_id")
  shopId               String   @map("shop_id")
  platformSkuId        String   @map("platform_sku_id")       // salesv2 的 productSkuId
  productName          String?  @map("product_name")           // spu 名称
  className            String?  @map("class_name")             // SKU 变体名(如 "灰色-iPhone 14 Pro Max")
  skuExtCode           String?  @map("sku_ext_code")           // 商家 SKU 编码

  todaySaleVolume      Int      @default(0) @map("today_sale_volume")
  sales7dVolume        Int      @default(0) @map("sales_7d_volume")
  sales30dVolume       Int      @default(0) @map("sales_30d_volume")
  totalSaleVolume      Int      @default(0) @map("total_sale_volume")

  warehouseQty         Int      @default(0) @map("warehouse_qty")         // inventoryNumInfo.warehouseInventoryNum
  waitReceiveQty       Int      @default(0) @map("wait_receive_qty")      // waitReceiveNum(在途)
  waitOnShelfQty       Int      @default(0) @map("wait_on_shelf_qty")     // waitOnShelfNum
  waitDeliveryQty      Int      @default(0) @map("wait_delivery_qty")     // waitDeliveryInventoryNum

  avgDailySales        Float?   @map("avg_daily_sales")         // = sales30dVolume / 30
  daysRemaining        Float?   @map("days_remaining")          // = warehouseQty / avgDailySales(avg=0 则 null)

  supplierPriceCents   BigInt?  @map("supplier_price_cents")   // 如果 supplierPrice != null,换算成 cents

  lastSyncedAt         DateTime @default(now()) @updatedAt @map("last_synced_at")
  platformPayload      Json?    @map("platform_payload")        // 原始 salesv2 行

  org  Organization @relation(fields: [orgId], references: [id])
  shop Shop         @relation(fields: [shopId], references: [id])

  @@unique([shopId, platformSkuId])
  @@index([orgId, warehouseQty])            // 低库存预警 where 用
  @@index([orgId, sales30dVolume])          // TOP 30 日销量榜 orderBy 用
  @@index([orgId, todaySaleVolume])         // TOP 今日热销榜 orderBy 用
  @@map("shop_sku_snapshot")
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

- `Organization`:`shopSkuSnapshots ShopSkuSnapshot[]`、`settings OrgSettings?`
- `Shop`:`shopSkuSnapshots ShopSkuSnapshot[]`

### 关键设计点(v2)

1. **ShopSkuSnapshot 只存每店每 SKU 的最新快照**(不是时间序列,因为 salesv2 不提供日级序列)。cron 每小时覆盖。
2. **销售 + 库存合一张表**:salesv2 response 本身就把两者绑在一起返回,分表没意义。
3. **`avgDailySales` 用 `sales30dVolume / 30` 近似**(不做过去 7 日滚动统计,避免跟 salesv2 自己的 lastSevenDaysSaleVolume 打架)。`daysRemaining = warehouseQty / avgDailySales`,avgDailySales = 0 时 null。
4. **`supplierPriceCents` 为 nullable**:salesv2 返回的 `supplierPrice` 实际样本多为 null;当有值时存下来给以后算"可能的 GMV 估值"用,MVP 不在 Dashboard 展示金额。
5. **OrgSettings 单行**,`/settings` 页 CRUD。
6. **BigInt 只在 `supplierPriceCents`**;数量字段都 Int。
7. **platformPayload 落盘作审计**,Dashboard API 返回前 `omit: { platformPayload: true }`。

---

## 6. API 端点

| 方法 | 路径 | 入参 | 响应 |
|---|---|---|---|
| GET | `/api/dashboard/summary` | `shopId?`(可选,单店过滤) | 见下 |
| POST | `/api/dashboard/sync/now` | — | `{ accepted: true, startedAt }`(202)|
| GET | `/api/settings` | — | `{ lowStockThreshold, lowStockDaysThreshold }` |
| PATCH | `/api/settings` | `{ lowStockThreshold?, lowStockDaysThreshold? }` | 更新后的 settings |

### `GET /api/dashboard/summary` 响应(v2)

```typescript
{
  kpis: {
    todayVolume: number;                    // 今日销量件数(所有 SKU sum)
    sales7dVolume: number;                  // 近 7 日销量
    sales30dVolume: number;                 // 近 30 日销量
    lowStockCount: number;                  // warehouseQty <= threshold 的 SKU 数
  };
  salesOverview: {                          // 销售对比柱状图数据
    today: number;
    last7d: number;
    last30d: number;
  };
  top30dRanking: Array<{                    // TOP 20 近 30 日销量(水平 bar 用)
    platformSkuId: string;
    skuTitle: string | null;                // productName + ' / ' + className
    shopId: string;
    shopName: string | null;
    sales30dVolume: number;
  }>;
  topTodayProducts: Array<{                 // TOP 10 今日热销(表格用)
    platformSkuId: string;
    skuTitle: string | null;
    shopId: string;
    shopName: string | null;
    todayVolume: number;
    warehouseQty: number;                   // 帮助判断"热销但库存不足"
  }>;
  lowStockAlerts: Array<{                   // 库存预警,按 daysRemaining 升序
    platformSkuId: string;
    skuTitle: string | null;
    shopId: string;
    shopName: string | null;
    warehouseQty: number;
    avgDailySales: number | null;
    daysRemaining: number | null;
  }>;
  pendingPriceReviews: number;              // reuse W2a,count 待处理核价单
  dataFreshness: string;                    // 最新 lastSyncedAt(ISO)
}
```

### 同步行为(v2 — 单一 cron 一次搞定销售+库存)

**SkuSnapshotSyncCron @EVERY_HOUR**:
- 获取 Redis 锁 `lock:sku-snapshot-sync` TTL 30min,占用期间其它 cron tick 跳过
- 遍历 org 下所有 `status='active'` + `shopType='full'` shop(半托跳过)
- per-shop 调 `bg.goods.salesv2.get` 分页(`pageNo=1..N, pageSize=50`)直至 total 耗尽(样本店 3847 条,最多 ~77 页)
- response 每条 SPU 下展开 `skuQuantityDetailList`(一条 SPU 可能多个 SKU),对每个 SKU:
  - upsert `ShopSkuSnapshot` by (shopId, platformSkuId)
  - 映射:`todaySaleVolume` → `todaySaleVolume`;`lastSevenDaysSaleVolume` → `sales7dVolume`;`lastThirtyDaysSaleVolume` → `sales30dVolume`;`totalSaleVolume` → `totalSaleVolume`
  - 映射:`inventoryNumInfo.warehouseInventoryNum` → `warehouseQty`;`waitReceiveNum` / `waitOnShelfNum` / `waitDeliveryInventoryNum` → 对应细分字段
  - 算:`avgDailySales = sales30dVolume / 30`;`daysRemaining = avgDailySales > 0 ? warehouseQty / avgDailySales : null`
  - 若 `supplierPrice` 是正数,`supplierPriceCents = Math.round(supplierPrice * 100)`;null/0 则 null
- release lock

**POST /dashboard/sync/now**:fire-and-forget 202,后台 `void skuSnapshotSync.syncAllActiveShops(orgId).catch(log)`。

**Shop 连接后即时同步(UX)**:`ShopController.connect` 成功返回前,`void skuSnapshotSync.syncShop(shop.id).catch(log)` —— 不阻塞 HTTP,几秒到一分钟后首次数据到位。

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
│ │⚙️ 设置      │ │ │ 今日销量   │ 7日销量    │ 30日销量  │ 低库存     │││
│ │             │ │ │   142 件    │  1,240 件  │  5,823 件  │ ⚠ 23       │││
│ │             │ │ └────────────┴────────────┴────────────┴────────────┘││
│ │             │ │ ┌─ SalesOverviewChart ─┬─ Top30dRankingChart ──┐││
│ │             │ │ │ 今/7/30 日对比柱     │ TOP 20 近30日销量水平条│││
│ │             │ │ └──────────────────┴──────────────────────┘││
│ │             │ │ ┌─ TopTodayProducts ──┬─ LowStockAlerts ───┐││
│ │             │ │ │ TOP 10 今日热销     │ 库存预警             │││
│ │             │ │ └─────────────────┴─────────────────────┘││
│ │             │ │            📋 你有 14 条待处理核价单(floating)│││
│ └────────────┘ └────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### ECharts 集成

按需 import(`echarts/core` + `BarChart` + `GridComponent` + `TooltipComponent` + `LegendComponent` + `CanvasRenderer`)。v2 两张图都是 bar chart,不需要 LineChart。bundle 增量 ~120 KB。

通过 `vue-echarts` 包装 `<v-chart>` 组件,option 响应式绑定。

- **SalesOverviewChart**:3 个 bar(today / 7d / 30d),直观看"销量节奏"
- **Top30dRankingChart**:horizontal bar chart,TOP 20 SKU 按 30 日销量降序,每条 bar 上显示 SKU 名 + 销量件数

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

### 单元测试覆盖(v2)

- `sku-snapshot-sync.service.test.ts`:
  - upsert by (shopId, platformSkuId) 幂等
  - 半托店跳过(`shopType !== 'full'`)
  - Temu API 失败该店 skip,不抛
  - `avgDailySales = sales30dVolume / 30`;`sales30dVolume = 0` 时 `daysRemaining = null`
  - SPU 下 skuQuantityDetailList 多 SKU 时展开为多行 upsert
- `dashboard.service.test.ts`:
  - orgId 隔离(多 org 数据不串)
  - shopId 过滤正确
  - 4 KPI 的汇总计算(today/7d/30d volume、lowStockCount)正确
  - TOP 10 today / TOP 20 30d / lowStockAlerts 排序方向正确
  - `dataFreshness = max(lastSyncedAt)`
- `settings.service.test.ts`:
  - 首次读无 row → 返回默认值 + create row
  - PATCH 部分字段不覆盖未传字段

---

## 9. 风险 & 已知限制(v2)

1. ~~`bg.goods.salesv2.get` 响应 shape 未验证~~ **已在 spec 阶段手动 diag 过**,本 v2 据实重写。
2. **半托店隐性排除** —— UI 需要明确提示("本 Dashboard 暂只支持全托管店");前端若当前筛选下无 active full shop → 显示 empty state。
3. **Temu 配额**:10 店 × 24 次/日 × 平均 77 页 = 18,480 次/日 API 调用,可能需要跟 Temu 确认配额上限。如果超了考虑:(a) cron 间隔从 1 小时改 2 小时;(b) 分片轮换(每小时跑 1/2 店)。
4. **初次 Dashboard 空白**:新连店到 cron 跑完最多 1 小时(同步大店 3847 SKU 单轮可能要 1-3 分钟);已有优化方案(shop connect 触发即时 sync + 前端空态自检 refetch)。
5. **`daysRemaining` 精度**:基于 `sales30dVolume / 30`,新上架 SKU 或季节性波动会失真。MVP 不额外校正(YAGNI)。
6. **老模块代码仍在 repo**:soft delete 只改 router,后端 module 仍会启动。MVP 不影响;V2 再决定是否硬删。
7. **`supplierPrice` 样本 null 率高**:从 diag 看常为 null,V2 想加"预估 GMV"时大多 SKU 无价,需要 fallback 策略(用 currentPrice / 售卖价 等其它字段)。

---

## 10. 验收标准(v2)

- **A. Dashboard 能拉真实数据**:刷新 Temu access_token → 连全托店 → 等 cron 跑完或手动「立即同步」→ 看到 4 个 KPI 卡片有数字(今日/7日/30日销量、低库存 SKU 数)、销售对比柱状图 + TOP 30 日销量水平条图都渲染、TOP 10 今日热销表和库存预警表至少有 1 行(如果测试店 SKU 大多销量 0,TOP 表可能全 0 但行数 ≥ 1)
- **B. 单店切换生效**:顶部下拉切到具体店,所有数据变化(若只 1 家店可跳过)
- **C. 阈值 CRUD**:`/settings` 把 `lowStockThreshold` 从 10 改到 20 → 回 Dashboard `lowStockCount` 立即变化

---

## 11. Done — 接下来

- 进入 `superpowers:writing-plans`,把本设计拆成实施 plan
- 预估 10-12 个 task(v2 合并了 sales/inventory 同步,省了 1 task;diag 不单独占 task):
  - T1: Prisma 模型 + 迁移(ShopSkuSnapshot + OrgSettings + back-refs)
  - T2: SkuSnapshotSyncService + cron + 单测(单 cron 一次搞定销售+库存)
  - T3: DashboardService + 单测
  - T4: DashboardController + SettingsService + SettingsController
  - T5: Shop connect 后即时同步 hook(modify ShopController)
  - T6: 老模块 router / HomePage soft delete + PriceReview 改造为只读
  - T7: MainLayout(左 sidebar 导航)
  - T8: Web api-client + stores(dashboard + settings)
  - T9: DashboardPage + 5 个子组件(KpiCard、DashboardHeader、SalesOverviewChart、Top30dRankingChart、TopTodayProductsTable、LowStockAlertsTable)
  - T10: SettingsPage
  - T11: 基础 smoke + tag

## 已知 V2 候选(本 MVP 外)

- 销售下钻页(SKU / 时段 / 自定义 range)
- 库存下钻页(死库存、补货建议、趋势图)
- 广告 ROI 页(全托 PA `bg.glo.searchrec.ad.reports.*`)
- 订单履约看板(备货发货 API 组)
- 店铺健康综合评分
- 半托店支持(等 Temu 出半托销售 API)
- 月级 / 季度同比对比
- 老模块硬删(Prisma 表 drop + service/controller 删除)
