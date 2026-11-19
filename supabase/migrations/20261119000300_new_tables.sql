-- Phases 3 to 9: new columns and tables for the reader, plans, memory verses,
-- saved AI conversations, sermon mode and threads.
--
-- Additive and safe to run more than once. Every table has row level security
-- with an owner-only policy for signed-in users. Until this file has been run,
-- the app keeps these features working on each device and syncs them later.
--
-- Book names in every table are the app's canonical names ("Psalms",
-- "Song of Solomon", "1 Samuel"…), as the existing highlight rows use.

-- ── Phase 3: notes link to a verse range; bookmarks ─────────────────────────
alter table public.notes
  add column if not exists book text,
  add column if not exists chapter integer,
  add column if not exists verse_start integer,
  add column if not exists verse_end integer,
  add column if not exists updated_at timestamptz default now();
create index if not exists notes_passage_idx on public.notes (user_id, book, chapter);

create table if not exists public.bookmarks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  book       text not null,
  chapter    integer not null,
  verse      integer,                                   -- null = the whole chapter
  created_at timestamptz not null default now()
);
-- One bookmark per verse (or per chapter) per user. A plain unique constraint
-- would not stop duplicate chapter bookmarks, because NULLs never conflict.
create unique index if not exists bookmarks_user_place_key on public.bookmarks (user_id, book, chapter, coalesce(verse, 0));

-- ── Phase 5: reading progress, plans, memory verses ─────────────────────────
create table if not exists public.reading_progress (
  user_id uuid not null default auth.uid() references auth.users(id),
  book    text not null,
  chapter integer not null,
  read_at timestamptz not null default now(),
  primary key (user_id, book, chapter)
);

create table if not exists public.user_plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id),
  household_id    uuid,                                 -- set for a plan shared by a household (Phase 10)
  plan_key        text not null,                        -- key of a JSON plan in the repo, or 'custom'
  custom_readings jsonb,                                -- [[{book, chapter}, …] per day]
  started_on      date not null default current_date,
  active          boolean not null default true
);
create index if not exists user_plans_user_idx on public.user_plans (user_id);

create table if not exists public.memory_verses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id),
  book          text not null,
  chapter       integer not null,
  verse_start   integer not null,
  verse_end     integer not null,
  translation   text not null,
  interval_days integer not null default 0,
  due_at        timestamptz not null default now(),
  last_result   text,                                   -- 'shaky' | 'got_it' | 'by_heart'
  created_at    timestamptz not null default now()
);
create index if not exists memory_verses_due_idx on public.memory_verses (user_id, due_at);

-- ── Phase 6: saved AI conversations ─────────────────────────────────────────
create table if not exists public.ai_threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id),
  title       text,
  context_ref text,                                     -- JSON: the passage the conversation is about
  created_at  timestamptz not null default now()
);
create index if not exists ai_threads_user_idx on public.ai_threads (user_id);

create table if not exists public.ai_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.ai_threads(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id),
  role       text not null,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_thread_idx on public.ai_messages (thread_id);
create index if not exists ai_messages_user_idx on public.ai_messages (user_id);

-- ── Phase 7: sermon mode ────────────────────────────────────────────────────
-- A transcript column can be added to sermon_sessions later without other changes.
create table if not exists public.sermon_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id),
  title            text,
  started_at       timestamptz not null default now(),
  duration_seconds integer,
  audio_path       text,                                -- object in the bsa-recordings bucket
  mime_type        text,
  note_id          uuid references public.notes(id) on delete set null
);
create index if not exists sermon_sessions_user_idx on public.sermon_sessions (user_id);

create table if not exists public.sermon_pins (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.sermon_sessions(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id),
  offset_seconds integer not null,
  kind           text not null,                         -- 'ref' | 'note' | 'mark'
  book           text,
  chapter        integer,
  verse_start    integer,
  verse_end      integer,
  body           text
);
create index if not exists sermon_pins_session_idx on public.sermon_pins (session_id);
create index if not exists sermon_pins_user_idx on public.sermon_pins (user_id);

-- ── Phase 9: threads ────────────────────────────────────────────────────────
create table if not exists public.threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id),
  title      text not null,
  created_at timestamptz not null default now()
);
create index if not exists threads_user_idx on public.threads (user_id);

create table if not exists public.thread_links (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.threads(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id),
  position    integer not null,
  label       text,
  book        text not null,
  chapter     integer not null,
  verse_start integer not null,
  verse_end   integer not null
);
create index if not exists thread_links_thread_idx on public.thread_links (thread_id);
create index if not exists thread_links_user_idx on public.thread_links (user_id);

-- ── Row level security: owner only ──────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['bookmarks', 'reading_progress', 'user_plans', 'memory_verses', 'ai_threads', 'ai_messages',
                           'sermon_sessions', 'sermon_pins', 'threads', 'thread_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner" on public.%I', t);
    execute format(
      'create policy "owner" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
