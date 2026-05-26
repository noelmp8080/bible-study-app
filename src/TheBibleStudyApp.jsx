import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const BOOKS_OT = [
  ["Genesis",50],["Exodus",40],["Leviticus",27],["Numbers",36],["Deuteronomy",34],
  ["Joshua",24],["Judges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],
  ["1 Kings",22],["2 Kings",25],["1 Chronicles",29],["2 Chronicles",36],
  ["Ezra",10],["Nehemiah",13],["Esther",10],["Job",42],["Psalms",150],
  ["Proverbs",31],["Ecclesiastes",12],["Song of Solomon",8],["Isaiah",66],
  ["Jeremiah",52],["Lamentations",5],["Ezekiel",48],["Daniel",12],
  ["Hosea",14],["Joel",3],["Amos",9],["Obadiah",1],["Jonah",4],
  ["Micah",7],["Nahum",3],["Habakkuk",3],["Zephaniah",3],["Haggai",2],
  ["Zechariah",14],["Malachi",4]
];
const BOOKS_NT = [
  ["Matthew",28],["Mark",16],["Luke",24],["John",21],["Acts",28],
  ["Romans",16],["1 Corinthians",16],["2 Corinthians",13],["Galatians",6],
  ["Ephesians",6],["Philippians",4],["Colossians",4],["1 Thessalonians",5],
  ["2 Thessalonians",3],["1 Timothy",6],["2 Timothy",4],["Titus",3],
  ["Philemon",1],["Hebrews",13],["James",5],["1 Peter",5],["2 Peter",3],
  ["1 John",5],["2 John",1],["3 John",1],["Jude",1],["Revelation",22]
];

const DICT = {
  "Agape":         { type:"Greek: ἀγάπη",                  def:"Unconditional, self-sacrificing love — the highest form in the NT. Distinct from phileo (brotherly) and eros (romantic). The word used in John 3:16 and 1 Corinthians 13." },
  "Atonement":     { type:"Hebrew: כִּפֻּר (kippur)",        def:"The covering or propitiation of sin. The Day of Atonement (Yom Kippur) prefigured Christ's ultimate sacrifice on the cross (Lev. 16; Heb. 9:12)." },
  "Covenant":      { type:"Hebrew: בְּרִית (bĕrît)",         def:"A solemn, binding agreement. God established covenants with Noah, Abraham, Moses, David, and the New Covenant through Christ's blood (Jer. 31:31; Luke 22:20)." },
  "Faith":         { type:"Greek: πίστις (pistis)",         def:"Trust and reliance upon God. Saving faith is wholehearted confidence in Christ's person and work — not mere intellectual assent (Heb. 11:1; Eph. 2:8)." },
  "Gospel":        { type:"Greek: εὐαγγέλιον (euangelion)", def:"Good news — the saving work of Jesus Christ: his death, burial, and resurrection for the forgiveness of sins (1 Cor. 15:1–4)." },
  "Grace":         { type:"Greek: χάρις (charis)",          def:"Unmerited favour from God. A free gift of salvation given not through works but through faith in Christ. Grace is the very basis of redemption (Eph. 2:8)." },
  "Justification": { type:"Greek: δικαίωσις (dikaiōsis)",   def:"God's judicial act of declaring a sinner righteous based on Christ's atoning work. Declared righteous — a forensic term. Not made righteous but counted righteous (Rom. 4:25)." },
  "Messiah":       { type:"Hebrew: מָשִׁיחַ (māšîaḥ)",      def:"The Anointed One. Jesus is the promised Messiah — the ultimate Prophet, Priest, and King. The Greek equivalent is Christos (Dan. 9:25–26; John 1:41)." },
  "Propitiation":  { type:"Greek: ἱλαστήριον (hilastērion)", def:"The turning away of God's wrath through Christ's sacrifice. Jesus satisfies the just demands of God's holiness on our behalf (1 John 2:2; Rom. 3:25)." },
  "Redemption":    { type:"Greek: ἀπολύτρωσις (apolytrōsis)", def:"To buy back or ransom from bondage. Christ redeemed believers from the slavery of sin by paying the price — his blood — for their release (Eph. 1:7; Gal. 3:13)." },
  "Repentance":    { type:"Greek: μετάνοια (metanoia)",     def:"A change of mind and direction — turning from sin to God. More than sorrow; it involves a genuine turning of will, heart, and action (Acts 2:38; 2 Cor. 7:10)." },
  "Righteousness": { type:"Greek: δικαιοσύνη (dikaiosynē)", def:"Right standing before God. Imputed righteousness is received through faith in Christ — God declares the believer righteous on account of Christ's merits (Rom. 3:22)." },
  "Salvation":     { type:"Greek: σωτηρία (sōtēria)",       def:"Deliverance from sin and its consequences. Encompasses justification (past), sanctification (present), and glorification (future) — God's complete rescue plan (Eph. 2:8)." },
  "Sanctification":{ type:"Greek: ἁγιασμός (hagiasmos)",   def:"The ongoing process of becoming holy — set apart for God's purposes. Distinct from justification as the daily walk of growing in holiness (1 Thess. 4:3)." },
  "Sheol":         { type:"Hebrew: שְׁאוֹל (šĕʾôl)",        def:"The realm of the dead in the OT. Often translated 'grave' or 'pit' in the KJV. Paralleled in NT with Hades — with distinct compartments before the cross (Luke 16:19–31)." },
  "Trinity":       { type:"Theological term",               def:"One God in three co-equal, co-eternal Persons: Father, Son, and Holy Spirit. The doctrine is supported throughout both Testaments though the word is not in Scripture (Matt. 28:19)." },
};

const THEMES = {
  light: { bg:"#F8F4EC", surface:"#FFFFFF", surface2:"#EDE8DC", text:"#1C1C1E", muted:"#6B7280", header:"#0D1B2A", border:"rgba(0,0,0,0.09)", input:"#F0EBE0" },
  dark:  { bg:"#0D1420", surface:"#1A2333", surface2:"#243040", text:"#F0EDE6", muted:"#8892A0", header:"#070D15", border:"rgba(255,255,255,0.09)", input:"#1E2B3C" },
  sepia: { bg:"#F5EFDC", surface:"#FBF6EA", surface2:"#EDE0C4", text:"#3B2D1E", muted:"#8B7355", header:"#2C1F0E", border:"rgba(0,0,0,0.11)", input:"#EBE0C8" },
};

const GOLD  = "#C9A84C";
const DAILY = [
  { ref:"Proverbs 3:5",     text:"Trust in the LORD with all thine heart; and lean not unto thine own understanding." },
  { ref:"Philippians 4:13", text:"I can do all things through Christ which strengtheneth me." },
  { ref:"Jeremiah 29:11",   text:"For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil." },
  { ref:"Romans 8:28",      text:"And we know that all things work together for good to them that love God." },
  { ref:"Psalm 23:1",       text:"The LORD is my shepherd; I shall not want." },
  { ref:"Isaiah 40:31",     text:"But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles." },
  { ref:"John 3:16",        text:"For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
];
const PEN_COLORS = ["#1C1C1E","#0D1B2A","#C9A84C","#1A7A4A","#C0392B","#2471A3","#6C3483","#784212"];

function bookKey(name) {
  const map = {"1 Samuel":"1+samuel","2 Samuel":"2+samuel","1 Kings":"1+kings","2 Kings":"2+kings","1 Chronicles":"1+chronicles","2 Chronicles":"2+chronicles","Song of Solomon":"song+of+solomon","1 Corinthians":"1+corinthians","2 Corinthians":"2+corinthians","1 Thessalonians":"1+thessalonians","2 Thessalonians":"2+thessalonians","1 Timothy":"1+timothy","2 Timothy":"2+timothy","1 Peter":"1+peter","2 Peter":"2+peter","1 John":"1+john","2 John":"2+john","3 John":"3+john"};
  return map[name] || name.toLowerCase().replace(/ /g,"+");
}

// ─── APPLE PENCIL DRAWING CANVAS ─────────────────────────────────────────────
function DrawingCanvas({ onSave, onClose, T }) {
  const canvasRef  = useRef(null);
  const drawing    = useRef(false);
  const lastPos    = useRef(null);
  const allStrokes = useRef([]);
  const curStroke  = useRef([]);
  const [penColor, setPC] = useState("#1C1C1E");
  const [tool, setTool]   = useState("pen");
  const [penLabel, setPL] = useState("Pencil");

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.getContext("2d").fillStyle = "white";
    c.getContext("2d").fillRect(0, 0, c.width, c.height);
  }, []);

  function gPos(e) {
    const r  = canvasRef.current.getBoundingClientRect();
    const sx = canvasRef.current.width  / r.width;
    const sy = canvasRef.current.height / r.height;
    return { x:(e.clientX-r.left)*sx, y:(e.clientY-r.top)*sy };
  }

  function onDown(e) {
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPos.current = gPos(e);
    curStroke.current = [];
    if (e.pointerType==="pen")   setPL("Apple Pencil ✦");
    else if (e.pointerType==="touch") setPL("Finger");
    else setPL("Mouse");
  }

  function onMove(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = gPos(e);
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    const isPen = e.pointerType === "pen";
    let lw, stroke, alpha;
    if (tool==="eraser") { lw=24; stroke="white"; alpha=1; }
    else if (tool==="hi") { lw=20; stroke=penColor; alpha=0.28; }
    else { lw=isPen ? Math.max(0.8, pressure*5) : 2; stroke=penColor; alpha=1; }
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.lineWidth=lw; ctx.strokeStyle=stroke; ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.stroke(); ctx.globalAlpha=1;
    curStroke.current.push({ f:{...lastPos.current}, t:{...pos}, lw, stroke, alpha });
    lastPos.current = pos;
  }

  function onUp() {
    drawing.current = false;
    if (curStroke.current.length) allStrokes.current.push([...curStroke.current]);
    curStroke.current = [];
  }

  function undo() {
    allStrokes.current.pop();
    const c=canvasRef.current; const ctx=c.getContext("2d");
    ctx.fillStyle="white"; ctx.fillRect(0,0,c.width,c.height);
    allStrokes.current.forEach(s => s.forEach(seg => {
      ctx.globalAlpha=seg.alpha; ctx.beginPath(); ctx.moveTo(seg.f.x,seg.f.y);
      ctx.lineTo(seg.t.x,seg.t.y); ctx.lineWidth=seg.lw; ctx.strokeStyle=seg.stroke;
      ctx.lineCap="round"; ctx.lineJoin="round"; ctx.stroke(); ctx.globalAlpha=1;
    }));
  }

  function clearAll() {
    allStrokes.current=[];
    const c=canvasRef.current; const ctx=c.getContext("2d");
    ctx.fillStyle="white"; ctx.fillRect(0,0,c.width,c.height);
  }

  const tbtn = (id,ico,lbl) => (
    <button key={id} onClick={()=>setTool(id)} style={{ background:tool===id?GOLD:"transparent", border:`1px solid ${tool===id?GOLD:T.border}`, borderRadius:8, padding:"6px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4, color:tool===id?"#0D1B2A":T.text, fontSize:12, fontFamily:"inherit" }}>
      <i className={`ti ${ico}`} style={{fontSize:15}} aria-hidden="true"/>{lbl}
    </button>
  );

  return (
    <div style={{ background:T.surface, borderRadius:14, overflow:"hidden", border:`1px solid ${T.border}` }}>
      <div style={{ background:T.surface2, padding:"8px 10px", display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", borderBottom:`1px solid ${T.border}` }}>
        {tbtn("pen","ti-pencil","Pen")}
        {tbtn("hi","ti-highlight","Highlight")}
        {tbtn("eraser","ti-eraser","Eraser")}
        <div style={{ width:1, height:22, background:T.border, margin:"0 4px" }}/>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {PEN_COLORS.map(c=>(
            <button key={c} onClick={()=>setPC(c)} style={{ width:22, height:22, borderRadius:"50%", background:c, border:`2.5px solid ${penColor===c?GOLD:"transparent"}`, cursor:"pointer", flexShrink:0 }} aria-label={`Color ${c}`}/>
          ))}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:5 }}>
          <button onClick={undo} style={{ background:T.header, border:"none", borderRadius:8, padding:"6px 10px", color:"#F0EDE6", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:3, fontFamily:"inherit" }}>
            <i className="ti ti-arrow-back-up" style={{fontSize:14}} aria-hidden="true"/>Undo
          </button>
          <button onClick={clearAll} style={{ background:"rgba(192,57,43,.12)", border:"none", borderRadius:8, padding:"6px 10px", color:"#C0392B", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Clear</button>
        </div>
      </div>
      <div style={{ background:tool==="eraser"?"rgba(192,57,43,.06)":tool==="hi"?"rgba(201,168,76,.06)":"rgba(13,27,42,.04)", padding:"4px 12px", fontSize:10, color:T.muted, fontStyle:"italic", borderBottom:`1px solid ${T.border}` }}>
        {penLabel} · {tool==="pen"?"Pressure-sensitive ink":tool==="hi"?"Highlighter (transparent)":"Eraser"} · Draw below
      </div>
      <canvas ref={canvasRef} width={800} height={380}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ display:"block", width:"100%", height:"auto", touchAction:"none", cursor:tool==="eraser"?"cell":"crosshair", background:"white" }}
        aria-label="Drawing canvas"
      />
      <div style={{ display:"flex", gap:8, padding:"10px 12px", justifyContent:"flex-end", background:T.surface2 }}>
        <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:10, padding:"8px 16px", color:T.muted, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Discard</button>
        <button onClick={()=>onSave(canvasRef.current.toDataURL("image/png"))} style={{ background:GOLD, border:"none", borderRadius:10, padding:"8px 18px", color:"#0D1B2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          <i className="ti ti-check" style={{fontSize:14,marginRight:5}} aria-hidden="true"/>Save Drawing
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function BibleStudyApp() {
  const rootRef = useRef(null);
  const [cw, setCW]       = useState(400);
  const [tab, setTab]     = useState("read");
  const [theme, setTheme] = useState("light");
  const [fs, setFS]       = useState(17);

  // ── Preferences (Supabase-backed) ───────────────────────────────────
  const [prefId, setPrefId]   = useState(null);
  const [apiKey, setApiKey]   = useState(() => localStorage.getItem("bsa_api_key") || "");

  // ── Reader ──────────────────────────────────────────────────────────
  const [bookName, setBN]  = useState("John");
  const [chapter, setCh]   = useState(3);
  const [maxCh, setMC]     = useState(21);
  const [verses, setVs]    = useState([]);
  const [loading, setLd]   = useState(false);
  // hl: { [verseNum]: supabaseRowId } — truthy = highlighted
  const [hl, setHL]        = useState({});
  const [showBP, setSBP]   = useState(false);
  const [showCP, setSCP]   = useState(false);
  const daily = DAILY[new Date().getDay() % DAILY.length];

  // ── Notes (Supabase-backed) ─────────────────────────────────────────
  const [notes, setNotes]   = useState([]);
  const [showEditor, setSE] = useState(false);
  const [nTitle, setNT]     = useState("");
  const [nRef, setNR]       = useState("");
  const [nText, setNText]   = useState("");
  const [nTags, setNTg]     = useState("");
  const [recOn, setRec]     = useState(false);
  const [recT, setRT]       = useState(0);
  const [hasAudio, setHA]   = useState(false);
  const [hasImg, setHI]     = useState(false);
  const [drawing, setDraw]  = useState(null);
  const [showCanvas, setSC] = useState(false);
  const recRef = useRef(null);

  // ── AI ──────────────────────────────────────────────────────────────
  const [aiMsgs, setAI] = useState([{ role:"assistant", content:"Shalom! I'm your KJV Bible study companion. Ask me anything — theology, history, Greek & Hebrew word studies, or chapter expositions." }]);
  const [aiIn, setAIn]  = useState("");
  const [aiLd, setAL]   = useState(false);
  const chatEnd = useRef(null);

  // ── Search ──────────────────────────────────────────────────────────
  const [sRef, setSRef]   = useState("");
  const [sRes, setSRes]   = useState([]);
  const [sRef2, setSR2]   = useState("");
  const [sLd, setSL]      = useState(false);
  const [dQ, setDQ]       = useState("");
  const [odw, setODW]     = useState(null);

  const T = THEMES[theme];

  // ── Responsive width ────────────────────────────────────────────────
  useEffect(() => {
    if (!rootRef.current) return;
    const obs = new ResizeObserver(e => setCW(e[0].contentRect.width));
    obs.observe(rootRef.current);
    return () => obs.disconnect();
  }, []);

  const isMobile  = cw < 640;
  const isTablet  = cw >= 640 && cw < 1024;
  const isDesktop = cw >= 1024;

  // ── Load Supabase data on mount ──────────────────────────────────────
  useEffect(() => { loadPrefs(); loadNotes(); }, []);

  // ── Fetch chapter + highlights ───────────────────────────────────────
  useEffect(() => { fetchCh(); }, [bookName, chapter]);

  // ── Supabase: preferences ────────────────────────────────────────────
  async function loadPrefs() {
    const { data } = await supabase.from("preferences").select("*").limit(1).maybeSingle();
    if (data) {
      setTheme(data.theme || "light");
      setFS(data.font_size || 17);
      setPrefId(data.id);
    }
  }

  async function savePrefsDB(t, f) {
    const payload = { theme: t, font_size: f, updated_at: new Date().toISOString() };
    if (prefId) {
      await supabase.from("preferences").update(payload).eq("id", prefId);
    } else {
      const { data } = await supabase.from("preferences").insert(payload).select().single();
      if (data) setPrefId(data.id);
    }
  }

  function changeTheme(t) { setTheme(t); savePrefsDB(t, fs); }
  function incFS() { const n = Math.min(28, fs + 1); setFS(n); savePrefsDB(theme, n); }
  function decFS() { const n = Math.max(12, fs - 1); setFS(n); savePrefsDB(theme, n); }

  function handleApiKey(val) { setApiKey(val); localStorage.setItem("bsa_api_key", val); }

  // ── Supabase: highlights ─────────────────────────────────────────────
  async function fetchCh() {
    setLd(true); setVs([]); setHL({});
    const [verseResult, hlResult] = await Promise.all([
      fetch(`https://bible-api.com/${bookKey(bookName)}+${chapter}?translation=kjv`)
        .then(r => r.json())
        .catch(() => ({ verses: [{ verse:1, text:"Network error — please check your internet connection." }] })),
      supabase.from("highlights").select("*").eq("book", bookName).eq("chapter", chapter),
    ]);
    setVs(verseResult.verses || [{ verse:1, text:"Unable to load chapter. Please check your connection." }]);
    setLd(false);
    if (hlResult.data) {
      const map = {};
      hlResult.data.forEach(h => { map[h.verse] = h.id; });
      setHL(map);
    }
  }

  function pickBook(name, chs) { setBN(name); setMC(chs); setCh(1); setSBP(false); }

  async function toggleHL(n) {
    if (hl[n]) {
      await supabase.from("highlights").delete().eq("id", hl[n]);
      setHL(p => { const x = {...p}; delete x[n]; return x; });
    } else {
      const { data } = await supabase.from("highlights")
        .insert({ book: bookName, chapter, verse: n, color: "gold" })
        .select().single();
      if (data) setHL(p => ({ ...p, [n]: data.id }));
    }
  }

  // ── Supabase: notes ──────────────────────────────────────────────────
  async function loadNotes() {
    const { data } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
    if (data) setNotes(data.map(n => ({
      ...n,
      date:     new Date(n.created_at).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
      hasAudio: n.has_audio,
      hasImg:   n.has_image,
      drawing:  n.drawing?.dataUrl || null,
    })));
  }

  function toggleRec() {
    if (!recOn) { setRec(true); setRT(0); recRef.current = setInterval(() => setRT(t => t+1), 1000); }
    else { setRec(false); setHA(true); clearInterval(recRef.current); }
  }

  async function saveNote() {
    if (!nTitle.trim()) return;
    const tags = nTags.split(",").map(t => t.trim()).filter(Boolean);
    const ref  = nRef.trim() || `${bookName} ${chapter}`;
    const { data } = await supabase.from("notes").insert({
      title: nTitle.trim(), ref, text: nText.trim(), tags,
      has_audio: hasAudio, has_image: hasImg,
      drawing: drawing ? { dataUrl: drawing } : null,
    }).select().single();
    if (data) {
      setNotes(p => [{
        ...data,
        date:     new Date(data.created_at).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
        hasAudio: data.has_audio,
        hasImg:   data.has_image,
        drawing:  data.drawing?.dataUrl || null,
      }, ...p]);
    }
    setNT(""); setNR(""); setNText(""); setNTg("");
    setHA(false); setHI(false); setRec(false); setDraw(null);
    clearInterval(recRef.current); setSE(false);
  }

  function deleteNote(id) {
    supabase.from("notes").delete().eq("id", id);
    setNotes(p => p.filter(x => x.id !== id));
  }

  // ── AI ───────────────────────────────────────────────────────────────
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [aiMsgs, aiLd]);

  async function sendAI(override) {
    const msg = override || aiIn.trim();
    if (!msg || aiLd) return;
    if (!apiKey) { alert("Add your Anthropic API key in Preferences."); return; }
    setAIn(""); setAL(true);
    const upd = [...aiMsgs, { role:"user", content:msg }]; setAI(upd);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: "You are a deeply knowledgeable, pastoral Bible study assistant for 'The Bible Study App.' Study exclusively from the King James Version (KJV). Provide theological depth, historical context, and original Greek/Hebrew insights. Always cite specific KJV references. Be warm, reverent, and thorough. Format concisely for reading.",
          messages: upd.map(m => ({ role:m.role, content:m.content })),
        }),
      });
      const d = await r.json();
      const reply = d.content?.find(c => c.type==="text")?.text || "Unable to respond. Try again.";
      setAI(p => [...p, { role:"assistant", content:reply }]);
    } catch {
      setAI(p => [...p, { role:"assistant", content:"Connection error. Please check your internet connection." }]);
    }
    setAL(false);
  }

  async function smartSummary() {
    if (!apiKey) { alert("Add your Anthropic API key in Preferences."); return; }
    const ref = nRef.trim() || `${bookName} ${chapter}`;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 600,
          system: "You are a KJV Bible study assistant. Format your response exactly as:\n\nOVERVIEW:\n[2 sentences]\n\nKEY POINTS:\n• [point 1]\n• [point 2]\n• [point 3]\n\nEXPOSITION:\n[2-3 sentences of theological insight]\n\nBe concise and KJV-focused.",
          messages: [{ role:"user", content:`Smart study summary for ${ref} (KJV)` }],
        }),
      });
      const d = await r.json();
      const txt = d.content?.find(c => c.type==="text")?.text || "";
      setNText(p => p ? p + "\n\n" + txt : txt);
    } catch {
      setNText(p => p + "\n\n[Summary unavailable — check connection]");
    }
  }

  // ── Search ───────────────────────────────────────────────────────────
  async function doSearch() {
    if (!sRef.trim()) return; setSL(true); setSRes([]); setSR2(sRef);
    try {
      const r = await fetch(`https://bible-api.com/${sRef.trim().replace(/ /g,"+")}?translation=kjv`);
      const d = await r.json();
      setSRes(d.verses ? d.verses.map(v => ({ ...v, fullRef:d.reference })) : []);
    } catch { setSRes([]); }
    setSL(false);
  }

  const dictF = Object.entries(DICT).filter(([k]) => dQ ? k.toLowerCase().includes(dQ.toLowerCase()) : true);
  const fmt = t => `${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`;

  // ─── STYLE HELPERS ───────────────────────────────────────────────────
  const pill    = () => ({ background:"rgba(201,168,76,.15)", border:"1px solid rgba(201,168,76,.3)", borderRadius:20, padding:isMobile?"5px 11px":"6px 14px", display:"flex", alignItems:"center", gap:5, cursor:"pointer" });
  const pTxt    = { color:GOLD, fontSize:isMobile?13:14, fontWeight:500 };
  const card    = { background:T.surface, borderRadius:14, padding:isDesktop?"16px 18px":"13px 15px", border:`1px solid ${T.border}`, marginBottom:10 };
  const inp     = { width:"100%", background:T.input, border:`1px solid ${T.border}`, borderRadius:10, padding:"9px 12px", fontSize:13, fontFamily:"inherit", color:T.text, outline:"none", boxSizing:"border-box" };
  const btn     = (v="def") => ({ background:v==="gold"?GOLD:v==="red"?"#C0392B":T.header, border:"none", borderRadius:20, padding:isTablet||isDesktop?"9px 18px":"7px 14px", color:v==="gold"?"#0D1B2A":"#F0EDE6", fontSize:isDesktop?13:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5, transition:"opacity .15s", whiteSpace:"nowrap" });
  const overlay = { position:"absolute", inset:0, background:"rgba(0,0,0,.6)", zIndex:20, display:"flex", flexDirection:"column", justifyContent:"flex-end" };
  const sheet   = (big) => ({ background:T.surface, borderRadius:"20px 20px 0 0", padding:isTablet||isDesktop?22:16, maxHeight:big?"90%":"80%", overflowY:"auto", border:`2px solid ${GOLD}` });

  // ─── NAV ─────────────────────────────────────────────────────────────
  const NAV = [["read","ti-book-2","Read"],["notes","ti-notebook","Notes"],["ai","ti-sparkles","Ask AI"],["search","ti-search","Search"],["settings","ti-settings","Prefs"]];

  // ─── SIDEBAR ─────────────────────────────────────────────────────────
  const Sidebar = () => (
    <div style={{ background:T.header, width:isDesktop?200:64, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", paddingTop:12, borderRight:`1px solid rgba(201,168,76,.15)`, minHeight:"100%" }}>
      <div style={{ padding:isDesktop?"14px 16px 18px":"12px 0 16px", textAlign:"center", borderBottom:"1px solid rgba(201,168,76,.15)", width:"100%", marginBottom:8 }}>
        {isDesktop
          ? <><div style={{ color:GOLD, fontFamily:"'Playfair Display',Georgia,serif", fontSize:14, fontWeight:600, lineHeight:1.3 }}>✦ The Bible<br/>Study App</div><div style={{ color:"rgba(255,255,255,.4)", fontSize:10, marginTop:4 }}>KJV · 1611</div></>
          : <div style={{ color:GOLD, fontSize:18, fontFamily:"'Playfair Display',Georgia,serif" }}>✦</div>
        }
      </div>
      {NAV.map(([id,ico,lbl]) => (
        <div key={id} onClick={() => setTab(id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:isDesktop?"10px 14px":"12px 8px", width:"100%", cursor:"pointer", background:tab===id?"rgba(201,168,76,.12)":"transparent", borderRight:tab===id?`2px solid ${GOLD}`:"2px solid transparent", boxSizing:"border-box", marginBottom:2 }}>
          <i className={`ti ${ico}`} style={{ fontSize:isDesktop?20:22, color:tab===id?GOLD:"rgba(255,255,255,.5)" }} aria-hidden="true"/>
          {isDesktop && <span style={{ fontSize:12, color:tab===id?GOLD:"rgba(255,255,255,.45)", fontWeight:500, letterSpacing:.3 }}>{lbl}</span>}
        </div>
      ))}
      <div style={{ marginTop:"auto", padding:10, width:"100%", borderTop:"1px solid rgba(201,168,76,.15)" }}>
        {isDesktop && <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:1, color:"rgba(255,255,255,.3)", marginBottom:6, textAlign:"center" }}>Theme</div>}
        <div style={{ display:"flex", gap:4, justifyContent:"center" }}>
          {[["light","☀"],["dark","🌙"],["sepia","📜"]].map(([t,e]) => (
            <button key={t} onClick={() => changeTheme(t)} title={t} style={{ background:theme===t?"rgba(201,168,76,.2)":"transparent", border:`1px solid ${theme===t?GOLD:"transparent"}`, borderRadius:8, padding:"5px 6px", cursor:"pointer", fontSize:isDesktop?14:13 }}>{e}</button>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── BOTTOM NAV ──────────────────────────────────────────────────────
  const BottomNav = () => (
    <div style={{ background:T.header, padding:"8px 0 10px", display:"flex", borderTop:`1px solid rgba(201,168,76,.2)`, flexShrink:0 }}>
      {NAV.map(([id,ico,lbl]) => (
        <div key={id} onClick={() => setTab(id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, cursor:"pointer", flex:1 }}>
          <i className={`ti ${ico}`} style={{ fontSize:21, color:tab===id?GOLD:T.muted }} aria-hidden="true"/>
          <span style={{ fontSize:9, color:tab===id?GOLD:T.muted, fontWeight:500, letterSpacing:.3, textTransform:"uppercase" }}>{lbl}</span>
        </div>
      ))}
    </div>
  );

  // ─── TOP BAR ─────────────────────────────────────────────────────────
  const TopBar = ({ title, sub, right }) => (
    <div style={{ background:T.header, padding:isDesktop?"14px 22px":"11px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
      <div>
        <div style={{ color:GOLD, fontFamily:"'Playfair Display',Georgia,serif", fontSize:isDesktop?20:17, fontWeight:600 }}>{title}</div>
        {sub && <div style={{ color:"rgba(255,255,255,.45)", fontSize:11, marginTop:2 }}>{sub}</div>}
      </div>
      {right && <div style={{ display:"flex", gap:10, alignItems:"center" }}>{right}</div>}
    </div>
  );

  // ─── READER ──────────────────────────────────────────────────────────
  const ReaderContent = () => (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      <TopBar title="The Bible Study App" sub="King James Version · 1611"
        right={<>
          <i className="ti ti-bookmark" style={{ color:"rgba(255,255,255,.7)", fontSize:isDesktop?22:20, cursor:"pointer" }} aria-hidden="true"/>
          <i className="ti ti-share"    style={{ color:"rgba(255,255,255,.7)", fontSize:isDesktop?22:20, cursor:"pointer" }} aria-hidden="true"/>
        </>}
      />
      <div style={{ background:"#1A2D42", padding:"8px 14px", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
        <div style={pill()} onClick={() => setSBP(true)}>
          <i className="ti ti-book-2" style={{ color:GOLD, fontSize:13 }} aria-hidden="true"/>
          <span style={pTxt}>{bookName}</span>
          <i className="ti ti-chevron-down" style={{ color:GOLD, fontSize:12 }} aria-hidden="true"/>
        </div>
        <div style={pill()} onClick={() => setSCP(true)}>
          <span style={pTxt}>Ch. {chapter}</span>
          <i className="ti ti-chevron-down" style={{ color:GOLD, fontSize:12 }} aria-hidden="true"/>
        </div>
        <div style={{ ...pill(), marginLeft:"auto", cursor:"default" }}>
          <span style={{ ...pTxt, fontSize:12 }}>KJV</span>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:0 }}>
        <div style={{ margin:isDesktop?"16px 20px":"12px 14px", background:T.header, borderRadius:14, padding:isDesktop?"16px 20px":"13px 16px", border:"1px solid rgba(201,168,76,.3)" }}>
          <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:1, color:GOLD, marginBottom:4 }}>✦ Verse of the Day</div>
          <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:isDesktop?15:13, color:"#F0EDE6", lineHeight:1.8, fontStyle:"italic" }}>"{daily.text}"</div>
          <div style={{ fontSize:10, color:GOLD, marginTop:6 }}>{daily.ref}</div>
        </div>
        <div style={{ padding:isDesktop?"16px 22px 10px":"14px 18px 8px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:isDesktop?26:22, color:T.text, fontWeight:600 }}>{bookName} {chapter}</div>
          <div style={{ fontSize:11, color:T.muted, marginTop:3 }}>King James Version · tap a verse to highlight</div>
        </div>
        {loading && <div style={{ padding:32, textAlign:"center", color:T.muted, fontStyle:"italic" }}>Loading scripture…</div>}
        {verses.map(v => (
          <div key={v.verse} onClick={() => toggleHL(v.verse)}
            style={{ padding:isDesktop?"11px 22px":"10px 18px", cursor:"pointer", background:hl[v.verse]?"rgba(201,168,76,.1)":"transparent", borderLeft:hl[v.verse]?`3px solid ${GOLD}`:"3px solid transparent", transition:"background .15s" }}>
            <span style={{ fontSize:isDesktop?11:10, fontWeight:700, color:GOLD, marginRight:6, verticalAlign:"super" }}>{v.verse}</span>
            <span style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:fs, lineHeight:1.9, color:T.text }}>{v.text?.trim()}</span>
            {hl[v.verse] && (
              <div style={{ display:"flex", gap:6, marginTop:9, flexWrap:"wrap" }}>
                {[["Highlight","ti-highlight"],["Add Note","ti-notebook"],["Ask AI","ti-sparkles"],["Copy","ti-copy"],["Share","ti-share"]].map(([lbl,ico]) => (
                  <button key={lbl} onClick={e => {
                    e.stopPropagation();
                    if (lbl==="Add Note") { setNR(`${bookName} ${chapter}:${v.verse}`); setTab("notes"); setSE(true); }
                    if (lbl==="Ask AI")   { setAIn(`Please explain ${bookName} ${chapter}:${v.verse} — "${v.text?.slice(0,60)}…" with historical and theological context from the KJV.`); setTab("ai"); }
                    if (lbl==="Copy")     { navigator.clipboard.writeText(`"${v.text?.trim()}" — ${bookName} ${chapter}:${v.verse} (KJV)`); }
                  }} style={{ background:T.header, border:"none", borderRadius:12, padding:"5px 11px", color:"#F0EDE6", fontSize:11, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4, minHeight:32 }}>
                    <i className={`ti ${ico}`} style={{fontSize:12}} aria-hidden="true"/>{lbl}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {verses.length > 0 && (
          <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 18px", gap:8, borderTop:`1px solid ${T.border}` }}>
            <button onClick={() => chapter>1 && setCh(c => c-1)} disabled={chapter<=1} style={{ ...btn(), opacity:chapter<=1?.35:1 }}><i className="ti ti-arrow-left" aria-hidden="true"/>Previous</button>
            <button onClick={() => chapter<maxCh && setCh(c => c+1)} disabled={chapter>=maxCh} style={{ ...btn(), opacity:chapter>=maxCh?.35:1 }}>Next<i className="ti ti-arrow-right" aria-hidden="true"/></button>
          </div>
        )}
        <div style={{height:12}}/>
      </div>
    </div>
  );

  // ─── NOTES ───────────────────────────────────────────────────────────
  const NotesContent = () => (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      <TopBar title="✦ My Notes" sub={`${notes.length} notes · KJV`}
        right={<button onClick={() => setSE(true)} style={btn("gold")}><i className="ti ti-plus" aria-hidden="true"/>New Note</button>}
      />
      <div style={{ flex:1, overflowY:"auto", padding:isDesktop?"14px 18px":"10px 14px" }}>
        {notes.length===0 && <div style={{ padding:"40px 20px", textAlign:"center", color:T.muted, fontStyle:"italic" }}>No notes yet. Tap "New Note" to begin your study journal.</div>}
        <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(2,1fr)":"1fr", gap:10 }}>
          {notes.map(n => (
            <div key={n.id} style={card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
                <div style={{ fontSize:isDesktop?15:14, fontWeight:500, color:T.text, flex:1, marginRight:8 }}>{n.title}</div>
                <div style={{ fontSize:10, color:T.muted, flexShrink:0 }}>{n.date}</div>
              </div>
              {n.ref && <div style={{ fontSize:11, color:GOLD, fontWeight:600, marginBottom:6, fontFamily:"'Playfair Display',Georgia,serif", fontStyle:"italic" }}>{n.ref}</div>}
              <div style={{ fontSize:13, color:T.muted, lineHeight:1.7 }}>{n.text}</div>
              {n.drawing && <img src={n.drawing} alt="Handwritten note" style={{ width:"100%", borderRadius:8, marginTop:8, border:`1px solid ${T.border}` }}/>}
              {n.tags?.length > 0 && (
                <div style={{ display:"flex", gap:5, marginTop:9, flexWrap:"wrap" }}>
                  {n.tags.map(t => <span key={t} style={{ background:"rgba(201,168,76,.1)", border:"1px solid rgba(201,168,76,.3)", borderRadius:8, padding:"2px 8px", fontSize:10, color:GOLD }}>{t}</span>)}
                </div>
              )}
              <div style={{ display:"flex", gap:6, marginTop:9, flexWrap:"wrap", alignItems:"center" }}>
                {n.hasAudio && <div style={{ background:T.surface2, borderRadius:8, padding:"3px 9px", fontSize:10, color:T.muted, display:"flex", alignItems:"center", gap:4 }}><i className="ti ti-microphone" style={{fontSize:12}} aria-hidden="true"/>Audio</div>}
                {n.hasImg   && <div style={{ background:T.surface2, borderRadius:8, padding:"3px 9px", fontSize:10, color:T.muted, display:"flex", alignItems:"center", gap:4 }}><i className="ti ti-photo" style={{fontSize:12}} aria-hidden="true"/>Photo</div>}
                {n.drawing  && <div style={{ background:"rgba(201,168,76,.1)", border:"1px solid rgba(201,168,76,.2)", borderRadius:8, padding:"3px 9px", fontSize:10, color:GOLD, display:"flex", alignItems:"center", gap:4 }}><i className="ti ti-pencil" style={{fontSize:12}} aria-hidden="true"/>Drawing</div>}
                <button onClick={() => deleteNote(n.id)} style={{ background:"rgba(192,57,43,.1)", border:"none", borderRadius:8, padding:"4px 10px", fontSize:10, color:"#C0392B", cursor:"pointer", marginLeft:"auto", display:"flex", alignItems:"center", gap:3, minHeight:28 }}>
                  <i className="ti ti-trash" style={{fontSize:12}} aria-hidden="true"/>Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <div style={{height:12}}/>
      </div>
    </div>
  );

  // ─── AI ──────────────────────────────────────────────────────────────
  const AIContent = () => (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      <TopBar title="✦ Ask the Word" sub="AI Bible study assistant · KJV only"/>
      <div style={{ background:"#1A2D42", padding:"8px 12px", display:"flex", gap:7, overflowX:"auto", flexShrink:0 }}>
        {["What is grace?","Pharisees explained","Explain the Trinity","Psalm 23 exposition","What is Sheol?","Romans 8 overview","The Beatitudes"].map(q => (
          <div key={q} onClick={() => sendAI(q)} style={{ background:"rgba(201,168,76,.1)", border:"1px solid rgba(201,168,76,.25)", borderRadius:20, padding:isDesktop?"6px 14px":"5px 11px", whiteSpace:"nowrap", fontSize:isDesktop?13:11, color:GOLD, cursor:"pointer", flexShrink:0 }}>{q}</div>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
        {aiMsgs.map((m,i) => (
          <div key={i} style={{ alignSelf:m.role==="user"?"flex-end":"flex-start", background:m.role==="user"?"#0D1B2A":T.surface, border:m.role==="assistant"?`1px solid ${T.border}`:"none", borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px", padding:"11px 15px", maxWidth:isDesktop?"70%":"88%" }}>
            <div style={{ fontSize:isDesktop?14:13, lineHeight:1.8, color:m.role==="user"?"#F0EDE6":T.text, whiteSpace:"pre-wrap" }}>{m.content}</div>
          </div>
        ))}
        {aiLd && (
          <div style={{ alignSelf:"flex-start", background:T.surface, border:`1px solid ${T.border}`, borderRadius:"16px 16px 16px 4px", padding:"11px 15px" }}>
            <div style={{ fontSize:13, color:T.muted, fontStyle:"italic" }}>Searching the scriptures…</div>
          </div>
        )}
        <div ref={chatEnd}/>
      </div>
      <div style={{ background:T.surface, borderTop:`1px solid ${T.border}`, padding:"10px 14px", display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
        <input value={aiIn} onChange={e => setAIn(e.target.value)} onKeyDown={e => e.key==="Enter" && sendAI()}
          placeholder="Ask anything about the Bible…"
          style={{ flex:1, background:T.input, border:`1px solid ${T.border}`, borderRadius:20, padding:"9px 14px", fontSize:13, fontFamily:"inherit", color:T.text, outline:"none" }}
          aria-label="AI Bible question"
        />
        <button onClick={() => sendAI()} disabled={aiLd} style={{ background:GOLD, border:"none", borderRadius:"50%", width:40, height:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", opacity:aiLd?.5:1 }} aria-label="Send">
          <i className="ti ti-arrow-up" style={{ color:"#0D1B2A", fontSize:18 }} aria-hidden="true"/>
        </button>
      </div>
    </div>
  );

  // ─── SEARCH / CONCORDANCE ─────────────────────────────────────────────
  const SearchContent = () => (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      <TopBar title="✦ Concordance" sub="Verses · Bible Dictionary · Word Study"/>
      <div style={{ background:"#1A2D42", padding:"10px 14px", flexShrink:0 }}>
        <div style={{ display:"flex", gap:7 }}>
          <input value={sRef} onChange={e => setSRef(e.target.value)} onKeyDown={e => e.key==="Enter" && doSearch()}
            placeholder="Reference (e.g. Romans 8:28 or John 1:1-5)"
            style={{ flex:1, background:"rgba(255,255,255,.1)", border:"1px solid rgba(201,168,76,.25)", borderRadius:20, padding:"9px 15px", fontSize:13, color:"#F0EDE6", fontFamily:"inherit", outline:"none" }}
            aria-label="Verse reference search"
          />
          <button onClick={doSearch} style={{ background:GOLD, border:"none", borderRadius:"50%", width:40, height:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }} aria-label="Search">
            <i className="ti ti-search" style={{ color:"#0D1B2A", fontSize:17 }} aria-hidden="true"/>
          </button>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>
        {sLd && <div style={{ padding:20, textAlign:"center", color:T.muted, fontStyle:"italic" }}>Searching…</div>}
        {!sLd && sRes.length > 0 && (
          <>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>Results — {sRes[0]?.fullRef}</div>
            <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(2,1fr)":"1fr", gap:8, marginBottom:16 }}>
              {sRes.map((v,i) => (
                <div key={i} style={{...card,margin:0}}>
                  <div style={{ fontSize:11, fontWeight:700, color:GOLD, marginBottom:5 }}>{v.fullRef} · v.{v.verse}</div>
                  <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:isDesktop?15:14, color:T.text, lineHeight:1.85 }}>{v.text?.trim()}</div>
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <button onClick={() => { setNR(v.fullRef+":"+v.verse); setTab("notes"); setSE(true); }} style={{...btn(),fontSize:11,padding:"4px 10px"}}><i className="ti ti-notebook" style={{fontSize:12}} aria-hidden="true"/>Note</button>
                    <button onClick={() => { setAIn(`Explain ${v.fullRef}:${v.verse} — "${v.text?.slice(0,60)}…" with KJV context.`); setTab("ai"); }} style={{...btn(),fontSize:11,padding:"4px 10px"}}><i className="ti ti-sparkles" style={{fontSize:12}} aria-hidden="true"/>Ask AI</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {!sLd && sRes.length===0 && sRef2 && (
          <div style={{...card, textAlign:"center", color:T.muted, fontSize:13, marginBottom:16}}>No results. Try a valid reference (e.g. "John 3" or "Genesis 1:1-3").</div>
        )}
        <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>Bible Dictionary & Word Study</div>
        <input value={dQ} onChange={e => setDQ(e.target.value)} placeholder="Filter terms…" style={{...inp,marginBottom:10}} aria-label="Filter dictionary"/>
        <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(2,1fr)":"1fr", gap:8 }}>
          {dictF.map(([word,entry]) => (
            <div key={word} onClick={() => setODW(odw===word?null:word)}
              style={{ background:T.header, borderRadius:12, padding:"13px 15px", border:"1px solid rgba(201,168,76,.2)", cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:15, color:GOLD, fontWeight:600 }}>{word}</div>
                <i className={`ti ${odw===word?"ti-chevron-up":"ti-chevron-down"}`} style={{ color:"rgba(255,255,255,.4)", fontSize:14 }} aria-hidden="true"/>
              </div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,.4)", textTransform:"uppercase", letterSpacing:.5, marginTop:2 }}>{entry.type}</div>
              {odw===word && <div style={{ fontSize:12, color:"rgba(255,255,255,.78)", lineHeight:1.78, marginTop:8, borderTop:"1px solid rgba(255,255,255,.1)", paddingTop:8 }}>{entry.def}</div>}
            </div>
          ))}
        </div>
        <div style={{height:16}}/>
      </div>
    </div>
  );

  // ─── SETTINGS ─────────────────────────────────────────────────────────
  const SettingsContent = () => (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      <TopBar title="✦ Preferences" sub="Personalize your study experience"/>
      <div style={{ flex:1, overflowY:"auto", padding:isDesktop?"16px 20px":"14px" }}>
        <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(2,1fr)":"1fr", gap:10 }}>
          <div>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>Appearance</div>
            <div style={{...card, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <i className="ti ti-palette" style={{ fontSize:20, color:T.text }} aria-hidden="true"/>
                <div><div style={{ fontSize:14, fontWeight:500, color:T.text }}>Theme</div><div style={{ fontSize:11, color:T.muted }}>Reading background</div></div>
              </div>
              <div style={{ display:"flex", gap:5 }}>
                {[["light","Light","#F8F4EC","#1C1C1E"],["dark","Dark","#0D1B2A","#F0EDE6"],["sepia","Sepia","#F5EFDC","#3B2D1E"]].map(([id,lbl,bg,fg]) => (
                  <button key={id} onClick={() => changeTheme(id)} style={{ borderRadius:8, padding:"6px 10px", fontSize:12, cursor:"pointer", border:`2px solid ${theme===id?GOLD:"transparent"}`, background:bg, color:fg, fontFamily:"inherit", fontWeight:theme===id?500:400 }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{...card, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <i className="ti ti-text-size" style={{ fontSize:20, color:T.text }} aria-hidden="true"/>
                <div><div style={{ fontSize:14, fontWeight:500, color:T.text }}>Font Size</div><div style={{ fontSize:11, color:T.muted }}>Currently {fs}px</div></div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={decFS} style={{ width:32, height:32, background:T.header, borderRadius:8, border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }} aria-label="Decrease font size"><i className="ti ti-minus" style={{ color:"#F0EDE6", fontSize:14 }} aria-hidden="true"/></button>
                <span style={{ fontSize:16, color:T.text, minWidth:28, textAlign:"center", fontWeight:600 }}>{fs}</span>
                <button onClick={incFS} style={{ width:32, height:32, background:T.header, borderRadius:8, border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }} aria-label="Increase font size"><i className="ti ti-plus" style={{ color:"#F0EDE6", fontSize:14 }} aria-hidden="true"/></button>
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>AI Scholar</div>
            <div style={{...card}}>
              <div style={{ fontSize:14, fontWeight:500, color:T.text, marginBottom:6 }}>Anthropic API Key</div>
              <input type="password" value={apiKey} onChange={e => handleApiKey(e.target.value)}
                placeholder="sk-ant-…"
                style={{...inp, marginBottom:6}}
                aria-label="Anthropic API key"
              />
              <div style={{ fontSize:11, color:T.muted, lineHeight:1.5 }}>Get a free key at console.anthropic.com. Stored in your browser only.</div>
            </div>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8, marginTop:4 }}>Translation</div>
            <div style={{...card, display:"flex", alignItems:"center", gap:12}}>
              <i className="ti ti-book" style={{ fontSize:22, color:T.text }} aria-hidden="true"/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:500, color:T.text }}>King James Version</div>
                <div style={{ fontSize:11, color:T.muted }}>KJV · 1611 Authorized Version</div>
              </div>
              <div style={{ background:"rgba(201,168,76,.12)", border:"1px solid rgba(201,168,76,.35)", borderRadius:8, padding:"4px 10px", fontSize:11, color:GOLD, fontWeight:600 }}>Active</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>About</div>
          <div style={{...card}}>
            <div style={{ fontSize:15, fontWeight:500, color:T.text, marginBottom:4 }}>The Bible Study App</div>
            <div style={{ fontSize:13, color:T.muted, lineHeight:1.75 }}>A full-featured KJV Bible companion with AI-powered insights, concordance, Bible dictionary, rich notes with Apple Pencil drawing — fully responsive across phone, iPad, and desktop. Notes and highlights sync to Supabase across all your devices.</div>
            <div style={{ fontSize:11, color:GOLD, marginTop:8 }}>Version 2.0 · KJV Only · Powered by Claude AI · Synced via Supabase</div>
          </div>
        </div>
        <div style={{height:12}}/>
      </div>
    </div>
  );

  // ─── CONTENT ROUTER ──────────────────────────────────────────────────
  const Content = () => {
    if (tab==="read")     return <ReaderContent/>;
    if (tab==="notes")    return <NotesContent/>;
    if (tab==="ai")       return <AIContent/>;
    if (tab==="search")   return <SearchContent/>;
    if (tab==="settings") return <SettingsContent/>;
    return null;
  };

  // ─── RENDER ──────────────────────────────────────────────────────────
  return (
    <div ref={rootRef} style={{ width:"100%", background:T.bg, fontFamily:"'DM Sans','Segoe UI',sans-serif", position:"relative", minHeight:isMobile?580:640, display:"flex", flexDirection:"column" }}>

      <div style={{ display:"flex", flex:1, minHeight:0, height:"100%" }}>
        {!isMobile && <Sidebar/>}
        <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, overflow:"hidden" }}>
          <Content/>
          {isMobile && <BottomNav/>}
        </div>
      </div>

      {/* ══ BOOK PICKER ════════════════════════════════════════════ */}
      {showBP && (
        <div style={overlay} onClick={() => setSBP(false)}>
          <div style={sheet(true)} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:17, fontWeight:500, color:T.text, fontFamily:"'Playfair Display',Georgia,serif" }}>Select Book</span>
              <button onClick={() => setSBP(false)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, padding:4 }}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
            </div>
            {[["Old Testament",BOOKS_OT],["New Testament",BOOKS_NT]].map(([label,list]) => (
              <div key={label} style={{marginBottom:14}}>
                <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>{label}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {list.map(([name,chs]) => (
                    <button key={name} onClick={() => pickBook(name,chs)}
                      style={{ background:bookName===name?GOLD:T.surface2, border:`1px solid ${bookName===name?GOLD:T.border}`, borderRadius:8, padding:isTablet||isDesktop?"7px 12px":"5px 9px", fontSize:isTablet||isDesktop?13:11, color:bookName===name?"#0D1B2A":T.text, cursor:"pointer", fontFamily:"inherit", fontWeight:bookName===name?500:400, minHeight:36 }}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ CHAPTER PICKER ═════════════════════════════════════════ */}
      {showCP && (
        <div style={overlay} onClick={() => setSCP(false)}>
          <div style={sheet(false)} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:17, fontWeight:500, color:T.text }}>{bookName} — Chapter</span>
              <button onClick={() => setSCP(false)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, padding:4 }}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {Array.from({length:maxCh},(_,i)=>i+1).map(n => (
                <button key={n} onClick={() => { setCh(n); setSCP(false); }}
                  style={{ width:isTablet||isDesktop?52:46, height:isTablet||isDesktop?52:46, background:chapter===n?GOLD:T.surface2, border:`1px solid ${chapter===n?GOLD:T.border}`, borderRadius:10, fontSize:isTablet||isDesktop?15:13, fontWeight:chapter===n?600:400, color:chapter===n?"#0D1B2A":T.text, cursor:"pointer", fontFamily:"inherit" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ NOTE EDITOR ════════════════════════════════════════════ */}
      {showEditor && (
        <div style={overlay}>
          <div style={sheet(true)} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:17, fontWeight:500, color:T.text, fontFamily:"'Playfair Display',Georgia,serif" }}>New Study Note</span>
              <button onClick={() => { setSE(false); setRec(false); clearInterval(recRef.current); setSC(false); }} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, padding:4 }}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
            </div>
            <input value={nTitle} onChange={e => setNT(e.target.value)} placeholder="Note title…" style={{...inp,marginBottom:9}} aria-label="Note title"/>
            <input value={nRef}   onChange={e => setNR(e.target.value)} placeholder="Verse reference (e.g. John 3:16)" style={{...inp,marginBottom:9}} aria-label="Verse reference"/>
            <textarea value={nText} onChange={e => setNText(e.target.value)} placeholder="Write your study notes here…" rows={isTablet||isDesktop?6:4} style={{...inp,marginBottom:9,resize:"none"}} aria-label="Note body"/>
            <input value={nTags} onChange={e => setNTg(e.target.value)} placeholder="Tags — comma separated (e.g. Grace, Faith)" style={{...inp,marginBottom:14}} aria-label="Note tags"/>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>Attach to Note</div>
            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              <button onClick={toggleRec} style={{...btn(recOn?"red":"def"),animation:recOn?"pulse 1.5s infinite":"none"}}>
                <i className={`ti ${recOn?"ti-player-stop":"ti-microphone"}`} aria-hidden="true"/>
                {recOn?`● Stop · ${fmt(recT)}`:hasAudio?"✓ Audio":"Record"}
              </button>
              <button onClick={() => setHI(true)} style={{...btn(),background:hasImg?"#1A7A4A":undefined}}>
                <i className="ti ti-camera" aria-hidden="true"/>{hasImg?"✓ Photo":"Snap Photo"}
              </button>
              <button onClick={() => setSC(!showCanvas)} style={{...btn(),background:showCanvas?"rgba(201,168,76,.25)":undefined,border:showCanvas?`1px solid ${GOLD}`:"none"}}>
                <i className="ti ti-pencil" aria-hidden="true"/>{drawing?"✓ Drawing":"Draw / Pencil"}
              </button>
              <button onClick={smartSummary} style={btn()}>
                <i className="ti ti-sparkles" aria-hidden="true"/>Smart Summary
              </button>
            </div>
            {showCanvas && (
              <div style={{ marginBottom:14 }}>
                <DrawingCanvas onSave={dataUrl => { setDraw(dataUrl); setSC(false); }} onClose={() => setSC(false)} T={T}/>
              </div>
            )}
            {drawing && !showCanvas && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:T.muted, marginBottom:5 }}>✦ Drawing attached</div>
                <img src={drawing} alt="Your drawing" style={{ width:"100%", borderRadius:10, border:`1px solid ${T.border}`, maxHeight:160, objectFit:"contain", background:"white" }}/>
                <button onClick={() => setDraw(null)} style={{...btn(),marginTop:6,fontSize:10,padding:"4px 10px"}}>Remove</button>
              </div>
            )}
            <button onClick={saveNote} disabled={!nTitle.trim()} style={{...btn("gold"),width:"100%",justifyContent:"center",opacity:nTitle.trim()?1:.45,minHeight:44}}>
              <i className="ti ti-device-floppy" aria-hidden="true"/>Save Note
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.65}}*{box-sizing:border-box}body{margin:0}`}</style>
    </div>
  );
}
