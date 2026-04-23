<template>
  <div class="dashboard">
    <div class="sync-bar">
      <span v-if="dashboard.error" class="err">{{ dashboard.error }}</span>
      <n-button :loading="syncing" size="small" @click="onSyncNow">🔄 立即同步</n-button>
    </div>

    <n-grid :cols="8" :x-gap="12" :y-gap="12" responsive="screen" :item-responsive="true">
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="销量" :value="kpis?.salesVolume" unit="件" :spark-shape="0" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="GMV" :value="null" unit="¥" placeholder placeholder-reason="GMV:需订单数据,v1.2 支持" :spark-shape="1" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="订单量" :value="null" unit="单" placeholder placeholder-reason="订单量:需订单数据,v1.2 支持" :spark-shape="2" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="净收益" :value="null" unit="¥" placeholder placeholder-reason="净收益:需订单+成本数据,v1.3 支持" :spark-shape="0" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="毛利润" :value="null" unit="¥" placeholder placeholder-reason="毛利润:需成本上传,v1.2 支持" :spark-shape="1" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="毛利率" :value="null" unit="%" placeholder placeholder-reason="毛利率:需成本上传,v1.2 支持" :spark-shape="2" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="广告花费" :value="null" unit="¥" placeholder placeholder-reason="广告花费:需广告 API,v1.3 支持" :spark-shape="0" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="ROAS" :value="null" placeholder placeholder-reason="ROAS:需广告 API,v1.3 支持" :spark-shape="1" />
      </n-gi>
    </n-grid>

    <n-grid :cols="12" :x-gap="12" :y-gap="12" responsive="screen" style="margin-top: 12px;">
      <n-gi :span="'s:12 m:12 l:8'">
        <GmvOrdersTrendChart :data="dashboard.data" />
      </n-gi>
      <n-gi :span="'s:12 m:6 l:2'">
        <PlatformComparisonChart :data="dashboard.data" />
      </n-gi>
      <n-gi :span="'s:12 m:6 l:2'">
        <ShopSalesRankCard :data="dashboard.data" />
      </n-gi>
    </n-grid>

    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen" style="margin-top: 12px;">
      <n-gi :span="'s:4 m:2 l:1'"><RegionDonutChart :data="dashboard.data" /></n-gi>
      <n-gi :span="'s:4 m:2 l:1'"><AdPerformanceChart /></n-gi>
      <n-gi :span="'s:4 m:2 l:1'"><TopSkuListCard :data="dashboard.data" :time-range="filters.timeRange" /></n-gi>
      <n-gi :span="'s:4 m:2 l:1'"><FunnelChart /></n-gi>
    </n-grid>

    <n-grid :cols="12" :x-gap="12" :y-gap="12" responsive="screen" style="margin-top: 12px;">
      <n-gi :span="'s:12 m:12 l:8'">
        <ProductDetailTable :data="dashboard.data" :time-range="filters.timeRange" />
      </n-gi>
      <n-gi :span="'s:12 m:6 l:2'">
        <AlertsCard :data="dashboard.data" />
      </n-gi>
      <n-gi :span="'s:12 m:6 l:2'">
        <LiveActivityCard />
      </n-gi>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, onUnmounted } from 'vue';
import { NGrid, NGi, NButton, useMessage } from 'naive-ui';
import { useDashboardStore } from '@/stores/dashboard';
import { useFiltersStore } from '@/stores/filters';
import { dashboardApi } from '@/api-client/dashboard.api';
import KpiCard from '@/components/dashboard/KpiCard.vue';
import GmvOrdersTrendChart from '@/components/dashboard/GmvOrdersTrendChart.vue';
import PlatformComparisonChart from '@/components/dashboard/PlatformComparisonChart.vue';
import ShopSalesRankCard from '@/components/dashboard/ShopSalesRankCard.vue';
import RegionDonutChart from '@/components/dashboard/RegionDonutChart.vue';
import AdPerformanceChart from '@/components/dashboard/AdPerformanceChart.vue';
import TopSkuListCard from '@/components/dashboard/TopSkuListCard.vue';
import FunnelChart from '@/components/dashboard/FunnelChart.vue';
import ProductDetailTable from '@/components/dashboard/ProductDetailTable.vue';
import AlertsCard from '@/components/dashboard/AlertsCard.vue';
import LiveActivityCard from '@/components/dashboard/LiveActivityCard.vue';

const dashboard = useDashboardStore();
const filters = useFiltersStore();
const msg = useMessage();

const kpis = computed(() => dashboard.data?.kpis);
const syncing = ref(false);

const unsub = filters.onChange(() => dashboard.fetch(filters.toQuery()));
onMounted(() => {
  if (!dashboard.data) dashboard.fetch(filters.toQuery());
});
onUnmounted(() => unsub());

async function onSyncNow() {
  syncing.value = true;
  try {
    await dashboardApi.syncNow();
    msg.success('已触发后台同步,稍后数据自动刷新');
    const baseline = dashboard.data?.dataFreshness;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      await dashboard.fetch(filters.toQuery());
      if (dashboard.data?.dataFreshness && dashboard.data.dataFreshness !== baseline) break;
    }
  } catch (e: any) {
    msg.error(e?.message ?? '同步失败');
  } finally {
    syncing.value = false;
  }
}
</script>

<style scoped>
.dashboard { max-width: 1600px; margin: 0 auto; }
.sync-bar { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-bottom: 10px; }
.err { color: #d03050; font-size: 12px; }
</style>
