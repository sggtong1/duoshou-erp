<template>
  <SellfoxPageShell :title="title" :badge="badge">
    <template #actions>
      <n-button size="small">导出</n-button>
      <n-button size="small">自定义列</n-button>
      <n-button size="small" type="primary">新建</n-button>
    </template>

    <template #filters>
      <n-input size="small" placeholder="搜索关键词" clearable style="width: 220px" />
      <n-select size="small" placeholder="平台" :options="platformOptions" clearable style="width: 140px" />
      <n-select size="small" placeholder="站点" :options="siteOptions" clearable style="width: 140px" />
      <n-select size="small" placeholder="店铺" :options="shopOptions" clearable style="width: 160px" />
      <n-date-picker size="small" type="daterange" clearable style="width: 240px" />
      <n-button size="small" type="primary">查询</n-button>
      <n-button size="small">重置</n-button>
    </template>

    <template #kpis>
      <div class="kpi-row">
        <div v-for="k in kpis" :key="k.label" class="kpi-card">
          <div class="kpi-label">{{ k.label }}</div>
          <div class="kpi-value">{{ k.value }}</div>
          <div class="kpi-foot">
            <span :class="k.changeNum >= 0 ? 'up' : 'down'">{{ k.changeNum >= 0 ? '+' : '' }}{{ k.changeNum.toFixed(2) }}%</span>
            <span class="hint">较上周期</span>
          </div>
        </div>
      </div>
    </template>

    <div class="card">
      <div class="card-toolbar">
        <n-checkbox>仅看异常</n-checkbox>
        <span class="muted">共 {{ rows.length }} 条 · 演示数据</span>
        <div style="flex:1"></div>
        <n-button-group size="small">
          <n-button>批量审核</n-button>
          <n-button>批量推送</n-button>
          <n-button>批量删除</n-button>
        </n-button-group>
      </div>
      <n-data-table
        size="small"
        :columns="columns"
        :data="rows"
        :bordered="false"
        :pagination="pagination"
      />
    </div>
  </SellfoxPageShell>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { useRoute } from 'vue-router';
import {
  NButton, NButtonGroup, NCheckbox, NDatePicker, NInput, NSelect,
  NDataTable, NTag,
} from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import SellfoxPageShell from '@/components/common/SellfoxPageShell.vue';

const route = useRoute();
const title = computed(() => (route.meta?.title as string) ?? '占位页面');
const badge = computed(() => route.meta?.badge as string | undefined);

const platformOptions = [
  { label: 'Temu', value: 'temu' },
  { label: 'Walmart', value: 'walmart' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'SHEIN', value: 'shein' },
  { label: 'AliExpress', value: 'ali' },
  { label: 'Shopee', value: 'shopee' },
];
const siteOptions = [
  { label: '美国', value: 'us' },
  { label: '日本', value: 'jp' },
  { label: '德国', value: 'de' },
  { label: '英国', value: 'uk' },
  { label: '法国', value: 'fr' },
];
const shopOptions = [
  { label: '店铺A', value: 'a' },
  { label: '店铺B', value: 'b' },
  { label: '店铺C', value: 'c' },
];

const kpis = computed(() => {
  const seed = (title.value || '').length + 7;
  function rnd(n: number) { return Number(((Math.sin(seed * n) + 1) * 5000).toFixed(2)); }
  return [
    { label: '总数', value: rnd(1).toFixed(0), changeNum: ((Math.sin(seed) * 20)) },
    { label: '本期金额(US$)', value: rnd(2).toLocaleString(), changeNum: ((Math.cos(seed) * 15)) },
    { label: '同比', value: ((Math.sin(seed * 0.7) * 30)).toFixed(2) + '%', changeNum: ((Math.sin(seed * 1.1) * 12)) },
    { label: '环比', value: ((Math.cos(seed * 0.5) * 25)).toFixed(2) + '%', changeNum: ((Math.cos(seed * 1.3) * 8)) },
    { label: '异常数', value: Math.floor(rnd(3) / 200).toString(), changeNum: -((Math.sin(seed * 2) * 5)) },
  ];
});

interface Row {
  id: string;
  name: string;
  platform: string;
  shop: string;
  status: 'ok' | 'warn' | 'err';
  qty: number;
  amount: number;
  updatedAt: string;
}

const rows = computed<Row[]>(() => {
  const seed = (title.value || '').length;
  return Array.from({ length: 12 }, (_, i) => ({
    id: 'A' + (10001 + seed * 17 + i),
    name: `${title.value} 演示记录 #${i + 1}`,
    platform: platformOptions[(i + seed) % platformOptions.length].label,
    shop: shopOptions[(i + seed) % shopOptions.length].label,
    status: (['ok', 'warn', 'err'] as const)[i % 3],
    qty: 100 + ((i * 37 + seed * 11) % 900),
    amount: Number((((i * 53 + seed * 19) % 9000) + 100).toFixed(2)),
    updatedAt: new Date(Date.now() - i * 3600_000 * (1 + (seed % 4))).toLocaleString('zh-CN', { hour12: false }),
  }));
});

const columns: DataTableColumns<Row> = [
  { type: 'selection' },
  { title: '编号', key: 'id', width: 110 },
  { title: '名称', key: 'name', minWidth: 220 },
  { title: '平台', key: 'platform', width: 100 },
  { title: '店铺', key: 'shop', width: 100 },
  {
    title: '状态', key: 'status', width: 90,
    render(row) {
      const map = { ok: { type: 'success' as const, text: '正常' }, warn: { type: 'warning' as const, text: '待处理' }, err: { type: 'error' as const, text: '异常' } };
      const m = map[row.status];
      return h(NTag, { type: m.type, size: 'small', round: true }, { default: () => m.text });
    },
  },
  { title: '数量', key: 'qty', width: 90, align: 'right' },
  { title: '金额(US$)', key: 'amount', width: 110, align: 'right', render: (r) => r.amount.toFixed(2) },
  { title: '更新时间', key: 'updatedAt', width: 170 },
  {
    title: '操作', key: 'op', width: 160, fixed: 'right',
    render() {
      return h('span', { class: 'row-ops' }, [
        h(NButton, { text: true, type: 'primary', size: 'tiny' }, { default: () => '查看' }),
        h('span', { style: 'color:#dcdfe6;margin:0 6px' }, '|'),
        h(NButton, { text: true, type: 'primary', size: 'tiny' }, { default: () => '编辑' }),
        h('span', { style: 'color:#dcdfe6;margin:0 6px' }, '|'),
        h(NButton, { text: true, type: 'error', size: 'tiny' }, { default: () => '删除' }),
      ]);
    },
  },
];

const pagination = { pageSize: 10, showSizePicker: true, pageSizes: [10, 20, 50] };
</script>

<style scoped>
.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  padding: 0 16px;
}
.kpi-card {
  background: #fff;
  border-radius: 6px;
  padding: 14px 16px;
  border: 1px solid #eef0f4;
}
.kpi-label { color: #6b7280; font-size: 12px; }
.kpi-value { font-size: 22px; font-weight: 600; color: #111827; margin: 6px 0 4px; }
.kpi-foot { font-size: 12px; color: #6b7280; display: flex; gap: 6px; align-items: center; }
.kpi-foot .up { color: #18a058; }
.kpi-foot .down { color: #d03050; }
.kpi-foot .hint { color: #9ca3af; }

.card {
  background: #fff;
  margin: 0 16px 16px;
  border: 1px solid #eef0f4;
  border-radius: 6px;
}
.card-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f2f5;
}
.muted { color: #9ca3af; font-size: 12px; }
</style>
