<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  IonContent,
  IonHeader,
  IonInput,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonToolbar,
} from '@ionic/vue';
import SyncStatus from '@/components/SyncStatus.vue';
import { notificationPermission, type AlertPermission } from '@/notifications/scheduler';
import { reloadWorkspace } from '@/utils/reloadWorkspace';
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

const email = ref('');
const password = ref('');
const displayName = ref('');
const accountMessage = ref('');
const accountBusy = ref(false);
const alertPermission = ref<AlertPermission>('prompt');

const alertSentence = computed(() => {
  const saved = notifications.items.filter((item) => item.kind === 'reminder').length;
  const state = alertPermission.value;
  if (state === 'granted' && saved > 0) return 'Os avisos futuros estão agendados neste aparelho.';
  if (state === 'granted') return 'A permissão de aviso já está concedida neste aparelho.';
  if (state === 'denied') return 'O horário fica guardado. O aviso do sistema foi recusado neste aparelho.';
  if (state === 'unsupported') return 'Este navegador não mostra aviso do sistema. O horário continua guardado.';
  return 'O aviso pede permissão na hora em que você guarda um lembrete.';
});

onMounted(() => {
  alertPermission.value = notificationPermission();
});

function onEmail(event: Event): void {
  email.value = readIonText(event);
}

function onPassword(event: Event): void {
  password.value = readIonText(event);
}

function onDisplayName(event: Event): void {
  displayName.value = readIonText(event);
}

async function afterAccount(ok: boolean): Promise<void> {
  if (!ok) return;
  await reloadWorkspace();
  alertPermission.value = notificationPermission();
}

async function enterAccount(): Promise<void> {
  if (email.value.trim().length === 0 || password.value.length < 6) {
    accountMessage.value = 'Informe o e-mail e uma senha com pelo menos 6 caracteres.';
    return;
  }
  accountBusy.value = true;
  accountMessage.value = '';
  const result = await auth.signIn(email.value, password.value);
  accountBusy.value = false;
  accountMessage.value = result.ok ? 'Conta ligada neste aparelho.' : result.reason;
  await afterAccount(result.ok);
}

async function createAccount(): Promise<void> {
  if (email.value.trim().length === 0 || password.value.length < 6) {
    accountMessage.value = 'Informe o e-mail e uma senha com pelo menos 6 caracteres.';
    return;
  }
  accountBusy.value = true;
  accountMessage.value = '';
  const result = await auth.signUp(email.value, password.value, displayName.value);
  accountBusy.value = false;
  accountMessage.value = result.ok ? 'Conta criada e ligada neste aparelho.' : result.reason;
  await afterAccount(result.ok);
}

async function leaveAccount(): Promise<void> {
  accountBusy.value = true;
  accountMessage.value = '';
  const result = await auth.signOut();
  accountBusy.value = false;
  if (!result.ok) {
    accountMessage.value = result.reason;
    return;
  }
  await reloadWorkspace();
  accountMessage.value = 'Saiu da conta. As notas continuam neste aparelho.';
}

function onTheme(event: Event): void {
  const value = readIonText(event);
  if (value === 'light' || value === 'dark' || value === 'auto') void settings.setTheme(value);
}

const sizeIndex = computed(() => Math.max(0, sizes.findIndex((item) => item.id === settings.contentTextSize)));
const sizeLabel = computed(() => sizes[sizeIndex.value]?.label ?? 'Normal');

function onSize(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const next = sizes[Number(input.value)];
  if (next) void settings.setTextSize(next.id);
}
</script>

<template>
  <ion-page>
    <ion-header class="fn-header">
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
        <p v-if="sync.lastError" class="fn-muted">A última tentativa falhou. As notas continuam neste aparelho.</p>
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
        <h2>Texto da nota</h2>
        <label class="fn-slider">
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            aria-label="Tamanho do texto da nota"
            :value="sizeIndex"
            @pointerdown.stop
            @input="onSize"
            @change="onSize"
          />
          <span>{{ sizeLabel }}</span>
        </label>
        <p class="fn-size-sample">O texto da nota fica neste tamanho.</p>
        <p class="fn-muted">Muda o texto da nota. A lista, os menus e o cabeçalho ficam iguais.</p>
      </section>
      <section class="fn-section">
        <h2>Conta</h2>
        <p v-if="!auth.remoteConfigured" class="fn-muted">Sem nuvem configurada. As notas ficam neste aparelho.</p>
        <template v-else-if="auth.signedIn">
          <p class="fn-muted">{{ auth.accountEmail }}</p>
          <button type="button" class="fn-text-btn" :disabled="accountBusy" @click="leaveAccount">Sair</button>
        </template>
        <form v-else class="fn-account" @submit.prevent="enterAccount">
          <ion-input label="E-mail" label-placement="stacked" type="email" v-aria="'E-mail da conta'" :value="email" @ionInput="onEmail" />
          <ion-input label="Senha" label-placement="stacked" type="password" v-aria="'Senha da conta'" :value="password" @ionInput="onPassword" />
          <ion-input label="Nome" label-placement="stacked" v-aria="'Nome na conta'" :value="displayName" @ionInput="onDisplayName" />
          <div class="fn-account-actions">
            <button type="submit" class="fn-text-btn" :disabled="accountBusy">Entrar</button>
            <button type="button" class="fn-text-btn" :disabled="accountBusy" @click="createAccount">Criar conta</button>
          </div>
        </form>
        <p v-if="accountMessage" class="fn-muted">{{ accountMessage }}</p>
        <p v-if="device.device" class="fn-muted">{{ device.device.name }}</p>
      </section>
      <section class="fn-section">
        <h2>Lembretes</h2>
        <p class="fn-muted">{{ reminderSentence }} {{ alertSentence }}</p>
      </section>
      <section class="fn-section">
        <h2>Sobre</h2>
        <p class="fn-muted">Notas de campo neste aparelho, mesmo sem rede.</p>
      </section>
    </ion-content>
  </ion-page>
</template>
