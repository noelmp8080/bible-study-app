-- Phase 10: family table. Run after …000300_new_tables.sql.
--
-- A household is created by one user, who invites others by email. Access is
-- by membership, not ownership: members see the household, its members, its
-- shared plan and its questions, and whether each member has read a day of
-- the shared plan. Nobody can read another member's notes, highlights or
-- reading progress rows; the read status comes from a function that returns
-- one true/false per member and nothing else.
--
-- Additive and safe to run more than once.

create table if not exists public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid not null default auth.uid() references auth.users(id)
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  display_name text not null,
  role         text not null default 'member',          -- 'owner' | 'member'
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members (user_id);

create table if not exists public.household_invites (
  household_id uuid not null references public.households(id) on delete cascade,
  email        text not null,                           -- stored lower-case
  invited_by   uuid not null default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now(),
  primary key (household_id, email)
);

create table if not exists public.household_questions (
  household_id uuid not null references public.households(id) on delete cascade,
  passage      text not null,
  day          date not null,
  questions    jsonb not null,                          -- { little_ones, teens, adults }
  primary key (household_id, passage, day)
);

-- A shared plan is a user_plans row with household_id set.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.user_plans'::regclass and conname = 'user_plans_household_fkey') then
    alter table public.user_plans add constraint user_plans_household_fkey
      foreign key (household_id) references public.households(id) on delete set null;
  end if;
end $$;
create index if not exists user_plans_household_idx on public.user_plans (household_id);

-- ── Membership helpers ──────────────────────────────────────────────────────
-- SECURITY DEFINER with a fixed search_path, so that policies on
-- household_members can ask "is the caller a member?" without recursing.
create or replace function public.is_household_member(p_household uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members m where m.household_id = p_household and m.user_id = (select auth.uid()));
$$;

create or replace function public.is_household_owner(p_household uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members m
                 where m.household_id = p_household and m.user_id = (select auth.uid()) and m.role = 'owner');
$$;

-- Create a household and make the caller its owner, in one step.
create or replace function public.create_household(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first.'; end if;
  if exists (select 1 from public.household_members where user_id = (select auth.uid())) then
    raise exception 'You already belong to a household.';
  end if;
  insert into public.households (name, created_by) values (left(trim(p_name), 60), (select auth.uid())) returning id into new_id;
  insert into public.household_members (household_id, user_id, display_name, role)
  values (new_id, (select auth.uid()), left(trim(p_display_name), 30), 'owner');
  return new_id;
end $$;

-- Accept an invitation addressed to the caller's own email address.
create or replace function public.accept_household_invite(p_household uuid, p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare my_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
  if (select auth.uid()) is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from public.household_invites where household_id = p_household and email = my_email) then
    raise exception 'There is no invitation for % in this household.', my_email;
  end if;
  insert into public.household_members (household_id, user_id, display_name, role)
  values (p_household, (select auth.uid()), left(trim(p_display_name), 30), 'member')
  on conflict (household_id, user_id) do nothing;
  delete from public.household_invites where household_id = p_household and email = my_email;
end $$;

-- Who has read day p_day (zero-based) of the household's shared plan.
-- Returns one row per member with a single boolean; no reading history leaves
-- the database, and only chapters of the shared plan can be asked about.
create or replace function public.household_read_status(p_household uuid, p_day integer)
returns table (user_id uuid, display_name text, has_read boolean)
language sql stable security definer set search_path = '' as $$
  with plan as (
    select p.custom_readings, p.started_on
    from public.user_plans p
    where p.household_id = p_household and p.active
    order by p.started_on desc
    limit 1
  ),
  day as (
    select c ->> 'book' as book, (c ->> 'chapter')::integer as chapter, plan.started_on
    from plan, jsonb_array_elements(coalesce(plan.custom_readings -> p_day, '[]'::jsonb)) as c
  )
  select m.user_id, m.display_name,
         exists (select 1 from day)
         and not exists (
           select 1 from day d
           where not exists (
             select 1 from public.reading_progress rp
             where rp.user_id = m.user_id and rp.book = d.book and rp.chapter = d.chapter and rp.read_at::date >= d.started_on - 1 -- one day of slack for time zones
           )
         ) as has_read
  from public.household_members m
  where m.household_id = p_household and public.is_household_member(p_household)
  order by m.display_name;
$$;

revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_household_owner(uuid) from public, anon;
revoke all on function public.create_household(text, text) from public, anon;
revoke all on function public.accept_household_invite(uuid, text) from public, anon;
revoke all on function public.household_read_status(uuid, integer) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.accept_household_invite(uuid, text) to authenticated;
grant execute on function public.household_read_status(uuid, integer) to authenticated;

-- ── Policies ────────────────────────────────────────────────────────────────
alter table public.households          enable row level security;
alter table public.household_members   enable row level security;
alter table public.household_invites   enable row level security;
alter table public.household_questions enable row level security;

-- Households: members read; the owner renames or deletes. Created only through create_household().
drop policy if exists "members read" on public.households;
drop policy if exists "invited read" on public.households;
drop policy if exists "owner update" on public.households;
drop policy if exists "owner delete" on public.households;
create policy "members read" on public.households for select to authenticated using (public.is_household_member(id));
create policy "invited read" on public.households for select to authenticated
  using (exists (select 1 from public.household_invites i
                 where i.household_id = households.id and i.email = lower(coalesce((select auth.jwt()) ->> 'email', ''))));
create policy "owner update" on public.households for update to authenticated
  using (public.is_household_owner(id)) with check (public.is_household_owner(id));
create policy "owner delete" on public.households for delete to authenticated using (public.is_household_owner(id));

-- Members: members see each other; a member may leave; the owner may remove. Joined only through the functions above.
drop policy if exists "members read" on public.household_members;
drop policy if exists "leave or remove" on public.household_members;
create policy "members read" on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy "leave or remove" on public.household_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_household_owner(household_id));

-- Invites: the owner manages them; the invited person can see their own.
drop policy if exists "owner manage" on public.household_invites;
drop policy if exists "invited read" on public.household_invites;
create policy "owner manage" on public.household_invites for all to authenticated
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id) and email = lower(email));
create policy "invited read" on public.household_invites for select to authenticated
  using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

-- Questions: any member reads and writes, so the whole table sees the same set.
drop policy if exists "members all" on public.household_questions;
create policy "members all" on public.household_questions for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- The shared plan: members may read it; only the household owner may create or change it.
drop policy if exists "household members read" on public.user_plans;
drop policy if exists "owner" on public.user_plans;
create policy "owner" on public.user_plans for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (household_id is null or public.is_household_owner(household_id)));
create policy "household members read" on public.user_plans for select to authenticated
  using (household_id is not null and public.is_household_member(household_id));
