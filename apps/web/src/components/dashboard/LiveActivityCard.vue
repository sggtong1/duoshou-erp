<template>
  <n-card :bordered="false">
    <template #header>
      <div class="header">
        实时动态
        <span class="demo-tag">演示数据</span>
      </div>
    </template>
    <template #header-extra>
      <n-button text size="small" style="color: #2080f0;">查看全部</n-button>
    </template>
    <div v-for="(a, i) in items" :key="i" class="activity-row">
      <div class="icon-cell" :style="{ backgroundColor: platformColor(a.platform) }">
        {{ a.platform.charAt(0) }}
      </div>
      <div class="body">
        <div class="title">{{ a.platform }} {{ a.event }}</div>
        <div class="sub">{{ a.shopName }} · {{ a.skuTitle }}</div>
        <div class="time">{{ a.minutesAgo }}分钟前</div>
      </div>
      <div class="amount">{{ a.amount }}</div>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NButton } from 'naive-ui';
import { DEMO_LIVE_ACTIVITY } from '@/lib/demo-data';

const items = DEMO_LIVE_ACTIVITY;

function platformColor(p: string): string {
  if (p.includes('TikTok')) return '#000';
  if (p.includes('Amazon')) return '#ff9900';
  if (p.includes('Shopee')) return '#ee4d2d';
  if (p.includes('MercadoLibre')) return '#ffe600';
  if (p.includes('Temu')) return '#f97316';
  return '#666';
}
</script>

<style scoped>
.header { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.demo-tag {
  padding: 1px 6px;
  font-size: 10px;
  border-radius: 3px;
  background: #e8f0ff;
  color: #6686bf;
  font-weight: normal;
}
.activity-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}
.activity-row:last-child { border-bottom: none; }
.icon-cell {
  flex-shrink: 0;
  width: 28px; height: 28px;
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 12px; font-weight: 600;
}
.body { flex: 1; min-width: 0; }
.title { font-size: 12px; color: #333; font-weight: 500; }
.sub { font-size: 11px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.time { font-size: 10px; color: #bbb; margin-top: 2px; }
.amount { font-size: 13px; color: #2c3e50; font-weight: 600; }
</style>
