<template>
  <div class="app-shell">
    <TopNavBar />
    <PageTabsBar />

    <TopFilterBar v-if="showFilters" />

    <div class="content-area">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import TopNavBar from '@/components/layout/TopNavBar.vue';
import PageTabsBar from '@/components/layout/PageTabsBar.vue';
import TopFilterBar from '@/components/layout/TopFilterBar.vue';
import { useDashboardStore } from '@/stores/dashboard';

const route = useRoute();
const dashboard = useDashboardStore();

const FILTER_PATHS = ['/', '/sales-analysis', '/ads-analysis', '/product-analysis', '/shop-analysis', '/region-analysis', '/profit-analysis', '/inventory-alerts', '/reports', '/data'];

const showFilters = computed(() => {
  const p = route.path;
  if (p === '/') return true;
  return FILTER_PATHS.some((k) => k !== '/' && p.startsWith(k));
});

watch(() => route.path, () => {
  if (showFilters.value && !dashboard.data && !dashboard.loading) {
    try { dashboard.fetch({}); } catch { /* api may be missing in dev */ }
  }
}, { immediate: true });
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f5f7fa;
}
.content-area {
  flex: 1 1 auto;
  min-height: calc(100vh - 84px);
  background: #f5f7fa;
  overflow: auto;
}
</style>
