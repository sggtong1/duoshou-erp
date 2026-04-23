<template>
  <n-card title="区域分布" :bordered="false" style="height: 320px;">
    <v-chart :option="option" style="height: 240px;" autoresize />
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard } from 'naive-ui';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart } from 'echarts/charts';
import { LegendComponent, TooltipComponent } from 'echarts/components';
import type { DashboardSummary } from '@/api-client/dashboard.api';

use([CanvasRenderer, PieChart, LegendComponent, TooltipComponent]);

const props = defineProps<{ data: DashboardSummary | null }>();

const REGION_LABELS: Record<string, string> = { cn: '中国仓', pa: '海外仓' };
const COLORS = ['#2080f0', '#18a058', '#f0a020', '#d03050'];

const option = computed(() => {
  const rows = props.data?.regionDistribution ?? [];
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 件 ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      data: rows.map((r, i) => ({
        name: REGION_LABELS[r.region] ?? r.region.toUpperCase(),
        value: r.salesVolume,
        itemStyle: { color: COLORS[i % COLORS.length] },
      })),
      label: { show: false },
    }],
  };
});
</script>
