<template>
  <div class="inventory-alerts">
    <n-card title="库存预警" :bordered="false">
      <template #header-extra>
        <n-tag :bordered="false" type="warning">
          共 {{ alerts.length }} 条
        </n-tag>
      </template>

      <n-data-table
        :columns="columns"
        :data="alerts"
        :loading="loading"
        :pagination="{ pageSize: 20 }"
        size="small"
        :row-class-name="rowClass"
      />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { NCard, NDataTable, NTag, type DataTableColumns } from 'naive-ui';
import { useDashboardStore } from '@/stores/dashboard';
import { useFiltersStore } from '@/stores/filters';
import type { DashboardSkuRow } from '@/api-client/dashboard.api';

const dashboard = useDashboardStore();
const filters = useFiltersStore();
const loading = computed(() => dashboard.loading);

const alerts = computed<DashboardSkuRow[]>(() => dashboard.data?.lowStockAlerts ?? []);

const columns: DataTableColumns<DashboardSkuRow> = [
  { title: 'SKU', key: 'skuTitle', render: (r) => r.skuTitle ?? r.platformSkuId, ellipsis: { tooltip: true } },
  { title: '店铺', key: 'shopName', render: (r) => r.shopName ?? '—' },
  { title: '当前库存', key: 'warehouseQty', render: (r) => r.warehouseQty },
  { title: '日均销量', key: 'avgDailySales', render: (r) => (r.avgDailySales ?? 0).toFixed(1) },
  { title: '剩余天数', key: 'daysRemaining', render: (r) => r.daysRemaining?.toFixed(1) ?? '—' },
];

function rowClass(row: DashboardSkuRow) {
  const d = row.daysRemaining ?? 999;
  if (d < 3) return 'row-red';
  if (d < 7) return 'row-yellow';
  return '';
}

onMounted(() => {
  if (!dashboard.data) dashboard.fetch(filters.toQuery());
});
watch(() => filters.toQuery(), (q) => dashboard.fetch(q), { deep: true });
</script>

<style scoped>
.inventory-alerts { max-width: 1400px; margin: 0 auto; }
:deep(.row-red td) { background: #fff1f0 !important; }
:deep(.row-yellow td) { background: #fff7e6 !important; }
</style>
