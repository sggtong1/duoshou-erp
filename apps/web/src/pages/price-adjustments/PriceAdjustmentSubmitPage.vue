<template>
  <n-card title="提交调价申请">
    <n-form label-placement="top">
      <n-form-item label="店铺">
        <n-select v-model:value="shopId" :options="shopOptions" placeholder="选择店铺" />
      </n-form-item>
      <n-form-item label="SKU 调价列表">
        <n-dynamic-input v-model:value="items" :on-create="() => ({ platformSkuId: '', newPriceCents: 100, skuTitle: '' })">
          <template #default="{ value }">
            <n-space>
              <n-input v-model:value="value.platformSkuId" placeholder="platform SKU id" />
              <n-input v-model:value="value.skuTitle" placeholder="SKU 标题（可选）" />
              <n-input-number v-model:value="value.newPriceCents" :min="1" placeholder="新价（分）" />
            </n-space>
          </template>
        </n-dynamic-input>
      </n-form-item>
      <n-space>
        <n-button type="primary" :loading="busy" @click="submit" :disabled="!shopId || items.length === 0">提交</n-button>
        <n-button @click="$router.back()">取消</n-button>
      </n-space>
    </n-form>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NForm, NFormItem, NSelect, NDynamicInput, NInput, NInputNumber, NSpace, NButton, useMessage,
} from 'naive-ui';
import { useShopsStore } from '@/stores/shops';
import { priceAdjustmentsApi, type SubmitAdjustmentItem } from '@/api-client/price-adjustments.api';

const router = useRouter();
const msg = useMessage();
const shops = useShopsStore();
const shopId = ref<string>('');
const items = ref<SubmitAdjustmentItem[]>([]);
const busy = ref(false);

onMounted(() => shops.fetch());

const shopOptions = computed(() =>
  shops.items.map((s) => ({ label: `${s.displayName ?? s.platformShopId} (${s.shopType})`, value: s.id })),
);

async function submit() {
  busy.value = true;
  try {
    await priceAdjustmentsApi.submit(shopId.value, items.value);
    msg.success('调价申请已提交');
    router.push('/price-reviews');
  } catch (e: any) {
    msg.error(e.message);
  } finally { busy.value = false; }
}
</script>
