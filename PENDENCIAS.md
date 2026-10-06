# Ligar a nuvem

O app local está fechado: notas, coleções, tarefas, arquivos, conta, upload, lembretes e o mesmo build para o Capacitor.

O que só você pode fazer, porque depende da sua conta Supabase:

- [ ] Criar um projeto em https://supabase.com
- [ ] Rodar `supabase/migrations/20261006150000_fieldnotes.sql` no SQL Editor
- [ ] Copiar `.env.example` para `.env` e preencher `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [ ] Reiniciar `npm run dev` e entrar em Configurações
- [x] Pastas `ios/` e `android/` geradas nesta máquina (o `.gitignore` não as versiona)

Sem `.env` o FieldNotes continua só neste aparelho. A service role não entra no cliente.
