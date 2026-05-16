<template>
  <n-tooltip v-if="placeholder && placeholderReason" placement="top">
    <template #trigger>
      <n-card size="small" :bordered="true" :class="{ 'kpi-card': true, placeholder }">
        <div class="kpi-head">
          <div class="kpi-label">{{ label }}</div>
          <span v-if="placeholder" class="demo-tag">演示</span>
        </div>
        <div class="kpi-value" :class="{ placeholder }">
          {{ displayValue }}
        </div>
        <div class="kpi-sub">
          <span v-if="changePct != null" class="change" :class="{ up: changePct >= 0, down: changePct < 0 }">
            {{ changePct >= 0 ? '▲' : '▼' }} {{ Math.abs(changePct).toFixed(2) }}{{ unit === '%' ? 'pp' : '%' }}
          </span>
          <span v-else-if="unit && !placeholder" class="kpi-unit">{{ unit }}</span>
          <svg class="sparkline" :class="{ placeholder }" width="72" height="20" viewBox="0 0 72 20">
            <polyline :points="sparkPoints" fill="none" :stroke="sparkColor" stroke-width="1.5" />
          </svg>
        </div>
      </n-card>
    </template>
    {{ placeholderReason }}
  </n-tooltip>
  <n-card v-else size="small" :bordered="true" class="kpi-card">
    <div class="kpi-head">
      <div class="kpi-label">{{ label }}</div>
    </div>
    <div class="kpi-value">{{ displayValue }}</div>
    <div class="kpi-sub">
      <span v-if="changePct != null" class="change" :class="{ up: changePct >= 0, down: changePct < 0 }">
        {{ changePct >= 0 ? '▲' : '▼' }} {{ Math.abs(changePct).toFixed(2) }}{{ unit === '%' ? 'pp' : '%' }}
      </span>
      <span v-else-if="unit" class="kpi-unit">{{ unit }}</span>
      <svg class="sparkline" width="72" height="20" viewBox="0 0 72 20">
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
  unit?: string;                 // '件' | '¥' | '$' | '%' — acts as prefix for ¥/$, suffix for 件/%
  placeholder?: boolean;
  placeholderReason?: string;
  sparkShape?: 0 | 1 | 2;
  changePct?: number | null;
}>();

function formatNumber(v: number): string {
  if (Math.abs(v) >= 1000) return new Intl.NumberFormat('en-US').format(Math.round(v));
  return v.toFixed(2);
}

const displayValue = computed(() => {
  if (props.value == null) return '—';
  const u = props.unit;
  const n = formatNumber(props.value);
  if (u === '$' || u === '¥') return `${u}${n}`;
  if (u === '%') return `${props.value.toFixed(2)}%`;
  if (u === '件' || u === '单') return `${n}`;
  return n;
});

const SHAPES: Record<number, string> = {
  0: '0,14 8,10 16,12 24,6 32,8 40,4 48,6 56,2 64,4 72,6',
  1: '0,10 10,12 20,8 30,10 40,6 50,8 60,4 66,4 72,3',
  2: '0,8 8,12 16,6 24,10 32,4 40,8 48,2 56,6 64,4 72,5',
};

const sparkPoints = computed(() => SHAPES[props.sparkShape ?? 0]);
const sparkColor = computed(() => (props.placeholder ? '#a0b5e0' : '#18a058'));
</script>

<style scoped>
.kpi-card {
  background: #fff;
  min-height: 110px;
  border-color: var(--ds-line);
}
.kpi-card.placeholder {
  background: #f8fbff;
  border-style: dashed;
  border-color: #cfe0fb;
}
.kpi-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.kpi-label { color: var(--ds-muted); font-size: 12px; font-weight: 700; }
.demo-tag {
  display: inline-block;
  padding: 1px 6px;
  font-size: 10px;
  border-radius: 999px;
  background: var(--ds-primary-soft);
  color: var(--ds-primary-strong);
  line-height: 1.4;
}
.kpi-value { font-size: 26px; font-weight: 800; color: var(--ds-ink); line-height: 1.2; }
.kpi-value.placeholder { color: #6c7a93; }
.kpi-sub { margin-top: 8px; display: flex; justify-content: space-between; align-items: center; }
.kpi-unit { color: var(--ds-muted); font-size: 12px; }
.change { font-size: 12px; font-weight: 500; }
.change.up { color: var(--ds-success); }
.change.down { color: var(--ds-danger); }
.sparkline { opacity: 1; }
.sparkline.placeholder { opacity: 0.5; }
</style>
