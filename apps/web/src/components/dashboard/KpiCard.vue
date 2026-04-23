<template>
  <n-tooltip v-if="placeholder && placeholderReason" placement="top">
    <template #trigger>
      <n-card size="small" :bordered="true" :class="{ 'kpi-card': true, placeholder }">
        <div class="kpi-label">{{ label }}</div>
        <div class="kpi-value" :class="{ placeholder }">
          {{ displayValue }}
        </div>
        <div class="kpi-sub">
          <span v-if="unit && !placeholder" class="kpi-unit">{{ unit }}</span>
          <span v-else-if="placeholder" class="kpi-unit placeholder-label">待接入</span>
          <svg class="sparkline" :class="{ placeholder }" width="64" height="18" viewBox="0 0 64 18">
            <polyline :points="sparkPoints" fill="none" :stroke="sparkColor" stroke-width="1.5" />
          </svg>
        </div>
      </n-card>
    </template>
    {{ placeholderReason }}
  </n-tooltip>
  <n-card v-else size="small" :bordered="true" class="kpi-card">
    <div class="kpi-label">{{ label }}</div>
    <div class="kpi-value">{{ displayValue }}</div>
    <div class="kpi-sub">
      <span v-if="unit" class="kpi-unit">{{ unit }}</span>
      <svg class="sparkline" width="64" height="18" viewBox="0 0 64 18">
        <polyline :points="sparkPoints" fill="none" :stroke="sparkColor" stroke-width="1.5" />
      </svg>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NTooltip } from 'naive-ui';

const props = defineProps<{
  label: string;
  value: number | null | undefined;
  unit?: string;
  placeholder?: boolean;
  placeholderReason?: string;
  sparkShape?: 0 | 1 | 2;
}>();

const displayValue = computed(() => {
  if (props.placeholder || props.value == null) return '—';
  return new Intl.NumberFormat().format(props.value);
});

const SHAPES: Record<number, string> = {
  0: '0,14 8,10 16,12 24,6 32,8 40,4 48,6 56,2 64,4',
  1: '0,10 10,12 20,8 30,10 40,6 50,8 60,4 64,4',
  2: '0,8 8,12 16,6 24,10 32,4 40,8 48,2 56,6 64,4',
};

const sparkPoints = computed(() => SHAPES[props.sparkShape ?? 0]);
const sparkColor = computed(() => (props.placeholder ? '#ddd' : '#18a058'));
</script>

<style scoped>
.kpi-card { background: #fff; min-height: 104px; }
.kpi-card.placeholder { background: #fafafa; }
.kpi-label { color: #888; font-size: 12px; margin-bottom: 6px; }
.kpi-value { font-size: 26px; font-weight: 600; color: #18a058; line-height: 1.2; }
.kpi-value.placeholder { color: #ccc; }
.kpi-sub { margin-top: 6px; display: flex; justify-content: space-between; align-items: center; }
.kpi-unit { color: #888; font-size: 12px; }
.kpi-unit.placeholder-label { color: #bbb; font-style: italic; }
.sparkline { opacity: 1; }
.sparkline.placeholder { opacity: 0.3; }
</style>
