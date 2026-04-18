<template>
  <n-card title="舵手 ERP" style="max-width: 480px; margin: 60px auto;">
    <n-space vertical>
      <n-h2>W0 骨架已就绪</n-h2>
      <n-text depth="3">前端已连通，点下面按钮测试后端 API。</n-text>
      <n-space>
        <n-button type="primary" :loading="busy" @click="ping">Ping /api/health</n-button>
      </n-space>
      <n-text v-if="result" code>{{ result }}</n-text>
      <n-text v-if="error" type="error">{{ error }}</n-text>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { NCard, NButton, NH2, NText, NSpace } from 'naive-ui';

const result = ref('');
const error = ref('');
const busy = ref(false);

async function ping() {
  busy.value = true;
  error.value = '';
  result.value = '';
  try {
    const r = await fetch('/api/health');
    result.value = await r.text();
  } catch (e: any) {
    error.value = e.message ?? String(e);
  } finally {
    busy.value = false;
  }
}
</script>
