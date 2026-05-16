<template>
  <SellfoxPageShell title="全部订单">
    <template #actions>
      <n-button size="small">手工同步</n-button>
      <n-button size="small">导出订单</n-button>
      <n-button size="small">导入物流单号</n-button>
      <n-button size="small" type="primary">新建订单</n-button>
    </template>

    <template #filters>
      <n-input size="small" placeholder="搜索订单号/SKU/收件人" clearable style="width: 280px" />
      <n-select size="small" placeholder="平台" :options="platforms" clearable style="width: 130px" />
      <n-select size="small" placeholder="店铺" :options="shops" clearable style="width: 150px" />
      <n-select size="small" placeholder="发货仓" :options="warehouses" clearable style="width: 130px" />
      <n-date-picker size="small" type="daterange" clearable style="width: 240px" />
      <n-button size="small" type="primary">查询</n-button>
      <n-button size="small">重置</n-button>
    </template>

    <div class="tabs-row">
      <button
        v-for="t in statusTabs"
        :key="t.key"
        class="status-tab"
        :class="{ active: status === t.key }"
        @click="status = t.key"
      >
        {{ t.label }}
        <span class="count">{{ t.count }}</span>
      </button>
    </div>

    <div class="card">
      <div class="card-toolbar">
        <n-checkbox>仅看异常</n-checkbox>
        <n-checkbox>含子单</n-checkbox>
        <span class="muted">共 {{ orders.length }} 条 · 演示数据</span>
        <div style="flex:1"></div>
        <n-button-group size="small">
          <n-button>批量审核</n-button>
          <n-button>批量取消</n-button>
          <n-button>批量发货</n-button>
          <n-button>批量打印</n-button>
        </n-button-group>
      </div>
      <n-data-table
        size="small"
        :columns="columns"
        :data="orders"
        :bordered="false"
        :pagination="pagination"
        :scroll-x="1400"
      />
    </div>

    <!-- ======= 第 2 屏：订单趋势 + 待处理任务 ======= -->
    <div class="row2">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>订单趋势</div>
          <div class="card-tabs">
            <button class="tab active">近7天</button>
            <button class="tab">近30天</button>
            <button class="tab">本月</button>
          </div>
        </div>
        <svg viewBox="0 0 600 180" preserveAspectRatio="none" class="chart-svg">
          <polyline :points="trendLine" fill="none" stroke="#4f64f6" stroke-width="2" />
          <polyline :points="trendArea" :fill="'#dbeafe'" stroke="none" opacity="0.6" />
        </svg>
        <div class="trend-axis">
          <span v-for="d in trendDays" :key="d">{{ d }}</span>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar yellow"></span>待处理任务</div>
          <a class="more">全部 ›</a>
        </div>
        <div class="todo-grid">
          <div v-for="t in todos" :key="t.label" class="todo-card" :class="t.sev">
            <div class="todo-label">{{ t.label }}</div>
            <div class="todo-value">{{ t.count }}</div>
            <a class="todo-action">{{ t.action }} ›</a>
          </div>
        </div>
      </div>
    </div>

    <!-- ======= 第 3 屏：平台分布 + 店铺分布 ======= -->
    <div class="row2">
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>平台订单分布</div>
          <div class="muted">近 7 天</div>
        </div>
        <div class="bar-list">
          <div v-for="p in platformDist" :key="p.label" class="bar-row">
            <span class="bar-label">{{ p.label }}</span>
            <div class="bar-track"><div class="bar-fill" :style="{ width: p.pct + '%', background: p.color }"></div></div>
            <span class="bar-val">{{ p.value.toLocaleString() }}</span>
            <span class="bar-pct">{{ p.pct }}%</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>店铺订单排行</div>
          <div class="muted">近 7 天</div>
        </div>
        <table class="rank-table">
          <thead><tr><th style="width:28px">#</th><th>店铺</th><th>平台</th><th class="r">订单</th><th class="r">客单(US$)</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in shopRank" :key="s.shop">
              <td><span class="rank-no" :class="rankClass(i)">{{ i + 1 }}</span></td>
              <td>{{ s.shop }}</td>
              <td>{{ s.platform }}</td>
              <td class="r">{{ s.orders.toLocaleString() }}</td>
              <td class="r">{{ s.avg.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </SellfoxPageShell>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue';
import { NButton, NButtonGroup, NCheckbox, NDataTable, NDatePicker, NInput, NSelect, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import SellfoxPageShell from '@/components/common/SellfoxPageShell.vue';

const status = ref('all');
const statusTabs = [
  { key: 'all', label: '全部', count: 1240 },
  { key: 'pending', label: '待审核', count: 32 },
  { key: 'audited', label: '已审核', count: 280 },
  { key: 'shipping', label: '待发货', count: 96 },
  { key: 'shipped', label: '已发货', count: 720 },
  { key: 'cancel', label: '已取消', count: 30 },
  { key: 'refund', label: '退款中', count: 12 },
  { key: 'returned', label: '已退货', count: 8 },
];

const platforms = [
  { label: 'Temu', value: 'temu' },
  { label: 'Walmart', value: 'walmart' },
  { label: 'TikTok', value: 'tt' },
  { label: 'AliExpress', value: 'ali' },
];
const shops = [{ label: '美区店铺-A', value: 'us-a' }, { label: '美区店铺-B', value: 'us-b' }, { label: '德区店铺', value: 'de' }];
const warehouses = [{ label: '深圳主仓', value: 'sz' }, { label: '美国海外仓', value: 'us-wh' }];

interface Order {
  orderNo: string;
  platform: string;
  shop: string;
  buyer: string;
  country: string;
  qty: number;
  amount: number;
  status: 'pending' | 'audited' | 'shipped' | 'cancel';
  paidAt: string;
  shipBefore: string;
}

const orders = computed<Order[]>(() => {
  const platformsArr = ['Temu', 'Walmart', 'TikTok', 'AliExpress'];
  const shopsArr = ['店铺A', '店铺B', '店铺C'];
  const countries = ['US', 'DE', 'JP', 'UK', 'FR'];
  return Array.from({ length: 14 }, (_, i) => ({
    orderNo: `SO${20260000 + i * 17 + 81}`,
    platform: platformsArr[i % 4],
    shop: shopsArr[i % 3],
    buyer: `Buyer ${String.fromCharCode(65 + (i % 26))}${100 + i}`,
    country: countries[i % 5],
    qty: 1 + (i % 5),
    amount: Number(((i + 1) * 19.7 + (i * 3) % 60).toFixed(2)),
    status: (['pending', 'audited', 'shipped', 'cancel'] as const)[i % 4],
    paidAt: new Date(Date.now() - i * 3700_000).toLocaleString('zh-CN', { hour12: false }),
    shipBefore: new Date(Date.now() + (3 - i % 4) * 86400_000).toLocaleDateString('zh-CN'),
  }));
});

const columns: DataTableColumns<Order> = [
  { type: 'selection' },
  { title: '订单号', key: 'orderNo', width: 140, fixed: 'left' },
  { title: '平台', key: 'platform', width: 90 },
  { title: '店铺', key: 'shop', width: 110 },
  { title: '买家', key: 'buyer', width: 140 },
  { title: '国家', key: 'country', width: 70 },
  { title: '数量', key: 'qty', width: 70, align: 'right' },
  { title: '金额(US$)', key: 'amount', width: 110, align: 'right', render: (r) => r.amount.toFixed(2) },
  {
    title: '订单状态', key: 'status', width: 100,
    render(r) {
      const map = {
        pending: { type: 'warning' as const, text: '待审核' },
        audited: { type: 'info' as const, text: '已审核' },
        shipped: { type: 'success' as const, text: '已发货' },
        cancel: { type: 'default' as const, text: '已取消' },
      };
      const m = map[r.status];
      return h(NTag, { type: m.type, size: 'small', round: true }, { default: () => m.text });
    },
  },
  { title: '付款时间', key: 'paidAt', width: 170 },
  { title: '截单时间', key: 'shipBefore', width: 110 },
  {
    title: '操作', key: 'op', width: 180, fixed: 'right',
    render() {
      return h('span', null, [
        h(NButton, { text: true, type: 'primary', size: 'tiny' }, { default: () => '审核' }),
        h('span', { style: 'color:#dcdfe6;margin:0 6px' }, '|'),
        h(NButton, { text: true, type: 'primary', size: 'tiny' }, { default: () => '发货' }),
        h('span', { style: 'color:#dcdfe6;margin:0 6px' }, '|'),
        h(NButton, { text: true, type: 'primary', size: 'tiny' }, { default: () => '详情' }),
        h('span', { style: 'color:#dcdfe6;margin:0 6px' }, '|'),
        h(NButton, { text: true, type: 'error', size: 'tiny' }, { default: () => '取消' }),
      ]);
    },
  },
];

const pagination = { pageSize: 10, showSizePicker: true, pageSizes: [10, 20, 50, 100] };

const trendDays = ['05-09', '05-10', '05-11', '05-12', '05-13', '05-14', '05-15'];
const trendVals = [120, 180, 165, 210, 245, 220, 280];
const trendLine = trendVals.map((v, i) => `${(i / 6) * 600},${180 - v * 0.5}`).join(' ');
const trendArea = '0,180 ' + trendVals.map((v, i) => `${(i / 6) * 600},${180 - v * 0.5}`).join(' ') + ' 600,180';

interface Todo { label: string; count: number; sev: 'high' | 'mid' | 'low'; action: string }
const todos: Todo[] = [
  { label: '待审核', count: 32, sev: 'high', action: '去审核' },
  { label: '待发货', count: 96, sev: 'mid', action: '去发货' },
  { label: '待打单', count: 18, sev: 'mid', action: '去打单' },
  { label: '物流异常', count: 7, sev: 'high', action: '去处理' },
  { label: '差评跟进', count: 4, sev: 'low', action: '去跟进' },
  { label: '退款待审', count: 12, sev: 'high', action: '去审批' },
];

const platformDist = [
  { label: 'Temu', value: 420, pct: 36, color: '#6366f1' },
  { label: 'Walmart', value: 320, pct: 28, color: '#22c55e' },
  { label: 'TikTok', value: 220, pct: 19, color: '#f59e0b' },
  { label: 'AliExpress', value: 130, pct: 11, color: '#ef4444' },
  { label: 'SHEIN', value: 70, pct: 6, color: '#a78bfa' },
];

interface ShopRank { shop: string; platform: string; orders: number; avg: number }
const shopRank: ShopRank[] = [
  { shop: '美区主店', platform: 'Walmart', orders: 320, avg: 28.50 },
  { shop: 'TikTok US 旗舰', platform: 'TikTok', orders: 220, avg: 24.10 },
  { shop: '德区 EU 店', platform: 'Temu', orders: 188, avg: 22.40 },
  { shop: '日区 JP 店', platform: 'Shopee', orders: 142, avg: 19.80 },
  { shop: 'UK 主店', platform: 'eBay', orders: 118, avg: 26.30 },
];
function rankClass(i: number) {
  if (i === 0) return 'rank-gold';
  if (i === 1) return 'rank-silver';
  if (i === 2) return 'rank-bronze';
  return '';
}
</script>

<style scoped>
.tabs-row {
  display: flex;
  gap: 4px;
  padding: 8px 16px 0;
  flex-wrap: wrap;
}
.status-tab {
  border: 0;
  background: #fff;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #4b5563;
  border-radius: 6px 6px 0 0;
  border-bottom: 2px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.status-tab.active {
  color: #4f64f6;
  border-bottom-color: #4f64f6;
  font-weight: 600;
}
.status-tab .count {
  background: #f3f4f6;
  color: #6b7280;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
}
.status-tab.active .count {
  background: #eef2ff;
  color: #4f64f6;
}
.card {
  background: #fff;
  margin: 8px 16px 16px;
  border: 1px solid #eef0f4;
  border-radius: 6px;
}
.card-toolbar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f2f5;
}
.muted { color: #9ca3af; font-size: 12px; }

/* 第 2/3 屏 */
.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0 16px 12px;
}
.row2 .card {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
.chart-svg { width: 100%; height: 180px; }
.trend-axis {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

.todo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.todo-card {
  background: #f9fafb;
  border-left: 3px solid #d1d5db;
  border-radius: 4px;
  padding: 10px 12px;
}
.todo-card.high { border-left-color: #ef4444; }
.todo-card.mid { border-left-color: #f59e0b; }
.todo-card.low { border-left-color: #3b82f6; }
.todo-label { color: #6b7280; font-size: 12px; }
.todo-value { font-size: 22px; font-weight: 700; color: #111827; margin: 4px 0; }
.todo-action { color: #4f64f6; font-size: 12px; cursor: pointer; }

.bar-list { padding: 4px 0; }
.bar-row {
  display: grid;
  grid-template-columns: 100px 1fr 70px 50px;
  gap: 10px;
  align-items: center;
  padding: 6px 0;
  font-size: 12px;
}
.bar-label { color: #6b7280; }
.bar-track { height: 10px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; }
.bar-val { text-align: right; font-weight: 600; }
.bar-pct { color: #9ca3af; text-align: right; }

.rank-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.rank-table th, .rank-table td {
  padding: 8px 6px; text-align: left;
  border-bottom: 1px dashed #eef0f4;
}
.rank-table th { color: #9ca3af; font-weight: 500; font-size: 12px; }
.rank-table td.r, .rank-table th.r { text-align: right; }
.rank-no {
  display: inline-flex;
  width: 22px; height: 22px;
  border-radius: 4px;
  align-items: center; justify-content: center;
  font-size: 12px;
  background: #f3f4f6; color: #6b7280;
}
.rank-no.rank-gold { background: #f59e0b; color: #fff; }
.rank-no.rank-silver { background: #9ca3af; color: #fff; }
.rank-no.rank-bronze { background: #d97706; color: #fff; }
</style>
