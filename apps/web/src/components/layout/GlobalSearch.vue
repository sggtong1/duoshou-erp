<template>
  <n-auto-complete
    v-model:value="q"
    :options="options"
    :get-show="() => q.length > 0"
    placeholder="搜索店铺 / SKU"
    size="small"
    clearable
    style="width: 260px;"
    @select="onSelect"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NAutoComplete } from 'naive-ui';
import type { AutoCompleteOption } from 'naive-ui/es/auto-complete/src/interface';
import { useShopsStore } from '@/stores/shops';
import { useDashboardStore } from '@/stores/dashboard';

const q = ref('');
const router = useRouter();
const shops = useShopsStore();
const dashboard = useDashboardStore();

const options = computed<AutoCompleteOption[]>(() => {
  const needle = q.value.toLowerCase().trim();
  if (!needle) return [];
  const out: AutoCompleteOption[] = [];
  for (const s of shops.items) {
    const name = (s.displayName ?? '').toLowerCase();
    if (name.includes(needle) || s.platformShopId.includes(needle)) {
      out.push({ label: `🏪 ${s.displayName ?? s.platformShopId}`, value: `shop:${s.id}` });
      if (out.length >= 10) break;
    }
  }
  for (const k of dashboard.data?.topSkus ?? []) {
    const title = (k.skuTitle ?? '').toLowerCase();
    if (title.includes(needle) || k.platformSkuId.includes(needle)) {
      out.push({ label: `📦 ${k.skuTitle ?? k.platformSkuId}`, value: `sku:${k.platformSkuId}` });
      if (out.length >= 20) break;
    }
  }
  return out;
});

function onSelect(v: string) {
  const [kind, id] = v.split(':');
  if (kind === 'shop') router.push(`/shops`);
  if (kind === 'sku') {
    window.dispatchEvent(new CustomEvent('duoshou:highlight-sku', { detail: { platformSkuId: id } }));
  }
  q.value = '';
}
</script>
