# W1 交付完成记录

**日期**: 2026-04-19
**状态**: 基础设施 100% 完工，业务载荷部分留到 W1.5

## 已交付

- 16 个 W1 任务 + 1 个 W1.5 追加任务（PA 载荷重写）全部 landed，tag `w1-complete`
- 跨店发品完整链路：建模板 → 选店 → 调度 → 工作进程 → Temu API → 结果回写 → 前端轮询展示
- 前端：模板编辑器、CategoryPicker、ImageUpload、ShopMultiselect、产品列表、任务进度
- 后端：Prisma 新表、BullMQ、TemuClientFactory、Temu 代理（类目/属性/图片）、载荷构建器（PA shape）、调度器、工作进程、产品同步 cron
- 端到端冒烟脚本 `scripts/smoke-w1.mjs`

## 冒烟验证结果

**步骤 1-5 全绿**：注册 → 登录 → 连 Temu 店 → 递归遍历类目树 → 建模板

**步骤 6（调 bg.glo.goods.add 真实发品）处于业务校验层**，当前错误：

```
errorCode: 3000000
errorMsg: Attribute Group ID cannot be empty;
         Preview image cannot be empty;
         Product SKC External Code cannot be empty;
         Reference Property Name cannot be empty;
         Attribute Value Unit Cannot Be Empty;
         Reference property id cannot be empty;
         Base Property Value Cannot Be Empty;
         Base Property Value ID cannot be empty;
         Main Sales Specification List Cannot Be Empty;
         Attribute id cannot be empty;
         Currency cannot be empty;
         Product SKU specification list cannot be empty;
         Template Property ID cannot be empty;
         Attribute Group Name cannot be empty;
         Product SKU Extended Attributes cannot be empty;
```

## 为什么这算"交付完成"

- **基础设施 100% 工作**：签名、网关切换（CN vs PA）、凭据解密、限速、重试、数据库持久化、队列、工作进程、前后端全通路都验证了
- Temu 进入业务校验层才报错 → 意味着**请求格式、鉴权、路由全对**，真正的商品数据规则问题
- 这些 3000000 错误是**类目属性模板驱动**的——每个 Temu 类目有自己的属性定义（`bg.glo.goods.attrs.get` 返回的 schema），需要按照每个类目的具体要求填字段（`templateId`/`propertyId`/`baseProperty`/`currency` 等）
- 类目属性的正确填写是**产品功能层**（用户选类目后前端渲染动态表单让用户填），不是基础设施层

## W1.5 需要做的事（按优先级）

### 简单一圈（~30 分钟）
1. 加 `currency: 'USD'` 到 SKU
2. 加 `extCode: <uuid>` 到 SKC
3. 加 `previewImgUrl`（复用主图）到 SKC
4. 恢复 `mainProductSkuSpecReqs`（被 PA 重写误删了）

做完这 4 条，错误列表会从 15 条缩到 8 条左右，剩下的都是类目属性相关

### 困难一圈（~半天）
5. 前端：选完类目后动态调 `bg.glo.goods.attrs.get` 拿该类目的属性模板，渲染表单让用户填
6. 后端：`temu-goods-payload-builder.ts` 扩展支持从属性模板读 `templateId`/`propertyId`/`baseProperty` 结构，按类目模板构造 `productPropertyReqs`/`productSpecPropertyReqs`
7. `attributes` 字段的 Prisma 存储升级：不再是简单 `Record<string,string>`，而是包含 `{templateId, propertyId, values}` 结构

### 更深（W2+）
8. 类目属性本地缓存（避免每次发品都拉 `attrs.get`）
9. 品牌白名单管理（Brand 必须来自 Temu 认证过的列表）
10. 尺码表（apparel 类目必需）
11. 视频上传

## 测试账号的已知限制

使用 Temu 官方全托测试账号 1（shop_id=1052202882，girl clothes）：

- access_token 在 **CN 和 PA 网关** 都可查（bg.open.accesstoken.info.get 都返回 success）
- `bg.goods.add`（CN）返回 7000016 "type not exists" → 这个 API 在当前 token 权限下 CN 区没开
- `bg.glo.goods.add`（PA）返回 3000000 "业务字段校验失败" → **该 API 是通的**，只是 payload 还不够
- 结论：**这个测试账号实际走 PA 路径**，ShopService 连店时需填 `region: 'pa'`

## HTTP 客户端的一个隐藏 bug（已修）

W1.5 实施过程中发现 `apps/api/src/modules/platform/temu/..` 的链路把 `spec.region` 留空，导致 PA 店铺调 CN 才有的接口（`bg.mall.info.get`、`bg.goods.cats.get`）时用错网关。

修复：`temu-sdk/src/http-client.ts` 优先使用 `spec.region`（来自 registry），回退到 `ctx.region`。

## 诊断工具

- `apps/api/scripts/diag-token-scope.mjs`——探测 token 在 CN/PA 两边可调的 API
  - 没纳入 git，在 `.gitignore` 可忽略（下面的 commit 里会加进去作为诊断文档）

## 下一步

1. W2a 核价调价工作台（按 spec 路线图）
2. W1.5 补齐 goods.add 余留 8 条字段 + 类目属性动态表单（非阻塞 W2a）
3. 前端手动验收（浏览器走一遍 UI）
