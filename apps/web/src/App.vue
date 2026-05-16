<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides">
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
import { NConfigProvider, NMessageProvider, NDialogProvider, zhCN, dateZhCN, type GlobalThemeOverrides } from 'naive-ui';
import MainLayout from '@/layouts/MainLayout.vue';

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#2452d9',
    primaryColorHover: '#3467f6',
    primaryColorPressed: '#183996',
    primaryColorSuppl: '#3467f6',
    borderRadius: '6px',
    fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  Card: {
    borderRadius: '6px',
    borderColor: '#e6ebf2',
  },
  Button: {
    borderRadiusMedium: '4px',
    borderRadiusSmall: '4px',
  },
  Menu: {
    itemTextColorActive: '#2452d9',
    itemTextColorActiveHover: '#2452d9',
    itemIconColorActive: '#2452d9',
    itemIconColorActiveHover: '#2452d9',
    itemColorActive: '#edf3ff',
    itemColorActiveHover: '#edf3ff',
    itemColorHover: '#f5f8fc',
  },
};
</script>
