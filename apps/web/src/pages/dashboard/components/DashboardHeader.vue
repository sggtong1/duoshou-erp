<template>
  <div class="dashboard-header">
    <n-space>
      <n-select
        v-model:value="localShopId"
        :options="shopOptions"
        placeholder="全部店铺"
        clearable
        style="min-width: 220px;"
        @update:value="(v: string | null) => emit('shop-change', v)"
      />
      <n-text depth="3" style="line-height: 34px;">
        数据时间:{{ freshness }}
      </n-text>
    </n-space>
    <n-button :loading="syncing" @click="emit('sync-now')">🔄 立即同步</n-button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NSpace, NSelect, NButton, NText } from 'naive-ui';
import { useShopsStore } from '@/stores/shops';

const props = defineProps<{
  selectedShopId: string | null;
  lastSyncedAt: string | null;
  syncing: boolean;
}>();

const emit = defineEmits<{
  'shop-change': [shopId: string | null];
  'sync-now': [];
}>();

const shops = useShopsStore();
const localShopId = ref(props.selectedShopId);
watch(() => props.selectedShopId, (v) => (localShopId.value = v));

const shopOptions = computed(() =>
  shops.items
    .filter((s) => s.status === 'active')
    .map((s) => ({ label: s.displayName ?? s.platformShopId, value: s.id })),
);

const freshness = computed(() =>
  props.lastSyncedAt ? new Date(props.lastSyncedAt).toLocaleString() : '暂无数据',
);
</script>

<style scoped>
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
</style>
