<template>
  <div class="top-filter-bar">
    <PlatformFilter />
    <ShopFilter />
    <RegionFilter />
    <TimeRangeFilter />
  </div>
</template>

<script setup lang="ts">
import PlatformFilter from '@/components/filters/PlatformFilter.vue';
import ShopFilter from '@/components/filters/ShopFilter.vue';
import RegionFilter from '@/components/filters/RegionFilter.vue';
import TimeRangeFilter from '@/components/filters/TimeRangeFilter.vue';
</script>

<style scoped>
.top-filter-bar {
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid var(--ds-line);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
