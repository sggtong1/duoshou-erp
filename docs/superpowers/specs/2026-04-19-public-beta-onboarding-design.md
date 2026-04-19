# Public Beta Onboarding & Deployment 设计方案

- **状态**: 头脑风暴完成,待实施
- **日期**: 2026-04-19
- **作者**: Claude + mx4c
- **前置**: W0–W2b 模块已交付(tag `w2b-complete`)+ W2b.5 硬化完成
- **下一步**: `superpowers:writing-plans` 生成实施 plan

---

## 1. 背景 & 定位

W0→W1→W2a→W2b 四个模块已完成核心功能,本地跑起来全走通。现在**暂停新模块开发**,把已有能力搬到公网邀请 2–5 个真实用户试用。验证用户价值、UI 顺滑度、Temu API 对接在生产环境下的稳定性,再决定下一步做 W3(库存)还是迭代现有模块。

不走 Temu 应用市场官方审核(那是 W4 完整工作,需要 UI 打磨 + 演示视频 + 隐私政策 + 审核回复,周期 2–4 周)。**走自部署 + 邀请链接**路径。

**一句话**: 把 W1/W2a/W2b 部署到 `https://duoshouerp.868818.xyz`,补一个店铺连接 UI 让邀请用户能自助 onboarding。

---

## 2. 目标 & 非目标

### 目标

- 邀请用户打开 `https://duoshouerp.868818.xyz` 能注册 → 登录 → 自助连接 Temu 店铺 → 使用发品 / 核价 / 活动报名
- 补齐前端缺失的店铺连接 UI(后端 POST /api/shops 已就位,没 UI 调用)
- 建立可重复部署流程:git push → ssh + 一条命令 → 生产更新
- 部署基础设施就位:DNS、SSL、docker-compose、首次部署完成

### 非目标(推迟)

- Temu 应用市场正式审核提交
- 新 Supabase 项目(复用现有开发项目)
- 店铺编辑(in-place update)
- 隐私政策 / 用户协议页
- MFA / OAuth
- GitHub Actions 自动化 CI/CD
- 监控告警系统(Sentry / Prometheus)
- VPS 系统级硬化

---

## 3. 关键设计决策

| # | 决策 | 选中 | 理由 |
|---|---|---|---|
| 1 | 发布路径 | **自部署 + 邀请链接** | Temu App Market 审核周期过长,先验证价值 |
| 2 | 域名 | **`duoshouerp.868818.xyz`**(父域 `868818.xyz` 下子域)| 用户已有域名,一条 A 记录即可 |
| 3 | Shop 连接 UI | **平铺单屏表单 + 「测试连接」按钮** | Temu 凭据长易粘错,保存前 ping 一次避免坏体验 |
| 4 | Onboarding | **强制引导**(无店铺自动 redirect `/shops/new`)| 无店铺时所有 list 空,用户会困惑 |
| 5 | Shop CRUD 范围 | **添加 + 列表 + 软断开**(状态流转 active/disconnected),不做 in-place 编辑 | Temu token 30 天过期是高频场景,需要处理;in-place 编辑会打破已有数据关联 |
| 6 | Supabase 项目 | **复用现有开发项目** | 用户选择零配置;测试用户会跟开发 smoke 残留混在同 `auth.users` 表,可接受 |
| 7 | 部署模式 | **VPS 本地 build(git pull + docker compose build)** | 免外部镜像仓库,代码通过 GitHub 同步 |
| 8 | GitHub repo | **public,`sggtong1/duoshou-erp`**(已建)| VPS clone 免认证,代码本身无敏感内容 |

---

## 4. 架构 & 模块映射

### 前端新增

```
apps/web/src/pages/shops/
├─ ShopsListPage.vue        (/shops) 列表 + 「断开」按钮 + 空态「去连接第一家店铺」
└─ ShopsConnectPage.vue     (/shops/new) 平铺表单 + 「测试连接」
apps/web/src/pages/HomePage.vue        (改造:加店铺管理入口)
apps/web/src/router/index.ts           (加 2 路由 + beforeEach 守卫)
apps/web/src/api-client/shops.api.ts   (已有 list/connect,补 testConnection 和 disconnect)
```

### 后端补丁

- `POST /api/shops/test-connection` — 用入参 appKey/appSecret/accessToken/region 直接 `new TemuClient(...)` 调 `bg.shop.base.info.get`,返回 `{ok, shopInfo?, error?}`。不写 DB。走 AuthGuard。
- `DELETE /api/shops/:id` — 软删:`shop.status = 'disconnected'`,cron 的 `where: {status: 'active'}` 自动跳过。
- `POST /api/shops` 的 **upsert on reconnect 语义**(plan 阶段验证 W0 实现):若传入 `(orgId, platform, platformShopId)` 已存在且为 `disconnected`,复活为 `active` + 更新凭据,不创建新 row。

### 部署基础设施

```
┌── 开发机 ──┐       ┌──── GitHub ────┐       ┌────── VPS (dorshouerp.868818.xyz) ──────┐
│ git push  │ ────► │ sggtong1/       │ ◄──── │ git pull                                │
│ deploy.sh │  SSH  │ duoshou-erp     │       │ docker compose build api web             │
│           │ ────►─┼─────────────────┼───────┤ docker compose up -d                     │
└───────────┘       └─────────────────┘       │                                          │
                                              │ [web] nginx + Vue dist + Let's Encrypt   │
                                              │ [api] Node/Nest dist                     │
                                              │ [redis] Redis 7                          │
                                              └──────────────────────────────────────────┘
                                                          ↓
                                              Supabase 云(PG + Auth,复用开发项目)
                                              Temu 开放平台(per-shop 凭据)
```

---

## 5. 前端 UX 详细

### `/shops/new` — ShopsConnectPage

**字段(从上到下)**:
1. 店铺类型(`shopType`)— n-select,`full` / `semi`
2. 区域(`region`)— n-select,`cn` / `pa`
3. Platform Shop ID(`platformShopId`)— n-input,必填
4. App Key — n-input,必填
5. App Secret — n-input password 类型,必填
6. Access Token — n-input password 类型,必填
7. 店铺显示名(`displayName`)— n-input,可选

**按钮**:
- 「🔍 测试连接」— 调 `POST /api/shops/test-connection`,结果显示在表单下方(`✅ 连接成功:店名 X,类型 full,region pa` / `❌ Temu 返回:Invalid signature`)
- 「💾 保存」— 调 `POST /api/shops`;允许未测试直接保存但提示"建议先测试";保存成功 msg.success + `router.push('/shops')`;失败保留表单

### `/shops` — ShopsListPage

**顶部**:`[➕ 添加店铺]` 按钮 → `/shops/new`

**表格列**:店铺显示名 / Platform Shop ID / 类型 / 区域 / 状态(active=✅活跃 / disconnected=⚫已断开)/ 操作

**操作列**:
- `status === 'active'` 行:「断开」按钮(n-popconfirm 二次确认:"断开后此店同步任务会停止,但历史数据保留。确认?")→ `DELETE /api/shops/:id`
- `status === 'disconnected'` 行:`—`(禁用)

**空态**:无任何行时展示 n-empty + 按钮「去连接第一家店铺」

### HomePage.vue 改造

顶部加「店铺管理」入口(放在现有 7 个按钮的最上方):
```vue
<n-button @click="$router.push('/shops')">店铺管理</n-button>
<n-button @click="$router.push('/templates')">货品模板</n-button>
<!-- ... 其余不变 -->
```

### Router Guard(强制 onboarding)

```typescript
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true;
  // 现有 auth 检查...
  if (to.path.startsWith('/shops')) return true;  // /shops 和 /shops/new 不拦
  const shops = useShopsStore();
  if (!shops.items.length) await shops.fetch();
  const hasActive = shops.items.some((s) => s.status === 'active');
  if (!hasActive) return '/shops/new';
  return true;
});
```

---

## 6. 后端 API 补丁详细

### `POST /api/shops/test-connection`

**DTO** (zod):
```typescript
export const TestConnectionDto = z.object({
  appKey: z.string().min(1),
  appSecret: z.string().min(1),
  accessToken: z.string().min(1),
  platformShopId: z.string().min(1),
  shopType: z.enum(['full', 'semi']),
  region: z.enum(['cn', 'pa']),
});
```

**Service**:
```typescript
async testConnection(input: TestConnectionInput): Promise<{ ok: boolean; shopInfo?: any; error?: string }> {
  const client = new TemuClient({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    region: input.region,
  });
  try {
    const shopInfo = await client.call('bg.shop.base.info.get', {});
    return { ok: true, shopInfo };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
```

**Controller**:
- `@Post('test-connection')` + `@UseGuards(AuthGuard)` + `@UsePipes(new ZodValidationPipe(TestConnectionDto))`
- 返回 shape:`{ok, shopInfo?, error?}`,永远 200(失败情况在 body 里,而非 HTTP 错误,方便前端一致处理)

### `DELETE /api/shops/:id`

```typescript
@Delete(':id')
@UseGuards(AuthGuard)
async disconnect(@Req() req, @Param('id') id: string) {
  const m = await this.tenant.resolveForUser(req.user);
  const shop = await this.prisma.shop.findFirst({ where: { id, orgId: m.orgId } });
  if (!shop) throw new NotFoundException('Shop not found');
  await this.prisma.shop.update({
    where: { id },
    data: { status: 'disconnected' },
  });
  return { ok: true };
}
```

### `POST /api/shops` 的 reconnect 语义

**plan 阶段读 `apps/api/src/modules/shop/shop.service.ts` 确认**:
- 若现有实现已支持 `(orgId, platform, platformShopId)` upsert + 刷新凭据 → 无改动
- 若不支持 → service 层加逻辑:`findFirst({orgId, platform, platformShopId})` 若找到则 `update({status:'active', ...encryptedCreds})`,否则 `create`

---

## 7. 部署流程详细

### 7.1 DNS 一次性

在 `868818.xyz` 所属域名管理后台加:
```
duoshouerp    A    <VPS 公网 IP>    TTL=600
```

验证:`dig duoshouerp.868818.xyz` 返回 VPS IP。

### 7.2 VPS 初始化(一次性)

```bash
# 假设 Ubuntu 22.04 + 开通 22/80/443 端口
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER  # 重登
sudo mkdir -p /opt/duoshou-erp && sudo chown $USER /opt/duoshou-erp
git clone https://github.com/sggtong1/duoshou-erp.git /opt/duoshou-erp
```

### 7.3 `.env.production`(VPS `/opt/duoshou-erp/.env.production`)

不入 git(已在 `.gitignore`)。手写,内容:
```
NODE_ENV=production
PORT=3000
DATABASE_URL=<从 .env.development 复制>
SUPABASE_URL=<从 .env.development 复制>
SUPABASE_ANON_KEY=<从 .env.development 复制>
SUPABASE_SERVICE_ROLE_KEY=<从 .env.development 复制>
REDIS_URL=redis://redis:6379
QUEUE_PREFIX=duoshou-prod
CORS_ORIGINS=https://duoshouerp.868818.xyz
```

### 7.4 docker-compose.yml 改 build 模式

```yaml
services:
  api:
    image: duoshou/api:latest
    build:
      context: ../..
      dockerfile: infra/docker/api.Dockerfile
    restart: always
    env_file: ../../.env.production
    depends_on: [redis]
    networks: [internal]
  web:
    image: duoshou/web:latest
    build:
      context: ../..
      dockerfile: infra/docker/web.Dockerfile
    restart: always
    depends_on: [api]
    ports: ["80:80", "443:443"]
    volumes: [./letsencrypt:/etc/letsencrypt:ro]
    networks: [internal]
  redis:
    image: redis:7-alpine
    restart: always
    volumes: [redis-data:/data]
    networks: [internal]
networks:
  internal:
volumes:
  redis-data:
```

### 7.5 SSL 首次签发(VPS 一次性)

```bash
cd /opt/duoshou-erp
docker compose -f infra/docker/docker-compose.yml down web || true
docker run -it --rm \
  -v /opt/duoshou-erp/infra/docker/letsencrypt:/etc/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone \
  -d duoshouerp.868818.xyz \
  --agree-tos -m <your-email> --no-eff-email
```

证书位置 `infra/docker/letsencrypt/live/duoshouerp.868818.xyz/fullchain.pem + privkey.pem`,跟 `nginx.conf` 里 `ssl_certificate` 配对。

**续期**(crontab `sudo crontab -e`,每周一凌晨跑):
```
0 3 * * 1 cd /opt/duoshou-erp/infra/docker && docker run --rm -v $PWD/letsencrypt:/etc/letsencrypt certbot/certbot renew --quiet && docker compose restart web
```

### 7.6 修订 `infra/deploy/deploy.sh`

```bash
#!/usr/bin/env bash
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
docker compose logs --tail 30 api
EOF

echo "Deploy done."
```

### 7.7 `infra/deploy/push-to-github.sh`(新增)

因为 duoshou-erp 是父 repo `/Users/mx4com/coding` 的子目录,用 `git subtree push` 把新 commits 推到独立的 GitHub repo:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"  # 父 repo root
git subtree push -P duoshou-erp https://github.com/sggtong1/duoshou-erp.git main
```

用户流程:
```bash
# 本地提交新代码到父 repo
git -C /Users/mx4com/coding commit ...
# 推 subtree 到 GitHub
bash infra/deploy/push-to-github.sh
# 触发 VPS 部署
DEPLOY_HOST=<vps-host> DEPLOY_USER=ubuntu bash infra/deploy/deploy.sh
```

### 7.8 部署文档

新建 `docs/deploy/README.md`,包含:
- DNS 配置步骤
- VPS 初始化命令清单
- `.env.production` 模板
- SSL 签发 + 续期 crontab
- push-to-github.sh + deploy.sh 使用说明
- 首次启动 checklist
- 常见问题(端口占用、证书过期、docker 磁盘清理)

---

## 8. 范围边界

### 做 ✅

1. 前端 `/shops` + `/shops/new` 两页 + HomePage 入口 + router guard
2. 后端 `POST /test-connection` + `DELETE /:id`(软断开)
3. reconnect 语义确认/补全(plan 阶段读代码决定)
4. docker-compose.yml 改 build 模式
5. deploy.sh 改 git-pull + 本地 build 模式
6. push-to-github.sh 新增
7. DNS 配置 + VPS 初始化 + SSL 签发 + 首次部署
8. 部署文档

### 不做(明确推迟)

- Temu 应用市场正式审核提交
- 新 Supabase 项目
- Shop in-place 编辑
- 隐私政策 / 用户协议
- MFA / OAuth
- GitHub Actions 自动化 CI/CD
- 监控告警
- VPS 系统级硬化
- 备份策略

---

## 9. 已知风险

1. **POST /api/shops reconnect 语义未确认**:W0 实现是否支持同 `(orgId, platform, platformShopId)` 复活 disconnected shop?plan 阶段读 `apps/api/src/modules/shop/shop.service.ts` 验证;不支持就补一个 upsert 逻辑。

2. **certbot 续期依赖 crontab**:Let's Encrypt 90 天过期,cron 跑失败且无告警会导致证书失效。**提示用户首次部署后在日历提醒 60 天后手动验证一次 renew**。

3. **Supabase auth 邮件速率限制**:默认每 IP 每小时 3 封确认邮件;邀请测试规模小不会打到;若打到需要去 Supabase 配置自定义 SMTP。

4. **首次 docker compose build 慢**:VPS 上 pnpm install + vite build 约 8-12 分钟,期间服务完全 down(首次部署无旧容器可留)。后续 build 有 Docker layer cache 会快很多(2-3 分钟)。

5. **复用开发 Supabase 项目,数据混乱**:smoke 残留用户 + 真实测试用户会混在 `auth.users`,监控邮件和 user 数时要过滤 `@duoshou.test` 邮箱。

6. **没 CI**:本地不跑单测就 push 到 GitHub → 被 `deploy.sh` 直接拉到生产。plan 里加一条"push-to-github 前先跑 pnpm vitest + pnpm build"的提醒。

---

## 10. 验收标准

3 个可操作的 checkpoint:

- **A. DNS + SSL 就位**:浏览器访问 `https://duoshouerp.868818.xyz` 出现登录页,证书绿锁无警告
- **B. 完整 onboarding 流走通**:新邮箱注册 → 邮件验证 → 登录 → 自动 redirect `/shops/new` → 填真实 Temu 测试凭据 → 测试连接绿 → 保存 → 跳 `/shops` → 进 `/products` 看到同步出来的商品
- **C. 邀请 1 位朋友自助测试**:发 URL 给一个人,他能独立完成注册 → 接店 → 试至少一个模块功能(发品 / 核价 / 活动报名),中间不需要你干预

---

## 11. Done — 接下来

- 进入 `superpowers:writing-plans`,把本设计拆成实施 task。预估 6–8 个 task:
  - T1: 后端 test-connection + disconnect 端点 + reconnect 语义确认
  - T2: 前端 shops.api.ts 补 testConnection/disconnect
  - T3: ShopsConnectPage + ShopsListPage
  - T4: HomePage 改造 + router guard
  - T5: docker-compose.yml build 模式改造
  - T6: deploy.sh 改写 + push-to-github.sh 新建
  - T7: VPS 初始化 + DNS + SSL 首次签发(文档指引)
  - T8: 首次部署 + 走通 A/B/C 验收
