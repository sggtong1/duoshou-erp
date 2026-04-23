<template>
  <n-layout has-sider style="min-height: 100vh;">
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="56"
      :width="220"
      :collapsed="collapsed"
      show-trigger
      @collapse="onCollapse(true)"
      @expand="onCollapse(false)"
    >
      <div class="logo">{{ collapsed ? '舵' : '舵手 ERP' }}</div>
      <n-menu
        :value="activeKey"
        :collapsed="collapsed"
        :collapsed-width="56"
        :options="menuOptions"
        @update:value="(k) => router.push(k)"
      />
      <div v-if="!collapsed" class="sidebar-footer">
        <div class="freshness">数据更新时间<br/>{{ freshnessDisplay }}</div>
      </div>
    </n-layout-sider>

    <n-layout>
      <div class="top-header">
        <div class="page-title">电商运营 BI 数据看板</div>
        <div class="top-right">
          <GlobalSearch />
          <n-button text style="margin: 0 12px; color: #999;">🔔</n-button>
          <UserMenu />
        </div>
      </div>

      <TopFilterBar v-if="showFilters" />

      <n-layout-content style="padding: 16px; background: #f5f7fa; min-height: calc(100vh - 140px);">
        <slot />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NLayout, NLayoutSider, NLayoutContent, NMenu, NButton, NBadge,
} from 'naive-ui';
import type { MenuOption } from 'naive-ui';
import GlobalSearch from '@/components/layout/GlobalSearch.vue';
import UserMenu from '@/components/layout/UserMenu.vue';
import TopFilterBar from '@/components/layout/TopFilterBar.vue';
import { useDashboardStore } from '@/stores/dashboard';

const route = useRoute();
const router = useRouter();
const dashboard = useDashboardStore();

const collapsed = ref(localStorage.getItem('sidebar-collapsed') === 'true');
function onCollapse(v: boolean) {
  collapsed.value = v;
  localStorage.setItem('sidebar-collapsed', String(v));
}

const lowStockBadge = computed(() => dashboard.data?.alerts.lowStockCount ?? 0);

const menuOptions = computed<MenuOption[]>(() => [
  { label: '📊 总览',       key: '/' },
  { label: '📈 销售分析',    key: '/sales-analysis' },
  { label: '📢 广告分析',    key: '/ads-analysis' },
  { label: '📦 商品分析',    key: '/product-analysis' },
  { label: '🏪 店铺分析',    key: '/shop-analysis' },
  { label: '🌍 区域分析',    key: '/region-analysis' },
  { label: '💰 利润分析',    key: '/profit-analysis' },
  {
    key: '/inventory-alerts',
    label: () => h('span', null, [
      '⚠ 库存预警  ',
      lowStockBadge.value > 0 ? h(NBadge, { value: lowStockBadge.value, max: 99 }) : null,
    ]),
  },
  { label: '📄 数据报表',    key: '/reports' },
]);

const activeKey = computed(() => {
  const p = route.path;
  if (p === '/') return '/';
  const keys = ['/sales-analysis','/ads-analysis','/product-analysis','/shop-analysis','/region-analysis','/profit-analysis','/inventory-alerts','/reports'];
  return keys.find((k) => p.startsWith(k)) ?? '/';
});

const showFilters = computed(() => {
  const p = route.path;
  if (p === '/') return true;
  return ['/sales-analysis','/ads-analysis','/product-analysis','/shop-analysis','/region-analysis','/profit-analysis','/inventory-alerts','/reports']
    .some((k) => p.startsWith(k));
});

const freshnessDisplay = computed(() => {
  const t = dashboard.data?.dataFreshness;
  if (!t) return '—';
  const d = new Date(t);
  return d.toLocaleString('zh-CN', { hour12: false });
});

watch(() => route.path, () => {
  if (showFilters.value && !dashboard.data && !dashboard.loading) {
    dashboard.fetch({});
  }
}, { immediate: true });
</script>

<style scoped>
.logo {
  padding: 16px;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid var(--n-border-color, #eee);
}
.sidebar-footer {
  position: absolute;
  bottom: 48px; left: 0; right: 0;
  padding: 12px 16px;
  font-size: 11px;
  color: #999;
}
.freshness { line-height: 1.5; }
.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.page-title { font-size: 16px; font-weight: 600; color: #333; }
.top-right { display: flex; align-items: center; }
</style>
