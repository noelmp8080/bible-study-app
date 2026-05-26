-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Notes
create table notes (
  id          uuid default gen_random_uuid() primary key,
  title       text,
  ref         text,
  text        text,
  tags        text[],
  has_audio   boolean default false,
  has_image   boolean default false,
  drawing     jsonb,
  created_at  timestamptz default now()
);

-- Highlights  (color is required for the highlight picker)
create table highlights (
  id          uuid default gen_random_uuid() primary key,
  book        text not null,
  chapter     integer not null,
  verse       integer not null,
  color       text not null,
  created_at  timestamptz default now(),
  unique (book, chapter, verse)
);

-- Preferences  (single row per user — upsert by id)
create table preferences (
  id          uuid default gen_random_uuid() primary key,
  theme       text default 'dark',
  font_size   integer default 16,
  updated_at  timestamptz default now()
);

-- Enable Row Level Security (open access — tighten once you add auth)
alter table notes       enable row level security;
alter table highlights  enable row level security;
alter table preferences enable row level security;

create policy "Allow all" on notes       for all using (true) with check (true);
create policy "Allow all" on highlights  for all using (true) with check (true);
create policy "Allow all" on preferences for all using (true) with check (true);
