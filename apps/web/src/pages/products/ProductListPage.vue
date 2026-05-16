<template>
  <div class="products-page page-shell">
    <div class="page-hero">
      <div>
        <p class="page-eyebrow">PRODUCT CENTER</p>
        <h1 class="page-title-main">商品管理</h1>
        <p class="page-subtitle">聚合跨店商品与平台 ID，作为 BI 分析和运营动作的商品主数据入口。</p>
      </div>
    </div>

    <n-card title="跨店商品">
      <div class="table-toolbar">
        <n-input
          v-model:value="search"
          placeholder="搜索商品标题"
          clearable
          @keyup.enter="load(1)"
          @update:value="() => load(1)"
        />
        <n-select
          v-model:value="shopId"
          :options="shopOptions"
          placeholder="按店铺筛选"
          clearable
          class="shop-filter"
          @update:value="() => load(1)"
        />
      </div>
      <n-data-table
        :columns="columns"
        :data="rows.items"
        :loading="loading"
        :row-key="(r: any) => r.id"
        size="small"
      />
      <n-pagination
        v-model:page="page"
        :page-count="pageCount"
        class="pager"
        @update:page="load"
      />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { h, onMounted, ref, computed } from 'vue';
import { NCard, NDataTable, NInput, NSelect, NPagination, NTag } from 'naive-ui';
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
  {
    title: '商品',
    key: 'title',
    minWidth: 260,
    render: (r: any) => h('div', null, [
      h('div', { class: 'table-strong' }, r.title ?? '未命名商品'),
      h('div', { class: 'table-muted' }, r.platformProductId ?? '无平台 ID'),
    ]),
  },
  {
    title: '店铺',
    key: 'shop',
    render: (r: any) => r.shop?.displayName ?? r.shop?.platformShopId,
  },
  {
    title: '状态',
    key: 'status',
    render: (r: any) => h(NTag, { size: 'small', bordered: false }, () => r.status ?? 'unknown'),
  },
  { title: '最后同步', key: 'lastSyncedAt' },
];
</script>

<style scoped>
.table-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.table-toolbar :deep(.n-input) {
  max-width: 360px;
}
.shop-filter {
  min-width: 220px;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
