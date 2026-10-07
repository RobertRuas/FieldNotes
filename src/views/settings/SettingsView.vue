<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonAlert, IonContent, IonIcon, IonInput, IonModal, IonPage } from '@ionic/vue';
import {
  checkmarkOutline,
  chevronForward,
  closeOutline,
  cloudDoneOutline,
  cloudOfflineOutline,
  contrastOutline,
  downloadOutline,
  keyOutline,
  logInOutline,
  logOutOutline,
  moonOutline,
  notificationsOutline,
  refreshOutline,
  sunnyOutline,
  textOutline,
  trashOutline,
} from 'ionicons/icons';
import AppHeader from '@/components/AppHeader.vue';
import SyncStatus from '@/components/SyncStatus.vue';
import { pushToast } from '@/composables/useToast';
import { db } from '@/database/db';
import { notificationPermission, type AlertPermission } from '@/notifications/scheduler';
import { getSupabase } from '@/services/supabaseClient';
import { useAuthStore } from '@/stores/authStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useNotesStore } from '@/stores/notesStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSyncStore } from '@/stores/syncStore';
import type { ContentTextSize, ThemeMode } from '@/types/entities';
import { clearAppCache } from '@/utils/clearAppCache';
import { reloadWorkspace } from '@/utils/reloadWorkspace';
import { htmlToPlain } from '@/utils/html';
import { displayTitle } from '@/utils/text';

const router = useRouter();
const settings = useSettingsStore();
const sync = useSyncStore();
const auth = useAuthStore();
const device = useDeviceStore();
const notes = useNotesStore();
const notifications = useNotificationStore();

const themes: { id: ThemeMode; label: string; icon: string }[] = [
  { id: 'light', label: 'Claro', icon: sunnyOutline },
  { id: 'dark', label: 'Escuro', icon: moonOutline },
  { id: 'auto', label: 'Automático', icon: contrastOutline },
];

const sizes: { id: ContentTextSize; label: string }[] = [
  { id: 'minimo', label: 'Mínimo' },
  { id: 'pequeno', label: 'Pequeno' },
  { id: 'normal', label: 'Normal' },
  { id: 'grande', label: 'Grande' },
  { id: 'muito-grande', label: 'Muito grande' },
];

// Estado de Senha
const passwordModalOpen = ref(false);
const newPassword = ref('');
const confirmPassword = ref('');
const passwordError = ref('');
const passwordBusy = ref(false);

// Estado de Backup & Reset
const resetAlertOpen = ref(false);
const resetting = ref(false);
const exporting = ref(false);

// Estado da Conta
const accountBusy = ref(false);
const clearingCache = ref(false);
const alertPermission = ref<AlertPermission>('prompt');

const accountLine = computed(() => auth.accountEmail ?? 'Modo local');
const themeLabel = computed(() => themes.find((item) => item.id === settings.theme)?.label ?? 'Automático');
const queueShort = computed(() => {
  const count = sync.pending;
  if (count === 0) return 'Em dia';
  if (count === 1) return '1 na fila';
  return `${count} na fila`;
});
const reminderShort = computed(() => {
  const count = notifications.items.filter((item) => item.kind === 'reminder').length;
  if (count === 0) return 'Sem lembretes';
  if (count === 1) return '1 lembrete';
  return `${count} lembretes`;
});
const alertShort = computed(() => {
  const state = alertPermission.value;
  if (state === 'granted') return 'Autorizadas';
  if (state === 'denied') return 'Bloqueadas';
  if (state === 'unsupported') return 'Indisponíveis';
  return 'Ao agendar';
});

const sizeIndex = computed(() => Math.max(0, sizes.findIndex((item) => item.id === settings.contentTextSize)));
const sizeLabel = computed(() => sizes[sizeIndex.value]?.label ?? 'Normal');

onMounted(() => {
  alertPermission.value = notificationPermission();
});

function onSize(event: Event): void {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const next = sizes[Number(input.value)];
  if (next) void settings.setTextSize(next.id);
}

async function leaveAccount(): Promise<void> {
  accountBusy.value = true;
  const result = await auth.signOut();
  accountBusy.value = false;
  if (!result.ok) {
    pushToast(result.reason);
    return;
  }
  await reloadWorkspace();
  await router.replace({ name: 'entrar' });
}

function openPasswordModal(): void {
  newPassword.value = '';
  confirmPassword.value = '';
  passwordError.value = '';
  passwordModalOpen.value = true;
}

async function changePassword(): Promise<void> {
  if (newPassword.value.length < 6) {
    passwordError.value = 'A senha deve ter pelo menos 6 caracteres.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'As senhas não coincidem.';
    return;
  }
  passwordBusy.value = true;
  passwordError.value = '';
  try {
    const client = await getSupabase();
    if (!client) {
      passwordError.value = 'Serviço de nuvem não disponível.';
      return;
    }
    const { error } = await client.auth.updateUser({ password: newPassword.value });
    if (error) {
      passwordError.value = error.message;
      return;
    }
    passwordModalOpen.value = false;
    pushToast('Senha alterada com sucesso.');
  } catch {
    passwordError.value = 'Erro ao atualizar a senha.';
  } finally {
    passwordBusy.value = false;
  }
}

async function exportNotes(): Promise<void> {
  exporting.value = true;
  try {
    const allNotes = notes.notes;
    if (allNotes.length === 0) {
      pushToast('Nenhuma nota para exportar.');
      return;
    }
    const exportData = allNotes.map((n) => ({
      titulo: displayTitle(n),
      conteudo_texto: htmlToPlain(n.text),
      conteudo_html: n.text,
      data: n.date,
      favorito: n.favorite,
      fixado: n.pinned,
      criado_em: n.createdAt,
      atualizado_em: n.updatedAt,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldnotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushToast('Notas exportadas com sucesso!');
  } catch {
    pushToast('Falha ao exportar notas.');
  } finally {
    exporting.value = false;
  }
}

async function confirmResetAll(): Promise<void> {
  resetting.value = true;
  try {
    const userId = auth.userId;
    if (userId) {
      const allNotes = await db.notes.filter((r) => r.userId === userId && r.deletedAt === null).toArray();
      for (const n of allNotes) {
        await notes.remove(n.id);
      }
    }
    pushToast('Todas as notas locais foram removidas.');
  } catch {
    pushToast('Erro ao remover notas.');
  } finally {
    resetting.value = false;
  }
}

async function clearCache(): Promise<void> {
  if (clearingCache.value) return;
  clearingCache.value = true;
  await clearAppCache();
}
</script>

<template>
  <ion-page>
    <AppHeader title="Configurações" />
    <ion-content class="fn-page">
      <div class="fn-settings">
        <details class="fn-fold">
          <summary>
            <ion-icon class="fn-fold-chevron" :icon="chevronForward" aria-hidden="true" />
            <span>Conta</span>
            <em>{{ accountLine }}</em>
          </summary>
          <div class="fn-fold-body">
            <p v-if="device.device" class="fn-fold-meta">{{ device.device.name }} · {{ device.device.platform }}</p>
            <div class="fn-icon-row">
              <button
                v-if="auth.signedIn"
                type="button"
                class="fn-icon-btn"
                aria-label="Alterar senha"
                title="Alterar senha"
                @click="openPasswordModal"
              >
                <ion-icon :icon="keyOutline" aria-hidden="true" />
              </button>
              <button
                v-else
                type="button"
                class="fn-icon-btn"
                aria-label="Entrar"
                title="Entrar"
                @click="router.push('/entrar')"
              >
                <ion-icon :icon="logInOutline" aria-hidden="true" />
              </button>
              <button
                v-if="auth.signedIn"
                type="button"
                class="fn-icon-btn is-danger"
                aria-label="Sair da conta"
                title="Sair"
                :disabled="accountBusy"
                @click="leaveAccount"
              >
                <ion-icon :icon="logOutOutline" aria-hidden="true" />
              </button>
            </div>
          </div>
        </details>

        <details class="fn-fold">
          <summary>
            <ion-icon class="fn-fold-chevron" :icon="chevronForward" aria-hidden="true" />
            <span>Aparência</span>
            <em>{{ themeLabel }} · {{ sizeLabel }}</em>
          </summary>
          <div class="fn-fold-body">
            <div class="fn-icon-row" role="group" aria-label="Tema">
              <button
                v-for="theme in themes"
                :key="theme.id"
                type="button"
                class="fn-icon-btn"
                :class="{ 'is-on': settings.theme === theme.id }"
                :aria-label="theme.label"
                :aria-pressed="settings.theme === theme.id"
                :title="theme.label"
                @click="settings.setTheme(theme.id)"
              >
                <ion-icon :icon="theme.icon" aria-hidden="true" />
              </button>
            </div>
            <label class="fn-slider">
              <ion-icon :icon="textOutline" aria-hidden="true" />
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                aria-label="Tamanho do texto da nota"
                :value="sizeIndex"
                @pointerdown.stop
                @input="onSize"
                @change="onSize"
              />
            </label>
            <p class="fn-size-sample">Aa</p>
          </div>
        </details>

        <div class="fn-line">
          <ion-icon :icon="notificationsOutline" aria-hidden="true" />
          <span>{{ reminderShort }}</span>
          <em>{{ alertShort }}</em>
        </div>

        <div class="fn-line">
          <SyncStatus />
          <em>{{ queueShort }}</em>
          <ion-icon
            :icon="sync.pending === 0 ? cloudDoneOutline : cloudOfflineOutline"
            :class="sync.pending === 0 ? 'is-ok' : 'is-wait'"
            aria-hidden="true"
          />
        </div>

        <div class="fn-line">
          <span>Dados</span>
          <div class="fn-icon-row">
            <button
              type="button"
              class="fn-icon-btn"
              aria-label="Exportar notas"
              title="Exportar notas"
              :disabled="exporting"
              @click="exportNotes"
            >
              <ion-icon :icon="downloadOutline" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="fn-icon-btn"
              aria-label="Limpar cache"
              title="Limpar cache"
              :disabled="clearingCache"
              @click="clearCache"
            >
              <ion-icon :icon="refreshOutline" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="fn-icon-btn is-danger"
              aria-label="Resetar notas"
              title="Resetar notas"
              :disabled="resetting"
              @click="resetAlertOpen = true"
            >
              <ion-icon :icon="trashOutline" aria-hidden="true" />
            </button>
          </div>
        </div>

        <p class="fn-about">FieldNotes 1.0.0</p>
      </div>
    </ion-content>

    <ion-modal :is-open="passwordModalOpen" @didDismiss="passwordModalOpen = false">
      <ion-content>
        <div class="fn-modal-body">
          <div class="fn-modal-bar">
            <button type="button" class="fn-icon-btn" aria-label="Fechar" @click="passwordModalOpen = false">
              <ion-icon :icon="closeOutline" aria-hidden="true" />
            </button>
            <strong>Senha</strong>
            <button
              type="button"
              class="fn-icon-btn"
              aria-label="Salvar senha"
              :disabled="passwordBusy"
              @click="changePassword"
            >
              <ion-icon :icon="checkmarkOutline" aria-hidden="true" />
            </button>
          </div>
          <div class="fn-pass-grid">
            <ion-input
              v-model="newPassword"
              label="Nova senha"
              label-placement="stacked"
              type="password"
              placeholder="Mínimo 6 caracteres"
            />
            <ion-input
              v-model="confirmPassword"
              label="Confirmar"
              label-placement="stacked"
              type="password"
              placeholder="Repita a senha"
            />
          </div>
          <p v-if="passwordError" class="fn-boot">{{ passwordError }}</p>
        </div>
      </ion-content>
    </ion-modal>

    <!-- Alert de Confirmação de Reset -->
    <ion-alert
      :is-open="resetAlertOpen"
      header="Resetar todas as notas?"
      message="Tem certeza de que deseja remover todas as notas deste aparelho? Esta ação não pode ser desfeita."
      :buttons="[
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Sim, resetar', role: 'destructive', handler: confirmResetAll }
      ]"
      @didDismiss="resetAlertOpen = false"
    />
  </ion-page>
</template>
