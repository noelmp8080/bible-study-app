// Shared by the search worker and the search screen.

/** Lowercase, punctuation to spaces, single-spaced: "LORD's," → "lord s". */
export function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Split a query into whole words and quoted phrases.
 *   grace            → words ["grace"]
 *   grace truth      → words ["grace", "truth"]   (both must be in the verse)
 *   "grace and truth" → phrases ["grace and truth"]
 */
export function parseQuery(query) {
  const phrases = [];
  const rest = String(query || "").replace(/["“”]([^"“”]+)["“”]/g, (_, p) => { const n = normalize(p); if (n) phrases.push(n); return " "; });
  const words = [...new Set(normalize(rest).split(" ").filter(Boolean))];
  return { words, phrases, empty: !words.length && !phrases.length };
}

/** A regular expression that finds every matched word or phrase in display text. */
export function highlightPattern({ words, phrases }) {
  const parts = [...phrases.map((p) => p.split(" ").join("[^A-Za-z0-9]+")), ...words].sort((a, b) => b.length - a.length);
  return parts.length ? new RegExp(`(?<![A-Za-z0-9])(${parts.join("|")})(?![A-Za-z0-9])`, "gi") : null;
}
