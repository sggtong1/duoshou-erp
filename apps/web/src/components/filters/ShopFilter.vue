<template>
  <div class="filter-row">
    <span class="filter-label">店铺:</span>
    <n-select
      v-model:value="value"
      multiple
      clearable
      size="small"
      :options="options"
      placeholder="全部店铺"
      style="min-width: 260px; max-width: 420px;"
      @update:value="onUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { NSelect } from 'naive-ui';
import { useFiltersStore } from '@/stores/filters';
import { useShopsStore } from '@/stores/shops';

const filters = useFiltersStore();
const shops = useShopsStore();

const value = ref<string[]>([...filters.shopIds]);
watch(() => filters.shopIds, (v) => { value.value = [...v]; });

const options = computed(() =>
  shops.items
    .filter((s) => s.status === 'active' && (!filters.platform || s.platform === filters.platform))
    .map((s) => ({
      label: s.displayName || s.platformShopId,
      value: s.id,
    })),
);

onMounted(async () => {
  if (!shops.items.length) await shops.fetch();
});

function onUpdate(v: string[]) {
  filters.setShopIds(v);
}
</script>

<style scoped>
.filter-row { display: flex; align-items: center; gap: 4px; padding: 6px 0; }
.filter-label { font-size: 13px; color: #666; margin-right: 8px; min-width: 52px; }
</style>
