import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import HomePage from '@/pages/HomePage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import TemplateListPage from '@/pages/products/TemplateListPage.vue';
import TemplateEditorPage from '@/pages/products/TemplateEditorPage.vue';
import ProductListPage from '@/pages/products/ProductListPage.vue';
import BulkJobProgressPage from '@/pages/bulk-jobs/BulkJobProgressPage.vue';
import PriceReviewInboxPage from '@/pages/price-reviews/PriceReviewInboxPage.vue';
import PriceReviewDetailPage from '@/pages/price-reviews/PriceReviewDetailPage.vue';
import PriceAdjustmentSubmitPage from '@/pages/price-adjustments/PriceAdjustmentSubmitPage.vue';
import ActivityListPage from '@/pages/activities/ActivityListPage.vue';
import ActivityDetailPage from '@/pages/activities/ActivityDetailPage.vue';
import EnrollmentListPage from '@/pages/enrollments/EnrollmentListPage.vue';
import ShopsListPage from '@/pages/shops/ShopsListPage.vue';
import ShopsConnectPage from '@/pages/shops/ShopsConnectPage.vue';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/', component: HomePage, meta: { requiresAuth: true } },
  { path: '/login', component: LoginPage },
  { path: '/products', component: ProductListPage, meta: { requiresAuth: true } },
  { path: '/templates', component: TemplateListPage, meta: { requiresAuth: true } },
  { path: '/templates/new', component: TemplateEditorPage, meta: { requiresAuth: true } },
  { path: '/templates/:id', component: TemplateEditorPage, meta: { requiresAuth: true } },
  { path: '/bulk-jobs/:id', component: BulkJobProgressPage, meta: { requiresAuth: true } },
  { path: '/price-reviews', component: PriceReviewInboxPage, meta: { requiresAuth: true } },
  { path: '/price-reviews/:id', component: PriceReviewDetailPage, meta: { requiresAuth: true } },
  { path: '/price-adjustments/new', component: PriceAdjustmentSubmitPage, meta: { requiresAuth: true } },
  { path: '/activities', component: ActivityListPage, meta: { requiresAuth: true } },
  { path: '/activities/:id', component: ActivityDetailPage, meta: { requiresAuth: true } },
  { path: '/enrollments', component: EnrollmentListPage, meta: { requiresAuth: true } },
  { path: '/shops', component: ShopsListPage, meta: { requiresAuth: true } },
  { path: '/shops/new', component: ShopsConnectPage, meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  try { await auth.init(); } catch { /* env missing, safe to ignore */ }
  if (to.meta.requiresAuth && !auth.isAuthed) return '/login';

  // 强制 onboarding: 已登录但无 active shop 时,把访问受保护页面的请求拦到 /shops/new
  if (to.meta.requiresAuth && !to.path.startsWith('/shops') && !to.path.startsWith('/login')) {
    const { useShopsStore } = await import('@/stores/shops');
    const shops = useShopsStore();
    if (!shops.items.length) {
      try { await shops.fetch(); }
      catch { /* fetch 失败不阻塞;用户看到空 list,不硬 redirect */ return true; }
    }
    const hasActive = shops.items.some((s) => s.status === 'active');
    if (!hasActive) return '/shops/new';
  }
});

export default router;
