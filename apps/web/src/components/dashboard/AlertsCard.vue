<template>
  <n-card title="异常预警" :bordered="false">
    <div class="alert-row" @click="$router.push('/inventory-alerts')">
      <n-icon :size="20" color="#f0a020">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21z"/></svg>
      </n-icon>
      <span class="alert-label">低库存 SKU</span>
      <span class="alert-value">{{ data?.alerts.lowStockCount ?? 0 }}</span>
    </div>

    <n-tooltip placement="top">
      <template #trigger>
        <div class="alert-row placeholder">
          <n-icon :size="20" color="#ddd">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
          </n-icon>
          <span class="alert-label">低 ROI 商品</span>
          <span class="alert-value">—</span>
        </div>
      </template>
      低 ROI 商品:需广告 API,v1.3 支持
    </n-tooltip>

    <n-tooltip placement="top">
      <template #trigger>
        <div class="alert-row placeholder">
          <n-icon :size="20" color="#ddd">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
          </n-icon>
          <span class="alert-label">销量下滑店铺</span>
          <span class="alert-value">—</span>
        </div>
      </template>
      销量下滑店铺:需订单数据,v1.2 支持
    </n-tooltip>

    <div v-if="data && data.pendingPriceReviews > 0" class="alert-row" @click="$router.push('/price-reviews')">
      <n-icon :size="20" color="#2080f0">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
      </n-icon>
      <span class="alert-label">待处理核价单</span>
      <span class="alert-value">{{ data.pendingPriceReviews }}</span>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NIcon, NTooltip } from 'naive-ui';
import type { DashboardSummary } from '@/api-client/dashboard.api';

defineProps<{ data: DashboardSummary | null }>();
</script>

<style scoped>
.alert-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 8px; border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
}
.alert-row:hover:not(.placeholder) { background: #fafafa; }
.alert-row.placeholder { cursor: not-allowed; opacity: 0.55; }
.alert-label { flex: 1; font-size: 13px; color: #333; }
.alert-value { font-size: 16px; font-weight: 600; color: #d03050; }
.placeholder .alert-value { color: #ccc; }
</style>
