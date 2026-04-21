<template>
  <n-card title="TOP 20 近 30 日销量" size="small">
    <v-chart v-if="hasData" :option="option" autoresize :style="{ height: chartHeight }" />
    <n-empty v-else description="暂无销量数据" style="margin: 40px 0;" />
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NEmpty } from 'naive-ui';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';
import type { DashboardSkuRow } from '@/api-client/dashboard.api';

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{
  data: DashboardSkuRow[] | null;
}>();

const sorted = computed(() =>
  (props.data ?? []).slice()
    .sort((a, b) => (b.sales30dVolume ?? 0) - (a.sales30dVolume ?? 0))
    .slice(0, 20),
);

const hasData = computed(() =>
  sorted.value.length > 0 && sorted.value.some((r) => (r.sales30dVolume ?? 0) > 0),
);

const chartHeight = computed(() => {
  const n = sorted.value.length;
  return `${Math.max(260, n * 22)}px`;
});

const option = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 200, right: 40, top: 10, bottom: 30 },
  xAxis: { type: 'value', name: '件数' },
  yAxis: {
    type: 'category',
    data: sorted.value.map((r) => r.skuTitle ?? r.platformSkuId).reverse(),
    axisLabel: { width: 180, overflow: 'truncate' },
  },
  series: [{
    type: 'bar',
    data: sorted.value.map((r) => r.sales30dVolume ?? 0).reverse(),
    itemStyle: { color: '#2080f0' },
    label: { show: true, position: 'right', formatter: (p: any) => `${p.value} 件` },
  }],
}));
</script>
