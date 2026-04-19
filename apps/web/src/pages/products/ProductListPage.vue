<template>
  <n-card title="我的商品（跨店）">
    <n-space style="margin-bottom: 12px;">
      <n-input
        v-model:value="search"
        placeholder="按标题搜索"
        clearable
        @keyup.enter="load(1)"
        @update:value="() => load(1)"
      />
      <n-select
        v-model:value="shopId"
        :options="shopOptions"
        placeholder="按店铺筛选"
        clearable
        style="min-width: 200px;"
        @update:value="() => load(1)"
      />
    </n-space>
    <n-data-table
      :columns="columns"
      :data="rows.items"
      :loading="loading"
      :row-key="(r: any) => r.id"
    />
    <n-pagination
      v-model:page="page"
      :page-count="pageCount"
      @update:page="load"
    />
  </n-card>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { NCard, NDataTable, NInput, NSelect, NSpace, NPagination } from 'naive-ui';
import { productsApi } from '@/api-client/products.api';
import { useShopsStore } from '@/stores/shops';

const shops = useShopsStore();
const shopOptions = computed(() =>
  shops.items.map((s) => ({
    label: s.displayName ?? s.platformShopId,
    value: s.id,
  })),
);
const search = ref('');
const shopId = ref<string | null>(null);
const page = ref(1);
const pageSize = 20;
const rows = ref<{ total: number; page: number; pageSize: number; items: any[] }>({
  total: 0, page: 1, pageSize, items: [],
});
const loading = ref(false);

async function load(p = page.value) {
  loading.value = true;
  try {
    rows.value = await productsApi.list({
      page: p,
      pageSize,
      search: search.value || undefined,
      shopId: shopId.value ?? undefined,
    });
    page.value = p;
  } finally { loading.value = false; }
}

const pageCount = computed(() =>
  Math.max(1, Math.ceil(rows.value.total / rows.value.pageSize)),
);

onMounted(async () => {
  await shops.fetch();
  load(1);
});

const columns = [
  { title: '标题', key: 'title' },
  {
    title: '店铺',
    key: 'shop',
    render: (r: any) => r.shop?.displayName ?? r.shop?.platformShopId,
  },
  { title: '平台 ID', key: 'platformProductId' },
  { title: '状态', key: 'status' },
  { title: '最后同步', key: 'lastSyncedAt' },
];
</script>
