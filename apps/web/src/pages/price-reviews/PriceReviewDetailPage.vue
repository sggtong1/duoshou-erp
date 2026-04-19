<template>
  <n-card v-if="r" :title="'核价单 ' + r.platformOrderId">
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

    <n-space style="margin-top: 16px;" v-if="r.status === 'pending'">
      <n-button type="primary" :loading="acting" @click="confirm">同意</n-button>
      <n-input-number v-model:value="counterCents" :min="1" placeholder="反报价（分）" />
      <n-button :loading="acting" @click="reject">提交拒绝</n-button>
    </n-space>
  </n-card>
  <n-spin v-else />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NCard, NDescriptions, NDescriptionsItem, NTag, NSpace, NButton, NInputNumber, NSpin, useMessage,
} from 'naive-ui';
import { priceReviewsApi, type PriceReview } from '@/api-client/price-reviews.api';

const route = useRoute();
const router = useRouter();
const msg = useMessage();
const r = ref<PriceReview | null>(null);
const counterCents = ref<number>(100);
const acting = ref(false);

async function load() {
  r.value = await priceReviewsApi.get(String(route.params.id));
}

onMounted(load);

async function confirm() {
  acting.value = true;
  try { await priceReviewsApi.batchConfirm([r.value!.id]); msg.success('已同意'); router.push('/price-reviews'); }
  catch (e: any) { msg.error(e.message); }
  finally { acting.value = false; }
}

async function reject() {
  acting.value = true;
  try {
    await priceReviewsApi.batchReject([r.value!.id], { [r.value!.id]: counterCents.value });
    msg.success('已提交反报价');
    router.push('/price-reviews');
  } catch (e: any) { msg.error(e.message); }
  finally { acting.value = false; }
}
</script>
