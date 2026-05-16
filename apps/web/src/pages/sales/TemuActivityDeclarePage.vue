<template>
  <div class="act-page">
    <!-- 顶部黄色通告 -->
    <div class="notice-bar">
      <span class="notice-text">
        因系统升级，请先下载最新插件（版本号需在 1.091 及以上），否则申报活动时将无法正确完成申报。
      </span>
      <button class="notice-close" title="关闭">×</button>
    </div>

    <!-- 托管类型 Tab -->
    <div class="custody-tabs">
      <button
        class="custody-tab"
        :class="{ active: custody === 'semi' }"
        @click="custody = 'semi'"
      >半托跨境</button>
      <button
        class="custody-tab"
        :class="{ active: custody === 'full' }"
        @click="custody = 'full'"
      >全托跨境</button>
    </div>

    <!-- 筛选条 -->
    <div class="filter-row">
      <n-select size="small" placeholder="全部站点" :options="siteOpts" v-model:value="site" clearable style="width: 120px" />
      <n-select size="small" placeholder="全部店铺" :options="shopOpts" v-model:value="shop" clearable style="width: 130px" />
      <n-select size="small" placeholder="活动类型" :options="actTypeOpts" v-model:value="actType" clearable style="width: 130px" />
      <n-select size="small" placeholder="活动时间" :options="actTimeOpts" v-model:value="actTime" clearable style="width: 130px" />
      <n-date-picker size="small" type="daterange" clearable :default-value="null" style="width: 250px"
        :placeholder="['开始时间', '结束时间'] as any" />
      <n-select size="small" :options="skuKeyOpts" v-model:value="skuKey" style="width: 90px" />
      <div class="search-input-wrap">
        <span class="search-icon-left">⊞</span>
        <n-input size="small" placeholder="请输入活动名称" clearable style="width: 200px"
          v-model:value="search" @keyup.enter="() => { page = 1; load(); }" />
        <button class="search-btn" @click="() => { page = 1; load(); }">🔍</button>
      </div>
      <button class="filter-icon-btn" title="高级筛选">▽</button>
      <button class="reset-link" @click="reset">重置</button>
    </div>

    <!-- 工具栏（action bar） -->
    <div class="action-bar">
      <n-button type="primary" size="small">申报</n-button>
      <n-button size="small" @click="$router.push('/sales/temu-activity/history')">申报记录</n-button>
      <n-button size="small" @click="syncNow">同步数据</n-button>
      <div style="flex:1"></div>
      <span v-if="loading" class="muted">加载中…</span>
      <span v-else-if="error" class="err-text" :title="error">! 加载失败</span>
      <button class="hour-glass-btn" title="同步进度">⌛</button>
      <button class="icon-btn" title="刷新" @click="load">↻</button>
      <button class="icon-btn" title="帮助">?</button>
    </div>

    <!-- 数据表 -->
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-sel">
              <n-checkbox />
              <span class="col-caret">▾</span>
            </th>
            <th class="col-info">商品信息</th>
            <th class="col-skc">SKC/货号</th>
            <th class="col-msku">MSKU/属性</th>
            <th class="col-price">活动申报价/折扣</th>
            <th class="col-stock">场次共用活动库存</th>
            <th class="col-op">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="rows.length">
            <tr v-for="r in rows" :key="r.id" class="row">
              <td class="col-sel"><n-checkbox /></td>
              <td class="col-info">
                <div class="info-wrap">
                  <div class="thumb" :style="{ background: r.color }">{{ r.cat[0] }}</div>
                  <div class="info-text">
                    <div class="info-title" :title="r.title">{{ r.title }}</div>
                    <div class="info-meta">
                      <span class="meta-pill">{{ r.shop }}</span>
                      <span class="meta-divider">·</span>
                      <span class="meta-text">{{ r.site }}</span>
                      <span class="meta-divider">·</span>
                      <span class="meta-text">{{ r.actType }}</span>
                    </div>
                    <div class="info-time">活动时段 {{ r.actWindow }}</div>
                  </div>
                </div>
              </td>
              <td class="col-skc">
                <div>{{ r.skcId }}</div>
                <div class="td-sub">{{ r.skcExt }}</div>
              </td>
              <td class="col-msku">
                <div v-if="!r.variants.length" class="muted">—</div>
                <div v-for="v in r.variants" :key="v.msku" class="variant-row">
                  <span class="msku">{{ v.msku }}</span>
                  <span class="attr">[{{ v.attr }}]</span>
                </div>
              </td>
              <td class="col-price">
                <div v-if="!r.variants.length" class="muted right-text">—</div>
                <div v-for="v in r.variants" :key="v.msku + '-p'" class="variant-row right">
                  <span class="new-price">US$ {{ v.declarePrice.toFixed(2) }}</span>
                  <span class="discount">{{ v.discount }}折</span>
                </div>
              </td>
              <td class="col-stock">
                <div v-if="!r.variants.length" class="muted right-text">—</div>
                <div v-for="v in r.variants" :key="v.msku + '-s'" class="variant-row right">
                  <span :class="v.stock === 0 ? 'stock-zero' : ''">{{ v.stock }}</span>
                </div>
              </td>
              <td class="col-op">
                <a class="op-link">编辑</a>
                <span class="op-sep">|</span>
                <a class="op-link">提交</a>
                <button class="op-more">⋯</button>
              </td>
            </tr>
          </template>
          <tr v-else class="empty-row">
            <td colspan="7">
              <div class="empty-state">
                <div class="empty-illust">📦</div>
                <div class="empty-text">暂无数据</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="paging">
      <span class="muted">已选 0 条</span>
      <div style="flex:1"></div>
      <span class="muted">共 {{ total }} 条</span>
      <n-pagination v-model:page="page" :page-count="Math.max(1, Math.ceil(total / pageSize))" :page-size="pageSize" size="small" />
      <n-select size="small" v-model:value="pageSize" :options="pageSizeOpts" style="width: 90px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import {
  NButton, NCheckbox, NDatePicker, NInput, NPagination, NSelect,
} from 'naive-ui';
import { activitiesApi, type Activity } from '@/api-client/activities.api';

const custody = ref<'semi' | 'full'>('full');
const site = ref<string | null>(null);
const shop = ref<string | null>(null);
const actType = ref<string | null>(null);
const actTime = ref<string | null>(null);
const skuKey = ref<string>('SKC');
const search = ref<string>('');
const page = ref(1);
const pageSize = ref(20);

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<Activity[]>([]);
const total = ref(0);

const siteOpts = [
  { label: 'US', value: 'us' }, { label: 'DE', value: 'de' }, { label: 'UK', value: 'uk' },
  { label: 'FR', value: 'fr' }, { label: 'JP', value: 'jp' }, { label: 'MX', value: 'mx' },
];
const shopOpts = computed(() => custody.value === 'full' ? [
  { label: '全托-美区主店', value: 'full-us' },
  { label: '全托-欧区主店', value: 'full-eu' },
  { label: '全托-日区店', value: 'full-jp' },
] : [
  { label: '半托-美区店', value: 'semi-us' },
  { label: '半托-欧区店', value: 'semi-eu' },
]);
const actTypeOpts = [
  { label: '日常折扣', value: 'daily' },
  { label: '限时秒杀', value: 'flash' },
  { label: '主题日活动', value: 'theme' },
  { label: '清仓特卖', value: 'clear' },
  { label: '新人折扣', value: 'newcomer' },
  { label: '满减券', value: 'coupon' },
];
const actTimeOpts = [
  { label: '今日', value: 'today' },
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '上月', value: 'lm' },
];
const skuKeyOpts = [
  { label: 'SKC', value: 'SKC' },
  { label: 'SPU', value: 'SPU' },
  { label: 'MSKU', value: 'MSKU' },
];
const pageSizeOpts = [
  { label: '20条/页', value: 20 },
  { label: '50条/页', value: 50 },
  { label: '100条/页', value: 100 },
];

function reset() {
  site.value = null; shop.value = null; actType.value = null; actTime.value = null;
  search.value = '';
  page.value = 1;
  load();
}

interface Variant { msku: string; attr: string; declarePrice: number; discount: number; stock: number }
interface Row {
  id: string;
  skcId: string;
  skcExt: string;
  title: string;
  cat: string;
  color: string;
  shop: string;
  site: string;
  actType: string;
  actWindow: string;
  variants: Variant[];
}

// 从 activityType 推断分类色块,真正的分类需后端补字段
const TYPE_PALETTE: Record<string, { cat: string; color: string }> = {
  '限时秒杀': { cat: '秒杀', color: '#ef4444' },
  '日常折扣': { cat: '日常', color: '#6366f1' },
  '主题日活动': { cat: '主题', color: '#a855f7' },
  '清仓': { cat: '清仓', color: '#f97316' },
  '清仓特卖': { cat: '清仓', color: '#f97316' },
  '新人折扣': { cat: '新人', color: '#22c55e' },
  '满减券': { cat: '满减', color: '#0ea5e9' },
};

function pickPalette(actType: string | null) {
  return (actType && TYPE_PALETTE[actType]) || { cat: 'AC', color: '#94a3b8' };
}

function fmtRange(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  const fmt = (s: string | null) => s ? s.replace('T', ' ').replace('Z', '').slice(0, 16) : '—';
  return `${fmt(start)} ~ ${fmt(end)}`;
}

function mapActivityToRow(a: Activity): Row {
  const p = pickPalette(a.activityType);
  return {
    id: a.id,
    skcId: a.platformActivityId,
    skcExt: (a.region || '').toUpperCase(),
    title: a.title || '(未命名活动)',
    cat: p.cat,
    color: p.color,
    shop: `${a.shopCount} 店可见 / ${a.enrolledShopCount} 店已申报`,
    site: (a.region || '').toUpperCase(),
    actType: a.activityType || '—',
    actWindow: fmtRange(a.startAt, a.endAt),
    variants: [],
  };
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const r = await activitiesApi.list({
      status: 'open',
      search: search.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    items.value = r.items;
    total.value = r.total;
  } catch (e: any) {
    error.value = e?.message || String(e);
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

async function syncNow() {
  try {
    await activitiesApi.syncNow();
  } catch (e: any) {
    error.value = e?.message || String(e);
  }
}

onMounted(load);
watch([page, pageSize], () => { load(); });

// 旧演示数据保留作 fallback,目前仅在 API 返回为空且 NEXT_PUBLIC_DEMO=1 时使用(默认不用)
const demoRowsLegacy: Row[] = [
  {
    id: '1',
    skcId: '53310794998',
    skcExt: 'T-WZ-T9',
    title: '便携多功能收纳套装 6 件套，多色可选（演示标题）',
    cat: '家居',
    color: '#fbbf24',
    shop: '全托-美区主店',
    site: 'US',
    actType: '限时秒杀',
    actWindow: '2026-05-18 10:00 ~ 2026-05-18 22:00',
    variants: [
      { msku: 'T-WZ-T9-BK', attr: 'Black', declarePrice: 9.80, discount: 7, stock: 480 },
      { msku: 'T-WZ-T9-GD', attr: 'Gold', declarePrice: 9.80, discount: 7, stock: 320 },
      { msku: 'T-WZ-T9-BZ', attr: 'Bronze', declarePrice: 9.80, discount: 7, stock: 0 },
    ],
  },
  {
    id: '2',
    skcId: '60764706060',
    skcExt: 'T-HM-K3',
    title: '不锈钢厨房工具组合 5 件套（演示标题）',
    cat: '家居',
    color: '#6366f1',
    shop: '全托-美区主店',
    site: 'US',
    actType: '日常折扣',
    actWindow: '2026-05-15 00:00 ~ 2026-05-21 23:59',
    variants: [
      { msku: 'T-HM-K3-S', attr: 'Silver', declarePrice: 14.20, discount: 8, stock: 240 },
      { msku: 'T-HM-K3-B', attr: 'Black', declarePrice: 14.20, discount: 8, stock: 180 },
    ],
  },
  {
    id: '3',
    skcId: '53219088421',
    skcExt: 'T-SP-Y2',
    title: '便携运动腰包 反光夜跑款（演示标题）',
    cat: '运动',
    color: '#22c55e',
    shop: '全托-欧区主店',
    site: 'DE',
    actType: '清仓特卖',
    actWindow: '2026-05-16 12:00 ~ 2026-05-23 12:00',
    variants: [
      { msku: 'T-SP-Y2-R', attr: 'Red', declarePrice: 6.40, discount: 5, stock: 96 },
    ],
  },
];

// 不再使用旧演示数据;custody Tab 暂作 UI 切换,API 还没有 custody/region 维度过滤
void demoRowsLegacy; // 保留引用避免 dead-code 警告
const rows = computed<Row[]>(() => items.value.map(mapActivityToRow));
</script>

<style scoped>
.act-page {
  background: #f5f7fa;
  min-height: 100%;
}

/* ---- 通告 ---- */
.notice-bar {
  background: #fff7ed;
  border-bottom: 1px solid #fed7aa;
  padding: 9px 16px;
  font-size: 12px;
  color: #9a3412;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.notice-text { line-height: 1.5; }
.notice-close {
  background: none;
  border: 0;
  color: #9a3412;
  cursor: pointer;
  font-size: 18px;
  width: 24px;
  height: 24px;
}

/* ---- 托管 Tab ---- */
.custody-tabs {
  background: #fff;
  padding: 10px 16px 0;
  display: flex;
  gap: 24px;
  border-bottom: 1px solid #eef0f4;
}
.custody-tab {
  border: 0;
  background: none;
  padding: 8px 0;
  font-size: 14px;
  color: #4b5563;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.custody-tab.active {
  color: #f0b429;
  border-bottom-color: #f0b429;
  font-weight: 600;
}

/* ---- 筛选 ---- */
.filter-row {
  background: #fff;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  border-bottom: 1px solid #eef0f4;
}
.search-input-wrap {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  overflow: hidden;
  height: 28px;
}
.search-icon-left {
  background: #f3f4f6;
  border-right: 1px solid #d1d5db;
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  color: #6b7280;
  font-size: 12px;
}
.search-input-wrap :deep(.n-input) {
  --n-border: none !important;
}
.search-btn {
  background: #f3f4f6;
  border: 0;
  border-left: 1px solid #d1d5db;
  width: 32px;
  cursor: pointer;
  color: #6b7280;
}
.filter-icon-btn {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: #6b7280;
}
.reset-link {
  background: none;
  border: 0;
  color: #4f64f6;
  cursor: pointer;
  font-size: 13px;
  text-decoration: underline;
}

/* ---- 工具栏 ---- */
.action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  padding: 10px 16px;
  border-bottom: 1px solid #eef0f4;
}
.hour-glass-btn, .icon-btn {
  background: none;
  border: 0;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: #6b7280;
  font-size: 13px;
}
.hour-glass-btn:hover, .icon-btn:hover { background: #f3f4f6; color: #1f2937; }

/* ---- 表格 ---- */
.table-wrap {
  background: #fff;
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 1100px;
}
.data-table thead {
  background: #f9fafb;
}
.data-table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 500;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.col-caret { color: #9ca3af; font-size: 10px; margin-left: 4px; }
.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f2f5;
  vertical-align: top;
}

.col-sel { width: 50px; padding-left: 16px !important; }
.col-info { min-width: 320px; }
.col-skc { width: 160px; }
.col-msku { width: 200px; }
.col-price { width: 180px; text-align: right; }
.col-stock { width: 140px; text-align: right; }
.col-op { width: 110px; text-align: right; padding-right: 16px !important; }

.row td { vertical-align: middle; }

.info-wrap {
  display: flex;
  gap: 10px;
}
.thumb {
  width: 48px; height: 48px;
  border-radius: 4px;
  color: #fff;
  font-weight: 600;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.info-text { min-width: 0; flex: 1; }
.info-title {
  color: #1f2937;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.info-meta {
  margin-top: 4px;
  font-size: 11px;
  color: #6b7280;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.meta-pill {
  background: #eef2ff;
  color: #4f64f6;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
}
.meta-divider { color: #d1d5db; }
.info-time {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

.td-sub { color: #9ca3af; font-size: 11px; margin-top: 2px; }

.variant-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}
.variant-row.right { justify-content: flex-end; }
.variant-row + .variant-row { border-top: 1px dashed #f0f2f5; }
.msku { color: #1f2937; }
.attr { color: #6b7280; }
.new-price { font-weight: 600; color: #d97706; }
.discount {
  background: #fef3c7;
  color: #b45309;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
}
.stock-zero { color: #d97706; font-weight: 500; }

.op-link {
  color: #4f64f6;
  cursor: pointer;
  font-size: 12px;
}
.op-sep { color: #dcdfe6; margin: 0 6px; font-size: 12px; }
.op-more {
  border: 0; background: none;
  color: #9ca3af;
  cursor: pointer;
  margin-left: 6px;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 14px;
}
.op-more:hover { background: #f3f4f6; color: #1f2937; }

/* 空状态 */
.empty-row td { padding: 0; }
.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #9ca3af;
}
.empty-illust { font-size: 48px; opacity: 0.4; }
.empty-text { font-size: 13px; margin-top: 8px; }

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
.muted { color: #9ca3af; }
.right-text { text-align: right; }
.err-text { color: #b91c1c; font-size: 12px; }
</style>
