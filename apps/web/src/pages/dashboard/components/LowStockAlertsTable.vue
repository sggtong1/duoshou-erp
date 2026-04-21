<template>
  <n-card title="库存预警" size="small">
    <n-data-table
      :columns="columns"
      :data="data ?? []"
      :bordered="false"
      size="small"
      :row-key="(r: any) => r.platformSkuId + ':' + r.shopId"
    />
  </n-card>
</template>

<script setup lang="ts">
import { h } from 'vue';
import { NCard, NDataTable, NTag } from 'naive-ui';
import type { DashboardSkuRow } from '@/api-client/dashboard.api';

defineProps<{
  data: DashboardSkuRow[] | null;
}>();

const columns = [
  { title: 'SKU', key: 'skuTitle', render: (r: DashboardSkuRow) => r.skuTitle ?? r.platformSkuId, ellipsis: { tooltip: true } },
  { title: '店铺', key: 'shopName', render: (r: DashboardSkuRow) => r.shopName ?? '—', width: 100 },
  { title: '库存', key: 'warehouseQty', width: 70, align: 'right' as const, render: (r: DashboardSkuRow) => r.warehouseQty ?? 0 },
  { title: '日均销量', key: 'avgDailySales', width: 90, align: 'right' as const,
    render: (r: DashboardSkuRow) => r.avgDailySales == null ? '—' : r.avgDailySales.toFixed(1) },
  { title: '剩余天数', key: 'daysRemaining', width: 100,
    render: (r: DashboardSkuRow) => {
      if (r.daysRemaining == null) return '—';
      const d = r.daysRemaining;
      const type = d < 3 ? 'error' : d < 7 ? 'warning' : 'default';
      return h(NTag, { type, size: 'small' }, () => `${d.toFixed(1)} 天`);
    },
  },
];
</script>
