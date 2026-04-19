<template>
  <n-card v-if="job" title="发布任务进度">
    <n-descriptions :column="3">
      <n-descriptions-item label="状态">
        <n-tag :type="statusType">{{ job.status }}</n-tag>
      </n-descriptions-item>
      <n-descriptions-item label="总数">{{ job.total }}</n-descriptions-item>
      <n-descriptions-item label="成功">{{ job.succeeded }}</n-descriptions-item>
      <n-descriptions-item label="失败">{{ job.failed }}</n-descriptions-item>
      <n-descriptions-item label="开始">{{ job.startedAt ?? '—' }}</n-descriptions-item>
      <n-descriptions-item label="结束">{{ job.completedAt ?? '进行中' }}</n-descriptions-item>
    </n-descriptions>
    <n-progress :percentage="percent" style="margin-top: 16px;" />

    <n-h3 style="margin-top: 24px;">明细</n-h3>
    <n-data-table
      :columns="columns"
      :data="job.items ?? []"
      :row-key="(r: any) => r.id"
    />
  </n-card>
  <n-spin v-else />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, h } from 'vue';
import { useRoute } from 'vue-router';
import {
  NCard, NDescriptions, NDescriptionsItem, NTag, NProgress, NH3, NDataTable, NSpin,
} from 'naive-ui';
import { bulkJobsApi, type BulkJob, type BulkJobItem } from '@/api-client/bulk-jobs.api';

const route = useRoute();
const job = ref<BulkJob | null>(null);
let timer: any = null;

async function poll() {
  try {
    job.value = await bulkJobsApi.get(String(route.params.id));
    if (job.value.status === 'completed' || job.value.status === 'failed') {
      clearInterval(timer);
    }
  } catch { /* ignore transient */ }
}

onMounted(() => {
  poll();
  timer = setInterval(poll, 3000);
});
onUnmounted(() => clearInterval(timer));

const percent = computed(() => {
  if (!job.value || !job.value.total) return 0;
  return Math.round(((job.value.succeeded + job.value.failed) / job.value.total) * 100);
});

const statusType = computed(() => {
  if (!job.value) return 'default' as const;
  if (job.value.status === 'completed') return 'success' as const;
  if (job.value.status === 'failed') return 'error' as const;
  if (job.value.status === 'running') return 'info' as const;
  return 'default' as const;
});

const columns = [
  {
    title: '店铺',
    key: 'shop',
    render: (r: BulkJobItem) => r.shop?.displayName ?? r.shop?.platformShopId,
  },
  {
    title: '状态',
    key: 'status',
    render: (r: BulkJobItem) =>
      h(NTag, {
        type:
          r.status === 'succeeded'
            ? 'success'
            : r.status === 'failed'
              ? 'error'
              : 'info',
      }, () => r.status),
  },
  {
    title: '错误',
    key: 'error',
    render: (r: BulkJobItem) => r.error ? r.error.message : '—',
  },
];
</script>
