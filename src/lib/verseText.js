// KJV text markup in public/data/kjv.json:
//   {it is}                     translator-supplied words  → shown in italics
//   {reproved: or, discovered}  a margin note (has a colon) → removed
//   «Written to the Romans…»    an epistle's closing subscription → shown as a quiet line
// Three verses in the file have a stray closing brace; cleanVerse copes with those.

/** Remove margin notes and repair stray braces, keeping {supplied words} marked. */
export function cleanVerse(raw) {
  let out = "", group = "", depth = 0, noteEnd = -1;
  for (const ch of String(raw)) {
    if (ch === "{") { if (depth === 0) group = ""; depth++; continue; }
    if (ch === "}") {
      if (depth === 0) {              // stray closer: drop the tail of a split margin note
        if (noteEnd >= 0) out = out.slice(0, noteEnd);
        continue;
      }
      depth--;
      if (depth === 0) {
        if (group.includes(":")) noteEnd = out.length;
        else { out += `{${group}}`; noteEnd = -1; }
      }
      continue;
    }
    if (depth > 0) group += ch; else out += ch;
  }
  if (depth > 0 && !group.includes(":")) out += group;
  return out.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

/** Verse text with all markup characters removed (for copy, search, speech, AI). */
export function plainText(text) {
  return String(text || "").replace(/[{}«»]/g, "").replace(/\s+/g, " ").trim();
}

/** Split marked text into [{ text, italic, title }] runs for rendering. */
export function textRuns(text) {
  const runs = [];
  let title = false;
  for (const part of String(text || "").split(/(\{[^{}]*\}|[«»])/)) {
    if (!part) continue;
    if (part === "«") { title = true; continue; }
    if (part === "»") { title = false; continue; }
    if (part.startsWith("{")) runs.push({ text: part.slice(1, -1), italic: true, title });
    else runs.push({ text: part, italic: false, title });
  }
  return runs;
}
