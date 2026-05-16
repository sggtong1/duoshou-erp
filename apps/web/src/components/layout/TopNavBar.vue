<template>
  <div class="top-nav">
    <div class="brand" @click="router.push('/')">
      <span class="brand-icon">舵</span>
    </div>

    <nav class="main-menu" @mouseleave="active = null">
      <button
        v-for="root in MENU_TREE"
        :key="root.key"
        class="main-item"
        :class="{ active: activeRootKey === root.key, hovered: active === root.key }"
        @mouseenter="active = root.key"
        @click="onRootClick(root)"
      >
        {{ root.label }}
      </button>

      <div v-if="hoveredRoot" class="dropdown" @mouseenter="active = hoveredRoot.key">
        <div
          v-for="g in hoveredRoot.groups"
          :key="g.key"
          class="dd-group"
        >
          <div class="dd-group-title">
            <span class="dd-dot"></span>
            <span>{{ g.label }}</span>
          </div>
          <div class="dd-group-items">
            <a
              v-for="c in g.children"
              :key="c.key"
              class="dd-item"
              :class="{ current: route.path === c.path }"
              @click="onLeafClick(c)"
            >
              {{ c.label }}
              <n-tag v-if="c.badge" :type="c.badge === 'NEW' ? 'success' : 'warning'" size="tiny" round style="margin-left:6px">{{ c.badge }}</n-tag>
            </a>
          </div>
        </div>
      </div>
    </nav>

    <div class="right">
      <div class="tenant">
        <n-icon size="14"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 1 7l11 5 9-4.09V15h2V7L12 2z"/></svg></n-icon>
        <span>多平台</span>
        <span class="caret">▾</span>
      </div>
      <button class="ai-pill">AI</button>
      <button class="icon-btn" title="搜索">🔍</button>
      <button class="icon-btn" title="下载">⤓</button>
      <button class="icon-btn" title="通知">🔔</button>
      <button class="icon-btn" title="收藏">★</button>
      <button class="icon-btn" title="帮助">?</button>
      <UserMenu />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NIcon, NTag } from 'naive-ui';
import { MENU_TREE, type MenuRoot, type MenuLeaf, findRootByPath } from '@/router/menu-config';
import UserMenu from './UserMenu.vue';

const route = useRoute();
const router = useRouter();

const active = ref<string | null>(null);
const hoveredRoot = computed<MenuRoot | null>(() => {
  if (!active.value) return null;
  return MENU_TREE.find((r) => r.key === active.value) ?? null;
});

const activeRootKey = computed(() => findRootByPath(route.path)?.key ?? null);

function onRootClick(root: MenuRoot) {
  active.value = root.key;
  const first = root.groups[0]?.children[0];
  if (first) {
    router.push(first.path);
    active.value = null;
  }
}
function onLeafClick(c: MenuLeaf) {
  router.push(c.path);
  active.value = null;
}
</script>

<style scoped>
.top-nav {
  height: 48px;
  background: linear-gradient(180deg, #1f2740 0%, #232c47 100%);
  display: flex;
  align-items: stretch;
  color: #d8def0;
  position: relative;
  z-index: 99;
}
.brand {
  width: 56px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}
.brand-icon {
  width: 28px; height: 28px; border-radius: 6px;
  background: #f0b429; color: #1f2740;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px;
}
.main-menu {
  display: flex;
  align-items: stretch;
  position: relative;
}
.main-item {
  background: none;
  border: 0;
  color: #d8def0;
  padding: 0 16px;
  cursor: pointer;
  font-size: 14px;
  position: relative;
  line-height: 48px;
}
.main-item:hover, .main-item.hovered { color: #fff; background: rgba(255,255,255,0.06); }
.main-item.active { color: #fff; }
.main-item.active::after {
  content: '';
  position: absolute;
  left: 16px; right: 16px; bottom: 0;
  height: 2px;
  background: #f0b429;
}

.dropdown {
  position: absolute;
  left: 0;
  top: 48px;
  background: #2a3252;
  color: #e3e7f3;
  padding: 14px 18px;
  min-width: 600px;
  max-width: 1100px;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.25);
}
.dd-group {
  display: grid;
  grid-template-columns: 130px 1fr;
  align-items: start;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(255,255,255,0.08);
}
.dd-group:last-child { border-bottom: 0; }
.dd-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #e9c46a;
  font-size: 13px;
  font-weight: 500;
}
.dd-dot {
  display: inline-block;
  width: 14px; height: 14px;
  border: 1.5px solid #e9c46a;
  border-radius: 3px;
}
.dd-group-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 22px;
}
.dd-item {
  color: #d8def0;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  padding: 4px 0;
  display: inline-flex;
  align-items: center;
}
.dd-item:hover, .dd-item.current { color: #f0b429; }

.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
}
.tenant {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 4px 10px;
  font-size: 12px;
  margin-right: 6px;
  cursor: pointer;
}
.tenant .caret { color: #aab1c8; }
.ai-pill {
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff; font-weight: 600;
  border: 0; border-radius: 12px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}
.icon-btn {
  background: none;
  border: 0;
  color: #c9d0e7;
  width: 28px; height: 28px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.icon-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
</style>
