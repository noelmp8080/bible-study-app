# Study datasets (not bundled yet)

The reader's study panel shows cross-references and original-language words
when these files exist. They are deliberately absent: the upgrade spec says the
source and licence of each file must be approved and recorded here **before**
it is added to the repository. That is why `public/data/study/` does not exist yet.

When a dataset is approved, add its files to `public/data/study/` and list it in
`manifest.json`. The app picks them up without a code change.

## Files and shapes

`manifest.json`

```json
{ "xrefs": true, "words": true }
```

`xrefs/<book-slug>.json` — one file per book (`john.json`, `1-samuel.json`,
`song-of-solomon.json`). Keys are `chapter:verse`; values are references
written with the app's book names, most relevant first.

```json
{ "3:16": ["Romans 5:8", "1 John 4:9", "Romans 8:32"] }
```

`words/<book-slug>.json` — the English word or phrase and its Strong's number,
in verse order.

```json
{ "3:16": [{ "w": "loved", "s": "G25" }, { "w": "only begotten", "s": "G3439" }] }
```

`lexicon-greek.json`, `lexicon-hebrew.json` — keyed by Strong's number.

```json
{ "G25": { "lemma": "ἀγαπάω", "translit": "agapaō", "def": "to love…" } }
```

## Sources and licences

| File | Source | Licence | Approved by / date |
| --- | --- | --- | --- |
| _none yet_ | | | |

Candidates named in the spec: Treasury of Scripture Knowledge (public domain)
for cross-references; a Strong's-tagged KJV and Strong's lexicon (public
domain) for words.
