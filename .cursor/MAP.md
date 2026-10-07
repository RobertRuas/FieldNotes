# Mapa do FieldNotes

Alias `@` = `src/`. Offline-first: Vue 3 + Ionic + Pinia + Dexie, sync Supabase ou `sync-server/`.

Escrita: **view → store → Service (Dexie) → `enqueueWrite` → SyncService → supabaseGateway**. Foto, documento e áudio: `StorageService` + `src/sync/fileQueue.ts`.

A regra lê só **Onde ir** e para em `## Rotas`. Uma linha, um arquivo na coluna **Editar**.

## Onde ir

| Intenção | Editar | Extra | Não abrir |
|---|---|---|---|
| Home de notas, botão +, alternar calendário/lista | `src/views/notes/NotesHome.vue` (`createNote`, `toggleView`) | — | store, CalendarBoard |
| Grade do mês, dia marcado, seleção | `src/components/CalendarBoard.vue` | `src/utils/dates.ts` se o rótulo do dia estiver errado | NotesHome |
| Quais notas no dia, pin, modo lista/calendário | `src/stores/notesStore.ts` (`notesOn`, `pinnedNotes`, `viewMode`) | `src/utils/noteList.ts` se a linha virtual quebrar | views |
| Lupa, campo, lista de resultados, contagem | `src/views/notes/NotesHome.vue` (`isSearchOpen`, `searchQuery`, `searchResults`, `searchCountLabel`) | CSS `.fn-search-`, `.fn-search-count` | text.ts, store |
| Casar título ou conteúdo, destaque, trecho | `src/utils/text.ts` (`matchNote`, `highlightPlain`, `searchSnippet`) | `src/components/NoteCard.vue` prop `query` se o card não pintar o `<mark>` | NotesHome, AppHeader |
| Cor do termo achado | CSS `mark.fn-hit` | — | Vue, store |
| Título da barra some com a busca aberta | `src/components/AppHeader.vue` prop `searching` | CSS `.fn-appbar.is-searching` | NotesHome |
| Criar nota, autosave, sair, apagar | `src/views/notes/NoteEditor.vue` | `src/composables/useAutosave.ts` ou `src/utils/editorBackup.ts` só se o save falhar | RichTextEditor, store |
| Foco e teclado ao criar nota (`/nota/nova`) | `src/views/notes/NoteEditor.vue` (`isEditing`, `focusComposer`) | `src/components/RichTextEditor.vue` método `focus`; `primeKeyboard` em `src/composables/useKeyboardInset.ts` se o teclado não abrir no toque do `+` | store, CalendarBoard |
| Negrito, lista, link, colar | `src/components/RichTextEditor.vue` | `src/composables/editorContext.ts` se o comando não chegar; `src/utils/html.ts` se o HTML sujar | EditorToolbar, NoteEditor |
| Barra do editor (foto, áudio, tarefa, formato) | `src/components/EditorDock.vue` | `src/components/EditorToolbar.vue` só para o botão de formato | NoteEditor |
| Menu da nota (fixar, favorito, coleção, apagar) | `src/components/NoteMenu.vue` | — | NoteEditor |
| Definir lembrete da nota | `src/views/notes/NoteEditor.vue` (`reminderOpen`) | CSS `.fn-remind-sheet`, `.fn-remind-when` | NoteMenu, scheduler |
| Fotos | `src/components/NotePhotos.vue` | `src/services/platform/camera.ts` só se a captura falhar | attachmentsStore |
| Arquivos | `src/components/NoteFiles.vue` | `src/utils/files.ts` só para limite ou tipo | attachmentsStore |
| Áudio gravar, ouvir, apagar | `src/components/NoteAudio.vue` | `src/components/AudioClip.vue` para um clipe; `src/services/platform/recorder.ts` se a gravação falhar | audioStore |
| Leitura em voz | `src/services/platform/speech.ts` | — | views |
| Tarefas dentro da nota | `src/components/NoteTaskList.vue` | `src/components/TaskForm.vue` ou `TaskRow.vue` para o formulário ou a linha; `src/stores/tasksStore.ts` se não gravar | TasksView |
| Tela `/tarefas` | não há aba; `src/router/index.ts` redireciona para `/notas` | — | TasksView, a menos que a tela volte a existir |
| Lista de coleções | `src/views/collections/CollectionsView.vue` | `src/stores/collectionsStore.ts` se não gravar | CollectionDetail |
| Notas de uma coleção | `src/views/collections/CollectionDetail.vue` | — | CollectionsView |
| Login, sessão, sair | `src/views/auth/LoginView.vue` | `src/stores/authStore.ts` se a sessão não mudar; `src/services/AuthService.ts` se o Supabase falhar | SettingsView |
| Configurações: layout, seções, ícones | `src/views/settings/SettingsView.vue` | CSS `.fn-fold`, `.fn-line`, `.fn-settings` | settingsStore, theme.ts |
| Tema ou tamanho do texto não aplica | `src/utils/theme.ts` | `src/stores/settingsStore.ts` (`setTheme`, `setTextSize`) | SettingsView |
| Limpar cache | `src/utils/clearAppCache.ts` | — | SettingsView |
| Abas de baixo | `src/layouts/AppTabs.vue` | — | AppHeader |
| Barra superior compartilhada | `src/components/AppHeader.vue` | — | views, salvo a view que passa o slot |
| Toast | `src/composables/useToast.ts` | `src/App.vue` só se o toast não aparecer | views |
| Ícone de sync no card | `src/components/SyncMark.vue` | — | SyncService |
| Frase de sync na tela | `src/components/SyncStatus.vue` | `src/stores/syncStore.ts` (`phase`, `label`) se o texto vier errado | SyncService |
| Envio de arquivo na tela | `src/components/TransferLine.vue` | `src/sync/fileQueue.ts` se a fila não andar | supabase |
| Sync não envia ou não aplica registro | `src/services/SyncService.ts` | uma peça: `src/sync/queue.ts`, `apply.ts`, `merge.ts`, `parsers.ts` ou `engine.ts` | views, fileQueue |
| Upload ou download de arquivo | `src/sync/fileQueue.ts` | `src/services/StorageService.ts` se o blob local falhar | SyncService |
| URL, chave, bucket | `src/services/supabaseClient.ts` | `src/utils/env.ts` | gateway, views |
| Push/pull remoto | `src/services/supabaseGateway.ts` | — | SyncService |
| App não sobe | `src/utils/startup.ts` | `src/main.ts` se o mount nem chegar no startup | views |
| Rota ou guarda de login | `src/router/index.ts` (`safeNext`) | — | views |
| Forma de um campo (`Note`, `Task`, …) | `src/types/entities.ts` | — | services |
| Tabela IndexedDB | `src/database/db.ts` | — | services |
| RLS ou coluna no Postgres | `supabase/migrations/` a migration nova | — | app |
| API local tipo Supabase | `sync-server/app.py` | — | cliente Vue |
| Lembrete não dispara | `src/notifications/scheduler.ts` | `src/notifications/reminders.ts` ou `src/services/NotificationService.ts` | NotesHome |
| Rótulo de data | `src/utils/dates.ts` | — | views |
| Token de cor, espaço, fonte | `src/styles/tokens.css` | — | global.css |
| PWA, proxy, build | `vite.config.ts` | — | src |
| App nativo | `capacitor.config.ts` | `src/services/platform/nativeShell.ts` | views |

## Rotas

Referência. Não ler daqui para baixo para achar arquivo. **Onde ir** já diz qual abrir.

Definidas em `src/router/index.ts`. Sem sessão, qualquer rota cai em `/entrar?next=`.

| Rota | Nome | View |
|---|---|---|
| `/` | — | `src/layouts/AppTabs.vue` (abas: Notas, Coleções, Configurações) |
| `/notas` | `notas` | `src/views/notes/NotesHome.vue` |
| `/colecoes` | `colecoes` | `src/views/collections/CollectionsView.vue` |
| `/colecoes/:collectionId` | `colecao` | `src/views/collections/CollectionDetail.vue` |
| `/configuracoes` | `configuracoes` | `src/views/settings/SettingsView.vue` |
| `/entrar` | `entrar` | `src/views/auth/LoginView.vue` |
| `/nota/:noteId` | `editor` | `src/views/notes/NoteEditor.vue` (fora das abas) |
| `/tarefas` | — | redireciona para `/notas` |

`safeNext` (mesmo arquivo) só aceita caminho interno e nunca devolve `/entrar`.

## Busca de notas

Só na home de notas (`/notas`). A lupa fica em `NotesHome.vue`, ao lado do `+`. Aberta, o campo filtra `notes` já hidratadas — sem store, service nem rota nova.

`matchNote` em `src/utils/text.ts` compara título, texto plano do HTML e o carimbo da data, sem acento e sem caixa. Vários termos precisam aparecer todos. `searchSnippet` escolhe o trecho e `highlightPlain` envolve cada ocorrência em `<mark class="fn-hit">`. O card recebe `query`. O cabeçalho da lista mostra a contagem (`fn-search-count`). Com o campo vazio, calendário e lista seguem como estavam. Esc ou o fechar limpa a consulta e recolhe o campo. Estilo: classes `.fn-search-*` e `mark.fn-hit` em `src/styles/global.css`.

## Boot

`src/main.ts` `boot()`: `startup()` → `auth.markReady()` → `router.isReady()` → `mount` → service worker.

`src/utils/startup.ts`: abre Dexie, escuta sync, hidrata settings e auth, liga settings ao usuário, hidrata notes/tasks/collections/notifications/attachments/audio, `SyncService.start()`, shell nativo, lembretes, `pumpTransfers()`.

## Stores

UI fala com store. Store fala com service. Não grave no Dexie a partir da view.

| Store | Service | API pública |
|---|---|---|
| `useAuthStore` | `AuthService` | `user`, `userId`, `signedIn`, `whenReady`, `hydrate`, `signIn`, `signUp`, `signOut` |
| `useNotesStore` | `NoteService` | `notes`, `selectedDate`, `viewMode`, `listRows`, `pinnedNotes`, `notesOn`, `inCollection`, `hydrate`, `find`, `save`, `remove`, `setFlag`, `adoptSynced`, `setSelectedDate`, `toggleView` |
| `useTasksStore` | `TaskService` | `tasks`, `forNote`, `hydrate`, `add`, `save`, `toggle`, `remove` |
| `useCollectionsStore` | `CollectionService` | `items`, `ordered`, `hydrate`, `add`, `rename`, `remove` (desvincula notas e tarefas) |
| `useAttachmentsStore` | `AttachmentService` | `forNote`, `transferFor`, `hydrate`, `addPhoto`, `addFromNative`, `addDocument`, `remove`, `retry`, `originalUrl` |
| `useAudioStore` | `AudioService` | `forNote`, `transferFor`, `hydrate`, `addClip`, `remove`, `retry`, `clipUrl` |
| `useSettingsStore` | `SettingsService` | `theme`, `contentTextSize`, `hydrate`, `setTheme`, `setTextSize` |
| `useSyncStore` | `SyncService` | `phase`, `pending`, `label`, `bootError`, `listen`, `setBootError` |
| `useNotificationStore` | `NotificationService` | `items`, `hydrate` |
| `useDeviceStore` | `DeviceService` | `device`, `hydrate` |

## Services (persistência)

Todos gravam no Dexie e enfileiram sync, exceto onde indicado.

| Arquivo | Métodos | Tabela Dexie |
|---|---|---|
| `NoteService.ts` | `list`, `get`, `persist`, `restorePending` | `notes` |
| `TaskService.ts` | `list`, `persist` | `tasks` |
| `CollectionService.ts` | `list`, `persist` | `collections` |
| `AttachmentService.ts` | `list`, `listForNote`, `persist` | `attachments` |
| `AudioService.ts` | `list`, `listForNote`, `persist` | `audio_recordings` |
| `NotificationService.ts` | `list`, `persist`, `syncReminder`, `syncTaskReminder` | `notifications` |
| `SettingsService.ts` | `loadOrCreate`, `persist`, `bindUser` | `settings` |
| `AuthService.ts` | `current`, `configured`, `ensureLocalUser`, `restoreSession`, `signIn`, `signUp`, `signOut` | `users` + sessão Supabase |
| `DeviceService.ts` | `ensureDevice`, `rememberPushToken` | `devices` |
| `StorageService.ts` | `writeBlob`, `readBlob`, `removeBlob`, `writeBase64`, `readBase64`, `remove` | `local_files` + Filesystem nativo |
| `SyncService.ts` | `start`, `subscribe`, `onApplied`, `onMarked` | lê `sync_queue` |

## Sync

| Peça | Arquivo | Função |
|---|---|---|
| Fila de registros | `src/sync/queue.ts` | `enqueueWrite`, `countPendingOps`, `resetStuckOps`, `onQueueDirty` |
| Empurrar e puxar | `src/services/SyncService.ts` | loop interno `kick`: push da fila, pull, marca `synced` |
| Gateway | `src/services/supabaseGateway.ts` | `push`, `upsertRecord`, `pull` nas 9 tabelas |
| Aplicar remoto | `src/sync/apply.ts` | `applyRemoteRecord`, `markSyncedIfUnchanged` |
| Conflito | `src/sync/merge.ts` | `canApplyRemoteUpdate` (remoto só entra se for mais novo) |
| JSON camel/snake | `src/sync/parsers.ts` | `parseEntity`, `keysToCamel`, `keysToSnake` |
| Rótulo na UI | `src/sync/engine.ts` | `phaseFor`, `phaseLabel`, `backoffMs` |
| Fila de arquivos | `src/sync/fileQueue.ts` | `enqueueTransfer`, `pumpTransfers`, `uploadLocalFile`, `pullMissingFiles`, `retryTransfer`, `dropTransfer` |

Entidades sincronizadas (`SyncEntityName` em `src/types/entities.ts`): `users`, `notes`, `collections`, `tasks`, `attachments`, `audio_recordings`, `notifications`, `settings`, `devices`.

`FileTransfer` e `LocalFile` ficam só no aparelho.

## Componentes de UI

| Arquivo | Papel |
|---|---|
| `AppHeader.vue` | Barra superior reutilizada. Prop `searching` esconde o título no mobile enquanto o campo de busca está aberto |
| `NoteCard.vue` / `NoteListRow.vue` | Card do calendário e linha da lista. `NoteCard` aceita `query` e marca o trecho encontrado |
| `VirtualList.vue` | Janela virtual da lista de notas |
| `EmptyState.vue` | Estado vazio |
| `EditorDock.vue` | Ações do rodapé do editor |
| `RichTextEditor.vue` | `contenteditable`; expõe `EditorApi` via `editorKey` |
| `NotePhotos.vue` / `NoteFiles.vue` / `NoteAudio.vue` | Mídia da nota |
| `AudioClip.vue` | Um clipe: play, progresso, apagar |
| `NoteTaskList.vue` | Tarefas ligadas à nota aberta |
| `TaskForm.vue` / `TaskRow.vue` | Formulário e linha de tarefa |
| `NoteMenu.vue` | Ações da nota já salva |
| `CalendarBoard.vue` | Mês e seleção de dia |
| `SyncStatus.vue` / `SyncMark.vue` / `TransferLine.vue` | Fase do sync e envio de arquivo |

## Utilitários que importam

| Arquivo | Use quando |
|---|---|
| `src/utils/html.ts` | `sanitizeNoteHtml`, `htmlToPlain`, `plainToHtml`, `normalizeUrl` |
| `src/utils/text.ts` | título visível, preview, contagem, busca (`matchNote`, `searchSnippet`, `highlightPlain`) |
| `src/utils/dates.ts` | chaves `YYYY-MM-DD`, rótulos, lembrete |
| `src/utils/files.ts` | limite 30 MB, miniatura, tipo do documento |
| `src/utils/id.ts` | `createId` |
| `src/utils/editorBackup.ts` | rascunho do editor se o app fechar |
| `src/utils/clearAppCache.ts` | limpar cache do app |
| `src/utils/reloadWorkspace.ts` | recarregar stores depois de sync ou troca de conta |
| `src/utils/theme.ts` | tema e tamanho no `document` |
| `src/composables/useKeyboardInset.ts` | teclado virtual no editor; `primeKeyboard` ao criar nota |

## Plataforma

`src/services/platform/`: `camera.ts`, `recorder.ts`, `speech.ts`, `share.ts`, `haptics.ts`, `push.ts`, `preferences.ts`, `nativeShell.ts`. Cada um isola Capacitor. A web tem fallback no próprio arquivo.

## Remoto

- Env: `.env.example` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Sem isso, `isRemoteConfigured()` é falso e o app fica local.
- Bucket: `fieldnotes-files`.
- Proxy de dev: `vite.config.ts` encaminha `/auth`, `/rest`, `/storage`.
- Servidor local `sync-server/app.py`: `POST /auth/v1/signup`, `POST /auth/v1/token`, `POST /auth/v1/logout`, `GET /auth/v1/user`, REST em `/rest/v1/`, storage em `/storage/v1/object/fieldnotes-files/`. SQLite. Serviço: `sync-server/fieldnotes-sync.service`.

## Dexie

`src/database/db.ts`, banco `fieldnotes`, versão 3. Stores: `users`, `notes`, `collections`, `tasks`, `attachments`, `audio_recordings`, `notifications`, `settings`, `sync_queue`, `devices`, `local_files`, `file_queue`.
