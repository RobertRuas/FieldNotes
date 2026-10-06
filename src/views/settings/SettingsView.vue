<script setup lang="ts">
import { computed } from 'vue';
import {
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonToolbar,
} from '@ionic/vue';
import SyncStatus from '@/components/SyncStatus.vue';
import { useAuthStore } from '@/stores/authStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import type { ContentTextSize, ThemeMode } from '@/types/entities';
import { readIonText } from '@/utils/ionic';

const settings = useSettingsStore();
const sync = useSyncStore();
const auth = useAuthStore();
const device = useDeviceStore();
const notifications = useNotificationStore();

const themes: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
  { id: 'auto', label: 'Automático' },
];

const sizes: { id: ContentTextSize; label: string }[] = [
  { id: 'pequeno', label: 'Pequeno' },
  { id: 'normal', label: 'Normal' },
  { id: 'grande', label: 'Grande' },
  { id: 'muito-grande', label: 'Muito grande' },
];

const queueLabel = computed(() => {
  const count = sync.pending;
  if (count === 0) return 'Nenhuma alteração na fila local.';
  if (count === 1) return '1 alteração na fila local, aguardando a nuvem.';
  return `${count} alterações na fila local, aguardando a nuvem.`;
});

const reminderSentence = computed(() => {
  const count = notifications.items.filter((item) => item.kind === 'reminder').length;
  if (count === 0) return 'Nenhum lembrete guardado neste aparelho.';
  if (count === 1) return '1 lembrete guardado neste aparelho.';
  return `${count} lembretes guardados neste aparelho.`;
});

function onTheme(event: Event): void {
  const value = readIonText(event);
  if (value === 'light' || value === 'dark' || value === 'auto') void settings.setTheme(value);
}

function setSize(size: ContentTextSize): void {
  void settings.setTextSize(size);
}
</script>

<template>
  <ion-page>
    <ion-header class="fn-header" translucent>
      <ion-toolbar>
        <div class="fn-titlebar">
          <h1>Configurações</h1>
        </div>
      </ion-toolbar>
    </ion-header>
    <ion-content class="fn-page" fullscreen>
      <section class="fn-section">
        <h2>Sincronização</h2>
        <SyncStatus />
        <p class="fn-muted">{{ queueLabel }}</p>
        <p class="fn-muted">
          {{
            sync.remoteConfigured
              ? 'Quando a rede volta, a fila tenta de novo sem apagar o que está neste aparelho.'
              : 'A nuvem ainda não está configurada. As notas ficam neste aparelho.'
          }}
        </p>
        <p v-if="sync.lastError" class="fn-muted">A última tentativa de enviar à nuvem falhou. As notas continuam neste aparelho.</p>
      </section>
      <section class="fn-section">
        <h2>Aparência</h2>
        <ion-segment :value="settings.theme" v-aria="'Aparência'" @ionChange="onTheme">
          <ion-segment-button v-for="theme in themes" :key="theme.id" :value="theme.id">
            <ion-label>{{ theme.label }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </section>
      <section class="fn-section">
        <h2>Texto das notas</h2>
        <ion-list class="fn-inset" lines="none" v-aria="{ label: 'Tamanho do texto das notas', role: 'radiogroup' }">
          <ion-item
            v-for="size in sizes"
            :key="size.id"
            button
            :detail="false"
            class="fn-choice"
            v-aria="{ role: 'radio', checked: settings.contentTextSize === size.id }"
            @click="setSize(size.id)"
          >
            <ion-label>{{ size.label }}</ion-label>
          </ion-item>
        </ion-list>
        <p class="fn-muted">O tamanho muda só o texto da nota, não os botões nem as abas.</p>
      </section>
      <section class="fn-section">
        <h2>Conta</h2>
        <p class="fn-muted">A entrada na conta chega numa próxima versão.</p>
        <p class="fn-muted">Por enquanto as notas ficam só neste aparelho.</p>
        <p v-if="auth.user" class="fn-muted">Perfil local: {{ auth.user.displayName ?? 'Sem nome' }}</p>
        <p v-if="device.device" class="fn-muted">Aparelho: {{ device.device.name }}</p>
      </section>
      <section class="fn-section">
        <h2>Lembretes</h2>
        <p class="fn-muted">{{ reminderSentence }} O aviso do sistema entra numa próxima versão.</p>
      </section>
      <section class="fn-section">
        <h2>Sobre</h2>
        <p class="fn-muted">FieldNotes guarda observações de campo. Esta fase funciona offline.</p>
      </section>
    </ion-content>
  </ion-page>
</template>
