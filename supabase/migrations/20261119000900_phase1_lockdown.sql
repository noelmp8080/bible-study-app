-- Phase 1, step 2 of 2: close the open database. Run this one last.
--
-- BEFORE RUNNING
--   1. Deploy the new app and sign in once with the owner's email, so that the
--      account exists in auth.users.
--   2. Put that email address in owner_email below.
--
-- What it does, in one transaction:
--   * gives every existing note, highlight, recording and the current
--     preferences row to the owner (nothing is deleted from those tables);
--   * replaces each "Allow all" policy with an owner-only policy for signed-in
--     users, so the anon key alone can no longer read or write anything;
--   * makes highlight uniqueness per user.
-- It can be run again safely. It touches only this app's four tables.

begin;

do $$
declare
  owner_email constant text := 'REPLACE_WITH_OWNER_EMAIL';
  owner_id uuid;
begin
  select id into owner_id from auth.users where lower(email) = lower(owner_email);
  if owner_id is null then
    raise exception 'No account found for "%". Sign in to the app once with the owner''s email, set owner_email in this file, then run it again.', owner_email;
  end if;

  update public.notes      set user_id = owner_id where user_id is null;
  update public.highlights set user_id = owner_id where user_id is null;
  update public.recordings set user_id = owner_id where user_id is null;

  -- Preferences used to be one shared row (plus, possibly, older stray rows).
  -- The most recently updated un-owned row becomes the owner's, unless they
  -- already have one. Any other un-owned rows are copied to a backup table
  -- before being removed, so no setting is lost.
  if not exists (select 1 from public.preferences where user_id = owner_id) then
    update public.preferences set user_id = owner_id
    where id = (select id from public.preferences where user_id is null order by updated_at desc nulls last limit 1);
  end if;
  if exists (select 1 from public.preferences where user_id is null) then
    execute 'create table if not exists public.preferences_pre_auth_backup (like public.preferences)';
    execute 'alter table public.preferences_pre_auth_backup enable row level security'; -- no policies: not reachable from the app
    execute 'insert into public.preferences_pre_auth_backup select * from public.preferences where user_id is null';
    delete from public.preferences where user_id is null;
  end if;
end $$;

alter table public.notes       alter column user_id set not null;
alter table public.highlights  alter column user_id set not null;
alter table public.preferences alter column user_id set not null;
alter table public.recordings  alter column user_id set not null;

-- Highlights: one per verse per user. The old constraint was on
-- (book, chapter, verse) alone; find it by its columns rather than by name.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.highlights'::regclass and con.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname::text)
           from unnest(con.conkey) k join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k)
          = array['book', 'chapter', 'verse']
  loop
    execute format('alter table public.highlights drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conrelid = 'public.highlights'::regclass and conname = 'highlights_user_verse_key') then
    alter table public.highlights add constraint highlights_user_verse_key unique (user_id, book, chapter, verse);
  end if;
end $$;

-- Owner-only access for signed-in users; nothing for anyone else.
do $$
declare t text;
begin
  foreach t in array array['notes', 'highlights', 'preferences', 'recordings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Allow all" on public.%I', t);
    execute format('drop policy if exists "owner" on public.%I', t);
    execute format(
      'create policy "owner" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

commit;
