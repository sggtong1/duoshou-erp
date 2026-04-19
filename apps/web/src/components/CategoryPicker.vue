<template>
  <n-card title="选择 Temu 类目">
    <n-breadcrumb v-if="path.length">
      <n-breadcrumb-item v-for="(p, i) in path" :key="i" @click="goBack(i)">
        {{ p }}
      </n-breadcrumb-item>
    </n-breadcrumb>
    <n-list bordered hoverable clickable style="margin-top: 12px;">
      <n-list-item v-for="c in children" :key="c.catId" @click="pick(c)">
        <n-thing>
          <template #header>{{ c.catName }}</template>
          <template #description>
            <n-tag v-if="c.isLeaf" type="success" size="small">叶子类目</n-tag>
            <n-tag v-else size="small">继续展开 →</n-tag>
          </template>
        </n-thing>
      </n-list-item>
    </n-list>
  </n-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  NCard, NList, NListItem, NThing, NTag, NBreadcrumb, NBreadcrumbItem,
} from 'naive-ui';
import { temuProxyApi, type TemuCategory } from '@/api-client/temu-proxy.api';

const props = defineProps<{ shopId: string }>();
const emit = defineEmits<{
  (e: 'select', payload: { catId: number; path: string[] }): void;
}>();

const path = ref<string[]>([]);
const idStack = ref<number[]>([0]);
const children = ref<TemuCategory[]>([]);

async function load() {
  if (!props.shopId) return;
  const parent = idStack.value[idStack.value.length - 1];
  children.value = await temuProxyApi.categories(props.shopId, parent);
}

async function pick(c: TemuCategory) {
  if (c.isLeaf) {
    emit('select', { catId: c.catId, path: [...path.value, c.catName] });
    return;
  }
  path.value.push(c.catName);
  idStack.value.push(c.catId);
  await load();
}

function goBack(index: number) {
  path.value = path.value.slice(0, index);
  idStack.value = idStack.value.slice(0, index + 1);
  load();
}

watch(() => props.shopId, load, { immediate: true });
</script>
