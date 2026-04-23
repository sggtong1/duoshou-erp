<template>
  <n-card title="销量趋势" :bordered="false" style="height: 320px;">
    <template #header-extra>
      <n-tooltip placement="top">
        <template #trigger>
          <span class="placeholder-label">GMV / 订单量 · 待接入</span>
        </template>
        GMV / 订单量:需订单数据,v1.2 支持
      </n-tooltip>
    </template>
    <v-chart :option="option" style="height: 240px;" autoresize />
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NTooltip } from 'naive-ui';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import type { DashboardSummary } from '@/api-client/dashboard.api';

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent]);

const props = defineProps<{ data: DashboardSummary | null }>();

const option = computed(() => {
  const t = props.data?.salesTrend;
  return {
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ['今日', '近 7 日', '近 30 日'] },
    yAxis: { type: 'value' },
    series: [
      {
        name: '销量',
        type: 'bar',
        data: [t?.today.volume ?? 0, t?.last7d.volume ?? 0, t?.last30d.volume ?? 0],
        itemStyle: { color: '#18a058' },
        barMaxWidth: 60,
      },
    ],
  };
});
</script>

<style scoped>
.placeholder-label { color: #bbb; font-size: 12px; font-style: italic; }
</style>
