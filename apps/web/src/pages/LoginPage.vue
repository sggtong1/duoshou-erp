<template>
  <div class="login-page">
    <section class="login-hero">
      <div class="brand-row">
        <div class="brand-mark">DS</div>
        <div>
          <strong>舵手 ERP</strong>
          <span>多平台电商运营中枢</span>
        </div>
      </div>

      <div class="hero-copy">
        <p class="page-eyebrow">CROSS-BORDER OPERATIONS</p>
        <h1>跨平台 BI 看板与运营操作，一套系统协同推进。</h1>
        <p>
          聚合 Temu、TikTok、Walmart 等平台数据，围绕销售分析、价格任务、库存预警和利润核算构建统一工作台。
        </p>
      </div>

      <div class="hero-modules">
        <div v-for="item in modules" :key="item.title" class="module-card">
          <span>{{ item.code }}</span>
          <strong>{{ item.title }}</strong>
          <small>{{ item.desc }}</small>
        </div>
      </div>
    </section>

    <section class="login-panel">
      <n-card title="登录工作台" :bordered="false" class="login-card">
        <p class="login-intro">使用账号进入你的多平台经营空间。</p>
        <n-form label-placement="top" @submit.prevent="onLogin">
          <n-form-item label="邮箱">
            <n-input v-model:value="email" type="text" placeholder="your@email.com" />
          </n-form-item>
          <n-form-item label="密码">
            <n-input v-model:value="password" type="password" placeholder="至少 6 字符" @keyup.enter="onLogin" />
          </n-form-item>
          <n-button type="primary" block size="large" :loading="busy" @click="onLogin">登录</n-button>
          <n-button block size="large" quaternary :loading="busy" @click="onSignup">创建账号</n-button>
        </n-form>
      </n-card>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMessage, NCard, NForm, NFormItem, NInput, NButton } from 'naive-ui';
import { useAuthStore } from '@/stores/auth';

const modules = [
  { code: 'BI', title: '数据分析', desc: '销售、库存、利润一屏洞察' },
  { code: 'PX', title: '运营工具', desc: '核价、调价、任务统一处理' },
  { code: 'MP', title: '多平台管理', desc: '店铺、商品、SKU 聚合管理' },
  { code: 'FC', title: '财务核算', desc: '费用、利润、回款持续跟踪' },
];

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

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(420px, 0.85fr);
  background: #f5f8fc;
}
.login-hero {
  position: relative;
  padding: 48px 64px;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(31, 111, 255, 0.08) 0 1px, transparent 1px 100%),
    linear-gradient(180deg, rgba(31, 111, 255, 0.06) 0 1px, transparent 1px 100%),
    linear-gradient(180deg, #ffffff 0%, #eef5ff 100%);
  background-size: 28px 28px, 28px 28px, auto;
}
.login-hero::after {
  content: "";
  position: absolute;
  right: 48px;
  bottom: 48px;
  width: 420px;
  height: 260px;
  border: 1px solid #cfe0fb;
  border-radius: 18px;
  background:
    linear-gradient(#fff, #fff) padding-box,
    linear-gradient(135deg, rgba(31,111,255,.35), rgba(22,163,106,.18)) border-box;
  box-shadow: var(--ds-shadow);
  opacity: 0.7;
}
.brand-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-row .brand-mark {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: #fff;
  font-weight: 800;
  background: linear-gradient(135deg, var(--ds-primary), var(--ds-info));
}
.brand-row strong,
.brand-row span {
  display: block;
}
.brand-row strong {
  color: var(--ds-ink);
  font-size: 17px;
}
.brand-row span {
  margin-top: 3px;
  color: var(--ds-muted);
  font-size: 12px;
}
.hero-copy {
  position: relative;
  z-index: 1;
  max-width: 680px;
  margin-top: 110px;
}
.hero-copy h1 {
  margin: 0;
  color: var(--ds-ink);
  font-size: 44px;
  line-height: 1.18;
  font-weight: 900;
}
.hero-copy p:last-child {
  max-width: 620px;
  margin: 18px 0 0;
  color: var(--ds-muted);
  font-size: 16px;
  line-height: 1.9;
}
.hero-modules {
  position: relative;
  z-index: 1;
  max-width: 760px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 56px;
}
.module-card {
  min-height: 126px;
  padding: 16px;
  border: 1px solid var(--ds-line);
  border-radius: 8px;
  background: rgba(255,255,255,.82);
  backdrop-filter: blur(6px);
}
.module-card span {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--ds-primary-strong);
  background: var(--ds-primary-soft);
  font-size: 12px;
  font-weight: 800;
}
.module-card strong {
  display: block;
  margin-top: 12px;
  color: var(--ds-ink);
}
.module-card small {
  display: block;
  margin-top: 6px;
  color: var(--ds-muted);
  line-height: 1.5;
}
.login-panel {
  display: grid;
  place-items: center;
  padding: 40px;
  background: #fff;
}
.login-card {
  width: 100%;
  max-width: 420px;
  border: 1px solid var(--ds-line);
  box-shadow: 0 18px 42px rgba(15, 44, 89, 0.08);
}
.login-intro {
  margin: -4px 0 18px;
  color: var(--ds-muted);
}
@media (max-width: 980px) {
  .login-page {
    grid-template-columns: 1fr;
  }
  .login-hero {
    padding: 36px 24px;
  }
  .hero-copy {
    margin-top: 64px;
  }
  .hero-copy h1 {
    font-size: 32px;
  }
  .hero-modules {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .login-panel {
    padding: 24px;
  }
}
</style>
