<template>
  <n-card title="连接 Temu 店铺" style="max-width: 640px; margin: 40px auto;">
    <n-form label-placement="top" require-mark-placement="right-hanging">
      <n-grid :cols="2" :x-gap="16">
        <n-form-item-gi label="店铺类型" required>
          <n-select v-model:value="form.shopType" :options="shopTypeOptions" />
        </n-form-item-gi>
        <n-form-item-gi label="区域" required>
          <n-select v-model:value="form.region" :options="regionOptions" />
        </n-form-item-gi>
      </n-grid>
      <n-form-item label="Platform Shop ID" required>
        <n-input v-model:value="form.platformShopId" placeholder="Temu 卖家中心里看到的店铺 ID" />
      </n-form-item>
      <n-form-item label="App Key" required>
        <n-input v-model:value="form.appKey" />
      </n-form-item>
      <n-form-item label="App Secret" required>
        <n-input v-model:value="form.appSecret" type="password" show-password-on="click" />
      </n-form-item>
      <n-form-item label="Access Token" required>
        <n-input v-model:value="form.accessToken" type="password" show-password-on="click" />
      </n-form-item>
      <n-form-item label="店铺显示名(可选)">
        <n-input v-model:value="form.displayName" placeholder="方便识别,不填默认用 Platform Shop ID" />
      </n-form-item>

      <n-space style="margin-top: 12px;">
        <n-button :loading="testing" :disabled="!canSubmit" @click="onTest">🔍 测试连接</n-button>
        <n-button type="primary" :loading="saving" :disabled="!canSubmit" @click="onSave">💾 保存</n-button>
        <n-button @click="$router.back()">取消</n-button>
      </n-space>

      <n-alert v-if="testResult?.ok" type="success" style="margin-top: 12px;">
        ✅ 连接成功 — Temu 返回:{{ JSON.stringify(testResult.shopInfo) }}
      </n-alert>
      <n-alert v-else-if="testResult && !testResult.ok" type="error" style="margin-top: 12px;">
        ❌ 测试失败:{{ testResult.error }}
      </n-alert>
    </n-form>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  NCard, NForm, NFormItem, NFormItemGi, NGrid, NInput, NSelect, NButton, NSpace, NAlert, useMessage,
} from 'naive-ui';
import { shopsApi, type TestConnectionResult } from '@/api-client/shops.api';
import { useShopsStore } from '@/stores/shops';

const router = useRouter();
const msg = useMessage();
const shopsStore = useShopsStore();

const form = ref({
  shopType: 'full' as 'full' | 'semi',
  region: 'pa' as 'cn' | 'pa',
  platformShopId: '',
  appKey: '',
  appSecret: '',
  accessToken: '',
  displayName: '',
});
const testing = ref(false);
const saving = ref(false);
const testResult = ref<TestConnectionResult | null>(null);

const shopTypeOptions = [
  { label: '全托管', value: 'full' },
  { label: '半托管', value: 'semi' },
];
const regionOptions = [
  { label: '中国站(CN)', value: 'cn' },
  { label: '美国站(PA)', value: 'pa' },
];

const canSubmit = computed(() =>
  form.value.platformShopId && form.value.appKey && form.value.appSecret && form.value.accessToken,
);

async function onTest() {
  testing.value = true;
  testResult.value = null;
  try {
    const r = await shopsApi.testConnection({
      shopType: form.value.shopType,
      region: form.value.region,
      platformShopId: form.value.platformShopId,
      appKey: form.value.appKey,
      appSecret: form.value.appSecret,
      accessToken: form.value.accessToken,
    });
    testResult.value = r;
  } catch (e: any) {
    msg.error(e.message);
  } finally { testing.value = false; }
}

async function onSave() {
  if (!testResult.value?.ok) {
    const confirmed = window.confirm('还没测试连接,或测试失败,确定保存吗?');
    if (!confirmed) return;
  }
  saving.value = true;
  try {
    await shopsApi.connect({
      shopType: form.value.shopType,
      region: form.value.region,
      platformShopId: form.value.platformShopId,
      appKey: form.value.appKey,
      appSecret: form.value.appSecret,
      accessToken: form.value.accessToken,
      displayName: form.value.displayName || undefined,
    });
    msg.success('店铺连接成功');
    await shopsStore.fetch();
    router.push('/shops');
  } catch (e: any) {
    msg.error(e.message ?? '保存失败');
  } finally { saving.value = false; }
}
</script>
