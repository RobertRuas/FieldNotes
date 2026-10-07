<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { TemplateVariable } from '@/templates/types';
import { formatDateAnswer } from '@/templates/utils/engine';
import { isTextualType } from '@/templates/utils/labels';
import { questionFor, NO, YES } from '@/templates/utils/variables';
import { todayKey } from '@/utils/dates';

const props = defineProps<{
  variable: TemplateVariable;
  modelValue: string;
  error: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  advance: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const areaRef = ref<HTMLTextAreaElement | null>(null);
const dateLabel = computed(() => formatDateAnswer(props.modelValue || todayKey()));
const question = computed(() => questionFor(props.variable));
const textual = computed(() => isTextualType(props.variable.type));

const inputMode = computed(() => {
  if (props.variable.type === 'number') return 'decimal';
  if (props.variable.type === 'email') return 'email';
  if (props.variable.type === 'url') return 'url';
  return 'text';
});

function emitText(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  emit('update:modelValue', target.value);
}

function choose(value: string): void {
  emit('update:modelValue', value);
}

watch(
  () => props.variable.key,
  () => {
    if (props.variable.type === 'date' && !props.modelValue) emit('update:modelValue', todayKey());
  },
  { immediate: true },
);

function focus(): Promise<void> {
  if (props.variable.type === 'date' || props.variable.type === 'time') return Promise.resolve();
  const node = props.variable.type === 'long_text' ? areaRef.value : inputRef.value;
  if (!node) return Promise.resolve();
  node.focus({ preventScroll: true });
  const end = node.value.length;
  try {
    node.setSelectionRange(end, end);
  } catch {
    // Data e hora não aceitam seleção de texto.
  }
  return Promise.resolve();
}

onMounted(() => {
  void focus();
});

watch(
  () => props.variable.key,
  () => {
    void nextTick(() => {
      void focus();
    });
  },
  { immediate: true },
);

defineExpose({ focus });
</script>

<template>
  <div class="fn-ask">
    <h2 id="wizard-question">{{ question }}</h2>

    <textarea
      v-if="variable.type === 'long_text'"
      ref="areaRef"
      class="fn-wizard-input fn-wizard-area"
      :value="modelValue"
      :placeholder="variable.placeholder"
      :aria-label="question"
      rows="4"
      enterkeyhint="done"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      @input="emitText"
    />
    <input
      v-else-if="textual"
      ref="inputRef"
      class="fn-wizard-input"
      :value="modelValue"
      :placeholder="variable.placeholder"
      :aria-label="question"
      :inputmode="inputMode"
      :type="variable.type === 'email' ? 'email' : variable.type === 'url' ? 'url' : 'text'"
      enterkeyhint="next"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      @input="emitText"
      @keydown.enter.prevent="emit('advance')"
    />
    <div v-else-if="variable.type === 'date'" class="fn-date">
      <span class="fn-wizard-input fn-date-value">{{ dateLabel }}</span>
      <input
        class="fn-date-picker"
        type="date"
        :value="modelValue || todayKey()"
        :aria-label="question"
        @input="emitText"
      />
    </div>
    <input
      v-else-if="variable.type === 'time'"
      class="fn-wizard-input"
      :value="modelValue"
      :aria-label="question"
      type="time"
      @input="emitText"
    />
    <div v-else-if="variable.type === 'boolean'" class="fn-ask-options" role="group" :aria-label="question">
      <button type="button" :aria-pressed="modelValue === YES" @click="choose(YES)">Sim</button>
      <button type="button" :aria-pressed="modelValue === NO" @click="choose(NO)">Não</button>
    </div>
    <div v-else class="fn-ask-options" role="group" :aria-label="question">
      <button
        v-for="option in variable.options"
        :key="option.id"
        type="button"
        :aria-pressed="modelValue === option.value"
        @click="choose(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <p v-if="error" class="fn-ask-error" role="alert">{{ error }}</p>
    <div class="fn-ask-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.fn-ask {
  display: grid;
  align-content: start;
  gap: 14px;
  width: 100%;
  padding-top: 18px;
}

h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--fn-ink-soft);
}

.fn-wizard-input {
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 2px 0 12px;
  border: 0;
  border-bottom: 1px solid var(--fn-stroke);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  outline: none;
  color: var(--fn-ink);
  caret-color: var(--fn-ink);
  font: inherit;
  font-size: 22px;
  line-height: 1.35;
  letter-spacing: -0.03em;
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.fn-wizard-input:focus {
  outline: none;
  box-shadow: none;
  border-bottom-color: var(--fn-ink);
}

.fn-wizard-input::placeholder {
  color: var(--fn-ink-soft);
  opacity: 0.45;
}

.fn-wizard-input:-webkit-autofill {
  -webkit-text-fill-color: var(--fn-ink);
  caret-color: var(--fn-ink);
  box-shadow: 0 0 0 1000px var(--fn-bg) inset;
  transition: background-color 99999s ease-out;
}

.fn-wizard-area {
  min-height: 140px;
  resize: none;
  font-size: 17px;
  line-height: 1.45;
  letter-spacing: -0.01em;
}

.fn-ask-options {
  display: grid;
}

.fn-ask-options button {
  display: flex;
  align-items: center;
  min-height: 52px;
  padding: 0;
  border: 0;
  border-bottom: 0.5px solid var(--fn-stroke);
  background: transparent;
  color: var(--fn-ink);
  font: inherit;
  font-size: 17px;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.fn-ask-options button[aria-pressed='true'] {
  font-weight: 650;
}

.fn-ask-options button[aria-pressed='true']::after {
  content: '';
  width: 7px;
  height: 7px;
  margin-left: auto;
  border-radius: 50%;
  background: var(--fn-ink);
}

.fn-ask-error {
  margin: -6px 0 0;
  color: var(--fn-danger);
  font-size: 13px;
}

.fn-date {
  position: relative;
}

.fn-date-value {
  pointer-events: none;
}

.fn-date-picker {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  border: 0;
  cursor: pointer;
}

.fn-date-picker::-webkit-calendar-picker-indicator {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  cursor: pointer;
}

.fn-ask-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 44px;
}
</style>
