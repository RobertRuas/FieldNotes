<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonAlert, IonContent, IonIcon, IonInput, IonModal, IonPage } from '@ionic/vue';
import { addOutline, checkmarkOutline, keypadOutline, playOutline } from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import VariableForm from '@/templates/components/VariableForm.vue';
import { useTemplatesStore } from '@/stores/templatesStore';
import type { NoteTemplate, TemplateMemory, TemplateVariable } from '@/templates/types';
import { TYPE_LABELS } from '@/templates/utils/labels';
import { extractVariables, removeVariableKey, replaceVariableKey } from '@/templates/utils/parser';
import { questionFor, reconcileVariables } from '@/templates/utils/variables';
import { pushToast } from '@/composables/useToast';
import { escapeHtml } from '@/utils/html';
import { readIonText } from '@/utils/ionic';

const route = useRoute();
const router = useRouter();
const templates = useTemplatesStore();

const name = ref('');
const content = ref('');
const variables = ref<TemplateVariable[]>([]);
const customOrder = ref(false);
const favorite = ref(false);
const lastValues = ref<TemplateMemory[]>([]);
const lastUsedAt = ref<string | null>(null);
const existingId = ref<string | null>(null);
const ready = ref(false);
const missing = ref(false);
const formOpen = ref(false);
const editing = ref<TemplateVariable | null>(null);
const showPreview = ref(false);
const leaveOpen = ref(false);
const bodyRef = ref<HTMLTextAreaElement | null>(null);
const keyboardOn = ref(false);
const snapshot = ref('');

const taken = computed(() => variables.value.map((item) => item.key));
const dirty = computed(() => ready.value && !missing.value && stamp() !== snapshot.value);
const previewHtml = computed(() =>
  escapeHtml(content.value).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_full, raw: string) => `<mark class="fn-token">${raw.trim()}</mark>`),
);

function stamp(): string {
  return JSON.stringify({ name: name.value, content: content.value, variables: variables.value, customOrder: customOrder.value });
}

function applyTemplate(template: NoteTemplate): void {
  existingId.value = template.id;
  name.value = template.name;
  content.value = template.content;
  variables.value = template.variables.map((item) => ({
    ...item,
    options: item.options.map((option) => ({ ...option })),
    when: item.when ? { ...item.when } : null,
  }));
  customOrder.value = template.customOrder;
  favorite.value = template.favorite;
  lastValues.value = template.lastValues.map((item) => ({ ...item }));
  lastUsedAt.value = template.lastUsedAt;
  snapshot.value = stamp();
}

onMounted(async () => {
  await templates.hydrate();
  const id = String(route.params.templateId ?? '');
  if (id === 'novo') {
    snapshot.value = stamp();
    ready.value = true;
    return;
  }
  const found = templates.find(id);
  if (!found) {
    missing.value = true;
    ready.value = true;
    return;
  }
  applyTemplate(found);
  ready.value = true;
});

function syncVariables(): void {
  variables.value = reconcileVariables(content.value, variables.value);
}

function onName(event: Event): void {
  name.value = readIonText(event);
}

function onContent(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;
  content.value = target.value;
  syncVariables();
}

function insertAtCursor(token: string): void {
  const el = bodyRef.value;
  if (!el) {
    content.value = `${content.value}${token}`;
    syncVariables();
    return;
  }
  const start = el.selectionStart ?? content.value.length;
  const end = el.selectionEnd ?? start;
  const previous = content.value[start - 1] ?? '';
  const piece = `${previous && previous !== ' ' && previous !== '\n' ? ' ' : ''}${token}`;
  content.value = `${content.value.slice(0, start)}${piece}${content.value.slice(end)}`;
  syncVariables();
  void nextTick(() => {
    el.focus();
    const pos = start + piece.length;
    el.setSelectionRange(pos, pos);
  });
}

function toggleKeyboard(): void {
  const field = bodyRef.value;
  if (!field) return;
  if (keyboardOn.value) {
    field.blur();
    keyboardOn.value = false;
    return;
  }
  field.focus();
  keyboardOn.value = true;
}

function openNew(): void {
  editing.value = null;
  formOpen.value = true;
}

function openEdit(variable: TemplateVariable): void {
  editing.value = variable;
  formOpen.value = true;
}

function onSaveVariable(variable: TemplateVariable, previousKey: string | null): void {
  if (!previousKey) {
    variables.value = [...variables.value, variable];
    insertAtCursor(`{{${variable.key}}}`);
  } else if (previousKey !== variable.key) {
    variables.value = variables.value.map((item) => (item.key === previousKey ? variable : item));
    content.value = replaceVariableKey(content.value, previousKey, variable.key);
    if (lastValues.value.some((item) => item.key === previousKey)) {
      lastValues.value = lastValues.value.map((item) => (item.key === previousKey ? { ...item, key: variable.key } : item));
    }
    syncVariables();
  } else {
    variables.value = variables.value.map((item) => (item.key === variable.key ? variable : item));
    syncVariables();
  }
  formOpen.value = false;
}

function onRemove(key: string): void {
  content.value = removeVariableKey(content.value, key);
  variables.value = variables.value.filter((item) => item.key !== key);
  syncVariables();
  formOpen.value = false;
}

function blocked(): boolean {
  if (!name.value.trim() || !content.value.trim()) return true;
  const broken = variables.value.some((item) => item.type === 'select' && item.options.length < 2);
  if (broken) {
    pushToast('Cada seleção precisa de pelo menos duas opções.');
    return true;
  }
  const unknown = extractVariables(content.value).filter((key) => !variables.value.some((item) => item.key === key));
  if (unknown.length > 0) syncVariables();
  return false;
}

async function persist(): Promise<string | null> {
  if (blocked()) return null;
  if (existingId.value) {
    const current = templates.find(existingId.value);
    if (!current) return null;
    const saved = await templates.save({
      ...current,
      name: name.value,
      content: content.value,
      variables: variables.value,
      customOrder: customOrder.value,
      favorite: favorite.value,
      lastValues: lastValues.value,
      lastUsedAt: lastUsedAt.value,
    });
    if (!saved) return null;
    applyTemplate(saved);
    return saved.id;
  }
  const created = await templates.create({
    name: name.value,
    content: content.value,
    variables: variables.value,
    customOrder: customOrder.value,
  });
  if (!created) return null;
  applyTemplate(created);
  await router.replace({ name: 'modelo', params: { templateId: created.id } });
  return created.id;
}

async function saveOnly(): Promise<void> {
  const id = await persist();
  if (id) pushToast('Modelo guardado.');
}

async function run(): Promise<void> {
  const id = await persist();
  if (!id) return;
  await router.push({ name: 'modelo-executar', params: { templateId: id } });
}

function askBack(): void {
  if (dirty.value) {
    leaveOpen.value = true;
    return;
  }
  void router.push({ name: 'modelos' });
}

function onLeave(event: CustomEvent<{ role?: string }>): void {
  leaveOpen.value = false;
  if (event.detail.role === 'destructive') void router.push({ name: 'modelos' });
}
</script>

<template>
  <ion-page>
    <AppHeader :title="existingId ? 'Editar modelo' : 'Novo modelo'" back @back="askBack">
      <button v-if="!missing" type="button" class="fn-text-btn" @click="showPreview = !showPreview">
        {{ showPreview ? 'Editar' : 'Ver' }}
      </button>
    </AppHeader>
    <ion-content class="fn-page">
      <EmptyState v-if="missing" title="Modelo não encontrado" body="Ele pode ter sido apagado neste aparelho." />
      <form v-else class="fn-form" @submit.prevent="saveOnly">
        <ion-input
          class="fn-name"
          label="Nome"
          label-placement="stacked"
          v-aria="'Nome do modelo'"
          :value="name"
          placeholder="Relatório diário"
          @ionInput="onName"
        />
        <div v-show="!showPreview" class="fn-field">
          <textarea
            id="template-body"
            ref="bodyRef"
            class="fn-template-body"
            :value="content"
            rows="10"
            placeholder="Data: {{data}}"
            aria-label="Texto do modelo"
            @input="onContent"
            @focus="keyboardOn = true"
            @blur="keyboardOn = false"
          />
          <div class="fn-field-tools">
            <button
              type="button"
              class="fn-mini"
              :aria-pressed="keyboardOn"
              :aria-label="keyboardOn ? 'Esconder teclado' : 'Mostrar teclado'"
              @mousedown.prevent
              @click="toggleKeyboard"
            >
              <ion-icon :icon="keypadOutline" aria-hidden="true" />
              <span>{{ keyboardOn ? 'Esconder' : 'Teclado' }}</span>
            </button>
            <button type="button" class="fn-mini" @click="openNew">
              <ion-icon :icon="addOutline" aria-hidden="true" />
              <span>Variável</span>
            </button>
          </div>
        </div>
        <div v-if="showPreview" class="fn-template-view" v-html="previewHtml" />
        <ul v-if="variables.length > 0" class="fn-var-list">
          <li v-for="variable in variables" :key="variable.id">
            <button type="button" @click="openEdit(variable)">
              <strong>{{ variable.key }}</strong>
              <span>{{ TYPE_LABELS[variable.type] }}</span>
              <small>{{ questionFor(variable) }}</small>
            </button>
          </li>
        </ul>
        <div class="fn-editor-actions">
          <button type="button" class="fn-mini" :disabled="!name.trim() || !content.trim()" @click="saveOnly">
            <ion-icon :icon="checkmarkOutline" aria-hidden="true" />
            <span>Guardar</span>
          </button>
          <button type="button" class="fn-mini" :disabled="!name.trim() || !content.trim()" @click="run">
            <ion-icon :icon="playOutline" aria-hidden="true" />
            <span>Executar</span>
          </button>
        </div>
      </form>
    </ion-content>
    <ion-modal :is-open="formOpen" @didDismiss="formOpen = false">
      <VariableForm
        :variable="editing"
        :taken="taken"
        @save="onSaveVariable"
        @remove="onRemove"
        @close="formOpen = false"
      />
    </ion-modal>
    <ion-alert
      :is-open="leaveOpen"
      header="Descartar alterações?"
      message="O que não foi guardado será perdido."
      :buttons="[
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Descartar', role: 'destructive' },
      ]"
      @didDismiss="onLeave"
    />
  </ion-page>
</template>

<style scoped>
.fn-name {
  font-size: 14px;
  --padding-top: 2px;
  --padding-bottom: 2px;
}

.fn-field {
  display: grid;
  border: 1px solid var(--fn-stroke);
  border-radius: var(--fn-radius);
  background: var(--fn-surface);
  overflow: hidden;
}

.fn-template-body,
.fn-template-view {
  width: 100%;
  min-height: 160px;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: var(--fn-ink);
  font: inherit;
  font-size: 14px;
  line-height: 1.35;
  white-space: pre-wrap;
}

.fn-template-view {
  border: 1px solid var(--fn-stroke);
  border-radius: var(--fn-radius);
  background: var(--fn-surface);
}

.fn-field-tools,
.fn-editor-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

.fn-field-tools {
  padding: 2px 4px 4px;
}

.fn-mini {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 6px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--fn-ink-soft);
  font: inherit;
  font-size: 12px;
}

.fn-mini ion-icon {
  font-size: 15px;
  color: var(--fn-ink);
}

.fn-mini[aria-pressed='true'] {
  color: var(--fn-accent);
}

.fn-mini:disabled {
  opacity: 0.4;
}

.fn-template-body {
  resize: vertical;
}

.fn-var-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.fn-var-list button {
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 2px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  font-size: 13px;
}

.fn-var-list span,
.fn-var-list small {
  color: var(--fn-ink-soft);
  font-size: var(--fn-text-sm);
}

:deep(.fn-token) {
  padding: 0 4px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--fn-accent) 16%, transparent);
  color: var(--fn-accent);
}
</style>
