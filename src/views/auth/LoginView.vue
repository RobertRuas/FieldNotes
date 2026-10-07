<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonContent, IonPage } from '@ionic/vue';
import { useAuthStore } from '@/stores/authStore';
import { reloadWorkspace } from '@/utils/reloadWorkspace';
import { safeNext } from '@/router';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const email = ref('');
const password = ref('');
const message = ref('');
const busy = ref(false);

async function enter(): Promise<void> {
  if (busy.value) return;
  const address = email.value.trim();
  if (!address.includes('@') || password.value.length < 6) {
    message.value = 'Informe o e-mail e a senha.';
    return;
  }
  busy.value = true;
  message.value = '';
  try {
    const result = await auth.signIn(address, password.value);
    if (!result.ok) {
      message.value = result.reason;
      return;
    }
    await reloadWorkspace();
    await router.replace(safeNext(route.query.next));
  } catch (error) {
    message.value = error instanceof Error ? error.message : 'Não foi possível entrar.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <ion-page>
    <ion-content class="fn-login-scroll" :fullscreen="false">
      <main class="fn-login">
        <img class="fn-login-mark" src="/favicon.svg" alt="" />
        <h1>FieldNotes</h1>
        <p>Entre para abrir as notas neste aparelho.</p>
        <form class="fn-login-form" @submit.prevent="enter">
          <label>
            E-mail
            <input v-model="email" type="email" name="email" autocomplete="username" inputmode="email" required />
          </label>
          <label>
            Senha
            <input v-model="password" type="password" name="password" autocomplete="current-password" required />
          </label>
          <p v-if="message" class="fn-login-error" role="alert">{{ message }}</p>
          <button type="submit" :disabled="busy">{{ busy ? 'A entrar…' : 'Entrar' }}</button>
        </form>
      </main>
    </ion-content>
  </ion-page>
</template>
