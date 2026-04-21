<template>
  <n-card size="small" :bordered="true">
    <div class="kpi-label">{{ label }}</div>
    <div class="kpi-value" :class="{ alert: isAlert }">
      {{ formattedValue }}
    </div>
    <div v-if="unit" class="kpi-unit">{{ unit }}</div>
  </n-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { NCard } from 'naive-ui';

const props = defineProps<{
  label: string;
  value: number | null | undefined;
  unit?: string;
  alertThreshold?: number;
}>();

const formattedValue = computed(() =>
  props.value == null ? '—' : new Intl.NumberFormat().format(props.value),
);
const isAlert = computed(() =>
  props.alertThreshold != null && (props.value ?? 0) >= props.alertThreshold,
);
</script>

<style scoped>
.kpi-label { color: #888; font-size: 12px; margin-bottom: 4px; }
.kpi-value { font-size: 24px; font-weight: 600; color: #18a058; line-height: 1.2; }
.kpi-value.alert { color: #d03050; }
.kpi-unit { color: #888; font-size: 12px; margin-top: 2px; }
</style>
