<template>
  <n-layout class="app-layout">
    <header class="global-header">
      <button class="brand" @click="router.push('/')">
        <span class="brand-mark">DS</span>
        <span class="brand-name">舵手 ERP</span>
      </button>

      <div class="menu-area" @mouseleave="closeMenu">
        <nav class="primary-nav" aria-label="主导航">
          <button
            v-for="item in navItems"
            :key="item.label"
            class="nav-item"
            :class="{ active: activeTopLabel === item.label }"
            @mouseenter="openMenu(item, $event)"
            @focus="openMenu(item, $event)"
          >
            <span>{{ item.label }}</span>
          </button>
        </nav>

        <div
          v-if="activeMenu"
          class="mega-menu"
          :style="{ left: `${megaLeft}px`, width: `${megaWidth}px` }"
        >
          <div v-for="group in activeMenu.groups" :key="group.title" class="mega-row">
            <div class="mega-group-title">{{ group.title }}</div>
            <div class="mega-children">
              <button
                v-for="child in group.children"
                :key="child.label"
                class="mega-child"
                @click="goLeaf(child.route)"
              >
                {{ child.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="header-actions">
        <button class="platform-switch">多平台</button>
        <button class="ai-button">AI</button>
        <button class="header-icon">搜索</button>
        <button class="header-icon">下载</button>
        <button class="header-icon">通知</button>
        <button class="header-help">帮助</button>
        <UserMenu />
      </div>
    </header>

    <div class="workspace-strip">
      <div class="workspace-tabs">
        <button class="home-tab" @click="router.push('/')">首页</button>
        <button class="active-workspace">
          <span>{{ currentModule }}</span>
          <strong>{{ currentTitle }}</strong>
        </button>
      </div>
      <div class="workspace-status">
        <span>数据更新时间 {{ freshnessDisplay }}</span>
        <span v-if="lowStockBadge > 0">低库存预警 {{ lowStockBadge }}</span>
      </div>
    </div>

    <div class="notice-bar">
      <span>「多平台运营工作台」已接入 BI 看板与 Temu 核价/调价操作，接口权限异常会在同步结果中提示。</span>
      <button @click="router.push('/pricing-ops')">查看价格任务</button>
    </div>

    <TopFilterBar v-if="showFilters" />

    <n-layout-content class="app-content">
      <slot />
    </n-layout-content>
  </n-layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NLayout, NLayoutContent } from 'naive-ui';
import UserMenu from '@/components/layout/UserMenu.vue';
import TopFilterBar from '@/components/layout/TopFilterBar.vue';
import { useDashboardStore } from '@/stores/dashboard';
import { operationNavItems, type OperationNavItem } from '@/config/operationNavigation';

const route = useRoute();
const router = useRouter();
const dashboard = useDashboardStore();

const lowStockBadge = computed(() => dashboard.data?.alerts.lowStockCount ?? 0);
const navItems = operationNavItems;
const activeMenu = ref<OperationNavItem | null>(null);
const megaLeft = ref(62);
const megaWidth = ref(520);

const routeMeta: Array<{ key: string; module: string; title: string }> = [
  { key: '/pricing-ops', module: '运营操作', title: '价格操作台' },
  { key: '/price-reviews', module: '运营操作', title: '价格操作台' },
  { key: '/shops', module: '基础配置', title: '店铺连接' },
  { key: '/products', module: '商品运营', title: '商品管理' },
  { key: '/sales-analysis', module: '销售', title: '销售分析' },
  { key: '/ads-analysis', module: '广告', title: '广告分析' },
  { key: '/product-analysis', module: '商品运营', title: '商品分析' },
  { key: '/shop-analysis', module: '店铺', title: '店铺分析' },
  { key: '/region-analysis', module: '区域', title: '区域分析' },
  { key: '/profit-analysis', module: '财务', title: '利润分析' },
  { key: '/inventory-alerts', module: '库存', title: '库存预警' },
  { key: '/reports', module: '数据', title: '数据报表' },
  { key: '/settings', module: '设置', title: '系统设置' },
];

const activeTopLabel = computed(() => {
  const p = route.path;
  if (p.startsWith('/products') || p.startsWith('/product-analysis')) return '商品';
  if (p.startsWith('/pricing-ops') || p.startsWith('/price-reviews') || p.startsWith('/sales-analysis')) return '销售';
  if (p.startsWith('/ads-analysis')) return '广告';
  if (p.startsWith('/inventory-alerts')) return '仓库';
  if (p.startsWith('/reports') || p === '/') return '数据';
  if (p.startsWith('/profit-analysis')) return '财务';
  if (p.startsWith('/shops') || p.startsWith('/settings')) return '设置';
  if (p.startsWith('/modules/')) {
    const top = String(route.query.top ?? '');
    return top || '';
  }
  return '';
});

const currentRouteMeta = computed(() => {
  if (route.path === '/') return { module: '经营', title: '多平台经营总览' };
  return routeMeta.find((x) => route.path.startsWith(x.key)) ?? { module: '工作台', title: '运营看板' };
});

const currentModule = computed(() => currentRouteMeta.value.module);
const currentTitle = computed(() => currentRouteMeta.value.title);

function openMenu(item: OperationNavItem, event: MouseEvent | FocusEvent) {
  activeMenu.value = item;
  const target = event.currentTarget as HTMLElement;
  const header = target.closest('.global-header') as HTMLElement | null;
  const targetRect = target.getBoundingClientRect();
  const headerRect = header?.getBoundingClientRect();
  megaLeft.value = Math.max(54, Math.round(targetRect.left - (headerRect?.left ?? 0)));
  const maxChildren = Math.max(...item.groups.map((group) => group.children.length), 1);
  megaWidth.value = Math.min(820, Math.max(360, 140 + Math.min(maxChildren, 9) * 76));
}

function closeMenu() {
  activeMenu.value = null;
}

function goLeaf(routePath: string) {
  closeMenu();
  router.push(routePath);
}

const showFilters = computed(() => {
  const p = route.path;
  if (p === '/') return true;
  return ['/sales-analysis', '/ads-analysis', '/product-analysis', '/shop-analysis', '/region-analysis', '/profit-analysis', '/inventory-alerts', '/reports']
    .some((k) => p.startsWith(k));
});

const freshnessDisplay = computed(() => {
  const t = dashboard.data?.dataFreshness;
  if (!t) return '等待同步';
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
.app-layout {
  min-height: 100vh;
  background: var(--ds-bg);
}
.global-header {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 18px;
  background: #071a3d;
  color: #fff;
}
.brand {
  height: 44px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
}
.brand-mark {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: linear-gradient(135deg, #ff9d27, #ffcf4a);
  color: #061536;
  font-size: 11px;
  font-weight: 900;
}
.brand-name {
  font-size: 15px;
  font-weight: 800;
  white-space: nowrap;
}
.primary-nav {
  min-width: 0;
  display: flex;
  align-items: stretch;
  height: 44px;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}
.primary-nav::-webkit-scrollbar {
  display: none;
}
.nav-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 13px;
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.nav-item:hover,
.nav-item.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border-bottom-color: #4aa3ff;
}
.menu-area {
  position: relative;
  min-width: 0;
  display: flex;
  flex: 1;
  height: 44px;
}
.mega-menu {
  position: absolute;
  top: 44px;
  z-index: 40;
  padding: 6px 16px 8px;
  border: 1px solid #d8e1f2;
  border-top: 0;
  border-radius: 0 0 4px 4px;
  background: #fff;
  box-shadow: 0 12px 22px rgba(7, 26, 61, 0.13);
}
.mega-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  min-height: 49px;
  align-items: start;
  border-bottom: 1px solid #eef2f8;
}
.mega-row:last-child {
  border-bottom: 0;
}
.mega-group-title {
  position: relative;
  padding: 15px 12px 0 24px;
  color: #2d3a52;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}
.mega-group-title::before {
  content: "";
  position: absolute;
  left: 8px;
  top: 20px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #2452d9;
}
.mega-children {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  padding: 8px 0;
}
.mega-child {
  height: 32px;
  min-width: 60px;
  padding: 0 12px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #344054;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
}
.mega-child:hover {
  background: #edf3ff;
  color: #2452d9;
  font-weight: 700;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}
.platform-switch,
.ai-button {
  height: 26px;
  border: 0;
  border-radius: 15px;
  color: #fff;
  cursor: pointer;
  font-weight: 800;
}
.platform-switch {
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.14);
}
.ai-button {
  width: 28px;
  padding: 0;
  background: linear-gradient(135deg, #4c6fff, #8f65ff);
}
.header-icon,
.header-help {
  height: 28px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.84;
}
.header-icon:hover,
.header-help:hover {
  opacity: 1;
}
.workspace-strip {
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 16px;
  background: #213b98;
  color: #fff;
}
.workspace-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.home-tab,
.active-workspace {
  height: 26px;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
}
.home-tab {
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-weight: 700;
}
.active-workspace {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  background: #fff;
  color: #24324b;
}
.active-workspace span {
  color: var(--ds-primary);
  font-size: 12px;
  font-weight: 800;
}
.active-workspace strong {
  font-size: 13px;
}
.workspace-status {
  display: flex;
  align-items: center;
  gap: 14px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  white-space: nowrap;
}
.notice-bar {
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 16px;
  background: #fff5df;
  border-bottom: 1px solid #f5e5c7;
  color: #6c4a12;
  font-size: 13px;
}
.notice-bar button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ds-primary);
  font-weight: 800;
  cursor: pointer;
}
.app-content {
  min-height: calc(100vh - 146px);
  padding: 16px;
  background: transparent;
}
@media (max-width: 1100px) {
  .global-header {
    height: auto;
    min-height: 44px;
    flex-wrap: wrap;
    padding: 8px 12px;
  }
  .primary-nav {
    order: 3;
    flex-basis: 100%;
  }
  .menu-area {
    order: 3;
    flex-basis: 100%;
  }
  .header-actions {
    margin-left: auto;
  }
}
@media (max-width: 760px) {
  .workspace-strip,
  .notice-bar {
    align-items: flex-start;
    height: auto;
    flex-direction: column;
    padding: 8px 12px;
  }
  .workspace-status,
  .header-actions {
    flex-wrap: wrap;
  }
}
</style>
