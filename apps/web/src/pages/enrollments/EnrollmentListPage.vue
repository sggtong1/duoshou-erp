<template>
  <n-card title="已报名活动">
    <template #header-extra>
      <n-button :loading="syncing" @click="syncNow">立即同步</n-button>
    </template>

    <n-space style="margin-bottom: 12px;">
      <n-select v-model:value="shopId" :options="shopOptions" placeholder="店铺" clearable style="min-width: 180px;" @update:value="() => load(1)" />
      <n-select v-model:value="status" :options="statusOptions" placeholder="状态" clearable style="min-width: 130px;" @update:value="() => load(1)" />
    </n-space>

    <n-data-table
      :columns="columns"
      :data="store.items"
      :loading="store.loading"
      :row-key="(r: any) => r.id"
    />

    <n-pagination v-model:page="page" :page-count="pageCount" @update:page="load" style="margin-top: 12px;" />
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import {
  NCard, NSpace, NSelect, NDataTable, NPagination, NTag, NButton, useMessage,
} from 'naive-ui';
import { useEnrollmentsStore } from '@/stores/enrollments';
import { useShopsStore } from '@/stores/shops';
import { enrollmentsApi, type Enrollment } from '@/api-client/enrollments.api';

const msg = useMessage();
const store = useEnrollmentsStore();
const shops = useShopsStore();

const shopId = ref<string | null>(null);
const status = ref<string | null>(null);
const page = ref(1);
const pageSize = 20;
const syncing = ref(false);

onMounted(async () => { await shops.fetch(); load(1); });

const statusOptions = [
  { label: '审核中', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已撤销', value: 'withdrawn' },
  { label: '失败', value: 'failed' },
];
const shopOptions = computed(() =>
  shops.items.map((s) => ({ label: s.displayName ?? s.platformShopId, value: s.id })),
);

async function load(p = page.value) {
  page.value = p;
  await store.fetch({
    shopId: shopId.value ?? undefined,
    status: status.value ?? undefined,
    page: p, pageSize,
  });
}

async function syncNow() {
  syncing.value = true;
  try {
    await enrollmentsApi.syncNow();
    msg.success('已触发后台同步,请稍后刷新查看最新结果');
  } catch (e: any) { msg.error(e.message); }
  finally { syncing.value = false; }
}

async function refresh(id: string) {
  try {
    await enrollmentsApi.refresh(id);
    msg.success('已刷新');
    load();
  } catch (e: any) { msg.error(e.message); }
}

const pageCount = computed(() => Math.max(1, Math.ceil(store.total / pageSize)));

const columns: any[] = [
  {
    title: '活动',
    key: 'activity',
    render: (r: Enrollment) => r.activity?.title ?? r.activity?.platformActivityId ?? '—',
  },
  {
    title: '店铺',
    key: 'shop',
    render: (r: Enrollment) => r.shop?.displayName ?? r.shop?.platformShopId ?? '—',
  },
  { title: 'SKU', key: 'platformSkuId', render: (r: Enrollment) => r.skuTitle ?? r.platformSkuId },
  {
    title: '活动价',
    key: 'activityPriceCents',
    render: (r: Enrollment) => r.activityPriceCents != null ? `${(r.activityPriceCents / 100).toFixed(2)} ${r.currency ?? ''}` : '—',
  },
  {
    title: '状态',
    key: 'status',
    render: (r: Enrollment) => {
      const type = r.status === 'approved' ? 'success' :
        r.status === 'rejected' ? 'warning' :
        r.status === 'failed' ? 'error' :
        r.status === 'withdrawn' ? 'default' : 'info';
      return h(NTag, { type }, () => r.status);
    },
  },
  {
    title: '提交时间',
    key: 'submittedAt',
    render: (r: Enrollment) => new Date(r.submittedAt).toLocaleString(),
  },
  {
    title: '操作',
    key: 'actions',
    render: (r: Enrollment) => r.status === 'pending'
      ? h(NButton, { size: 'small', onClick: () => refresh(r.id) }, () => '刷新')
      : h(NButton, { size: 'small', secondary: true, disabled: true }, () => '—'),
  },
];
</script>
