<template>
  <div class="pricing-workbench page-shell">
    <div class="page-hero">
      <div>
        <p class="page-eyebrow">PRICING OPERATIONS</p>
        <h1 class="page-title-main">价格操作台</h1>
        <p class="page-subtitle">聚合多平台店铺的核价、调价和 SKU 供货价任务，当前已接入 Temu 适配器。</p>
      </div>
      <n-space>
        <n-button :loading="syncingReviews" @click="syncReviews">同步核价单</n-button>
        <n-button type="primary" :loading="refreshing" @click="refreshActive">刷新</n-button>
      </n-space>
    </div>

    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen" class="summary-grid">
      <n-gi>
        <div class="summary-card">
          <span>待处理核价</span>
          <strong>{{ pendingReviewCount }}</strong>
        </div>
      </n-gi>
      <n-gi>
        <div class="summary-card">
          <span>待确认调价</span>
          <strong>{{ pendingAdjustmentCount }}</strong>
        </div>
      </n-gi>
      <n-gi>
        <div class="summary-card">
          <span>已选任务</span>
          <strong>{{ selectedCount }}</strong>
        </div>
      </n-gi>
      <n-gi>
        <div class="summary-card">
          <span>接入店铺</span>
          <strong>{{ shops.items.length }}</strong>
        </div>
      </n-gi>
    </n-grid>

    <n-tabs v-model:value="activeTab" type="segment" animated class="workspace-tabs">
      <n-tab-pane name="reviews" tab="核价单">
        <div class="toolbar">
          <n-select v-model:value="reviewShopId" :options="shopOptions" placeholder="全部店铺" clearable class="filter-control" @update:value="() => loadReviews(1)" />
          <n-select v-model:value="reviewStatus" :options="reviewStatusOptions" placeholder="状态" clearable class="filter-control small" @update:value="() => loadReviews(1)" />
          <n-input v-model:value="reviewSearch" placeholder="搜索 SKU / 商品" clearable class="search-control" @keyup.enter="loadReviews(1)" />
          <n-button @click="loadReviews(1)">查询</n-button>
          <div class="toolbar-spacer" />
          <n-button :disabled="!selectedReviews.length" @click="confirmReviews(selectedReviews)">批量同意</n-button>
          <n-button :disabled="!selectedReviews.length" type="warning" @click="openReviewReject(selectedReviews)">批量拒绝</n-button>
        </div>

        <n-data-table
          v-model:checked-row-keys="reviewCheckedRowKeys"
          :columns="reviewColumns"
          :data="reviewRows"
          :loading="reviewLoading"
          :row-key="(row: PriceReview) => row.id"
          size="small"
        />
        <n-pagination v-model:page="reviewPage" :page-count="reviewPageCount" @update:page="loadReviews" class="pager" />
      </n-tab-pane>

      <n-tab-pane name="adjustments" tab="调价单">
        <div class="toolbar">
          <n-select v-model:value="adjustShopId" :options="shopOptions" placeholder="全部店铺" clearable class="filter-control" @update:value="() => loadAdjustments(1)" />
          <n-select v-model:value="adjustStatus" :options="adjustStatusOptions" placeholder="状态" clearable class="filter-control small" @update:value="() => loadAdjustments(1)" />
          <n-input v-model:value="adjustSearch" placeholder="搜索商品 / 调价单号" clearable class="search-control" @keyup.enter="loadAdjustments(1)" />
          <n-button @click="loadAdjustments(1)">查询</n-button>
          <div class="toolbar-spacer" />
          <n-button :disabled="!selectedAdjustments.length" @click="approveAdjustments(selectedAdjustments)">批量通过</n-button>
          <n-button :disabled="!selectedAdjustments.length || selectedAdjustments.some((row) => row.shopType === 'full')" type="warning" @click="openAdjustmentReject(selectedAdjustments)">批量驳回</n-button>
        </div>

        <n-data-table
          v-model:checked-row-keys="adjustCheckedRowKeys"
          :columns="adjustColumns"
          :data="adjustRows"
          :loading="adjustLoading"
          :row-key="(row: AdjustmentOrder) => row.id"
          size="small"
        />
        <n-pagination v-model:page="adjustPage" :page-count="adjustPageCount" @update:page="loadAdjustments" class="pager" />
      </n-tab-pane>

      <n-tab-pane name="prices" tab="SKU 供货价">
        <div class="price-query">
          <n-select v-model:value="priceShopId" :options="shopOptions" placeholder="选择店铺" class="filter-control" />
          <n-input v-model:value="skuInput" placeholder="输入 SKU ID，多个用逗号或空格分隔" clearable class="search-control" @keyup.enter="queryPrices" />
          <n-button type="primary" :loading="priceLoading" :disabled="!priceShopId || !skuInput.trim()" @click="queryPrices">查询供货价</n-button>
        </div>

        <n-data-table :columns="priceColumns" :data="priceItems" :loading="priceLoading" size="small" />
      </n-tab-pane>
    </n-tabs>

    <n-drawer v-model:show="detailOpen" :width="520">
      <n-drawer-content :title="detailTitle">
        <n-descriptions v-if="detail" :column="1" bordered size="small">
          <n-descriptions-item v-for="item in detailPairs" :key="item.label" :label="item.label">
            {{ item.value }}
          </n-descriptions-item>
        </n-descriptions>
      </n-drawer-content>
    </n-drawer>

    <n-modal v-model:show="reviewRejectVisible" preset="card" title="拒绝核价单" class="action-modal">
      <n-alert type="warning" :bordered="false" class="modal-alert">将为所选核价单提交新的申报价和拒绝原因。</n-alert>
      <n-form label-placement="top">
        <n-form-item label="原因类型">
          <n-select v-model:value="reviewRejectType" :options="rejectReasonTypeOptions" />
        </n-form-item>
        <n-form-item label="原因说明">
          <n-input v-model:value="reviewRejectReason" type="textarea" placeholder="请输入拒绝原因" />
        </n-form-item>
        <n-form-item label="新申报价">
          <div class="reject-list">
            <div v-for="row in reviewRejectRows" :key="row.review.id" class="reject-row">
              <span>{{ row.review.skuTitle ?? (row.review.productSkuIds.join(', ') || row.review.platformOrderId) }}</span>
              <n-input-number v-model:value="row.priceCents" :min="1" :step="1" />
            </div>
          </div>
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="reviewRejectVisible = false">取消</n-button>
          <n-button type="warning" :loading="submittingReviewReject" @click="submitReviewReject">提交拒绝</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="adjustRejectVisible" preset="card" title="驳回调价单" class="action-modal">
      <n-alert type="warning" :bordered="false" class="modal-alert">半托调价单支持驳回，全托调价单当前平台接口只支持通过。</n-alert>
      <n-form label-placement="top">
        <n-form-item label="驳回原因">
          <n-input v-model:value="adjustRejectReason" type="textarea" placeholder="请输入驳回原因" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="adjustRejectVisible = false">取消</n-button>
          <n-button type="warning" :loading="submittingAdjustment" @click="rejectAdjustments">提交驳回</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import {
  NAlert,
  NButton,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NInputNumber,
  NModal,
  NPagination,
  NSelect,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
  useDialog,
  useMessage,
  type DataTableColumns,
  type DataTableRowKey,
} from 'naive-ui';
import { useShopsStore } from '@/stores/shops';
import { priceReviewsApi, type PriceReview, type RejectReviewItem } from '@/api-client/price-reviews.api';
import {
  priceAdjustmentsApi,
  type AdjustmentOrder,
  type SupplierPriceItem,
} from '@/api-client/price-adjustments.api';

type ActiveTab = 'reviews' | 'adjustments' | 'prices';

const shops = useShopsStore();
const msg = useMessage();
const dialog = useDialog();

const activeTab = ref<ActiveTab>('reviews');
const refreshing = ref(false);
const syncingReviews = ref(false);

const reviewRows = ref<PriceReview[]>([]);
const reviewTotal = ref(0);
const reviewPage = ref(1);
const reviewPageSize = 20;
const reviewLoading = ref(false);
const reviewShopId = ref<string | null>(null);
const reviewStatus = ref<string | null>('pending');
const reviewSearch = ref('');
const reviewCheckedRowKeys = ref<DataTableRowKey[]>([]);

const adjustRows = ref<AdjustmentOrder[]>([]);
const adjustTotal = ref(0);
const adjustPage = ref(1);
const adjustPageSize = 20;
const adjustLoading = ref(false);
const adjustShopId = ref<string | null>(null);
const adjustStatus = ref<number | null>(1);
const adjustSearch = ref('');
const adjustCheckedRowKeys = ref<DataTableRowKey[]>([]);

const priceShopId = ref<string | null>(null);
const skuInput = ref('');
const priceLoading = ref(false);
const priceItems = ref<SupplierPriceItem[]>([]);

const detailOpen = ref(false);
const detailType = ref<'review' | 'adjustment' | null>(null);
const detail = ref<PriceReview | AdjustmentOrder | null>(null);

const reviewRejectVisible = ref(false);
const reviewRejectRows = ref<Array<{ review: PriceReview; priceCents: number | null }>>([]);
const reviewRejectType = ref(2);
const reviewRejectReason = ref('价格无法覆盖成本');
const submittingReviewReject = ref(false);

const adjustRejectVisible = ref(false);
const adjustRejectRows = ref<AdjustmentOrder[]>([]);
const adjustRejectReason = ref('暂不接受本次调价');
const submittingAdjustment = ref(false);

const shopOptions = computed(() =>
  shops.items.map((shop) => ({
    label: `${shop.displayName ?? shop.platformShopId} · ${shop.platform.toUpperCase()} · ${shop.shopType}`,
    value: shop.id,
  })),
);

const reviewStatusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '已同意', value: 'confirmed' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已过期', value: 'expired' },
];

const adjustStatusOptions = [
  { label: '待调价', value: 0 },
  { label: '待供应商确认', value: 1 },
  { label: '调价成功', value: 2 },
  { label: '调价失败', value: 3 },
];

const rejectReasonTypeOptions = [
  { label: '材质', value: 0 },
  { label: '功能', value: 1 },
  { label: '其他', value: 2 },
  { label: '品类', value: 3 },
  { label: '外观', value: 4 },
  { label: '版型', value: 5 },
  { label: '图案', value: 6 },
  { label: '规格尺寸', value: 7 },
  { label: '品牌', value: 8 },
];

const selectedReviews = computed(() =>
  reviewRows.value.filter((row) => reviewCheckedRowKeys.value.includes(row.id)),
);
const selectedAdjustments = computed(() =>
  adjustRows.value.filter((row) => adjustCheckedRowKeys.value.includes(row.id)),
);
const selectedCount = computed(() => selectedReviews.value.length + selectedAdjustments.value.length);
const pendingReviewCount = computed(() => reviewRows.value.filter((row) => row.status === 'pending').length || reviewTotal.value);
const pendingAdjustmentCount = computed(() => adjustRows.value.filter((row) => row.rawStatus === 1).length);
const reviewPageCount = computed(() => Math.max(1, Math.ceil(reviewTotal.value / reviewPageSize)));
const adjustPageCount = computed(() => Math.max(1, Math.ceil(adjustTotal.value / adjustPageSize)));

function formatMoney(cents: number | null | undefined, currency?: string | null) {
  if (cents == null) return '-';
  return `${(cents / 100).toFixed(2)} ${currency ?? ''}`.trim();
}

function formatShop(row: { platform?: string; shopName?: string; shop?: any; shopType?: string; region?: string }) {
  const platform = row.platform ?? row.shop?.platform ?? '';
  const name = row.shopName ?? row.shop?.displayName ?? row.shop?.platformShopId ?? '-';
  const shopType = row.shopType ?? row.shop?.shopType ?? '';
  const region = row.region ?? row.shop?.region ?? '';
  return `${platform.toUpperCase()} · ${name} · ${shopType}/${region}`;
}

function statusTag(type: 'success' | 'warning' | 'error' | 'info' | 'default', label: string) {
  return h(NTag, { size: 'small', type }, () => label);
}

function openDetail(kind: 'review' | 'adjustment', row: PriceReview | AdjustmentOrder) {
  detailType.value = kind;
  detail.value = row;
  detailOpen.value = true;
}

const detailTitle = computed(() => {
  if (!detail.value) return '明细';
  return detailType.value === 'review'
    ? `核价单 ${(detail.value as PriceReview).platformOrderId}`
    : `调价单 ${(detail.value as AdjustmentOrder).priceOrderSn}`;
});

const detailPairs = computed(() => {
  if (!detail.value) return [];
  if (detailType.value === 'review') {
    const row = detail.value as PriceReview;
    return [
      { label: '平台/店铺', value: formatShop(row) },
      { label: '核价单号', value: row.platformOrderId },
      { label: 'SKU', value: row.productSkuIds.join(', ') || '-' },
      { label: '站点', value: row.siteNameList.join(', ') || '-' },
      { label: '申报价', value: formatMoney(row.currentPriceCents, row.currency) },
      { label: '建议价', value: formatMoney(row.suggestedPriceCents, row.currency) },
      { label: '可重新报价', value: row.canBargain == null ? '-' : row.canBargain ? '是' : '否' },
      { label: '状态', value: row.status },
      { label: '原因', value: row.reason ?? '-' },
    ];
  }
  const row = detail.value as AdjustmentOrder;
  return [
    { label: '平台/店铺', value: formatShop(row) },
    { label: '调价单号', value: row.priceOrderSn },
    { label: '商品', value: row.productName ?? '-' },
    { label: 'SKC', value: row.skcId ?? '-' },
    { label: 'SKU', value: row.skuInfo.map((sku) => sku.productSkuId).filter(Boolean).join(', ') || '-' },
    { label: '原价', value: row.skuInfo.map((sku) => formatMoney(sku.priceCents, sku.currency ?? row.priceCurrency)).join(', ') || '-' },
    { label: '调价后', value: formatMoney(row.newSupplyPriceCents, row.priceCurrency) },
    { label: '站点', value: row.siteNameList.join(', ') || '-' },
    { label: '状态', value: row.statusLabel },
    { label: '原因', value: row.adjustReason ?? row.rejectReason ?? '-' },
  ];
});

const reviewColumns = computed<DataTableColumns<PriceReview>>(() => [
  { type: 'selection' },
  {
    title: '平台/店铺',
    key: 'shop',
    minWidth: 220,
    render: (row) => h('span', { class: 'table-strong' }, formatShop(row)),
  },
  {
    title: '核价单 / SKU',
    key: 'sku',
    minWidth: 220,
    render: (row) => h('div', null, [
      h('div', { class: 'table-strong' }, row.skuTitle ?? (row.productSkuIds.join(', ') || '-')),
      h('div', { class: 'table-muted' }, `${row.platformOrderId} · ${row.productSkuIds.join(', ') || '-'}`),
    ]),
  },
  {
    title: '申报/建议价',
    key: 'price',
    minWidth: 160,
    render: (row) => h('div', null, [
      h('div', null, `申报 ${formatMoney(row.currentPriceCents, row.currency)}`),
      h('div', { class: 'table-muted' }, `建议 ${formatMoney(row.suggestedPriceCents, row.currency)}`),
    ]),
  },
  { title: '站点', key: 'site', minWidth: 140, render: (row) => row.siteNameList.join(', ') || '-' },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) => statusTag(row.status === 'pending' ? 'info' : row.status === 'confirmed' ? 'success' : row.status === 'rejected' ? 'warning' : 'error', row.status),
  },
  {
    title: '操作',
    key: 'actions',
    width: 220,
    render: (row) => h(NSpace, { size: 6 }, () => [
      h(NButton, { size: 'small', onClick: () => openDetail('review', row) }, () => '明细'),
      h(NButton, { size: 'small', disabled: row.status !== 'pending', onClick: () => confirmReviews([row]) }, () => '同意'),
      h(NButton, { size: 'small', type: 'warning', disabled: row.status !== 'pending', onClick: () => openReviewReject([row]) }, () => '拒绝'),
    ]),
  },
]);

const adjustColumns = computed<DataTableColumns<AdjustmentOrder>>(() => [
  { type: 'selection' },
  {
    title: '平台/店铺',
    key: 'shop',
    minWidth: 220,
    render: (row) => h('span', { class: 'table-strong' }, formatShop(row)),
  },
  {
    title: '调价单 / 商品',
    key: 'product',
    minWidth: 240,
    render: (row) => h('div', null, [
      h('div', { class: 'table-strong' }, row.productName ?? row.skcExtCode ?? '-'),
      h('div', { class: 'table-muted' }, `${row.priceOrderSn} · SKC ${row.skcId ?? '-'}`),
    ]),
  },
  {
    title: '原价/新价',
    key: 'price',
    minWidth: 170,
    render: (row) => h('div', null, [
      h('div', null, `原价 ${row.skuInfo.map((sku) => formatMoney(sku.priceCents, sku.currency ?? row.priceCurrency)).join(', ') || '-'}`),
      h('div', { class: 'table-muted' }, `新价 ${formatMoney(row.newSupplyPriceCents, row.priceCurrency)}`),
    ]),
  },
  { title: '站点', key: 'site', minWidth: 140, render: (row) => row.siteNameList.join(', ') || '-' },
  {
    title: '状态',
    key: 'status',
    width: 130,
    render: (row) => statusTag(row.rawStatus === 2 ? 'success' : row.rawStatus === 3 ? 'error' : row.rawStatus === 1 ? 'info' : 'default', row.statusLabel),
  },
  {
    title: '操作',
    key: 'actions',
    width: 220,
    render: (row) => h(NSpace, { size: 6 }, () => [
      h(NButton, { size: 'small', onClick: () => openDetail('adjustment', row) }, () => '明细'),
      h(NButton, { size: 'small', disabled: row.rawStatus !== 1, onClick: () => approveAdjustments([row]) }, () => '通过'),
      h(NButton, { size: 'small', type: 'warning', disabled: row.rawStatus !== 1 || row.shopType === 'full', onClick: () => openAdjustmentReject([row]) }, () => '驳回'),
    ]),
  },
]);

const priceColumns = computed<DataTableColumns<SupplierPriceItem>>(() => [
  { title: 'SKU ID', key: 'productSkuId' },
  { title: 'SKC ID', key: 'productSkcId' },
  { title: '货品 ID', key: 'productId' },
  { title: '供货价', key: 'supplierPriceCents', render: (row) => formatMoney(row.supplierPriceCents, row.currencyType) },
  {
    title: '站点价格',
    key: 'siteSupplierPrices',
    render: (row) => row.siteSupplierPrices.length
      ? row.siteSupplierPrices.map((site) => `${site.siteId}: ${formatMoney(site.supplierPriceCents, row.currencyType)}`).join(' / ')
      : '-',
  },
]);

async function loadReviews(page = reviewPage.value) {
  reviewLoading.value = true;
  try {
    const res = await priceReviewsApi.list({
      shopId: reviewShopId.value ?? undefined,
      status: reviewStatus.value ?? undefined,
      search: reviewSearch.value || undefined,
      page,
      pageSize: reviewPageSize,
    });
    reviewRows.value = res.items;
    reviewTotal.value = res.total;
    reviewPage.value = page;
    reviewCheckedRowKeys.value = [];
  } finally {
    reviewLoading.value = false;
  }
}

async function loadAdjustments(page = adjustPage.value) {
  adjustLoading.value = true;
  try {
    const res = await priceAdjustmentsApi.listOrders({
      shopId: adjustShopId.value ?? undefined,
      status: adjustStatus.value ?? undefined,
      search: adjustSearch.value || undefined,
      page,
      pageSize: adjustPageSize,
    });
    adjustRows.value = res.items;
    adjustTotal.value = res.total;
    adjustPage.value = page;
    adjustCheckedRowKeys.value = [];
  } finally {
    adjustLoading.value = false;
  }
}

async function syncReviews() {
  syncingReviews.value = true;
  try {
    const res = await priceReviewsApi.syncNow();
    const failed = res.shops.filter((shop) => !shop.ok);
    if (failed.length) {
      const first = failed[0];
      msg.warning(`${first.displayName ?? first.platformShopId} 同步失败: ${first.error?.errorMsg ?? first.error?.message ?? '未知错误'}`);
    } else {
      msg.success(`核价单同步完成，更新 ${res.total} 条`);
    }
    await loadReviews(1);
  } catch (e: any) {
    msg.error(e.message);
  } finally {
    syncingReviews.value = false;
  }
}

async function refreshActive() {
  refreshing.value = true;
  try {
    if (activeTab.value === 'reviews') await loadReviews();
    if (activeTab.value === 'adjustments') await loadAdjustments();
    if (activeTab.value === 'prices') await queryPrices();
  } finally {
    refreshing.value = false;
  }
}

function confirmReviews(rows: PriceReview[]) {
  if (!rows.length) return;
  dialog.warning({
    title: '同意核价建议价',
    content: `将同意 ${rows.length} 条核价单的建议价。`,
    positiveText: '同意',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const res = await priceReviewsApi.batchConfirm(rows.map((row) => row.id));
        const failed = res.results.filter((row) => !row.ok);
        if (failed.length) msg.warning(`${failed.length} 条处理失败`);
        else msg.success('核价单已同意');
        await loadReviews();
      } catch (e: any) {
        msg.error(e.message);
      }
    },
  });
}

function openReviewReject(rows: PriceReview[]) {
  reviewRejectRows.value = rows.map((review) => ({
    review,
    priceCents: review.suggestedPriceCents ?? review.currentPriceCents ?? 1,
  }));
  reviewRejectVisible.value = true;
}

async function submitReviewReject() {
  if (!reviewRejectReason.value.trim()) {
    msg.warning('请填写拒绝原因');
    return;
  }
  const items: RejectReviewItem[] = reviewRejectRows.value.map((row) => ({
    reviewId: row.review.id,
    counterPriceCents: row.priceCents ?? 1,
    reasons: [{ type: reviewRejectType.value, reason: reviewRejectReason.value }],
  }));
  submittingReviewReject.value = true;
  try {
    const res = await priceReviewsApi.batchRejectItems(items);
    const failed = res.results.filter((row) => !row.ok);
    if (failed.length) msg.warning(`${failed.length} 条拒绝失败`);
    else msg.success('核价单已拒绝');
    reviewRejectVisible.value = false;
    await loadReviews();
  } catch (e: any) {
    msg.error(e.message);
  } finally {
    submittingReviewReject.value = false;
  }
}

function groupAdjustments(rows: AdjustmentOrder[]) {
  const groups = new Map<string, AdjustmentOrder[]>();
  for (const row of rows) {
    groups.set(row.shopId, [...(groups.get(row.shopId) ?? []), row]);
  }
  return groups;
}

function approveAdjustments(rows: AdjustmentOrder[]) {
  if (!rows.length) return;
  dialog.warning({
    title: '通过调价单',
    content: `将通过 ${rows.length} 条调价单。`,
    positiveText: '通过',
    negativeText: '取消',
    onPositiveClick: async () => {
      submittingAdjustment.value = true;
      try {
        for (const [shopId, group] of groupAdjustments(rows)) {
          await priceAdjustmentsApi.batchReview(shopId, 1, group.map((row) => row.priceOrderSn));
        }
        msg.success('调价单已通过');
        await loadAdjustments();
      } catch (e: any) {
        msg.error(e.message);
      } finally {
        submittingAdjustment.value = false;
      }
    },
  });
}

function openAdjustmentReject(rows: AdjustmentOrder[]) {
  if (rows.some((row) => row.shopType === 'full')) {
    msg.warning('全托调价单当前只支持通过');
    return;
  }
  adjustRejectRows.value = rows;
  adjustRejectVisible.value = true;
}

async function rejectAdjustments() {
  if (!adjustRejectReason.value.trim()) {
    msg.warning('请填写驳回原因');
    return;
  }
  submittingAdjustment.value = true;
  try {
    for (const [shopId, group] of groupAdjustments(adjustRejectRows.value)) {
      const rejectReasons = Object.fromEntries(group.map((row) => [row.priceOrderSn, adjustRejectReason.value]));
      await priceAdjustmentsApi.batchReview(shopId, 2, group.map((row) => row.priceOrderSn), rejectReasons);
    }
    msg.success('调价单已驳回');
    adjustRejectVisible.value = false;
    await loadAdjustments();
  } catch (e: any) {
    msg.error(e.message);
  } finally {
    submittingAdjustment.value = false;
  }
}

function parseSkuInput() {
  return skuInput.value
    .split(/[\s,，]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function queryPrices() {
  if (!priceShopId.value || !skuInput.value.trim()) return;
  priceLoading.value = true;
  try {
    const res = await priceAdjustmentsApi.supplierPrices(priceShopId.value, parseSkuInput());
    priceItems.value = res.items;
  } catch (e: any) {
    msg.error(e.message);
  } finally {
    priceLoading.value = false;
  }
}

onMounted(async () => {
  await shops.fetch();
  priceShopId.value = shops.items[0]?.id ?? null;
  await Promise.all([loadReviews(1), loadAdjustments(1)]);
});
</script>

<style scoped>
.summary-grid {
  margin-bottom: 14px;
}
.summary-card {
  min-height: 76px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: var(--ds-radius);
}
.summary-card span {
  display: block;
  color: #667085;
  font-size: 12px;
  font-weight: 700;
}
.summary-card strong {
  display: block;
  margin-top: 8px;
  font-size: 26px;
  line-height: 1;
  color: var(--ds-ink);
}
.workspace-tabs {
  padding: 14px;
  background: #fff;
  border: 1px solid var(--ds-line);
  border-radius: var(--ds-radius);
}
.toolbar,
.price-query {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.toolbar-spacer {
  flex: 1;
}
.filter-control {
  width: 260px;
}
.filter-control.small {
  width: 160px;
}
.search-control {
  min-width: 260px;
  flex: 1;
}
.pager {
  margin-top: 12px;
  justify-content: flex-end;
}
.table-strong {
  font-weight: 600;
}
.table-muted {
  margin-top: 2px;
  color: #667085;
  font-size: 12px;
}
.action-modal {
  max-width: 680px;
}
.modal-alert {
  margin-bottom: 12px;
}
.reject-list {
  width: 100%;
  display: grid;
  gap: 8px;
}
.reject-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  align-items: center;
  gap: 12px;
}
@media (max-width: 760px) {
  .filter-control,
  .filter-control.small,
  .search-control {
    width: 100%;
    min-width: 0;
  }
  .reject-row {
    grid-template-columns: 1fr;
  }
}
</style>
