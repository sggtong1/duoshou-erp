<template>
  <n-result status="info" :title="title" :description="description" style="margin-top: 80px;">
    <template #icon>
      <n-icon :size="72" :depth="3">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2 L14.5 9.5 L22 10 L16 15 L18 22 L12 18 L6 22 L8 15 L2 10 L9.5 9.5 Z" />
        </svg>
      </n-icon>
    </template>
    <template #footer>
      <n-button @click="$router.push('/')">返回总览</n-button>
    </template>
  </n-result>
</template>

<script setup lang="ts">
import { NResult, NButton, NIcon } from 'naive-ui';

defineProps<{
  title: string;
  description: string;
}>();
</script>
