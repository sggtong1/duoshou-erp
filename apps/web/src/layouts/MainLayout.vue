<template>
  <n-layout has-sider style="min-height: 100vh;">
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      :collapsed="collapsed"
      show-trigger
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="logo">舵手 ERP</div>
      <n-menu
        :value="activeKey"
        :collapsed="collapsed"
        :collapsed-width="64"
        :options="menuOptions"
        @update:value="onMenuClick"
      />
    </n-layout-sider>
    <n-layout>
      <n-layout-content style="padding: 16px;">
        <slot />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NLayout, NLayoutSider, NLayoutContent, NMenu,
} from 'naive-ui';
import type { MenuOption } from 'naive-ui';

const route = useRoute();
const router = useRouter();
const collapsed = ref(false);

const menuOptions: MenuOption[] = [
  { label: '📊 Dashboard', key: '/' },
  { label: '🏪 店铺管理', key: '/shops' },
  { label: '📦 我的商品', key: '/products' },
  { label: '🔔 核价提醒', key: '/price-reviews' },
  { label: '⚙️ 设置', key: '/settings' },
];

const activeKey = computed(() => {
  const p = route.path;
  if (p === '/') return '/';
  if (p.startsWith('/shops')) return '/shops';
  if (p.startsWith('/products')) return '/products';
  if (p.startsWith('/price-reviews')) return '/price-reviews';
  if (p.startsWith('/settings')) return '/settings';
  return '/';
});

function onMenuClick(key: string) {
  router.push(key);
}
</script>

<style scoped>
.logo {
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid var(--n-border-color, #eee);
}
</style>
