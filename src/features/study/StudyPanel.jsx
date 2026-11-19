import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Icon from "../../components/Icon.jsx";
import { available, crossReferences, verseWords, lexiconEntry } from "./datasets.js";
import { parseReference } from "../../lib/refs.js";
import { kjvText, refExists } from "../../lib/bible.js";
import { readPath } from "../../lib/books.js";

/** Loads the study data for one verse; resolves to empty lists when no dataset is installed. */
function useStudyData(book, chapter, verse) {
  const key = verse ? `${book}|${chapter}|${verse}` : null;
  const [data, setData] = useState({ key: null, xrefs: [], words: [] });
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    (async () => {
      const has = await available();
      const [xrefs, words] = await Promise.all([
        has.xrefs ? crossReferences(book, chapter, verse) : [],
        has.words ? verseWords(book, chapter, verse) : [],
      ]);
      const valid = xrefs.map(parseReference).filter((r) => r && refExists(r)).slice(0, 12);
      if (alive) setData({ key, xrefs: valid, words });
    })();
    return () => { alive = false; };
  }, [key, book, chapter, verse]);
  return data.key === key ? data : { key, xrefs: [], words: [] };
}

function Word({ word }) {
  const [entry, setEntry] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { let alive = true; lexiconEntry(word.s).then((e) => { if (alive) setEntry(e); }); return () => { alive = false; }; }, [word.s]);
  return (
    <div>
      <button type="button" className="word-row" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <b>{word.w}</b>
        <span>{[entry?.lemma, entry?.translit, word.s].filter(Boolean).join(" · ")}</span>
      </button>
      {open && <p className="muted2" style={{ fontSize: 12.5, lineHeight: 1.6, padding: "8px 0" }}>{entry?.def || "No lexicon entry for this word."}</p>}
    </div>
  );
}

/**
 * Study content for the selected verse: cross-references, words in the verse,
 * and "Ask about this verse in context". The two data sections stay hidden
 * until their datasets are installed (see datasets.js).
 */
export default function StudyPanel({ book, chapter, verses, translation, asSheet = false }) {
  const navigate = useNavigate();
  const verse = verses[0] || null;
  const data = useStudyData(book, chapter, verse);
  const title = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
  const ask = () => navigate("/ask", { state: { context: { book, chapter, verses, translation } } });

  return (
    <>
      {!asSheet && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Study</div>
          <div className="display" style={{ fontSize: 30, lineHeight: 1 }}>{title}</div>
        </div>
      )}
      {!verse && <p className="muted2" style={{ fontSize: 13, lineHeight: 1.6 }}>Select a verse to study it. This panel follows your selection.</p>}
      {verse && verses.length > 1 && <p className="muted" style={{ fontSize: 12 }}>Showing the first verse of your selection.</p>}

      {data.xrefs.length > 0 && (
        <section className="stack-sm" style={{ gap: 10 }}>
          <div className="label">Cross-references</div>
          {data.xrefs.map((r) => (
            <button key={`${r.book}${r.chapter}:${r.verseStart}`} type="button" className="xref" onClick={() => navigate(readPath(r.book, r.chapter, r.verseStart))}>
              <span className="refline">{r.book} {r.chapter}:{r.verseStart}{r.verseEnd !== r.verseStart ? `–${r.verseEnd}` : ""}</span>
              <span className="scripture">{kjvText(r.book, r.chapter, r.verseStart, r.verseEnd)}</span>
            </button>
          ))}
        </section>
      )}

      {data.words.length > 0 && (
        <section className="stack-sm">
          <div className="label">Words in this verse</div>
          {data.words.map((w, i) => <Word key={`${w.s}-${i}`} word={w} />)}
        </section>
      )}

      <button type="button" className="btn btn-outline" style={{ marginTop: asSheet ? 4 : "auto" }} onClick={ask}>
        <Icon name="ask" size={15} />{verse ? "Ask about this verse in context" : "Ask about this chapter"}
      </button>
    </>
  );
}
