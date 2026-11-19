-- Phase 2: recordings, drawings and photos move out of table rows into private
-- Storage buckets, under a folder named after the owner's user id.
--
-- Additive and safe to run more than once. The old columns (notes.drawing,
-- recordings.audio_data) are kept: the app copies their contents to Storage
-- the first time each note is opened. Drop them later, once that is done.

alter table public.recordings add column if not exists storage_path text;
alter table public.recordings alter column audio_data drop not null;
alter table public.notes
  add column if not exists drawing_path text,
  add column if not exists photo_path text;

-- Bucket names carry a "bsa-" prefix because this project is shared with another app.
insert into storage.buckets (id, name, public)
values ('bsa-recordings', 'bsa-recordings', false),
       ('bsa-drawings',   'bsa-drawings',   false),
       ('bsa-photos',     'bsa-photos',     false)
on conflict (id) do nothing;

-- A signed-in user may only touch objects in "<their user id>/…" in these three buckets.
drop policy if exists "bsa media read"   on storage.objects;
drop policy if exists "bsa media insert" on storage.objects;
drop policy if exists "bsa media update" on storage.objects;
drop policy if exists "bsa media delete" on storage.objects;

create policy "bsa media read" on storage.objects for select to authenticated
  using (bucket_id in ('bsa-recordings', 'bsa-drawings', 'bsa-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "bsa media insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('bsa-recordings', 'bsa-drawings', 'bsa-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "bsa media update" on storage.objects for update to authenticated
  using (bucket_id in ('bsa-recordings', 'bsa-drawings', 'bsa-photos') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('bsa-recordings', 'bsa-drawings', 'bsa-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "bsa media delete" on storage.objects for delete to authenticated
  using (bucket_id in ('bsa-recordings', 'bsa-drawings', 'bsa-photos') and (storage.foldername(name))[1] = (select auth.uid())::text);
