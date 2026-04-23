<template>
  <n-tooltip v-if="disabled && reason" placement="top">
    <template #trigger>
      <span class="chip" :class="{ disabled, active }" @click="onClick">
        <slot />
      </span>
    </template>
    {{ reason }}
  </n-tooltip>
  <span v-else class="chip" :class="{ disabled, active }" @click="onClick">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { NTooltip } from 'naive-ui';

const props = defineProps<{
  active?: boolean;
  disabled?: boolean;
  reason?: string;
}>();
const emit = defineEmits<{ click: [] }>();

function onClick() {
  if (!props.disabled) emit('click');
}
</script>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1;
  background: #f4f4f5;
  color: #555;
  cursor: pointer;
  margin-right: 6px;
  user-select: none;
  transition: background 0.15s;
}
.chip:hover:not(.disabled) { background: #e8f4ff; }
.chip.active { background: #2080f0; color: #fff; }
.chip.disabled { color: #aaa; cursor: not-allowed; background: #f0f0f0; }
</style>
