<template>
  <div class="rec-page">
    <!-- 蓝色通告 -->
    <div class="notice-bar">
      <span class="notice-icon">ⓘ</span>
      <span class="notice-text">
        活动申报预计需要 10 分钟出报名结果，超时可以点击"同步数据"，获取最新报名结果。
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
      <n-date-picker size="small" type="daterange" clearable :default-value="null" style="width: 250px" />
      <n-select size="small" :options="skuKeyOpts" v-model:value="skuKey" style="width: 90px" />
      <div class="search-input-wrap">
        <span class="search-icon-left">⊞</span>
        <n-input size="small" placeholder="请输入 SKC/活动" clearable style="width: 200px"
          v-model:value="search" @keyup.enter="() => { page = 1; load(); }" />
        <button class="search-btn" @click="() => { page = 1; load(); }">🔍</button>
      </div>
      <button class="filter-icon-btn" title="高级筛选">▽</button>
      <button class="reset-link" @click="reset">重置</button>
    </div>

    <!-- 工具栏（只有 同步数据） -->
    <div class="action-bar">
      <n-button size="small" @click="syncNow">同步数据</n-button>
      <div style="flex:1"></div>
      <span v-if="loading" class="muted">加载中…</span>
      <span v-else-if="error" class="err-text" :title="error">! 加载失败</span>
      <button class="icon-btn" title="同步进度">⌛</button>
      <button class="icon-btn" title="刷新" @click="load">↻</button>
      <button class="icon-btn" title="帮助">?</button>
    </div>

    <!-- 数据表 -->
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-info">商品信息</th>
            <th class="col-skc">SKC/货号</th>
            <th class="col-rstat">报名状态</th>
            <th class="col-msku">MSKU/属性</th>
            <th class="col-acttype">活动类型</th>
            <th class="col-price">活动申报价/折扣</th>
            <th class="col-stock">场次共用活动库存</th>
            <th class="col-result">报名结果</th>
            <th class="col-time">申报时间 <span class="th-help">?</span></th>
            <th class="col-time">报名时间 <span class="th-help">?</span></th>
          </tr>
        </thead>
        <tbody>
          <template v-if="rows.length">
            <tr v-for="r in rows" :key="r.id">
              <td class="col-info">
                <div class="info-wrap">
                  <div class="thumb" :style="{ background: r.color }">{{ r.cat[0] }}</div>
                  <div class="info-text">
                    <div class="info-title" :title="r.title">{{ r.title }}</div>
                    <div class="info-meta">
                      <span class="meta-pill">{{ r.shop }}</span>
                      <span class="meta-divider">·</span>
                      <span class="meta-text">{{ r.site }}</span>
                    </div>
                    <div class="info-window">活动时段 {{ r.actWindow }}</div>
                  </div>
                </div>
              </td>
              <td class="col-skc">
                <div>{{ r.skcId }}</div>
                <div class="td-sub">{{ r.skcExt }}</div>
              </td>
              <td class="col-rstat">
                <span class="status-chip" :class="r.regStatusClass">{{ r.regStatus }}</span>
              </td>
              <td class="col-msku">
                <div v-for="v in r.variants" :key="v.msku" class="variant-row">
                  <span class="msku">{{ v.msku }}</span>
                  <span class="attr">[{{ v.attr }}]</span>
                </div>
              </td>
              <td class="col-acttype">{{ r.actType }}</td>
              <td class="col-price">
                <div v-for="v in r.variants" :key="v.msku + '-p'" class="variant-row right">
                  <span class="new-price">US$ {{ v.declarePrice.toFixed(2) }}</span>
                  <span class="discount">{{ v.discount }}折</span>
                </div>
              </td>
              <td class="col-stock">
                <div v-for="v in r.variants" :key="v.msku + '-s'" class="variant-row right">
                  <span :class="v.stock === 0 ? 'stock-zero' : ''">{{ v.stock }}</span>
                </div>
              </td>
              <td class="col-result">
                <div v-if="r.resultText" :class="['result-pill', r.resultClass]">
                  {{ r.resultText }}
                </div>
                <div v-else class="muted">—</div>
                <div v-if="r.resultReason" class="td-sub">{{ r.resultReason }}</div>
              </td>
              <td class="col-time td-sub-time">{{ r.declaredAt }}</td>
              <td class="col-time td-sub-time">{{ r.registeredAt || '—' }}</td>
            </tr>
          </template>
          <tr v-else class="empty-row">
            <td colspan="10">
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
      <div style="flex:1"></div>
      <span class="muted">共 {{ total }} 条</span>
      <n-pagination v-model:page="page" :page-count="Math.max(1, Math.ceil(total / pageSize))" :page-size="pageSize" size="small" />
      <n-select size="small" v-model:value="pageSize" :options="pageSizeOpts" style="width: 90px" />
      <span class="muted">前往</span>
      <n-input-number size="small" v-model:value="goto" :min="1" :max="Math.max(1, Math.ceil(total / pageSize))" style="width: 60px" :show-button="false" />
      <span class="muted">页</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import {
  NButton, NDatePicker, NInput, NInputNumber, NPagination, NSelect,
} from 'naive-ui';
import { enrollmentsApi, type Enrollment } from '@/api-client/enrollments.api';

const custody = ref<'semi' | 'full'>('semi');
const site = ref<string | null>(null);
const shop = ref<string | null>(null);
const actType = ref<string | null>(null);
const actTime = ref<string | null>(null);
const skuKey = ref<string>('SKC');
const search = ref<string>('');
const page = ref(1);
const pageSize = ref(20);
const goto = ref(1);

const loading = ref(false);
const error = ref<string | null>(null);
const items = ref<Enrollment[]>([]);
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
  regStatus: string;
  regStatusClass: string;
  resultText: string;
  resultClass: string;
  resultReason?: string;
  declaredAt: string;
  registeredAt: string;
}

// enrollment.status -> 中文显示 + chip class + 结果显示。
// 注:后端 AgentResultIngestor 当前会写出 'enrolled' (与 approved 同义);其它历史值映射保留。
function mapStatus(s: string) {
  switch (s) {
    case 'enrolled':
    case 'approved':  return { reg: '已通过', regClass: 'reg-running',   res: '报名成功', resClass: 'result-success' };
    case 'pending':
    case 'submitted': return { reg: '审核中', regClass: 'reg-reviewing', res: '',         resClass: '' };
    case 'rejected':  return { reg: '已驳回', regClass: 'reg-rejected',  res: '报名失败', resClass: 'result-fail' };
    case 'failed':    return { reg: '失败',   regClass: 'reg-rejected',  res: '报名失败', resClass: 'result-fail' };
    case 'withdrawn': return { reg: '已撤回', regClass: 'reg-done',      res: '',         resClass: '' };
    default:          return { reg: s || '—', regClass: 'reg-done',      res: '',         resClass: '' };
  }
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace('T', ' ').replace('Z', '').slice(0, 19);
}

function mapEnrollmentToRow(e: Enrollment): Row {
  const st = mapStatus(e.status);
  const dollars = e.activityPriceCents != null ? (e.activityPriceCents / 100) : 0;
  const reason =
    e.rejectReason
    || (e.error && typeof e.error === 'object' ? (e.error.message || JSON.stringify(e.error)) : null)
    || undefined;
  return {
    id: e.id,
    skcId: e.platformSkuId,
    skcExt: e.activity.platformActivityId,
    title: e.skuTitle || e.activity.title || '(未命名)',
    cat: 'EN',
    color: '#6366f1',
    shop: e.shop.displayName || e.shop.platformShopId,
    site: (e.activity.region || '').toUpperCase(),
    actType: '—', // enrollment 上没有 activityType 字段;若需要可后端 include
    actWindow: '—',
    variants: [{
      msku: e.platformSkuId,
      attr: e.currency || '',
      declarePrice: dollars,
      discount: 0,
      stock: 0,
    }],
    regStatus: st.reg,
    regStatusClass: st.regClass,
    resultText: st.res,
    resultClass: st.resClass,
    resultReason: reason,
    declaredAt: fmtDate(e.submittedAt),
    registeredAt: fmtDate(e.resolvedAt),
  };
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const r = await enrollmentsApi.list({
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
    await enrollmentsApi.syncNow();
  } catch (e: any) {
    error.value = e?.message || String(e);
  }
}

onMounted(load);
watch([page, pageSize], () => { load(); });

// 旧演示数据保留作 fallback,不再使用
const legacySemiRows: Row[] = [
  {
    id: '1',
    skcId: '47102566188',
    skcExt: 'T-3C-B1',
    title: '蓝牙音箱 IP67 防水款，户外多色（演示标题）',
    cat: '3C',
    color: '#6366f1',
    shop: '半托-美区店',
    site: 'US',
    actType: '限时秒杀',
    actWindow: '2026-05-12 20:00 ~ 2026-05-12 23:59',
    variants: [
      { msku: 'T-3C-B1-BK', attr: 'Black', declarePrice: 21.80, discount: 7, stock: 120 },
      { msku: 'T-3C-B1-BL', attr: 'Blue', declarePrice: 21.80, discount: 7, stock: 96 },
    ],
    regStatus: '已结束',
    regStatusClass: 'reg-done',
    resultText: '报名成功',
    resultClass: 'result-success',
    declaredAt: '2026-05-11 09:18:22',
    registeredAt: '2026-05-11 09:28:01',
  },
  {
    id: '2',
    skcId: '39084217766',
    skcExt: 'T-PT-F4',
    title: '宠物自动喂食器 4L 大容量（演示标题）',
    cat: '宠物',
    color: '#f97316',
    shop: '半托-欧区店',
    site: 'DE',
    actType: '日常折扣',
    actWindow: '2026-05-14 00:00 ~ 2026-05-20 23:59',
    variants: [
      { msku: 'T-PT-F4-S', attr: 'Small', declarePrice: 32.40, discount: 8, stock: 64 },
    ],
    regStatus: '进行中',
    regStatusClass: 'reg-running',
    resultText: '报名成功',
    resultClass: 'result-success',
    declaredAt: '2026-05-13 14:42:10',
    registeredAt: '2026-05-13 14:52:05',
  },
  {
    id: '3',
    skcId: '65487656263',
    skcExt: 'T-WZ-T9',
    title: '便携多功能收纳套装 6 件套（演示标题）',
    cat: '家居',
    color: '#fbbf24',
    shop: '半托-美区店',
    site: 'US',
    actType: '主题日活动',
    actWindow: '2026-05-15 10:00 ~ 2026-05-15 22:00',
    variants: [
      { msku: 'T-WZ-T9-BK', attr: 'Black', declarePrice: 9.80, discount: 7, stock: 0 },
      { msku: 'T-WZ-T9-GD', attr: 'Gold', declarePrice: 9.80, discount: 7, stock: 0 },
    ],
    regStatus: '已驳回',
    regStatusClass: 'reg-rejected',
    resultText: '报名失败',
    resultClass: 'result-fail',
    resultReason: '原因：库存不足，需备货后重新申报',
    declaredAt: '2026-05-14 21:18:55',
    registeredAt: '2026-05-14 21:28:30',
  },
  {
    id: '4',
    skcId: '53219088421',
    skcExt: 'T-SP-Y2',
    title: '便携运动腰包 反光夜跑款（演示标题）',
    cat: '运动',
    color: '#22c55e',
    shop: '半托-欧区店',
    site: 'UK',
    actType: '满减券',
    actWindow: '2026-05-17 09:00 ~ 2026-05-24 09:00',
    variants: [
      { msku: 'T-SP-Y2-R', attr: 'Red', declarePrice: 6.40, discount: 5, stock: 96 },
      { msku: 'T-SP-Y2-G', attr: 'Green', declarePrice: 6.40, discount: 5, stock: 78 },
    ],
    regStatus: '审核中',
    regStatusClass: 'reg-reviewing',
    resultText: '',
    resultClass: '',
    declaredAt: '2026-05-15 11:02:08',
    registeredAt: '',
  },
];

// 全托跨境历史
const fullRows: Row[] = [
  {
    id: 'f1',
    skcId: '53310794998',
    skcExt: 'T-WZ-T9',
    title: '便携多功能收纳套装 6 件套（演示标题）',
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
    regStatus: '待开始',
    regStatusClass: 'reg-pending',
    resultText: '报名成功',
    resultClass: 'result-success',
    declaredAt: '2026-05-15 16:08:11',
    registeredAt: '2026-05-15 16:17:43',
  },
];

void legacySemiRows; void fullRows; // legacy placeholders;不再使用,custody Tab 仅 UI
const rows = computed<Row[]>(() => items.value.map(mapEnrollmentToRow));
</script>

<style scoped>
.rec-page {
  background: #f5f7fa;
  min-height: 100%;
}

/* ---- 蓝色通告（info）---- */
.notice-bar {
  background: #eff6ff;
  border-bottom: 1px solid #bfdbfe;
  padding: 9px 16px;
  font-size: 12px;
  color: #1e40af;
  display: flex;
  align-items: center;
  gap: 8px;
}
.notice-icon { color: #3b82f6; font-size: 14px; }
.notice-text { flex: 1; line-height: 1.5; }
.notice-close {
  background: none;
  border: 0;
  color: #1e40af;
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
.icon-btn {
  background: none;
  border: 0;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  color: #6b7280;
  font-size: 13px;
}
.icon-btn:hover { background: #f3f4f6; color: #1f2937; }

/* ---- 表格 ---- */
.table-wrap {
  background: #fff;
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  min-width: 1400px;
}
.data-table thead {
  background: #fff;
}
.data-table th {
  padding: 12px 12px;
  text-align: left;
  font-weight: 500;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.th-help { color: #9ca3af; font-size: 11px; margin-left: 2px; cursor: pointer; }
.data-table td {
  padding: 12px 12px;
  border-bottom: 1px solid #f0f2f5;
  vertical-align: top;
}

.col-info { min-width: 320px; }
.col-skc { width: 150px; }
.col-rstat { width: 100px; }
.col-msku { width: 180px; }
.col-acttype { width: 110px; }
.col-price { width: 170px; text-align: right; }
.col-stock { width: 130px; text-align: right; }
.col-result { width: 180px; }
.col-time { width: 160px; }
.td-sub-time { font-size: 11px; color: #4b5563; }

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
.info-window {
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

/* 报名状态 chip */
.status-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}
.status-chip.reg-running { background: #dcfce7; color: #15803d; }
.status-chip.reg-pending { background: #eef2ff; color: #4f64f6; }
.status-chip.reg-reviewing { background: #fef3c7; color: #b45309; }
.status-chip.reg-rejected { background: #fee2e2; color: #b91c1c; }
.status-chip.reg-done { background: #f3f4f6; color: #6b7280; }

/* 报名结果 */
.result-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}
.result-pill.result-success {
  color: #15803d;
}
.result-pill.result-success::before {
  content: '✓';
  color: #15803d;
}
.result-pill.result-fail {
  color: #b91c1c;
}
.result-pill.result-fail::before {
  content: '✕';
  color: #b91c1c;
}
.muted { color: #9ca3af; }
.err-text { color: #b91c1c; font-size: 12px; }

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
</style>
