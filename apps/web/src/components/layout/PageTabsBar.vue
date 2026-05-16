<template>
  <div class="page-tabs">
    <button class="home-btn" :class="{ active: store.activePath === '/' }" @click="goHome">
      <span class="house">⌂</span>
    </button>
    <div class="tabs-scroll">
      <div
        v-for="t in nonHomeTabs"
        :key="t.path"
        class="tab"
        :class="{ active: store.activePath === t.path }"
        @click="onClick(t.path)"
      >
        <span class="dot"></span>
        <span class="tab-title" :title="t.title">{{ t.title }}</span>
        <span v-if="t.closable" class="tab-close" @click.stop="onClose(t.path)">×</span>
      </div>
    </div>
    <button class="add-btn" title="新建标签">+</button>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePageTabsStore } from '@/stores/page-tabs';
import { findLeafByPath } from '@/router/menu-config';

const route = useRoute();
const router = useRouter();
const store = usePageTabsStore();

const nonHomeTabs = computed(() => store.tabs.filter((t) => t.path !== '/'));

watch(
  () => route.path,
  (p) => {
    if (p === '/login') return;
    const leaf = findLeafByPath(p);
    const title = (route.meta?.title as string) || leaf?.label || '页面';
    store.open(p, title);
  },
  { immediate: true },
);

function goHome() {
  router.push('/');
}
function onClick(p: string) {
  router.push(p);
}
function onClose(p: string) {
  const next = store.close(p);
  if (next) router.push(next);
}
</script>

<style scoped>
.page-tabs {
  display: flex;
  align-items: stretch;
  background: #1a2238;
  padding: 0 4px;
  height: 36px;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.home-btn {
  width: 44px;
  border: 0;
  background: transparent;
  color: #c9d0e7;
  cursor: pointer;
  font-size: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.home-btn.active, .home-btn:hover {
  background: #fff;
  color: #4f64f6;
  border-radius: 6px 6px 0 0;
  margin-top: 4px;
  height: 32px;
  align-self: flex-end;
}
.home-btn .house { display: inline-block; transform: translateY(-1px); }

.tabs-scroll {
  display: flex;
  align-items: stretch;
  flex: 1 1 auto;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs-scroll::-webkit-scrollbar { display: none; }

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  margin: 4px 2px 0;
  height: 32px;
  border-radius: 6px 6px 0 0;
  background: rgba(255,255,255,0.05);
  color: #c9d0e7;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  max-width: 220px;
}
.tab .dot {
  width: 6px; height: 6px; border-radius: 50%; background: #9ca3af;
}
.tab:hover { background: rgba(255,255,255,0.1); }
.tab.active { background: #fff; color: #1f2740; }
.tab.active .dot { background: #4f64f6; }
.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
.tab-close {
  color: #9ca3af;
  cursor: pointer;
  font-size: 14px;
  width: 16px;
  text-align: center;
  border-radius: 4px;
}
.tab.active .tab-close { color: #6b7280; }
.tab-close:hover { background: #e5e7eb; color: #111827; }

.add-btn {
  width: 32px;
  border: 0;
  background: transparent;
  color: #c9d0e7;
  cursor: pointer;
  font-size: 18px;
  border-radius: 4px;
}
.add-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
</style>
