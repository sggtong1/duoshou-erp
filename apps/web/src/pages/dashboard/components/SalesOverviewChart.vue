<template>
  <n-card title="销售对比(件数)" size="small">
    <v-chart :option="option" autoresize style="height: 260px;" />
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard } from 'naive-ui';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import VChart from 'vue-echarts';

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{
  data: { today: number; last7d: number; last30d: number } | null;
}>();

const option = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 40, right: 20, top: 20, bottom: 30 },
  xAxis: {
    type: 'category',
    data: ['今日', '近 7 日', '近 30 日'],
  },
  yAxis: { type: 'value', name: '件数' },
  series: [{
    type: 'bar',
    data: [
      props.data?.today ?? 0,
      props.data?.last7d ?? 0,
      props.data?.last30d ?? 0,
    ],
    itemStyle: { color: '#18a058' },
    barWidth: '45%',
  }],
}));
</script>
