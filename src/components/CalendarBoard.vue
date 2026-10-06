<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  WEEKDAY_LABELS,
  addDays,
  dayNumber,
  longDateLabel,
  monthCells,
  monthTitle,
  weekDates,
} from '@/utils/dates';

const props = defineProps<{
  selected: string;
  today: string;
  marked: readonly string[];
}>();

const emit = defineEmits<{ select: [date: string] }>();

const open = ref(false);
const markedSet = computed(() => new Set(props.marked));
const week = computed(() => weekDates(props.selected));
const cells = computed(() => monthCells(props.selected));
const title = computed(() => monthTitle(props.selected));

let originX = 0;
let originY = 0;
let tracking = false;
let handleY = 0;
let dragged = false;

function select(date: string): void {
  emit('select', date);
}

function shift(delta: number): void {
  emit('select', addDays(props.selected, delta * 7));
}

function onWeekDown(event: PointerEvent): void {
  tracking = true;
  originX = event.clientX;
  originY = event.clientY;
}

function onWeekUp(event: PointerEvent): void {
  if (!tracking) return;
  tracking = false;
  const dx = event.clientX - originX;
  const dy = event.clientY - originY;
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) shift(dx < 0 ? 1 : -1);
}

function onHandleDown(event: PointerEvent): void {
  handleY = event.clientY;
  dragged = false;
  const target = event.currentTarget;
  if (target instanceof HTMLElement) target.setPointerCapture(event.pointerId);
}

function onHandleUp(event: PointerEvent): void {
  const dy = event.clientY - handleY;
  if (dy > 28) {
    open.value = true;
    dragged = true;
  } else if (dy < -28) {
    open.value = false;
    dragged = true;
  }
}

function onHandleClick(): void {
  if (dragged) {
    dragged = false;
    return;
  }
  open.value = !open.value;
}
</script>

<template>
  <section class="fn-cal" aria-label="Calendário">
    <div class="fn-cal-head">
      <button type="button" class="fn-icon-btn" aria-label="Semana anterior" @click="shift(-1)">‹</button>
      <h2>{{ title }}</h2>
      <button type="button" class="fn-icon-btn" aria-label="Próxima semana" @click="shift(1)">›</button>
      <button v-if="selected !== today" type="button" class="fn-text-btn" @click="select(today)">Hoje</button>
    </div>
    <div class="fn-week" @pointerdown="onWeekDown" @pointerup="onWeekUp" @pointercancel="onWeekUp">
      <button
        v-for="(date, index) in week"
        :key="date"
        type="button"
        class="fn-day"
        :aria-pressed="date === selected"
        :aria-label="longDateLabel(date)"
        @click="select(date)"
      >
        <span class="wd">{{ WEEKDAY_LABELS[index] }}</span>
        <span class="dn" :class="{ on: date === selected, today: date === today && date !== selected }">{{ dayNumber(date) }}</span>
        <span class="fn-dot" :class="{ show: markedSet.has(date) }" />
      </button>
    </div>
    <button
      type="button"
      class="fn-handle"
      :aria-expanded="open"
      aria-controls="fn-month"
      @pointerdown="onHandleDown"
      @pointerup="onHandleUp"
      @pointercancel="onHandleUp"
      @click="onHandleClick"
    >
      <span class="fn-grab" aria-hidden="true" />
      <span>{{ open ? 'Recolher mês' : 'Mês' }}</span>
    </button>
    <div id="fn-month" class="fn-month" :class="{ open }">
      <div class="fn-month-inner">
        <div class="fn-month-grid">
          <span v-for="label in WEEKDAY_LABELS" :key="label" class="fn-month-label">{{ label }}</span>
          <button
            v-for="cell in cells"
            :key="cell.date"
            type="button"
            class="fn-month-day"
            :class="{ on: cell.date === selected, today: cell.date === today && cell.date !== selected, out: !cell.inMonth }"
            :aria-pressed="cell.date === selected"
            :aria-label="longDateLabel(cell.date)"
            @click="select(cell.date)"
          >
            {{ dayNumber(cell.date) }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
