<template>
  <div class="sf-page">
    <div v-if="title" class="sf-page-header">
      <div class="sf-page-title">
        <span class="title-text">{{ title }}</span>
        <n-tag v-if="badge" :type="badgeType" size="small" round>{{ badge }}</n-tag>
      </div>
      <div v-if="$slots.actions" class="sf-page-actions">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.filters" class="sf-page-filters">
      <slot name="filters" />
    </div>

    <div v-if="$slots.kpis" class="sf-page-kpis">
      <slot name="kpis" />
    </div>

    <div class="sf-page-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NTag } from 'naive-ui';

const props = defineProps<{
  title?: string;
  badge?: string;
}>();

const badgeType = computed<'success' | 'warning' | 'error' | 'info' | 'default'>(() => {
  if (!props.badge) return 'default';
  if (props.badge === 'NEW') return 'success';
  if (props.badge === 'HOT') return 'warning';
  return 'info';
});
</script>

<style scoped>
.sf-page {
  background: #f5f7fa;
  min-height: 100%;
}
.sf-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #eef0f4;
  margin-bottom: 12px;
}
.sf-page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}
.title-text { letter-spacing: 0.2px; }
.sf-page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sf-page-filters {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #eef0f4;
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
}
.sf-page-kpis {
  padding: 0 0 12px 0;
}
.sf-page-body {
  padding: 0 0 16px 0;
}
</style>
