-- FieldNotes: tabelas que o cliente já envia, RLS por conta e bucket dos arquivos.
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
-- A service role não entra no app. O cliente usa só a anon key, com sessão.

create or replace function public.owns_local_user(local_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where users.id = local_user_id
      and users.remote_id = auth.uid()::text
      and users.deleted_at is null
  );
$$;

revoke all on function public.owns_local_user(text) from public;
grant execute on function public.owns_local_user(text) to authenticated;

create table if not exists public.users (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_status text not null default 'synced',
  email text,
  display_name text,
  remote_id text
);

create table if not exists public.notes (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_status text not null default 'synced',
  user_id text not null,
  title text not null default '',
  text text not null default '',
  date text not null,
  collection_id text,
  reminder_at timestamptz,
  attachments jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  audio jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb
);

create table if not exists public.collections (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_status text not null default 'synced',
  user_id text not null,
  name text not null,
  color text not null
);

create table if not exists public.tasks (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_status text not null default 'synced',
  user_id text not null,
  note_id text,
  collection_id text,
  title text not null,
  detail text not null default '',
  done boolean not null default false,
  date text,
  time text,
  priority text,
  reminder_at timestamptz,
  due_at timestamptz,
  constraint tasks_priority_check check (priority is null or priority in ('baixa', 'normal', 'alta'))
);

create table if not exists public.attachments (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_status text not null default 'synced',
  user_id text not null,
  note_id text not null,
  kind text not null,
  name text not null,
  mime_type text not null,
  size bigint not null,
  local_uri text,
  remote_path text,
  thumbnail text,
  constraint attachments_kind_check check (kind in ('photo', 'document', 'file'))
);

create table if not exists public.audio_recordings (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_status text not null default 'synced',
  user_id text not null,
  note_id text not null,
  duration_ms integer not null,
  mime_type text not null,
  local_uri text,
  remote_path text
);

create table if not exists public.notifications (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_status text not null default 'synced',
  user_id text not null,
  kind text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  note_id text,
  fire_at timestamptz,
  constraint notifications_kind_check check (kind in ('reminder', 'sync', 'system'))
);

create table if not exists public.settings (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_status text not null default 'synced',
  user_id text,
  theme text not null,
  content_text_size text not null,
  constraint settings_theme_check check (theme in ('light', 'dark', 'auto')),
  constraint settings_size_check check (content_text_size in ('pequeno', 'normal', 'grande', 'muito-grande'))
);

create table if not exists public.devices (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_status text not null default 'synced',
  user_id text not null,
  name text not null,
  platform text not null,
  push_token text,
  constraint devices_platform_check check (platform in ('web', 'ios', 'android'))
);

create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at);
create index if not exists collections_user_updated_idx on public.collections (user_id, updated_at);
create index if not exists tasks_user_updated_idx on public.tasks (user_id, updated_at);
create index if not exists attachments_user_updated_idx on public.attachments (user_id, updated_at);
create index if not exists audio_user_updated_idx on public.audio_recordings (user_id, updated_at);
create index if not exists notifications_user_updated_idx on public.notifications (user_id, updated_at);
create index if not exists devices_user_updated_idx on public.devices (user_id, updated_at);
create index if not exists users_remote_idx on public.users (remote_id);

alter table public.users enable row level security;
alter table public.notes enable row level security;
alter table public.collections enable row level security;
alter table public.tasks enable row level security;
alter table public.attachments enable row level security;
alter table public.audio_recordings enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;
alter table public.devices enable row level security;

drop policy if exists users_own on public.users;
create policy users_own on public.users
  for all to authenticated
  using (remote_id = auth.uid()::text)
  with check (remote_id = auth.uid()::text);

drop policy if exists notes_own on public.notes;
create policy notes_own on public.notes
  for all to authenticated
  using (public.owns_local_user(user_id))
  with check (public.owns_local_user(user_id));

drop policy if exists collections_own on public.collections;
create policy collections_own on public.collections
  for all to authenticated
  using (public.owns_local_user(user_id))
  with check (public.owns_local_user(user_id));

drop policy if exists tasks_own on public.tasks;
create policy tasks_own on public.tasks
  for all to authenticated
  using (public.owns_local_user(user_id))
  with check (public.owns_local_user(user_id));

drop policy if exists attachments_own on public.attachments;
create policy attachments_own on public.attachments
  for all to authenticated
  using (public.owns_local_user(user_id))
  with check (public.owns_local_user(user_id));

drop policy if exists audio_own on public.audio_recordings;
create policy audio_own on public.audio_recordings
  for all to authenticated
  using (public.owns_local_user(user_id))
  with check (public.owns_local_user(user_id));

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for all to authenticated
  using (public.owns_local_user(user_id))
  with check (public.owns_local_user(user_id));

drop policy if exists settings_own on public.settings;
create policy settings_own on public.settings
  for all to authenticated
  using (user_id is not null and public.owns_local_user(user_id))
  with check (user_id is not null and public.owns_local_user(user_id));

drop policy if exists devices_own on public.devices;
create policy devices_own on public.devices
  for all to authenticated
  using (public.owns_local_user(user_id))
  with check (public.owns_local_user(user_id));

grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.attachments to authenticated;
grant select, insert, update, delete on public.audio_recordings to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant select, insert, update, delete on public.devices to authenticated;

insert into storage.buckets (id, name, public)
values ('fieldnotes-files', 'fieldnotes-files', false)
on conflict (id) do nothing;

drop policy if exists fieldnotes_files_read on storage.objects;
create policy fieldnotes_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fieldnotes-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists fieldnotes_files_insert on storage.objects;
create policy fieldnotes_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fieldnotes-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists fieldnotes_files_update on storage.objects;
create policy fieldnotes_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fieldnotes-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'fieldnotes-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists fieldnotes_files_delete on storage.objects;
create policy fieldnotes_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fieldnotes-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
