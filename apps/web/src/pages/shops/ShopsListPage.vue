<template>
  <div class="shops-page page-shell">
    <div class="page-hero">
      <div>
        <p class="page-eyebrow">SHOP CONNECTIONS</p>
        <h1 class="page-title-main">店铺连接</h1>
        <p class="page-subtitle">统一管理多平台店铺授权、同步状态与运营数据入口。</p>
      </div>
      <n-button type="primary" @click="$router.push('/shops/new')">添加店铺</n-button>
    </div>

    <n-grid :cols="3" :x-gap="12" :y-gap="12" responsive="screen" class="shop-metrics">
      <n-gi>
        <div class="metric-card">
          <div class="metric-label">已接入店铺</div>
          <div class="metric-value">{{ shops.items.length }}</div>
        </div>
      </n-gi>
      <n-gi>
        <div class="metric-card">
          <div class="metric-label">在线授权</div>
          <div class="metric-value">{{ activeCount }}</div>
        </div>
      </n-gi>
      <n-gi>
        <div class="metric-card">
          <div class="metric-label">支持平台</div>
          <div class="metric-value">{{ platformCount }}</div>
        </div>
      </n-gi>
    </n-grid>

    <n-card title="授权店铺">
      <n-empty v-if="!shops.loading && shops.items.length === 0" description="还没有连接任何店铺">
        <template #extra>
          <n-button type="primary" @click="$router.push('/shops/new')">连接第一家店铺</n-button>
        </template>
      </n-empty>

      <n-data-table
        v-else
        :columns="columns"
        :data="shops.items"
        :loading="shops.loading"
        :row-key="(r: any) => r.id"
        size="small"
      />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, h } from 'vue';
import {
  NCard, NButton, NDataTable, NEmpty, NGi, NGrid, NTag, NPopconfirm, useMessage,
} from 'naive-ui';
import { useShopsStore } from '@/stores/shops';
import { shopsApi, type Shop } from '@/api-client/shops.api';

const msg = useMessage();
const shops = useShopsStore();

onMounted(() => shops.fetch());

const activeCount = computed(() => shops.items.filter((shop) => shop.status === 'active').length);
const platformCount = computed(() => new Set(shops.items.map((shop) => shop.platform)).size || 0);

async function doDisconnect(id: string) {
  try {
    await shopsApi.disconnect(id);
    msg.success('已断开');
    await shops.fetch();
  } catch (e: any) {
    msg.error(e.message ?? '断开失败');
  }
}

const columns: any[] = [
  {
    title: '店铺',
    key: 'displayName',
    minWidth: 220,
    render: (r: Shop) => h('div', null, [
      h('div', { class: 'table-strong' }, r.displayName ?? r.platformShopId),
      h('div', { class: 'table-muted' }, r.platformShopId),
    ]),
  },
  { title: '平台', key: 'platform', render: (r: Shop) => r.platform.toUpperCase() },
  {
    title: '类型',
    key: 'shopType',
    render: (r: Shop) => r.shopType === 'full' ? '全托管' : '半托管',
  },
  {
    title: '区域',
    key: 'region',
    render: (r: Shop) => r.region === 'cn' ? 'CN' : 'PA',
  },
  {
    title: '状态',
    key: 'status',
    render: (r: Shop) => h(NTag, {
      type: r.status === 'active' ? 'success' : 'default',
      size: 'small',
      bordered: false,
    }, () => r.status === 'active' ? '活跃' : '已断开'),
  },
  {
    title: '操作',
    key: 'actions',
    render: (r: Shop) => r.status === 'active'
      ? h(NPopconfirm, {
          onPositiveClick: () => doDisconnect(r.id),
        }, {
          default: () => '断开后此店的同步任务会停止,但历史数据保留。确认?',
          trigger: () => h(NButton, { size: 'small', type: 'error', tertiary: true }, () => '断开'),
        })
      : h(NButton, { size: 'small', disabled: true, tertiary: true }, () => '—'),
  },
];
</script>

<style scoped>
.shop-metrics {
  margin-bottom: 14px;
}
</style>
