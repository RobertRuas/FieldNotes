<script setup lang="ts" generic="T extends { key: string; height: number }">
import { computed } from 'vue';

const props = defineProps<{
  rows: readonly T[];
  scrollTop: number;
  viewport: number;
}>();

const overscan = 5;

const placed = computed(() => {
  let top = 0;
  return props.rows.map((row) => {
    const item = { row, top };
    top += row.height;
    return item;
  });
});

const total = computed(() => {
  const items = placed.value;
  const last = items[items.length - 1];
  return last ? last.top + last.row.height : 0;
});

const windowed = computed(() => {
  const items = placed.value;
  const height = props.viewport > 0 ? props.viewport : 720;
  const top = Math.max(0, props.scrollTop);
  const bottom = top + height;
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    const item = items[mid];
    if (!item || item.top + item.row.height < top) low = mid + 1;
    else high = mid;
  }
  const start = Math.max(0, low - overscan);
  low = start;
  high = items.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    const item = items[mid];
    if (!item || item.top <= bottom) low = mid + 1;
    else high = mid;
  }
  const end = Math.min(items.length, low + overscan);
  const first = items[start];
  return {
    offset: first ? first.top : 0,
    rows: items.slice(start, end).map((item) => item.row),
  };
});
</script>

<template>
  <div class="fn-virtual" :style="{ height: `${total}px` }">
    <div class="fn-virtual-window" :style="{ transform: `translateY(${windowed.offset}px)` }">
      <template v-for="row in windowed.rows" :key="row.key">
        <slot name="row" :row="row" />
      </template>
    </div>
  </div>
</template>
