<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-dialog-provider>
        <template v-if="$route.path === '/login'">
          <router-view />
        </template>
        <template v-else>
          <MainLayout>
            <router-view />
          </MainLayout>
        </template>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NDialogProvider, zhCN, dateZhCN } from 'naive-ui';
import MainLayout from '@/layouts/MainLayout.vue';
</script>
