<template>
  <n-card v-if="r" :title="'核价单 ' + r.platformOrderId">
    <n-alert type="info" style="margin-bottom: 12px;">
      只读视图。同意/拒绝请在 Temu 卖家中心操作。
    </n-alert>

    <n-descriptions :column="2">
      <n-descriptions-item label="SKU">{{ r.skuTitle ?? r.platformSkuId ?? '—' }}</n-descriptions-item>
      <n-descriptions-item label="店铺">{{ r.shop?.displayName ?? r.shop?.platformShopId }}</n-descriptions-item>
      <n-descriptions-item label="现价">
        {{ r.currentPriceCents != null ? (r.currentPriceCents / 100).toFixed(2) : '—' }} {{ r.currency }}
      </n-descriptions-item>
      <n-descriptions-item label="建议价">
        {{ r.suggestedPriceCents != null ? (r.suggestedPriceCents / 100).toFixed(2) : '—' }} {{ r.currency }}
      </n-descriptions-item>
      <n-descriptions-item label="状态">
        <n-tag>{{ r.status }}</n-tag>
      </n-descriptions-item>
      <n-descriptions-item label="截止">{{ r.deadlineAt ?? '—' }}</n-descriptions-item>
      <n-descriptions-item label="原因" :span="2">{{ r.reason ?? '—' }}</n-descriptions-item>
    </n-descriptions>
  </n-card>
  <n-spin v-else />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  NCard, NDescriptions, NDescriptionsItem, NTag, NSpin, NAlert,
} from 'naive-ui';
import { priceReviewsApi, type PriceReview } from '@/api-client/price-reviews.api';

const route = useRoute();
const r = ref<PriceReview | null>(null);

async function load() {
  r.value = await priceReviewsApi.get(String(route.params.id));
}

onMounted(load);
</script>
