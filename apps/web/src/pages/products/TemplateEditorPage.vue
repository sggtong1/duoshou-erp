<template>
  <n-card :title="isEdit ? '编辑模板' : '新建模板'">
    <n-form label-placement="top">
      <n-form-item label="名称">
        <n-input v-model:value="form.name" />
      </n-form-item>
      <n-form-item label="描述">
        <n-input v-model:value="form.description" type="textarea" />
      </n-form-item>

      <n-form-item label="目标店铺类型">
        <n-radio-group v-model:value="form.shopTypeTarget">
          <n-radio value="full">全托管</n-radio>
          <n-radio value="semi">半托管</n-radio>
        </n-radio-group>
      </n-form-item>

      <n-form-item label="参考店铺（加载 Temu 类目 / 上传图片用）">
        <n-select
          v-model:value="referenceShopId"
          :options="shopOptions"
          placeholder="先选一个与本模板同类型的店铺"
        />
      </n-form-item>

      <n-form-item v-if="referenceShopId" label="Temu 类目">
        <n-space vertical style="width: 100%;">
          <div v-if="form.temuCategoryId">
            已选：{{ form.temuCategoryPath.join(' / ') }} (catId={{ form.temuCategoryId }})
            <n-button size="tiny" @click="resetCategory">换一个</n-button>
          </div>
          <category-picker v-else :shop-id="referenceShopId" @select="onCategoryPick" />
        </n-space>
      </n-form-item>

      <n-form-item label="主图">
        <image-upload v-model="mainImageWrap" :shop-id="referenceShopId" :max="1" />
      </n-form-item>

      <n-form-item label="轮播图（最多 9）">
        <image-upload v-model="form.carouselImageUrls" :shop-id="referenceShopId" :max="9" />
      </n-form-item>

      <n-form-item label="建议售价（元）">
        <n-input-number v-model:value="priceYuan" :min="0.01" :step="0.01" />
        <span style="margin-left: 8px; color: #999;">
          = {{ Math.round(priceYuan * 100) }} 分
        </span>
      </n-form-item>

      <n-form-item label="包装尺寸（毫米）/ 重量（克）">
        <n-space>
          <n-input-number v-model:value="form.outerPackage.lengthMm" :min="1" placeholder="长" />
          <n-input-number v-model:value="form.outerPackage.widthMm" :min="1" placeholder="宽" />
          <n-input-number v-model:value="form.outerPackage.heightMm" :min="1" placeholder="高" />
          <n-input-number v-model:value="form.outerPackage.weightG" :min="1" placeholder="重量" />
        </n-space>
      </n-form-item>

      <n-form-item label="属性（key: value）">
        <n-dynamic-input
          v-model:value="attrsList"
          :on-create="() => ({ k: '', v: '' })"
        >
          <template #default="{ value }">
            <n-input v-model:value="value.k" placeholder="属性名" />
            <n-input v-model:value="value.v" placeholder="属性值" style="margin-left: 8px;" />
          </template>
        </n-dynamic-input>
      </n-form-item>

      <n-space>
        <n-button type="primary" :loading="saving" @click="save">
          {{ isEdit ? '保存' : '创建' }}
        </n-button>
        <n-button v-if="savedId" @click="openPublish">发布到多店铺</n-button>
        <n-button @click="$router.back()">返回</n-button>
      </n-space>
    </n-form>

    <n-modal
      v-model:show="publishOpen"
      preset="card"
      title="发布到多店铺"
      style="width: 600px;"
    >
      <n-form label-placement="top">
        <n-form-item label="选择店铺（按目标类型筛选）">
          <shop-multiselect
            v-model="publishShopIds"
            :filter-shop-type="form.shopTypeTarget"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-button type="primary" :loading="publishing" @click="doPublish">发起发布</n-button>
      </template>
    </n-modal>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  useMessage, NCard, NForm, NFormItem, NInput, NInputNumber, NSelect,
  NRadioGroup, NRadio, NSpace, NButton, NModal, NDynamicInput,
} from 'naive-ui';
import CategoryPicker from '@/components/CategoryPicker.vue';
import ImageUpload from '@/components/ImageUpload.vue';
import ShopMultiselect from '@/components/ShopMultiselect.vue';
import { useShopsStore } from '@/stores/shops';
import { templatesApi, type CreateTemplateInput } from '@/api-client/templates.api';
import { bulkJobsApi } from '@/api-client/bulk-jobs.api';

const route = useRoute();
const router = useRouter();
const msg = useMessage();

const isEdit = computed(() => !!route.params.id && route.params.id !== 'new');
const savedId = ref<string | null>(isEdit.value ? String(route.params.id) : null);

const form = ref<CreateTemplateInput>({
  name: '',
  description: '',
  temuCategoryId: 0,
  temuCategoryPath: [],
  shopTypeTarget: 'full',
  mainImageUrl: '',
  carouselImageUrls: [],
  suggestedPriceCents: 100,
  attributes: {},
  outerPackage: { lengthMm: 100, widthMm: 100, heightMm: 100, weightG: 200 },
});
const referenceShopId = ref<string>('');
const priceYuan = ref<number>(1.0);
const attrsList = ref<Array<{ k: string; v: string }>>([]);

const shops = useShopsStore();
const shopOptions = computed(() =>
  shops.items.map((s) => ({
    label: `${s.displayName ?? s.platformShopId} (${s.shopType})`,
    value: s.id,
  })),
);

const mainImageWrap = computed({
  get: () => (form.value.mainImageUrl ? [form.value.mainImageUrl] : []),
  set: (v: string[]) => { form.value.mainImageUrl = v[0] ?? ''; },
});

onMounted(async () => {
  await shops.fetch();
  if (isEdit.value) {
    const t = await templatesApi.get(String(route.params.id));
    form.value = {
      name: t.name,
      description: t.description,
      temuCategoryId: Number(t.temuCategoryId),
      temuCategoryPath: t.temuCategoryPath,
      shopTypeTarget: t.shopTypeTarget,
      mainImageUrl: t.mainImageUrl,
      carouselImageUrls: t.carouselImageUrls,
      suggestedPriceCents: Number(t.suggestedPriceCents),
      attributes: t.attributes,
      outerPackage: t.outerPackage,
    };
    priceYuan.value = Number(t.suggestedPriceCents) / 100;
    attrsList.value = Object.entries(t.attributes).map(([k, v]) => ({ k, v: String(v) }));
  }
});

watch(priceYuan, (v) => {
  form.value.suggestedPriceCents = Math.round(v * 100);
});

watch(attrsList, (list) => {
  form.value.attributes = Object.fromEntries(
    list.filter((x) => x.k).map((x) => [x.k, x.v]),
  );
}, { deep: true });

function onCategoryPick(e: { catId: number; path: string[] }) {
  form.value.temuCategoryId = e.catId;
  form.value.temuCategoryPath = e.path;
}

function resetCategory() {
  form.value.temuCategoryId = 0;
  form.value.temuCategoryPath = [];
}

const saving = ref(false);
async function save() {
  if (!form.value.mainImageUrl) { msg.error('请上传主图'); return; }
  if (!form.value.temuCategoryId) { msg.error('请选择 Temu 叶子类目'); return; }
  saving.value = true;
  try {
    let res;
    if (savedId.value) {
      res = await templatesApi.update(savedId.value, form.value);
      msg.success('已保存');
    } else {
      res = await templatesApi.create(form.value);
      savedId.value = res.id;
      msg.success('已创建');
      router.replace(`/templates/${res.id}`);
    }
  } catch (e: any) {
    msg.error(e.message);
  } finally {
    saving.value = false;
  }
}

const publishOpen = ref(false);
const publishShopIds = ref<string[]>([]);
const publishing = ref(false);

function openPublish() { publishOpen.value = true; }

async function doPublish() {
  if (publishShopIds.value.length === 0) { msg.error('请选择至少 1 家店铺'); return; }
  publishing.value = true;
  try {
    const job = await bulkJobsApi.dispatchPublish({
      templateId: savedId.value!,
      shopIds: publishShopIds.value,
    });
    msg.success('发布任务已创建');
    publishOpen.value = false;
    router.push(`/bulk-jobs/${job.id}`);
  } catch (e: any) {
    msg.error(e.message);
  } finally {
    publishing.value = false;
  }
}
</script>
