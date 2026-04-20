<template>
  <n-card title="我的店铺">
    <template #header-extra>
      <n-button type="primary" @click="$router.push('/shops/new')">➕ 添加店铺</n-button>
    </template>

    <n-empty v-if="!shops.loading && shops.items.length === 0" description="你还没有连接任何店铺">
      <template #extra>
        <n-button type="primary" @click="$router.push('/shops/new')">去连接第一家店铺</n-button>
      </template>
    </n-empty>

    <n-data-table
      v-else
      :columns="columns"
      :data="shops.items"
      :loading="shops.loading"
      :row-key="(r: any) => r.id"
    />
  </n-card>
</template>

<script setup lang="ts">
import { onMounted, h } from 'vue';
import {
  NCard, NButton, NDataTable, NEmpty, NTag, NPopconfirm, useMessage,
} from 'naive-ui';
import { useShopsStore } from '@/stores/shops';
import { shopsApi, type Shop } from '@/api-client/shops.api';

const msg = useMessage();
const shops = useShopsStore();

onMounted(() => shops.fetch());

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
  { title: '显示名', key: 'displayName', render: (r: Shop) => r.displayName ?? '—' },
  { title: 'Platform Shop ID', key: 'platformShopId' },
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
    }, () => r.status === 'active' ? '✅ 活跃' : '⚫ 已断开'),
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
