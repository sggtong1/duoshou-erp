<template>
  <n-card title="实时动态" :bordered="false">
    <div class="placeholder-block">
      <n-icon :size="36" :depth="4" style="margin-bottom: 10px;">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24" stroke-width="2" fill="none" stroke="currentColor"/>
        </svg>
      </n-icon>
      <div class="placeholder-title">实时订单流</div>
      <div class="placeholder-desc">v1.2 接入订单 webhook 后,此处将推送下单/发货/签收事件</div>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NIcon } from 'naive-ui';
</script>

<style scoped>
.placeholder-block {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 24px 0; color: #bbb; text-align: center;
}
.placeholder-title { font-size: 13px; margin-bottom: 4px; }
.placeholder-desc { font-size: 12px; max-width: 220px; line-height: 1.5; }
</style>
