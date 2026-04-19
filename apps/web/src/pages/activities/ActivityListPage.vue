<template>
  <n-card title="活动日历">
    <template #header-extra>
      <n-space>
        <n-button :loading="syncing" @click="syncNow">立即同步</n-button>
        <n-button @click="() => load(page)">手动刷新</n-button>
      </n-space>
    </template>

    <n-space style="margin-bottom: 12px;" wrap>
      <n-select v-model:value="region" :options="regionOptions" placeholder="区域" clearable style="min-width: 120px;" @update:value="() => load(1)" />
      <n-select v-model:value="status" :options="statusOptions" placeholder="状态" clearable style="min-width: 120px;" @update:value="() => load(1)" />
      <n-select v-model:value="shopId" :options="shopOptions" placeholder="筛选店铺" clearable style="min-width: 180px;" @update:value="() => load(1)" />
      <n-input v-model:value="search" placeholder="搜索活动名" clearable @keyup.enter="load(1)" style="min-width: 180px;" />
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
import { useRouter } from 'vue-router';
import {
  NCard, NSpace, NSelect, NInput, NButton, NDataTable, NPagination, NTag, useMessage,
} from 'naive-ui';
import { useActivitiesStore } from '@/stores/activities';
import { useShopsStore } from '@/stores/shops';
import { activitiesApi, type Activity } from '@/api-client/activities.api';

const router = useRouter();
const msg = useMessage();
const store = useActivitiesStore();
const shops = useShopsStore();

const region = ref<string | null>(null);
const status = ref<string | null>(null);
const shopId = ref<string | null>(null);
const search = ref('');
const page = ref(1);
const pageSize = 20;
const syncing = ref(false);

onMounted(async () => { await shops.fetch(); load(1); });

const regionOptions = [
  { label: '中国站(CN)', value: 'cn' },
  { label: '美国站(PA)', value: 'pa' },
];
const statusOptions = [
  { label: '招募中', value: 'open' },
  { label: '已截止', value: 'closed' },
  { label: '归档', value: 'archived' },
];
const shopOptions = computed(() =>
  shops.items.map((s) => ({ label: s.displayName ?? s.platformShopId, value: s.id })),
);

async function load(p = page.value) {
  page.value = p;
  await store.fetch({
    region: region.value ?? undefined,
    status: status.value ?? undefined,
    shopId: shopId.value ?? undefined,
    search: search.value || undefined,
    page: p, pageSize,
  });
}

async function syncNow() {
  syncing.value = true;
  try {
    await activitiesApi.syncNow();
    msg.success('已触发后台同步,请稍后点「手动刷新」查看最新结果');
  } catch (e: any) {
    msg.error(e.message);
  } finally { syncing.value = false; }
}

const pageCount = computed(() => Math.max(1, Math.ceil(store.total / pageSize)));

const columns: any[] = [
  { title: '活动', key: 'title', render: (r: Activity) => r.title ?? r.platformActivityId },
  { title: '类型', key: 'activityType' },
  {
    title: '时间窗',
    key: 'timeWindow',
    render: (r: Activity) => {
      const s = r.startAt ? new Date(r.startAt).toLocaleDateString() : '—';
      const e = r.endAt ? new Date(r.endAt).toLocaleDateString() : '—';
      return `${s} — ${e}`;
    },
  },
  {
    title: '截止报名',
    key: 'enrollEndAt',
    render: (r: Activity) => r.enrollEndAt ? new Date(r.enrollEndAt).toLocaleString() : '—',
  },
  {
    title: '跨店状态',
    key: 'crossShop',
    render: (r: Activity) => h('div', { style: 'line-height: 1.6;' }, [
      h('div', `📦 ${r.shopCount} 店可报`),
      h('div', `✅ ${r.enrolledShopCount} 店已报`),
      h('div', `📝 已报 ${r.enrolledSkuCount} SKU`),
    ]),
  },
  {
    title: '状态',
    key: 'status',
    render: (r: Activity) => h(NTag, {
      type: r.status === 'open' ? 'info' : r.status === 'closed' ? 'warning' : 'default',
    }, () => r.status),
  },
  {
    title: '操作',
    key: 'actions',
    render: (r: Activity) => h(NButton, { size: 'small', onClick: () => router.push(`/activities/${r.id}`) }, () => '详情'),
  },
];
</script>
