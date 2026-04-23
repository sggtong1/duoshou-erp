<template>
  <n-dropdown :options="options" trigger="click" @select="onSelect">
    <n-avatar round size="small" :style="{ backgroundColor: '#2080f0', cursor: 'pointer' }">
      {{ initial }}
    </n-avatar>
  </n-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { NAvatar, NDropdown } from 'naive-ui';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

const initial = computed(() => (auth.userEmail?.[0] ?? 'U').toUpperCase());

const options = [
  { label: '🏪 我的店铺', key: '/shops' },
  { label: '🔔 核价提醒', key: '/price-reviews' },
  { label: '⚙️ 设置', key: '/settings' },
  { type: 'divider', key: '__divider__' },
  { label: '退出登录', key: '__logout__' },
];

async function onSelect(key: string) {
  if (key === '__logout__') {
    await auth.logout();
    router.push('/login');
    return;
  }
  router.push(key);
}
</script>
