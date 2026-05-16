<template>
  <div class="temu-page">
    <!-- 顶部通告 -->
    <div class="notice-bar">
      <span class="notice-icon">⚠</span>
      <span class="notice-text">演示通告：Temu 平台接口将于近期升级，授权时间较早的店铺需重新授权，否则商品/库存数据可能显示异常。</span>
    </div>

    <!-- 筛选区 -->
    <div class="filter-section">
      <div class="filter-row">
        <div class="store-tabs">
          <button class="store-tab" :class="{ active: storeType === 'cross' }" @click="storeType = 'cross'">跨境店</button>
          <button class="store-tab" :class="{ active: storeType === 'local' }" @click="storeType = 'local'">本土店</button>
        </div>
        <n-select size="small" placeholder="全部站点" :options="siteOpts" v-model:value="site" clearable style="width: 130px" />
        <n-select size="small" placeholder="店铺" :options="shopOpts" v-model:value="shop" clearable style="width: 180px" />
        <n-select size="small" placeholder="状态" :options="statusOpts" v-model:value="status" clearable style="width: 110px" />
        <n-select size="small" placeholder="产品标签" :options="tagOpts" v-model:value="tag" multiple max-tag-count="responsive" clearable style="width: 140px" />
        <n-select size="small" placeholder="产品类型" :options="typeOpts" v-model:value="type" clearable style="width: 130px" />
        <n-select size="small" placeholder="业务员" :options="ownerOpts" v-model:value="owner" clearable style="width: 130px" />
        <n-select size="small" placeholder="配对状态" :options="pairOpts" v-model:value="pair" clearable style="width: 130px" />
        <n-select size="small" placeholder="父体" :options="parentOpts" v-model:value="parent" clearable style="width: 130px" />
        <n-input size="small" placeholder="双击可批量搜索内容" clearable style="width: 220px" />
        <n-button size="small" tertiary>
          <template #icon><span>⚙</span></template>
        </n-button>
        <n-button size="small" tertiary @click="reset">重置</n-button>
        <div style="flex:1"></div>
        <n-button size="small" type="primary">Temu 上新看板</n-button>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <n-button-group size="small">
        <n-button type="primary">配对</n-button>
        <n-button>▾</n-button>
      </n-button-group>
      <n-button size="small">自动配对</n-button>
      <n-button size="small">分配业务员</n-button>
      <n-button-group size="small">
        <n-button>导入</n-button>
        <n-button>▾</n-button>
      </n-button-group>
      <n-button size="small">调库存</n-button>
      <n-button size="small">修改申报价</n-button>
      <n-button size="small">同步申报价</n-button>
      <n-button-group size="small">
        <n-button>标签</n-button>
        <n-button>▾</n-button>
      </n-button-group>
      <n-button size="small">同步产品</n-button>
      <n-button size="small">产品变更记录</n-button>
      <div style="flex:1"></div>
      <n-button size="small" tertiary>⚙ 自定义列</n-button>
      <button class="icon-btn" title="刷新">↻</button>
      <button class="icon-btn" title="锁定">🔒</button>
      <button class="icon-btn" title="导出">⤓</button>
      <button class="icon-btn" title="帮助">?</button>
    </div>

    <!-- 数据表 -->
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-sel"><n-checkbox /></th>
            <th class="col-img">图片</th>
            <th class="col-status">状态</th>
            <th class="col-pid">产品ID <span class="th-sort">↕</span></th>
            <th class="col-msku">MSKU <span class="th-sort">↕</span></th>
            <th class="col-price">申报价格 <span class="th-help">?</span></th>
            <th class="col-price">活动价格</th>
            <th class="col-name">品名/SKU <span class="th-help">?</span></th>
            <th class="col-attr">属性</th>
            <th class="col-stock">库存</th>
            <th class="col-time">时间 <span class="th-help">?</span> <span class="th-sort">↕</span></th>
            <th class="col-op">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="g in groups" :key="g.spuId">
            <!-- 父行（标题/SPU 信息） -->
            <tr class="row-parent">
              <td class="col-sel"><n-checkbox /></td>
              <td colspan="11">
                <div class="parent-info">
                  <span class="meta"><b>标题：</b><span class="title" :title="g.title">{{ g.title }}</span></span>
                  <span class="meta"><b>父体</b><span class="muted">?</span><b>：</b>{{ g.spuId }}</span>
                  <span class="meta"><b>SKC：</b>{{ g.skc }}</span>
                  <span class="meta"><b>SKC货号：</b>{{ g.code }}</span>
                  <span class="meta"><b>产品类型：</b>{{ g.type }}</span>
                  <span class="meta"><b>店铺/站点：</b>{{ g.shopSite }} <span class="badge">{{ g.badge }}</span></span>
                </div>
              </td>
            </tr>

            <!-- 默认展开前 5 个变体 -->
            <tr
              v-for="(v, vi) in (g.expanded ? g.variants : g.variants.slice(0, 5))"
              :key="v.id"
              class="row-variant"
            >
              <td class="col-sel"><n-checkbox /></td>
              <td class="col-img">
                <img
                  v-if="v.thumb && v.thumb.startsWith('http')"
                  class="thumb-img"
                  :src="v.thumb"
                  :alt="v.msku"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
                <div v-else class="thumb" :style="{ background: v.thumb }"></div>
              </td>
              <td class="col-status">
                <span class="status-chip">{{ v.status }}</span>
              </td>
              <td class="col-pid">{{ v.platformId }}</td>
              <td class="col-msku">{{ v.msku || '-' }}</td>
              <td class="col-price">{{ v.declaredPrice ? '$' + v.declaredPrice.toFixed(2) : '-' }}</td>
              <td class="col-price">{{ v.activityPrice ? '$' + v.activityPrice.toFixed(2) : '-' }}</td>
              <td class="col-name">{{ v.sku || '-' }}</td>
              <td class="col-attr">[{{ v.attr }}]</td>
              <td class="col-stock" :class="v.stock === 0 ? 'stock-zero' : ''">{{ v.stock }}</td>
              <td class="col-time">
                <div><span class="muted">上架：</span>{{ v.listedAt }}</div>
                <div><span class="muted">更新：</span>{{ v.updatedAt }}</div>
              </td>
              <td class="col-op">
                <a class="op-link">配对</a>
                <button class="op-more">⋯</button>
              </td>
            </tr>

            <tr v-if="g.variants.length > 5 && !g.expanded" class="row-expand">
              <td colspan="12">
                <a class="expand-link" @click="g.expanded = true">
                  展开更多商品（{{ g.variants.length - 5 }}）<span class="expand-caret">⌄</span>
                </a>
              </td>
            </tr>
            <tr v-else-if="g.variants.length > 5 && g.expanded" class="row-expand">
              <td colspan="12">
                <a class="expand-link" @click="g.expanded = false">
                  收起<span class="expand-caret rot">⌄</span>
                </a>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="paging">
      <span class="muted">已选 0 条</span>
      <div style="flex:1"></div>
      <span class="muted">共 1235 条</span>
      <n-pagination v-model:page="page" :page-count="62" :page-size="20" size="small" show-quick-jumper />
      <n-select size="small" v-model:value="pageSize" :options="pageSizeOpts" style="width: 90px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  NButton, NButtonGroup, NCheckbox, NInput, NSelect, NPagination,
} from 'naive-ui';
import { temuApi } from '@/api-client/temu.api';
import { useShopsStore } from '@/stores/shops';

const storeType = ref<'cross' | 'local'>('cross');
const site = ref<string | null>(null);
const shop = ref<string | null>(null);
const apiError = ref<string | null>(null);
const loading = ref(false);
const total = ref(0);
const usingMock = ref(true);

const shopsStore = useShopsStore();
onMounted(async () => {
  try {
    if (!shopsStore.items.length) await shopsStore.fetch();
  } catch { /* offline / demo */ }
  if (!shop.value) {
    const firstTemu = shopsStore.items.find((s) => s.platform === 'temu' && s.status === 'active');
    if (firstTemu) shop.value = firstTemu.id;
  }
});

const shopOptsLive = computed(() => {
  return shopsStore.items
    .filter((s) => s.platform === 'temu')
    .map((s) => ({
      label: `${s.displayName || s.platformShopId}（${s.shopType === 'full' ? '全托管' : '半托管'} / ${s.region.toUpperCase()}）`,
      value: s.id,
    }));
});
const status = ref<string | null>(null);
const tag = ref<string[]>([]);
const type = ref<string | null>(null);
const owner = ref<string | null>(null);
const pair = ref<string | null>(null);
const parent = ref<string | null>(null);
const page = ref(1);
const pageSize = ref(20);

const siteOpts = [
  { label: 'US (美国)', value: 'us' }, { label: 'DE (德国)', value: 'de' },
  { label: 'UK (英国)', value: 'uk' }, { label: 'FR (法国)', value: 'fr' },
  { label: 'JP (日本)', value: 'jp' }, { label: 'MX (墨西哥)', value: 'mx' },
];
const shopOpts = computed(() => shopOptsLive.value.length > 0
  ? shopOptsLive.value
  : [
      { label: '跨境-美区主店（演示）', value: 's1' },
      { label: '跨境-欧区主店（演示）', value: 's2' },
      { label: '跨境-日区店（演示）', value: 's3' },
    ]);
const statusOpts = [
  { label: '在售', value: 'active' }, { label: '审核中', value: 'review' },
  { label: '驳回', value: 'reject' }, { label: '已下架', value: 'offline' },
  { label: '缺货', value: 'short' }, { label: '草稿', value: 'draft' },
];
const tagOpts = [
  { label: '新品', value: 'new' }, { label: '热销', value: 'hot' },
  { label: '清仓', value: 'clear' }, { label: '滞销', value: 'dead' },
  { label: '主推', value: 'main' },
];
const typeOpts = [
  { label: 'VMI 模式', value: 'vmi' },
  { label: '极速备货', value: 'fast' },
  { label: '本土店', value: 'local' },
  { label: '半托管', value: 'semi' },
];
const ownerOpts = [
  { label: '张运营', value: 'u1' },
  { label: '李运营', value: 'u2' },
  { label: '王采购', value: 'u3' },
];
const pairOpts = [
  { label: '已配对', value: 'paired' },
  { label: '未配对', value: 'unpaired' },
  { label: '配对异常', value: 'error' },
];
const parentOpts = [
  { label: '有父体', value: 'yes' },
  { label: '无父体', value: 'no' },
];
const pageSizeOpts = [
  { label: '20条/页', value: 20 },
  { label: '50条/页', value: 50 },
  { label: '100条/页', value: 100 },
];

function reset() {
  site.value = null; shop.value = null; status.value = null;
  tag.value = []; type.value = null; owner.value = null;
  pair.value = null; parent.value = null;
}

interface Variant {
  id: string;
  thumb: string;
  status: string;
  platformId: string;
  msku: string;
  declaredPrice: number | null;
  activityPrice: number | null;
  sku: string;
  attr: string;
  stock: number;
  listedAt: string;
  updatedAt: string;
}
interface Group {
  spuId: string;
  skc: string;
  code: string;
  type: string;
  shopSite: string;
  badge: string;
  title: string;
  expanded: boolean;
  variants: Variant[];
}

const thumbs = ['#fbbf24', '#6366f1', '#22c55e', '#3b82f6', '#10b981', '#f97316', '#ec4899', '#a78bfa', '#06b6d4', '#84cc16'];
const attrs = ['Black', 'White', 'Bronze', 'Gold', 'Silver', 'Black with comb', 'Gold with comb', 'Red', 'Blue', 'Green'];

function makeVariants(prefix: string, count: number, listedAt: string, updatedAt: string): Variant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    thumb: thumbs[i % thumbs.length],
    status: '平台核价',
    platformId: String(60000000000 + (Math.abs(prefix.charCodeAt(0)) * 7919 + i * 137) % 90000000000),
    msku: i === 0 ? '-' : `${prefix}-${attrs[i % attrs.length].slice(0, 2).toUpperCase()}`,
    declaredPrice: null,
    activityPrice: null,
    sku: i === 0 ? '-' : `${prefix}-${i}`,
    attr: attrs[i % attrs.length],
    stock: 0,
    listedAt,
    updatedAt,
  }));
}

const mockGroups: Group[] = [
  {
    spuId: '7058851921',
    skc: '65487656263',
    code: 'T-WZ-T9',
    type: 'VMI模式',
    shopSite: '跨境-美区主店 / US',
    badge: 'US',
    title: '便携多功能收纳套装，多色可选，居家旅行通用（演示标题）',
    expanded: false,
    variants: makeVariants('T-WZ-T9', 11, '2026-05-15 05:38:01', '2026-05-15 20:51:09'),
  },
  {
    spuId: '3391209728',
    skc: '60764706060',
    code: 'T-HM-K3',
    type: 'VMI模式',
    shopSite: '跨境-美区主店 / US',
    badge: 'US',
    title: '不锈钢厨房工具组合 5 件套，磨砂手柄（演示标题）',
    expanded: false,
    variants: makeVariants('T-HM-K3', 6, '2026-05-15 05:38:52', '2026-05-15 20:51:09'),
  },
  {
    spuId: '4582109377',
    skc: '53219088421',
    code: 'T-SP-Y2',
    type: 'VMI模式',
    shopSite: '跨境-欧区主店 / DE',
    badge: 'DE',
    title: '便携运动腰包，反光夜跑款（演示标题）',
    expanded: false,
    variants: makeVariants('T-SP-Y2', 8, '2026-05-14 18:22:10', '2026-05-15 19:31:14'),
  },
  {
    spuId: '6920183054',
    skc: '47102566188',
    code: 'T-3C-B1',
    type: '半托管',
    shopSite: '跨境-欧区主店 / UK',
    badge: 'UK',
    title: '蓝牙音箱 IP67 防水款，户外多色（演示标题）',
    expanded: false,
    variants: makeVariants('T-3C-B1', 5, '2026-05-13 11:08:00', '2026-05-15 17:42:50'),
  },
  {
    spuId: '8801432091',
    skc: '39084217766',
    code: 'T-PT-F4',
    type: '极速备货',
    shopSite: '跨境-日区店 / JP',
    badge: 'JP',
    title: '宠物自动喂食器 4L 大容量（演示标题）',
    expanded: false,
    variants: makeVariants('T-PT-F4', 4, '2026-05-12 09:45:18', '2026-05-15 13:11:02'),
  },
];

const apiGroups = ref<Group[]>([]);
const groups = computed<Group[]>(() => (usingMock.value ? mockGroups : apiGroups.value));

function fmt(ts: number): string {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  return d.toLocaleString('zh-CN', { hour12: false });
}

function jitModeToLabel(m: 'jit' | 'semi' | 'normal' | null): string {
  if (m === 'jit') return 'JIT 备货';
  if (m === 'semi') return '半托管';
  return 'VMI模式';
}

let abortRef: AbortController | null = null;
async function fetchFromApi() {
  if (!shop.value) return;
  const isDbShop = shopOptsLive.value.some((o) => o.value === shop.value);
  if (!isDbShop) {
    usingMock.value = true;
    return;
  }

  abortRef?.abort();
  const ac = new AbortController();
  abortRef = ac;

  loading.value = true;
  apiError.value = null;
  try {
    const res = await temuApi.listGoods(
      {
        shopId: shop.value!,
        page: page.value,
        pageSize: pageSize.value,
      },
      ac.signal,
    );
    if (ac.signal.aborted) return;
    total.value = res.total;
    apiGroups.value = res.groups.map<Group>((g) => {
      const site0 = g.bindSites[0];
      const statusText = g.lifecycleStatusLabel || (g.skcSiteStatus === 1 ? '已上架' : g.skcSiteStatus === 0 ? '待上架' : '平台核价');
      const variants: Variant[] = g.variants.length
        ? g.variants.map((v, i) => ({
            id: `${g.productId}-${v.productSkuId || i}`,
            thumb: g.mainImageUrl || thumbs[i % thumbs.length],
            status: statusText,
            platformId: String(v.productSkuId || '-'),
            msku: v.msku || '-',
            declaredPrice: null,
            activityPrice: null,
            sku: v.msku || `${g.extCode || g.productId}-${i}`,
            attr: v.attr || '-',
            stock: v.virtualStock,
            listedAt: fmt(g.createdAt),
            updatedAt: fmt(g.createdAt),
          }))
        : makeVariants(g.extCode || String(g.productId), 1, fmt(g.createdAt), fmt(g.createdAt));

      const shopLabel = shopOptsLive.value.find((o) => o.value === shop.value)?.label ?? '-';
      return {
        spuId: String(g.productId),
        skc: g.productSkcId ? String(g.productSkcId) : (g.extCode || String(g.productId)),
        code: g.extCode || '-',
        type: jitModeToLabel(g.jitMode),
        shopSite: `${shopLabel} / ${site0?.siteName || '-'}`,
        badge: site0?.siteName || '-',
        title: g.productName || '(无标题)',
        expanded: false,
        variants,
      };
    });
    usingMock.value = false;
  } catch (e: any) {
    if (e?.name === 'AbortError') return;
    apiError.value = e?.message ?? String(e);
    usingMock.value = true;
  } finally {
    if (abortRef === ac) {
      loading.value = false;
      abortRef = null;
    }
  }
}

watch([shop, page, pageSize], () => {
  fetchFromApi();
}, { immediate: true });
</script>

<style scoped>
.temu-page {
  background: #f5f7fa;
  min-height: 100%;
}

/* ---- 通告条 ---- */
.notice-bar {
  background: #fff7ed;
  border-bottom: 1px solid #fed7aa;
  padding: 8px 16px;
  font-size: 12px;
  color: #9a3412;
  display: flex;
  align-items: center;
  gap: 8px;
}
.notice-icon {
  color: #f59e0b;
  font-size: 13px;
}

/* ---- 筛选区 ---- */
.filter-section {
  background: #fff;
  padding: 10px 16px;
  border-bottom: 1px solid #eef0f4;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.store-tabs {
  display: inline-flex;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  overflow: hidden;
  margin-right: 4px;
}
.store-tab {
  border: 0;
  background: #fff;
  padding: 4px 14px;
  font-size: 13px;
  color: #4b5563;
  cursor: pointer;
}
.store-tab.active {
  background: #4f64f6;
  color: #fff;
}

/* ---- 工具栏 ---- */
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  padding: 10px 16px;
  border-bottom: 1px solid #eef0f4;
  flex-wrap: wrap;
}
.icon-btn {
  background: none;
  border: 0;
  width: 28px; height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: #6b7280;
  font-size: 14px;
}
.icon-btn:hover { background: #f3f4f6; color: #1f2937; }

/* ---- 表格 ---- */
.table-wrap {
  background: #fff;
  margin: 0 0 0;
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 1300px;
}
.data-table thead {
  background: #f9fafb;
}
.data-table th {
  padding: 8px 10px;
  text-align: left;
  font-weight: 500;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.th-sort, .th-help {
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
  margin-left: 2px;
}
.data-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f0f2f5;
  vertical-align: middle;
  white-space: nowrap;
}

.col-sel { width: 36px; padding-left: 16px !important; }
.col-img { width: 60px; }
.col-status { width: 90px; }
.col-pid { width: 130px; }
.col-msku { width: 140px; }
.col-price { width: 110px; text-align: right; }
.col-name { width: 120px; }
.col-attr { width: 140px; color: #6b7280; }
.col-stock { width: 70px; text-align: right; font-weight: 600; }
.col-stock.stock-zero { color: #d97706; }
.col-time { width: 180px; font-size: 11px; color: #4b5563; }
.col-op { width: 90px; text-align: right; padding-right: 16px !important; }

.muted { color: #9ca3af; }

/* 父行 */
.row-parent {
  background: #f8fafc;
}
.row-parent td {
  border-bottom: 1px solid #eef0f4;
  padding: 8px 10px;
}
.parent-info {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  font-size: 12px;
  color: #374151;
}
.parent-info .meta b {
  font-weight: 500;
  color: #6b7280;
}
.parent-info .title {
  color: #1f2937;
  font-weight: 500;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}
.badge {
  display: inline-block;
  background: #f3f4f6;
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 10px;
  color: #4b5563;
  margin-left: 4px;
}

/* 变体行 */
.row-variant td { background: #fff; }
.thumb {
  width: 36px; height: 36px;
  border-radius: 4px;
  display: inline-block;
  background-image: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent);
}
.thumb-img {
  width: 36px; height: 36px;
  border-radius: 4px;
  object-fit: cover;
  display: block;
  background: #f3f4f6;
}
.status-chip {
  display: inline-block;
  background: #f3f4f6;
  color: #6b7280;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

.op-link {
  color: #4f64f6;
  cursor: pointer;
  font-size: 12px;
  margin-right: 6px;
}
.op-more {
  border: 0;
  background: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 14px;
}
.op-more:hover { background: #f3f4f6; color: #1f2937; }

/* 展开行 */
.row-expand td {
  background: #fcfcfd;
  padding: 6px 16px;
  border-bottom: 1px solid #eef0f4;
}
.expand-link {
  color: #4f64f6;
  cursor: pointer;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.expand-caret {
  display: inline-block;
  transition: transform 0.2s;
}
.expand-caret.rot { transform: rotate(180deg); }

/* 分页 */
.paging {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #fff;
  border-top: 1px solid #eef0f4;
  font-size: 12px;
}
</style>
