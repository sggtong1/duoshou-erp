<template>
  <n-card title="TOP SKU 销量排行" :bordered="false" style="height: 320px; overflow: hidden;">
    <template #header-extra>
      <span class="sub-label">{{ timeRangeLabel }}</span>
    </template>
    <n-scrollbar style="max-height: 240px;">
      <div v-if="!rows.length" class="empty">暂无数据</div>
      <div v-for="(r, i) in rows" :key="r.platformSkuId" class="sku-row">
        <span class="rank">{{ i + 1 }}</span>
        <span class="sku-title" :title="r.skuTitle ?? r.platformSkuId">
          {{ r.skuTitle ?? r.platformSkuId }}
        </span>
        <span class="shop">{{ r.shopName ?? '—' }}</span>
        <span class="value">{{ formatNumber(volumeOf(r)) }}</span>
      </div>
    </n-scrollbar>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NScrollbar } from 'naive-ui';
import type { DashboardSummary, DashboardSkuRow, TimeRange } from '@/api-client/dashboard.api';

const props = defineProps<{ data: DashboardSummary | null; timeRange: TimeRange }>();

const rows = computed(() => props.data?.topSkus ?? []);
const timeRangeLabel = computed(() =>
  ({ today: '今日', '7d': '近 7 日', '30d': '近 30 日' }[props.timeRange]));

function volumeOf(r: DashboardSkuRow) {
  if (props.timeRange === 'today') return r.todayVolume;
  if (props.timeRange === '7d') return r.sales7dVolume;
  return r.sales30dVolume;
}
function formatNumber(n: number) { return new Intl.NumberFormat().format(n); }
</script>

<style scoped>
.sku-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 2px; border-bottom: 1px solid #f5f5f5; font-size: 13px;
}
.rank { width: 20px; color: #999; text-align: center; }
.sku-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #333; }
.shop { width: 80px; color: #888; font-size: 12px; }
.value { width: 60px; text-align: right; color: #18a058; font-weight: 500; }
.empty { text-align: center; color: #bbb; padding: 40px 0; font-size: 13px; }
.sub-label { font-size: 12px; color: #999; }
</style>
