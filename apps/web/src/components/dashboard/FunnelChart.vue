<template>
  <n-card title="订单转化漏斗" :bordered="false" style="height: 320px;">
    <div class="placeholder-block">
      <n-icon :size="42" :depth="4" style="margin-bottom: 12px;">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 4 L20 4 L14 12 L14 20 L10 20 L10 12 Z" />
        </svg>
      </n-icon>
      <div class="placeholder-title">曝光 → 点击 → 下单 → 支付</div>
      <div class="placeholder-desc">v1.2 接入订单 API + v1.3 广告 API 后,此处将显示全链路转化率</div>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NIcon } from 'naive-ui';
</script>

<style scoped>
.placeholder-block {
  height: 240px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #bbb; text-align: center;
}
.placeholder-title { font-size: 14px; margin-bottom: 6px; }
.placeholder-desc { font-size: 12px; max-width: 260px; line-height: 1.5; }
</style>
