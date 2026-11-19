// A small, safe markdown renderer for AI answers: headings, lists, block
// quotes, bold, italics and inline code. It builds React elements directly, so
// no HTML from the model is ever injected.

function inline(text, keyBase) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`]+)`)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2] || m[3]) out.push(<strong key={key}>{m[2] || m[3]}</strong>);
    else if (m[4] || m[5]) out.push(<em key={key}>{m[4] || m[5]}</em>);
    else out.push(<code key={key}>{m[6]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;
const QUOTE = /^>\s?/;
const HEADING = /^(#{1,6})\s+(.*)$/;

export default function Markdown({ text }) {
  const blocks = [];
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = blocks.length;
    if (!line.trim()) { i++; continue; }
    const heading = HEADING.exec(line);
    if (heading) {
      const Tag = heading[1].length <= 2 ? "h3" : "h4";
      blocks.push(<Tag key={key}>{inline(heading[2], key)}</Tag>); i++; continue;
    }
    if (BULLET.test(line)) {
      const items = [];
      while (i < lines.length && BULLET.test(lines[i])) items.push(lines[i++].replace(BULLET, ""));
      blocks.push(<ul key={key}>{items.map((t, n) => <li key={n}>{inline(t, `${key}-${n}`)}</li>)}</ul>); continue;
    }
    if (NUMBER.test(line)) {
      const items = [];
      while (i < lines.length && NUMBER.test(lines[i])) items.push(lines[i++].replace(NUMBER, ""));
      blocks.push(<ol key={key}>{items.map((t, n) => <li key={n}>{inline(t, `${key}-${n}`)}</li>)}</ol>); continue;
    }
    if (QUOTE.test(line)) {
      const quote = [];
      while (i < lines.length && QUOTE.test(lines[i])) quote.push(lines[i++].replace(QUOTE, ""));
      blocks.push(<blockquote key={key}>{inline(quote.join(" "), key)}</blockquote>); continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !HEADING.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBER.test(lines[i]) && !QUOTE.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key}>{inline(para.join(" "), key)}</p>);
  }
  return <div className="md">{blocks}</div>;
}
