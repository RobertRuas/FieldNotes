<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonAlert, IonContent, IonPage } from '@ionic/vue';
import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import TemplatePreview from '@/templates/components/TemplatePreview.vue';
import TemplateVariableField from '@/templates/components/TemplateVariableField.vue';
import { useTemplateWizard } from '@/templates/composables/useTemplateWizard';
import { useKeyboardInset, releaseKeyboard } from '@/composables/useKeyboardInset';
import { pushToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/authStore';
import { useNotesStore } from '@/stores/notesStore';
import { useTemplatesStore } from '@/stores/templatesStore';
import type { NoteTemplate } from '@/templates/types';
import { templateNoteHtml } from '@/templates/utils/engine';
import type { Note } from '@/types/entities';
import { nowIso } from '@/utils/dates';
import { createId } from '@/utils/id';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const notes = useNotesStore();
const templates = useTemplatesStore();
const template = ref<NoteTemplate | null>(null);
const missing = ref(false);
const busy = ref(false);
const discardOpen = ref(false);
const leaveTarget = ref<'modelos' | 'notas'>('modelos');
const fieldRef = ref<{ focus: () => Promise<void> } | null>(null);
const wizard = useTemplateWizard(template);
const {
  phase,
  field,
  answers,
  error,
  progressLabel,
  progressRatio,
  canBack,
  preview,
  actionLabel,
  setValue,
  destination,
  advance,
  back,
  boot,
} = wizard;

useKeyboardInset();

const barStyle = computed(() => ({ width: `${Math.round(progressRatio.value * 100)}%` }));

function focusField(): void {
  if (!field.value) return;
  const place = (): void => {
    void fieldRef.value?.focus();
  };
  void nextTick(() => {
    place();
    window.requestAnimationFrame(place);
  });
  window.setTimeout(place, 80);
  window.setTimeout(place, 420);
}

onMounted(async () => {
  document.documentElement.classList.add('fn-wizard-open');
  await templates.hydrate();
  const found = templates.find(String(route.params.templateId ?? ''));
  if (!found) {
    missing.value = true;
    return;
  }
  template.value = found;
  boot();
  focusField();
});

function onEnter(): void {
  focusField();
}

onBeforeUnmount(() => {
  document.documentElement.classList.remove('fn-wizard-open');
  releaseKeyboard();
});

watch(field, () => {
  if (phase.value === 'ask') focusField();
});

function onContinue(): void {
  if (phase.value === 'review') {
    void createNote();
    return;
  }
  const target = destination();
  if (target === 'invalid' || target === null) return;
  if (target === 'review') releaseKeyboard();
  advance();
  focusField();
}

function onBack(): void {
  back();
  focusField();
}

function leave(): void {
  const target = leaveTarget.value;
  discardOpen.value = false;
  releaseKeyboard();
  void router.push({ name: target });
}

function askLeave(target: 'modelos' | 'notas'): void {
  leaveTarget.value = target;
  if (!wizard.dirty.value) {
    leave();
    return;
  }
  discardOpen.value = true;
}

function onHeaderBack(): void {
  if (canBack.value) onBack();
  else askLeave('modelos');
}

function onDiscard(event: CustomEvent<{ role?: string }>): void {
  discardOpen.value = false;
  if (event.detail.role === 'destructive') leave();
}

async function createNote(): Promise<void> {
  const current = template.value;
  const userId = auth.userId;
  if (!current || !userId || busy.value) return;
  const body = wizard.preview.value;
  busy.value = true;
  const now = nowIso();
  const note: Note = {
    id: createId(),
    userId,
    title: '',
    text: templateNoteHtml(body),
    attachments: [],
    photos: [],
    documents: [],
    audio: [],
    tasks: [],
    date: wizard.dateKey(),
    collectionId: null,
    reminderAt: null,
    pinned: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: 'pending',
  };
  try {
    await notes.save(note);
  } catch {
    busy.value = false;
    return;
  }
  const remembered = await templates.rememberRun(current.id, wizard.renderedAnswers());
  if (!remembered) pushToast('A nota foi criada, mas o último valor não ficou guardado.');
  releaseKeyboard();
  await router.replace({ name: 'notas' });
}
</script>

<template>
  <ion-page @ionViewDidEnter="onEnter">
    <AppHeader title="Nova nota" back @back="onHeaderBack">
      <button v-if="template && phase !== 'review'" type="button" class="fn-text-btn" @click="askLeave('modelos')">Fechar</button>
    </AppHeader>
    <ion-content class="fn-page fn-editor-scroll">
      <EmptyState v-if="missing" title="Modelo não encontrado" body="Volte à lista e escolha outro modelo." />
      <div v-else-if="template" class="fn-wizard">
        <div class="fn-wizard-meta">
          <p>{{ template.name }}</p>
          <div class="fn-wizard-bar" aria-hidden="true"><span :style="barStyle" /></div>
          <p v-if="progressLabel">{{ progressLabel }}</p>
        </div>
        <TemplateVariableField
          v-if="field"
          ref="fieldRef"
          :variable="field"
          :model-value="answers[field.key] ?? ''"
          :error="error"
          @update:model-value="setValue"
          @advance="onContinue"
        >
          <button v-if="canBack" type="button" class="fn-back" @pointerdown.prevent="onBack">Voltar</button>
          <span v-else />
          <button type="button" class="fn-next" :disabled="busy" @pointerdown.prevent="onContinue">
            {{ actionLabel }}
          </button>
        </TemplateVariableField>
        <section v-else class="fn-review" aria-labelledby="review-title">
          <h2 id="review-title">Nota</h2>
          <div class="fn-result">
            <TemplatePreview :text="preview" />
          </div>
          <div class="fn-review-actions">
            <button type="button" class="fn-go" :disabled="busy" @click="onContinue">
              {{ busy ? 'A criar…' : actionLabel }}
            </button>
          </div>
        </section>
      </div>
    </ion-content>
    <ion-alert
      :is-open="discardOpen"
      header="Descartar preenchimento?"
      message="Os dados preenchidos serão perdidos."
      :buttons="[
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Descartar', role: 'destructive' },
      ]"
      @didDismiss="onDiscard"
    />
  </ion-page>
</template>

<style scoped>
.fn-wizard {
  display: grid;
  align-content: start;
  gap: 0;
  padding: 4px 20px 0;
}

.fn-wizard-meta {
  display: grid;
  gap: 8px;
}

.fn-wizard-meta p {
  margin: 0;
  color: var(--fn-ink-soft);
  font-size: 12px;
}

.fn-wizard-meta p:first-child {
  color: var(--fn-ink);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.fn-wizard-bar {
  width: 100%;
  height: 2px;
  border-radius: 999px;
  background: var(--fn-stroke);
  overflow: hidden;
}

.fn-wizard-bar span {
  display: block;
  height: 100%;
  background: var(--fn-ink);
}

.fn-review {
  display: grid;
  gap: 16px;
  padding-top: 22px;
}

.fn-review h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--fn-ink-soft);
}

.fn-result {
  padding: 12px 14px;
  border: 0.5px solid var(--fn-stroke);
  border-radius: 12px;
  background: var(--fn-surface);
  user-select: text;
  -webkit-user-select: text;
  -webkit-touch-callout: default;
}

.fn-result :deep(.fn-template-preview) {
  font-size: 13px;
  line-height: 1.4;
  user-select: text;
  -webkit-user-select: text;
}

.fn-review-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.fn-back,
.fn-next,
.fn-go {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 16px;
  -webkit-tap-highlight-color: transparent;
}

.fn-back {
  color: var(--fn-ink-soft);
}

.fn-next,
.fn-go {
  margin-left: auto;
  color: var(--fn-ink);
  font-weight: 650;
}

.fn-go {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 12px;
  background: var(--fn-ink);
  color: var(--fn-bg);
}

.fn-next:disabled,
.fn-go:disabled {
  opacity: 0.4;
}
</style>
