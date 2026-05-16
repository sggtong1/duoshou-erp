<template>
  <div class="dashboard page-shell">
    <div class="page-hero">
      <div>
        <p class="page-eyebrow">BUSINESS COMMAND CENTER</p>
        <h1 class="page-title-main">跨平台经营总览</h1>
        <p class="page-subtitle">
          聚合店铺、商品、库存与利润指标，帮助运营团队从数据洞察快速进入执行动作。
        </p>
      </div>
      <div class="hero-actions">
        <span v-if="dashboard.error" class="err">{{ dashboard.error }}</span>
        <n-button :loading="syncing" secondary @click="onSyncNow">立即同步</n-button>
        <n-button type="primary" @click="$router.push('/pricing-ops')">处理价格任务</n-button>
      </div>
    </div>

    <n-grid :cols="8" :x-gap="12" :y-gap="12" responsive="screen" :item-responsive="true">
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="销量" :value="kpis?.salesVolume ?? 0" unit="件" :spark-shape="0" :change-pct="realVolumeChange" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="GMV" :value="DEMO_KPIS.gmvCents / 100" unit="$" placeholder placeholder-reason="GMV:演示数据,v1.2 接入订单 API 后真实化" :spark-shape="1" :change-pct="12.45" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="订单量" :value="DEMO_KPIS.orderCount" unit="单" placeholder placeholder-reason="订单量:演示数据,v1.2 接入订单 API 后真实化" :spark-shape="2" :change-pct="8.32" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="净收益" :value="DEMO_KPIS.netProfitCents / 100" unit="$" placeholder placeholder-reason="净收益:演示数据,v1.3 接入订单+成本后真实化" :spark-shape="0" :change-pct="15.67" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="毛利润" :value="DEMO_KPIS.grossProfitCents / 100" unit="$" placeholder placeholder-reason="毛利润:演示数据,v1.2 上传成本后真实化" :spark-shape="1" :change-pct="10.21" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="毛利率" :value="DEMO_KPIS.grossMarginPct" unit="%" placeholder placeholder-reason="毛利率:演示数据,v1.2 上传成本后真实化" :spark-shape="2" :change-pct="1.25" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="广告花费" :value="DEMO_KPIS.adSpendCents / 100" unit="$" placeholder placeholder-reason="广告花费:演示数据,v1.3 接入广告 API 后真实化" :spark-shape="0" :change-pct="-9.31" />
      </n-gi>
      <n-gi :span="'s:4 m:2 l:2'">
        <KpiCard label="ROAS" :value="DEMO_KPIS.roas" placeholder placeholder-reason="ROAS:演示数据,v1.3 接入广告 API 后真实化" :spark-shape="1" :change-pct="11.24" />
      </n-gi>
    </n-grid>

    <div class="section-title">
      <strong>经营趋势</strong>
      <span>销售、平台与店铺表现</span>
    </div>
    <n-grid :cols="12" :x-gap="12" :y-gap="12" responsive="screen" :item-responsive="true">
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

    <div class="section-title">
      <strong>结构分析</strong>
      <span>区域、广告、SKU 与漏斗观察</span>
    </div>
    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen" :item-responsive="true">
      <n-gi :span="'s:4 m:2 l:1'"><RegionDonutChart :data="dashboard.data" /></n-gi>
      <n-gi :span="'s:4 m:2 l:1'"><AdPerformanceChart /></n-gi>
      <n-gi :span="'s:4 m:2 l:1'"><TopSkuListCard :data="dashboard.data" :time-range="filters.timeRange" /></n-gi>
      <n-gi :span="'s:4 m:2 l:1'"><FunnelChart /></n-gi>
    </n-grid>

    <div class="section-title">
      <strong>运营明细</strong>
      <span>商品、异常与实时事项</span>
    </div>
    <n-grid :cols="12" :x-gap="12" :y-gap="12" responsive="screen" :item-responsive="true">
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
import { DEMO_KPIS } from '@/lib/demo-data';

const dashboard = useDashboardStore();
const filters = useFiltersStore();
const msg = useMessage();

const kpis = computed(() => dashboard.data?.kpis);
const syncing = ref(false);
const realVolumeChange = null; // Real change-% comparison not yet computed; leave null so no arrow shows on real KPI

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
.hero-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; flex-wrap: wrap; }
.err { color: #d03050; font-size: 12px; }
.section-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 18px 0 10px;
}
.section-title strong {
  color: var(--ds-ink);
  font-size: 16px;
}
.section-title span {
  color: var(--ds-muted);
  font-size: 12px;
}
</style>
