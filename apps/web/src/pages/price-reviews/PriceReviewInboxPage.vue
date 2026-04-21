<template>
  <n-card title="核价单(只读)">
    <n-alert type="info" style="margin-bottom: 12px;">
      当前模块为只读提醒视图。批量同意/拒绝请到
      <a href="https://agentseller.temu.com" target="_blank">Temu 卖家中心</a> 操作。
    </n-alert>

    <n-space style="margin-bottom: 12px;">
      <n-select v-model:value="shopId" :options="shopOptions" placeholder="按店铺" clearable style="min-width: 180px;" @update:value="() => load(1)" />
      <n-select v-model:value="status" :options="statusOptions" placeholder="按状态" clearable style="min-width: 130px;" @update:value="() => load(1)" />
      <n-input v-model:value="search" placeholder="按 SKU 标题搜索" clearable @keyup.enter="load(1)" />
    </n-space>

    <n-data-table
      :columns="columns"
      :data="store.items"
      :loading="store.loading"
      :row-key="(r: any) => r.id"
    />

    <n-pagination v-model:page="page" :page-count="pageCount" @update:page="load" />
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NSpace, NSelect, NInput, NButton, NDataTable, NPagination,
  NTag, NAlert,
} from 'naive-ui';
import { usePriceReviewsStore } from '@/stores/price-reviews';
import { useShopsStore } from '@/stores/shops';
import { type PriceReview } from '@/api-client/price-reviews.api';

const router = useRouter();
const store = usePriceReviewsStore();
const shops = useShopsStore();

const shopId = ref<string | null>(null);
const status = ref<string | null>(null);
const search = ref('');
const page = ref(1);
const pageSize = 20;

onMounted(async () => { await shops.fetch(); load(1); });

const shopOptions = computed(() =>
  shops.items.map((s) => ({ label: s.displayName ?? s.platformShopId, value: s.id })),
);
const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '已同意', value: 'confirmed' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已过期', value: 'expired' },
];

async function load(p = page.value) {
  page.value = p;
  await store.fetch({
    shopId: shopId.value ?? undefined,
    status: status.value as any ?? undefined,
    search: search.value || undefined,
    page: p,
    pageSize,
  });
}

const pageCount = computed(() => Math.max(1, Math.ceil(store.total / pageSize)));

const columns: any[] = [
  { title: 'SKU', key: 'skuTitle', render: (r: PriceReview) => r.skuTitle ?? r.platformSkuId ?? '—' },
  { title: '店铺', key: 'shop', render: (r: PriceReview) => r.shop?.displayName ?? r.shop?.platformShopId },
  {
    title: '现价',
    key: 'currentPriceCents',
    render: (r: PriceReview) => r.currentPriceCents != null ? `${(r.currentPriceCents / 100).toFixed(2)} ${r.currency ?? ''}` : '—',
  },
  {
    title: '建议价',
    key: 'suggestedPriceCents',
    render: (r: PriceReview) => r.suggestedPriceCents != null ? `${(r.suggestedPriceCents / 100).toFixed(2)} ${r.currency ?? ''}` : '—',
  },
  {
    title: '状态',
    key: 'status',
    render: (r: PriceReview) => h(NTag, {
      type: r.status === 'confirmed' ? 'success' : r.status === 'rejected' ? 'warning' : r.status === 'expired' ? 'error' : 'info',
    }, () => r.status),
  },
  { title: '收到', key: 'receivedAt' },
  {
    title: '操作',
    key: 'actions',
    render: (r: PriceReview) => h(NButton, { size: 'small', onClick: () => router.push(`/price-reviews/${r.id}`) }, () => '详情'),
  },
];
</script>
