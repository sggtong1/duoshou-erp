<template>
  <n-card title="平台表现对比" :bordered="false" style="height: 320px;">
    <template #header-extra>
      <span class="demo-tag">其它平台演示</span>
    </template>
    <v-chart :option="option" style="height: 240px;" autoresize />
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard } from 'naive-ui';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import type { DashboardSummary } from '@/api-client/dashboard.api';
import { DEMO_PLATFORM_GMV_USD } from '@/lib/demo-data';

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent]);

const props = defineProps<{ data: DashboardSummary | null }>();
const PLATFORMS = [
  { key: 'tiktok',       label: 'TikTok Shop' },
  { key: 'temu',         label: 'Temu' },
  { key: 'mercadolibre', label: 'MercadoLibre' },
  { key: 'shopee',       label: 'Shopee' },
  { key: 'amazon',       label: 'Amazon' },
];

const option = computed(() => {
  const realTemuVolume = props.data?.platformComparison.find((x) => x.platform === 'temu')?.salesVolume ?? 0;
  // Show GMV (USD) for consistency with the rest of the dashboard.
  // Temu real GMV not yet available → use a small estimate derived from volume (~$15 avg ASP) or fallback to demo.
  const temuGmv = realTemuVolume > 0 ? realTemuVolume * 15 : 234567;
  const values = PLATFORMS.map((p) =>
    p.key === 'temu' ? temuGmv : (DEMO_PLATFORM_GMV_USD[p.key] ?? 0),
  );
  return {
    grid: { left: 100, right: 40, top: 20, bottom: 20 },
    tooltip: { trigger: 'axis', formatter: (params: any) => {
      const p = params[0];
      return `${p.name}<br/>GMV: $${new Intl.NumberFormat('en-US').format(Math.round(p.value))}`;
    } },
    yAxis: { type: 'category', data: PLATFORMS.map((p) => p.label) },
    xAxis: { type: 'value', axisLabel: { formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v) } },
    series: [{
      type: 'bar',
      data: values.map((v, i) => ({
        value: v,
        itemStyle: { color: PLATFORMS[i].key === 'temu' ? '#7c3aed' : '#a78bfa' },
        label: { show: true, position: 'right', formatter: `$${new Intl.NumberFormat('en-US').format(Math.round(v))}`, fontSize: 10 },
      })),
      barMaxWidth: 22,
    }],
  };
});
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
