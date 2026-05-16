<template>
  <div class="connect-page page-shell">
    <div class="page-hero">
      <div>
        <p class="page-eyebrow">NEW CONNECTION</p>
        <h1 class="page-title-main">连接店铺授权</h1>
        <p class="page-subtitle">录入平台开放接口凭证，系统会先验证授权可用性，再用于同步 BI 数据与运营任务。</p>
      </div>
      <n-button @click="$router.back()">返回</n-button>
    </div>

    <div class="connect-layout">
      <n-card title="授权信息">
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
            <n-input v-model:value="form.platformShopId" placeholder="平台卖家中心中的店铺 ID" />
          </n-form-item>
          <n-form-item label="App Key" required>
            <n-input v-model:value="form.appKey" placeholder="开放平台应用标识" />
          </n-form-item>
          <n-form-item label="App Secret" required>
            <n-input v-model:value="form.appSecret" type="password" show-password-on="click" placeholder="开放平台应用密钥" />
          </n-form-item>
          <n-form-item label="Access Token" required>
            <n-input v-model:value="form.accessToken" type="password" show-password-on="click" placeholder="店铺授权令牌" />
          </n-form-item>
          <n-form-item label="店铺显示名">
            <n-input v-model:value="form.displayName" placeholder="用于内部识别，可留空" />
          </n-form-item>

          <div class="form-actions">
            <n-button :loading="testing" :disabled="!canSubmit" @click="onTest">测试连接</n-button>
            <n-button type="primary" :loading="saving" :disabled="!canSubmit" @click="onSave">保存授权</n-button>
            <n-button @click="$router.back()">取消</n-button>
          </div>

          <n-alert v-if="testResult?.ok" type="success" :bordered="false" class="result-alert">
            连接成功。平台返回: {{ JSON.stringify(testResult.shopInfo) }}
          </n-alert>
          <n-alert v-else-if="testResult && !testResult.ok" type="error" :bordered="false" class="result-alert">
            测试失败: {{ testResult.error }}
          </n-alert>
        </n-form>
      </n-card>

      <aside class="connect-aside">
        <div class="aside-title">接入后可用能力</div>
        <div class="capability">
          <strong>BI 数据同步</strong>
          <span>商品、库存、活动等经营数据进入总览与分析页面。</span>
        </div>
        <div class="capability">
          <strong>价格运营</strong>
          <span>核价、调价、供货价任务可在价格操作台集中处理。</span>
        </div>
        <div class="capability">
          <strong>授权状态追踪</strong>
          <span>店铺断开或接口权限缺失时会在同步结果中提示。</span>
        </div>
      </aside>
    </div>
  </div>
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

<style scoped>
.connect-layout {
  display: grid;
  grid-template-columns: minmax(0, 720px) minmax(260px, 1fr);
  gap: 16px;
  align-items: start;
}
.form-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.result-alert {
  margin-top: 14px;
}
.connect-aside {
  padding: 18px;
  border: 1px solid var(--ds-line);
  border-radius: var(--ds-radius);
  background: linear-gradient(180deg, #ffffff, #f8fbff);
}
.aside-title {
  color: var(--ds-primary);
  font-size: 12px;
  font-weight: 800;
}
.capability {
  padding: 16px 0;
  border-bottom: 1px solid var(--ds-line);
}
.capability:last-child {
  border-bottom: 0;
}
.capability strong {
  display: block;
  color: var(--ds-ink);
}
.capability span {
  display: block;
  margin-top: 6px;
  color: var(--ds-muted);
  line-height: 1.6;
}
@media (max-width: 900px) {
  .connect-layout {
    grid-template-columns: 1fr;
  }
}
</style>
