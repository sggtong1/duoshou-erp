<template>
  <n-card title="商品明细" :bordered="false">
    <template #header-extra>
      <span class="sub-label">共 {{ data?.productDetails.total ?? 0 }} 条</span>
    </template>
    <n-data-table
      :columns="columns"
      :data="rows"
      :pagination="{ pageSize: 10 }"
      :row-class-name="rowClass"
      size="small"
    />
  </n-card>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, h } from 'vue';
import { NCard, NDataTable, type DataTableColumns } from 'naive-ui';
import type { DashboardSummary, DashboardSkuRow, TimeRange } from '@/api-client/dashboard.api';

const props = defineProps<{ data: DashboardSummary | null; timeRange: TimeRange }>();

const rows = computed<DashboardSkuRow[]>(() => props.data?.productDetails.items ?? []);

const highlightSku = ref<string | null>(null);
function onHighlight(e: Event) {
  const d = (e as CustomEvent).detail;
  highlightSku.value = d?.platformSkuId ?? null;
  setTimeout(() => { highlightSku.value = null; }, 2000);
}
onMounted(() => window.addEventListener('duoshou:highlight-sku', onHighlight));
onUnmounted(() => window.removeEventListener('duoshou:highlight-sku', onHighlight));

function rowClass(row: DashboardSkuRow) {
  return row.platformSkuId === highlightSku.value ? 'row-highlight' : '';
}

const volumeCol = computed(() => {
  const field =
    props.timeRange === 'today' ? 'todayVolume' :
    props.timeRange === '7d' ? 'sales7dVolume' : 'sales30dVolume';
  const label =
    props.timeRange === 'today' ? '今日销量' :
    props.timeRange === '7d' ? '近 7 日销量' : '近 30 日销量';
  return { title: label, key: field, render: (r: DashboardSkuRow) => (r as any)[field] };
});

const columns = computed<DataTableColumns<DashboardSkuRow>>(() => [
  { title: 'SKU', key: 'skuTitle', render: (r) => r.skuTitle ?? r.platformSkuId, ellipsis: { tooltip: true } },
  { title: '店铺', key: 'shopName', render: (r) => r.shopName ?? '—' },
  volumeCol.value,
  { title: '库存', key: 'warehouseQty', render: (r) => r.warehouseQty },
  { title: 'GMV', key: 'gmv', render: () => h('span', { style: { color: '#ccc' }, title: 'GMV:v1.2 支持' }, '—') },
]);
</script>

<style scoped>
.sub-label { font-size: 12px; color: #999; }
:deep(.row-highlight td) { background: #fff6e6 !important; transition: background 0.3s; }
</style>
