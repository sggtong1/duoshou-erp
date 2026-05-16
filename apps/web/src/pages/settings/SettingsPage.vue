<template>
  <div class="settings-page page-shell">
    <div class="page-hero">
      <div>
        <p class="page-eyebrow">WORKSPACE SETTINGS</p>
        <h1 class="page-title-main">系统设置</h1>
        <p class="page-subtitle">配置运营预警阈值，保持总览看板与库存模块的判断口径一致。</p>
      </div>
    </div>

    <div class="settings-layout">
      <n-card title="预警规则">
        <n-form label-placement="top" @submit.prevent="save">
          <n-form-item label="低库存阈值">
            <n-input-number
              v-model:value="lowStockThreshold"
              :min="0"
              :max="100000"
              :step="1"
            />
            <template #feedback>warehouseQty 小于或等于该值时，在经营总览中高亮提示。</template>
          </n-form-item>
          <n-form-item label="剩余天数告警阈值">
            <n-input-number
              v-model:value="lowStockDaysThreshold"
              :min="0"
              :max="365"
              :step="1"
            />
            <template #feedback>预计可售天数低于该值时，进入库存预警列表。</template>
          </n-form-item>
          <n-space>
            <n-button type="primary" :loading="saving" @click="save">保存设置</n-button>
          </n-space>
        </n-form>
      </n-card>

      <aside class="rules-preview">
        <div class="preview-title">规则生效范围</div>
        <div class="preview-row">
          <span>经营总览</span>
          <strong>实时提示</strong>
        </div>
        <div class="preview-row">
          <span>库存预警</span>
          <strong>筛选排序</strong>
        </div>
        <div class="preview-row">
          <span>后续报表</span>
          <strong>统一口径</strong>
        </div>
      </aside>
    </div>
  </div>
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

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: minmax(0, 620px) minmax(260px, 1fr);
  gap: 16px;
  align-items: start;
}
:deep(.n-input-number) {
  width: 220px;
}
.rules-preview {
  padding: 18px;
  border: 1px solid var(--ds-line);
  border-radius: var(--ds-radius);
  background: var(--ds-panel);
}
.preview-title {
  color: var(--ds-primary);
  font-size: 12px;
  font-weight: 800;
}
.preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--ds-line);
  color: var(--ds-muted);
}
.preview-row:last-child {
  border-bottom: 0;
}
.preview-row strong {
  color: var(--ds-ink);
}
@media (max-width: 900px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
}
</style>
