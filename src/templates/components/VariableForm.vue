<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/vue';
import type { TemplateDefaultKind, TemplateVariable, TemplateVariableType } from '@/templates/types';
import { TEMPLATE_VARIABLE_TYPES } from '@/templates/types';
import { DEFAULT_LABELS, TYPE_LABELS, defaultKindsFor } from '@/templates/utils/labels';
import { VARIABLE_KEY } from '@/templates/utils/parser';
import { createId } from '@/utils/id';
import { isDateKey, isTimeKey } from '@/utils/dates';
import { humanizeKey, NO, YES } from '@/templates/utils/variables';

const props = defineProps<{
  variable: TemplateVariable | null;
  taken: string[];
}>();

const emit = defineEmits<{
  save: [variable: TemplateVariable, previousKey: string | null];
  remove: [key: string];
  close: [];
}>();

const key = ref('');
const label = ref('');
const prompt = ref('');
const type = ref<TemplateVariableType>('text');
const required = ref(true);
const placeholder = ref('');
const defaultKind = ref<TemplateDefaultKind>('none');
const defaultValue = ref('');
const optionsText = ref('');
const whenKey = ref('');
const whenEquals = ref('');
const error = ref('');
const previousKey = ref<string | null>(null);

const kinds = computed(() => defaultKindsFor(type.value));
const editing = computed(() => previousKey.value !== null);

watch(
  () => props.variable,
  (variable) => {
    error.value = '';
    if (!variable) {
      previousKey.value = null;
      key.value = '';
      label.value = '';
      prompt.value = '';
      type.value = 'text';
      required.value = true;
      placeholder.value = '';
      defaultKind.value = 'none';
      defaultValue.value = '';
      optionsText.value = '';
      whenKey.value = '';
      whenEquals.value = '';
      return;
    }
    previousKey.value = variable.key;
    key.value = variable.key;
    label.value = variable.label;
    prompt.value = variable.prompt;
    type.value = variable.type;
    required.value = variable.required;
    placeholder.value = variable.placeholder;
    defaultKind.value = variable.defaultKind;
    defaultValue.value = variable.defaultValue;
    optionsText.value = variable.options.map((option) => option.label).join('\n');
    whenKey.value = variable.when?.variableKey ?? '';
    whenEquals.value = variable.when?.equals ?? '';
  },
  { immediate: true },
);

function pickType(next: TemplateVariableType): void {
  type.value = next;
  if (!kinds.value.includes(defaultKind.value)) defaultKind.value = 'none';
}

function submit(): void {
  const nextKey = key.value.trim();
  if (!VARIABLE_KEY.test(nextKey)) {
    error.value = 'Use um nome curto, sem espaços.';
    return;
  }
  if (props.taken.some((item) => item === nextKey && item !== previousKey.value)) {
    error.value = 'Já existe uma variável com este nome.';
    return;
  }
  const options =
    type.value === 'select'
      ? optionsText.value
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .slice(0, 30)
          .map((line) => ({ id: createId(), label: line.slice(0, 80), value: line.slice(0, 80) }))
      : [];
  if (type.value === 'select' && options.length < 2) {
    error.value = 'Escreva pelo menos duas opções, uma por linha.';
    return;
  }
  if (defaultKind.value === 'static' && type.value === 'date' && defaultValue.value.trim() && !isDateKey(defaultValue.value.trim())) {
    error.value = 'A data fixa usa o formato AAAA-MM-DD.';
    return;
  }
  if (defaultKind.value === 'static' && type.value === 'time' && defaultValue.value.trim() && !isTimeKey(defaultValue.value.trim())) {
    error.value = 'A hora fixa usa o formato HH:MM.';
    return;
  }
  const whenVariable = whenKey.value.trim();
  const whenValue = whenEquals.value.trim();
  const variable: TemplateVariable = {
    id: props.variable?.id ?? createId(),
    key: nextKey,
    label: label.value.trim().slice(0, 80) || humanizeKey(nextKey),
    prompt: prompt.value.trim().slice(0, 160),
    type: type.value,
    required: required.value,
    placeholder: placeholder.value.trim().slice(0, 120),
    defaultKind: defaultKind.value,
    defaultValue:
      type.value === 'boolean' && defaultKind.value === 'static'
        ? defaultValue.value === NO
          ? NO
          : YES
        : defaultValue.value.trim().slice(0, 500),
    options,
    when: whenVariable && whenValue ? { variableKey: whenVariable.slice(0, 40), equals: whenValue.slice(0, 200) } : null,
    order: props.variable?.order ?? 0,
  };
  emit('save', variable, previousKey.value);
}

function removeCurrent(): void {
  if (!previousKey.value) return;
  emit('remove', previousKey.value);
}
</script>

<template>
  <ion-header>
    <ion-toolbar>
      <ion-title>{{ editing ? 'Editar variável' : 'Nova variável' }}</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="emit('close')">Fechar</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
  <ion-content class="fn-page">
    <form class="fn-var-form" @submit.prevent="submit">
      <label>
        Nome
        <input v-model="key" autocapitalize="off" placeholder="turbina" />
      </label>
      <label>
        Pergunta
        <input v-model="prompt" placeholder="Qual é o número da turbina?" />
      </label>
      <fieldset>
        <legend>Tipo</legend>
        <div class="fn-chips">
          <button
            v-for="item in TEMPLATE_VARIABLE_TYPES"
            :key="item"
            type="button"
            :aria-pressed="type === item"
            @click="pickType(item)"
          >
            {{ TYPE_LABELS[item] }}
          </button>
        </div>
      </fieldset>
      <button type="button" class="fn-chip" :aria-pressed="required" @click="required = !required">Obrigatório</button>
      <fieldset>
        <legend>Padrão</legend>
        <div class="fn-chips">
          <button
            v-for="item in kinds"
            :key="item"
            type="button"
            :aria-pressed="defaultKind === item"
            @click="defaultKind = item"
          >
            {{ DEFAULT_LABELS[item] }}
          </button>
        </div>
      </fieldset>
      <label v-if="defaultKind === 'static' && type !== 'boolean'">
        Valor fixo
        <input v-model="defaultValue" :placeholder="type === 'date' ? 'AAAA-MM-DD' : type === 'time' ? 'HH:MM' : ''" />
      </label>
      <div v-if="defaultKind === 'static' && type === 'boolean'" class="fn-chips">
        <button type="button" :aria-pressed="defaultValue !== NO" @click="defaultValue = YES">Sim</button>
        <button type="button" :aria-pressed="defaultValue === NO" @click="defaultValue = NO">Não</button>
      </div>
      <label v-if="type === 'select'">
        Opções, uma por linha
        <textarea v-model="optionsText" rows="3" placeholder="Concluído&#10;Em andamento&#10;Pendente" />
      </label>
      <details>
        <summary>Mais</summary>
        <label>
          Sugestão no campo
          <input v-model="placeholder" />
        </label>
        <label>
          Rótulo
          <input v-model="label" placeholder="Número da turbina" />
        </label>
        <label>
          Mostrar só se
          <input v-model="whenKey" autocapitalize="off" placeholder="standby" />
        </label>
        <label>
          for igual a
          <input v-model="whenEquals" placeholder="Sim" />
        </label>
      </details>
      <p v-if="error" class="fn-var-error" role="alert">{{ error }}</p>
      <div class="fn-var-actions">
        <button v-if="editing" type="button" class="fn-text" @click="removeCurrent">Remover</button>
        <button type="submit" class="fn-go">{{ editing ? 'Guardar' : 'Inserir' }}</button>
      </div>
    </form>
  </ion-content>
</template>

<style scoped>
.fn-var-form {
  display: grid;
  gap: 10px;
  padding-top: 8px;
}

label,
fieldset {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--fn-ink-soft);
  font-size: 11px;
}

input,
textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 34px;
  padding: 6px 8px;
  border: 1px solid var(--fn-stroke);
  border-radius: 8px;
  background: var(--fn-surface);
  color: var(--fn-ink);
  font: inherit;
  font-size: 14px;
}

.fn-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.fn-chips button,
.fn-chip {
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid var(--fn-stroke);
  border-radius: 999px;
  background: transparent;
  color: var(--fn-ink);
  font: inherit;
  font-size: 12px;
}

.fn-chips button[aria-pressed='true'],
.fn-chip[aria-pressed='true'] {
  background: var(--fn-accent);
  border-color: transparent;
  color: var(--fn-accent-ink);
}

details {
  display: grid;
  gap: 8px;
}

summary {
  font-size: 12px;
  color: var(--fn-ink-soft);
}

.fn-var-error {
  margin: 0;
  color: var(--fn-danger);
  font-size: 12px;
}

.fn-var-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.fn-text {
  border: 0;
  background: transparent;
  color: var(--fn-danger);
  font: inherit;
  font-size: 12px;
}

.fn-go {
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: var(--fn-accent);
  color: var(--fn-accent-ink);
  font: inherit;
  font-size: 13px;
  font-weight: 650;
}
</style>
