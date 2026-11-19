// Renders a verse card to a canvas at its real export size. The on-screen
// preview is this same canvas scaled down with CSS, so what is shared is
// exactly what was seen.

export const SHAPES = {
  square: { label: "Square post", width: 1080, height: 1080 },
  tall: { label: "Tall story", width: 1080, height: 1920 },
  wide: { label: "Wide thumbnail", width: 1280, height: 720 },
};

export const PAPERS = {
  ink: { label: "Ink", ground: "#181614", text: "#faf9f6", soft: "#e8a696", quiet: "#cfc8bb" },
  paper: { label: "Paper", ground: "#faf9f6", text: "#181614", soft: "#8a2318", quiet: "#5e584f" },
  sepia: { label: "Sepia", ground: "#f5efdc", text: "#2c2013", soft: "#8a2318", quiet: "#6f5a40" },
  red: { label: "Red", ground: "#8a2318", text: "#ffffff", soft: "#f6cfc6", quiet: "#f1dcd7" },
};

const DISPLAY = "'Instrument Serif', Georgia, serif";
const UI = "'Archivo Variable', 'Archivo', system-ui, sans-serif";
const MIN_QUOTE = 30;

/** Make sure the bundled fonts are ready before anything is measured or drawn. */
export async function fontsReady() {
  if (!document.fonts) return;
  await Promise.allSettled([
    document.fonts.load(`italic 60px ${DISPLAY}`),
    document.fonts.load(`60px ${DISPLAY}`),
    document.fonts.load(`700 30px ${UI}`),
    document.fonts.load(`400 30px ${UI}`),
  ]);
  await document.fonts.ready;
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Text with letter-spacing, drawn glyph by glyph (canvas letterSpacing is not universal). */
function spaced(ctx, text, x, y, spacing, align = "left") {
  const chars = [...text];
  const width = chars.reduce((w, c) => w + ctx.measureText(c).width + spacing, -spacing);
  let cx = align === "right" ? x - width : x;
  ctx.textAlign = "left";
  for (const c of chars) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + spacing; }
  return width;
}

/**
 * Draw the card. Returns { fits } — false when the text cannot be fitted even
 * at the minimum size (the caller caps passages at about 400 characters).
 */
export function drawCard(canvas, { shape, paper, eyebrow, quote, reference, note, handle }) {
  const { width: W, height: H } = SHAPES[shape];
  const p = PAPERS[paper];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const unit = Math.min(W, H) / 1080; // scale type with the short side
  const pad = Math.round(90 * unit);
  const inner = W - pad * 2;

  ctx.fillStyle = p.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Eyebrow
  const eyebrowSize = Math.round(30 * unit);
  ctx.fillStyle = p.soft;
  ctx.font = `700 ${eyebrowSize}px ${UI}`;
  spaced(ctx, eyebrow.toUpperCase(), pad, pad + eyebrowSize, eyebrowSize * 0.26);
  const top = pad + eyebrowSize * 2.2;

  // Footer: reference (and handle) on the left, the "B." mark on the right
  const refSize = Math.round(33 * unit);
  const markSize = Math.round(72 * unit);
  const baseline = H - pad;
  ctx.fillStyle = p.soft;
  ctx.font = `${markSize}px ${DISPLAY}`;
  ctx.textAlign = "right";
  ctx.fillText("B.", W - pad, baseline);
  ctx.fillStyle = p.text;
  ctx.font = `600 ${refSize}px ${UI}`;
  spaced(ctx, reference.toUpperCase(), pad, baseline, refSize * 0.1);
  let footerTop = baseline - Math.max(refSize, markSize);
  if (handle) {
    ctx.fillStyle = p.quiet;
    ctx.font = `400 ${Math.round(28 * unit)}px ${UI}`;
    ctx.textAlign = "left";
    ctx.fillText(handle, pad, baseline - refSize * 1.6);
    footerTop -= refSize * 1.3;
  }
  const bottom = footerTop - 40 * unit;

  // Optional note under the verse
  const noteSize = Math.round(30 * unit);
  ctx.font = `400 ${noteSize}px ${UI}`;
  const noteLines = note ? wrap(ctx, note, inner).slice(0, 3) : [];
  const noteHeight = noteLines.length ? noteLines.length * noteSize * 1.45 + 30 * unit : 0;

  // The verse: the largest size at which it fits the space that is left
  const room = bottom - top - noteHeight;
  const text = `“${quote}”`;
  let size = Math.round((shape === "tall" ? 92 : 78) * unit), lines = [];
  for (; size >= MIN_QUOTE * unit; size -= 2) {
    ctx.font = `italic ${size}px ${DISPLAY}`;
    lines = wrap(ctx, text, inner);
    if (lines.length * size * 1.25 <= room) break;
  }
  const fits = size >= MIN_QUOTE * unit;
  ctx.font = `italic ${size}px ${DISPLAY}`;
  ctx.fillStyle = p.text;
  ctx.textAlign = "left";
  const lineHeight = size * 1.25;
  const block = lines.length * lineHeight + noteHeight;
  // Sit the verse in the middle of the space between the eyebrow and the footer.
  let y = top + Math.max(0, (bottom - top - block) / 2) + size;
  for (const line of lines) { ctx.fillText(line, pad, y); y += lineHeight; }

  if (noteLines.length) {
    y += 30 * unit - (lineHeight - size);
    ctx.font = `400 ${noteSize}px ${UI}`;
    ctx.fillStyle = p.quiet;
    for (const line of noteLines) { ctx.fillText(line, pad, y); y += noteSize * 1.45; }
  }
  return { fits };
}

export const toPngBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
