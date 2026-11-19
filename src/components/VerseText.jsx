import { textRuns } from "../lib/verseText.js";

/** Scripture text with KJV markup rendered: supplied words in italics, subscriptions quiet. */
export default function VerseText({ text }) {
  const runs = textRuns(text);
  if (runs.length === 1 && !runs[0].italic && !runs[0].title) return runs[0].text;
  return runs.map((r, i) => {
    const inner = r.italic ? <i>{r.text}</i> : r.text;
    return <span key={i} className={r.title ? "title" : undefined}>{inner}</span>;
  });
}
