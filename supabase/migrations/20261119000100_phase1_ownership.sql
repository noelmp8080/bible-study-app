-- Phase 1, step 1 of 2: give every row an owner.
--
-- Safe to run at any time and more than once. It only adds nullable columns,
-- so the app keeps working exactly as before. New rows written by a signed-in
-- user are stamped with their id automatically (default auth.uid()).
--
-- Step 2 (…000900_phase1_lockdown.sql) closes the database. It is numbered
-- last because it must wait until the owner has signed in to the app once;
-- the files in between are additive and can be run straight away.

alter table public.notes       add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.highlights  add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.preferences add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.recordings  add column if not exists user_id uuid references auth.users(id) default auth.uid();

create index if not exists notes_user_id_idx       on public.notes (user_id);
create index if not exists highlights_user_id_idx  on public.highlights (user_id);
create index if not exists preferences_user_id_idx on public.preferences (user_id);
create index if not exists recordings_user_id_idx  on public.recordings (user_id);

-- Preferences become one row per user. (Rows without an owner do not conflict.)
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.preferences'::regclass and conname = 'preferences_user_key') then
    alter table public.preferences add constraint preferences_user_key unique (user_id);
  end if;
end $$;

-- New preference columns used by this version of the app.
alter table public.preferences
  add column if not exists current_verse integer,
  add column if not exists share_handle text;
