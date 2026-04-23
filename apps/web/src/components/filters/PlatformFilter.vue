<template>
  <div class="filter-row">
    <span class="filter-label">平台:</span>
    <PlaceholderChip
      v-for="p in FILTER_PLATFORMS"
      :key="p.value"
      :active="filters.platform === p.value"
      :disabled="p.disabled"
      :reason="p.reason"
      @click="filters.setPlatform(p.value)"
    >
      {{ p.label }}
    </PlaceholderChip>
  </div>
</template>

<script setup lang="ts">
import PlaceholderChip from '@/components/common/PlaceholderChip.vue';
import { useFiltersStore, FILTER_PLATFORMS } from '@/stores/filters';

const filters = useFiltersStore();
</script>

<style scoped>
.filter-row { display: flex; align-items: center; gap: 4px; padding: 6px 0; flex-wrap: wrap; }
.filter-label { font-size: 13px; color: #666; margin-right: 8px; min-width: 52px; }
</style>
