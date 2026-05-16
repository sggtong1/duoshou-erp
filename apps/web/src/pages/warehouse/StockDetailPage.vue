<template>
  <SellfoxPageShell title="库存明细">
    <template #actions>
      <n-button size="small">同步库存</n-button>
      <n-button size="small">导出</n-button>
      <n-button size="small">自定义列</n-button>
    </template>

    <template #filters>
      <n-input size="small" placeholder="搜索 SKU / 商品名 / 条码" clearable style="width: 260px" />
      <n-select size="small" placeholder="仓库" :options="warehouses" clearable style="width: 150px" />
      <n-select size="small" placeholder="分类" :options="categories" clearable style="width: 150px" />
      <n-select size="small" placeholder="库存状态" :options="stockStatusOpts" clearable style="width: 140px" />
      <n-button size="small" type="primary">查询</n-button>
      <n-button size="small">重置</n-button>
    </template>

    <template #kpis>
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">在仓 SKU</div>
          <div class="kpi-value">8,452</div>
          <div class="kpi-foot">较上周 <span class="up">+2.34%</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">在仓数量</div>
          <div class="kpi-value">126,540</div>
          <div class="kpi-foot">较上周 <span class="up">+5.62%</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">在途数量</div>
          <div class="kpi-value">22,800</div>
          <div class="kpi-foot">较上周 <span class="down">-3.21%</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">滞销 SKU</div>
          <div class="kpi-value warn">312</div>
          <div class="kpi-foot">需关注</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">库存货值(US$)</div>
          <div class="kpi-value">1,025,432.10</div>
          <div class="kpi-foot">含在途</div>
        </div>
      </div>
    </template>

    <div class="card">
      <div class="card-toolbar">
        <n-checkbox>仅看滞销</n-checkbox>
        <n-checkbox>仅看缺货预警</n-checkbox>
        <span class="muted">共 {{ rows.length }} 条 · 演示数据</span>
        <div style="flex:1"></div>
        <n-button-group size="small">
          <n-button>批量调整</n-button>
          <n-button>批量盘点</n-button>
          <n-button>批量导出</n-button>
        </n-button-group>
      </div>
      <n-data-table
        size="small"
        :columns="columns"
        :data="rows"
        :bordered="false"
        :pagination="pagination"
        :scroll-x="1300"
      />
    </div>

    <div class="row2">
      <div class="card2">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>库龄分布</div>
          <div class="muted">所有 SKU</div>
        </div>
        <div class="age-bars">
          <div v-for="b in ageBuckets" :key="b.label" class="age-bar-row">
            <span class="age-label">{{ b.label }}</span>
            <div class="age-track"><div class="age-fill" :style="{ width: b.pct + '%', background: b.color }"></div></div>
            <span class="age-val">{{ b.skuCount }} SKU</span>
            <span class="age-qty">{{ b.qty.toLocaleString() }} 件</span>
          </div>
        </div>
      </div>

      <div class="card2">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>库存周转趋势</div>
          <div class="card-tabs">
            <button class="tab active">近30天</button>
            <button class="tab">近90天</button>
          </div>
        </div>
        <svg viewBox="0 0 600 180" preserveAspectRatio="none" class="chart-svg">
          <polyline :points="turnoverLine" fill="none" stroke="#22c55e" stroke-width="2" />
          <polyline :points="inLine" fill="none" stroke="#4f64f6" stroke-width="2" stroke-dasharray="4,3" />
          <polyline :points="outLine" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,3" />
        </svg>
        <div class="legend">
          <span><i style="background:#22c55e"></i>周转天数</span>
          <span><i class="dashed" style="background:#4f64f6"></i>入库</span>
          <span><i class="dashed" style="background:#f59e0b"></i>出库</span>
        </div>
      </div>
    </div>

    <div class="row2">
      <div class="card2">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>各仓库分布</div>
          <div class="muted">数量 / 货值</div>
        </div>
        <table class="rank-table">
          <thead><tr><th>仓库</th><th class="r">SKU 数</th><th class="r">在仓数</th><th class="r">在途数</th><th class="r">货值(US$)</th></tr></thead>
          <tbody>
            <tr v-for="w in warehouseDist" :key="w.name">
              <td>{{ w.name }}</td>
              <td class="r">{{ w.skuCount.toLocaleString() }}</td>
              <td class="r">{{ w.inStock.toLocaleString() }}</td>
              <td class="r">{{ w.inTransit.toLocaleString() }}</td>
              <td class="r">{{ w.value.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card2">
        <div class="card-head">
          <div class="card-title"><span class="bar yellow"></span>预警 SKU</div>
          <a class="more">全部 ›</a>
        </div>
        <div class="alert-list">
          <div v-for="a in stockAlerts" :key="a.sku" class="alert-row" :class="`sev-${a.level}`">
            <span class="alert-tag">{{ a.tag }}</span>
            <span class="alert-text">{{ a.sku }} · {{ a.text }}</span>
            <span class="alert-time">{{ a.days }} 天可售</span>
          </div>
        </div>
      </div>
    </div>
  </SellfoxPageShell>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { NButton, NButtonGroup, NCheckbox, NDataTable, NInput, NSelect, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import SellfoxPageShell from '@/components/common/SellfoxPageShell.vue';

const warehouses = [
  { label: '深圳主仓', value: 'sz' },
  { label: '广州 FBT', value: 'gz-fbt' },
  { label: '美国海外仓', value: 'us' },
];
const categories = [
  { label: '家居', value: 'home' },
  { label: '3C', value: '3c' },
  { label: '服饰', value: 'apparel' },
];
const stockStatusOpts = [
  { label: '正常', value: 'normal' },
  { label: '滞销', value: 'dead' },
  { label: '缺货', value: 'short' },
];

interface Row {
  sku: string;
  name: string;
  category: string;
  warehouse: string;
  available: number;
  locked: number;
  inTransit: number;
  age: number;
  cost: number;
  status: 'normal' | 'dead' | 'short';
  updatedAt: string;
}

const rows = computed<Row[]>(() => {
  const cats = ['家居', '3C', '服饰', '美妆', '户外'];
  const whs = ['深圳主仓', '广州FBT', '美国海外仓'];
  return Array.from({ length: 12 }, (_, i) => ({
    sku: 'SKU-' + (10000 + i * 13 + 7),
    name: `演示商品 ${i + 1} - 多平台共用 SKU`,
    category: cats[i % cats.length],
    warehouse: whs[i % whs.length],
    available: 50 + ((i * 53) % 850),
    locked: (i * 7) % 50,
    inTransit: (i * 31) % 220,
    age: 1 + (i * 11) % 180,
    cost: Number(((i + 1) * 4.21).toFixed(2)),
    status: (['normal', 'dead', 'short'] as const)[i % 3 === 0 && i > 3 ? 1 : (i % 3 === 1 ? 2 : 0)],
    updatedAt: new Date(Date.now() - i * 5400_000).toLocaleString('zh-CN', { hour12: false }),
  }));
});

const columns: DataTableColumns<Row> = [
  { type: 'selection' },
  { title: 'SKU', key: 'sku', width: 130, fixed: 'left' },
  { title: '商品名', key: 'name', minWidth: 240 },
  { title: '分类', key: 'category', width: 90 },
  { title: '仓库', key: 'warehouse', width: 130 },
  { title: '可用', key: 'available', width: 80, align: 'right' },
  { title: '锁定', key: 'locked', width: 80, align: 'right' },
  { title: '在途', key: 'inTransit', width: 80, align: 'right' },
  { title: '库龄(天)', key: 'age', width: 90, align: 'right' },
  { title: '成本(US$)', key: 'cost', width: 100, align: 'right', render: (r) => r.cost.toFixed(2) },
  {
    title: '状态', key: 'status', width: 90,
    render(r) {
      const map = {
        normal: { type: 'success' as const, text: '正常' },
        dead: { type: 'warning' as const, text: '滞销' },
        short: { type: 'error' as const, text: '缺货' },
      };
      const m = map[r.status];
      return h(NTag, { type: m.type, size: 'small', round: true }, { default: () => m.text });
    },
  },
  { title: '更新时间', key: 'updatedAt', width: 170 },
  {
    title: '操作', key: 'op', width: 160, fixed: 'right',
    render() {
      return h('span', null, [
        h(NButton, { text: true, type: 'primary', size: 'tiny' }, { default: () => '调整' }),
        h('span', { style: 'color:#dcdfe6;margin:0 6px' }, '|'),
        h(NButton, { text: true, type: 'primary', size: 'tiny' }, { default: () => '流水' }),
        h('span', { style: 'color:#dcdfe6;margin:0 6px' }, '|'),
        h(NButton, { text: true, type: 'primary', size: 'tiny' }, { default: () => '盘点' }),
      ]);
    },
  },
];

const pagination = { pageSize: 10, showSizePicker: true, pageSizes: [10, 20, 50] };

const ageBuckets = [
  { label: '0-30 天', skuCount: 4820, qty: 86200, pct: 100, color: '#22c55e' },
  { label: '31-60 天', skuCount: 2140, qty: 32400, pct: 44, color: '#3b82f6' },
  { label: '61-90 天', skuCount: 980, qty: 12800, pct: 20, color: '#a78bfa' },
  { label: '91-180 天', skuCount: 412, qty: 4820, pct: 9, color: '#f59e0b' },
  { label: '>180 天 (滞销)', skuCount: 312, qty: 3120, pct: 6, color: '#ef4444' },
];

function buildTrendLine(seedVals: number[], scale: number) {
  return seedVals.map((v, i) => `${(i / (seedVals.length - 1)) * 600},${180 - v * scale}`).join(' ');
}
const turnoverLine = buildTrendLine([55, 52, 50, 48, 46, 47, 45, 44, 42, 40, 39, 38], 2.4);
const inLine = buildTrendLine([3200, 2800, 3400, 3600, 3100, 2900, 3300, 3500, 3700, 3400, 3800, 4000], 0.038);
const outLine = buildTrendLine([2900, 3100, 3200, 3300, 3400, 3600, 3500, 3700, 3800, 3600, 3900, 4100], 0.038);

const warehouseDist = [
  { name: '深圳主仓', skuCount: 4820, inStock: 52000, inTransit: 8200, value: 412500 },
  { name: '广州 FBT 仓', skuCount: 2140, inStock: 24800, inTransit: 6400, value: 218400 },
  { name: '美国海外仓', skuCount: 1620, inStock: 32500, inTransit: 5100, value: 286700 },
  { name: '德国海外仓', skuCount: 980, inStock: 18200, inTransit: 3200, value: 148200 },
  { name: '日本三方仓', skuCount: 420, inStock: 7400, inTransit: 1800, value: 62100 },
];

interface StockAlert { sku: string; tag: string; text: string; days: number; level: 'high' | 'mid' | 'low' }
const stockAlerts: StockAlert[] = [
  { sku: 'SKU-A1024', tag: '断货', text: '美国仓可用 0，待发货 56 单', days: 0, level: 'high' },
  { sku: 'SKU-B2034', tag: '低库存', text: 'TikTok 美区，建议补货 800', days: 4, level: 'high' },
  { sku: 'SKU-C3088', tag: '低库存', text: '德区 EU，建议补货 600', days: 6, level: 'mid' },
  { sku: 'SKU-D4156', tag: '滞销', text: '180+ 天无销量，建议清仓', days: 999, level: 'mid' },
  { sku: 'SKU-E5023', tag: '高周转', text: '周转 < 15 天，建议加大入仓', days: 12, level: 'low' },
  { sku: 'SKU-F6082', tag: '低库存', text: '日区 JP，建议补货 400', days: 9, level: 'mid' },
];
</script>

<style scoped>
.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  padding: 0 16px;
}
.kpi-card {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 6px;
  padding: 14px 16px;
}
.kpi-label { color: #6b7280; font-size: 12px; }
.kpi-value { font-size: 22px; font-weight: 700; color: #111827; margin: 6px 0 4px; }
.kpi-value.warn { color: #d97706; }
.kpi-foot { font-size: 12px; color: #9ca3af; }
.kpi-foot .up { color: #18a058; margin-left: 4px; }
.kpi-foot .down { color: #d03050; margin-left: 4px; }
.card {
  background: #fff;
  margin: 0 16px 16px;
  border: 1px solid #eef0f4;
  border-radius: 6px;
}
.card-toolbar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f2f5;
}
.muted { color: #9ca3af; font-size: 12px; }

.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0 16px 12px;
}
.card2 {
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 8px;
  padding: 12px 14px;
}
.card-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.card-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 600; color: #1f2937;
}
.bar { width: 4px; height: 14px; background: #4f64f6; border-radius: 2px; display: inline-block; }
.bar.yellow { background: #f59e0b; }
.card-tabs { display: flex; gap: 4px; }
.tab {
  font-size: 12px; padding: 4px 8px;
  border: 0; background: none; color: #6b7280;
  border-radius: 4px; cursor: pointer;
}
.tab.active { color: #4f64f6; background: #eef2ff; }
.more { color: #6b7280; font-size: 12px; cursor: pointer; }

.age-bars { padding: 4px 0; }
.age-bar-row {
  display: grid;
  grid-template-columns: 120px 1fr 100px 100px;
  align-items: center; gap: 10px;
  padding: 8px 0; font-size: 13px;
}
.age-label { color: #6b7280; }
.age-track { height: 12px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
.age-fill { height: 100%; }
.age-val, .age-qty { text-align: right; color: #4b5563; font-weight: 500; }
.age-qty { color: #9ca3af; font-size: 12px; }

.chart-svg { width: 100%; height: 180px; }
.legend {
  display: flex; gap: 14px; padding: 4px 0 0;
  font-size: 12px; color: #6b7280;
}
.legend i {
  display: inline-block;
  width: 14px; height: 2px;
  vertical-align: middle;
  margin-right: 4px;
}
.legend i.dashed {
  background: transparent;
  background-image: linear-gradient(to right, currentColor 50%, transparent 50%);
  background-size: 6px 100%;
}

.rank-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rank-table th, .rank-table td {
  padding: 8px 6px; text-align: left;
  border-bottom: 1px dashed #eef0f4;
}
.rank-table th { color: #9ca3af; font-weight: 500; font-size: 12px; }
.rank-table td.r, .rank-table th.r { text-align: right; }

.alert-list { padding: 4px 0; }
.alert-row {
  display: grid;
  grid-template-columns: 70px 1fr 90px;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed #f0f2f5;
  font-size: 13px;
}
.alert-tag {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
  background: #f3f4f6;
  color: #6b7280;
  text-align: center;
}
.sev-high .alert-tag { background: #fee2e2; color: #b91c1c; }
.sev-mid .alert-tag { background: #fef3c7; color: #b45309; }
.sev-low .alert-tag { background: #dbeafe; color: #1d4ed8; }
.alert-text { color: #1f2937; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alert-time { text-align: right; color: #9ca3af; font-size: 11px; }
</style>
