import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface TabItem {
  path: string;
  title: string;
  icon?: string;
  closable: boolean;
}

const HOME_TAB: TabItem = { path: '/', title: '总览', icon: 'home', closable: false };

export const usePageTabsStore = defineStore('page-tabs', () => {
  const tabs = ref<TabItem[]>([HOME_TAB]);
  const activePath = ref<string>('/');

  function open(path: string, title: string) {
    if (!tabs.value.some((t) => t.path === path)) {
      tabs.value.push({ path, title, closable: true });
    }
    activePath.value = path;
  }

  function close(path: string) {
    const idx = tabs.value.findIndex((t) => t.path === path);
    if (idx < 0) return null;
    if (!tabs.value[idx].closable) return null;
    tabs.value.splice(idx, 1);
    if (activePath.value === path) {
      const next = tabs.value[idx] ?? tabs.value[idx - 1] ?? HOME_TAB;
      activePath.value = next.path;
      return next.path;
    }
    return null;
  }

  function closeOthers(path: string) {
    tabs.value = tabs.value.filter((t) => !t.closable || t.path === path);
    activePath.value = path;
  }

  function closeAll() {
    tabs.value = [HOME_TAB];
    activePath.value = '/';
  }

  function setActive(path: string) { activePath.value = path; }

  return { tabs, activePath, open, close, closeOthers, closeAll, setActive };
});
