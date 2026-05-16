<template>
  <n-dropdown :options="options" trigger="click" @select="onSelect">
    <n-avatar round size="small" :style="{ backgroundColor: '#1f6fff', cursor: 'pointer', fontWeight: '700' }">
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
  { label: '店铺连接', key: '/shops' },
  { label: '价格操作台', key: '/pricing-ops' },
  { label: '系统设置', key: '/settings' },
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
