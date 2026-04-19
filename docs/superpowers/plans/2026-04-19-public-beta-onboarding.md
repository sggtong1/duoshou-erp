# Public Beta Onboarding & Deployment 实施 Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 W1/W2a/W2b 三个模块部署到 `https://duoshouerp.868818.xyz`,补齐前端店铺连接 UI 让邀请用户能自助 onboarding。

**Architecture:** 前端新增 2 页(`/shops` + `/shops/new`)+ HomePage 改造 + router guard 强制 onboarding;后端补 2 个端点(`POST /api/shops/test-connection`、`DELETE /api/shops/:id` 软断开);部署层改 docker-compose 为本地 build 模式,用 `git pull` + 一条 ssh 命令触发 VPS 重新 build + up;nginx 加 443 SSL + 80→443 redirect。

**Tech Stack:** Vue 3 + Naive UI、NestJS 10、Prisma 7、Docker Compose、nginx、Let's Encrypt certbot、GitHub Container Registry(不用,走 git-pull)。

---

## Context(已就位)

- W0 `ShopService.connect()` 已支持 **reconnect upsert**(existing shop → update credsVaultRef + status='active',见 `apps/api/src/modules/shop/shop.service.ts:87-99`);本 plan **不需要补 reconnect 逻辑**
- 凭据校验用 `bgMallInfoGet`(`bg.mall.info.get`),含 `shopType` cross-check(semi/full 不匹配时 BadRequest);`test-connection` 端点直接复用这套逻辑
- `nginx.conf` 当前只有 80 端口 HTTP,本 plan 在 T7 补 443 SSL + 80→443 redirect
- `.gitignore` 已排除 `.env.*` / `node_modules` / `dist`,仓库里无敏感信息
- GitHub repo `sggtong1/duoshou-erp` 已建 public,79 commit 已 push 到 main(通过 git subtree split)
- VPS 尚未初始化,DNS 尚未配置 —— 这些放在 T10(首次部署)由用户执行

## Env 新增

- VPS 侧 `/opt/duoshou-erp/.env.production`(不入 git,由用户手写):复用开发用 Supabase KEY + 生产特有变量(`NODE_ENV=production`, `REDIS_URL=redis://redis:6379`, `QUEUE_PREFIX=duoshou-prod`, `CORS_ORIGINS=https://duoshouerp.868818.xyz`)

## Scope 边界

**内**:shop 连接 UI + HomePage 改造 + 后端 2 端点 + docker-compose build 模式 + deploy.sh 改写 + push-to-github.sh + nginx 443 SSL + 部署文档 + 首次部署验收
**外**:新 Supabase 项目 / 隐私政策页 / MFA / OAuth / GitHub Actions 自动化 CI/CD / 监控告警 / VPS 系统级硬化

---

## Task 1: 后端 `POST /api/shops/test-connection` 端点

**Files:**
- Modify: `apps/api/src/modules/shop/shop.dto.ts`(加 `TestConnectionDto`)
- Modify: `apps/api/src/modules/shop/shop.service.ts`(加 `testConnection` 方法)
- Modify: `apps/api/src/modules/shop/shop.controller.ts`(加 `@Post('test-connection')` 路由)
- Create: `apps/api/src/modules/shop/shop.service.test.ts`(如文件不存在)或 modify 已有(加 testConnection 测试)

- [ ] **Step 1: DTO**

读 `apps/api/src/modules/shop/shop.dto.ts`,追加:
```typescript
export const TestConnectionDto = z.object({
  appKey: z.string().min(1),
  appSecret: z.string().min(1),
  accessToken: z.string().min(1),
  platformShopId: z.string().min(1),
  shopType: z.enum(['full', 'semi']),
  region: z.enum(['cn', 'pa']),
});
export type TestConnectionInput = z.infer<typeof TestConnectionDto>;
```

(如果 shop.dto.ts 里已经有 `ConnectShopDto`,新加的 `TestConnectionDto` 字段集合是它的子集,结构一致。)

- [ ] **Step 2: Service method**

在 `apps/api/src/modules/shop/shop.service.ts` 的 `ShopService` 类里加方法(放在 `connect` 之前或之后),**复用** `connect` 现有的 `bgMallInfoGet + shopType cross-check` 逻辑,但不写 DB:
```typescript
async testConnection(input: TestConnectionInput): Promise<{ ok: boolean; shopInfo?: any; error?: string }> {
  const ctx: TemuCallContext = {
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    region: input.region,
    shopId: 'pending',
  };
  try {
    const mallInfo = await bgMallInfoGet(ctx, {} as any);
    const reportedSemi = !!mallInfo?.semiManagedMall;
    if (reportedSemi && input.shopType !== 'semi') {
      return { ok: false, error: `店铺类型不匹配:Temu 报告半托管,你选择了 '${input.shopType}'` };
    }
    if (!reportedSemi && input.shopType !== 'full') {
      return { ok: false, error: `店铺类型不匹配:Temu 报告全托管,你选择了 '${input.shopType}'` };
    }
    return { ok: true, shopInfo: mallInfo };
  } catch (e: any) {
    return { ok: false, error: e.message ?? String(e) };
  }
}
```

顶部若没引入 `TestConnectionInput` 类型,加 `import type { ConnectShopInput, TestConnectionInput } from './shop.dto';`。

- [ ] **Step 3: Controller 路由**

读 `apps/api/src/modules/shop/shop.controller.ts`,在现有 `@Post()` connect 路由旁加:
```typescript
  @Post('test-connection')
  @UseGuards(AuthGuard)
  @UsePipes(new ZodValidationPipe(TestConnectionDto))
  async testConnection(@Body() body: TestConnectionInput) {
    return this.svc.testConnection(body);
  }
```

顶部 import 补:`TestConnectionDto, type TestConnectionInput`(从 `./shop.dto` 导入)。

- [ ] **Step 4: 单元测试**

读 `apps/api/src/modules/shop/shop.service.test.ts`(若存在)或创建。追加:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { ShopService } from './shop.service';
import * as sdk from '@duoshou/temu-sdk';

describe('ShopService.testConnection', () => {
  it('返回 ok=true 且 shopInfo,凭据 + shopType 一致时', async () => {
    vi.spyOn(sdk.methods as any, 'bgMallInfoGet').mockResolvedValueOnce({ semiManagedMall: false });
    const svc = new ShopService({} as any);
    const r = await svc.testConnection({
      appKey: 'k', appSecret: 's', accessToken: 't',
      platformShopId: '1001', shopType: 'full', region: 'pa',
    });
    expect(r.ok).toBe(true);
    expect(r.shopInfo).toBeDefined();
  });

  it('shopType 与 Temu 报告不一致时返回 ok=false', async () => {
    vi.spyOn(sdk.methods as any, 'bgMallInfoGet').mockResolvedValueOnce({ semiManagedMall: true });
    const svc = new ShopService({} as any);
    const r = await svc.testConnection({
      appKey: 'k', appSecret: 's', accessToken: 't',
      platformShopId: '1001', shopType: 'full', region: 'pa',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/半托管/);
  });

  it('Temu 抛错时返回 ok=false 含原 message', async () => {
    vi.spyOn(sdk.methods as any, 'bgMallInfoGet').mockRejectedValueOnce(new Error('Invalid signature'));
    const svc = new ShopService({} as any);
    const r = await svc.testConnection({
      appKey: 'k', appSecret: 's', accessToken: 't',
      platformShopId: '1001', shopType: 'full', region: 'pa',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Invalid signature');
  });
});
```

- [ ] **Step 5: 跑测试 + API 重载确认**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
pnpm vitest run src/modules/shop/shop.service.test.ts 2>&1 | tail -10
```
期望:3 passed。

```bash
tail -20 /tmp/duoshou-api.log | grep -E "test-connection|Nest application" | tail -5
```
期望:`Mapped {/api/shops/test-connection, POST} route` + `Nest application successfully started`。

未授权探针:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/shops/test-connection
```
期望:401(AuthGuard 生效)。

- [ ] **Step 6: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/shop/shop.dto.ts \
        duoshou-erp/apps/api/src/modules/shop/shop.service.ts \
        duoshou-erp/apps/api/src/modules/shop/shop.controller.ts \
        duoshou-erp/apps/api/src/modules/shop/shop.service.test.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(beta): POST /api/shops/test-connection validates credentials without persisting"
```

---

## Task 2: 后端 `DELETE /api/shops/:id` 软断开

**Files:**
- Modify: `apps/api/src/modules/shop/shop.service.ts`(加 `disconnect` 方法)
- Modify: `apps/api/src/modules/shop/shop.controller.ts`(加 `@Delete(':id')` 路由)

- [ ] **Step 1: Service method**

在 `ShopService` 类里加:
```typescript
async disconnect(orgId: string, id: string) {
  const shop = await this.prisma.shop.findFirst({ where: { id, orgId } });
  if (!shop) throw new NotFoundException('Shop not found');
  await this.prisma.shop.update({
    where: { id },
    data: { status: 'disconnected' },
  });
  return { ok: true };
}
```

顶部 import 补 `NotFoundException`(加到现有 `@nestjs/common` import 行:`BadRequestException, Inject, Injectable, NotFoundException`)。

- [ ] **Step 2: Controller 路由**

在 `shop.controller.ts` 加方法:
```typescript
  @Delete(':id')
  @UseGuards(AuthGuard)
  async disconnect(@Req() req: any, @Param('id') id: string) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.svc.disconnect(m.orgId, id);
  }
```

顶部 import 补 `Delete, Param`(加到现有 `@nestjs/common` import)。

- [ ] **Step 3: API 重载确认**

```bash
tail -20 /tmp/duoshou-api.log | grep -E "shops/:id|Nest application" | tail -5
```
期望看到 `Mapped {/api/shops/:id, DELETE} route` + application started。

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/shops/00000000-0000-0000-0000-000000000000
```
期望:401(未授权)。

- [ ] **Step 4: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/api/src/modules/shop/shop.service.ts \
        duoshou-erp/apps/api/src/modules/shop/shop.controller.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(api)(beta): DELETE /api/shops/:id soft-disconnect (status='disconnected')"
```

---

## Task 3: 前端 `shops.api.ts` 补 `testConnection` + `disconnect`

**Files:**
- Modify: `apps/web/src/api-client/shops.api.ts`

- [ ] **Step 1: 补方法 + 类型**

读 `apps/web/src/api-client/shops.api.ts`,替换整个文件为:
```typescript
import { http } from './http';

export interface Shop {
  id: string;
  platform: string;
  platformShopId: string;
  shopType: 'full' | 'semi';
  region: 'cn' | 'pa';
  displayName: string | null;
  status: string;
  connectedAt: string;
}

export interface TestConnectionInput {
  appKey: string;
  appSecret: string;
  accessToken: string;
  platformShopId: string;
  shopType: 'full' | 'semi';
  region: 'cn' | 'pa';
}

export interface TestConnectionResult {
  ok: boolean;
  shopInfo?: any;
  error?: string;
}

export const shopsApi = {
  list: () => http<Shop[]>('/shops'),
  connect: (input: TestConnectionInput & { displayName?: string }) =>
    http<Shop>('/shops', { method: 'POST', body: JSON.stringify(input) }),
  testConnection: (input: TestConnectionInput) =>
    http<TestConnectionResult>('/shops/test-connection', { method: 'POST', body: JSON.stringify(input) }),
  disconnect: (id: string) =>
    http<{ ok: boolean }>('/shops/' + id, { method: 'DELETE' }),
};
```

- [ ] **Step 2: tsc 验证**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm tsc --noEmit 2>&1 | grep -E "shops.api|error TS" | head -5
```
期望:无新错误。

- [ ] **Step 3: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/api-client/shops.api.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(beta): shops API client add testConnection + disconnect"
```

---

## Task 4: 前端 `ShopsConnectPage.vue`(添加店铺页)

**Files:**
- Create: `apps/web/src/pages/shops/ShopsConnectPage.vue`

- [ ] **Step 1: 页面**

```vue
<template>
  <n-card title="连接 Temu 店铺" style="max-width: 640px; margin: 40px auto;">
    <n-form label-placement="top" require-mark-placement="right-hanging">
      <n-grid :cols="2" :x-gap="16">
        <n-form-item-gi label="店铺类型" required>
          <n-select v-model:value="form.shopType" :options="shopTypeOptions" />
        </n-form-item-gi>
        <n-form-item-gi label="区域" required>
          <n-select v-model:value="form.region" :options="regionOptions" />
        </n-form-item-gi>
      </n-grid>
      <n-form-item label="Platform Shop ID" required>
        <n-input v-model:value="form.platformShopId" placeholder="Temu 卖家中心里看到的店铺 ID" />
      </n-form-item>
      <n-form-item label="App Key" required>
        <n-input v-model:value="form.appKey" />
      </n-form-item>
      <n-form-item label="App Secret" required>
        <n-input v-model:value="form.appSecret" type="password" show-password-on="click" />
      </n-form-item>
      <n-form-item label="Access Token" required>
        <n-input v-model:value="form.accessToken" type="password" show-password-on="click" />
      </n-form-item>
      <n-form-item label="店铺显示名(可选)">
        <n-input v-model:value="form.displayName" placeholder="方便识别,不填默认用 Platform Shop ID" />
      </n-form-item>

      <n-space style="margin-top: 12px;">
        <n-button :loading="testing" :disabled="!canSubmit" @click="onTest">🔍 测试连接</n-button>
        <n-button type="primary" :loading="saving" :disabled="!canSubmit" @click="onSave">💾 保存</n-button>
        <n-button @click="$router.back()">取消</n-button>
      </n-space>

      <n-alert v-if="testResult?.ok" type="success" style="margin-top: 12px;">
        ✅ 连接成功 — Temu 返回:{{ JSON.stringify(testResult.shopInfo) }}
      </n-alert>
      <n-alert v-else-if="testResult && !testResult.ok" type="error" style="margin-top: 12px;">
        ❌ 测试失败:{{ testResult.error }}
      </n-alert>
    </n-form>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NForm, NFormItem, NFormItemGi, NGrid, NInput, NSelect, NButton, NSpace, NAlert, useMessage,
} from 'naive-ui';
import { shopsApi, type TestConnectionResult } from '@/api-client/shops.api';
import { useShopsStore } from '@/stores/shops';

const router = useRouter();
const msg = useMessage();
const shopsStore = useShopsStore();

const form = ref({
  shopType: 'full' as 'full' | 'semi',
  region: 'pa' as 'cn' | 'pa',
  platformShopId: '',
  appKey: '',
  appSecret: '',
  accessToken: '',
  displayName: '',
});
const testing = ref(false);
const saving = ref(false);
const testResult = ref<TestConnectionResult | null>(null);

const shopTypeOptions = [
  { label: '全托管', value: 'full' },
  { label: '半托管', value: 'semi' },
];
const regionOptions = [
  { label: '中国站(CN)', value: 'cn' },
  { label: '美国站(PA)', value: 'pa' },
];

const canSubmit = computed(() =>
  form.value.platformShopId && form.value.appKey && form.value.appSecret && form.value.accessToken,
);

async function onTest() {
  testing.value = true;
  testResult.value = null;
  try {
    const r = await shopsApi.testConnection({
      shopType: form.value.shopType,
      region: form.value.region,
      platformShopId: form.value.platformShopId,
      appKey: form.value.appKey,
      appSecret: form.value.appSecret,
      accessToken: form.value.accessToken,
    });
    testResult.value = r;
  } catch (e: any) {
    msg.error(e.message);
  } finally { testing.value = false; }
}

async function onSave() {
  if (!testResult.value?.ok) {
    const confirmed = window.confirm('还没测试连接,或测试失败,确定保存吗?');
    if (!confirmed) return;
  }
  saving.value = true;
  try {
    await shopsApi.connect({
      shopType: form.value.shopType,
      region: form.value.region,
      platformShopId: form.value.platformShopId,
      appKey: form.value.appKey,
      appSecret: form.value.appSecret,
      accessToken: form.value.accessToken,
      displayName: form.value.displayName || undefined,
    });
    msg.success('店铺连接成功');
    await shopsStore.fetch();
    router.push('/shops');
  } catch (e: any) {
    msg.error(e.message ?? '保存失败');
  } finally { saving.value = false; }
}
</script>
```

- [ ] **Step 2: 临时路由验证构建**

手动暂时加路由(T6 会系统性加),先验证 tsc + vite build 通过:
```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm tsc --noEmit 2>&1 | grep -E "ShopsConnect|error TS" | head -5
```
期望:无新错误(页面文件单独不会被引用,所以 tsc 不会 lint 它除非引入 router;先不引入)。

实际的构建 + 路由注册放 T6 一起做。

- [ ] **Step 3: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages/shops/ShopsConnectPage.vue
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(beta): ShopsConnectPage with inline test-connection before save"
```

---

## Task 5: 前端 `ShopsListPage.vue`(列表页 + 空态)

**Files:**
- Create: `apps/web/src/pages/shops/ShopsListPage.vue`

- [ ] **Step 1: 页面**

```vue
<template>
  <n-card title="我的店铺">
    <template #header-extra>
      <n-button type="primary" @click="$router.push('/shops/new')">➕ 添加店铺</n-button>
    </template>

    <n-empty v-if="!shops.loading && shops.items.length === 0" description="你还没有连接任何店铺">
      <template #extra>
        <n-button type="primary" @click="$router.push('/shops/new')">去连接第一家店铺</n-button>
      </template>
    </n-empty>

    <n-data-table
      v-else
      :columns="columns"
      :data="shops.items"
      :loading="shops.loading"
      :row-key="(r: any) => r.id"
    />
  </n-card>
</template>

<script setup lang="ts">
import { onMounted, h } from 'vue';
import {
  NCard, NButton, NDataTable, NEmpty, NTag, NPopconfirm, useMessage,
} from 'naive-ui';
import { useShopsStore } from '@/stores/shops';
import { shopsApi, type Shop } from '@/api-client/shops.api';

const msg = useMessage();
const shops = useShopsStore();

onMounted(() => shops.fetch());

async function doDisconnect(id: string) {
  try {
    await shopsApi.disconnect(id);
    msg.success('已断开');
    await shops.fetch();
  } catch (e: any) {
    msg.error(e.message ?? '断开失败');
  }
}

const columns: any[] = [
  { title: '显示名', key: 'displayName', render: (r: Shop) => r.displayName ?? '—' },
  { title: 'Platform Shop ID', key: 'platformShopId' },
  {
    title: '类型',
    key: 'shopType',
    render: (r: Shop) => r.shopType === 'full' ? '全托管' : '半托管',
  },
  {
    title: '区域',
    key: 'region',
    render: (r: Shop) => r.region === 'cn' ? 'CN' : 'PA',
  },
  {
    title: '状态',
    key: 'status',
    render: (r: Shop) => h(NTag, {
      type: r.status === 'active' ? 'success' : 'default',
    }, () => r.status === 'active' ? '✅ 活跃' : '⚫ 已断开'),
  },
  {
    title: '操作',
    key: 'actions',
    render: (r: Shop) => r.status === 'active'
      ? h(NPopconfirm, {
          onPositiveClick: () => doDisconnect(r.id),
        }, {
          default: () => '断开后此店的同步任务会停止,但历史数据保留。确认?',
          trigger: () => h(NButton, { size: 'small', type: 'error', tertiary: true }, () => '断开'),
        })
      : h(NButton, { size: 'small', disabled: true, tertiary: true }, () => '—'),
  },
];
</script>
```

- [ ] **Step 2: tsc 验证**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm tsc --noEmit 2>&1 | grep -E "ShopsList|error TS" | head -5
```
期望:无新错误。

- [ ] **Step 3: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages/shops/ShopsListPage.vue
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(beta): ShopsListPage with soft-disconnect + empty state"
```

---

## Task 6: HomePage 改造 + router guard + 注册 2 路由

**Files:**
- Modify: `apps/web/src/pages/HomePage.vue`
- Modify: `apps/web/src/router/index.ts`

- [ ] **Step 1: HomePage 加店铺管理入口**

读 `apps/web/src/pages/HomePage.vue`,把「店铺管理」按钮加到现有按钮组的**第一个**(在「货品模板」之前):
```vue
<n-space vertical>
  <n-button @click="$router.push('/shops')">店铺管理</n-button>
  <n-button @click="$router.push('/templates')">货品模板</n-button>
  <n-button @click="$router.push('/products')">我的商品</n-button>
  <n-button @click="$router.push('/price-reviews')">核价单</n-button>
  <n-button @click="$router.push('/price-adjustments/new')">提交调价</n-button>
  <n-button @click="$router.push('/activities')">活动日历</n-button>
  <n-button @click="$router.push('/enrollments')">已报名</n-button>
  <n-button @click="auth.logout()">退出登录</n-button>
</n-space>
```

- [ ] **Step 2: router 加 2 条 shops 路由**

读 `apps/web/src/router/index.ts`,顶部 import 补:
```typescript
import ShopsListPage from '@/pages/shops/ShopsListPage.vue';
import ShopsConnectPage from '@/pages/shops/ShopsConnectPage.vue';
```

routes 数组里加:
```typescript
{ path: '/shops', component: ShopsListPage, meta: { requiresAuth: true } },
{ path: '/shops/new', component: ShopsConnectPage, meta: { requiresAuth: true } },
```

- [ ] **Step 3: router guard 强制 onboarding**

读 `apps/web/src/router/index.ts`,找到现有的 `router.beforeEach(...)`(通常位于文件末尾,检查 auth 后 return/redirect)。在现有 auth 检查**之后**、return 前,追加"检查是否有 active shop":

```typescript
router.beforeEach(async (to) => {
  // 保留现有 auth 检查逻辑(跟 meta.requiresAuth 有关)
  // ...

  // 新增:强制 onboarding — 进入受保护路径前,若无 active shop,redirect 到 /shops/new
  if (to.meta.requiresAuth && !to.path.startsWith('/shops')) {
    const { useShopsStore } = await import('@/stores/shops');
    const shops = useShopsStore();
    if (!shops.items.length) {
      try { await shops.fetch(); }
      catch { /* 首次 fetch 失败不阻塞,让用户进去再 retry */ }
    }
    const hasActive = shops.items.some((s) => s.status === 'active');
    if (!hasActive) return '/shops/new';
  }
  return true;
});
```

注意:具体 guard 代码要插到现有 beforeEach **的 auth 逻辑之后**,不是整个替换。读清现有的 guard 结构,insert 相应位置。

- [ ] **Step 4: 构建**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm build 2>&1 | tail -8
```
期望:vue-tsc + vite build 通过,"✓ built in ..."。

- [ ] **Step 5: 本地浏览器手工验证(可选但强烈建议)**

浏览器打开 http://localhost:5173/:
1. 登录现有测试账号,首页出现「店铺管理」按钮
2. 点「店铺管理」→ `/shops` 列表页
3. 点「添加店铺」→ `/shops/new` 表单页
4. 填凭据、测试连接、保存 → 回 `/shops` 列表,新店出现
5. 点「断开」→ 状态变「⚫ 已断开」
6. 退出登录 → 用新邮箱注册 → 登录 → 自动 redirect `/shops/new`(强制 onboarding)

若任何步骤异常 STOP 并报 BLOCKED。

- [ ] **Step 6: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/apps/web/src/pages/HomePage.vue \
        duoshou-erp/apps/web/src/router/index.ts
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(web)(beta): wire /shops routes + HomePage entry + force-onboarding router guard"
```

---

## Task 7: docker-compose 改 build 模式 + nginx 加 443 SSL

**Files:**
- Modify: `infra/docker/docker-compose.yml`
- Modify: `infra/docker/nginx.conf`

- [ ] **Step 1: docker-compose.yml 改为 build 模式**

整文件替换为:
```yaml
services:
  api:
    image: duoshou/api:latest
    build:
      context: ../..
      dockerfile: infra/docker/api.Dockerfile
    restart: always
    env_file: ../../.env.production
    depends_on:
      - redis
    networks:
      - internal

  web:
    image: duoshou/web:latest
    build:
      context: ../..
      dockerfile: infra/docker/web.Dockerfile
    restart: always
    depends_on:
      - api
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./letsencrypt:/etc/letsencrypt:ro
    networks:
      - internal

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis-data:/data
    networks:
      - internal

networks:
  internal:

volumes:
  redis-data:
```

- [ ] **Step 2: nginx.conf 改为 443 SSL + 80→443 redirect**

整文件替换为:
```nginx
events {}
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  sendfile on;

  # 80 端口只做 redirect 到 443
  server {
    listen 80;
    server_name duoshouerp.868818.xyz;
    return 301 https://$host$request_uri;
  }

  # 主 server:443 SSL
  server {
    listen 443 ssl http2;
    server_name duoshouerp.868818.xyz;

    ssl_certificate /etc/letsencrypt/live/duoshouerp.868818.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/duoshouerp.868818.xyz/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /usr/share/nginx/html;
    index index.html;

    location / {
      try_files $uri $uri/ /index.html;
    }

    location /api/ {
      proxy_pass http://api:3000/api/;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    }
  }
}
```

- [ ] **Step 3: 本地 build 验证(不 up,只 build)**

```bash
cd /Users/mx4com/coding/duoshou-erp/infra/docker
docker compose build api web 2>&1 | tail -10
```

期望:build 成功,末尾显示 `naming to docker.io/library/duoshou/api:latest` 和 `...duoshou/web:latest`,无 error。

**注意**:build web 时 nginx 会把 `nginx.conf` 拷贝进镜像(具体在 `web.Dockerfile` 里)。如果 build 失败可能是 dockerfile 里引用的路径要调整。

- [ ] **Step 4: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/infra/docker/docker-compose.yml \
        duoshou-erp/infra/docker/nginx.conf
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(infra)(beta): docker-compose uses local build + nginx adds 443 SSL with 80→443 redirect"
```

---

## Task 8: deploy.sh 改写 + push-to-github.sh 新增

**Files:**
- Modify: `infra/deploy/deploy.sh`
- Create: `infra/deploy/push-to-github.sh`

- [ ] **Step 1: deploy.sh 改 git-pull 模式**

整文件替换为:
```bash
#!/usr/bin/env bash
# Deploy the latest `main` from GitHub to the VPS.
# Usage:
#   DEPLOY_HOST=your-vps.example.com DEPLOY_USER=ubuntu bash infra/deploy/deploy.sh
#
# Assumes the VPS has /opt/duoshou-erp as a clone of
# https://github.com/sggtong1/duoshou-erp.git and /opt/duoshou-erp/.env.production
# exists (see docs/deploy/README.md).
set -euo pipefail

SERVER="${DEPLOY_HOST:?DEPLOY_HOST required}"
USER="${DEPLOY_USER:-ubuntu}"

echo "Deploying to ${USER}@${SERVER}"

ssh "${USER}@${SERVER}" <<'EOF'
set -euo pipefail
cd /opt/duoshou-erp
git fetch origin
git reset --hard origin/main
cd infra/docker
docker compose build api web
docker compose up -d
docker image prune -f
echo "--- tail api log ---"
docker compose logs --tail 30 api
EOF

echo "Deploy done."
```

- [ ] **Step 2: push-to-github.sh 新增**

```bash
#!/usr/bin/env bash
# Push duoshou-erp/ subdirectory to the independent GitHub repo.
# Usage: bash infra/deploy/push-to-github.sh
#
# This repo lives as a subdirectory of a parent git repo at /Users/mx4com/coding.
# `git subtree push` splits the duoshou-erp/ history and pushes it as
# independent commits to the GitHub repo's main branch.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
GITHUB_URL="https://github.com/sggtong1/duoshou-erp.git"

# 如果当前在 duoshou-erp/ 子目录里运行,父 repo 才是 subtree 操作的上下文
# git rev-parse --show-toplevel 应该返回 /Users/mx4com/coding
if [ ! -d "${REPO_ROOT}/duoshou-erp" ]; then
  echo "Error: /Users/mx4com/coding/duoshou-erp not found. Are you running from the correct parent repo?"
  exit 1
fi

cd "${REPO_ROOT}"
echo "Pushing duoshou-erp subtree to ${GITHUB_URL} main..."
git subtree push -P duoshou-erp "${GITHUB_URL}" main
echo "Push done."
```

- [ ] **Step 3: chmod + 基本语法检查**

```bash
chmod +x /Users/mx4com/coding/duoshou-erp/infra/deploy/deploy.sh \
         /Users/mx4com/coding/duoshou-erp/infra/deploy/push-to-github.sh
bash -n /Users/mx4com/coding/duoshou-erp/infra/deploy/deploy.sh && echo "deploy.sh OK"
bash -n /Users/mx4com/coding/duoshou-erp/infra/deploy/push-to-github.sh && echo "push-to-github.sh OK"
```
期望两个都 "OK"(无 syntax error)。

- [ ] **Step 4: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/infra/deploy/deploy.sh \
        duoshou-erp/infra/deploy/push-to-github.sh
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "feat(infra)(beta): deploy.sh uses git-pull + local build; add push-to-github.sh for subtree push"
```

---

## Task 9: 部署文档 `docs/deploy/README.md`

**Files:**
- Create: `docs/deploy/README.md`

- [ ] **Step 1: 写文档**

**⚠ 嵌套 markdown 转义说明**:本 Step 用外层 ```markdown...``` fence 把整个 README.md 内容包起来。为了避免和外层 fence 冲突,内部所有真实的三反引号代码块都写成了 `\` + 三反引号(形如 `\```bash`)。**你写入实际 `docs/deploy/README.md` 时,要把每个 `\` 去掉,只保留纯三反引号**。

创建 `docs/deploy/README.md`,内容如下(记得去转义):

```markdown
# 公测部署手册

目标域名:`https://duoshouerp.868818.xyz`
目标 VPS:Ubuntu 22.04 建议 ≥ 2GB RAM / 20GB 磁盘

---

## 一次性准备

### 1. DNS 配置

在 `868818.xyz` 域名管理后台加一条 A 记录:

| Host         | Type | Value            | TTL |
|--------------|------|------------------|-----|
| duoshouerp   | A    | <VPS 公网 IP>    | 600 |

验证:
\`\`\`bash
dig duoshouerp.868818.xyz +short
# 应返回 VPS IP
\`\`\`

### 2. VPS 初始化

以 `ubuntu` 账号 SSH 进入 VPS:

\`\`\`bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新 SSH 一次让 group 生效

# 开防火墙
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable

# 创建工作目录
sudo mkdir -p /opt/duoshou-erp
sudo chown $USER:$USER /opt/duoshou-erp

# clone repo(public repo 无需认证)
git clone https://github.com/sggtong1/duoshou-erp.git /opt/duoshou-erp
\`\`\`

### 3. `.env.production`

在 VPS 上 `/opt/duoshou-erp/.env.production`(**不入 git**,手写):

\`\`\`bash
cat > /opt/duoshou-erp/.env.production <<'ENV'
NODE_ENV=production
PORT=3000
DATABASE_URL=<粘贴开发用 .env.development 的同名 value>
SUPABASE_URL=<粘贴>
SUPABASE_ANON_KEY=<粘贴>
SUPABASE_SERVICE_ROLE_KEY=<粘贴>
CREDS_ENCRYPTION_KEY=<粘贴(或者新生成 32 字节 base64 串)>
REDIS_URL=redis://redis:6379
QUEUE_PREFIX=duoshou-prod
CORS_ORIGINS=https://duoshouerp.868818.xyz
ENV

chmod 600 /opt/duoshou-erp/.env.production
\`\`\`

### 4. SSL 首次签发

DNS 必须先生效(`dig` 返回正确 IP),然后:

\`\`\`bash
cd /opt/duoshou-erp/infra/docker
mkdir -p letsencrypt

# 第一次跑 certbot,用 standalone 模式占 80 端口
docker run -it --rm \\
  -v /opt/duoshou-erp/infra/docker/letsencrypt:/etc/letsencrypt \\
  -p 80:80 \\
  certbot/certbot certonly --standalone \\
  -d duoshouerp.868818.xyz \\
  --agree-tos -m <your@email.com> --no-eff-email
\`\`\`

成功后 `./letsencrypt/live/duoshouerp.868818.xyz/fullchain.pem` 和 `privkey.pem` 存在。

### 5. 续期 crontab

\`\`\`bash
sudo crontab -e
# 加一行(每周一 03:00 跑):
0 3 * * 1 cd /opt/duoshou-erp/infra/docker && docker run --rm -v $PWD/letsencrypt:/etc/letsencrypt certbot/certbot renew --quiet && docker compose restart web
\`\`\`

### 6. 首次启动

\`\`\`bash
cd /opt/duoshou-erp/infra/docker
docker compose build api web    # 首次约 8-12 分钟
docker compose up -d
docker compose logs -f api      # 看 Nest 启动,Ctrl+C 退出
\`\`\`

浏览器访问 `https://duoshouerp.868818.xyz`,应该能打开登录页。

---

## 日常更新流程

### A. 开发机推代码到 GitHub

\`\`\`bash
# 在父 repo /Users/mx4com/coding 提交新 commit 到 duoshou-erp/ 路径后
cd /Users/mx4com/coding
bash duoshou-erp/infra/deploy/push-to-github.sh
\`\`\`

### B. 触发 VPS 拉新代码 + 重建 + 重启

\`\`\`bash
# 在开发机(需要 VPS 的 SSH 权限):
DEPLOY_HOST=<vps-host-or-ip> DEPLOY_USER=ubuntu \\
  bash duoshou-erp/infra/deploy/deploy.sh
\`\`\`

脚本会 ssh 上 VPS → git pull → docker compose build → up -d → 显示 api log 尾部。

### 回滚

\`\`\`bash
ssh <vps> 'cd /opt/duoshou-erp && git reset --hard <old-sha> && cd infra/docker && docker compose build api web && docker compose up -d'
\`\`\`

---

## 验收 checkpoint

部署完成后,按顺序验证:

- [ ] **A. DNS + SSL 就位**:浏览器打开 `https://duoshouerp.868818.xyz`,出现登录页,证书绿锁无警告
- [ ] **B. 完整 onboarding 流走通**:
  1. 用新邮箱注册(需要能收 Supabase 验证邮件)
  2. 登录 → 自动 redirect 到 `/shops/new`
  3. 填真实 Temu 测试凭据 → 点「测试连接」→ ✅ 绿
  4. 点「保存」→ 跳 `/shops` → 店铺列表里看到新店
  5. 点「货品模板」「核价单」「活动日历」等模块,都能打开
- [ ] **C. 邀请测试**:把 URL 发给 1 位朋友,他能独立完成 A + B 流程,试一次发品 / 核价 / 活动报名

---

## 常见问题

### Q: 证书报错 "unable to obtain certificate"
A: 检查 DNS 是否生效(`dig duoshouerp.868818.xyz` 返回 VPS IP),防火墙 80 是否开。

### Q: `docker compose build` 卡在 pnpm install
A: 首次构建会拉 Node 镜像 + 装依赖,10 分钟正常。网络差可以重试。

### Q: API 容器启动后立即退出
A: `docker compose logs api` 看错误。通常是 `.env.production` 里 `DATABASE_URL` 或 `REDIS_URL` 配错。`REDIS_URL` 必须是 `redis://redis:6379`(容器名不是 localhost)。

### Q: 部署后用户注册收不到验证邮件
A: Supabase 默认每 IP 每小时限 3 封邮件。邀请测试规模内一般够。若打到限,在 Supabase dashboard 配置自定义 SMTP(如 Resend / SendGrid)。

### Q: 硬盘满了
A: `docker system prune -af` 清 build cache。每周 1 次是安全的。

### Q: 证书 60 天后还没自动续期
A: 手动跑:
\`\`\`bash
cd /opt/duoshou-erp/infra/docker
docker run --rm -v $PWD/letsencrypt:/etc/letsencrypt certbot/certbot renew
docker compose restart web
\`\`\`
```

(注意:上面文档里的 `\`\`\`` 是为了避免和外层 code block 冲突的转义,实际写入文件时是普通三反引号。)

- [ ] **Step 2: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/docs/deploy/README.md
git -c user.name="mx4c" -c user.email="mx4c2026@gmail.com" commit -m "docs(deploy)(beta): public beta deployment handbook (DNS + SSL + docker + deploy script)"
```

---

## Task 10: 首次部署 + A/B/C 验收

**Files:** 无代码改动 —— 本 task 在 VPS 端执行 T9 文档里的步骤。

**前置**:T7 改的 docker-compose + nginx 必须已经 push 到 GitHub main(完成 T1-T9 的所有 commit 后,跑一次 `push-to-github.sh`)。

- [ ] **Step 1: 推最新代码到 GitHub**

```bash
cd /Users/mx4com/coding
bash duoshou-erp/infra/deploy/push-to-github.sh 2>&1 | tail -5
```

期望:`Push done.`,无错误。

- [ ] **Step 2: VPS 初始化**

按 `docs/deploy/README.md` § 一次性准备 § 1-3 执行:
1. DNS 加 A 记录(父域管理后台)
2. VPS 装 Docker + 开防火墙 + clone repo
3. 手写 `.env.production`

**期望**:`dig duoshouerp.868818.xyz` 返回 VPS IP;`/opt/duoshou-erp/` 里有完整 repo;`.env.production` 存在且 chmod 600。

- [ ] **Step 3: SSL 首次签发**

按 § 4 跑 certbot standalone:
```bash
cd /opt/duoshou-erp/infra/docker
mkdir -p letsencrypt
docker run -it --rm \
  -v /opt/duoshou-erp/infra/docker/letsencrypt:/etc/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d duoshouerp.868818.xyz \
  --agree-tos -m <your-email> --no-eff-email
```

期望:成功生成 fullchain.pem + privkey.pem。

- [ ] **Step 4: 配置续期 crontab**

按 § 5 加 `sudo crontab` 条目。

- [ ] **Step 5: 首次启动**

```bash
cd /opt/duoshou-erp/infra/docker
docker compose build api web
docker compose up -d
docker compose ps  # 3 个服务都 Up
docker compose logs --tail 30 api  # Nest application successfully started
```

期望:api/web/redis 3 个容器 Up;api log 显示所有 routes mapped + application started。

- [ ] **Step 6: 验收 A — DNS + SSL 就位**

浏览器打开 `https://duoshouerp.868818.xyz`:
- 证书绿锁,无警告
- 登录页渲染(舵手 ERP 登录标题)

若证书错误 / 页面打不开 STOP 并 debug。

- [ ] **Step 7: 验收 B — 完整 onboarding 流**

操作序列:
1. 用新邮箱注册(例如 `public-beta-test-001@<你的域名>` 或个人邮箱别名)
2. 收到 Supabase 验证邮件,点链接
3. 回登录页登录 → **自动 redirect 到 `/shops/new`**(router guard 触发)
4. 填真实 Temu 测试凭据(从 `.env.development` 里的 `TEMU_FULL_TEST_1_*` 复制)
5. 点「🔍 测试连接」→ 显示 `✅ 连接成功 — Temu 返回: {...}`
6. 点「💾 保存」→ toast「店铺连接成功」→ 跳 `/shops` 列表页
7. 看到新店一行,状态 `✅ 活跃`
8. 点 HomePage「货品模板」「核价单」「活动日历」,都能正常打开
9. 点 `/shops` 列表里的「断开」→ popconfirm 确认 → 状态变「⚫ 已断开」
10. 回 HomePage,点其他模块,再次被 router guard 拦到 `/shops/new`(因为无 active shop)

若任何一步失败 STOP 并记录日志。

- [ ] **Step 8: 验收 C — 邀请 1 位朋友自助测试**

- 把 `https://duoshouerp.868818.xyz` 发给一个朋友
- 他用自己邮箱注册
- 他用自己的一家 Temu 店凭据连接(不是你的测试凭据)
- 他试一次发品 / 核价 / 活动报名(任一模块,跑通流程即可)
- 过程中你不干预

**检查点**:他整个过程里有没有卡住、感到困惑、需要问你问题。记录所有痛点。

- [ ] **Step 9: 结束 + commit tag**

```bash
cd /Users/mx4com/coding/duoshou-erp
git tag public-beta-launch
# 记录验收过程、遇到的偏差、朋友的反馈,写进一个 docs/deploy/launch-log.md(选)
```

公测开闸 🎉

---

## Done — 接下来

- `public-beta-launch` tag 标记上线时间
- 观察 2-4 周邀请用户使用情况
- 收集反馈,决定下一步:
  - **迭代现有模块**(UI 打磨、修 bug、加细节功能)
  - **W3 库存**(按原路线图推进)
  - **W4 Temu 应用市场提交**(若邀请反馈价值证明后正式审核)

## 已知跟进项(W2a/W2b 终审标记,未在本 plan 内)

- `(this.prisma as any)` 泛滥 — 一次性统一去掉
- Role guard(admin/staff/owner 分权)— 当前所有 org 成员同权
- `PriceReview.error` 字段 — 失败批次无处留痕
- Adjustment list UI — W2a 有后端端点但无前端页
- Inbox 失败详情展开 — W2a/W2b batch 结果只显示计数
- vite bundle >500kB 警告
