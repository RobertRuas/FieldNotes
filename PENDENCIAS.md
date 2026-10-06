# O que ainda falta

Este arquivo é o ponto de partida para continuar o FieldNotes na máquina local. O app das fases 1, 2 e 3 já está neste branch. A `main` do GitHub ainda só tem o commit inicial.

## Onde continuar

- Repositório: https://github.com/RobertRuas/FieldNotes
- Branch: `cursor/fieldnotes-phase-1-71b5`
- Último commit desta entrega: `7783993` — fotos, documentos e áudio offline, e o rótulo único da coleção
- Pull request rascunho: https://github.com/RobertRuas/FieldNotes/pull/1

Na máquina local:

```bash
git clone https://github.com/RobertRuas/FieldNotes.git
cd FieldNotes
git fetch origin cursor/fieldnotes-phase-1-71b5
git checkout cursor/fieldnotes-phase-1-71b5
npm install
npm run dev
```

O Vite abre em geral em `http://localhost:5173`. Sem `.env` o app roda só neste aparelho. Copie `.env.example` para `.env` só quando existir um projeto Supabase. A única chave de cliente permitida é a anon key. A service role não entra no app.

Conferir o que já está pronto:

```bash
npm run typecheck
npm run build
```

## O que já está pronto

Fase 1. PWA offline-first (Ionic Vue, Pinia, Dexie `fieldnotes`, Vite PWA, Capacitor preparado). Notas com calendário da semana, editor, autosave e fila `sync_queue`. A interface grava no IndexedDB primeiro e não espera a rede.

Fase 2. Coleções e tarefas de verdade. Uma nota cabe em uma coleção, que nunca é obrigatória. Apagar coleção é exclusão lógica e tira o vínculo das notas e tarefas. A mesma tarefa da nota aparece na aba Tarefas. Concluir é local e imediato. O lembrete da tarefa fica gravado e não vira aviso do sistema. Exemplos de coleção (Trabalho, Pessoal, Projetos, Viagens, Ideias) só existem na tela vazia e só viram coleção ao toque.

Fase 3. Fotos, documentos e áudio na nota.

- Foto: tirar ou escolher. Várias por nota. Na PWA o input do navegador; no app nativo o plugin de câmera (`src/services/platform/camera.ts`).
- Documento: seletor de arquivos. Na PWA o blob fica em `local_files`. No nativo o original vai para o Filesystem (`fs:`).
- Áudio: segurar para gravar e toque para começar ou parar. MediaRecorder. Player com ouvir, pausar, progresso, duração e excluir.
- A lista usa miniatura (`Attachment.thumbnail`, no máximo 320 px). O original abre no visualizador.
- A fila do arquivo é a tabela `file_queue`, separada do `syncStatus`. Estados visíveis: Aguardando, Sincronizando, Sincronizado, Erro. Erro tem Tentar de novo.
- Sem upload real o estado fica **Aguardando · Salvo neste dispositivo**. `uploadLocalFile` em `src/sync/fileQueue.ts` devolve `null` de propósito. Sincronizado só acontece se essa função devolver um caminho remoto e `markUploaded` gravar `remotePath`.

O formulário de criar coleção mostra **Nome da coleção** uma vez (`label` + `v-aria`). O placeholder igual foi removido.

Verificado neste branch: `vue-tsc`, `npm run build`, e um Chrome headless com microfone falso. Nesse teste a coleção foi criada pelo campo, a nota recebeu uma foto e um `.txt`, gravou um áudio curto, recarregou com título, arquivo e áudio, abriu o original da foto e carregou o player. Um registro forçado para Erro mostrou Tentar de novo e voltou a Aguardando. Não há vídeo dessa passagem. O vídeo em artefatos da fase 2 (`colecoes-e-tarefas`) não cobre fotos, documentos nem áudio.

## Próximo trabalho, nesta ordem

### 1. Supabase de verdade

Ainda não existe esquema, RLS, login nem bucket. O cliente em `src/services/supabaseGateway.ts` já faz upsert e pull por `updated_at` quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` existem. Sem as tabelas essa chamada falha e a fila local fica com erro, sem apagar o dado do aparelho.

Criar no Supabase as tabelas que o gateway já lista: `users`, `notes`, `collections`, `tasks`, `attachments`, `audio_recordings`, `notifications`, `settings`, `devices`. Colunas em snake_case. O parser em `src/sync/parsers.ts` é o contrato: se um campo obrigatório vier inválido, a linha remota é ignorada.

Cada registro leva `id`, `created_at`, `updated_at`, `deleted_at`, `sync_status`. Campos de negócio:

- users: `email`, `display_name`, `remote_id`
- notes: `user_id`, `title`, `text`, `date`, `collection_id`, `reminder_at`, e os arrays `attachments`, `photos`, `documents`, `audio`, `tasks`
- collections: `user_id`, `name`, `color`
- tasks: `user_id`, `note_id`, `collection_id`, `title`, `detail`, `done`, `date`, `time`, `priority` (`baixa` | `normal` | `alta`), `reminder_at`, `due_at`
- attachments: `user_id`, `note_id`, `kind` (`photo` | `document` | `file`), `name`, `mime_type`, `size`, `local_uri`, `remote_path`, `thumbnail`
- audio_recordings: `user_id`, `note_id`, `duration_ms`, `mime_type`, `local_uri`, `remote_path`
- notifications: `user_id`, `kind`, `title`, `body`, `read_at`, `note_id`, `fire_at`
- settings: `theme`, `content_text_size`
- devices: `user_id`, `name`, `platform`, `push_token`

RLS: cada pessoa só lê e escreve as próprias linhas. A exclusão continua lógica (`deleted_at`). Não usar a service role no cliente.

`sync_queue`, `local_files` e `file_queue` ficam só no aparelho. O blob original não sobe dentro da linha de `attachments`.

O pull já existe em `SyncService.pullRemote`. A regra em `src/sync/merge.ts` precisa continuar valendo: uma alteração local ainda não enviada não é substituída pelo remoto. O critério de conflito é `updatedAt`, e um registro com `syncStatus` pendente no aparelho ganha da nuvem.

`enqueueWrite` em `src/sync/queue.ts` junta operações pendentes ou falhas da mesma entidade e força `syncStatus: 'pending'`. Por isso um upload concluído não pode passar por `enqueueWrite`. `markUploaded` grava a tabela direto com `remotePath` e `syncStatus: 'synced'`.

### 2. Autenticação

`AuthService.signIn` devolve `{ ok: false, reason: 'pendente' }`. Hoje o app cria um usuário local "Neste aparelho" e guarda o id em Preferences (`fieldnotes.userId`). A tela Configurações diz que a entrada na conta chega numa próxima versão.

Falta a tela de entrada, a sessão do Supabase e o vínculo `users.remote_id` com o usuário autenticado. Trocar de conta não pode misturar notas de outra pessoa nem apagar a fila local no meio de um envio. O app continua abrindo sem rede com a última sessão já gravada neste aparelho.

### 3. Upload dos arquivos

`uploadLocalFile` precisa ler o blob (`StorageService.readBlob`: `local:` no IndexedDB, `fs:` no Filesystem), enviar para um bucket e devolver o caminho remoto. `null` mantém Aguardando. Exceção na hora do envio, com a nuvem configurada, marca Erro e libera Tentar de novo. Sem rede o editor não espera.

A miniatura pode continuar no registro. O original não entra de novo na lista. Tamanho máximo atual: 30 MB (`src/utils/files.ts`).

### 4. Aviso do sistema

O horário do lembrete da nota vira uma linha em `notifications` (`NotificationService.syncReminder`). O da tarefa só fica em `tasks.reminderAt`. Nenhum dos dois pede permissão nem agenda notificação. `preparePush` devolve `deferred` ou `unsupported` e não chama `requestPermission`.

Falta pedir a permissão no momento certo, agendar e cancelar o aviso quando o lembrete muda ou a nota ou tarefa é apagada, e no app nativo guardar o token em `devices.push_token`. O texto da interface só pode dizer que o aviso foi agendado depois que isso existir. Hoje as frases em Configurações, no formulário da tarefa e na seção de lembretes dizem o contrário de propósito.

### 5. Projeto nativo

Não há pastas `ios/` nem `android/`. `capacitor.config.ts` já aponta `webDir` para `dist` e o `appId` é `app.fieldnotes.pwa`. Os plugins estão no `package.json` (Camera, Filesystem, Push, Haptics, Preferences, Share, Status Bar, Splash).

Quando for a hora: `npm run build` e então `npx cap add` da plataforma. A mesma interface da PWA. Câmera e Filesystem já desviam com `Capacitor.isNativePlatform()`. Vibração (`src/services/platform/haptics.ts`) só importa o plugin no aparelho nativo. Não criar um segundo app iOS à parte.

## Armadilhas já encontradas

- Em `vite.config.ts`, todo `node_modules` vai para o chunk `vendor`. Separar o Ionic do resto já deixou a produção em branco (`TypeError: e is not a function`).
- `NoteService.cleanNote` copia os arrays da nota antes do IndexedDB. Um proxy reativo do Vue não é clonável e a gravação falha com `DataCloneError`.
- O editor em `/nota/:id` fica fora das abas. A barra de abas só volta depois do botão Notas.
- Componentes Ionic não repassam `aria-*`. O acessível passa por `v-aria` (`src/utils/aria.ts`).
- `ion-input` no Ionic 9 é light DOM. Um `CustomEvent` de `ionInput` não atualiza o Vue. O valor entra pelo input nativo com `InputEvent`.
- Não repetir o mesmo texto no `label` e no `placeholder`. Foi o que duplicou "Nome da coleção".
- O autosave não pode dar `await` em `router.replace` dentro do fluxo que também espera a saída da rota. O replace da nota nova é `void router.replace`.
- Dexie versão 3 só declara `local_files` e `file_queue`. As stores antigas continuam. Uma versão nova que redeclare uma store sem os índices apaga índice.
- A conclusão da tarefa é o campo `done`. O checklist do editor abre a tarefa de verdade, não uma lista HTML.
