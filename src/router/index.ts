import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/AppTabs.vue'),
    children: [
      { path: '', redirect: '/notas' },
      { path: 'notas', name: 'notas', component: () => import('@/views/notes/NotesHome.vue') },
      { path: 'tarefas', redirect: '/notas' },
      { path: 'colecoes', name: 'colecoes', component: () => import('@/views/collections/CollectionsView.vue') },
      { path: 'colecoes/:collectionId', name: 'colecao', component: () => import('@/views/collections/CollectionDetail.vue') },
      { path: 'configuracoes', name: 'configuracoes', component: () => import('@/views/settings/SettingsView.vue') },
    ],
  },
  {
    path: '/entrar',
    name: 'entrar',
    component: () => import('@/views/auth/LoginView.vue'),
  },
  {
    path: '/nota/:noteId',
    name: 'editor',
    component: () => import('@/views/notes/NoteEditor.vue'),
  },
  { path: '/:pathMatch(.*)*', redirect: '/notas' },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

function safeNext(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/notas';
  if (value === '/entrar' || value.startsWith('/entrar?')) return '/notas';
  return value;
}

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.whenReady();
  if (to.name === 'entrar') {
    if (auth.signedIn) return safeNext(to.query.next);
    return true;
  }
  if (!auth.signedIn) {
    return { name: 'entrar', query: { next: to.fullPath } };
  }
  return true;
});

export { safeNext };
export default router;
