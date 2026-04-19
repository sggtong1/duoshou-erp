<template>
  <n-card title="货品模板">
    <template #header-extra>
      <n-button type="primary" @click="$router.push('/templates/new')">+ 新建模板</n-button>
    </template>
    <n-data-table
      :columns="columns"
      :data="tpl.items"
      :loading="tpl.loading"
      :row-key="(r: any) => r.id"
    />
  </n-card>
</template>

<script setup lang="ts">
import { onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NButton, NDataTable, NSpace } from 'naive-ui';
import { useTemplatesStore } from '@/stores/templates';
import type { ProductTemplate } from '@/api-client/templates.api';

const router = useRouter();
const tpl = useTemplatesStore();

onMounted(() => tpl.fetchAll());

const columns = [
  { title: '名称', key: 'name' },
  { title: '目标店铺类型', key: 'shopTypeTarget' },
  {
    title: '建议售价',
    key: 'suggestedPriceCents',
    render: (r: ProductTemplate) => '¥ ' + (Number(r.suggestedPriceCents) / 100).toFixed(2),
  },
  {
    title: '类目',
    key: 'temuCategoryPath',
    render: (r: ProductTemplate) => r.temuCategoryPath.join(' / '),
  },
  {
    title: '操作',
    key: 'actions',
    render: (r: ProductTemplate) =>
      h(NSpace, {}, () => [
        h(NButton, {
          size: 'small',
          onClick: () => router.push(`/templates/${r.id}`),
        }, () => '编辑 / 发布'),
      ]),
  },
];
</script>
