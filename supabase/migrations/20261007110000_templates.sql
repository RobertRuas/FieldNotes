-- Modelos de nota. O cliente grava offline e envia a linha inteira.

create table if not exists public.templates (
  id text primary key,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_status text not null default 'synced',
  user_id text not null,
  name text not null,
  content text not null default '',
  variables jsonb not null default '[]'::jsonb,
  favorite boolean not null default false,
  last_used_at timestamptz,
  last_values jsonb not null default '[]'::jsonb,
  custom_order boolean not null default false
);

create index if not exists templates_user_updated_idx on public.templates (user_id, updated_at);

alter table public.templates enable row level security;

drop policy if exists templates_own on public.templates;
create policy templates_own on public.templates
  for all to authenticated
  using (public.owns_local_user(user_id))
  with check (public.owns_local_user(user_id));

grant select, insert, update, delete on public.templates to authenticated;
