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
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/', component: DashboardPage, meta: { requiresAuth: true } },
  { path: '/login', component: LoginPage },
  { path: '/shops', component: ShopsListPage, meta: { requiresAuth: true } },
  { path: '/shops/new', component: ShopsConnectPage, meta: { requiresAuth: true } },
  { path: '/products', component: ProductListPage, meta: { requiresAuth: true } },
  { path: '/price-reviews', component: PriceReviewInboxPage, meta: { requiresAuth: true } },
  { path: '/price-reviews/:id', component: PriceReviewDetailPage, meta: { requiresAuth: true } },
  { path: '/settings', component: SettingsPage, meta: { requiresAuth: true } },

  { path: '/sales-analysis',   component: SalesAnalysisPage,   meta: { requiresAuth: true } },
  { path: '/ads-analysis',     component: AdsAnalysisPage,     meta: { requiresAuth: true } },
  { path: '/product-analysis', component: ProductAnalysisPage, meta: { requiresAuth: true } },
  { path: '/shop-analysis',    component: ShopAnalysisPage,    meta: { requiresAuth: true } },
  { path: '/region-analysis',  component: RegionAnalysisPage,  meta: { requiresAuth: true } },
  { path: '/profit-analysis',  component: ProfitAnalysisPage,  meta: { requiresAuth: true } },
  { path: '/inventory-alerts', component: InventoryAlertsPage, meta: { requiresAuth: true } },
  { path: '/reports',          component: ReportsPage,         meta: { requiresAuth: true } },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  try { await auth.init(); } catch { /* env missing, safe to ignore */ }
  if (to.meta.requiresAuth && !auth.isAuthed) return '/login';

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
