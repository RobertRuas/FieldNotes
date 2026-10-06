<script setup lang="ts">
import { ref } from 'vue';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTextarea,
  IonToolbar,
} from '@ionic/vue';
import EmptyState from '@/components/EmptyState.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import { useTasksStore } from '@/stores/tasksStore';
import { readIonText } from '@/utils/ionic';

const tasks = useTasksStore();
const title = ref('');
const detail = ref('');

function onTitle(event: Event): void {
  title.value = readIonText(event);
}

function onDetail(event: Event): void {
  detail.value = readIonText(event);
}

async function add(): Promise<void> {
  const current = title.value;
  const extra = detail.value;
  title.value = '';
  detail.value = '';
  await tasks.add(current, extra);
}
</script>

<template>
  <ion-page>
    <ion-header class="fn-header" translucent>
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
          aria-label="Tarefa"
          placeholder="O que precisa ser feito?"
          :value="title"
          @ionInput="onTitle"
        />
        <ion-textarea
          label="Detalhe"
          label-placement="stacked"
          aria-label="Detalhe da tarefa"
          placeholder="Opcional"
          :auto-grow="true"
          :rows="3"
          :value="detail"
          @ionInput="onDetail"
        />
        <ion-button type="submit" expand="block" :disabled="title.trim().length === 0">Adicionar</ion-button>
      </form>
      <EmptyState v-if="tasks.ordered.length === 0" title="Nenhuma tarefa ainda" body="As tarefas ficam neste aparelho." />
      <ion-list v-else class="fn-inset" lines="none">
        <ion-item v-for="task in tasks.ordered" :key="task.id">
          <button
            slot="start"
            type="button"
            class="fn-checkhit"
            :aria-pressed="task.done"
            :aria-label="task.done ? 'Marcar como pendente' : 'Marcar como feita'"
            @click="tasks.toggle(task.id)"
          >
            <i />
          </button>
          <ion-label>
            <h2>{{ task.title }}</h2>
            <p v-if="task.detail">{{ task.detail }}</p>
          </ion-label>
          <ion-button slot="end" fill="clear" aria-label="Excluir tarefa" @click="tasks.remove(task.id)">Excluir</ion-button>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>
