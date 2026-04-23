<template>
  <n-card title="广告表现" :bordered="false" style="height: 320px;">
    <div class="placeholder-block">
      <n-icon :size="42" :depth="4" style="margin-bottom: 12px;">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 12 L9 6 L12 10 L15 7 L21 13 L21 21 L3 21 Z" />
        </svg>
      </n-icon>
      <div class="placeholder-title">广告花费 · ROAS · CTR</div>
      <div class="placeholder-desc">v1.3 接入 Temu 广告 API 后,此处将显示广告效果趋势与对比</div>
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
