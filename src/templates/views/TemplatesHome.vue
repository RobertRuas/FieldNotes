<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonActionSheet, IonContent, IonIcon, IonPage } from '@ionic/vue';
import { addOutline } from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import EmptyState from '@/components/EmptyState.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import TemplateCard from '@/templates/components/TemplateCard.vue';
import { useTemplatesStore } from '@/stores/templatesStore';
import type { NoteTemplate } from '@/templates/types';
import { extractVariables } from '@/templates/utils/parser';
import { DAILY_REPORT_CONTENT, dailyReportFields } from '@/templates/utils/sample';

const router = useRouter();
const templates = useTemplatesStore();
const sheetId = ref<string | null>(null);

const sheetOpen = computed(() => sheetId.value !== null);
const sheetItem = computed(() => templates.items.find((item) => item.id === sheetId.value) ?? null);

const sheetButtons = computed(() => {
  const item = sheetItem.value;
  return [
    { text: 'Executar', handler: () => { if (item) run(item.id); } },
    { text: 'Editar', handler: () => { if (item) edit(item.id); } },
    { text: 'Duplicar', handler: () => { if (item) void templates.duplicate(item.id); } },
    {
      text: 'Excluir modelo',
      role: 'destructive' as const,
      handler: () => { if (item) void templates.remove(item.id); },
    },
    { text: 'Cancelar', role: 'cancel' as const },
  ];
});

function fieldsOf(item: NoteTemplate): number {
  return extractVariables(item.content).length;
}

function edit(id: string): void {
  void router.push({ name: 'modelo', params: { templateId: id } });
}

function run(id: string): void {
  void router.push({ name: 'modelo-executar', params: { templateId: id } });
}

function createBlank(): void {
  void router.push({ name: 'modelo', params: { templateId: 'novo' } });
}

async function createSample(): Promise<void> {
  const created = await templates.create({
    name: 'Relatório diário',
    content: DAILY_REPORT_CONTENT,
    variables: dailyReportFields(),
  });
  if (created) edit(created.id);
}
</script>

<template>
  <ion-page>
    <AppHeader title="Modelos">
      <button type="button" class="fn-plus" aria-label="Novo modelo" @click="createBlank">
        <ion-icon :icon="addOutline" aria-hidden="true" />
      </button>
    </AppHeader>
    <ion-content class="fn-page">
      <SyncStatus />
      <EmptyState
        v-if="templates.ordered.length === 0"
        title="Nenhum modelo ainda"
        body="Um modelo vira uma nota depois de responder às perguntas, uma de cada vez."
      >
        <div class="fn-suggest">
          <button type="button" class="fn-chip" @click="createSample">Relatório diário</button>
        </div>
      </EmptyState>
      <div v-else class="fn-stack">
        <section v-if="templates.recent.length > 0" class="fn-template-group">
          <h2>Recentes</h2>
          <TemplateCard
            v-for="item in templates.recent"
            :key="`recent-${item.id}`"
            :item="item"
            :fields="fieldsOf(item)"
            @open="edit(item.id)"
            @run="run(item.id)"
            @menu="sheetId = item.id"
          />
        </section>
        <section class="fn-template-group">
          <h2>Todos</h2>
          <TemplateCard
            v-for="item in templates.ordered"
            :key="item.id"
            :item="item"
            :fields="fieldsOf(item)"
            @open="edit(item.id)"
            @run="run(item.id)"
            @menu="sheetId = item.id"
          />
        </section>
      </div>
    </ion-content>
    <ion-action-sheet :is-open="sheetOpen" header="Modelo" :buttons="sheetButtons" @didDismiss="sheetId = null" />
  </ion-page>
</template>

<style scoped>
.fn-template-group {
  display: grid;
  gap: 10px;
}

.fn-template-group h2 {
  margin: 8px 0 0;
  font-size: var(--fn-text-sm);
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fn-ink-soft);
}
</style>
