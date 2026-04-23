<template>
  <n-card title="平台对比" :bordered="false" style="height: 320px;">
    <template #header-extra>
      <n-tooltip placement="top">
        <template #trigger><span class="placeholder-label">仅 Temu · 其它 v2</span></template>
        TikTok Shop / MercadoLibre / Shopee / Amazon:接入中,v2 支持
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
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import type { DashboardSummary } from '@/api-client/dashboard.api';

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent]);

const props = defineProps<{ data: DashboardSummary | null }>();
const PLATFORMS = ['TikTok', 'Temu', 'MercadoLibre', 'Shopee', 'Amazon'];

const option = computed(() => {
  const realTemu = props.data?.platformComparison.find((x) => x.platform === 'temu')?.salesVolume ?? 0;
  const values = [0, realTemu, 0, 0, 0];
  return {
    grid: { left: 80, right: 20, top: 20, bottom: 20 },
    tooltip: { trigger: 'axis' },
    yAxis: { type: 'category', data: PLATFORMS },
    xAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: values.map((v, i) => ({
        value: v,
        itemStyle: { color: i === 1 ? '#2080f0' : '#e0e0e0' },
      })),
      barMaxWidth: 24,
    }],
  };
});
</script>

<style scoped>
.placeholder-label { color: #bbb; font-size: 12px; font-style: italic; }
</style>
