import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import HomePage from '@/pages/HomePage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import TemplateListPage from '@/pages/products/TemplateListPage.vue';
import TemplateEditorPage from '@/pages/products/TemplateEditorPage.vue';
import ProductListPage from '@/pages/products/ProductListPage.vue';
import BulkJobProgressPage from '@/pages/bulk-jobs/BulkJobProgressPage.vue';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  { path: '/', component: HomePage, meta: { requiresAuth: true } },
  { path: '/login', component: LoginPage },
  { path: '/products', component: ProductListPage, meta: { requiresAuth: true } },
  { path: '/templates', component: TemplateListPage, meta: { requiresAuth: true } },
  { path: '/templates/new', component: TemplateEditorPage, meta: { requiresAuth: true } },
  { path: '/templates/:id', component: TemplateEditorPage, meta: { requiresAuth: true } },
  { path: '/bulk-jobs/:id', component: BulkJobProgressPage, meta: { requiresAuth: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  try { await auth.init(); } catch { /* env missing, safe to ignore */ }
  if (to.meta.requiresAuth && !auth.isAuthed) return '/login';
});

export default router;
