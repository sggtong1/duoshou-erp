<template>
  <n-select
    v-model:value="selected"
    multiple
    :options="options"
    placeholder="选择店铺"
    :loading="shops.loading"
    @update:value="onUpdate"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { NSelect } from 'naive-ui';
import { useShopsStore } from '@/stores/shops';

const props = defineProps<{ modelValue: string[]; filterShopType?: 'full' | 'semi' }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();

const shops = useShopsStore();
const selected = ref<string[]>([...props.modelValue]);

onMounted(async () => {
  if (shops.items.length === 0) await shops.fetch();
});

watch(() => props.modelValue, (v) => { selected.value = [...v]; });

function onUpdate(v: string[]) {
  emit('update:modelValue', v);
}

const options = computed(() => {
  let list = shops.items;
  if (props.filterShopType) list = list.filter((s) => s.shopType === props.filterShopType);
  return list.map((s) => ({
    label: `${s.displayName ?? s.platformShopId} (${s.shopType})`,
    value: s.id,
  }));
});
</script>
