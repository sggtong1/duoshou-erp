<template>
  <div class="filter-row">
    <span class="filter-label">区域:</span>
    <PlaceholderChip
      v-for="(r, idx) in FILTER_REGIONS"
      :key="r.label + idx"
      :active="r.value !== '__site__' && filters.region === r.value"
      :disabled="r.disabled"
      :reason="r.reason"
      @click="onClick(r.value)"
    >
      {{ r.label }}
    </PlaceholderChip>
    <PlaceholderChip
      :active="filters.region === null"
      @click="filters.setRegion(null)"
    >
      全部
    </PlaceholderChip>
  </div>
</template>

<script setup lang="ts">
import PlaceholderChip from '@/components/common/PlaceholderChip.vue';
import { useFiltersStore, FILTER_REGIONS } from '@/stores/filters';
import type { Region } from '@/api-client/dashboard.api';

const filters = useFiltersStore();

function onClick(v: Region | '__site__') {
  if (v === '__site__') return;
  filters.setRegion(v);
}
</script>

<style scoped>
.filter-row { display: flex; align-items: center; gap: 4px; padding: 6px 0; flex-wrap: wrap; }
.filter-label { font-size: 13px; color: #666; margin-right: 8px; min-width: 52px; }
</style>
