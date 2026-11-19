import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon.jsx";

const PEN_COLORS = [["#1C1C1E", "Black"], ["#0D1B2A", "Navy"], ["#C9A84C", "Gold"], ["#1A7A4A", "Green"], ["#C0392B", "Red"], ["#2471A3", "Blue"], ["#6C3483", "Purple"], ["#784212", "Brown"]];
const TOOLS = [["pen", "pencil", "Pen"], ["hi", "highlight", "Highlighter"], ["eraser", "eraser", "Eraser"]];

/** Freehand drawing with pen pressure (Apple Pencil), a highlighter and an eraser. Saves a PNG blob. */
export default function DrawingCanvas({ onSave, onClose }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const strokes = useRef([]);
  const current = useRef([]);
  const [penColor, setPenColor] = useState(PEN_COLORS[0][0]);
  const [tool, setTool] = useState("pen");
  const [input, setInput] = useState("Pencil, finger or mouse");

  const paintWhite = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, c.width, c.height);
  };
  useEffect(paintWhite, []);

  function position(e) {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function segment(ctx, s) {
    ctx.globalAlpha = s.alpha; ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y);
    ctx.lineWidth = s.width; ctx.strokeStyle = s.color; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(); ctx.globalAlpha = 1;
  }
  function onDown(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true; lastPos.current = position(e); current.current = [];
    setInput(e.pointerType === "pen" ? "Pencil" : e.pointerType === "touch" ? "Finger" : "Mouse");
  }
  function onMove(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const to = position(e);
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    const s = tool === "eraser" ? { width: 24, color: "white", alpha: 1 }
      : tool === "hi" ? { width: 20, color: penColor, alpha: 0.28 }
      : { width: e.pointerType === "pen" ? Math.max(0.8, pressure * 5) : 2, color: penColor, alpha: 1 };
    const seg = { ...s, from: { ...lastPos.current }, to };
    segment(canvasRef.current.getContext("2d"), seg);
    current.current.push(seg);
    lastPos.current = to;
  }
  function onUp() {
    drawing.current = false;
    if (current.current.length) strokes.current.push(current.current);
    current.current = [];
  }
  function undo() {
    strokes.current.pop();
    paintWhite();
    const ctx = canvasRef.current.getContext("2d");
    strokes.current.forEach((stroke) => stroke.forEach((s) => segment(ctx, s)));
  }
  function clearAll() { strokes.current = []; paintWhite(); }
  function save() { canvasRef.current.toBlob((blob) => { if (blob) onSave(blob); }, "image/png"); }

  return (
    <div className="draw">
      <div className="draw-tools">
        <div className="row" role="group" aria-label="Tool" style={{ gap: 6 }}>
          {TOOLS.map(([id, icon, label]) => (
            <button key={id} type="button" className={`btn btn-sm ${tool === id ? "btn-accent" : "btn-quiet"}`} aria-pressed={tool === id} onClick={() => setTool(id)}>
              <Icon name={icon} size={14} />{label}
            </button>
          ))}
        </div>
        <div className="row" role="group" aria-label="Ink color" style={{ gap: 5, flexWrap: "wrap" }}>
          {PEN_COLORS.map(([c, name]) => (
            <button key={c} type="button" className="pen" style={{ background: c }} aria-pressed={penColor === c} aria-label={name} title={name} onClick={() => setPenColor(c)} />
          ))}
        </div>
        <div className="row" style={{ marginLeft: "auto", gap: 6 }}>
          <button type="button" className="btn btn-sm" onClick={undo}><Icon name="undo" size={14} />Undo</button>
          <button type="button" className="btn btn-sm btn-danger" onClick={clearAll}>Clear</button>
        </div>
      </div>
      <div className="muted" style={{ padding: "4px 12px", fontSize: 11, borderBottom: "1px solid var(--border)" }}>
        {input} · {tool === "pen" ? "pressure-sensitive ink" : tool === "hi" ? "transparent highlighter" : "eraser"}
      </div>
      <canvas ref={canvasRef} width={800} height={380} aria-label="Drawing area" role="img"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ cursor: tool === "eraser" ? "cell" : "crosshair" }} />
      <div className="row" style={{ justifyContent: "flex-end", padding: "10px 12px", background: "var(--surface2)" }}>
        <button type="button" className="btn btn-quiet" onClick={onClose}>Discard</button>
        <button type="button" className="btn btn-accent" onClick={save}><Icon name="check" size={15} stroke={2} />Save drawing</button>
      </div>
    </div>
  );
}
