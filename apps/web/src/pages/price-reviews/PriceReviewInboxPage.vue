<template>
  <n-card title="核价单收件箱">
    <n-space style="margin-bottom: 12px;">
      <n-select v-model:value="shopId" :options="shopOptions" placeholder="按店铺" clearable style="min-width: 180px;" @update:value="() => load(1)" />
      <n-select v-model:value="status" :options="statusOptions" placeholder="按状态" clearable style="min-width: 130px;" @update:value="() => load(1)" />
      <n-input v-model:value="search" placeholder="按 SKU 标题搜索" clearable @keyup.enter="load(1)" />
    </n-space>

    <n-space style="margin-bottom: 12px;" v-if="selected.length">
      <n-button type="primary" :loading="acting" @click="doBatchConfirm">批量同意（{{ selected.length }}）</n-button>
      <n-button :loading="acting" @click="openRejectDialog">批量拒绝</n-button>
    </n-space>

    <n-data-table
      :columns="columns"
      :data="store.items"
      :loading="store.loading"
      :row-key="(r: any) => r.id"
      :checked-row-keys="selected"
      @update:checked-row-keys="(v: any) => (selected = v)"
    />

    <n-pagination v-model:page="page" :page-count="pageCount" @update:page="load" />

    <n-modal v-model:show="rejectOpen" preset="card" title="批量拒绝 — 给出反报价" style="width: 600px;">
      <n-table>
        <thead>
          <tr><th>SKU</th><th>Temu 建议价</th><th>我方反报价（分）</th></tr>
        </thead>
        <tbody>
          <tr v-for="id in selected" :key="id">
            <td>{{ store.items.find((x) => x.id === id)?.skuTitle ?? id.slice(0, 8) }}</td>
            <td>
              {{
                (() => {
                  const item = store.items.find((x) => x.id === id);
                  return item?.suggestedPriceCents != null
                    ? `${(item.suggestedPriceCents / 100).toFixed(2)} ${item.currency ?? ''}`
                    : '—';
                })()
              }}
            </td>
            <td><n-input-number v-model:value="counters[id]" :min="1" /></td>
          </tr>
        </tbody>
      </n-table>
      <template #footer>
        <n-button type="primary" :loading="acting" @click="doBatchReject">提交</n-button>
      </template>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NSpace, NSelect, NInput, NButton, NDataTable, NPagination,
  NModal, NTable, NInputNumber, NTag, useMessage,
} from 'naive-ui';
import { usePriceReviewsStore } from '@/stores/price-reviews';
import { useShopsStore } from '@/stores/shops';
import { priceReviewsApi, type PriceReview } from '@/api-client/price-reviews.api';

const router = useRouter();
const msg = useMessage();
const store = usePriceReviewsStore();
const shops = useShopsStore();

const shopId = ref<string | null>(null);
const status = ref<string | null>(null);
const search = ref('');
const page = ref(1);
const pageSize = 20;
const selected = ref<string[]>([]);
const acting = ref(false);
const rejectOpen = ref(false);
const counters = ref<Record<string, number>>({});

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
  { type: 'selection' },
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

async function doBatchConfirm() {
  acting.value = true;
  try {
    const r = await priceReviewsApi.batchConfirm(selected.value);
    const ok = r.results.filter((x) => x.ok).length;
    msg.success(`${ok}/${r.total} 成功`);
    selected.value = [];
    load();
  } catch (e: any) {
    msg.error(e.message);
  } finally { acting.value = false; }
}

function openRejectDialog() {
  counters.value = Object.fromEntries(
    selected.value.map((id) => [id, store.items.find((x) => x.id === id)?.currentPriceCents ?? 100]),
  );
  rejectOpen.value = true;
}

async function doBatchReject() {
  acting.value = true;
  try {
    const r = await priceReviewsApi.batchReject(selected.value, counters.value);
    const ok = r.results.filter((x) => x.ok).length;
    msg.success(`${ok}/${r.total} 成功`);
    selected.value = [];
    rejectOpen.value = false;
    load();
  } catch (e: any) {
    msg.error(e.message);
  } finally { acting.value = false; }
}
</script>
