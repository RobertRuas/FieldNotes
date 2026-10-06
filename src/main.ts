import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { IonicVue } from '@ionic/vue';
import { registerSW } from 'virtual:pwa-register';
import App from './App.vue';
import router from './router';
import { useSyncStore } from './stores/syncStore';
import { startup } from './utils/startup';
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';
import '@ionic/vue/css/palettes/dark.class.css';
import './styles/tokens.css';
import './styles/ionic-overrides.css';
import './styles/global.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(IonicVue, { mode: 'ios' });
app.use(router);

async function boot(): Promise<void> {
  try {
    await startup();
  } catch {
    useSyncStore().setBootError('Não foi possível abrir as notas neste aparelho.');
  }
  await router.isReady();
  app.mount('#app');
  registerSW({ immediate: true });
}

void boot();
