<template>
  <div class="review-detail page-shell">
    <div class="page-hero">
      <div>
        <p class="page-eyebrow">PRICE REVIEW DETAIL</p>
        <h1 class="page-title-main">核价单 {{ r?.platformOrderId ?? '' }}</h1>
        <p class="page-subtitle">查看平台核价明细；同意、拒绝和批量处理请回到价格操作台统一完成。</p>
      </div>
      <n-button type="primary" @click="$router.push('/pricing-ops')">返回价格操作台</n-button>
    </div>

    <n-card v-if="r" title="核价明细">
      <n-descriptions :column="2" bordered size="small">
        <n-descriptions-item label="SKU">{{ r.skuTitle ?? r.platformSkuId ?? '—' }}</n-descriptions-item>
        <n-descriptions-item label="店铺">{{ r.shop?.displayName ?? r.shop?.platformShopId }}</n-descriptions-item>
        <n-descriptions-item label="现价">
          {{ r.currentPriceCents != null ? (r.currentPriceCents / 100).toFixed(2) : '—' }} {{ r.currency }}
        </n-descriptions-item>
        <n-descriptions-item label="建议价">
          {{ r.suggestedPriceCents != null ? (r.suggestedPriceCents / 100).toFixed(2) : '—' }} {{ r.currency }}
        </n-descriptions-item>
        <n-descriptions-item label="状态">
          <n-tag :bordered="false">{{ r.status }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="截止">{{ r.deadlineAt ?? '—' }}</n-descriptions-item>
        <n-descriptions-item label="原因" :span="2">{{ r.reason ?? '—' }}</n-descriptions-item>
      </n-descriptions>
    </n-card>
    <n-spin v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  NButton, NCard, NDescriptions, NDescriptionsItem, NTag, NSpin,
} from 'naive-ui';
import { priceReviewsApi, type PriceReview } from '@/api-client/price-reviews.api';

const route = useRoute();
const r = ref<PriceReview | null>(null);

async function load() {
  r.value = await priceReviewsApi.get(String(route.params.id));
}

onMounted(load);
</script>
