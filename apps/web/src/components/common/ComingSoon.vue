<template>
  <div class="coming-soon page-shell">
    <div class="page-hero">
      <div>
        <p class="page-eyebrow">COMING NEXT</p>
        <h1 class="page-title-main">{{ title }}</h1>
        <p class="page-subtitle">{{ description }}</p>
      </div>
      <n-button type="primary" @click="$router.push('/')">返回总览</n-button>
    </div>

    <div class="module-preview">
      <div class="preview-copy">
        <span>模块规划</span>
        <strong>数据洞察会继续向运营动作闭环延伸。</strong>
      </div>
      <div class="preview-grid">
        <div>趋势分析</div>
        <div>维度钻取</div>
        <div>导出复盘</div>
        <div>任务联动</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui';

defineProps<{
  title: string;
  description: string;
}>();
</script>

<style scoped>
.module-preview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
  gap: 20px;
  padding: 22px;
  border: 1px solid var(--ds-line);
  border-radius: var(--ds-radius);
  background:
    linear-gradient(90deg, rgba(31, 111, 255, 0.06) 0 1px, transparent 1px 72px),
    linear-gradient(180deg, rgba(31, 111, 255, 0.06) 0 1px, transparent 1px 72px),
    #fff;
}
.preview-copy span {
  color: var(--ds-primary);
  font-size: 12px;
  font-weight: 800;
}
.preview-copy strong {
  display: block;
  max-width: 520px;
  margin-top: 12px;
  color: var(--ds-ink);
  font-size: 22px;
  line-height: 1.4;
}
.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.preview-grid div {
  min-height: 86px;
  display: grid;
  place-items: center;
  border: 1px solid var(--ds-line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--ds-ink);
  font-weight: 700;
}
@media (max-width: 900px) {
  .module-preview {
    grid-template-columns: 1fr;
  }
}
</style>
