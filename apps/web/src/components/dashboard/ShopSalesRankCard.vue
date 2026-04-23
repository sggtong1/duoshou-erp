<template>
  <n-card title="店铺销量排行" :bordered="false" style="height: 320px; overflow: hidden;">
    <template #header-extra>
      <span v-if="hasPadding" class="demo-tag">含演示数据</span>
    </template>
    <n-scrollbar style="max-height: 240px;">
      <div v-if="!rows.length" class="empty">暂无数据</div>
      <div v-for="(r, i) in rows" :key="'rank-' + i" class="rank-row" :class="{ demo: r.isDemo }">
        <span class="rank-idx" :class="{ top3: i < 3 }">{{ i + 1 }}</span>
        <span class="shop-name">{{ r.shopName }}</span>
        <span class="value" :class="{ up: r.changePct != null && r.changePct >= 0, down: r.changePct != null && r.changePct < 0 }">
          <template v-if="r.isDemo">${{ formatNumber(r.gmvUsd) }}</template>
          <template v-else>{{ formatNumber(r.salesVolume) }} 件</template>
        </span>
      </div>
    </n-scrollbar>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NScrollbar } from 'naive-ui';
import type { DashboardSummary } from '@/api-client/dashboard.api';
import { DEMO_SHOPS } from '@/lib/demo-data';

interface RankRow {
  shopName: string;
  salesVolume: number;
  gmvUsd: number;
  changePct: number | null;
  isDemo: boolean;
}

const props = defineProps<{ data: DashboardSummary | null }>();

const rows = computed<RankRow[]>(() => {
  const real: RankRow[] = (props.data?.shopRanking ?? []).slice(0, 10).map((r) => ({
    shopName: r.shopName,
    salesVolume: r.salesVolume,
    gmvUsd: 0,
    changePct: r.changePct,
    isDemo: false,
  }));
  if (real.length >= 6) return real;
  const demoFill: RankRow[] = DEMO_SHOPS.slice(0, 6 - real.length).map((d) => ({
    shopName: d.shopName,
    salesVolume: 0,
    gmvUsd: d.gmvUsd,
    changePct: d.changePct,
    isDemo: true,
  }));
  return [...real, ...demoFill];
});
const hasPadding = computed(() => rows.value.some((r) => r.isDemo));

function formatNumber(n: number) { return new Intl.NumberFormat('en-US').format(n); }
</script>

<style scoped>
.rank-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 4px; border-bottom: 1px solid #f5f5f5;
}
.rank-row.demo { opacity: 0.85; }
.rank-idx {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 11px;
  background: #f5f5f5; color: #999; font-size: 12px; font-weight: 600;
}
.rank-idx.top3 { background: #2080f0; color: #fff; }
.shop-name { flex: 1; font-size: 13px; color: #333; }
.value { font-size: 13px; font-weight: 500; }
.value.up { color: #18a058; }
.value.down { color: #d03050; }
.empty { text-align: center; color: #bbb; padding: 40px 0; font-size: 13px; }
.demo-tag {
  padding: 1px 6px;
  font-size: 10px;
  border-radius: 3px;
  background: #e8f0ff;
  color: #6686bf;
}
</style>
