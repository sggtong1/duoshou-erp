<template>
  <n-card title="广告表现" :bordered="false" style="height: 320px;">
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
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import {
  DEMO_AD_DATES,
  DEMO_AD_ROAS,
  DEMO_AD_ACOS,
  DEMO_AD_TACOS,
  DEMO_AD_CTR,
} from '@/lib/demo-data';

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent]);

const option = {
  grid: { left: 36, right: 16, top: 32, bottom: 24 },
  tooltip: { trigger: 'axis' },
  legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
  xAxis: { type: 'category', data: DEMO_AD_DATES, axisLabel: { fontSize: 11 } },
  yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
  series: [
    { name: 'ROAS',  type: 'line', data: DEMO_AD_ROAS,  smooth: true, itemStyle: { color: '#7c3aed' }, lineStyle: { color: '#7c3aed' } },
    { name: 'ACOS',  type: 'line', data: DEMO_AD_ACOS,  smooth: true, itemStyle: { color: '#2080f0' }, lineStyle: { color: '#2080f0' } },
    { name: 'TACOS', type: 'line', data: DEMO_AD_TACOS, smooth: true, itemStyle: { color: '#18a058' }, lineStyle: { color: '#18a058' } },
    { name: 'CTR',   type: 'line', data: DEMO_AD_CTR,   smooth: true, itemStyle: { color: '#f0a020' }, lineStyle: { color: '#f0a020' } },
  ],
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
