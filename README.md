# The Bible Study App

A private Bible study companion: read and search the whole Bible offline,
highlight and bookmark verses, keep notes (text, drawings, photos, audio),
follow a reading plan, memorise verses, record sermons, and ask an AI study
assistant about the passage in front of you.

It is a React + Vite web app, installable as a PWA, with Supabase for sign-in,
sync and storage. The same build also runs in a Windows desktop shell
(Electron).

## Run it

```bash
npm install
npm run dev
```

`.env` (never committed) needs two values:

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…
```

The sign-in screen has a **development-only** button, "Open without an
account", that runs the whole app against this browser's storage and sends
nothing to Supabase. It is compiled out of production builds.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint |
| `npm run plans` | Regenerate the reading-plan JSON from the KJV text |
| `npm run electron:dev` | Build, then open the desktop shell |

## How it is put together

```
src/
  app/          Root (router, providers), sign-in gate, store gate
  components/   Shared UI: app shell, sheet, toasts, icons, pickers, markdown
  features/     One folder per screen: reader, study, notes, ask, search, today,
                plans, map, memory, sermon, cards, threads, family, settings, auth
  hooks/        useAuth, useTable, usePrefs, useBible, useRecorder, …
  lib/          Everything without React: books, references, Bible store,
                local-first data store, AI client, plans, memory schedule
  styles/       tokens.css (the three themes) and base.css
public/data/kjv.json     The whole KJV (not bundled into the JavaScript)
supabase/migrations/     Database changes, in order
supabase/functions/      The "scholar" Edge Function (all AI calls)
```

**Themes.** "The Journal" look is defined once as CSS custom properties in
`src/styles/tokens.css`, switched by `data-theme` on `<html>` (light, dark,
sepia). Components never receive colours as props.

**Offline first.** The KJV is downloaded once, compacted and kept in
IndexedDB; reading and full-text search (in a Web Worker) then need no
network. ASV chapters are fetched from bible-api.com the first time and kept.
Every table the app owns lives in a local store (`src/lib/store.js`): a change
is applied on the device at once, queued in an outbox and synced when online.
Recordings, drawings and photos are files, kept locally first and uploaded to
private Storage buckets. The status line in the reader and on Today shows
where things stand.

**Private by default.** Sign-in is by emailed magic link (Supabase Auth).
Every table has row level security, so each account sees only its own rows.

**AI.** The browser never holds an Anthropic key. It calls the `scholar` Edge
Function with the signed-in user's token; the key is a function secret.

**Read aloud.** The `speak` Edge Function turns a chapter into speech with
ElevenLabs, a few verses at a time, and keeps each piece: the MP3 in the
private `bsa-speech` bucket, its verse timings in `speech_clips`. A passage
costs ElevenLabs credits the first time anyone hears it and is a plain
download after that. Changing the voice or model starts a fresh set. Offline,
or when that voice is off or unavailable, the device's own voice reads.

## Setting up Supabase

The app is written to keep working at every step below; what cannot sync yet
stays on the device and Preferences says so.

1. **Additive migrations** (safe at any time, in order):
   `…000100_phase1_ownership`, `…000200_phase2_storage`,
   `…000300_new_tables`, `…000400_phase10_households`.
2. **Deploy this version and sign in once** with the owner's email.
3. **Lock down**: put that email in `…000900_phase1_lockdown.sql` and run it.
   It hands the existing notes, highlights and recordings to that account and
   replaces the old "Allow all" policies with owner-only ones. Until this is
   run, the database is still open to anyone holding the public anon key.
4. **Edge Function**:
   ```bash
   npx supabase functions deploy scholar
   npx supabase secrets set ANTHROPIC_API_KEY=…
   ```
   Optional secrets: `SCHOLAR_MODEL` (default `claude-opus-5-5`) and
   `SCHOLAR_FALLBACKS=off`.

   For read aloud in a natural voice, run `…001000_speech` (additive), then:
   ```bash
   npx supabase functions deploy speak --no-verify-jwt
   npx supabase secrets set ELEVENLABS_API_KEY=…
   ```
   (The function checks the caller's sign-in itself, so the gateway check is off.)
   Optional secrets: `SPEAK_VOICE_ID` (an ElevenLabs voice id; default is the
   premade voice "George"), `SPEAK_MODEL` (default `eleven_multilingual_v2`)
   and `SPEAK_DAILY_CHARS` (ceiling on newly generated characters per day,
   default 60000). Until this is done, read aloud uses the device's voice.
5. **Auth settings** in the Supabase dashboard: add the site URL to the
   redirect allow-list. To let people type a code instead of following the
   link (needed in an installed PWA and in the desktop app), add
   `{{ .Token }}` to the Magic Link email template.

The Supabase project is shared with another app whose tables are prefixed
`para_`. Nothing here touches those; storage buckets are prefixed `bsa-`.

## What each phase of the November 2026 upgrade added

- **Phase 1 · Lock down.** Sign-in gate; `user_id` on every table with
  owner-only policies; preferences per user; all AI through the `scholar`
  Edge Function (no key in the browser, the installer or `VITE_` variables);
  the Electron shell no longer packages `.env`.
- **Phase 2 · Foundations.** Feature folders, URL routes (`/read/john/3`),
  CSS-variable themes, local KJV store with supplied words in italics and
  margin notes removed, local-first sync with an outbox, media in Storage,
  real photo capture, bundled fonts and inline icons, corrected PWA manifest,
  keyboard access throughout, delete with undo.
- **Phase 3 · Reader.** Tap to select (nothing is written until you choose),
  multi-verse selection, toolbar or phone sheet, four highlight colours,
  chapter and verse bookmarks, notes linked to a verse with a marker,
  Previous/Next across books, arrow keys and swipe, compare with the other
  translation, read aloud.
- **Phase 4 · Search.** Offline whole-word and quoted-phrase search with
  testament counts, reference detection ("rom 8:28"), notes and dictionary
  scopes.
- **Phase 5 · Today, plans, map, memory.** Today tab, reading progress, three
  built-in plans plus a plan built from unread chapters, the chapter map, the
  memory trainer, and a date-based verse of the day in the active translation.
- **Phase 6 · Study panel and AI in context.** The panel follows the selected
  verse; Ask sends the selected verses and their chapter, streams the answer,
  renders markdown, saves answers as notes and keeps conversations.
  Cross-reference and Strong's datasets are **not bundled yet**: see
  `docs/study-datasets.md`.
- **Phase 7 · Sermon mode.** Record, pin references and thoughts to the
  moment, finish with one study note; works with no connection.
- **Phase 8 · Verse cards.** 1080×1080, 1080×1920 and 1280×720 PNGs in four
  papers, shared, saved or copied.
- **Phase 9 · Threads.** Ordered passages tracing one idea, AI suggestions
  checked against the local Bible, export to a lesson outline.
- **Phase 10 · Family table.** Households, a shared plan, who has read
  tonight's passage, and three questions for different ages.

The full brief is `docs/bible-study-app-upgrade-spec.html`.

## Bible text

`public/data/kjv.json` is the King James Version (public domain): 66 books,
1,189 chapters, 31,100 verses. Braces mark translator-supplied words; a brace
group containing a colon is a margin note.
