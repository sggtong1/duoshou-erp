# W0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把舵手 ERP v1 的基础设施跑通——monorepo 结构、Temu SDK（代码生成的 214 个 API 客户端 + 签名/限速/重试）、Supabase 连接、租户&店铺数据模型、店铺接入流、认证、CI/CD 部署到 ECS。W0 完工后 W1-W3 各业务模块可以并行开工。

**Architecture:** pnpm monorepo，`apps/api` 跑 NestJS（HTTP + WebSocket + BullMQ Workers 同进程），`apps/web` 跑 Vue 3 SPA，`packages/temu-sdk` 存放代码生成的 Temu API 客户端（输入 JSON spec → 输出 TS 类型 + 方法 + 签名胶水），`packages/shared-types` 存前后端共享 DTO。Supabase 托管 PostgreSQL + Auth，Redis 做限速/缓存/队列。凭据 AES-256-GCM 加密存表。部署走 Docker Compose + GitHub Actions SSH 到阿里云 ECS。

**Tech Stack:** Node.js 20+, TypeScript 5+, pnpm 9+, NestJS 10, Vue 3 + Vite + Naive UI + Pinia, PostgreSQL 15 via Supabase, Redis 7, BullMQ, Axios, Zod, Vitest (前后端统一), Docker Compose, GitHub Actions.

---

## 文件结构

```
duoshou-erp/
├─ apps/
│  ├─ api/                      Task 9, 12, 13, 14
│  │  ├─ src/
│  │  │  ├─ main.ts             NestJS 入口
│  │  │  ├─ app.module.ts       根模块
│  │  │  ├─ config/             环境变量 + schema
│  │  │  ├─ infra/
│  │  │  │  ├─ redis.module.ts
│  │  │  │  ├─ prisma.module.ts
│  │  │  │  └─ crypto.ts        AES-256-GCM
│  │  │  ├─ modules/
│  │  │  │  ├─ auth/            Supabase JWT 校验
│  │  │  │  ├─ tenant/          org/member 自动创建
│  │  │  │  ├─ shop/            店铺连接 + 凭据管理
│  │  │  │  └─ health/
│  │  │  └─ platform/
│  │  │     ├─ platform-client.interface.ts   对外接口契约
│  │  │     └─ temu/
│  │  │        ├─ temu.module.ts
│  │  │        └─ temu-client.service.ts       封装 packages/temu-sdk
│  │  ├─ prisma/                schema.prisma + migrations
│  │  ├─ test/                  E2E tests
│  │  └─ package.json
│  └─ web/                      Task 10, 13 (前端部分)
│     ├─ src/
│     │  ├─ main.ts
│     │  ├─ App.vue
│     │  ├─ router/
│     │  ├─ stores/             Pinia (auth, tenant, shops)
│     │  ├─ pages/
│     │  │  ├─ LoginPage.vue
│     │  │  ├─ ShopsPage.vue    店铺连接管理
│     │  │  └─ DashboardPage.vue (空壳 v1 模块占位)
│     │  ├─ api-client/         REST client，类型来自 packages/shared-types
│     │  └─ components/
│     ├─ vite.config.ts
│     └─ package.json
├─ packages/
│  ├─ temu-sdk/                 Task 2-8
│  │  ├─ spec/
│  │  │  ├─ raw/                Task 2 输入：抓下的 214 篇 interfaceDocument JSON
│  │  │  └─ temu-api-spec.json  Task 2 输出：规范化后的 spec
│  │  ├─ scripts/
│  │  │  ├─ extract-spec.ts     Task 2
│  │  │  ├─ generate-types.ts   Task 3
│  │  │  └─ generate-methods.ts Task 4
│  │  ├─ src/
│  │  │  ├─ generated/          codegen 输出（gitignored，CI 里重建）
│  │  │  │  ├─ types.ts
│  │  │  │  └─ methods.ts
│  │  │  ├─ signing.ts          Task 5
│  │  │  ├─ http-client.ts      Task 6
│  │  │  ├─ rate-limiter.ts     Task 7
│  │  │  ├─ retry-policy.ts     Task 6 的一部分
│  │  │  └─ client.ts           Task 8
│  │  ├─ test/
│  │  └─ package.json
│  └─ shared-types/             Task 1（骨架）
│     ├─ src/
│     │  ├─ dto/                REST 请求/响应 DTO
│     │  └─ enums/              platform / shop_type / region
│     └─ package.json
├─ docs/
│  ├─ superpowers/
│  │  ├─ specs/
│  │  └─ plans/
│  └─ references/temu/          Task 2 抓下的原始文档（committed）
├─ infra/
│  ├─ docker/
│  │  ├─ api.Dockerfile
│  │  └─ docker-compose.yml
│  └─ deploy/
│     └─ deploy.sh              SSH 部署脚本
├─ .github/workflows/
│  └─ deploy.yml                Task 15
├─ .env.development.example
├─ .env.production.example      Task 15 (字段列齐，实际值由运维注入)
├─ .gitignore
├─ .nvmrc                        node 版本锁定
├─ pnpm-workspace.yaml
├─ package.json                  root，带 scripts
├─ tsconfig.base.json
└─ README.md
```

---

## Task 1: Monorepo 脚手架

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `.nvmrc`, `.gitignore`, `.editorconfig`, `.prettierrc`, `README.md`
- Create: `apps/api/package.json`, `apps/web/package.json`, `packages/temu-sdk/package.json`, `packages/shared-types/package.json`

- [ ] **Step 1: 初始化 root package.json**

Create `/Users/mx4com/coding/duoshou-erp/package.json`:
```json
{
  "name": "duoshou-erp",
  "private": true,
  "version": "0.1.0",
  "description": "舵手 ERP - Temu multi-shop SaaS management platform",
  "engines": { "node": ">=20.0.0", "pnpm": ">=9.0.0" },
  "scripts": {
    "dev:api": "pnpm --filter @duoshou/api dev",
    "dev:web": "pnpm --filter @duoshou/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "codegen": "pnpm --filter @duoshou/temu-sdk codegen",
    "format": "prettier --write \"**/*.{ts,vue,json,md}\""
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "prettier": "^3.2.0",
    "@types/node": "^20.11.0"
  }
}
```

- [ ] **Step 2: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: 创建 tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "isolatedModules": true
  }
}
```

- [ ] **Step 4: 创建 .nvmrc, .gitignore, .editorconfig, .prettierrc**

`.nvmrc`:
```
20.11.0
```

`.gitignore`:
```
node_modules/
dist/
.env
.env.*
!.env.*.example
*.log
.DS_Store
coverage/
.turbo/
packages/temu-sdk/src/generated/
packages/temu-sdk/spec/raw/*.json
!packages/temu-sdk/spec/raw/.gitkeep
.vscode/
.idea/
```

`.editorconfig`:
```
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

`.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

- [ ] **Step 5: 创建 4 个 workspace 的 package.json 骨架**

`apps/api/package.json`:
```json
{
  "name": "@duoshou/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "test": "vitest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@duoshou/temu-sdk": "workspace:*",
    "@duoshou/shared-types": "workspace:*"
  }
}
```

`apps/web/package.json`:
```json
{
  "name": "@duoshou/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint src --ext .ts,.vue"
  },
  "dependencies": {
    "@duoshou/shared-types": "workspace:*"
  }
}
```

`packages/temu-sdk/package.json`:
```json
{
  "name": "@duoshou/temu-sdk",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "codegen": "tsx scripts/generate-types.ts && tsx scripts/generate-methods.ts",
    "extract-spec": "tsx scripts/extract-spec.ts",
    "test": "vitest"
  }
}
```

`packages/shared-types/package.json`:
```json
{
  "name": "@duoshou/shared-types",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

- [ ] **Step 6: 安装 pnpm 并初始化**

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
cd /Users/mx4com/coding/duoshou-erp
pnpm install
```

Expected: `Done in Xs`, no errors. `node_modules/` 在 root 和每个 workspace 下各有一个软链入口。

- [ ] **Step 7: 写一个最小的 index.ts 让每个 workspace 可以被引用**

`packages/shared-types/src/index.ts`:
```typescript
export type Platform = 'temu';
export type ShopType = 'full' | 'semi';
export type Region = 'cn' | 'pa';
```

`packages/temu-sdk/src/index.ts`:
```typescript
// 占位，后续 task 补全
export const SDK_VERSION = '0.1.0';
```

- [ ] **Step 8: 首次 commit**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/package.json duoshou-erp/pnpm-workspace.yaml duoshou-erp/tsconfig.base.json \
        duoshou-erp/.nvmrc duoshou-erp/.gitignore duoshou-erp/.editorconfig duoshou-erp/.prettierrc \
        duoshou-erp/apps/api/package.json duoshou-erp/apps/web/package.json \
        duoshou-erp/packages/temu-sdk/package.json duoshou-erp/packages/temu-sdk/src/index.ts \
        duoshou-erp/packages/shared-types/package.json duoshou-erp/packages/shared-types/src/index.ts \
        duoshou-erp/pnpm-lock.yaml
git commit -m "chore(w0): scaffold pnpm monorepo with apps & packages"
```

Expected: commit 成功；`pnpm -r --filter '*' exec pwd` 列出 4 个 workspace 路径。

---

## Task 2: 抓取的 Temu 文档入库 + 规范化 spec 提取

**Files:**
- Create: `docs/references/temu/_index.md`, `docs/references/temu/_trees.json`, `docs/references/temu/_leaves.json`
- Create: `packages/temu-sdk/spec/raw/.gitkeep`
- Create: `packages/temu-sdk/scripts/extract-spec.ts`
- Create: `packages/temu-sdk/spec/temu-api-spec.json`（脚本产出）
- Create: `packages/temu-sdk/spec/param-type-map.ts`

- [ ] **Step 1: 把抓下的文档移入项目**

```bash
cd /Users/mx4com/coding/duoshou-erp
mkdir -p docs/references/temu packages/temu-sdk/spec/raw
cp /tmp/temu-fetch/docs/_index.md docs/references/temu/
cp /tmp/temu-fetch/docs/_trees.json docs/references/temu/
cp /tmp/temu-fetch/docs/_leaves.json docs/references/temu/
cp /tmp/temu-fetch/docs/*.md docs/references/temu/       # 214 篇（大部分是壳，content 在 raw JSON 里）
touch packages/temu-sdk/spec/raw/.gitkeep
```

验证：`ls docs/references/temu | wc -l` 应输出 217+。

- [ ] **Step 2: 抓原始 interfaceDocument JSON（所有 214 个）**

写一个一次性脚本 `packages/temu-sdk/scripts/fetch-raw-specs.ts`（跑一次后基本不再重跑，只在 Temu 文档更新时）：

```typescript
#!/usr/bin/env tsx
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:56526';
const SPEC_DIR = path.join(__dirname, '..', 'spec', 'raw');
const LEAVES_FILE = path.join(__dirname, '..', '..', '..', 'docs', 'references', 'temu', '_leaves.json');

async function main() {
  const leaves: Array<{ documentId: number; directoryId: number; name: string; path: string }> =
    JSON.parse(fs.readFileSync(LEAVES_FILE, 'utf-8'));

  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();

  // 触发一次页面加载，抓 Anti-Content 和 orgId
  let antiContent = ''; let orgId = '';
  const client = await ctx.newCDPSession(page);
  await client.send('Network.enable');
  client.on('Network.requestWillBeSent', (e) => {
    if (e.request.url.includes('erebus-partner/document/')) {
      const h = e.request.headers;
      antiContent = h['Anti-Content'] || h['anti-content'] || antiContent;
      orgId = h['orgId'] || h['orgid'] || orgId;
    }
  });
  await page.goto('https://agentpartner.temu.com/document?cataId=875198836203', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  for (const leaf of leaves) {
    const outFile = path.join(SPEC_DIR, `${leaf.documentId}.json`);
    if (fs.existsSync(outFile)) continue;
    const d = await page.evaluate(async ({ id, ac, oi }) => {
      const r = await fetch('https://agentpartner.temu.com/erebus-partner/document/queryDocumentDetail', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Anti-Content': ac, 'orgId': oi },
        body: JSON.stringify({ id }),
      });
      return await r.json();
    }, { id: leaf.documentId, ac: antiContent, oi: orgId });
    fs.writeFileSync(outFile, JSON.stringify(d.result, null, 2));
    console.log(`wrote ${leaf.documentId}.json (${leaf.name})`);
  }
  await browser.close();
}
main().catch(console.error);
```

运行：
```bash
cd packages/temu-sdk
pnpm add -D tsx playwright
pnpm tsx scripts/fetch-raw-specs.ts
```

Expected: `spec/raw/` 下有 214 个 `<documentId>.json` 文件。

- [ ] **Step 3: 编写 extract-spec.ts（规范化提取）**

Create `packages/temu-sdk/scripts/extract-spec.ts`:

```typescript
#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

const RAW_DIR = path.join(__dirname, '..', 'spec', 'raw');
const OUT_FILE = path.join(__dirname, '..', 'spec', 'temu-api-spec.json');
const LEAVES_FILE = path.join(__dirname, '..', '..', '..', 'docs', 'references', 'temu', '_leaves.json');

interface ApiParam {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'object' | 'array';
  required: boolean;
  desc: string;
  children?: ApiParam[];
}

interface ApiSpec {
  interfaceType: string;       // e.g. "bg.goods.add"
  interfaceName: string;       // 中文名
  interfaceDesc: string;
  requestUrl: string;          // "/openapi/router"
  region: 'cn' | 'pa' | 'both';  // 按路径推断
  group: string;               // "货品API组" etc.
  requestParams: ApiParam[];
  responseParams: ApiParam[];
  commonRequestParams: ApiParam[];
}

function mapParamType(pt: number): ApiParam['type'] {
  // paramType 枚举（从实际文档观察归纳，不确定的走 object）
  // 1 = number, 4 = string, 6 = object, 8 = array, 2 = boolean (待 raw 验证)
  switch (pt) {
    case 1: return 'number';
    case 2: return 'boolean';
    case 4: return 'string';
    case 6: return 'object';
    case 8: return 'array';
    default: return 'object';
  }
}

function normalizeParams(raw: any[]): ApiParam[] {
  return (raw || []).map((p) => ({
    name: p.paramName || p.name || '',
    type: mapParamType(p.paramType),
    required: !!p.required,
    desc: p.desc || '',
    children: p.openParamList ? normalizeParams(p.openParamList) : undefined,
  }));
}

function inferRegion(interfaceType: string, path: string): ApiSpec['region'] {
  if (interfaceType.startsWith('bg.glo.') || interfaceType.startsWith('bg.btg.') || interfaceType.startsWith('bg.qtg.')) return 'pa';
  if (path.includes('-PA')) return 'pa';
  return 'cn';
}

function inferGroup(p: string): string {
  const m = p.match(/API文档 \/ ([^/]+)/);
  return m ? m[1] : 'unknown';
}

const leaves: any[] = JSON.parse(fs.readFileSync(LEAVES_FILE, 'utf-8'));
const specs: ApiSpec[] = [];
const skipped: Array<{ documentId: number; reason: string }> = [];

for (const leaf of leaves) {
  const raw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, `${leaf.documentId}.json`), 'utf-8'));
  const ifDoc = raw.interfaceDocument;
  if (!ifDoc || !ifDoc.interfaceType) {
    skipped.push({ documentId: leaf.documentId, reason: 'no interfaceDocument' });
    continue;
  }
  specs.push({
    interfaceType: ifDoc.interfaceType,
    interfaceName: ifDoc.interfaceName || '',
    interfaceDesc: ifDoc.interfaceDesc || '',
    requestUrl: ifDoc.requestUrl || '/openapi/router',
    region: inferRegion(ifDoc.interfaceType, leaf.path),
    group: inferGroup(leaf.path),
    requestParams: normalizeParams(ifDoc.requestParam),
    responseParams: normalizeParams(ifDoc.responseParam),
    commonRequestParams: normalizeParams(ifDoc.commonRequestParam),
  });
}

fs.writeFileSync(OUT_FILE, JSON.stringify({ generated_at: new Date().toISOString(), count: specs.length, skipped, specs }, null, 2));
console.log(`extracted ${specs.length} specs, skipped ${skipped.length}`);
```

- [ ] **Step 4: 运行并验证 spec**

```bash
cd packages/temu-sdk
pnpm tsx scripts/extract-spec.ts
```

Expected output: `extracted 200+ specs, skipped < 20`（少量 free-document 类的非接口文档会被跳过，是正常的）。

验证：`jq '.specs[0]' spec/temu-api-spec.json` 应输出一个完整的 spec 对象。

- [ ] **Step 5: 写校验 paramType 枚举覆盖率的一次性脚本**

Create `packages/temu-sdk/scripts/audit-param-types.ts`:
```typescript
#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

const RAW_DIR = path.join(__dirname, '..', 'spec', 'raw');
const seen = new Map<number, { count: number; samples: string[] }>();
function walk(arr: any[]) {
  for (const p of arr || []) {
    const pt = p.paramType;
    if (typeof pt === 'number') {
      const s = seen.get(pt) || { count: 0, samples: [] };
      s.count++;
      if (s.samples.length < 3) s.samples.push(`${p.paramName}: ${p.desc?.slice(0, 40)}`);
      seen.set(pt, s);
    }
    if (p.openParamList) walk(p.openParamList);
  }
}
for (const f of fs.readdirSync(RAW_DIR).filter((x) => x.endsWith('.json'))) {
  const raw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), 'utf-8'));
  if (raw.interfaceDocument) {
    walk(raw.interfaceDocument.requestParam || []);
    walk(raw.interfaceDocument.responseParam || []);
    walk(raw.interfaceDocument.commonRequestParam || []);
  }
}
for (const [pt, s] of [...seen.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`paramType=${pt}: ${s.count} occurrences. samples: ${s.samples.join(' | ')}`);
}
```

```bash
pnpm tsx scripts/audit-param-types.ts
```

Expected: 列出所有遇到过的 paramType 值和出现次数。把输出结果直接贴进 `scripts/extract-spec.ts` 的 `mapParamType` 注释里作为 ground truth。如果遇到非 1/2/4/6/8 的值，增加 case 映射。

- [ ] **Step 6: 提交**

```bash
cd /Users/mx4com/coding
git add duoshou-erp/docs/references/temu \
        duoshou-erp/packages/temu-sdk/scripts \
        duoshou-erp/packages/temu-sdk/spec/temu-api-spec.json \
        duoshou-erp/packages/temu-sdk/spec/raw/.gitkeep \
        duoshou-erp/packages/temu-sdk/package.json \
        duoshou-erp/pnpm-lock.yaml
git commit -m "feat(temu-sdk)(w0): ingest Temu API docs and extract normalized spec"
```

注意：`spec/raw/*.json` 本身通过 .gitignore 排除（太多文件且来自 Temu，重新抓即可）。`spec/temu-api-spec.json` 是产出物，committed。

---

## Task 3: 代码生成 — TypeScript 类型

**Files:**
- Create: `packages/temu-sdk/scripts/generate-types.ts`
- Create: `packages/temu-sdk/src/generated/types.ts`（产出）
- Create: `packages/temu-sdk/test/codegen.test.ts`

- [ ] **Step 1: 写失败的测试**

`packages/temu-sdk/test/codegen.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('codegen: types', () => {
  const typesFile = path.join(__dirname, '..', 'src', 'generated', 'types.ts');

  it('types.ts exists after codegen', () => {
    expect(fs.existsSync(typesFile)).toBe(true);
  });

  it('generates a Request type for bg.goods.add', () => {
    const content = fs.readFileSync(typesFile, 'utf-8');
    expect(content).toMatch(/export interface BgGoodsAddRequest/);
    expect(content).toMatch(/export interface BgGoodsAddResponse/);
  });

  it('nested object params produce nested interfaces', () => {
    const content = fs.readFileSync(typesFile, 'utf-8');
    // productSemiManagedReq 在 bg.goods.add 里是 object 嵌套
    expect(content).toMatch(/productSemiManagedReq\??: /);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/temu-sdk
pnpm add -D vitest
pnpm vitest run test/codegen.test.ts
```

Expected: FAIL—`types.ts` 不存在。

- [ ] **Step 3: 实现 generate-types.ts**

Create `packages/temu-sdk/scripts/generate-types.ts`:

```typescript
#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

interface ApiParam {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'object' | 'array';
  required: boolean;
  desc: string;
  children?: ApiParam[];
}
interface ApiSpec {
  interfaceType: string;
  interfaceName: string;
  interfaceDesc: string;
  requestParams: ApiParam[];
  responseParams: ApiParam[];
}

const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spec', 'temu-api-spec.json'), 'utf-8'));
const OUT = path.join(__dirname, '..', 'src', 'generated', 'types.ts');

function toPascalCase(s: string): string {
  return s.split(/[.\-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

function paramToTs(p: ApiParam, indent = 2): string {
  const optional = p.required ? '' : '?';
  const comment = p.desc ? `  /** ${p.desc.replace(/\n/g, ' ').slice(0, 200)} */\n${' '.repeat(indent)}` : '';
  const typeExpr = renderType(p);
  return `${comment}${p.name}${optional}: ${typeExpr};`;
}

function renderType(p: ApiParam): string {
  if (p.type === 'number') return 'number';
  if (p.type === 'boolean') return 'boolean';
  if (p.type === 'string') return 'string';
  if (p.type === 'array') {
    if (!p.children || !p.children.length) return 'unknown[]';
    const itemParam = p.children.find((c) => c.name === '$item') || p.children[0];
    if (itemParam.type === 'object' && itemParam.children) {
      return `Array<{\n${itemParam.children.map((c) => '    ' + paramToTs(c, 4)).join('\n')}\n  }>`;
    }
    return `${renderType(itemParam)}[]`;
  }
  if (p.type === 'object') {
    if (!p.children || !p.children.length) return 'Record<string, unknown>';
    return `{\n${p.children.map((c) => '  ' + paramToTs(c, 2)).join('\n')}\n}`;
  }
  return 'unknown';
}

function generate(): string {
  const out: string[] = [
    '// AUTO-GENERATED — do not edit by hand',
    '// Run `pnpm codegen` to regenerate.',
    '',
  ];
  for (const s of SPEC.specs as ApiSpec[]) {
    const base = toPascalCase(s.interfaceType);
    out.push(`// ${s.interfaceType} — ${s.interfaceName}`);
    out.push(`export interface ${base}Request {`);
    for (const p of s.requestParams) {
      out.push('  ' + paramToTs(p, 2));
    }
    out.push('}');
    out.push(`export interface ${base}Response {`);
    for (const p of s.responseParams) {
      out.push('  ' + paramToTs(p, 2));
    }
    out.push('}');
    out.push('');
  }
  return out.join('\n');
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, generate());
console.log(`wrote ${OUT}`);
```

- [ ] **Step 4: 运行 codegen**

```bash
cd packages/temu-sdk
pnpm tsx scripts/generate-types.ts
```

Expected: `wrote src/generated/types.ts`；文件大小应在 100-300KB（214 个接口 × 平均 1KB 类型定义）。

- [ ] **Step 5: 运行测试确认通过**

```bash
pnpm vitest run test/codegen.test.ts
```

Expected: PASS 3 tests.

- [ ] **Step 6: TypeScript 编译检查**

```bash
npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict src/generated/types.ts
```

Expected: 无错误。若有类型冲突（重名、未闭合括号等），回到 generate-types.ts 修 renderType 逻辑。

- [ ] **Step 7: 提交**

```bash
git add packages/temu-sdk/scripts/generate-types.ts \
        packages/temu-sdk/test/codegen.test.ts \
        packages/temu-sdk/package.json \
        pnpm-lock.yaml
git commit -m "feat(temu-sdk)(w0): generate TypeScript types from 214 Temu API specs"
```

注：`src/generated/types.ts` 走 .gitignore，CI 会重新生成。

---

## Task 4: 代码生成 — API 方法

**Files:**
- Create: `packages/temu-sdk/scripts/generate-methods.ts`
- Create: `packages/temu-sdk/src/generated/methods.ts`（产出）
- Modify: `packages/temu-sdk/test/codegen.test.ts`

- [ ] **Step 1: 增加失败测试**

Append to `packages/temu-sdk/test/codegen.test.ts`:
```typescript
describe('codegen: methods', () => {
  const methodsFile = path.join(__dirname, '..', 'src', 'generated', 'methods.ts');

  it('methods.ts exists after codegen', () => {
    expect(fs.existsSync(methodsFile)).toBe(true);
  });

  it('exports a registry of all 200+ methods', () => {
    const content = fs.readFileSync(methodsFile, 'utf-8');
    expect(content).toMatch(/export const TEMU_API_REGISTRY/);
    const match = content.match(/\/\/ TOTAL_METHODS: (\d+)/);
    expect(match).toBeTruthy();
    expect(parseInt(match![1], 10)).toBeGreaterThan(150);
  });

  it('each method has interfaceType, region, requestUrl', () => {
    const content = fs.readFileSync(methodsFile, 'utf-8');
    expect(content).toMatch(/interfaceType: 'bg\.goods\.add'/);
    expect(content).toMatch(/region: 'cn'/);
    expect(content).toMatch(/requestUrl: '\/openapi\/router'/);
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm vitest run test/codegen.test.ts
```

Expected: 新的 3 个测试 FAIL。

- [ ] **Step 3: 实现 generate-methods.ts**

Create `packages/temu-sdk/scripts/generate-methods.ts`:

```typescript
#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

const SPEC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'spec', 'temu-api-spec.json'), 'utf-8'));
const OUT = path.join(__dirname, '..', 'src', 'generated', 'methods.ts');

function toCamelCase(s: string): string {
  const pascal = s.split(/[.\-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  return pascal[0].toLowerCase() + pascal.slice(1);
}
function toPascalCase(s: string): string {
  return s.split(/[.\-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

const out: string[] = [
  '// AUTO-GENERATED — do not edit by hand',
  '// Run `pnpm codegen` to regenerate.',
  '',
  "import type * as T from './types';",
  "import type { TemuCallContext, TemuMethodSpec } from '../http-client';",
  "import { callTemuApi } from '../http-client';",
  '',
];

const registry: string[] = [];
for (const s of SPEC.specs) {
  const base = toPascalCase(s.interfaceType);
  const methodName = toCamelCase(s.interfaceType);
  out.push(`// ${s.interfaceType} — ${s.interfaceName}`);
  out.push(`export async function ${methodName}(ctx: TemuCallContext, req: T.${base}Request): Promise<T.${base}Response> {`);
  out.push(`  return callTemuApi<T.${base}Request, T.${base}Response>(ctx, {`);
  out.push(`    interfaceType: '${s.interfaceType}',`);
  out.push(`    region: '${s.region}',`);
  out.push(`    requestUrl: '${s.requestUrl}',`);
  out.push(`  }, req);`);
  out.push(`}`);
  out.push('');
  registry.push(`'${s.interfaceType}': { region: '${s.region}', requestUrl: '${s.requestUrl}', interfaceName: ${JSON.stringify(s.interfaceName)} }`);
}

out.push(`// TOTAL_METHODS: ${SPEC.specs.length}`);
out.push(`export const TEMU_API_REGISTRY: Record<string, { region: string; requestUrl: string; interfaceName: string }> = {`);
out.push(registry.map((l) => '  ' + l).join(',\n'));
out.push('};');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.join('\n'));
console.log(`wrote ${OUT} with ${SPEC.specs.length} methods`);
```

- [ ] **Step 4: 更新 http-client 占位符**

这一步要先给 http-client.ts 存根，让 generated/methods.ts 能编译（完整实现在 Task 6）。

Create `packages/temu-sdk/src/http-client.ts`（最小骨架）:

```typescript
export interface TemuCallContext {
  appKey: string;
  appSecret: string;
  accessToken: string;
  region: 'cn' | 'pa';
  shopId: string;
}
export interface TemuMethodSpec {
  interfaceType: string;
  region: string;
  requestUrl: string;
}
export async function callTemuApi<Req, Res>(
  _ctx: TemuCallContext,
  _spec: TemuMethodSpec,
  _req: Req,
): Promise<Res> {
  throw new Error('callTemuApi not implemented yet — see Task 6');
}
```

- [ ] **Step 5: 运行 codegen 和测试**

```bash
cd packages/temu-sdk
pnpm tsx scripts/generate-methods.ts
pnpm vitest run test/codegen.test.ts
```

Expected:
- `wrote src/generated/methods.ts with 200+ methods`
- 所有 6 个测试 PASS

- [ ] **Step 6: TypeScript 编译**

```bash
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 7: 提交**

```bash
git add packages/temu-sdk/scripts/generate-methods.ts \
        packages/temu-sdk/src/http-client.ts \
        packages/temu-sdk/test/codegen.test.ts
git commit -m "feat(temu-sdk)(w0): generate 200+ Temu API methods as typed functions"
```

---

## Task 5: Temu 签名实现

**Files:**
- Create: `packages/temu-sdk/src/signing.ts`
- Create: `packages/temu-sdk/test/signing.test.ts`

**前置**: 去 `docs/references/temu/192__开发者文档_开发指南_签名规则.md` 读签名算法。核心规则（从鉴权信息文档复盘）：
1. 所有非空入参（排除 sign）按 key 字典序排序
2. 拼接 `key1value1key2value2...`
3. 前后加 app_secret：`app_secret + 拼接串 + app_secret`
4. MD5 计算，结果转大写十六进制

如果 raw 文档内容跟上面描述不一致，以 raw 文档为准。

- [ ] **Step 1: 写失败测试（用已知 input/output 验证签名算法）**

`packages/temu-sdk/test/signing.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { sign } from '../src/signing';

describe('signing', () => {
  it('produces consistent MD5 signature for sorted params', () => {
    const params = {
      type: 'bg.goods.add',
      app_key: 'test_key',
      timestamp: '1700000000',
      data_type: 'JSON',
      access_token: 'tok_123',
      data: '{"a":1}',
    };
    const appSecret = 'my_secret';
    const signature = sign(params, appSecret);
    expect(signature).toMatch(/^[A-F0-9]{32}$/);
    // 验证确定性：相同输入 = 相同输出
    expect(sign(params, appSecret)).toBe(signature);
  });

  it('ignores empty / undefined / null values', () => {
    const base = { type: 'bg.mall.info.get', app_key: 'k', timestamp: '1' };
    const withEmpty = { ...base, empty: '', none: null as any, undef: undefined as any };
    expect(sign(base, 's')).toBe(sign(withEmpty, 's'));
  });

  it('ignores sign key if present in input', () => {
    const base = { type: 'bg.mall.info.get', app_key: 'k', timestamp: '1' };
    const withSign = { ...base, sign: 'ABCDEF' };
    expect(sign(base, 's')).toBe(sign(withSign, 's'));
  });

  it('sorts keys alphabetically (zebra before apple fails)', () => {
    const unordered = { zebra: '1', apple: '2' };
    const sig1 = sign(unordered, 's');
    // 手算：apple2zebra1 前后加 s → s apple2zebra1 s → MD5 → upper
    const expected = '9F8A5F5B3B2F4A2E3D0E8F8F8F8F8F8F'; // 占位，实际值靠运行
    // 改为断言与已知良好输出一致（由开发者首次运行后填入）
    expect(sig1).toHaveLength(32);
  });

  it('handles nested JSON strings correctly', () => {
    const params = { data: JSON.stringify({ b: 2, a: 1 }) };
    expect(sign(params, 's')).toHaveLength(32);
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm vitest run test/signing.test.ts
```

Expected: FAIL—`sign` 未定义。

- [ ] **Step 3: 实现 signing.ts**

Create `packages/temu-sdk/src/signing.ts`:
```typescript
import crypto from 'node:crypto';

/**
 * Temu API 签名算法
 * 1. 排除 sign / 空值 / null / undefined
 * 2. 按 key 字典序排序
 * 3. 拼接 key1value1key2value2...
 * 4. 前后加 app_secret
 * 5. MD5 + 大写 16 进制
 */
export function sign(params: Record<string, unknown>, appSecret: string): string {
  const filtered: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(params)) {
    if (k === 'sign') continue;
    if (v === undefined || v === null || v === '') continue;
    filtered.push([k, typeof v === 'string' ? v : JSON.stringify(v)]);
  }
  filtered.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const joined = filtered.map(([k, v]) => `${k}${v}`).join('');
  const payload = `${appSecret}${joined}${appSecret}`;
  return crypto.createHash('md5').update(payload, 'utf8').digest('hex').toUpperCase();
}
```

- [ ] **Step 4: 运行测试通过**

```bash
pnpm vitest run test/signing.test.ts
```

Expected: 前 3 个 PASS，第 4 个（unordered keys）会输出实际签名。

- [ ] **Step 5: 锁定第 4 个测试的预期值**

运行时 Vitest 会打印实际 sig1 的值。把该值拷贝到测试的 `expected` 常量里，**重命名测试**为"locked expected value proves deterministic output"：

```typescript
it('produces deterministic signature for known input (regression lock)', () => {
  const params = { zebra: '1', apple: '2' };
  const actual = sign(params, 's');
  // 这个值由开发者第一次运行后锁定；未来任何修改改变此值说明算法漂了
  expect(actual).toBe('<paste actual here>');
});
```

重新运行确认 PASS。

- [ ] **Step 6: 跟 Temu 官方真实例子对比（可选但强推）**

如果 `docs/references/temu/192__开发者文档_开发指南_签名规则.md` 里给了 示例 input/output，手动补一个测试对比。若完全匹配说明签名实现无误。

若不匹配，去 raw JSON 里找 freeDocument.content 里的具体步骤（e.g. URL encode? 不同哈希算法？），修正 signing.ts 直到匹配。

- [ ] **Step 7: 提交**

```bash
git add packages/temu-sdk/src/signing.ts packages/temu-sdk/test/signing.test.ts
git commit -m "feat(temu-sdk)(w0): implement Temu API request signing"
```

---

## Task 6: HTTP 客户端 + 重试策略

**Files:**
- Modify: `packages/temu-sdk/src/http-client.ts`
- Create: `packages/temu-sdk/src/retry-policy.ts`
- Create: `packages/temu-sdk/test/http-client.test.ts`

- [ ] **Step 1: 写测试**

`packages/temu-sdk/test/http-client.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callTemuApi, type TemuCallContext, type TemuMethodSpec } from '../src/http-client';

describe('http-client', () => {
  const ctx: TemuCallContext = {
    appKey: 'k', appSecret: 's', accessToken: 't', region: 'cn', shopId: '1',
  };
  const spec: TemuMethodSpec = {
    interfaceType: 'bg.mall.info.get',
    region: 'cn',
    requestUrl: '/openapi/router',
  };

  beforeEach(() => vi.restoreAllMocks());

  it('sends POST with signed body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, result: { mallType: 'full' } })),
    );
    const res = await callTemuApi<{}, { mallType: string }>(ctx, spec, {});
    expect(res.mallType).toBe('full');
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body).toHaveProperty('sign');
    expect(body).toHaveProperty('app_key', 'k');
    expect(body).toHaveProperty('access_token', 't');
    expect(body).toHaveProperty('type', 'bg.mall.info.get');
    expect(body.sign).toMatch(/^[A-F0-9]{32}$/);
  });

  it('throws on success=false with errorCode', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, errorCode: 7000007, errorMsg: 'token expired' })),
    );
    await expect(callTemuApi(ctx, spec, {})).rejects.toThrow(/7000007/);
  });

  it('retries 3 times on network error', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: {} })));
    await callTemuApi(ctx, spec, {});
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry on non-retryable errors (e.g. 7000005 permission)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, errorCode: 7000005 })),
    );
    await expect(callTemuApi(ctx, spec, {})).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 确认失败**

```bash
pnpm vitest run test/http-client.test.ts
```

Expected: 所有测试失败（`callTemuApi` 还是 throw 未实现）。

- [ ] **Step 3: 实现 retry-policy.ts**

Create `packages/temu-sdk/src/retry-policy.ts`:
```typescript
/**
 * 判断某次调用是否值得重试。
 * 可重试：网络错误、5xx、7000010 timestamp expired（时钟漂移）、7000015 sign invalid（罕见的信号干扰）
 * 不可重试：鉴权/权限/参数错误（7000005 / 7000007 / 7000020 等）
 */
const RETRYABLE_ERROR_CODES = new Set<number>([7000010, 7000015]);

export function isRetryableError(err: unknown, errorCode?: number): boolean {
  if (errorCode !== undefined) return RETRYABLE_ERROR_CODES.has(errorCode);
  if (err instanceof Error) {
    const msg = err.message;
    return /ECONNRESET|ETIMEDOUT|ENETUNREACH|EAI_AGAIN|fetch failed|5\d{2}/.test(msg);
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 300;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const errorCode = (err as any)?.errorCode;
      if (!isRetryableError(err, errorCode) || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}
```

- [ ] **Step 4: 实现 http-client.ts**

Replace `packages/temu-sdk/src/http-client.ts`:
```typescript
import { sign } from './signing';
import { withRetry } from './retry-policy';

const GATEWAY_URLS: Record<'cn' | 'pa', string> = {
  cn: 'https://openapi.kuajingmaihuo.com',
  pa: 'https://openapi-b-global.temu.com',
};

export interface TemuCallContext {
  appKey: string;
  appSecret: string;
  accessToken: string;
  region: 'cn' | 'pa';
  shopId: string;
}
export interface TemuMethodSpec {
  interfaceType: string;
  region: string;
  requestUrl: string;
}
export class TemuApiError extends Error {
  constructor(public errorCode: number, message: string, public rawBody?: unknown) {
    super(`Temu API ${errorCode}: ${message}`);
    this.name = 'TemuApiError';
  }
}

export async function callTemuApi<Req, Res>(
  ctx: TemuCallContext,
  spec: TemuMethodSpec,
  req: Req,
): Promise<Res> {
  return withRetry(async () => {
    const body: Record<string, unknown> = {
      type: spec.interfaceType,
      app_key: ctx.appKey,
      access_token: ctx.accessToken,
      data_type: 'JSON',
      timestamp: Math.floor(Date.now() / 1000).toString(),
      version: 'V1',
      ...(req as object),
    };
    body.sign = sign(body, ctx.appSecret);

    const url = GATEWAY_URLS[ctx.region] + spec.requestUrl;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new TemuApiError(resp.status, `HTTP ${resp.status}`, await resp.text());
    }
    const json = (await resp.json()) as { success: boolean; errorCode?: number; errorMsg?: string; result?: Res };
    if (!json.success) {
      const err = new TemuApiError(json.errorCode ?? -1, json.errorMsg ?? 'unknown', json);
      (err as any).errorCode = json.errorCode;
      throw err;
    }
    return json.result as Res;
  });
}
```

- [ ] **Step 5: 装依赖**

```bash
cd packages/temu-sdk
# fetch 在 Node 20 原生，无需额外依赖
```

- [ ] **Step 6: 运行测试**

```bash
pnpm vitest run test/http-client.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 7: 提交**

```bash
git add packages/temu-sdk/src/http-client.ts \
        packages/temu-sdk/src/retry-policy.ts \
        packages/temu-sdk/test/http-client.test.ts
git commit -m "feat(temu-sdk)(w0): HTTP client with signing and retry policy"
```

---

## Task 7: Redis 令牌桶限速器

**Files:**
- Create: `packages/temu-sdk/src/rate-limiter.ts`
- Create: `packages/temu-sdk/test/rate-limiter.test.ts`

- [ ] **Step 1: 写测试**

`packages/temu-sdk/test/rate-limiter.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Redis from 'ioredis-mock';
import { createRateLimiter } from '../src/rate-limiter';

describe('rate-limiter (token bucket)', () => {
  let redis: any;
  beforeEach(() => { redis = new Redis(); });

  it('acquires immediately when bucket has tokens', async () => {
    const limiter = createRateLimiter(redis, { qps: 5, burst: 5 });
    const t0 = Date.now();
    await limiter.acquire('shop:1', 1);
    expect(Date.now() - t0).toBeLessThan(50);
  });

  it('queues when tokens exhausted', async () => {
    const limiter = createRateLimiter(redis, { qps: 3, burst: 3 });
    // Burst 3 quick, then 4th should wait ~333ms
    await Promise.all([1, 2, 3].map(() => limiter.acquire('shop:2', 1)));
    const t0 = Date.now();
    await limiter.acquire('shop:2', 1);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(250);
    expect(elapsed).toBeLessThan(500);
  });

  it('isolates buckets per key', async () => {
    const limiter = createRateLimiter(redis, { qps: 1, burst: 1 });
    await limiter.acquire('shop:A', 1);
    const t0 = Date.now();
    await limiter.acquire('shop:B', 1);
    expect(Date.now() - t0).toBeLessThan(50);
  });
});
```

- [ ] **Step 2: 装依赖并确认失败**

```bash
cd packages/temu-sdk
pnpm add ioredis
pnpm add -D ioredis-mock
pnpm vitest run test/rate-limiter.test.ts
```

Expected: FAIL—`createRateLimiter` not defined.

- [ ] **Step 3: 实现 rate-limiter.ts**

Create `packages/temu-sdk/src/rate-limiter.ts`:

```typescript
import type { Redis } from 'ioredis';

export interface RateLimiterConfig {
  qps: number;      // tokens per second
  burst: number;    // max tokens
}
export interface RateLimiter {
  acquire(key: string, tokens: number): Promise<void>;
}

// Lua 原子脚本：令牌桶 refill + take
const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local qps = tonumber(ARGV[2])
local burst = tonumber(ARGV[3])
local want = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'last_refill_ms')
local tokens = tonumber(data[1]) or burst
local last_refill = tonumber(data[2]) or now_ms

local elapsed = math.max(0, now_ms - last_refill)
local refilled = math.min(burst, tokens + (elapsed / 1000.0) * qps)

if refilled >= want then
  tokens = refilled - want
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill_ms', now_ms)
  redis.call('EXPIRE', key, 60)
  return { 1, 0 }  -- acquired, no wait
else
  local deficit = want - refilled
  local wait_ms = math.ceil((deficit / qps) * 1000)
  return { 0, wait_ms }
end
`;

export function createRateLimiter(redis: Redis, cfg: RateLimiterConfig): RateLimiter {
  return {
    async acquire(key: string, tokens = 1): Promise<void> {
      for (;;) {
        const result = (await (redis as any).eval(
          LUA_TOKEN_BUCKET,
          1,
          `rl:${key}`,
          Date.now().toString(),
          cfg.qps.toString(),
          cfg.burst.toString(),
          tokens.toString(),
        )) as [number, number];
        const [ok, waitMs] = result;
        if (ok === 1) return;
        await new Promise((r) => setTimeout(r, waitMs));
      }
    },
  };
}
```

- [ ] **Step 4: 运行测试**

```bash
pnpm vitest run test/rate-limiter.test.ts
```

Expected: 3 tests PASS。如果 `ioredis-mock` 不支持 `eval`，改用真实的 Docker Redis 跑集成测试：

```bash
docker run -d --name redis-test -p 6379:6379 redis:7-alpine
# 修改测试：const redis = new Redis({ host: 'localhost', port: 6379 });
pnpm vitest run test/rate-limiter.test.ts
docker rm -f redis-test
```

- [ ] **Step 5: 提交**

```bash
git add packages/temu-sdk/src/rate-limiter.ts \
        packages/temu-sdk/test/rate-limiter.test.ts \
        packages/temu-sdk/package.json \
        pnpm-lock.yaml
git commit -m "feat(temu-sdk)(w0): Redis token bucket rate limiter (per-shop 3-5 qps)"
```

---

## Task 8: TemuClient 组合 + 入口导出

**Files:**
- Create: `packages/temu-sdk/src/client.ts`
- Modify: `packages/temu-sdk/src/index.ts`
- Create: `packages/temu-sdk/test/client.integration.test.ts`（用真实测试账号，默认 skip）

- [ ] **Step 1: 实现 TemuClient 类**

Create `packages/temu-sdk/src/client.ts`:

```typescript
import type { Redis } from 'ioredis';
import { callTemuApi, type TemuCallContext, type TemuApiError } from './http-client';
import { createRateLimiter, type RateLimiter } from './rate-limiter';
import { TEMU_API_REGISTRY } from './generated/methods';
import * as methods from './generated/methods';

export interface TemuClientOptions {
  redis: Redis;
  qps?: number;
  burst?: number;
}

export class TemuClient {
  private limiter: RateLimiter;

  constructor(
    private ctx: TemuCallContext,
    opts: TemuClientOptions,
  ) {
    this.limiter = createRateLimiter(opts.redis, {
      qps: opts.qps ?? 5,
      burst: opts.burst ?? 5,
    });
  }

  /**
   * 直接按 interfaceType 调用任意已注册方法。业务代码一般用 methods.* 直调更清晰。
   */
  async call<Req, Res>(interfaceType: string, req: Req): Promise<Res> {
    const reg = TEMU_API_REGISTRY[interfaceType];
    if (!reg) throw new Error(`Unknown Temu interface: ${interfaceType}`);
    await this.limiter.acquire(`temu:${this.ctx.shopId}`, 1);
    return callTemuApi<Req, Res>(this.ctx, {
      interfaceType,
      region: reg.region,
      requestUrl: reg.requestUrl,
    }, req);
  }
}

export { methods, TEMU_API_REGISTRY };
export * from './generated/types';
export type { TemuCallContext, TemuApiError };
```

- [ ] **Step 2: 更新 index.ts**

Replace `packages/temu-sdk/src/index.ts`:
```typescript
export * from './client';
export { sign } from './signing';
export { TemuApiError } from './http-client';
export const SDK_VERSION = '0.1.0';
```

- [ ] **Step 3: 集成测试骨架（默认 skip）**

`packages/temu-sdk/test/client.integration.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import Redis from 'ioredis';
import { TemuClient, methods } from '../src';

const RUN_INTEGRATION = process.env.TEMU_TEST_APP_KEY !== undefined;

describe.skipIf(!RUN_INTEGRATION)('TemuClient integration (requires TEMU_TEST_* env)', () => {
  it('calls bg.mall.info.get successfully', async () => {
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    const client = new TemuClient({
      appKey: process.env.TEMU_TEST_APP_KEY!,
      appSecret: process.env.TEMU_TEST_APP_SECRET!,
      accessToken: process.env.TEMU_TEST_ACCESS_TOKEN!,
      region: (process.env.TEMU_TEST_REGION as 'cn' | 'pa') ?? 'cn',
      shopId: process.env.TEMU_TEST_SHOP_ID!,
    }, { redis });
    const res = await methods.bgMallInfoGet(client['ctx'], {});
    expect(res).toBeDefined();
    await redis.quit();
  });
});
```

- [ ] **Step 4: 运行 workspace 所有测试**

```bash
cd /Users/mx4com/coding/duoshou-erp
pnpm -r test
```

Expected: temu-sdk 所有单元测试 PASS；集成测试 skipped（没设 env）。

- [ ] **Step 5: 提交**

```bash
git add packages/temu-sdk/src/client.ts \
        packages/temu-sdk/src/index.ts \
        packages/temu-sdk/test/client.integration.test.ts
git commit -m "feat(temu-sdk)(w0): compose TemuClient with rate limiting and method registry"
```

---

## Task 9: NestJS API 骨架

**Files:**
- Create: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/app.controller.ts`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/nest-cli.json`, `apps/api/tsconfig.json`, `apps/api/.env.development.example`
- Create: `apps/api/src/modules/health/health.module.ts`, `apps/api/src/modules/health/health.controller.ts`
- Create: `apps/api/test/app.e2e.test.ts`

- [ ] **Step 1: 装 NestJS 依赖**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/api
pnpm add @nestjs/common @nestjs/core @nestjs/config @nestjs/platform-express reflect-metadata rxjs zod
pnpm add -D @nestjs/cli @nestjs/testing typescript ts-node @types/node vitest supertest @types/supertest
```

- [ ] **Step 2: tsconfig.json**

Create `apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "./dist",
    "baseUrl": "./",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: nest-cli.json**

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true }
}
```

- [ ] **Step 4: 环境变量 schema**

Create `apps/api/src/config/env.ts`:
```typescript
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  CREDS_ENCRYPTION_KEY: z.string().length(44), // 32-byte key base64-encoded → 44 chars
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});
export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid env:', parsed.error.format());
    process.exit(1);
  }
  return parsed.data;
}
```

- [ ] **Step 5: .env.development.example**

Create `apps/api/.env.development.example`:
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/duoshou
REDIS_URL=redis://localhost:6379
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CREDS_ENCRYPTION_KEY=  # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 6: 最小 NestJS app**

Create `apps/api/src/main.ts`:
```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  await app.listen(env.PORT);
  console.log(`API listening on :${env.PORT}`);
}
bootstrap();
```

Create `apps/api/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [HealthModule],
})
export class AppModule {}
```

Create `apps/api/src/modules/health/health.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
```

Create `apps/api/src/modules/health/health.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
```

- [ ] **Step 7: E2E 测试**

Create `apps/api/test/app.e2e.test.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AppModule } from '../src/app.module';

describe('App E2E', () => {
  let app: INestApplication;
  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/test';
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'x';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'x';
    process.env.CREDS_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('GET /health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
```

- [ ] **Step 8: 跑起来验证**

```bash
cd apps/api
cp .env.development.example .env.development
# 编辑 .env.development 填 dummy 值够启动就行
export $(cat .env.development | xargs)
pnpm vitest run
```

Expected: PASS.

```bash
pnpm dev
# 另一个终端：
curl http://localhost:3000/health
# {"ok":true,"ts":"..."}
```

- [ ] **Step 9: 提交**

```bash
git add apps/api
git commit -m "feat(api)(w0): NestJS scaffold with health endpoint and env validation"
```

---

## Task 10: Vue 3 前端骨架

**Files:**
- Create: `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`
- Create: `apps/web/src/main.ts`, `apps/web/src/App.vue`, `apps/web/src/router/index.ts`
- Create: `apps/web/src/pages/HomePage.vue`, `apps/web/src/pages/LoginPage.vue`
- Create: `apps/web/src/stores/auth.ts`

- [ ] **Step 1: 装依赖**

```bash
cd /Users/mx4com/coding/duoshou-erp/apps/web
pnpm add vue vue-router pinia naive-ui @supabase/supabase-js
pnpm add -D vite @vitejs/plugin-vue typescript vue-tsc @types/node vitest @vitest/coverage-v8 jsdom
```

- [ ] **Step 2: vite 配置**

`apps/web/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "types": ["vite/client"],
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "src/**/*.d.ts"]
}
```

`apps/web/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>舵手 ERP</title></head>
<body><div id="app"></div><script type="module" src="/src/main.ts"></script></body>
</html>
```

- [ ] **Step 3: app 入口**

`apps/web/src/main.ts`:
```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';

createApp(App).use(createPinia()).use(router).mount('#app');
```

`apps/web/src/App.vue`:
```vue
<template>
  <n-config-provider :locale="zhCN">
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>
<script setup lang="ts">
import { NConfigProvider, NMessageProvider, zhCN } from 'naive-ui';
</script>
```

`apps/web/src/router/index.ts`:
```typescript
import { createRouter, createWebHistory } from 'vue-router';
import HomePage from '@/pages/HomePage.vue';
import LoginPage from '@/pages/LoginPage.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/login', component: LoginPage },
  ],
});
```

`apps/web/src/pages/HomePage.vue`:
```vue
<template>
  <n-card title="舵手 ERP" style="max-width: 480px; margin: 60px auto;">
    <n-h2>W0 骨架运行中</n-h2>
    <n-button @click="ping">Ping API</n-button>
    <n-text v-if="result">{{ result }}</n-text>
  </n-card>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { NCard, NButton, NH2, NText } from 'naive-ui';
const result = ref('');
async function ping() {
  const r = await fetch('/api/health');
  result.value = await r.text();
}
</script>
```

`apps/web/src/pages/LoginPage.vue`（占位，Task 13 完善）:
```vue
<template>
  <n-card title="登录" style="max-width: 360px; margin: 80px auto;">
    <n-text>Task 13 实现 Supabase Auth</n-text>
  </n-card>
</template>
<script setup lang="ts">
import { NCard, NText } from 'naive-ui';
</script>
```

- [ ] **Step 4: 起前端**

```bash
pnpm dev
# 浏览器打开 http://localhost:5173
# 点「Ping API」应返回 {"ok":true,"ts":"..."}
```

- [ ] **Step 5: 提交**

```bash
git add apps/web
git commit -m "feat(web)(w0): Vue 3 scaffold with Naive UI and /health ping"
```

---

## Task 11: Supabase 连接 + 数据模型迁移

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260418000000_init/migration.sql`
- Create: `apps/api/src/infra/prisma.module.ts`, `apps/api/src/infra/prisma.service.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: 装 Prisma**

```bash
cd apps/api
pnpm add @prisma/client
pnpm add -D prisma
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: prisma schema**

Replace `apps/api/prisma/schema.prisma`:
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql" url = env("DATABASE_URL") }

model User {
  id           String   @id @default(uuid())
  email        String?  @unique
  phone        String?
  authProvider String   @default("supabase") @map("auth_provider")
  createdAt    DateTime @default(now()) @map("created_at")
  members      Member[]
  @@map("user")
}

model Organization {
  id        String   @id @default(uuid())
  name      String
  status    String   @default("active")
  createdAt DateTime @default(now()) @map("created_at")
  members   Member[]
  shops     Shop[]
  @@map("organization")
}

model Member {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  orgId     String   @map("org_id")
  role      String   @default("owner")
  createdAt DateTime @default(now()) @map("created_at")
  user      User         @relation(fields: [userId], references: [id])
  org       Organization @relation(fields: [orgId], references: [id])
  @@unique([userId, orgId])
  @@map("member")
}

model ShopCredentials {
  id                    String @id @default(uuid())
  appKeyEncrypted       Bytes  @map("app_key_encrypted")
  appSecretEncrypted    Bytes  @map("app_secret_encrypted")
  accessTokenEncrypted  Bytes  @map("access_token_encrypted")
  encryptionVersion     Int    @default(1) @map("encryption_version")
  createdAt             DateTime @default(now()) @map("created_at")
  shop                  Shop?
  @@map("shop_credentials")
}

model Shop {
  id                    String   @id @default(uuid())
  orgId                 String   @map("org_id")
  platform              String   @default("temu")
  platformShopId        String   @map("platform_shop_id")
  shopType              String   @map("shop_type")
  region                String
  displayName           String?  @map("display_name")
  credsVaultRef         String   @unique @map("creds_vault_ref")
  accessTokenExpiresAt  DateTime? @map("access_token_expires_at")
  status                String   @default("active")
  connectedAt           DateTime @default(now()) @map("connected_at")
  org                   Organization     @relation(fields: [orgId], references: [id])
  creds                 ShopCredentials  @relation(fields: [credsVaultRef], references: [id])
  @@unique([orgId, platform, platformShopId])
  @@index([orgId, platform])
  @@map("shop")
}

// W0 仅建这些核心表；业务表 (product/price_review/activity/inventory) 在各自 W1-W3 plan 里建
```

- [ ] **Step 3: 建 Supabase 项目 + 跑 migration**

```bash
# 在 Supabase Dashboard 创建新项目：duoshou-erp-dev
# 从 Settings -> Database 复制 connection string 到 .env.development 的 DATABASE_URL

cd apps/api
npx prisma migrate dev --name init
```

Expected: 在 Supabase 上创建了 user / organization / member / shop / shop_credentials 5 张表。

- [ ] **Step 4: Prisma 服务**

Create `apps/api/src/infra/prisma.service.ts`:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

Create `apps/api/src/infra/prisma.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

Update `apps/api/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './infra/prisma.module';
import { HealthModule } from './modules/health/health.module';

@Module({ imports: [PrismaModule, HealthModule] })
export class AppModule {}
```

- [ ] **Step 5: E2E smoke：连通 DB**

Add to `apps/api/test/app.e2e.test.ts`:
```typescript
it('connects to database', async () => {
  const prisma = app.get('PrismaService') as any;
  const count = await prisma.organization.count();
  expect(count).toBeGreaterThanOrEqual(0);
});
```

运行：
```bash
pnpm vitest run
```

Expected: PASS（count=0 是初始状态）。

- [ ] **Step 6: 提交**

```bash
git add apps/api/prisma apps/api/src/infra
git commit -m "feat(api)(w0): Prisma schema and Supabase connection"
```

---

## Task 12: 凭据加密 + 店铺连接流

**Files:**
- Create: `apps/api/src/infra/crypto.ts` + test
- Create: `apps/api/src/modules/shop/shop.module.ts`, `shop.controller.ts`, `shop.service.ts`, `shop.dto.ts`

- [ ] **Step 1: 凭据加密测试**

`apps/api/src/infra/crypto.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto';

describe('crypto', () => {
  const key = Buffer.alloc(32, 1).toString('base64');  // 32 字节全 0x01
  it('round-trips', () => {
    const pt = 'my_app_secret';
    const ct = encrypt(pt, key);
    expect(ct).not.toBe(pt);
    expect(decrypt(ct, key)).toBe(pt);
  });
  it('different ciphertexts for same plaintext (random IV)', () => {
    const c1 = encrypt('same', key);
    const c2 = encrypt('same', key);
    expect(Buffer.compare(c1, c2)).not.toBe(0);
    expect(decrypt(c1, key)).toBe('same');
    expect(decrypt(c2, key)).toBe('same');
  });
  it('tampering throws', () => {
    const ct = Buffer.from(encrypt('x', key));
    ct[0] ^= 0xff;
    expect(() => decrypt(ct, key)).toThrow();
  });
});
```

- [ ] **Step 2: 实现 crypto.ts**

`apps/api/src/infra/crypto.ts`:
```typescript
import crypto from 'node:crypto';

/** AES-256-GCM encrypt: 输出 = [iv(12)] [authTag(16)] [ciphertext] */
export function encrypt(plaintext: string, keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error('encryption key must be 32 bytes');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}
export function decrypt(blob: Buffer, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
```

运行测试：
```bash
pnpm vitest run src/infra/crypto.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 3: Shop DTOs (zod)**

`apps/api/src/modules/shop/shop.dto.ts`:
```typescript
import { z } from 'zod';

export const ConnectShopDto = z.object({
  appKey: z.string().min(20),
  appSecret: z.string().min(20),
  accessToken: z.string().min(20),
  shopType: z.enum(['full', 'semi']),
  region: z.enum(['cn', 'pa']),
  displayName: z.string().optional(),
});
export type ConnectShopInput = z.infer<typeof ConnectShopDto>;

export const ShopResponse = z.object({
  id: z.string().uuid(),
  platformShopId: z.string(),
  shopType: z.string(),
  region: z.string(),
  displayName: z.string().nullable(),
  status: z.string(),
  connectedAt: z.string(),
});
export type Shop = z.infer<typeof ShopResponse>;
```

- [ ] **Step 4: Shop service（调 Temu bg.mall.info.get 验证凭据）**

`apps/api/src/modules/shop/shop.service.ts`:
```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import Redis from 'ioredis';
import { TemuClient, methods } from '@duoshou/temu-sdk';
import { PrismaService } from '../../infra/prisma.service';
import { encrypt } from '../../infra/crypto';
import type { ConnectShopInput } from './shop.dto';

@Injectable()
export class ShopService {
  private redis: Redis;
  constructor(private prisma: PrismaService) {
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  async connect(orgId: string, input: ConnectShopInput) {
    // 1. 先用凭据调 bg.mall.info.get 验证可用
    const ctx = {
      appKey: input.appKey,
      appSecret: input.appSecret,
      accessToken: input.accessToken,
      region: input.region,
      shopId: 'pending',  // 还不知道，调完拿
    };
    let mallInfo: { mallId: string | number; mallType?: string };
    try {
      mallInfo = await methods.bgMallInfoGet(ctx, {} as any);
    } catch (e: any) {
      throw new BadRequestException(`凭据验证失败: ${e.message}`);
    }
    const platformShopId = String((mallInfo as any).mallId);

    // 2. 加密凭据
    const key = process.env.CREDS_ENCRYPTION_KEY!;
    const creds = await this.prisma.shopCredentials.create({
      data: {
        appKeyEncrypted: encrypt(input.appKey, key),
        appSecretEncrypted: encrypt(input.appSecret, key),
        accessTokenEncrypted: encrypt(input.accessToken, key),
      },
    });

    // 3. 创建 Shop（若 platform_shop_id 冲突说明已经连接过）
    const shop = await this.prisma.shop.upsert({
      where: { orgId_platform_platformShopId: { orgId, platform: 'temu', platformShopId } },
      update: { credsVaultRef: creds.id, displayName: input.displayName, status: 'active' },
      create: {
        orgId, platform: 'temu', platformShopId,
        shopType: input.shopType, region: input.region,
        displayName: input.displayName,
        credsVaultRef: creds.id,
      },
    });
    return shop;
  }

  async list(orgId: string) {
    return this.prisma.shop.findMany({ where: { orgId }, orderBy: { connectedAt: 'desc' } });
  }
}
```

- [ ] **Step 5: Shop controller**

`apps/api/src/modules/shop/shop.controller.ts`:
```typescript
import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ConnectShopDto } from './shop.dto';
import { ZodValidationPipe } from '../../infra/zod-pipe';
// TODO Task 14: 从 request ctx 拿 orgId。W0 占位：硬编码从 env 取
const HARDCODED_ORG_ID = process.env.DEV_ORG_ID!;

@Controller('shops')
export class ShopController {
  constructor(private shopService: ShopService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(ConnectShopDto))
  connect(@Body() body: any) {
    return this.shopService.connect(HARDCODED_ORG_ID, body);
  }
  @Get()
  list() {
    return this.shopService.list(HARDCODED_ORG_ID);
  }
}
```

`apps/api/src/modules/shop/shop.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({ controllers: [ShopController], providers: [ShopService] })
export class ShopModule {}
```

- [ ] **Step 6: Zod pipe**

Create `apps/api/src/infra/zod-pipe.ts`:
```typescript
import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private schema: ZodSchema<T>) {}
  transform(value: unknown) {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) throw new BadRequestException(parsed.error.format());
    return parsed.data;
  }
}
```

- [ ] **Step 7: 集成测试（用 Temu 官方测试账号）**

`apps/api/test/shop.e2e.test.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AppModule } from '../src/app.module';

const RUN = process.env.TEMU_FULL_TEST_1_APP_KEY !== undefined;

describe.skipIf(!RUN)('Shop connect E2E', () => {
  let app: INestApplication;
  beforeAll(async () => {
    // 跟 app.e2e.test.ts 一样的 env 设置
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('connects Temu test shop and returns shop info', async () => {
    const res = await request(app.getHttpServer())
      .post('/shops')
      .send({
        appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
        appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
        accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
        shopType: 'full',
        region: 'cn',
        displayName: 'girl clothes test',
      });
    expect(res.status).toBe(201);
    expect(res.body.platformShopId).toBe('1052202882');
  });
});
```

运行（需在 .env.development 填好 TEMU_FULL_TEST_1_* 凭据）：
```bash
pnpm vitest run test/shop.e2e.test.ts
```

Expected: PASS（如果凭据还有效）。

- [ ] **Step 8: 提交**

```bash
git add apps/api/src/infra/crypto.ts apps/api/src/infra/crypto.test.ts \
        apps/api/src/infra/zod-pipe.ts \
        apps/api/src/modules/shop \
        apps/api/test/shop.e2e.test.ts
git commit -m "feat(api)(w0): shop connect flow with credential encryption and Temu validation"
```

---

## Task 13: Supabase Auth 集成

**Files:**
- Create: `apps/api/src/modules/auth/auth.guard.ts`, `auth.module.ts`
- Modify: `apps/web/src/stores/auth.ts`, `apps/web/src/pages/LoginPage.vue`

- [ ] **Step 1: Auth Guard 测试**

`apps/api/src/modules/auth/auth.guard.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  it('rejects missing token', async () => {
    const guard = new AuthGuard({} as any);
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as any;
    await expect(guard.canActivate(ctx)).rejects.toThrow();
  });
  // 真实 JWT 验证走集成测试
});
```

- [ ] **Step 2: AuthGuard 实现**

`apps/api/src/modules/auth/auth.guard.ts`:
```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class AuthGuard implements CanActivate {
  private supabase: SupabaseClient;
  constructor() {
    this.supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    const token = auth.slice(7);
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException(error?.message ?? 'Invalid token');
    req.user = { id: data.user.id, email: data.user.email };
    return true;
  }
}
```

```bash
cd apps/api
pnpm add @supabase/supabase-js
```

- [ ] **Step 3: 把 Guard 挂到 ShopController**

`apps/api/src/modules/shop/shop.controller.ts` 头加 `@UseGuards(AuthGuard)`。

- [ ] **Step 4: 前端 Supabase 客户端**

`apps/web/src/stores/auth.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createClient, type Session } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null);
  supabase.auth.onAuthStateChange((_e, s) => { session.value = s; });
  supabase.auth.getSession().then(({ data }) => { session.value = data.session; });

  const isAuthed = computed(() => !!session.value);

  async function loginWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }
  async function logout() { await supabase.auth.signOut(); }

  function authHeader(): Record<string, string> {
    return session.value ? { Authorization: `Bearer ${session.value.access_token}` } : {};
  }
  return { session, isAuthed, loginWithEmail, signUp, logout, authHeader };
});
```

- [ ] **Step 5: 登录页**

`apps/web/src/pages/LoginPage.vue`:
```vue
<template>
  <n-card title="舵手 ERP 登录" style="max-width: 360px; margin: 80px auto;">
    <n-form>
      <n-form-item label="邮箱"><n-input v-model:value="email" /></n-form-item>
      <n-form-item label="密码"><n-input v-model:value="password" type="password" /></n-form-item>
      <n-space>
        <n-button type="primary" @click="onLogin" :loading="busy">登录</n-button>
        <n-button @click="onSignup" :loading="busy">注册</n-button>
      </n-space>
    </n-form>
  </n-card>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useMessage, NCard, NForm, NFormItem, NInput, NButton, NSpace } from 'naive-ui';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
const email = ref('');
const password = ref('');
const busy = ref(false);
const msg = useMessage();
const router = useRouter();
const auth = useAuthStore();
async function onLogin() {
  busy.value = true;
  try { await auth.loginWithEmail(email.value, password.value); router.push('/'); }
  catch (e: any) { msg.error(e.message); }
  finally { busy.value = false; }
}
async function onSignup() {
  busy.value = true;
  try { await auth.signUp(email.value, password.value); msg.success('注册成功，请查收邮件'); }
  catch (e: any) { msg.error(e.message); }
  finally { busy.value = false; }
}
</script>
```

- [ ] **Step 6: 路由守卫**

Update `apps/web/src/router/index.ts`:
```typescript
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import HomePage from '@/pages/HomePage.vue';
import LoginPage from '@/pages/LoginPage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage, meta: { requiresAuth: true } },
    { path: '/login', component: LoginPage },
  ],
});
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthed) return '/login';
});
export default router;
```

- [ ] **Step 7: 前端 .env**

Create `apps/web/.env.development.example`:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=/api
```

- [ ] **Step 8: 手动冒烟测试**

```bash
# 起 api 和 web
pnpm --filter @duoshou/api dev
pnpm --filter @duoshou/web dev
```

打开浏览器 http://localhost:5173/login → 注册账号 → 邮箱验证 → 登录 → 跳到 `/` → 能看到 homepage。

- [ ] **Step 9: 提交**

```bash
git add apps/api/src/modules/auth apps/api/package.json \
        apps/web/src/stores apps/web/src/pages apps/web/src/router apps/web/.env.development.example \
        pnpm-lock.yaml
git commit -m "feat(w0): Supabase Auth integration (backend guard + frontend login)"
```

---

## Task 14: 租户/Member 自动创建中间件

**Files:**
- Create: `apps/api/src/modules/tenant/tenant.module.ts`, `tenant.service.ts`, `tenant.middleware.ts`

- [ ] **Step 1: 测试**

`apps/api/src/modules/tenant/tenant.service.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  it('creates org + member on first-time user', async () => {
    const prisma = {
      member: { findFirst: vi.fn().mockResolvedValue(null) },
      organization: { create: vi.fn().mockResolvedValue({ id: 'org-1' }) },
      $transaction: vi.fn().mockImplementation(async (fn) => fn(prisma)),
    } as any;
    prisma.member.create = vi.fn().mockResolvedValue({ id: 'm-1', orgId: 'org-1', userId: 'u-1' });
    const svc = new TenantService(prisma);
    const m = await svc.resolveForUser({ id: 'u-1', email: 'a@b.c' });
    expect(m.orgId).toBe('org-1');
    expect(prisma.organization.create).toHaveBeenCalled();
  });
  it('returns existing member on subsequent calls', async () => {
    const prisma = {
      member: { findFirst: vi.fn().mockResolvedValue({ id: 'm-1', orgId: 'org-1', userId: 'u-1' }) },
    } as any;
    const svc = new TenantService(prisma);
    const m = await svc.resolveForUser({ id: 'u-1', email: 'a@b.c' });
    expect(m.orgId).toBe('org-1');
  });
});
```

- [ ] **Step 2: 实现**

`apps/api/src/modules/tenant/tenant.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.service';

export interface AuthUser { id: string; email?: string }

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async resolveForUser(user: AuthUser) {
    const existing = await this.prisma.member.findFirst({ where: { userId: user.id } });
    if (existing) return existing;
    return this.prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: user.id },
        create: { id: user.id, email: user.email, authProvider: 'supabase' },
        update: { email: user.email },
      });
      const org = await tx.organization.create({ data: { name: user.email ?? 'My Org' } });
      return tx.member.create({ data: { userId: user.id, orgId: org.id, role: 'owner' } });
    });
  }
}
```

- [ ] **Step 3: 中间件挂到 ShopController**

Replace `ShopController` 从 env 硬编码取 orgId 为 从 req.user / req.tenant 取：

```typescript
import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from '../tenant/tenant.service';
// ...
@Controller('shops')
@UseGuards(AuthGuard)
export class ShopController {
  constructor(private shopService: ShopService, private tenant: TenantService) {}
  @Post()
  async connect(@Req() req: any, @Body() body: ConnectShopInput) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.shopService.connect(m.orgId, body);
  }
  @Get()
  async list(@Req() req: any) {
    const m = await this.tenant.resolveForUser(req.user);
    return this.shopService.list(m.orgId);
  }
}
```

- [ ] **Step 4: Module wiring**

`apps/api/src/modules/tenant/tenant.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
@Global()
@Module({ providers: [TenantService], exports: [TenantService] })
export class TenantModule {}
```

Add `TenantModule` + `AuthGuard` 到 `AppModule.imports` / `providers`。

- [ ] **Step 5: 跑测试 + 手动冒烟**

```bash
pnpm --filter @duoshou/api test
pnpm --filter @duoshou/api dev
```

登录后调用 `POST /shops`（带 Bearer token）应该自动创建 org + member 并绑定 shop。

- [ ] **Step 6: 提交**

```bash
git add apps/api/src/modules/tenant apps/api/src/modules/shop/shop.controller.ts apps/api/src/app.module.ts
git commit -m "feat(api)(w0): auto-create org and member on first authenticated request"
```

---

## Task 15: Docker + GitHub Actions CI/CD

**Files:**
- Create: `infra/docker/api.Dockerfile`, `infra/docker/docker-compose.yml`
- Create: `infra/deploy/deploy.sh`
- Create: `.github/workflows/deploy.yml`
- Create: `.env.production.example`

- [ ] **Step 1: api.Dockerfile**

`infra/docker/api.Dockerfile`:
```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @duoshou/temu-sdk codegen
RUN pnpm --filter @duoshou/api build
RUN pnpm --filter @duoshou/api deploy --prod /output

FROM base AS runtime
COPY --from=build /output /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

- [ ] **Step 2: docker-compose.yml（生产）**

`infra/docker/docker-compose.yml`:
```yaml
services:
  api:
    image: duoshou/api:${TAG:-latest}
    restart: always
    ports: ["3000:3000"]
    env_file: .env.production
    depends_on: [redis]
  web-nginx:
    image: nginx:1.27-alpine
    restart: always
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./web-dist:/usr/share/nginx/html:ro
      - ./letsencrypt:/etc/letsencrypt:ro
  redis:
    image: redis:7-alpine
    restart: always
    volumes: ["redis-data:/data"]
volumes:
  redis-data:
```

（nginx.conf 负责反代 /api/ 到 api:3000 + 静态托管 /）

- [ ] **Step 3: 部署脚本**

`infra/deploy/deploy.sh`:
```bash
#!/bin/bash
set -euo pipefail
SERVER=${DEPLOY_HOST:?DEPLOY_HOST required}
USER=${DEPLOY_USER:-ubuntu}
TAG=${1:-latest}

ssh "$USER@$SERVER" <<EOF
  set -e
  cd /opt/duoshou-erp
  docker compose pull
  TAG=$TAG docker compose up -d
  docker image prune -f
EOF
```

- [ ] **Step 4: GitHub Actions**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push: { branches: [main] }
  workflow_dispatch: {}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @duoshou/temu-sdk codegen
      - run: pnpm -r test
      - run: pnpm -r build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      - name: Build + push API image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: infra/docker/api.Dockerfile
          push: true
          tags: ${{ vars.DOCKER_REGISTRY }}/duoshou/api:${{ github.sha }}
      - name: Deploy to ECS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/duoshou-erp
            export TAG=${{ github.sha }}
            docker compose pull
            docker compose up -d
```

- [ ] **Step 5: .env.production.example**

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...supabase...
REDIS_URL=redis://redis:6379
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CREDS_ENCRYPTION_KEY=
CORS_ORIGIN=https://duoshou.868818.xyz
```

- [ ] **Step 6: 一次手动部署演练**

- 在阿里云申请 2C4G ECS，开 22/80/443 入方向规则
- `duoshou.868818.xyz` A 记录 -> ECS 公网 IP
- ECS 装 Docker + docker-compose-plugin
- `/opt/duoshou-erp/` 下放 `.env.production`（手动填真实值）+ `nginx.conf`
- 配好 Let's Encrypt（certbot）
- 手动跑一次 `bash infra/deploy/deploy.sh main`
- 访问 https://duoshou.868818.xyz/health 返回 `{"ok":true,...}`

- [ ] **Step 7: 提交**

```bash
git add infra .github .env.production.example
git commit -m "chore(w0): Docker Compose deploy + GitHub Actions CI/CD to ECS"
```

---

## Task 16: W0 端到端冒烟测试 + README

**Files:**
- Modify: `README.md`
- Create: `apps/api/test/w0-smoke.e2e.test.ts`

- [ ] **Step 1: 冒烟脚本**

`apps/api/test/w0-smoke.e2e.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const RUN = process.env.W0_SMOKE_URL !== undefined && process.env.TEMU_FULL_TEST_1_APP_KEY !== undefined;

describe.skipIf(!RUN)('W0 smoke: end-to-end happy path', () => {
  const base = process.env.W0_SMOKE_URL!;  // https://duoshou.868818.xyz
  it('register → login → connect shop → list shops → health', async () => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const email = `smoke-${Date.now()}@duoshou.app`;
    const password = 'SmokeTest!2026';
    await supabase.auth.signUp({ email, password });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const tok = data.session!.access_token;

    // health
    const h = await fetch(`${base}/health`);
    expect(h.status).toBe(200);

    // connect shop
    const r = await fetch(`${base}/api/shops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({
        appKey: process.env.TEMU_FULL_TEST_1_APP_KEY,
        appSecret: process.env.TEMU_FULL_TEST_1_APP_SECRET,
        accessToken: process.env.TEMU_FULL_TEST_1_ACCESS_TOKEN,
        shopType: 'full', region: 'cn', displayName: 'smoke',
      }),
    });
    expect(r.status).toBe(201);

    // list shops
    const l = await fetch(`${base}/api/shops`, { headers: { Authorization: `Bearer ${tok}` } });
    const list = await l.json();
    expect(list).toHaveLength(1);
    expect(list[0].platformShopId).toBe('1052202882');
  });
});
```

- [ ] **Step 2: README**

Replace `README.md`:
```markdown
# 舵手 ERP

面向 Temu 多店铺卖家的「跨店聚合 + 批量操作」SaaS 工作台。

## 快速开始（开发环境）

### 依赖
- Node.js 20+
- pnpm 9+
- Redis 7 (本地或 Docker)
- Supabase 账号（免费版即可）

### 启动
```bash
# 1. 安装依赖
pnpm install

# 2. 生成 Temu SDK
pnpm codegen

# 3. 配 env
cp apps/api/.env.development.example apps/api/.env.development
cp apps/web/.env.development.example apps/web/.env.development
# 填入 Supabase URL / keys 和 Temu 测试账号

# 4. 建表
cd apps/api && npx prisma migrate dev

# 5. 起本地 Redis
docker run -d --name duoshou-redis -p 6379:6379 redis:7-alpine

# 6. 跑起来
pnpm dev:api   # localhost:3000
pnpm dev:web   # localhost:5173
```

### 测试
```bash
pnpm -r test
```

## 项目结构

见 `docs/superpowers/specs/2026-04-18-duoshou-erp-v1-design.md` 第 11 节。

## 路线图

- v1 (当前): 跨店发品 + 核价调价 + 活动报名 + 库存看板
- v1.5: 广告管理 + BI + 订单提醒
- v2: 备货发货 + 售后 + 多平台 (Amazon/Shopee)
```

- [ ] **Step 3: W0 Done Checklist**

在 spec 文档末尾（或新建 `docs/w0-done-checklist.md`）：
- [x] Monorepo 结构、pnpm workspaces
- [x] Temu 214 篇文档入库，规范化 spec 提取
- [x] 代码生成 214 个 TS 类型 + API 方法
- [x] 签名算法 (MD5 + sorted key-value + app_secret)
- [x] HTTP 客户端 + 重试策略 + 错误分类
- [x] Redis 令牌桶限速（per-shop 3-5 qps）
- [x] TemuClient 组合入口
- [x] NestJS API 骨架 + 健康检查
- [x] Vue 3 前端骨架 + Naive UI
- [x] Prisma schema + Supabase 迁移 (user/org/member/shop/shop_credentials)
- [x] AES-256-GCM 凭据加密
- [x] 店铺连接流（调 bg.mall.info.get 验证）
- [x] Supabase Auth 集成（前后端）
- [x] 租户自动创建中间件
- [x] Docker + GitHub Actions 部署 ECS
- [x] W0 端到端冒烟：注册 → 登录 → 连店铺 → 列店铺 → 调通 /health

- [ ] **Step 4: 跑完整冒烟**

部署后在 prod URL 跑：
```bash
export W0_SMOKE_URL=https://duoshou.868818.xyz
export SUPABASE_URL=...
export SUPABASE_ANON_KEY=...
export TEMU_FULL_TEST_1_APP_KEY=...
# ...
pnpm --filter @duoshou/api test test/w0-smoke.e2e.test.ts
```

Expected: PASS.

- [ ] **Step 5: 最终提交**

```bash
git add README.md apps/api/test/w0-smoke.e2e.test.ts docs/w0-done-checklist.md
git commit -m "chore(w0): README and W0 done checklist; smoke test passes"
git tag w0-complete
git push origin main --tags
```

**W0 完工！** 下一步回到 writing-plans 为 W1（跨店发品中心）写详细计划。
