-- Read aloud in a natural voice: audio made once by the "speak" Edge Function
-- (ElevenLabs), then kept. The MP3s live in a private Storage bucket; this
-- table is the index: which passage, in which voice, where the file is, and
-- when each verse starts in it. It is also what the daily ceiling on new audio
-- is counted from.
--
-- Additive and safe to run more than once. Scripture audio is the same for
-- everyone, so clips are shared and not owned by a user.

create table if not exists public.speech_clips (
  hash       text primary key,          -- sha256 of voice, model and the text read
  voice      text not null,
  model      text not null,
  chars      integer not null,          -- characters sent to ElevenLabs (what it cost)
  path       text not null,             -- object path in the bsa-speech bucket
  starts     jsonb,                     -- seconds at which each verse begins
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists speech_clips_created_at_idx on public.speech_clips (created_at);

-- Only the Edge Function (service role) reads or writes this table: row level
-- security is on with no policies, and the browser roles have no grants.
alter table public.speech_clips enable row level security;
revoke all on public.speech_clips from anon, authenticated;

-- Private, with no storage policies: the function hands out one-hour links.
insert into storage.buckets (id, name, public)
values ('bsa-speech', 'bsa-speech', false)
on conflict (id) do nothing;
