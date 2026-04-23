<template>
  <n-card title="流量转化漏斗" :bordered="false" style="height: 320px;">
    <template #header-extra>
      <span class="demo-tag">演示数据</span>
    </template>
    <v-chart :option="option" style="height: 240px;" autoresize />
  </n-card>
</template>

<script setup lang="ts">
import { NCard } from 'naive-ui';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { FunnelChart as EFunnel } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { DEMO_FUNNEL } from '@/lib/demo-data';

use([CanvasRenderer, EFunnel, TooltipComponent, LegendComponent]);

const option = {
  tooltip: { trigger: 'item', formatter: '{b}: {c}' },
  series: [{
    type: 'funnel',
    left: '10%',
    right: '10%',
    top: 16,
    bottom: 16,
    width: '80%',
    min: 0,
    max: DEMO_FUNNEL[0].value,
    gap: 2,
    label: { show: true, position: 'inside', fontSize: 11, color: '#fff', formatter: '{b}: {c}' },
    itemStyle: { borderColor: '#fff', borderWidth: 1 },
    data: DEMO_FUNNEL.map((d, i) => ({
      ...d,
      itemStyle: { color: ['#f97316', '#fb923c', '#fbbf24', '#38bdf8', '#0ea5e9'][i] },
    })),
  }],
};
</script>

<style scoped>
.demo-tag {
  padding: 1px 6px;
  font-size: 10px;
  border-radius: 3px;
  background: #e8f0ff;
  color: #6686bf;
}
</style>
