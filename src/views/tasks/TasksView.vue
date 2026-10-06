<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import EmptyState from '@/components/EmptyState.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import TaskForm from '@/components/TaskForm.vue';
import TaskRow from '@/components/TaskRow.vue';
import { useTasksStore } from '@/stores/tasksStore';
import { todayKey } from '@/utils/dates';
import { readIonText } from '@/utils/ionic';
import { doneTasks, openTaskSections } from '@/utils/tasks';

const router = useRouter();
const tasks = useTasksStore();
const title = ref('');
const editing = ref<string | null>(null);
const today = todayKey();

const openSections = computed(() => openTaskSections(tasks.tasks, today));
const finished = computed(() => doneTasks(tasks.tasks));
const empty = computed(() => tasks.tasks.length === 0);

function onTitle(event: Event): void {
  title.value = readIonText(event);
}

async function add(): Promise<void> {
  const created = await tasks.add({ title: title.value });
  if (!created) return;
  title.value = '';
  editing.value = created.id;
}

function openNote(id: string): void {
  void router.push({ name: 'editor', params: { noteId: id } });
}
</script>

<template>
  <ion-page>
    <ion-header class="fn-header">
      <ion-toolbar>
        <div class="fn-titlebar">
          <h1>Tarefas</h1>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content class="fn-page" fullscreen>
      <SyncStatus />
      <form class="fn-form" @submit.prevent="add">
        <ion-input
          label="Tarefa"
          label-placement="stacked"
          v-aria="'Nova tarefa'"
          placeholder="O que precisa ser feito?"
          :value="title"
          @ionInput="onTitle"
        />
        <ion-button type="submit" expand="block" :disabled="title.trim().length === 0">Adicionar</ion-button>
      </form>
      <EmptyState
        v-if="empty"
        title="Nenhuma tarefa ainda"
        body="Uma tarefa fica neste aparelho na hora. O lembrete agenda um aviso quando você define o horário."
      />
      <template v-else>
        <section v-for="section in openSections" :key="section.id" class="fn-section">
          <h2>{{ section.title }}</h2>
          <TaskRow
            v-for="task in section.tasks"
            :key="task.id"
            :task="task"
            @edit="editing = $event"
            @open-note="openNote"
          />
        </section>
        <section v-if="finished.length > 0" class="fn-section">
          <h2>Feitas</h2>
          <TaskRow
            v-for="task in finished"
            :key="task.id"
            :task="task"
            @edit="editing = $event"
            @open-note="openNote"
          />
        </section>
      </template>
    </ion-content>
    <ion-modal :is-open="editing !== null" @didDismiss="editing = null">
      <ion-header>
        <ion-toolbar>
          <ion-title>Tarefa</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="editing = null">Fechar</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <TaskForm v-if="editing" :task-id="editing" @close="editing = null" />
      </ion-content>
    </ion-modal>
  </ion-page>
</template>
