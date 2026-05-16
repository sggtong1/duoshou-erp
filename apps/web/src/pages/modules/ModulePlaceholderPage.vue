<template>
  <div class="module-page page-shell">
    <div class="page-hero">
      <div>
        <p class="page-eyebrow">{{ topLabel }} / {{ groupLabel }}</p>
        <h1 class="page-title-main">{{ moduleLabel }}</h1>
        <p class="page-subtitle">模块框架已接入导航体系，后续会按接口能力逐步补齐列表、筛选、批量操作和详情抽屉。</p>
      </div>
      <n-button @click="$router.back()">返回</n-button>
    </div>

    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen" class="module-metrics">
      <n-gi>
        <div class="metric-card">
          <div class="metric-label">待处理</div>
          <div class="metric-value">0</div>
        </div>
      </n-gi>
      <n-gi>
        <div class="metric-card">
          <div class="metric-label">今日新增</div>
          <div class="metric-value">0</div>
        </div>
      </n-gi>
      <n-gi>
        <div class="metric-card">
          <div class="metric-label">同步状态</div>
          <div class="metric-value small">待接入</div>
        </div>
      </n-gi>
      <n-gi>
        <div class="metric-card">
          <div class="metric-label">操作权限</div>
          <div class="metric-value small">配置中</div>
        </div>
      </n-gi>
    </n-grid>

    <n-card title="业务列表">
      <div class="module-toolbar">
        <n-input placeholder="搜索编号、SKU、店铺或任务名称" clearable />
        <n-select :options="statusOptions" placeholder="状态" clearable class="status-filter" />
        <n-button>查询</n-button>
        <n-button type="primary">新建任务</n-button>
      </div>
      <n-data-table :columns="columns" :data="rows" size="small" />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NCard, NDataTable, NGi, NGrid, NInput, NSelect, NTag } from 'naive-ui';

const route = useRoute();

const topLabel = computed(() => String(route.query.top ?? '模块'));
const groupLabel = computed(() => String(route.query.group ?? '业务分组'));
const moduleLabel = computed(() => String(route.query.module ?? '业务模块'));

const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'running' },
  { label: '已完成', value: 'done' },
];

const rows = computed(() => [
  {
    name: moduleLabel.value,
    group: groupLabel.value,
    status: '框架就绪',
    updatedAt: '-',
  },
]);

const columns = [
  { title: '模块', key: 'name' },
  { title: '分组', key: 'group' },
  {
    title: '状态',
    key: 'status',
    render: (row: any) => h(NTag, { size: 'small', bordered: false, type: 'info' }, () => row.status),
  },
  { title: '更新时间', key: 'updatedAt' },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    render: () => h(NButton, { size: 'small', disabled: true }, () => '等待接入'),
  },
];
</script>

<style scoped>
.module-metrics {
  margin-bottom: 14px;
}
.metric-value.small {
  font-size: 20px;
}
.module-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.module-toolbar :deep(.n-input) {
  max-width: 360px;
}
.status-filter {
  width: 160px;
}
@media (max-width: 760px) {
  .module-toolbar :deep(.n-input),
  .status-filter {
    width: 100%;
    max-width: none;
  }
}
</style>
