<template>
  <n-card title="设置" style="max-width: 600px;">
    <n-form label-placement="top" @submit.prevent="save">
      <n-form-item label="低库存阈值(件数)">
        <n-input-number
          v-model:value="lowStockThreshold"
          :min="0"
          :max="100000"
          :step="1"
        />
        <template #feedback>warehouseQty ≤ 此值视为低库存,在 Dashboard 高亮提示</template>
      </n-form-item>
      <n-form-item label="剩余天数告警阈值(天)">
        <n-input-number
          v-model:value="lowStockDaysThreshold"
          :min="0"
          :max="365"
          :step="1"
        />
        <template #feedback>剩余天数 < 此值在库存预警表里红色提示</template>
      </n-form-item>
      <n-space>
        <n-button type="primary" :loading="saving" @click="save">保存</n-button>
      </n-space>
    </n-form>
  </n-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  NCard, NForm, NFormItem, NInputNumber, NSpace, NButton, useMessage,
} from 'naive-ui';
import { useSettingsStore } from '@/stores/settings';

const store = useSettingsStore();
const msg = useMessage();

const lowStockThreshold = ref<number>(10);
const lowStockDaysThreshold = ref<number>(7);
const saving = ref(false);

onMounted(async () => {
  await store.fetch();
  if (store.data) {
    lowStockThreshold.value = store.data.lowStockThreshold;
    lowStockDaysThreshold.value = store.data.lowStockDaysThreshold;
  }
});

async function save() {
  saving.value = true;
  try {
    await store.update({
      lowStockThreshold: lowStockThreshold.value,
      lowStockDaysThreshold: lowStockDaysThreshold.value,
    });
    msg.success('已保存');
  } catch (e: any) {
    msg.error(e.message ?? '保存失败');
  } finally { saving.value = false; }
}
</script>
