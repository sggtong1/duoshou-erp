<template>
  <n-card title="TOP 10 今日热销" size="small">
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
import { NCard, NDataTable } from 'naive-ui';
import type { DashboardSkuRow } from '@/api-client/dashboard.api';

defineProps<{
  data: DashboardSkuRow[] | null;
}>();

const columns = [
  { title: 'SKU', key: 'skuTitle', render: (r: DashboardSkuRow) => r.skuTitle ?? r.platformSkuId, ellipsis: { tooltip: true } },
  { title: '店铺', key: 'shopName', render: (r: DashboardSkuRow) => r.shopName ?? '—', width: 100 },
  { title: '今日销量', key: 'todayVolume', width: 80, align: 'right' as const, render: (r: DashboardSkuRow) => r.todayVolume ?? 0 },
  { title: '库存', key: 'warehouseQty', width: 80, align: 'right' as const, render: (r: DashboardSkuRow) => r.warehouseQty ?? 0 },
];
</script>
