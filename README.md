# FieldNotes

Notas de campo no aparelho, mesmo sem rede. O calendário da semana abre em primeiro. Notas, coleções e tarefas são gravadas no IndexedDB e a interface não espera a nuvem.

## Requisitos

- Node.js 20.19 ou mais recente
- npm

## Instalação

```bash
npm install
```

Opcional: copie `.env.example` para `.env` quando houver um projeto Supabase. Sem essas chaves o app continua em modo local. Não coloque a service role no cliente.

```bash
cp .env.example .env
```

## Desenvolvimento

```bash
npm run dev
```

Abra o endereço que o Vite mostrar (em geral `http://localhost:5173`). O service worker também sobe no dev, para o app poder abrir de novo sem rede depois do primeiro carregamento.

## Build

```bash
npm run typecheck
npm run build
npm run preview
```

`npm run build` gera `dist/` com o app shell, o manifest e o service worker. Para instalar: abra o preview no navegador, use “Instalar app” e, em seguida, desligue a rede e reabra.

## O que funciona offline

- Abrir o app depois do primeiro carregamento (service worker com cache do app shell)
- Criar, editar e apagar notas
- Coleções: criar, renomear e apagar. A coleção sai da lista; as notas e tarefas continuam, só sem esse vínculo. Uma nota cabe em uma coleção, e a coleção nunca é obrigatória
- Tarefas com data, hora, prioridade e lembrete guardado. A mesma tarefa aparece na nota e na aba Tarefas. Concluir é imediato neste aparelho. O horário do lembrete fica gravado; o aviso do sistema ainda não é enviado
- A nota aparece na hora; um debounce grava no IndexedDB e uma cópia imediata cobre o caso de fechar o app no meio da digitação
- Calendário semanal (SEG–DOM), expansão do mês e lista por data
- Tema claro, escuro ou automático, e tamanho do texto só do conteúdo da nota
- Fila `sync_queue`: cada escrita local entra na fila. Sem rede, ou sem Supabase, nada é bloqueado e nada é perdido

Fluxo: interface → Pinia → serviços → IndexedDB → fila de sincronização → Supabase (só se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` existirem). A interface não importa Supabase.

Estados discretos: **Online/Sincronizado**, **Offline — alterações salvas neste dispositivo**, **Sincronizando…**. Com nuvem configurada e itens ainda na fila, aparece **Online — alterações salvas neste dispositivo**.

## Capacitor

O mesmo build da PWA é o app. Plugins preparados: Camera, Filesystem, Push Notifications, Haptics, Preferences, Share, Status Bar e Splash Screen. As pastas `ios/` e `android/` não são geradas nesta fase — não há um segundo app iOS.

## Próxima fase

- Fotos, documentos e áudio
- Sincronização de verdade com Supabase: esquema, RLS, autenticação, envio da fila e pull entre aparelhos
- Permissão de push e lembretes do sistema
- Projeto nativo Capacitor usando este `dist/`
