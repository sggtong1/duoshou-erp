<template>
  <div class="filter-row">
    <span class="filter-label">时间:</span>
    <PlaceholderChip
      v-for="t in FILTER_TIME_RANGES"
      :key="t.value"
      :active="!t.disabled && filters.timeRange === t.value"
      :disabled="t.disabled"
      :reason="t.reason"
      @click="onClick(t.value)"
    >
      {{ t.label }}
    </PlaceholderChip>
  </div>
</template>

<script setup lang="ts">
import PlaceholderChip from '@/components/common/PlaceholderChip.vue';
import { useFiltersStore, FILTER_TIME_RANGES } from '@/stores/filters';
import type { TimeRange } from '@/api-client/dashboard.api';

const filters = useFiltersStore();

function onClick(v: TimeRange | '__month__' | '__custom__') {
  if (v === '__month__' || v === '__custom__') return;
  filters.setTimeRange(v);
}
</script>

<style scoped>
.filter-row { display: flex; align-items: center; gap: 4px; padding: 6px 0; flex-wrap: wrap; }
.filter-label { font-size: 13px; color: #666; margin-right: 8px; min-width: 52px; }
</style>
