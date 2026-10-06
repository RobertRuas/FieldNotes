import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/AppTabs.vue'),
    children: [
      { path: '', redirect: '/notas' },
      { path: 'notas', name: 'notas', component: () => import('@/views/notes/NotesHome.vue') },
      { path: 'tarefas', name: 'tarefas', component: () => import('@/views/tasks/TasksView.vue') },
      { path: 'colecoes', name: 'colecoes', component: () => import('@/views/collections/CollectionsView.vue') },
      { path: 'configuracoes', name: 'configuracoes', component: () => import('@/views/settings/SettingsView.vue') },
    ],
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

export default router;
