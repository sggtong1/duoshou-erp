<template>
  <n-card title="舵手 ERP" style="max-width: 600px; margin: 60px auto;">
    <n-h2>快速入口</n-h2>
    <n-space vertical>
      <n-button @click="$router.push('/templates')">货品模板</n-button>
      <n-button @click="$router.push('/products')">我的商品</n-button>
      <n-button @click="$router.push('/price-reviews')">核价单</n-button>
      <n-button @click="$router.push('/price-adjustments/new')">提交调价</n-button>
      <n-button @click="auth.logout()">退出登录</n-button>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NH2, NButton, NSpace } from 'naive-ui';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
</script>
