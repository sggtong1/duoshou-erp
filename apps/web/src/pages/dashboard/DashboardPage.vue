<template>
  <div class="dashboard">
    <DashboardHeader
      :selected-shop-id="store.selectedShopId"
      :last-synced-at="store.data?.dataFreshness ?? null"
      :syncing="syncing"
      @shop-change="onShopChange"
      @sync-now="onSyncNow"
    />

    <n-alert v-if="!hasFullShop" type="info" style="margin-bottom: 16px;">
      当前 Dashboard 暂只支持全托管店铺。半托店的销售数据 Temu 尚未提供 API,后续版本支持。
    </n-alert>

    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen">
      <n-gi>
        <KpiCard label="今日销量" :value="store.data?.kpis.todayVolume" unit="件" />
      </n-gi>
      <n-gi>
        <KpiCard label="近 7 日销量" :value="store.data?.kpis.sales7dVolume" unit="件" />
      </n-gi>
      <n-gi>
        <KpiCard label="近 30 日销量" :value="store.data?.kpis.sales30dVolume" unit="件" />
      </n-gi>
      <n-gi>
        <KpiCard label="低库存 SKU" :value="store.data?.kpis.lowStockCount" unit="个" :alert-threshold="1" />
      </n-gi>
    </n-grid>

    <n-grid :cols="2" :x-gap="12" :y-gap="12" style="margin-top: 12px;" responsive="screen">
      <n-gi>
        <SalesOverviewChart :data="store.data?.salesOverview ?? null" />
      </n-gi>
      <n-gi>
        <Top30dRankingChart :data="store.data?.top30dRanking ?? null" />
      </n-gi>
    </n-grid>

    <n-grid :cols="2" :x-gap="12" :y-gap="12" style="margin-top: 12px;" responsive="screen">
      <n-gi>
        <TopTodayProductsTable :data="store.data?.topTodayProducts ?? null" />
      </n-gi>
      <n-gi>
        <LowStockAlertsTable :data="store.data?.lowStockAlerts ?? null" />
      </n-gi>
    </n-grid>

    <div
      v-if="store.data?.pendingPriceReviews"
      class="pending-tip"
      @click="$router.push('/price-reviews')"
    >
      📋 你有 {{ store.data.pendingPriceReviews }} 条待处理核价单
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  NGrid, NGi, NAlert, useMessage,
} from 'naive-ui';
import { useDashboardStore } from '@/stores/dashboard';
import { useShopsStore } from '@/stores/shops';
import { dashboardApi } from '@/api-client/dashboard.api';
import DashboardHeader from './components/DashboardHeader.vue';
import KpiCard from './components/KpiCard.vue';
import SalesOverviewChart from './components/SalesOverviewChart.vue';
import Top30dRankingChart from './components/Top30dRankingChart.vue';
import TopTodayProductsTable from './components/TopTodayProductsTable.vue';
import LowStockAlertsTable from './components/LowStockAlertsTable.vue';

const store = useDashboardStore();
const shops = useShopsStore();
const msg = useMessage();

const syncing = ref(false);

const hasFullShop = computed(() =>
  shops.items.some((s) => s.status === 'active' && s.shopType === 'full'),
);

onMounted(async () => {
  await shops.fetch();
  await store.fetch(store.selectedShopId);
});

function onShopChange(shopId: string | null) {
  store.selectedShopId = shopId;
  store.fetch(shopId);
}

async function onSyncNow() {
  syncing.value = true;
  try {
    await dashboardApi.syncNow();
    msg.success('已触发后台同步,稍后数据自动刷新');
    const baseline = store.data?.dataFreshness;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      await store.fetch(store.selectedShopId);
      if (store.data?.dataFreshness && store.data.dataFreshness !== baseline) break;
    }
  } catch (e: any) {
    msg.error(e.message ?? '同步失败');
  } finally { syncing.value = false; }
}
</script>

<style scoped>
.dashboard { max-width: 1400px; margin: 0 auto; }
.pending-tip {
  position: fixed;
  right: 24px;
  bottom: 24px;
  background: #f0f9ff;
  border: 1px solid #2080f0;
  color: #2080f0;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  z-index: 100;
}
.pending-tip:hover { background: #e0f0ff; }
</style>
