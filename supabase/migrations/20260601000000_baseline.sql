-- Baseline: the schema as it was live before the November 2026 upgrade.
--
-- This replaces the old supabase/migrations.sql, which had fallen behind the
-- live database (it lacked four preference columns the app reads and writes).
-- Every statement is safe to run against the existing project: it creates
-- nothing that is already there and changes no data.
--
-- This Supabase project is shared with another app whose tables are prefixed
-- para_. Nothing in this folder reads, alters or drops a para_ object.

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  ref         text,
  text        text,
  tags        text[],
  has_audio   boolean default false,
  has_image   boolean default false,
  drawing     jsonb,
  created_at  timestamptz default now()
);

create table if not exists public.highlights (
  id          uuid primary key default gen_random_uuid(),
  book        text not null,
  chapter     integer not null,
  verse       integer not null,
  color       text not null,
  created_at  timestamptz default now(),
  unique (book, chapter, verse)
);

create table if not exists public.preferences (
  id          uuid primary key default gen_random_uuid(),
  theme       text default 'dark',
  font_size   integer default 16,
  updated_at  timestamptz default now()
);
-- The four columns the old migration file never created:
alter table public.preferences
  add column if not exists translation text default 'KJV',
  add column if not exists chapter_panel_collapsed boolean default false,
  add column if not exists current_book text,
  add column if not exists current_chapter integer;

create table if not exists public.recordings (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references public.notes(id) on delete cascade,
  label       text not null default '',
  audio_data  text not null,
  duration    integer not null default 0,
  mime_type   text not null default 'audio/webm',
  created_at  timestamptz not null default now()
);

alter table public.notes       enable row level security;
alter table public.highlights  enable row level security;
alter table public.preferences enable row level security;
alter table public.recordings  enable row level security;

-- Before the upgrade each table had one wide-open policy, "Allow all".
-- It is recreated here only on a database that has no policy at all on the
-- table (a fresh copy), so the history is complete; the Phase 1 lock-down
-- migration removes it. On the live project this block does nothing.
do $$
declare t text;
begin
  foreach t in array array['notes', 'highlights', 'preferences', 'recordings'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      execute format('create policy "Allow all" on public.%I for all using (true) with check (true)', t);
    end if;
  end loop;
end $$;
