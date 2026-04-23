<template>
  <n-card title="店铺销量排行" :bordered="false" style="height: 320px; overflow: hidden;">
    <n-scrollbar style="max-height: 240px;">
      <div v-if="!rows.length" class="empty">暂无数据</div>
      <div v-for="(r, i) in rows" :key="r.shopId" class="rank-row">
        <span class="rank-idx" :class="{ top3: i < 3 }">{{ i + 1 }}</span>
        <span class="shop-name">{{ r.shopName }}</span>
        <span class="value">{{ formatNumber(r.salesVolume) }} 件</span>
      </div>
    </n-scrollbar>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NScrollbar } from 'naive-ui';
import type { DashboardSummary } from '@/api-client/dashboard.api';

const props = defineProps<{ data: DashboardSummary | null }>();
const rows = computed(() => props.data?.shopRanking.slice(0, 10) ?? []);

function formatNumber(n: number) { return new Intl.NumberFormat().format(n); }
</script>

<style scoped>
.rank-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 4px; border-bottom: 1px solid #f5f5f5;
}
.rank-idx {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 11px;
  background: #f5f5f5; color: #999; font-size: 12px; font-weight: 600;
}
.rank-idx.top3 { background: #2080f0; color: #fff; }
.shop-name { flex: 1; font-size: 13px; color: #333; }
.value { font-size: 13px; color: #18a058; font-weight: 500; }
.empty { text-align: center; color: #bbb; padding: 40px 0; font-size: 13px; }
</style>
