alter table public.notes add column if not exists pinned boolean not null default false;
alter table public.notes add column if not exists favorite boolean not null default false;

alter table public.settings drop constraint if exists settings_size_check;
alter table public.settings add constraint settings_size_check
  check (content_text_size in ('minimo', 'pequeno', 'normal', 'grande', 'muito-grande'));
