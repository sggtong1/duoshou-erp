<template>
  <div>
    <n-upload
      :max="max"
      :show-file-list="false"
      :custom-request="handleUpload"
      accept="image/*"
    >
      <n-button :loading="busy">{{ busy ? '上传中…' : '选图片' }}</n-button>
    </n-upload>
    <div v-if="modelValue.length" class="thumbs">
      <img
        v-for="(u, i) in modelValue"
        :key="u"
        :src="u"
        :class="i === 0 ? 'thumb primary' : 'thumb'"
        @click="remove(i)"
        :title="'点击移除'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { NUpload, NButton, useMessage } from 'naive-ui';
import { temuProxyApi } from '@/api-client/temu-proxy.api';

const props = defineProps<{ modelValue: string[]; shopId: string; max?: number }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string[]): void }>();

const busy = ref(false);
const msg = useMessage();

async function handleUpload(opts: any) {
  if (!props.shopId) { msg.error('请先选择参考店铺'); opts.onError(); return; }
  busy.value = true;
  try {
    const { url } = await temuProxyApi.uploadImage(props.shopId, opts.file.file);
    emit('update:modelValue', [...props.modelValue, url]);
    opts.onFinish();
  } catch (e: any) {
    msg.error(e.message);
    opts.onError();
  } finally {
    busy.value = false;
  }
}

function remove(i: number) {
  const next = [...props.modelValue];
  next.splice(i, 1);
  emit('update:modelValue', next);
}
</script>

<style scoped>
.thumbs {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border: 1px solid #ddd;
  cursor: pointer;
}
.thumb.primary {
  border-color: #18a058;
  border-width: 2px;
}
</style>
