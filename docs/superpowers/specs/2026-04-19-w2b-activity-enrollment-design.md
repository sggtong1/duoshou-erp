# W2b 活动日历 + 跨店批量报名 设计方案

- **状态**: 头脑风暴完成,待实施
- **日期**: 2026-04-19
- **作者**: Claude + mx4c
- **前置**: W2a(核价调价工作站)已交付并 tag `w2a-complete`
- **下一步**: `superpowers:writing-plans` 生成实施 plan

---

## 1. 背景 & 定位

W2b 实现舵手 ERP v1 路线图的第 3 模块「活动日历 + 批量报名」(顶层 spec `docs/superpowers/specs/2026-04-18-duoshou-erp-v1-design.md` § 6.3)。

**一句话**: 商家登录后能在一个页面看到所有店铺可报的 Temu 营销活动、一次选店+选 SKU 提交跨店报名、在统一看板跟踪审核结果。

**架构定位**: W2b 复用 W2a 建立的模式——路由辅助纯函数 + Service + Controller + 每日 cron + 前端 list/detail 页 + Pinia 存——几乎 1:1 同构。

---

## 2. 目标 & 非目标

### 目标(W2b 内)

- 接入 Temu 活动 API 组 6 个接口全链路(list / detail / session / product / enroll submit / enroll list)
- 按活动聚合的跨店视图(一行一个 `platformActivityId`,附带「可报 X 店 / 已报 Y 店 / 已报 Z SKU」统计)
- 单步批量报名:在活动详情页完成选店 + 选 SKU + 填活动价(含批量下调 %),一次提交
- 已报名跨店看板,支持按活动 / 店铺 / 状态筛选
- 每天 cron 两轮(活动 02:00 / 报名 03:00)+ 前端手动刷新兜底

### 非目标(明确不做)

- 真日历视图(月/周格子)→ W2b.5 可加
- 报名撤销/修改 → v2
- 报名模板(活动价策略复用)→ v2
- 活动 GMV / 销量分析 → v1.5 BI
- 伪 webhook 活动到达推送 → W3 事件总线
- 多店多活动同时提交(目前单活动 × 多店 × 多 SKU,每次 submit 围绕一个活动)

---

## 3. 关键设计决策

| # | 决策 | 选中 | 理由 |
|---|---|---|---|
| 1 | 覆盖范围 | **全链路 6 API** | 顶层 spec 设计过 6 API,API 全备,模式跟 W2a 同量级 |
| 2 | 本地镜像策略 | **混合镜像**(activity/session/enrollment 镜像;product 按需 + Redis TTL 300s) | 可报商品动态性最强、体量最大,镜像易过期 |
| 3 | 前端主视图 | **list 模式**(非真日历)| 复用 W2a 的 n-data-table 模式,v1 求交付,日历留 v1.5 |
| 4 | 数据聚合粒度 | **按 Temu activityId 聚合** | 跨店聚合视角是舵手核心卖点 #1 |
| 5 | 批量报名 UX | **单步,合并进详情页**(不再弹二级模态)| 活动报名是快决策动作,wizard/模板化添堵 |
| 6 | 数据表结构 | **三张表**(activity / activity_session / activity_enrollment)| 可报商品仅 Redis;session 独立表方便报名关联与查询 |
| 7 | cron 节奏 | **每天 2 轮**(activity 02:00 / enrollment 03:00)+ 前端手动刷新 | 用户决定节奏偏稀疏,on-demand 按钮兜底 24h 等待 |

---

## 4. 架构 & 文件结构

### 后端 `apps/api/src/modules/marketing/`(新模块)

```
marketing/
├─ marketing.module.ts
├─ marketing-endpoints.ts               (CN ↔ PA .global 路由;同 pricing-endpoints 套路)
├─ marketing-endpoints.test.ts
├─ activity/
│  ├─ activity.service.ts               (list + detail;跨店聚合 + 统计列)
│  ├─ activity.service.test.ts
│  ├─ activity.controller.ts            (GET list / :id / :id/products / POST sync/now)
│  ├─ activity.dto.ts
│  ├─ activity-sync.service.ts          (拉活动 + 场次落表)
│  ├─ activity-sync.cron.ts             (@Cron EVERY_DAY_AT_2AM)
│  └─ activity-products.service.ts      (按需拉可报 SKU,Redis 缓存 300s)
└─ enrollment/
   ├─ enrollment.service.ts             (list + submit + refresh)
   ├─ enrollment.service.test.ts
   ├─ enrollment.controller.ts          (GET list / POST submit / POST :id/refresh / POST sync/now)
   ├─ enrollment.dto.ts
   ├─ enrollment-sync.service.ts
   └─ enrollment-sync.cron.ts           (@Cron EVERY_DAY_AT_3AM)
```

### 前端 `apps/web/src/`

```
api-client/
├─ activities.api.ts
└─ enrollments.api.ts
stores/
├─ activities.ts
└─ enrollments.ts
pages/activities/
├─ ActivityListPage.vue                 (/activities)
└─ ActivityDetailPage.vue               (/activities/:id)
pages/enrollments/
└─ EnrollmentListPage.vue               (/enrollments)
router/index.ts                         (+3 路由)
pages/HomePage.vue                      (+2 nav 按钮: 活动日历 / 已报名)
```

### API 路由表

| 动作 | CN 方法名 | PA 方法名(`.global` 后缀) |
|---|---|---|
| 活动列表 | `bg.marketing.activity.list.get` | `bg.marketing.activity.list.get.global` |
| 活动详情 | `bg.marketing.activity.detail.get` | `bg.marketing.activity.detail.get.global` |
| 场次 | `bg.marketing.activity.session.list.get` | `bg.marketing.activity.session.list.get.global` |
| 可报商品 | `bg.marketing.activity.product.get` | `bg.marketing.activity.product.get.global` |
| 批量报名 | `bg.marketing.activity.enroll.submit` | `bg.marketing.activity.enroll.submit.global` |
| 报名列表 | `bg.marketing.activity.enroll.list.get` | `bg.marketing.activity.enroll.list.get.global` |

`marketingEndpoints({shopType, region})` 纯函数集中路由,6 个字段返回对应方法名字符串(等同 W2a 的 `pricingEndpoints`)。

---

## 5. 数据模型

```prisma
model Activity {
  id                  String    @id @default(uuid())
  orgId               String    @map("org_id")
  platformActivityId  String    @map("platform_activity_id")
  region              String                                          // 'cn' | 'pa'
  title               String?
  activityType        String?   @map("activity_type")                  // flash_sale | coupon | promotion 等
  startAt             DateTime? @map("start_at")
  endAt               DateTime? @map("end_at")
  enrollStartAt       DateTime? @map("enroll_start_at")
  enrollEndAt         DateTime? @map("enroll_end_at")
  status              String    @default("open")                       // open | closed | archived
  shopVisibility      Json      @default("[]") @map("shop_visibility") // [{shopId, shopName, canEnroll, platformActivityId}]
  platformPayload     Json      @default("{}") @map("platform_payload")
  firstSeenAt         DateTime  @default(now()) @map("first_seen_at")
  lastSyncedAt        DateTime  @default(now()) @updatedAt @map("last_synced_at")

  org         Organization         @relation(fields: [orgId], references: [id])
  sessions    ActivitySession[]
  enrollments ActivityEnrollment[]

  @@unique([orgId, region, platformActivityId])
  @@index([orgId, status, startAt])
  @@map("activity")
}

model ActivitySession {
  id                 String    @id @default(uuid())
  activityId         String    @map("activity_id")
  platformSessionId  String    @map("platform_session_id")
  title              String?
  startAt            DateTime? @map("start_at")
  endAt              DateTime? @map("end_at")
  status             String    @default("open")
  platformPayload    Json      @default("{}") @map("platform_payload")

  activity    Activity             @relation(fields: [activityId], references: [id], onDelete: Cascade)
  enrollments ActivityEnrollment[]

  @@unique([activityId, platformSessionId])
  @@index([activityId, startAt])
  @@map("activity_session")
}

model ActivityEnrollment {
  id                  String    @id @default(uuid())
  orgId               String    @map("org_id")
  shopId              String    @map("shop_id")
  activityId          String    @map("activity_id")
  sessionId           String?   @map("session_id")
  platformSkuId       String    @map("platform_sku_id")
  skuTitle            String?   @map("sku_title")
  activityPriceCents  BigInt?   @map("activity_price_cents")
  currency            String?
  status              String    @default("pending")                    // pending | approved | rejected | withdrawn | failed
  rejectReason        String?   @map("reject_reason")
  submittedAt         DateTime  @default(now()) @map("submitted_at")
  resolvedAt          DateTime? @map("resolved_at")
  lastSyncedAt        DateTime  @default(now()) @updatedAt @map("last_synced_at")
  error               Json?
  platformPayload     Json?     @map("platform_payload")

  org      Organization     @relation(fields: [orgId], references: [id])
  shop     Shop             @relation(fields: [shopId], references: [id])
  activity Activity         @relation(fields: [activityId], references: [id])
  session  ActivitySession? @relation(fields: [sessionId], references: [id])

  @@unique([shopId, activityId, sessionId, platformSkuId])
  @@index([orgId, status])
  @@index([activityId, status])
  @@map("activity_enrollment")
}
```

**Back-refs 加到现有模型**:
- `model Organization`: `activities Activity[]`, `activityEnrollments ActivityEnrollment[]`
- `model Shop`: `activityEnrollments ActivityEnrollment[]`

**关键设计点**:

1. **Activity 以 `(orgId, region, platformActivityId)` 唯一键**,不绑 shopId → 跨店聚合的主键就是活动本身。
2. **shopVisibility JSON 去重累加**:sync 时同一活动多店访问到,merge 新 shop 条目到数组,不覆盖。
3. **统计列不预存**,在 `activity.service.list()` 聚合查询时算:`shopVisibility.length`、`enrollments group by shopId + count`。
4. **Enrollment 唯一键 `(shopId, activityId, sessionId, platformSkuId)`** → 支持 upsert 幂等;`sessionId` nullable 兼容无场次活动。
5. **BigInt**:只有 `activityPriceCents`,统一走 W2a 的 `bigIntToNumber` 序列化。
6. **Activity.status 状态机**:`open` →(`enrollEndAt` 过)`closed` →(`endAt` 过 + 30 天)`archived`,cron 里自动流转。

---

## 6. API 端点

### `/api/activities`

| 方法 | 路径 | 入参 | 响应 |
|---|---|---|---|
| GET | `/activities` | `region?` `status?` `search?` `shopId?`(筛出 `shopVisibility` JSON 里含此 shopId 的活动,Postgres JSON `@>` 操作)`startAfter?` `startBefore?` `page?` `pageSize?` | `{total, page, pageSize, items: Activity[]}` — items 含 `shopCount / enrolledShopCount / enrolledSkuCount` 聚合列 |
| GET | `/activities/:id` | — | `Activity & { sessions: ActivitySession[], shopVisibility: [] }` |
| GET | `/activities/:id/products` | `shopId` 必传 | `{items: ProductCandidate[]}` — 按需拉 + Redis 缓存 300s |
| POST | `/activities/sync/now` | — | `{total: N}` 触发全量 activity+session 同步 |

### `/api/enrollments`

| 方法 | 路径 | 入参 | 响应 |
|---|---|---|---|
| GET | `/enrollments` | `activityId?` `shopId?` `status?` `page?` `pageSize?` | `{total, page, pageSize, items}` |
| POST | `/enrollments/submit` | `{activityId, sessionId?, items: [{shopId, platformSkuId, skuTitle?, activityPriceCents, currency?}]}` 条目 1..200(比 W2a 批量 1..50 放宽,一次大活动跨店常涉及上百 SKU) | `{total, results: [{shopId, platformSkuId, ok, enrollmentId?, error?}]}` |
| POST | `/enrollments/:id/refresh` | — | 单条 enrollment 调 Temu 查最新状态并 upsert |
| POST | `/enrollments/sync/now` | — | `{total: N}` 触发全量 enrollment 同步 |

**关键细节**:

1. `submit` 后端逻辑:`items` group by `shopId` → 每个 shop 一次 `bg.marketing.activity.enroll.submit` 批量调用 → per-shop try/catch 独立报错,复用 W2a `batchConfirm` 的 `results[]` 模式。
2. **提交前预校验(不拦,仅警告)**:活动 status=open、`enrollEndAt > now()`、每个 shopId 在 shopVisibility 里存在、每个 SKU 在最近一次 products 缓存里出现过。Warning 返回但放行,以 Temu 判定为准。
3. `AuthGuard` + `tenant.resolveForUser` 所有路由都用。
4. zod 校验只加在 POST 体(`SubmitEnrollmentDto`),GET 查询参数手工 coerce(同 W2a 模式)。

---

## 7. 前端页面与交互流

### `/activities` — ActivityListPage

**布局**:筛选条(region / status / shopId / startAt 区间 / search)+ 两按钮(「立即同步」/「手动刷新」)+ 数据表格 + 分页。

**关键列**:活动名、类型、时间窗、截止报名、跨店状态(「📦 X 店可报 ✅ Y 店已报 📝 Z SKU」三行 render)、操作(详情)。

### `/activities/:id` — ActivityDetailPage(批量报名入口)

**单页完成整个报名流程(不再弹二级模态)**:

1. 活动基本信息(n-descriptions)
2. 场次选择(n-radio-group,若有 session)
3. 可报店铺多选(checkbox group,来自 shopVisibility)
4. 可报商品表格(随选店变化即时重拉 `/activities/:id/products?shopId=...`)— 多选 + 每行活动价输入
5. 「批量下调 %」工具条:输入 `X` 点击「应用」,对选中行执行 `activityPriceCents = Math.round(currentPriceCents * (1 - X/100))`
6. 「提交批量报名」按钮 → 调 `/enrollments/submit` → 成功后 toast 显示「M 成功 / N 失败」,展开看失败列表,可选跳转 `/enrollments`

### `/enrollments` — EnrollmentListPage(跨店看板)

**布局**:筛选(活动 / 店铺 / 状态)+ 数据表格 + 分页。

**关键列**:活动名、店铺、SKU、活动价、状态(色标 NTag)、提交时间、操作。

**操作**:`⏳pending` 行上「刷新」按钮 → `POST /enrollments/:id/refresh` → 更新本行。

### 状态色标

| 状态 | NTag type |
|---|---|
| pending | info |
| approved | success |
| rejected | warning |
| failed | error |
| withdrawn | default |

---

## 8. 同步策略 & 错误处理

### Activity sync(每天 02:00)

伪码:
```
for shop of active shops:
  pageNo = 1
  loop to pageMax=10:
    res = client.call(ep.listActivities, {pageNo, pageSize: 50})
    for act of res.list:
      upsert Activity by (orgId, region, platformActivityId)
        merge shopVisibility: append {shopId, shopName, canEnroll} 去重
      res2 = client.call(ep.listSessions, {activityId: act.id})
      for sess of res2.list:
        upsert ActivitySession by (activityId, platformSessionId)
    if res.list.length < 50: break
// 最后跑一次 status 流转:
// enrollEndAt < now() 的 open → closed
// endAt < now() - 30d 的 closed → archived
```

### Enrollment sync(每天 03:00)

伪码:
```
for shop of active shops:
  pageNo = 1
  loop to pageMax=10:
    res = client.call(ep.listEnrollments, {pageNo, pageSize: 50})
    for item of res.list:
      upsert ActivityEnrollment by (shopId, activityId, sessionId, platformSkuId)
        update status from Temu 返回
    if res.list.length < 50: break
```

### 并发锁

使用 Redis `SETNX lock:activity-sync TTL 30min` / `lock:enrollment-sync TTL 30min`,避免 cron 双触发。(W2a 终审里标记的跟进项,W2b 直接带上。)

### 按需刷新

- `POST /activities/sync/now` → 跑一次完整 activity sync,忽略当天是否已跑过
- `POST /enrollments/:id/refresh` → 单条 enrollment,查 shop 的 enrollment.list.get 取回当前状态,upsert

### 错误处理模式

| 场景 | 处理 |
|---|---|
| cron 单店失败 | try/catch 吞掉,log warn,继续下一店 |
| submit 部分 SKU 失败 | per-shop try/catch,`results[]` 里 per-SKU 记录 `{ok, error}`,不抛 |
| Temu API 限流 | TemuClientFactory 自带 rate-limiter,cron 内 per-shop 调用自然排队 |
| 响应 shape 不对 | `res?.list ?? res?.activityList ?? []` 兜底链,空数组跳过该店 |
| 预校验警告 | 返回 `warnings: string[]` 但不阻止提交 |

### 单元测试覆盖

- `marketing-endpoints.ts` — 4 case(full/semi × cn/pa)
- `activity.service.ts`:
  - list 按 orgId 隔离
  - 聚合统计列正确(mock prisma count group)
  - BigInt 序列化
- `activity-sync.service.ts`:
  - 同 platformActivityId 被多店 sync,shopVisibility 正确去重累加
- `enrollment.service.ts`:
  - submit 按 shop 分组调用 Temu
  - 部分失败时 results[] 记录独立
  - refresh 单条更新

---

## 9. 范围边界 & 风险

### 明确不做(推到 W2b.5+)

- 真日历视图(月/周格子)
- 报名撤销/修改 UI
- 报名模板(活动价策略复用)
- 活动 GMV/销量分析
- 伪 webhook 活动到达推送
- 跨活动批量(同时报 N 个活动,目前单活动 × 多店多 SKU)

### 已知限制

1. **cron 每天只跑 2 轮** → 用户提交后最长等 24h 看到审核结果。用「立即同步」和「刷新」按钮兜底。
2. **Temu 响应 shape 未经真调验证** — 设计里用了 `?? ` 兜底链,首次真调仍可能踩坑;活动报名实操前写一个 diag 脚本 `scripts/diag-activity-enroll.mjs`。
3. **活动价字段名** — `bg.marketing.activity.enroll.submit` 入参里的活动价字段(可能叫 `activityPrice` / `supplyPrice` / `promoPrice`),文档为准;若首次调用 400 / 500,用 diag 脚本快速定位字段名。
4. **Redis products 缓存可能误导** — 缓存 TTL 300s 内若商家在 Temu 官网侧修改 SKU 状态,本地可报列表未刷新。接受这个风险,用户打开详情页若想最新就刷页(会穿透缓存重查)。
5. **shopVisibility JSON 不是强事实** — 只是 sync 发现时的快照;店铺授权变动或断开时不会主动撤;接受数据最终一致。

---

## 10. Done — 接下来

- 进入 `superpowers:writing-plans`,把本设计拆成 10-12 个顺序 task(模式同 W2a plan)
- 典型 task 划分:Prisma 模型+迁移 / marketing-endpoints 纯函数 + 测试 / ActivityService+DTO / ActivityController / ActivitySync+cron / EnrollmentService+DTO / EnrollmentController / EnrollmentSync+cron / 前端 API 客户端+store / ActivityListPage / ActivityDetailPage / EnrollmentListPage + E2E smoke + tag
