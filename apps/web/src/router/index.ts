import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import DashboardPage from '@/pages/dashboard/DashboardPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import ShopsListPage from '@/pages/shops/ShopsListPage.vue';
import ShopsConnectPage from '@/pages/shops/ShopsConnectPage.vue';
import ProductListPage from '@/pages/products/ProductListPage.vue';
import PriceReviewInboxPage from '@/pages/price-reviews/PriceReviewInboxPage.vue';
import PriceReviewDetailPage from '@/pages/price-reviews/PriceReviewDetailPage.vue';
import SettingsPage from '@/pages/settings/SettingsPage.vue';
import SalesAnalysisPage from '@/pages/sales-analysis/SalesAnalysisPage.vue';
import AdsAnalysisPage from '@/pages/ads-analysis/AdsAnalysisPage.vue';
import ProductAnalysisPage from '@/pages/product-analysis/ProductAnalysisPage.vue';
import ShopAnalysisPage from '@/pages/shop-analysis/ShopAnalysisPage.vue';
import RegionAnalysisPage from '@/pages/region-analysis/RegionAnalysisPage.vue';
import ProfitAnalysisPage from '@/pages/profit-analysis/ProfitAnalysisPage.vue';
import InventoryAlertsPage from '@/pages/inventory-alerts/InventoryAlertsPage.vue';
import ReportsPage from '@/pages/reports/ReportsPage.vue';
import GenericListPage from '@/pages/_generic/GenericListPage.vue';
import MultiPlatformBoardPage from '@/pages/data/MultiPlatformBoardPage.vue';
import AllOrdersPage from '@/pages/orders/AllOrdersPage.vue';
import StockDetailPage from '@/pages/warehouse/StockDetailPage.vue';
import MultiProfitReportPage from '@/pages/finance/MultiProfitReportPage.vue';
import TemuOnlineProductsPage from '@/pages/sales/TemuOnlineProductsPage.vue';
import TemuActivityDeclarePage from '@/pages/sales/TemuActivityDeclarePage.vue';
import TemuDeclareRecordPage from '@/pages/sales/TemuDeclareRecordPage.vue';
import { useAuthStore } from '@/stores/auth';
import { MENU_TREE } from './menu-config';

const explicitPaths = new Set<string>([
  '/', '/login', '/shops', '/shops/new',
  '/products',
  '/sales/online/temu',
  '/sales/temu-activity',
  '/sales/temu-activity/history',
  '/orders/all',
  '/warehouse/stock-detail',
  '/finance/profit/multi',
  '/price-reviews', '/settings',
  '/sales-analysis', '/ads-analysis', '/product-analysis',
  '/shop-analysis', '/region-analysis', '/profit-analysis',
  '/inventory-alerts', '/reports',
]);

function buildGenericRoutes(): RouteRecordRaw[] {
  const out: RouteRecordRaw[] = [];
  for (const root of MENU_TREE) {
    for (const g of root.groups) {
      for (const c of g.children) {
        if (explicitPaths.has(c.path)) continue;
        out.push({
          path: c.path,
          component: GenericListPage,
          meta: {
            requiresAuth: true,
            title: c.label,
            badge: c.badge,
            rootKey: root.key,
            groupKey: g.key,
            leafKey: c.key,
          },
        });
      }
    }
  }
  return out;
}

const routes: RouteRecordRaw[] = [
  { path: '/', component: MultiPlatformBoardPage, meta: { requiresAuth: true, title: '多平台看板', rootKey: 'data' } },
  { path: '/login', component: LoginPage },

  { path: '/shops', component: ShopsListPage, meta: { requiresAuth: true, title: '店铺授权', rootKey: 'settings' } },
  { path: '/shops/new', component: ShopsConnectPage, meta: { requiresAuth: true, title: '绑定新店铺', rootKey: 'settings' } },

  { path: '/products', component: ProductListPage, meta: { requiresAuth: true, title: '商品列表', rootKey: 'product' } },
  { path: '/sales/online/temu', component: TemuOnlineProductsPage, meta: { requiresAuth: true, title: 'Temu 在线产品', rootKey: 'sales' } },
  { path: '/sales/temu-activity', component: TemuActivityDeclarePage, meta: { requiresAuth: true, title: 'Temu 活动申报', rootKey: 'sales' } },
  { path: '/sales/temu-activity/history', component: TemuDeclareRecordPage, meta: { requiresAuth: true, title: '申报记录', rootKey: 'sales' } },
  { path: '/orders/all', component: AllOrdersPage, meta: { requiresAuth: true, title: '全部订单', rootKey: 'order' } },
  { path: '/warehouse/stock-detail', component: StockDetailPage, meta: { requiresAuth: true, title: '库存明细', rootKey: 'warehouse' } },
  { path: '/finance/profit/multi', component: MultiProfitReportPage, meta: { requiresAuth: true, title: '多平台利润报表', rootKey: 'finance' } },

  { path: '/price-reviews', component: PriceReviewInboxPage, meta: { requiresAuth: true, title: '价格审核' } },
  { path: '/price-reviews/:id', component: PriceReviewDetailPage, meta: { requiresAuth: true, title: '价格审核详情' } },
  { path: '/settings', component: SettingsPage, meta: { requiresAuth: true, title: '设置' } },

  { path: '/sales-analysis', component: SalesAnalysisPage, meta: { requiresAuth: true, title: '销售分析', rootKey: 'data' } },
  { path: '/ads-analysis', component: AdsAnalysisPage, meta: { requiresAuth: true, title: '广告分析', rootKey: 'data' } },
  { path: '/product-analysis', component: ProductAnalysisPage, meta: { requiresAuth: true, title: '商品分析', rootKey: 'data' } },
  { path: '/shop-analysis', component: ShopAnalysisPage, meta: { requiresAuth: true, title: '店铺分析', rootKey: 'data' } },
  { path: '/region-analysis', component: RegionAnalysisPage, meta: { requiresAuth: true, title: '区域分析', rootKey: 'data' } },
  { path: '/profit-analysis', component: ProfitAnalysisPage, meta: { requiresAuth: true, title: '利润分析', rootKey: 'finance' } },
  { path: '/inventory-alerts', component: InventoryAlertsPage, meta: { requiresAuth: true, title: '库存预警', rootKey: 'warehouse' } },
  { path: '/reports', component: ReportsPage, meta: { requiresAuth: true, title: '数据报表', rootKey: 'data' } },
  { path: '/legacy-dashboard', component: DashboardPage, meta: { requiresAuth: true, title: 'BI 看板（旧）' } },

  ...buildGenericRoutes(),
];

const router = createRouter({ history: createWebHistory(), routes });

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isDemoMode = !supabaseUrl || !supabaseKey || String(supabaseUrl).includes('xxx.supabase.co');

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  try { await auth.init(); } catch { /* env missing, safe to ignore */ }
  if (to.meta.requiresAuth && !auth.isAuthed) return '/login';

  if (isDemoMode) return; // skip onboarding gate in demo mode

  if (to.meta.requiresAuth && !to.path.startsWith('/shops')) {
    const { useShopsStore } = await import('@/stores/shops');
    const shops = useShopsStore();
    if (!shops.items.length) {
      try { await shops.fetch(); }
      catch { return true; }
    }
    const hasActive = shops.items.some((s) => s.status === 'active');
    if (!hasActive) return '/shops/new';
  }
});

export default router;
