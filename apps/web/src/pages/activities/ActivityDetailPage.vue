<template>
  <n-card v-if="activity" :title="activity.title ?? activity.platformActivityId">
    <n-descriptions :column="2" bordered size="small">
      <n-descriptions-item label="区域">{{ activity.region.toUpperCase() }}</n-descriptions-item>
      <n-descriptions-item label="类型">{{ activity.activityType ?? '—' }}</n-descriptions-item>
      <n-descriptions-item label="时间窗">
        {{ fmt(activity.startAt) }} — {{ fmt(activity.endAt) }}
      </n-descriptions-item>
      <n-descriptions-item label="截止报名">{{ fmt(activity.enrollEndAt) }}</n-descriptions-item>
      <n-descriptions-item label="状态">
        <n-tag :type="activity.status === 'open' ? 'info' : 'default'">{{ activity.status }}</n-tag>
      </n-descriptions-item>
      <n-descriptions-item label="可报店铺">{{ activity.shopCount }}</n-descriptions-item>
    </n-descriptions>

    <n-divider>场次</n-divider>
    <n-radio-group v-if="activity.sessions && activity.sessions.length" v-model:value="sessionId">
      <n-space vertical>
        <n-radio v-for="s in activity.sessions" :key="s.id" :value="s.id">
          {{ s.title ?? s.platformSessionId }} ({{ fmt(s.startAt) }} — {{ fmt(s.endAt) }})
        </n-radio>
      </n-space>
    </n-radio-group>
    <n-empty v-else description="此活动无场次(按活动整体报名)" />

    <n-divider>可报店铺</n-divider>
    <n-checkbox-group v-model:value="selectedShops" @update:value="(v: any) => onShopsChange(v as string[])">
      <n-space>
        <n-checkbox v-for="s in activity.shopVisibility" :key="s.shopId" :value="s.shopId" :disabled="!s.canEnroll">
          {{ s.shopName ?? s.shopId.slice(0, 8) }}
        </n-checkbox>
      </n-space>
    </n-checkbox-group>

    <n-divider>可报商品(勾选店铺后自动加载)</n-divider>

    <n-space style="margin-bottom: 8px;" v-if="allProducts.length">
      <n-input-number v-model:value="discountPercent" :min="0" :max="90" placeholder="批量下调 %" style="max-width: 160px;" />
      <n-button @click="applyDiscount" :disabled="selectedSkus.length === 0">应用到选中</n-button>
      <n-text>已选 {{ selectedSkus.length }} / {{ allProducts.length }} SKU</n-text>
    </n-space>

    <n-spin :show="productsLoading">
      <n-data-table
        :columns="productColumns"
        :data="allProducts"
        :row-key="(r: any) => `${r.shopId}__${r.platformSkuId}`"
        :checked-row-keys="selectedSkus"
        @update:checked-row-keys="(v: any) => (selectedSkus = v)"
        max-height="320"
      />
    </n-spin>

    <n-space style="margin-top: 16px;">
      <n-button type="primary" :loading="submitting"
        :disabled="selectedSkus.length === 0 || selectedShops.length === 0"
        @click="submit">
        提交批量报名(共 {{ selectedSkus.length }} 条)
      </n-button>
      <n-button @click="$router.back()">返回</n-button>
    </n-space>
  </n-card>
  <n-spin v-else />
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NCard, NDescriptions, NDescriptionsItem, NTag, NDivider,
  NRadioGroup, NRadio, NSpace, NCheckboxGroup, NCheckbox, NEmpty,
  NDataTable, NSpin, NButton, NInputNumber, NText, useMessage,
} from 'naive-ui';
import { activitiesApi, type Activity, type ActivityProduct } from '@/api-client/activities.api';
import { enrollmentsApi, type EnrollmentItem } from '@/api-client/enrollments.api';

interface ProductRow extends ActivityProduct {
  shopId: string;
  shopName: string;
  activityPriceCents: number;
}

const route = useRoute();
const router = useRouter();
const msg = useMessage();

const activity = ref<Activity | null>(null);
const sessionId = ref<string | null>(null);
const selectedShops = ref<string[]>([]);
const allProducts = ref<ProductRow[]>([]);
const selectedSkus = ref<string[]>([]);
const productsLoading = ref(false);
const submitting = ref(false);
const discountPercent = ref<number>(20);

function fmt(s: string | null | undefined) {
  return s ? new Date(s).toLocaleString() : '—';
}

onMounted(async () => {
  activity.value = await activitiesApi.get(String(route.params.id));
});

async function onShopsChange(newShops: string[]) {
  if (!activity.value) return;
  productsLoading.value = true;
  const rows: ProductRow[] = [];
  try {
    for (const shopId of newShops) {
      const shopName = activity.value.shopVisibility.find((x) => x.shopId === shopId)?.shopName ?? shopId.slice(0, 8);
      const res = await activitiesApi.products(activity.value.id, shopId);
      for (const p of res.items) {
        rows.push({ ...p, shopId, shopName, activityPriceCents: p.currentPriceCents ?? 100 });
      }
    }
    allProducts.value = rows;
    selectedSkus.value = selectedSkus.value.filter((k) =>
      rows.some((r) => `${r.shopId}__${r.platformSkuId}` === k),
    );
  } catch (e: any) {
    msg.error(e.message);
  } finally { productsLoading.value = false; }
}

function applyDiscount() {
  const ratio = 1 - discountPercent.value / 100;
  for (const row of allProducts.value) {
    const k = `${row.shopId}__${row.platformSkuId}`;
    if (!selectedSkus.value.includes(k)) continue;
    if (row.currentPriceCents != null) {
      row.activityPriceCents = Math.max(1, Math.round(row.currentPriceCents * ratio));
    }
  }
  allProducts.value = [...allProducts.value];
}

const productColumns: any[] = [
  { type: 'selection' },
  { title: '店铺', key: 'shopName' },
  { title: 'SKU', key: 'platformSkuId' },
  { title: '商品', key: 'skuTitle' },
  {
    title: '现价',
    key: 'currentPriceCents',
    render: (r: ProductRow) => r.currentPriceCents != null ? `${(r.currentPriceCents / 100).toFixed(2)} ${r.currency ?? ''}` : '—',
  },
  {
    title: '活动价(分)',
    key: 'activityPriceCents',
    render: (r: ProductRow) => h(NInputNumber, {
      value: r.activityPriceCents,
      min: 1,
      size: 'small',
      style: 'max-width: 120px;',
      'onUpdate:value': (v: number | null) => { if (v != null) r.activityPriceCents = v; },
    }),
  },
];

async function submit() {
  if (!activity.value) return;
  submitting.value = true;
  try {
    const items: EnrollmentItem[] = selectedSkus.value.map((k) => {
      const [shopId, platformSkuId] = k.split('__');
      const row = allProducts.value.find((r) => r.shopId === shopId && r.platformSkuId === platformSkuId)!;
      return {
        shopId,
        platformSkuId,
        skuTitle: row.skuTitle ?? undefined,
        activityPriceCents: row.activityPriceCents,
        currency: row.currency ?? undefined,
      };
    });
    const r = await enrollmentsApi.submit({
      activityId: activity.value.id,
      sessionId: sessionId.value ?? undefined,
      items,
    });
    const ok = r.results.filter((x) => x.ok).length;
    const bad = r.total - ok;
    if (bad === 0) msg.success(`全部 ${ok} 条报名成功`);
    else msg.warning(`${ok} 成功,${bad} 失败 —— 详见「已报名」页`);
    router.push('/enrollments');
  } catch (e: any) {
    msg.error(e.message);
  } finally { submitting.value = false; }
}
</script>
