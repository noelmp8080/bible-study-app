import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { PAPERS, SHAPES, drawCard, fontsReady, toPngBlob } from "./drawCard.js";
import { CARD_LIMIT } from "../reader/useVerseActions.js";
import { useTable } from "../../hooks/useData.js";
import { usePrefs } from "../../hooks/usePrefs.js";
import { useToast } from "../../hooks/useToast.js";
import { getPassage } from "../../lib/bible.js";
import { chapterWord, bookSlug } from "../../lib/books.js";
import { formatSelection } from "../../lib/refs.js";
import { noteCovers, noteLink } from "../../lib/notes.js";

const canCopyImage = typeof window !== "undefined" && "ClipboardItem" in window && !!navigator.clipboard?.write;

/** Spec B3: opened from "Share as image" with one verse or a short range. */
export default function CardStudio() {
  const location = useLocation();
  const card = location.state?.card;
  if (!card?.book || !card.verses?.length) return <Navigate to="/read" replace />;
  return <Studio card={card} />;
}

function Studio({ card }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [prefs, setPrefs] = usePrefs();
  const notes = useTable("notes");
  const canvasRef = useRef(null);
  const verses = useMemo(() => [...card.verses].sort((a, b) => a - b), [card.verses]);

  const [shape, setShape] = useState("square");
  const [paper, setPaper] = useState("ink");
  const [passage, setPassage] = useState(null);
  const [fits, setFits] = useState(true);
  const [withNote, setWithNote] = useState(false);
  const [withHandle, setWithHandle] = useState(false);
  const [handle, setHandle] = useState(prefs.share_handle);
  const linkedNote = useMemo(
    () => notes.find((n) => noteCovers(noteLink(n), card.book, card.chapter, verses[0])),
    [notes, card.book, card.chapter, verses]);
  const [noteText, setNoteText] = useState(() => (linkedNote?.text || linkedNote?.title || "").split("\n")[0].slice(0, 140));

  useEffect(() => {
    let alive = true;
    getPassage(card.translation, card.book, card.chapter).then((p) => {
      if (!alive) return;
      const picked = p.verses.filter((v) => verses.includes(v.verse));
      setPassage({ translation: p.translation, text: picked.map((v) => v.text.replace(/[{}«»]/g, "")).join(" ").replace(/\s+/g, " ").trim() });
    }, () => { if (alive) setPassage({ translation: card.translation, text: "" }); });
    return () => { alive = false; };
  }, [card, verses]);

  const reference = formatSelection(card.book, card.chapter, verses);
  const tooLong = !!passage && passage.text.length > CARD_LIMIT;
  const ready = !!passage?.text && !tooLong;

  // Draw once the fonts are loaded, and again whenever an option changes.
  useEffect(() => {
    if (!ready) return undefined;
    let alive = true;
    fontsReady().then(() => {
      if (!alive || !canvasRef.current) return;
      const result = drawCard(canvasRef.current, {
        shape, paper,
        eyebrow: `${card.book} · Chapter ${chapterWord(card.chapter)}`,
        quote: passage.text,
        reference: `${reference} · ${passage.translation}`,
        note: withNote ? noteText.trim() : "",
        handle: withHandle ? handle.trim() : "",
      });
      setFits(result.fits);
    });
    return () => { alive = false; };
  }, [ready, passage, shape, paper, withNote, noteText, withHandle, handle, reference, card.book, card.chapter]);

  const fileName = `${bookSlug(card.book)}-${card.chapter}-${verses[0]}-${shape}.png`;
  async function blob() { await fontsReady(); return toPngBlob(canvasRef.current); }
  function download(b) {
    const url = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function share() {
    const b = await blob();
    if (!b) return;
    const file = new File([b], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: reference }); }
      catch (err) { if (err.name !== "AbortError") toast("Sharing did not work on this device. Use Save instead.", { error: true }); }
    } else { download(b); toast("Sharing files is not supported here, so the image was downloaded."); }
  }
  async function save() { const b = await blob(); if (b) { download(b); toast(`Saved ${SHAPES[shape].width}×${SHAPES[shape].height} PNG`); } }
  async function copy() {
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob() })]);
      toast("Image copied");
    } catch { toast("Copying an image is not allowed here. Use Save instead.", { error: true }); }
  }

  const { width, height } = SHAPES[shape];
  return (
    <div className="screen" style={{ height: "100dvh" }}>
      <header className="row-between" style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <button type="button" className="btn btn-plain" onClick={() => navigate(-1)}>Cancel</button>
        <h1 className="display" style={{ fontSize: 22 }}>Verse card</h1>
        <button type="button" className="btn btn-accent" onClick={share} disabled={!ready}>Share</button>
      </header>
      <div className="screen-scroll">
        <main className="pad wrap-narrow stack" style={{ gap: 16 }}>
          {!passage && <p className="empty" role="status">Preparing the card…</p>}
          {passage && !passage.text && <p className="notice error" role="alert">This passage could not be loaded on this device.</p>}
          {tooLong && (
            <p className="notice" role="alert">
              {reference} is {passage.text.length} characters, which is too long to read on a card. Choose a shorter passage (about {CARD_LIMIT} characters or fewer).
            </p>
          )}
          {ready && (
            <>
              <figure className="card-preview" style={{ margin: 0 }} aria-label={`Card preview, ${width} by ${height} pixels`}>
                <canvas ref={canvasRef} width={width} height={height} role="img" aria-label={`“${passage.text}” ${reference}, ${passage.translation}`}
                  style={{ maxHeight: shape === "tall" ? "52vh" : "44vh", width: "auto" }} />
              </figure>
              {!fits && <p className="notice" role="status">The text is at its smallest size and still tight in this shape. Try Tall story, or remove the note.</p>}

              <div className="stack-sm">
                <div className="label">Shape</div>
                <div className="seg" role="group" aria-label="Card shape">
                  {Object.entries(SHAPES).map(([id, s]) => <button key={id} type="button" aria-pressed={shape === id} onClick={() => setShape(id)}>{s.label}</button>)}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{width} × {height} px PNG</div>
              </div>

              <div className="stack-sm">
                <div className="label">Paper</div>
                <div className="papers" role="group" aria-label="Card color">
                  {Object.entries(PAPERS).map(([id, p]) => (
                    <button key={id} type="button" aria-pressed={paper === id} onClick={() => setPaper(id)} style={{ background: p.ground, color: p.text }}>
                      {paper === id ? "✓ " : ""}{p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="stack-sm">
                <label className="check-row">Add my note underneath<input type="checkbox" checked={withNote} onChange={(e) => setWithNote(e.target.checked)} /></label>
                {withNote && (
                  <label className="field"><span>{linkedNote ? "From your note on this verse (edit freely)" : "A line of your own"}</span>
                    <input className="input" value={noteText} maxLength={140} onChange={(e) => setNoteText(e.target.value)} placeholder="What this verse means to you" />
                  </label>
                )}
                <label className="check-row">Show my handle<input type="checkbox" checked={withHandle} onChange={(e) => setWithHandle(e.target.checked)} /></label>
                {withHandle && (
                  <label className="field"><span>Your handle (saved in Preferences)</span>
                    <input className="input" value={handle} maxLength={40} placeholder="@yourname" autoComplete="off"
                      onChange={(e) => setHandle(e.target.value)} onBlur={() => { if (handle.trim() !== prefs.share_handle) setPrefs({ share_handle: handle.trim() }); }} />
                  </label>
                )}
              </div>
            </>
          )}
        </main>
      </div>
      <div className="foot" style={{ flexDirection: "row", gap: 8 }}>
        <button type="button" className="btn btn-outline btn-lg grow" onClick={save} disabled={!ready}>Save to photos</button>
        {canCopyImage && <button type="button" className="btn btn-outline btn-lg grow" onClick={copy} disabled={!ready}>Copy image</button>}
      </div>
    </div>
  );
}
