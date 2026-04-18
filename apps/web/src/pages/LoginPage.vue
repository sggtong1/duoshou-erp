<template>
  <n-card title="舵手 ERP 登录" style="max-width: 360px; margin: 80px auto;">
    <n-form @submit.prevent="onLogin">
      <n-form-item label="邮箱">
        <n-input v-model:value="email" type="text" placeholder="your@email.com" />
      </n-form-item>
      <n-form-item label="密码">
        <n-input v-model:value="password" type="password" placeholder="至少 6 字符" @keyup.enter="onLogin" />
      </n-form-item>
      <n-space>
        <n-button type="primary" @click="onLogin" :loading="busy">登录</n-button>
        <n-button @click="onSignup" :loading="busy">注册</n-button>
      </n-space>
    </n-form>
  </n-card>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage, NCard, NForm, NFormItem, NInput, NButton, NSpace } from 'naive-ui';
import { useAuthStore } from '@/stores/auth';

const email = ref('');
const password = ref('');
const busy = ref(false);
const msg = useMessage();
const router = useRouter();
const auth = useAuthStore();

async function onLogin() {
  busy.value = true;
  try {
    await auth.loginWithEmail(email.value, password.value);
    msg.success('登录成功');
    router.push('/');
  } catch (e: any) {
    msg.error(e.message ?? String(e));
  } finally {
    busy.value = false;
  }
}

async function onSignup() {
  busy.value = true;
  try {
    await auth.signUp(email.value, password.value);
    msg.success('注册邮件已发送，请查收后再登录');
  } catch (e: any) {
    msg.error(e.message ?? String(e));
  } finally {
    busy.value = false;
  }
}
</script>
