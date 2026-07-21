import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
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
const NAV = [["read","ti-book-2","Read"],["notes","ti-notebook","Notes"],["ai","ti-sparkles","Ask AI"],["search","ti-search","Search"],["settings","ti-settings","Prefs"]];

/* Highlights and notes are keyed by (book, chapter, verse) reference only,
   so they are shared across translations by design. */
const TRANSLATIONS = {
  KJV: { label:"King James Version",       era:"1611" },
  ASV: { label:"American Standard Version", era:"1901" },
};

const DICT = {
  "Agape":         { type:"Greek: ἀγάπη",                    def:"Unconditional, self-sacrificing love — the highest form in the NT. Distinct from phileo (brotherly) and eros (romantic). The word used in John 3:16 and 1 Corinthians 13." },
  "Adonai":        { type:"Hebrew: אֲדֹנָי (ʾĂdōnāy)",        def:"Lord, Master, Sovereign. A title of supreme authority used for God, often substituted for the divine name YHWH when reading aloud. Reflects God's absolute lordship over all creation (Isa. 6:1; Ps. 110:1)." },
  "Atonement":     { type:"Hebrew: כִּפֻּר (kippur)",          def:"The covering or propitiation of sin. The Day of Atonement (Yom Kippur) prefigured Christ's ultimate sacrifice on the cross (Lev. 16; Heb. 9:12)." },
  "Chesed":        { type:"Hebrew: חֶסֶד (ḥesed)",            def:"Steadfast love, lovingkindness, loyal covenant devotion. The KJV renders it 'mercy' or 'lovingkindness.' It characterizes God's unbreakable faithfulness to his covenant people (Ps. 136; Lam. 3:22-23)." },
  "Covenant":      { type:"Hebrew: בְּרִית (bĕrît)",           def:"A solemn, binding agreement. God established covenants with Noah, Abraham, Moses, David, and the New Covenant through Christ's blood (Jer. 31:31; Luke 22:20)." },
  "Dabar":         { type:"Hebrew: דָּבָר (dābār)",            def:"Word, matter, thing. God's Dabar is creative and active — 'He sent his word and healed them' (Ps. 107:20). In Hebrew thought a spoken word carries power; God's Dabar accomplishes his purposes (Isa. 55:11)." },
  "Doxa":          { type:"Greek: δόξα (doxa)",               def:"Glory, splendour, honour — the weightiness and radiance of God's nature made visible. The Doxa of God filled Solomon's temple and the incarnate Christ displayed it (John 1:14). All things are to be done for God's Doxa (1 Cor. 10:31)." },
  "Eirene":        { type:"Greek: εἰρήνη (eirēnē)",            def:"Peace — the NT equivalent of Hebrew shalom. The peace Christ gives surpasses understanding (Phil. 4:7). He is our eirene, having broken down the wall of partition between Jew and Gentile (Eph. 2:14; John 14:27)." },
  "Ekklesia":      { type:"Greek: ἐκκλησία (ekklēsia)",        def:"Church, assembly — literally 'the called-out ones.' Not a building but a people called out of darkness into God's marvellous light. Christ declared he would build his Ekklesia and the gates of Hades would not prevail (Matt. 16:18)." },
  "Elohim":        { type:"Hebrew: אֱלֹהִים (ʾĕlōhîm)",        def:"The most common Hebrew name for God — a plural form consistently used with singular verbs, hinting at plurality within unity. Emphasizes God's might, creative power, and majesty (Gen. 1:1; Ps. 19:1)." },
  "Emunah":        { type:"Hebrew: אֱמוּנָה (ʾĕmûnāh)",        def:"Faithfulness, steadfastness, firmness — the root of the word 'Amen.' Primarily an attribute of God (Ps. 89:8) but also called for in his people. The just shall live by his emunah (Hab. 2:4; Rom. 1:17)." },
  "Faith":         { type:"Greek: πίστις (pistis)",           def:"Trust and reliance upon God. Saving faith is wholehearted confidence in Christ's person and work — not mere intellectual assent (Heb. 11:1; Eph. 2:8)." },
  "Gospel":        { type:"Greek: εὐαγγέλιον (euangelion)",   def:"Good news — the saving work of Jesus Christ: his death, burial, and resurrection for the forgiveness of sins (1 Cor. 15:1–4)." },
  "Grace":         { type:"Greek: χάρις (charis)",            def:"Unmerited favour from God. A free gift of salvation given not through works but through faith in Christ. Grace is the very basis of redemption (Eph. 2:8)." },
  "Justification": { type:"Greek: δικαίωσις (dikaiōsis)",     def:"God's judicial act of declaring a sinner righteous based on Christ's atoning work. Declared righteous — a forensic term. Not made righteous but counted righteous (Rom. 4:25)." },
  "Kabod":         { type:"Hebrew: כָּבוֹד (kābôd)",           def:"Glory, honour, weight, splendour. Describes the weighty, radiant presence of God that filled the Tabernacle and Temple. The NT Greek equivalent is doxa. The Kabod YHWH departed Israel in Ezekiel 10." },
  "Kairos":        { type:"Greek: καιρός (kairos)",           def:"An appointed time, season, or opportune moment — in contrast to chronos (clock-time). Scripture is filled with divine kairos moments: 'in the fulness of the time God sent forth his Son' (Gal. 4:4). We are to redeem the kairos (Eph. 5:16)." },
  "Logos":         { type:"Greek: λόγος (logos)",             def:"Word, reason, divine expression. John 1:1 declares the Logos was with God and was God, and in 1:14 the Logos became flesh — Jesus Christ. It communicates both personal divine being and the intelligent ordering of all things." },
  "Messiah":       { type:"Hebrew: מָשִׁיחַ (māšîaḥ)",         def:"The Anointed One. Jesus is the promised Messiah — the ultimate Prophet, Priest, and King. The Greek equivalent is Christos (Dan. 9:25–26; John 1:41)." },
  "Nephesh":       { type:"Hebrew: נֶפֶשׁ (nepeš)",            def:"Soul, life, living being. The whole person — body and breath together — not a separate immortal part. When God breathed into Adam he became a living nephesh (Gen. 2:7). Translated 'soul' or 'life' in the KJV." },
  "Parousia":      { type:"Greek: παρουσία (parousia)",       def:"Presence, arrival, coming — the technical NT term for the Second Coming of Christ. His Parousia will be visible, bodily, and glorious (1 Thess. 4:15-17; Matt. 24:27). The church looks forward to the blessed hope of his appearing." },
  "Pneuma":        { type:"Greek: πνεῦμα (pneuma)",           def:"Spirit, breath, wind — the Greek parallel to Hebrew ruach. Used of the Holy Spirit, human spirit, and spiritual beings. Jesus breathed on the disciples saying 'Receive ye the Holy Ghost' (John 20:22; 1 Cor. 2:11)." },
  "Propitiation":  { type:"Greek: ἱλαστήριον (hilastērion)",  def:"The turning away of God's wrath through Christ's sacrifice. Jesus satisfies the just demands of God's holiness on our behalf (1 John 2:2; Rom. 3:25)." },
  "Redemption":    { type:"Greek: ἀπολύτρωσις (apolytrōsis)", def:"To buy back or ransom from bondage. Christ redeemed believers from the slavery of sin by paying the price — his blood — for their release (Eph. 1:7; Gal. 3:13)." },
  "Repentance":    { type:"Greek: μετάνοια (metanoia)",       def:"A change of mind and direction — turning from sin to God. More than sorrow; it involves a genuine turning of will, heart, and action (Acts 2:38; 2 Cor. 7:10)." },
  "Righteousness": { type:"Greek: δικαιοσύνη (dikaiosynē)",   def:"Right standing before God. Imputed righteousness is received through faith in Christ — God declares the believer righteous on account of Christ's merits (Rom. 3:22)." },
  "Ruach":         { type:"Hebrew: רוּחַ (rûaḥ)",              def:"Spirit, breath, or wind. Used of the Holy Spirit, the human spirit, and God's creative breath. In Gen. 1:2 the Ruach Elohim hovers over the waters; in Gen. 2:7 God breathes into Adam the breath of life." },
  "Salvation":     { type:"Greek: σωτηρία (sōtēria)",         def:"Deliverance from sin and its consequences. Encompasses justification (past), sanctification (present), and glorification (future) — God's complete rescue plan (Eph. 2:8)." },
  "Sanctification":{ type:"Greek: ἁγιασμός (hagiasmos)",     def:"The ongoing process of becoming holy — set apart for God's purposes. Distinct from justification as the daily walk of growing in holiness (1 Thess. 4:3)." },
  "Sarx":          { type:"Greek: σάρξ (sarx)",               def:"Flesh — the physical body, but especially in Paul's usage the sinful principle within fallen human nature that opposes the Spirit. Walking kata sarka leads to death; walking kata pneuma brings life (Rom. 8:13; Gal. 5:17)." },
  "Shalom":        { type:"Hebrew: שָׁלוֹם (shālôm)",          def:"Peace, wholeness, completeness, and well-being — far more than absence of conflict. Shalom describes God's ideal state of restored harmony between Creator and creation, person and person (Num. 6:26; Isa. 9:6)." },
  "Sheol":         { type:"Hebrew: שְׁאוֹל (šĕʾôl)",           def:"The realm of the dead in the OT. Often translated 'grave' or 'pit' in the KJV. Paralleled in NT with Hades — with distinct compartments before the cross (Luke 16:19–31)." },
  "Telos":         { type:"Greek: τέλος (telos)",             def:"End, goal, completion, fulfilment — not merely termination but reaching the intended purpose. Christ is the telos of the law (Rom. 10:4). God works all things toward the telos of conforming believers to the image of his Son (Rom. 8:29)." },
  "Torah":         { type:"Hebrew: תּוֹרָה (tôrāh)",           def:"Law, instruction, teaching — not merely legal code but divine guidance for life. Encompasses the five books of Moses and God's full instruction for covenant living. In Ps. 119 it is called a lamp and a light." },
  "Trinity":       { type:"Theological term",                 def:"One God in three co-equal, co-eternal Persons: Father, Son, and Holy Spirit. The doctrine is supported throughout both Testaments though the word is not in Scripture (Matt. 28:19)." },
  "Zoe":           { type:"Greek: ζωή (zōē)",                 def:"Life — particularly spiritual, eternal, divine life. Distinguished from bios (biological life) and psyche (soul-life). Christ is the Zoe (John 14:6). Eternal zoe is to know the only true God and Jesus Christ (John 17:3)." },
};

/* "The Journal" editorial direction — Instrument Serif display, Archivo UI,
   Source Serif 4 scripture. `header` is the ink color (solid chips/buttons),
   `headerText` its foreground; `accent` the editorial red; `hl` the verse-
   highlight paper tone. Theme ids are unchanged so saved prefs keep working. */
const THEMES = {
  light: { bg:"#faf9f6", surface:"#ffffff", surface2:"#f1eee7", text:"#181614", scripture:"#26221e",
           heading:"#181614", muted:"#9b948a", header:"#181614", headerText:"#faf9f6",
           border:"#e2ded6", input:"#f1eee7", accent:"#8a2318", hl:"#f3ead9",
           accentSoft:"rgba(138,35,24,.07)", accentBorder:"rgba(138,35,24,.28)", chrome:"#faf9f6" },
  dark:  { bg:"#141210", surface:"#1c1917", surface2:"#211d1a", text:"#e6e1d8", scripture:"#d9d3c8",
           heading:"#f2ede3", muted:"#6f6a62", header:"#e6e1d8", headerText:"#141210",
           border:"#2b2723", input:"#211d1a", accent:"#d06a52", hl:"#2e2419",
           accentSoft:"rgba(208,106,82,.09)", accentBorder:"rgba(208,106,82,.32)", chrome:"#171412" },
  sepia: { bg:"#f5efdc", surface:"#fbf6ea", surface2:"#ede4cc", text:"#3b2d1e", scripture:"#463522",
           heading:"#2c2013", muted:"#8b7355", header:"#2c2013", headerText:"#f5efdc",
           border:"#e0d5b8", input:"#ede4cc", accent:"#8a2318", hl:"#ecdfc0",
           accentSoft:"rgba(138,35,24,.07)", accentBorder:"rgba(138,35,24,.28)", chrome:"#f5efdc" },
};
const SERIF_DISPLAY = "'Instrument Serif',Georgia,serif";
const SERIF_BODY    = "'Source Serif 4',Georgia,serif";
const SANS          = "'Archivo',system-ui,sans-serif";
const EYEBROW = { fontSize:10, letterSpacing:".26em", textTransform:"uppercase", fontWeight:700 };

const CH_ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const CH_TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
function chapterWord(n) {
  if (n < 20)  return CH_ONES[n];
  if (n < 100) { const t = Math.floor(n/10), o = n%10; return CH_TENS[t] + (o ? "-" + CH_ONES[o] : ""); }
  return "One Hundred" + (n > 100 ? " " + chapterWord(n - 100) : "");
}
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

// ─── MODULE-LEVEL STYLE HELPERS ───────────────────────────────────────────────
/* Editorial buttons: solid ink chip by default (like the design's KJV chip),
   accent red for the primary action, square corners throughout. */
function mkBtn(T, isTablet, isDesktop, v = "def") {
  return {
    background: v==="gold" ? T.accent : v==="red" ? "#C0392B" : T.header,
    border: "none", borderRadius: 2,
    padding: isTablet||isDesktop ? "9px 16px" : "7px 13px",
    color: v==="gold" || v==="red" ? "#fff" : T.headerText,
    fontSize: isDesktop ? 12.5 : 12, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", display: "flex", alignItems: "center",
    gap: 6, transition: "opacity .15s", whiteSpace: "nowrap",
  };
}
function mkCard(T, isDesktop) {
  return { background: T.surface, borderRadius: 2, padding: isDesktop ? "16px 18px" : "13px 15px", border: `1px solid ${T.border}`, marginBottom: 10 };
}
function mkInp(T) {
  return { width: "100%", background: T.input, border: `1px solid ${T.border}`, borderRadius: 2, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", color: T.text, outline: "none", boxSizing: "border-box" };
}

// ─── DRAWING CANVAS ───────────────────────────────────────────────────────────
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
    drawing.current = true; lastPos.current = gPos(e); curStroke.current = [];
    if (e.pointerType==="pen") setPL("Apple Pencil ✦");
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
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y);
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
    <button key={id} onClick={()=>setTool(id)} style={{ background:tool===id?T.accent:"transparent", border:`1px solid ${tool===id?T.accent:T.border}`, borderRadius:2, padding:"6px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4, color:tool===id?"#fff":T.text, fontSize:12, fontFamily:"inherit" }}>
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
            <button key={c} onClick={()=>setPC(c)} style={{ width:22, height:22, borderRadius:"50%", background:c, border:`2.5px solid ${penColor===c?T.accent:"transparent"}`, cursor:"pointer", flexShrink:0 }} aria-label={`Color ${c}`}/>
          ))}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:5 }}>
          <button onClick={undo} style={{ background:T.header, border:"none", borderRadius:2, padding:"6px 10px", color:T.headerText, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:3, fontFamily:"inherit" }}>
            <i className="ti ti-arrow-back-up" style={{fontSize:14}} aria-hidden="true"/>Undo
          </button>
          <button onClick={clearAll} style={{ background:"rgba(192,57,43,.12)", border:"none", borderRadius:8, padding:"6px 10px", color:"#C0392B", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Clear</button>
        </div>
      </div>
      <div style={{ background:tool==="eraser"?"rgba(192,57,43,.06)":tool==="hi"?T.accentSoft:"rgba(13,27,42,.04)", padding:"4px 12px", fontSize:10, color:T.muted, fontStyle:"italic", borderBottom:`1px solid ${T.border}` }}>
        {penLabel} · {tool==="pen"?"Pressure-sensitive ink":tool==="hi"?"Highlighter (transparent)":"Eraser"} · Draw below
      </div>
      <canvas ref={canvasRef} width={800} height={380}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ display:"block", width:"100%", height:"auto", touchAction:"none", cursor:tool==="eraser"?"cell":"crosshair", background:"white" }}
        aria-label="Drawing canvas"
      />
      <div style={{ display:"flex", gap:8, padding:"10px 12px", justifyContent:"flex-end", background:T.surface2 }}>
        <button onClick={onClose} style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:10, padding:"8px 16px", color:T.muted, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Discard</button>
        <button onClick={()=>onSave(canvasRef.current.toDataURL("image/png"))} style={{ background:T.accent, border:"none", borderRadius:2, padding:"8px 18px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          <i className="ti ti-check" style={{fontSize:14,marginRight:5}} aria-hidden="true"/>Save Drawing
        </button>
      </div>
    </div>
  );
}

// ─── TOP BAR ─────────────────────────────────────────────────────────────────
function TopBar({ T, isDesktop, title, sub, right }) {
  return (
    <div style={{ background:T.chrome, borderBottom:`1px solid ${T.border}`, padding:isDesktop?"14px 24px":"11px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
      <div>
        <div style={{ color:T.heading, fontFamily:SERIF_DISPLAY, fontSize:isDesktop?24:20, letterSpacing:"-.01em" }}>{title}</div>
        {sub && <div style={{ color:T.muted, fontSize:10, marginTop:3, textTransform:"uppercase", letterSpacing:".18em", fontWeight:600 }}>{sub}</div>}
      </div>
      {right && <div style={{ display:"flex", gap:10, alignItems:"center" }}>{right}</div>}
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────────────────────────
/* Desktop-only 64px editorial rail: serif monogram, vertical-rl title,
   icon nav at the bottom (labels via tooltip). */
function Sidebar({ T, tab, setTab, translation }) {
  return (
    <div style={{ background:T.chrome, width:64, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", padding:"20px 0 22px", gap:24, borderRight:`1px solid ${T.border}`, minHeight:"100%", boxSizing:"border-box" }}>
      <div style={{ color:T.accent, fontFamily:SERIF_DISPLAY, fontSize:24, lineHeight:1 }}>B.</div>
      <div style={{ writingMode:"vertical-rl", fontSize:9.5, letterSpacing:".28em", textTransform:"uppercase", color:T.muted, fontWeight:600, flex:1, display:"flex", alignItems:"center", whiteSpace:"nowrap", minHeight:0, overflow:"hidden" }}>
        {`The Bible Study App — ${translation} ${TRANSLATIONS[translation].era}`}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:17, alignItems:"center" }}>
        {NAV.map(([id,ico,lbl]) => (
          <i key={id} className={`ti ${ico}`} title={lbl} onClick={() => setTab(id)}
            style={{ fontSize:18, color:tab===id?T.accent:T.muted, cursor:"pointer" }} aria-label={lbl}/>
        ))}
      </div>
    </div>
  );
}

// ─── BOTTOM NAV ──────────────────────────────────────────────────────────────
function BottomNav({ T, tab, setTab }) {
  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:50, background:T.chrome, padding:"10px 0 12px", display:"flex", borderTop:`1px solid ${T.border}` }}>
      {NAV.map(([id,ico,lbl]) => (
        <div key={id} onClick={() => setTab(id)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer", flex:1 }}>
          <i className={`ti ${ico}`} style={{ fontSize:19, color:tab===id?T.accent:T.muted }} aria-hidden="true"/>
          <span style={{ fontSize:9, color:tab===id?T.accent:T.muted, fontWeight:tab===id?700:600, letterSpacing:".18em", textTransform:"uppercase" }}>{lbl}</span>
        </div>
      ))}
    </div>
  );
}

// ─── READER ──────────────────────────────────────────────────────────────────
function ReaderContent({ T, isDesktop, isTablet, isMobile, bookName, chapter, maxCh, verses, loading, hl, daily, fs, translation, changeTranslation, setSBP, setSCP, toggleHL, setNR, setTab, setSE, setAIn, setCh }) {
  // Editorial picker chips: bordered ink, square, uppercase (design's "JOHN ▾ / CH. 3 ▾")
  const pill = () => ({ background:"transparent", border:`1.5px solid ${T.heading}`, borderRadius:0, padding:isMobile?"5px 10px":"7px 14px", display:"flex", alignItems:"center", gap:6, cursor:"pointer" });
  const pTxt = { color:T.heading, fontSize:isMobile?11:12, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase" };
  const btn  = (v="def") => mkBtn(T, isTablet, isDesktop, v);
  const [tOpen, setTOpen] = useState(false);
  const scrollRef   = useRef(null);
  const savedScroll = useRef(null);
  // Restore the scripture scroll position after a translation switch reloads
  // the same chapter (captured synchronously in the dropdown click).
  useEffect(() => {
    if (!loading && verses.length && savedScroll.current != null && scrollRef.current) {
      scrollRef.current.scrollTop = savedScroll.current;
      savedScroll.current = null;
    }
  }, [loading, verses]);
  // Display size adapts to long book names (e.g. "1 Thessalonians")
  const bigSize = (base) => bookName.length > 12 ? base*.44 : bookName.length > 8 ? base*.6 : base;

  const chips = (
    <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
      <div style={pill()} onClick={() => setSBP(true)}>
        <span style={pTxt}>{bookName}</span>
        <i className="ti ti-chevron-down" style={{ color:T.heading, fontSize:12 }} aria-hidden="true"/>
      </div>
      <div style={pill()} onClick={() => setSCP(true)}>
        <span style={pTxt}>Ch. {chapter}</span>
        <i className="ti ti-chevron-down" style={{ color:T.heading, fontSize:12 }} aria-hidden="true"/>
      </div>
      <div style={{ position:"relative" }}>
        <div style={{ ...pill(), border:"none", background:T.header, cursor:"pointer" }} onClick={() => setTOpen(o => !o)}>
          <span style={{ ...pTxt, color:T.headerText }}>{translation}</span>
          <i className="ti ti-chevron-down" style={{ color:T.headerText, fontSize:12 }} aria-hidden="true"/>
        </div>
        {tOpen && (
          <>
            <div style={{ position:"fixed", inset:0, zIndex:210 }} onClick={() => setTOpen(false)}/>
            <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:220, background:T.bg, border:`1px solid ${T.border}`, borderTop:`2px solid ${T.accent}`, boxShadow:"0 12px 40px rgba(0,0,0,.25)", minWidth:200 }}>
              {Object.entries(TRANSLATIONS).map(([id, meta]) => (
                <div key={id}
                  onClick={() => {
                    setTOpen(false);
                    if (id !== translation) {
                      savedScroll.current = scrollRef.current?.scrollTop ?? null;
                      changeTranslation(id);
                    }
                  }}
                  style={{ padding:"10px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:14, background:id===translation?T.accentSoft:"transparent" }}>
                  <span style={{ fontSize:12, fontWeight:700, letterSpacing:".06em", color:id===translation?T.accent:T.heading }}>{id}</span>
                  <span style={{ fontSize:10.5, color:T.muted, whiteSpace:"nowrap" }}>{meta.label} · {meta.era}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {/* Unwired placeholders — kept for a future bookmark/share feature */}
      <i className="ti ti-bookmark" title="Bookmarks — coming soon" style={{ color:T.muted, fontSize:18, cursor:"pointer", marginLeft:2 }} aria-hidden="true"/>
      <i className="ti ti-share"    title="Share — coming soon"     style={{ color:T.muted, fontSize:18, cursor:"pointer" }} aria-hidden="true"/>
    </div>
  );

  const header = (
    <div style={{ background:T.chrome, borderBottom:`1px solid ${T.border}`, padding:isDesktop?"14px 32px":"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap", flexShrink:0 }}>
      {isDesktop ? (
        <div style={{ display:"flex", gap:26 }}>
          {NAV.map(([id,,lbl]) => (
            <span key={id} onClick={() => id!=="read" && setTab(id)}
              style={{ fontSize:11, letterSpacing:".2em", textTransform:"uppercase", fontWeight:id==="read"?700:600, color:id==="read"?T.accent:T.muted, cursor:id==="read"?"default":"pointer", borderBottom:`2px solid ${id==="read"?T.accent:"transparent"}`, paddingBottom:3 }}>
              {lbl}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontFamily:SERIF_DISPLAY, fontSize:22, color:T.accent, lineHeight:1 }}>B.</span>
          {!isMobile && <span style={{ fontSize:9.5, letterSpacing:".24em", textTransform:"uppercase", color:T.muted, fontWeight:600 }}>{`The Bible Study App — ${translation} ${TRANSLATIONS[translation].era}`}</span>}
        </div>
      )}
      {chips}
    </div>
  );

  const votd = (bordered) => (
    <div style={bordered ? { borderTop:`1px solid ${T.border}`, paddingTop:16 } : undefined}>
      <div style={{ ...EYEBROW, letterSpacing:".24em", color:T.muted, marginBottom:9, fontWeight:600 }}>Verse of the Day</div>
      <div style={{ fontFamily:SERIF_DISPLAY, fontSize:isDesktop?21:isTablet?18:17, color:T.accent, lineHeight:1.35, fontStyle:"italic" }}>“{daily.text}”</div>
      <div style={{ fontSize:11, color:T.heading, fontWeight:600, marginTop:9, letterSpacing:".08em", textTransform:"uppercase" }}>{daily.ref}</div>
    </div>
  );

  const versesJsx = (
    <>
      {loading && <div style={{ padding:"32px 0", textAlign:"center", color:T.muted, fontStyle:"italic" }}>Loading scripture…</div>}
      {verses.map(v => (
        <div key={v.verse} onClick={() => toggleHL(v.verse)}
          style={{ margin:`0 0 ${isMobile?14:18}px`, cursor:"pointer", background:hl[v.verse]?T.hl:"transparent", boxShadow:hl[v.verse]?`0 0 0 6px ${T.hl}`:"none", transition:"background .15s" }}>
          <span style={{ fontFamily:SANS, fontSize:10, fontWeight:700, color:T.accent, marginRight:8, verticalAlign:"top" }}>{String(v.verse).padStart(2,"0")}</span>
          <span style={{ fontFamily:SERIF_BODY, fontSize:fs, lineHeight:1.8, color:T.scripture }}>{v.text?.trim()}</span>
          {hl[v.verse] && (
            <div style={{ display:"flex", gap:6, marginTop:9, flexWrap:"wrap" }}>
              {[["Highlight","ti-highlight"],["Add Note","ti-notebook"],["Ask AI","ti-sparkles"],["Copy","ti-copy"],["Share","ti-share"]].map(([lbl,ico]) => (
                <button key={lbl} onClick={e => {
                  e.stopPropagation();
                  if (lbl==="Add Note") { setNR(`${bookName} ${chapter}:${v.verse}`); setTab("notes"); setSE(true); }
                  if (lbl==="Ask AI")   { setAIn(`Please explain ${bookName} ${chapter}:${v.verse} — "${v.text?.slice(0,60)}…" with historical and theological context from the ${translation}.`); setTab("ai"); }
                  if (lbl==="Copy")     { navigator.clipboard.writeText(`"${v.text?.trim()}" — ${bookName} ${chapter}:${v.verse} (${translation})`); }
                }} style={{ background:T.header, border:"none", borderRadius:2, padding:"5px 11px", color:T.headerText, fontSize:10.5, fontWeight:600, letterSpacing:".04em", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4, minHeight:32 }}>
                  <i className={`ti ${ico}`} style={{fontSize:12}} aria-hidden="true"/>{lbl}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {verses.length > 0 && (
        <div style={{ display:"flex", justifyContent:"space-between", padding:"14px 0", gap:8, borderTop:`1px solid ${T.border}`, marginTop:6 }}>
          <button onClick={() => chapter>1 && setCh(c => c-1)} disabled={chapter<=1} style={{ ...btn(), opacity:chapter<=1?.35:1 }}><i className="ti ti-arrow-left" aria-hidden="true"/>Previous</button>
          <button onClick={() => chapter<maxCh && setCh(c => c+1)} disabled={chapter>=maxCh} style={{ ...btn(), opacity:chapter>=maxCh?.35:1 }}>Next<i className="ti ti-arrow-right" aria-hidden="true"/></button>
        </div>
      )}
      <div style={{height:24}}/>
    </>
  );

  /* ── Desktop: fixed chapter panel + scrolling scripture column ── */
  if (isDesktop) return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      {header}
      <div style={{ flex:1, display:"flex", minHeight:0 }}>
        <div style={{ width:320, flexShrink:0, borderRight:`1px solid ${T.border}`, overflowY:"auto", padding:"36px 24px 28px 32px", boxSizing:"border-box" }}>
          <div style={{ ...EYEBROW, color:T.accent, marginBottom:14 }}>Chapter {chapterWord(chapter)}</div>
          <div style={{ fontFamily:SERIF_DISPLAY, fontSize:bigSize(104), lineHeight:.88, letterSpacing:"-.02em", color:T.heading }}>{bookName}<br/>{chapter}</div>
          <div style={{ marginTop:26 }}>{votd(true)}</div>
          <div style={{ marginTop:18, fontSize:11, lineHeight:1.6, color:T.muted, borderTop:`1px solid ${T.border}`, paddingTop:14 }}>
            Margin · tap any verse to highlight, note it, or ask the AI about it.
          </div>
        </div>
        <div style={{ flex:1, minWidth:0, position:"relative", display:"flex", flexDirection:"column", minHeight:0 }}>
          <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:"36px 48px 0" }}>
            <div style={{ maxWidth:960 }}>{versesJsx}</div>
          </div>
          <div style={{ position:"absolute", left:0, right:0, bottom:0, height:70, background:`linear-gradient(transparent, ${T.bg})`, pointerEvents:"none" }}/>
        </div>
      </div>
    </div>
  );

  /* ── Tablet / mobile: stacked (chapter header, VOTD, scripture) ── */
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      {header}
      <div ref={scrollRef} style={{ flex:1, overflowY:"auto" }}>
        {isTablet ? (
          <div style={{ padding:"34px 40px 0" }}>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:24, borderBottom:`1px solid ${T.border}`, paddingBottom:26 }}>
              <div>
                <div style={{ ...EYEBROW, color:T.accent, marginBottom:12 }}>Chapter {chapterWord(chapter)}</div>
                <div style={{ fontFamily:SERIF_DISPLAY, fontSize:bigSize(92), lineHeight:.88, letterSpacing:"-.02em", color:T.heading }}>{bookName} {chapter}</div>
              </div>
              <div style={{ width:300, flexShrink:0, paddingBottom:4 }}>{votd(false)}</div>
            </div>
          </div>
        ) : (
          <div style={{ padding:"20px 16px 0" }}>
            <div style={{ ...EYEBROW, color:T.accent, marginBottom:10 }}>Chapter {chapterWord(chapter)}</div>
            <div style={{ fontFamily:SERIF_DISPLAY, fontSize:bigSize(52), lineHeight:.92, letterSpacing:"-.02em", color:T.heading }}>{bookName} {chapter}</div>
            <div style={{ margin:"16px 0 0", paddingBottom:14, borderBottom:`1px solid ${T.border}` }}>{votd(true)}</div>
          </div>
        )}
        <div style={{ padding:isTablet?"28px 40px 0":"18px 16px 0" }}>
          {versesJsx}
        </div>
      </div>
    </div>
  );
}

// ─── NOTES ───────────────────────────────────────────────────────────────────
function NotesContent({ T, isDesktop, isMobile, notes, translation, setSE, deleteNote, openEdit }) {
  const card = mkCard(T, isDesktop);
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      <TopBar T={T} isDesktop={isDesktop} title="✦ My Notes" sub={`${notes.length} notes · ${translation}`}
        right={<button onClick={() => setSE(true)} style={mkBtn(T, false, isDesktop, "gold")}><i className="ti ti-plus" aria-hidden="true"/>New Note</button>}
      />
      <div style={{ flex:1, overflowY:"auto", padding:isDesktop?"14px 18px":"10px 14px" }}>
        {notes.length===0 && <div style={{ padding:"40px 20px", textAlign:"center", color:T.muted, fontStyle:"italic" }}>No notes yet. Tap "New Note" to begin your study journal.</div>}
        <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(2,1fr)":"1fr", gap:10 }}>
          {notes.map(n => (
            <div key={n.id} style={{...card, cursor:"pointer"}} onClick={() => openEdit(n)}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
                <div style={{ fontSize:isDesktop?15:14, fontWeight:500, color:T.text, flex:1, marginRight:8 }}>{n.title}</div>
                <div style={{ fontSize:10, color:T.muted, flexShrink:0 }}>{n.date}</div>
              </div>
              {n.ref && <div style={{ fontSize:13, color:T.accent, marginBottom:6, fontFamily:SERIF_DISPLAY, fontStyle:"italic" }}>{n.ref}</div>}
              <div style={{ fontSize:13, color:T.muted, lineHeight:1.7 }}>{n.text}</div>
              {n.drawing && <img src={n.drawing} alt="Handwritten note" style={{ width:"100%", borderRadius:8, marginTop:8, border:`1px solid ${T.border}` }}/>}
              {n.tags?.length > 0 && (
                <div style={{ display:"flex", gap:5, marginTop:9, flexWrap:"wrap" }}>
                  {n.tags.map(t => <span key={t} style={{ background:T.accentSoft, border:`1px solid ${T.accentBorder}`, borderRadius:2, padding:"2px 8px", fontSize:9.5, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase", color:T.accent }}>{t}</span>)}
                </div>
              )}
              <div style={{ display:"flex", gap:6, marginTop:9, flexWrap:"wrap", alignItems:"center" }}>
                {n.hasAudio && <div style={{ background:T.surface2, borderRadius:8, padding:"3px 9px", fontSize:10, color:T.muted, display:"flex", alignItems:"center", gap:4 }}><i className="ti ti-microphone" style={{fontSize:12}} aria-hidden="true"/>Audio</div>}
                {n.hasImg   && <div style={{ background:T.surface2, borderRadius:8, padding:"3px 9px", fontSize:10, color:T.muted, display:"flex", alignItems:"center", gap:4 }}><i className="ti ti-photo" style={{fontSize:12}} aria-hidden="true"/>Photo</div>}
                {n.drawing  && <div style={{ background:T.accentSoft, border:`1px solid ${T.accentBorder}`, borderRadius:2, padding:"3px 9px", fontSize:10, color:T.accent, display:"flex", alignItems:"center", gap:4 }}><i className="ti ti-pencil" style={{fontSize:12}} aria-hidden="true"/>Drawing</div>}
                <button onClick={e => { e.stopPropagation(); openEdit(n); }} style={{ background:T.accentSoft, border:"none", borderRadius:2, padding:"4px 10px", fontSize:10, fontWeight:600, color:T.accent, cursor:"pointer", display:"flex", alignItems:"center", gap:3, minHeight:28 }}>
                  <i className="ti ti-pencil" style={{fontSize:12}} aria-hidden="true"/>Edit
                </button>
                <button onClick={e => { e.stopPropagation(); deleteNote(n.id); }} style={{ background:"rgba(192,57,43,.1)", border:"none", borderRadius:8, padding:"4px 10px", fontSize:10, color:"#C0392B", cursor:"pointer", marginLeft:"auto", display:"flex", alignItems:"center", gap:3, minHeight:28 }}>
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
}

// ─── AI ──────────────────────────────────────────────────────────────────────
function AIContent({ T, isDesktop, isMobile, aiMsgs, aiIn, setAIn, aiLd, chatEnd, sendAI }) {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      <TopBar T={T} isDesktop={isDesktop} title="✦ Ask the Word" sub="AI Bible study assistant · KJV & ASV"/>
      <div style={{ background:T.chrome, borderBottom:`1px solid ${T.border}`, padding:"9px 14px", display:"flex", gap:8, overflowX:"auto", flexShrink:0 }}>
        {["What is grace?","Pharisees explained","Explain the Trinity","Psalm 23 exposition","What is Sheol?","Romans 8 overview","The Beatitudes"].map(q => (
          <div key={q} onClick={() => sendAI(q)} style={{ background:"transparent", border:`1px solid ${T.accentBorder}`, borderRadius:0, padding:isDesktop?"6px 13px":"5px 10px", whiteSpace:"nowrap", fontSize:isDesktop?12:11, fontWeight:600, color:T.accent, cursor:"pointer", flexShrink:0 }}>{q}</div>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
        {aiMsgs.map((m,i) => (
          <div key={i} style={{ alignSelf:m.role==="user"?"flex-end":"flex-start", background:m.role==="user"?T.header:T.surface, border:m.role==="assistant"?`1px solid ${T.border}`:"none", borderRadius:2, padding:"11px 15px", maxWidth:isDesktop?"70%":"88%" }}>
            <div style={{ fontSize:isDesktop?14:13, lineHeight:1.8, color:m.role==="user"?T.headerText:T.text, whiteSpace:"pre-wrap" }}>{m.content}</div>
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
        <input
          value={aiIn}
          onChange={e => setAIn(e.target.value)}
          onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendAI()}
          placeholder="Ask anything about the Bible…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          style={{ flex:1, background:T.input, border:`1px solid ${T.border}`, borderRadius:2, padding:"10px 14px", fontSize:13, fontFamily:"inherit", color:T.text, outline:"none" }}
          aria-label="AI Bible question"
        />
        <button onClick={() => sendAI()} disabled={aiLd} style={{ background:T.accent, border:"none", borderRadius:0, width:40, height:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", opacity:aiLd?.5:1 }} aria-label="Send">
          <i className="ti ti-arrow-up" style={{ color:"#fff", fontSize:18 }} aria-hidden="true"/>
        </button>
      </div>
    </div>
  );
}

// ─── SEARCH / CONCORDANCE ─────────────────────────────────────────────────────
function SearchContent({ T, isDesktop, isMobile, sRef, setSRef, doSearch, sLd, sRes, sRef2, dQ, setDQ, odw, setODW, setNR, setTab, setSE, setAIn, dictF, translation }) {
  const card = mkCard(T, isDesktop);
  const btn  = (v="def") => mkBtn(T, false, isDesktop, v);
  const inp  = mkInp(T);
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      <TopBar T={T} isDesktop={isDesktop} title="✦ Concordance" sub="Verses · Bible Dictionary · Word Study"/>
      <div style={{ background:T.chrome, borderBottom:`1px solid ${T.border}`, padding:"10px 14px", flexShrink:0 }}>
        <div style={{ display:"flex", gap:8 }}>
          <input
            value={sRef}
            onChange={e => setSRef(e.target.value)}
            onKeyDown={e => e.key==="Enter" && doSearch()}
            placeholder="Reference (e.g. Romans 8:28 or John 1:1-5)"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            style={{ flex:1, background:T.input, border:`1px solid ${T.border}`, borderRadius:2, padding:"10px 14px", fontSize:13, color:T.text, fontFamily:"inherit", outline:"none" }}
            aria-label="Verse reference search"
          />
          <button onClick={doSearch} style={{ background:T.accent, border:"none", borderRadius:0, width:40, height:40, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }} aria-label="Search">
            <i className="ti ti-search" style={{ color:"#fff", fontSize:17 }} aria-hidden="true"/>
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
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:T.accent, marginBottom:6 }}>{v.fullRef} · v.{v.verse}</div>
                  <div style={{ fontFamily:SERIF_BODY, fontSize:isDesktop?15.5:14.5, color:T.scripture, lineHeight:1.8 }}>{v.text?.trim()}</div>
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <button onClick={() => { setNR(v.fullRef+":"+v.verse); setTab("notes"); setSE(true); }} style={{...btn(),fontSize:11,padding:"4px 10px"}}><i className="ti ti-notebook" style={{fontSize:12}} aria-hidden="true"/>Note</button>
                    <button onClick={() => { setAIn(`Explain ${v.fullRef}:${v.verse} — "${v.text?.slice(0,60)}…" with ${translation} context.`); setTab("ai"); }} style={{...btn(),fontSize:11,padding:"4px 10px"}}><i className="ti ti-sparkles" style={{fontSize:12}} aria-hidden="true"/>Ask AI</button>
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
        <input
          value={dQ}
          onChange={e => setDQ(e.target.value)}
          placeholder="Filter terms…"
          autoComplete="off"
          autoCorrect="off"
          style={{...inp, marginBottom:10}}
          aria-label="Filter dictionary"
        />
        <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(2,1fr)":"1fr", gap:8 }}>
          {dictF.map(([word,entry]) => (
            <div key={word} onClick={() => setODW(odw===word?null:word)}
              style={{ background:T.surface, borderRadius:2, padding:"13px 15px", border:`1px solid ${T.border}`, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontFamily:SERIF_DISPLAY, fontSize:17, color:T.accent }}>{word}</div>
                <i className={`ti ${odw===word?"ti-chevron-up":"ti-chevron-down"}`} style={{ color:T.muted, fontSize:14 }} aria-hidden="true"/>
              </div>
              <div style={{ fontSize:9.5, color:T.muted, textTransform:"uppercase", letterSpacing:".1em", fontWeight:600, marginTop:3 }}>{entry.type}</div>
              {odw===word && <div style={{ fontSize:12.5, color:T.text, lineHeight:1.78, marginTop:8, borderTop:`1px solid ${T.border}`, paddingTop:8 }}>{entry.def}</div>}
            </div>
          ))}
        </div>
        <div style={{height:16}}/>
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function SettingsContent({ T, isDesktop, isMobile, isTablet, theme, changeTheme, fs, incFS, decFS, apiKey, handleApiKey, translation }) {
  const card = mkCard(T, isDesktop);
  const inp  = mkInp(T);
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
      <TopBar T={T} isDesktop={isDesktop} title="✦ Preferences" sub="Personalize your study experience"/>
      <div style={{ flex:1, overflowY:"auto", padding:isDesktop?"16px 20px":"14px" }}>
        <div style={{ display:"grid", gridTemplateColumns:isDesktop?"repeat(2,1fr)":"1fr", gap:10 }}>
          <div>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>Appearance</div>
            <div style={{...card}}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <i className="ti ti-palette" style={{ fontSize:20, color:T.text }} aria-hidden="true"/>
                <div><div style={{ fontSize:14, fontWeight:500, color:T.text }}>Theme</div><div style={{ fontSize:11, color:T.muted }}>Reading background</div></div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                {[["light","Light","#faf9f6","#181614"],["dark","Dark","#141210","#e6e1d8"],["sepia","Sepia","#f5efdc","#3b2d1e"]].map(([id,lbl,bg,fg]) => (
                  <button key={id} onClick={() => changeTheme(id)} style={{ flex:1, borderRadius:2, padding:"12px 4px", fontSize:13, cursor:"pointer", border:`2px solid ${theme===id?T.accent:T.border}`, background:bg, color:fg, fontFamily:"inherit", fontWeight:theme===id?700:400, textAlign:"center", minWidth:0 }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div style={{...card, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <i className="ti ti-text-size" style={{ fontSize:20, color:T.text }} aria-hidden="true"/>
                <div><div style={{ fontSize:14, fontWeight:500, color:T.text }}>Font Size</div><div style={{ fontSize:11, color:T.muted }}>Currently {fs}px</div></div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={decFS} style={{ width:32, height:32, background:T.header, borderRadius:2, border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }} aria-label="Decrease font size"><i className="ti ti-minus" style={{ color:T.headerText, fontSize:14 }} aria-hidden="true"/></button>
                <span style={{ fontSize:16, color:T.text, minWidth:28, textAlign:"center", fontWeight:600 }}>{fs}</span>
                <button onClick={incFS} style={{ width:32, height:32, background:T.header, borderRadius:2, border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }} aria-label="Increase font size"><i className="ti ti-plus" style={{ color:T.headerText, fontSize:14 }} aria-hidden="true"/></button>
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>AI Scholar</div>
            <div style={{...card}}>
              <div style={{ fontSize:14, fontWeight:500, color:T.text, marginBottom:6 }}>Anthropic API Key</div>
              <input
                type="password"
                value={apiKey}
                onChange={e => handleApiKey(e.target.value)}
                placeholder="sk-ant-…"
                autoComplete="off"
                autoCorrect="off"
                style={{...inp, marginBottom:6}}
                aria-label="Anthropic API key"
              />
              <div style={{ fontSize:11, color:T.muted, lineHeight:1.5 }}>Get a free key at console.anthropic.com. Stored in your browser only.</div>
            </div>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8, marginTop:4 }}>Translation</div>
            <div style={{...card, display:"flex", alignItems:"center", gap:12}}>
              <i className="ti ti-book" style={{ fontSize:22, color:T.text }} aria-hidden="true"/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:500, color:T.text }}>{TRANSLATIONS[translation].label}</div>
                <div style={{ fontSize:11, color:T.muted }}>{translation} · {TRANSLATIONS[translation].era} · switch in the Read tab</div>
              </div>
              <div style={{ background:T.accentSoft, border:`1px solid ${T.accentBorder}`, borderRadius:2, padding:"4px 10px", fontSize:10, letterSpacing:".08em", textTransform:"uppercase", color:T.accent, fontWeight:700 }}>Active</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop:4 }}>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>About</div>
          <div style={{...card}}>
            <div style={{ fontSize:15, fontWeight:500, color:T.text, marginBottom:4 }}>The Bible Study App</div>
            <div style={{ fontSize:13, color:T.muted, lineHeight:1.75 }}>A full-featured KJV Bible companion with AI-powered insights, concordance, Bible dictionary, rich notes with Apple Pencil drawing — fully responsive across phone, iPad, and desktop. Notes and highlights sync to Supabase across all your devices.</div>
            <div style={{ fontSize:11, color:T.accent, marginTop:8 }}>Version 2.0 · KJV & ASV · Powered by Claude AI · Synced via Supabase</div>
            <div style={{ fontSize:10, color:T.muted, marginTop:4, fontFamily:"monospace" }}>Build: {__COMMIT_HASH__}</div>
          </div>
        </div>
        <div style={{height:12}}/>
      </div>
    </div>
  );
}

// ─── AUDIO HELPERS ────────────────────────────────────────────────────────────

// Sniff real MIME type from first 8 bytes.
// WebM: starts with 1A 45 DF A3. MP4: "ftyp" box at bytes 4-7.
function sniffMime(bytes, fallback) {
  if (bytes.length >= 4 &&
      bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3)
    return "audio/webm";
  if (bytes.length >= 8 &&
      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70)
    return "audio/mp4";
  return fallback || "audio/mp4";
}

// Decode raw base64 → sniff mime → Blob → blob: URL.
// Returns { url, mime } or null on failure.
function base64ToBlobURL(rawBase64, fallbackMime) {
  try {
    const bin   = atob(rawBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const mime = sniffMime(bytes, fallbackMime);
    return { url: URL.createObjectURL(new Blob([bytes], { type: mime })), mime };
  } catch (e) {
    console.error("[base64ToBlobURL] decode failed:", e.message);
    return null;
  }
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function BibleStudyApp() {
  const rootRef = useRef(null);
  const [cw, setCW]       = useState(400);
  const [tab, setTab]     = useState("read");
  const [theme, setTheme] = useState("light");
  const [fs, setFS]       = useState(17);
  const [translation, setTranslation] = useState("KJV");

  const [prefId, setPrefId] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("bsa_api_key") || "");

  const [bookName, setBN] = useState("John");
  const [chapter, setCh]  = useState(3);
  const [maxCh, setMC]    = useState(21);
  const [verses, setVs]   = useState([]);
  const [loading, setLd]  = useState(false);
  const [hl, setHL]       = useState({});
  const [showBP, setSBP]  = useState(false);
  const [showCP, setSCP]  = useState(false);
  const daily = DAILY[new Date().getDay() % DAILY.length];

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
  const [editingNoteId, setEID] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState(null);
  const [toast, setToast]           = useState(null);
  const recRef        = useRef(null);
  const mediaRecRef   = useRef(null);
  const chunksRef     = useRef([]);
  const audioBlobRef  = useRef(null);
  const audioReadyRef    = useRef(null); // Promise<base64 string> resolved by onstop — awaited in saveNote
  const mimeTypeRef      = useRef("");
  const recBlobUrlsRef   = useRef([]);  // blob: URLs created from saved recordings; revoked on replace/unmount

  const [aiMsgs, setAI] = useState([{ role:"assistant", content:"Shalom! I'm your Bible study companion. Ask me anything — theology, history, Greek & Hebrew word studies, or chapter expositions." }]);
  const [aiIn, setAIn]  = useState("");
  const [aiLd, setAL]   = useState(false);
  const chatEnd = useRef(null);
  const fetchIdRef = useRef(0); // guards against out-of-order chapter/translation fetches

  const [sRef, setSRef] = useState("");
  const [sRes, setSRes] = useState([]);
  const [sRef2, setSR2] = useState("");
  const [sLd, setSL]    = useState(false);
  const [dQ, setDQ]     = useState("");
  const [odw, setODW]   = useState(null);

  const T = THEMES[theme];

  useEffect(() => {
    if (!rootRef.current) return;
    const obs = new ResizeObserver(e => setCW(e[0].contentRect.width));
    obs.observe(rootRef.current);
    return () => obs.disconnect();
  }, []);

  const isMobile  = cw < 640;
  const isTablet  = cw >= 640 && cw < 1024;
  const isDesktop = cw >= 1024;

  const [audioErrors, setAudioErrors] = useState(new Set());

  // Revoke all blob: URLs created for saved-recording playback
  function revokeRecordingBlobURLs() {
    recBlobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    recBlobUrlsRef.current = [];
  }

  useEffect(() => { loadPrefs(); loadNotes(); }, []);
  useEffect(() => { fetchCh(); }, [bookName, chapter, translation]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:"smooth" }); }, [aiMsgs, aiLd]);
  // Revoke recording blob URLs when the component unmounts
  useEffect(() => () => revokeRecordingBlobURLs(), []);

  async function loadPrefs() {
    const { data } = await supabase.from("preferences").select("*").limit(1).maybeSingle();
    if (data) { setTheme(data.theme || "light"); setFS(data.font_size || 17); setTranslation(data.translation === "ASV" ? "ASV" : "KJV"); setPrefId(data.id); }
  }
  async function savePrefsDB(t, f, tr) {
    const payload = { theme: t, font_size: f, translation: tr, updated_at: new Date().toISOString() };
    if (prefId) { await supabase.from("preferences").update(payload).eq("id", prefId); }
    else { const { data } = await supabase.from("preferences").insert(payload).select().single(); if (data) setPrefId(data.id); }
  }
  function changeTheme(t) { setTheme(t); savePrefsDB(t, fs, translation); }
  function incFS() { const n = Math.min(28, fs + 1); setFS(n); savePrefsDB(theme, n, translation); }
  function decFS() { const n = Math.max(12, fs - 1); setFS(n); savePrefsDB(theme, n, translation); }
  function changeTranslation(tr) { setTranslation(tr); savePrefsDB(theme, fs, tr); }
  function handleApiKey(val) { setApiKey(val); localStorage.setItem("bsa_api_key", val); }

  async function fetchCh() {
    const id = ++fetchIdRef.current; // take a ticket; only the latest fetch may apply state
    setLd(true); setVs([]); setHL({});
    const [verseResult, hlResult] = await Promise.all([
      fetch(`https://bible-api.com/${bookKey(bookName)}+${chapter}?translation=${translation.toLowerCase()}`)
        .then(r => r.json())
        .catch(() => ({ verses: [{ verse:1, text:"Network error — please check your internet connection." }] })),
      supabase.from("highlights").select("*").eq("book", bookName).eq("chapter", chapter),
    ]);
    if (id !== fetchIdRef.current) return; // a newer fetch superseded this one — discard stale response
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
      const { data } = await supabase.from("highlights").insert({ book: bookName, chapter, verse: n, color: "gold" }).select().single();
      if (data) setHL(p => ({ ...p, [n]: data.id }));
    }
  }

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
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror  = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function loadRecordings(noteId) {
    const { data, error } = await supabase
      .from("recordings")
      .select("*")
      .eq("note_id", noteId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[loadRecordings] Supabase error:", error.message, error);
      return;
    }
    console.log("[loadRecordings]", data?.length ?? 0, "recording(s) for note", noteId);
    if (data) {
      // Revoke any blob URLs from a previous note before replacing the list
      revokeRecordingBlobURLs();
      setAudioErrors(new Set());

      const mapped = data.map((rec, i) => {
        if (!rec.audio_data) {
          console.warn(`[loadRecordings] rec[${i}] id=${rec.id} has no audio_data — skipped`);
          return { ...rec, playSrc: null, unplayable: true };
        }
        // Handle legacy rows that stored the full data URL instead of raw base64
        const isFullUrl = typeof rec.audio_data === "string" && rec.audio_data.startsWith("data:");
        const rawBase64 = isFullUrl ? rec.audio_data.split(",")[1] : rec.audio_data;

        // Decode base64 → sniff real MIME from magic bytes → Blob → blob: URL.
        // iOS Safari cannot play audio from data: URLs; blob: URLs match the pre-save
        // playback path that already works on the device.
        const result = base64ToBlobURL(rawBase64, rec.mime_type || "audio/mp4");
        if (!result) {
          console.warn(`[loadRecordings] rec[${i}] id=${rec.id} could not be decoded`);
          return { ...rec, playSrc: null, unplayable: true };
        }
        recBlobUrlsRef.current.push(result.url);
        console.log(`[loadRecordings] rec[${i}] sniffed=${result.mime} stored=${rec.mime_type} b64len=${rawBase64.length}`);
        return { ...rec, playSrc: result.url };
      });
      setRecordings(mapped);
    }
  }

  async function deleteRecording(recId) {
    const { error } = await supabase.from("recordings").delete().eq("id", recId);
    if (!error) {
      setRecordings(p => {
        const removed = p.find(r => r.id === recId);
        if (removed?.playSrc?.startsWith("blob:")) {
          URL.revokeObjectURL(removed.playSrc);
          recBlobUrlsRef.current = recBlobUrlsRef.current.filter(u => u !== removed.playSrc);
        }
        return p.filter(r => r.id !== recId);
      });
    }
  }

  function getSupportedMimeType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    return types.find(type => { try { return MediaRecorder.isTypeSupported(type); } catch { return false; } }) || '';
  }

  function openNewNote() {
    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
    clearInterval(recRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioReadyRef.current = null;
    audioBlobRef.current  = null;
    chunksRef.current     = [];
    setEID(null);
    setNT(""); setNR(""); setNText(""); setNTg("");
    setHA(false); setHI(false); setRec(false); setRT(0); setDraw(null); setSC(false);
    setAudioUrl(null);
    revokeRecordingBlobURLs();
    setRecordings([]);
    setAudioErrors(new Set());
    setSaveError(null);
    setSaving(false);
    setSE(true);
  }

  function toggleRec() {
    if (!recOn) {
      // Clear any stale blob from a previous recording session
      audioBlobRef.current = null;
      chunksRef.current    = [];
      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;
      // Create the Promise BEFORE getUserMedia so saveNote can await it even if the user
      // taps Save immediately after Stop — before onstop fires (fixes the stop→save race).
      let resolveAudio;
      const audioPromise = new Promise(res => { resolveAudio = res; });
      audioReadyRef.current = audioPromise;
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        chunksRef.current = [];
        const opts = mimeType ? { mimeType } : {};
        const mr   = new MediaRecorder(stream, opts);
        // Capture the MIME type the browser actually chose — critical when getSupportedMimeType()
        // returned '' and the browser (e.g. iOS Safari) fell back to its own default (audio/mp4)
        mimeTypeRef.current = mr.mimeType || mimeType;
        mr.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          if (chunksRef.current.length === 0) {
            console.error("[recording] onstop — no chunks captured, recording is empty");
            resolveAudio(null);
            return;
          }
          // Strip codec params from MIME type — semicolons in MIME params break data URL parsing
          const storageMime = (mimeTypeRef.current || "audio/webm").split(";")[0];
          const blob = new Blob(chunksRef.current, { type: storageMime });
          console.log("[recording] onstop — chunks:", chunksRef.current.length, "blob size:", blob.size, "mime:", storageMime);
          if (blob.size === 0) {
            console.error("[recording] blob is zero bytes");
            resolveAudio(null);
            return;
          }
          audioBlobRef.current = blob;
          // Resolve the shared Promise with the base64 string; saveNote awaits it
          blobToBase64(blob).then(resolveAudio).catch(() => resolveAudio(null));
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          setHA(true);
        };
        mr.start(100); // 100ms timeslice — ensures ondataavailable fires on iOS Safari
        mediaRecRef.current = mr;
        setRec(true);
        setRT(0);
        recRef.current = setInterval(() => setRT(t => t + 1), 1000);
      }).catch(() => {
        audioReadyRef.current = null; // discard the pending Promise — no mic access
        alert("Microphone access was denied or is unavailable on this device.");
      });
    } else {
      if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
        mediaRecRef.current.stop();
      }
      clearInterval(recRef.current);
      setRec(false);
    }
  }
  function openEdit(note) {
    setSaveError(null);
    setSaving(false);
    setNT(note.title || "");
    setNR(note.ref || "");
    setNText(note.text || "");
    setNTg((note.tags || []).join(", "));
    setHA(note.hasAudio || false);
    setHI(note.hasImg || false);
    setDraw(note.drawing || null);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); }
    setAudioUrl(null);
    audioBlobRef.current = null;
    audioReadyRef.current = null;
    revokeRecordingBlobURLs();
    setRecordings([]);
    setAudioErrors(new Set());
    setEID(note.id);
    setSE(true);
    loadRecordings(note.id);
  }

  async function saveNote() {
    if (!nTitle.trim()) return;
    setSaving(true);
    setSaveError(null);
    // If recording is still in progress, stop it now.
    // onstop will resolve audioReadyRef.current which we await below.
    if (recOn && mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.stop();
      clearInterval(recRef.current);
      setRec(false);
    }
    try {
      const tags = nTags.split(",").map(t => t.trim()).filter(Boolean);
      const ref  = nRef.trim() || `${bookName} ${chapter}`;
      let savedNoteId = editingNoteId;

      if (editingNoteId) {
        const { data, error } = await supabase.from("notes").update({
          title: nTitle.trim(), ref, text: nText.trim(), tags,
          has_audio: hasAudio, has_image: hasImg,
          drawing: drawing ? { dataUrl: drawing } : null,
        }).eq("id", editingNoteId).select().single();
        console.log("[saveNote] update:", { id: data?.id, error: error?.message });
        if (error) throw new Error("Failed to update note: " + error.message);
        if (data) {
          setNotes(p => p.map(n => n.id === editingNoteId ? {
            ...data,
            date:     new Date(data.created_at).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
            hasAudio: data.has_audio, hasImg: data.has_image,
            drawing:  data.drawing?.dataUrl || null,
          } : n));
        }
      } else {
        const { data, error } = await supabase.from("notes").insert({
          title: nTitle.trim(), ref, text: nText.trim(), tags,
          has_audio: hasAudio, has_image: hasImg,
          drawing: drawing ? { dataUrl: drawing } : null,
        }).select().single();
        console.log("[saveNote] insert:", { id: data?.id, error: error?.message });
        if (error) throw new Error("Failed to save note: " + error.message);
        if (data) {
          savedNoteId = data.id;
          // Switch to edit mode so a retry (if recording fails) updates rather than re-inserts
          setEID(data.id);
          setNotes(p => [{
            ...data,
            date:     new Date(data.created_at).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
            hasAudio: data.has_audio, hasImg: data.has_image,
            drawing:  data.drawing?.dataUrl || null,
          }, ...p]);
        }
      }

      const pendingAudio = audioReadyRef.current;
      if (pendingAudio && savedNoteId) {
        const audioData = await pendingAudio; // waits for onstop + base64 — resolves even if saved immediately after stop
        if (!audioData) throw new Error("Recording appears to be empty — please try again.");
        const mimeForStorage = (mimeTypeRef.current || "audio/webm").split(";")[0];
        // Extract raw base64 — store without the "data:...;base64," prefix so we control data URL construction at play time
        const rawBase64 = audioData.includes(",") ? audioData.split(",")[1] : audioData;
        const label = new Date().toLocaleString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
        console.log("[recordings] inserting", mimeForStorage, "base64 size:", rawBase64.length);
        // 12-second timeout — offline at church is a real scenario
        const { data: recData, error: recErr } = await Promise.race([
          supabase.from("recordings").insert({
            note_id:    savedNoteId,
            label,
            audio_data: rawBase64,
            duration:   recT,
            mime_type:  mimeForStorage,
          }).select().single(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Recording not saved — connection timed out. Check your network and try again.")), 12000)
          ),
        ]);
        console.log("[recordings] insert result:", { data: recData, error: recErr });
        if (recErr) {
          console.error("[recordings] insert failed:", recErr);
          throw new Error("Note saved — but recording failed to persist: " + recErr.message);
        }
        // Show success toast (visible after editor closes)
        setToast("✦ Recording saved");
        setTimeout(() => setToast(null), 4000);
        // Revoke the ephemeral blob URL now that the recording is persisted
        if (audioUrl && audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        // Immediately populate recordings state so the player is available without reopening the note
        if (recData) {
          const playSrc = `data:${mimeForStorage};base64,${recData.audio_data}`;
          setRecordings(prev => [...prev, { ...recData, playSrc }]);
        }
        audioReadyRef.current = null;
        audioBlobRef.current = null;
      }

      // Success — close editor and reset all fields
      audioReadyRef.current = null;
      audioBlobRef.current  = null;
      setEID(null);
      setNT(""); setNR(""); setNText(""); setNTg("");
      setHA(false); setHI(false); setRec(false); setDraw(null);
      if (audioUrl && audioUrl.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      revokeRecordingBlobURLs();
      setRecordings([]);
      setAudioErrors(new Set());
      clearInterval(recRef.current);
      setSE(false);
    } catch (err) {
      console.error("[saveNote]", err);
      setSaveError(err.message || "Save failed — please try again.");
    } finally {
      setSaving(false);
    }
  }
  async function deleteNote(id) {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (!error) {
      setNotes(p => p.filter(x => x.id !== id));
    }
  }

  async function sendAI(override) {
    const msg = override || aiIn.trim();
    if (!msg || aiLd) return;
    if (!apiKey) { alert("Add your Anthropic API key in Preferences."); return; }
    setAIn(""); setAL(true);
    const upd = [...aiMsgs, { role:"user", content:msg }]; setAI(upd);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:"You are a deeply knowledgeable, pastoral Bible study assistant for 'The Bible Study App.' Study exclusively from the " + TRANSLATIONS[translation].label + " (" + translation + "). Provide theological depth, historical context, and original Greek/Hebrew insights. Always cite specific " + translation + " references. Be warm, reverent, and thorough. Format concisely for reading.", messages:upd.map(m => ({ role:m.role, content:m.content })) }),
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
        headers: { "Content-Type":"application/json", "x-api-key":apiKey, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:600, system:"You are a " + translation + " Bible study assistant. Format your response exactly as:\n\nOVERVIEW:\n[2 sentences]\n\nKEY POINTS:\n• [point 1]\n• [point 2]\n• [point 3]\n\nEXPOSITION:\n[2-3 sentences of theological insight]\n\nBe concise and " + translation + "-focused.", messages:[{ role:"user", content:`Smart study summary for ${ref} (${translation})` }] }),
      });
      const d = await r.json();
      const txt = d.content?.find(c => c.type==="text")?.text || "";
      setNText(p => p ? p + "\n\n" + txt : txt);
    } catch {
      setNText(p => p + "\n\n[Summary unavailable — check connection]");
    }
  }

  async function doSearch() {
    if (!sRef.trim()) return; setSL(true); setSRes([]); setSR2(sRef);
    try {
      const r = await fetch(`https://bible-api.com/${sRef.trim().replace(/ /g,"+")}?translation=${translation.toLowerCase()}`);
      const d = await r.json();
      setSRes(d.verses ? d.verses.map(v => ({ ...v, fullRef:d.reference })) : []);
    } catch { setSRes([]); }
    setSL(false);
  }

  const dictF = Object.entries(DICT).filter(([k]) => dQ ? k.toLowerCase().includes(dQ.toLowerCase()) : true);
  const fmt   = t => `${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`;

  // zIndex 200 keeps sheets above the fixed bottom nav bar (zIndex 50)
  const overlay = { position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:200, display:"flex", flexDirection:"column", justifyContent:"flex-end" };
  const sheet   = (big) => ({ background:T.bg, borderRadius:0, padding:isTablet||isDesktop?22:16, maxHeight:big?"85vh":"70vh", overflowY:"auto", borderTop:`2px solid ${T.accent}` });
  /* Book/chapter pickers open near the chips (top of the screen) instead of
     as a bottom sheet, on every breakpoint. */
  const pickerOverlay = { position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", padding:"64px 12px 12px", boxSizing:"border-box" };
  const pickerSheet   = (big) => ({ background:T.bg, borderRadius:0, padding:isTablet||isDesktop?22:16, maxHeight:big?"78vh":"66vh", overflowY:"auto", width:"100%", maxWidth:720, border:`1px solid ${T.border}`, borderTop:`2px solid ${T.accent}`, boxShadow:"0 12px 40px rgba(0,0,0,.25)", boxSizing:"border-box" });
  const inp     = mkInp(T);
  const btn     = (v="def") => mkBtn(T, isTablet, isDesktop, v);

  return (
    <div ref={rootRef} style={{ width:"100%", height:"100dvh", background:T.bg, fontFamily:SANS, position:"relative", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      <div style={{ display:"flex", flex:1, minHeight:0, height:"100%" }}>
        {isDesktop && <Sidebar T={T} tab={tab} setTab={setTab} translation={translation}/>}
        <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0, overflow:"hidden", paddingBottom:!isDesktop?64:0 }}>
          {tab==="read"     && <ReaderContent T={T} isDesktop={isDesktop} isTablet={isTablet} isMobile={isMobile} bookName={bookName} chapter={chapter} maxCh={maxCh} verses={verses} loading={loading} hl={hl} daily={daily} fs={fs} translation={translation} changeTranslation={changeTranslation} setSBP={setSBP} setSCP={setSCP} toggleHL={toggleHL} setNR={setNR} setTab={setTab} setSE={setSE} setAIn={setAIn} setCh={setCh}/>}
          {tab==="notes"    && <NotesContent T={T} isDesktop={isDesktop} isMobile={isMobile} notes={notes} translation={translation} setSE={openNewNote} deleteNote={deleteNote} openEdit={openEdit}/>}
          {tab==="ai"       && <AIContent T={T} isDesktop={isDesktop} isMobile={isMobile} aiMsgs={aiMsgs} aiIn={aiIn} setAIn={setAIn} aiLd={aiLd} chatEnd={chatEnd} sendAI={sendAI}/>}
          {tab==="search"   && <SearchContent T={T} isDesktop={isDesktop} isMobile={isMobile} sRef={sRef} setSRef={setSRef} doSearch={doSearch} sLd={sLd} sRes={sRes} sRef2={sRef2} dQ={dQ} setDQ={setDQ} odw={odw} setODW={setODW} setNR={setNR} setTab={setTab} setSE={setSE} setAIn={setAIn} dictF={dictF} translation={translation}/>}
          {tab==="settings" && <SettingsContent T={T} isDesktop={isDesktop} isMobile={isMobile} isTablet={isTablet} theme={theme} changeTheme={changeTheme} fs={fs} incFS={incFS} decFS={decFS} apiKey={apiKey} handleApiKey={handleApiKey} translation={translation}/>}
          {!isDesktop && <BottomNav T={T} tab={tab} setTab={setTab}/>}
        </div>
      </div>

      {/* ══ BOOK PICKER ════════════════════════════════════════════════════ */}
      {showBP && (
        <div style={pickerOverlay} onClick={() => setSBP(false)}>
          <div style={pickerSheet(true)} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:20, color:T.heading, fontFamily:SERIF_DISPLAY }}>Select Book</span>
              <button onClick={() => setSBP(false)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, padding:4 }}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
            </div>
            {[["Old Testament",BOOKS_OT],["New Testament",BOOKS_NT]].map(([label,list]) => (
              <div key={label} style={{marginBottom:14}}>
                <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>{label}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {list.map(([name,chs]) => (
                    <button key={name} onClick={() => pickBook(name,chs)}
                      style={{ background:bookName===name?T.accent:T.surface2, border:`1px solid ${bookName===name?T.accent:T.border}`, borderRadius:2, padding:isTablet||isDesktop?"7px 12px":"5px 9px", fontSize:isTablet||isDesktop?13:11, color:bookName===name?"#fff":T.text, cursor:"pointer", fontFamily:"inherit", fontWeight:bookName===name?600:400, minHeight:36 }}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ CHAPTER PICKER ═════════════════════════════════════════════════ */}
      {showCP && (
        <div style={pickerOverlay} onClick={() => setSCP(false)}>
          <div style={pickerSheet(false)} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:17, fontWeight:500, color:T.text }}>{bookName} — Chapter</span>
              <button onClick={() => setSCP(false)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, padding:4 }}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {Array.from({length:maxCh},(_,i)=>i+1).map(n => (
                <button key={n} onClick={() => { setCh(n); setSCP(false); }}
                  style={{ width:isTablet||isDesktop?52:46, height:isTablet||isDesktop?52:46, background:chapter===n?T.accent:T.surface2, border:`1px solid ${chapter===n?T.accent:T.border}`, borderRadius:2, fontSize:isTablet||isDesktop?15:13, fontWeight:chapter===n?600:400, color:chapter===n?"#fff":T.text, cursor:"pointer", fontFamily:"inherit" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ NOTE EDITOR ════════════════════════════════════════════════════ */}
      {showEditor && (
        <div style={overlay}>
          <div style={sheet(true)} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <span style={{ fontSize:20, color:T.heading, fontFamily:SERIF_DISPLAY }}>{editingNoteId ? "Edit Note" : "New Study Note"}</span>
              <button onClick={() => {
                if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") mediaRecRef.current.stop();
                clearInterval(recRef.current);
                if (audioUrl) { URL.revokeObjectURL(audioUrl); }
                audioBlobRef.current = null;
                audioReadyRef.current = null;
                chunksRef.current = [];
                setAudioUrl(null); setEID(null); setRec(false); setRT(0); setSC(false); setSE(false);
                setNT(""); setNR(""); setNText(""); setNTg("");
                setHA(false); setHI(false); setDraw(null);
                setRecordings([]); setSaveError(null); setSaving(false);
              }} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, padding:4 }}><i className="ti ti-x" style={{fontSize:20}} aria-hidden="true"/></button>
            </div>
            <input value={nTitle} onChange={e => setNT(e.target.value)} placeholder="Note title…" autoComplete="off" autoCorrect="off" autoCapitalize="sentences" style={{...inp,marginBottom:9}} aria-label="Note title"/>
            <input value={nRef}   onChange={e => setNR(e.target.value)} placeholder="Verse reference (e.g. John 3:16)" autoComplete="off" autoCorrect="off" autoCapitalize="words" style={{...inp,marginBottom:9}} aria-label="Verse reference"/>
            <textarea value={nText} onChange={e => setNText(e.target.value)} placeholder="Write your study notes here…" rows={isTablet||isDesktop?6:4} autoComplete="off" autoCorrect="off" autoCapitalize="sentences" style={{...inp,marginBottom:9,resize:"none"}} aria-label="Note body"/>
            <input value={nTags} onChange={e => setNTg(e.target.value)} placeholder="Tags — comma separated (e.g. Grace, Faith)" autoComplete="off" autoCorrect="off" style={{...inp,marginBottom:14}} aria-label="Note tags"/>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>Attach to Note</div>
            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              <button onClick={toggleRec} style={{...btn(recOn?"red":"def"),animation:recOn?"pulse 1.5s infinite":"none"}}>
                <i className={`ti ${recOn?"ti-player-stop":"ti-microphone"}`} aria-hidden="true"/>
                {recOn?`● Stop · ${fmt(recT)}`:hasAudio?"✓ Audio":"Record"}
              </button>
              <button onClick={() => setHI(true)} style={{...btn(), ...(hasImg && {background:"#1A7A4A"})}}>
                <i className="ti ti-camera" aria-hidden="true"/>{hasImg?"✓ Photo":"Snap Photo"}
              </button>
              <button onClick={() => setSC(!showCanvas)} style={{...btn(), ...(showCanvas && {background:T.accentSoft, border:`1px solid ${T.accent}`, color:T.accent})}}>
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
            {audioUrl && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:T.muted, marginBottom:5 }}>✦ Audio recorded — play back below</div>
                <audio
                  controls
                  src={audioUrl}
                  style={{ width:"100%", borderRadius:8 }}
                  onError={e => console.error('[AUDIO BLOB ERROR]', e.target.error?.code, e.target.error?.message)}
                />
                <button onClick={() => { URL.revokeObjectURL(audioUrl); setAudioUrl(null); setHA(false); audioBlobRef.current = null; audioReadyRef.current = null; }} style={{...btn(),marginTop:6,fontSize:10,padding:"4px 10px"}}>Remove audio</button>
              </div>
            )}
            {editingNoteId && recordings.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:T.muted, marginBottom:8 }}>Saved Recordings</div>
                {recordings.map(rec => (
                  <div key={rec.id} style={{ background:T.surface2, borderRadius:2, padding:"10px 12px", marginBottom:8, border:`1px solid ${T.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontSize:11, color:T.muted }}>{rec.label}{rec.duration > 0 ? ` · ${fmt(rec.duration)}` : ""}</span>
                      <button onClick={() => deleteRecording(rec.id)} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, padding:2, fontSize:13 }} aria-label="Delete recording">
                        <i className="ti ti-trash" aria-hidden="true"/>
                      </button>
                    </div>
                    {rec.unplayable ? (
                      <div style={{ fontSize:11, color:T.muted, padding:"4px 0" }}>
                        ⚠ Audio could not be loaded — please re-record.
                      </div>
                    ) : (
                      <>
                        <audio
                          key={rec.playSrc}
                          controls
                          src={rec.playSrc}
                          style={{ width:"100%", borderRadius:6 }}
                          onError={e => {
                            console.error("[AUDIO ERROR]", e.target.error?.code, e.target.error?.message);
                            setAudioErrors(prev => new Set([...prev, rec.id]));
                          }}
                        />
                        {audioErrors.has(rec.id) && (
                          <div style={{ fontSize:11, color:"#C0392B", marginTop:4 }}>
                            ⚠ Playback failed — audio may be from an incompatible recording session. Please re-record.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            {saveError && (
              <div style={{ background:"rgba(192,57,43,.1)", border:"1px solid rgba(192,57,43,.4)", borderRadius:8, padding:"9px 12px", marginBottom:8, fontSize:12, color:"#C0392B", lineHeight:1.55 }}>
                {saveError}
              </div>
            )}
            <button onClick={saveNote} disabled={!nTitle.trim() || saving} style={{...btn("gold"),width:"100%",justifyContent:"center",opacity:(nTitle.trim()&&!saving)?1:.45,minHeight:44}}>
              <i className={`ti ${saving?"ti-loader-2":"ti-device-floppy"}`} aria-hidden="true"/>
              {saving ? "Saving…" : "Save Note"}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", background:"rgba(20,110,50,0.95)", color:"#fff", borderRadius:12, padding:"11px 22px", fontSize:13, fontWeight:500, zIndex:10000, maxWidth:"85vw", textAlign:"center", boxShadow:"0 4px 16px rgba(0,0,0,0.3)", pointerEvents:"none" }}>
          {toast}
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.65}}*{box-sizing:border-box}body{margin:0}`}</style>
    </div>
  );
}
