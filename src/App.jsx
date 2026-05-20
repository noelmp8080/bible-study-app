import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import rawBibleData from './data/kjv.json'

// ── Full Bible data ────────────────────────────────────────────────────────────
const BOOKS = rawBibleData.books

// ── OT / NT split ─────────────────────────────────────────────────────────────
const OT_SET = new Set([
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
])

// ── Highlight color palette ────────────────────────────────────────────────────
const HC = {
  amber:  { dot: '#f59e0b', light: 'rgba(245,158,11,0.22)',  dark: 'rgba(245,158,11,0.19)', label: 'Promise'  },
  cyan:   { dot: '#06b6d4', light: 'rgba(6,182,212,0.2)',    dark: 'rgba(6,182,212,0.17)',  label: 'Command'  },
  violet: { dot: '#8b5cf6', light: 'rgba(139,92,246,0.2)',   dark: 'rgba(139,92,246,0.17)', label: 'Prophecy' },
  rose:   { dot: '#f43f5e', light: 'rgba(244,63,94,0.18)',   dark: 'rgba(244,63,94,0.15)',  label: 'Prayer'   },
  lime:   { dot: '#84cc16', light: 'rgba(132,204,22,0.2)',   dark: 'rgba(132,204,22,0.17)', label: 'Key Verse'},
}

// ── localStorage helper ────────────────────────────────────────────────────────
const ls = {
  get: (k, def) => {
    try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def } catch { return def }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)) } catch {}
  },
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function getBook(n)    { return BOOKS.find(b => b.name === n) || BOOKS[0] }
function parseKey(k)   { const p = k.split('-'); return { verse: parseInt(p[p.length-1]), chapter: parseInt(p[p.length-2]), book: p.slice(0,-2).join('-') } }
function iBtn(d)       { return { background: d.btnBg, border: `1px solid ${d.border}`, borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: d.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' } }

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {

  // ── State (localStorage-backed where appropriate) ──────────────────────────
  const [mainTab,    setMainTab]     = useState('read')
  const [curBook,    setCurBook]     = useState(() => ls.get('bsa_book',    'Genesis'))
  const [curChapter, setCurChapter]  = useState(() => ls.get('bsa_chapter', 1))
  const [selVerse,   setSelVerse]    = useState(null)                                       // session-only
  const [notes,      setNotes]       = useState(() => ls.get('bsa_notes',   {}))
  const [highlights, setHighlights]  = useState(() => ls.get('bsa_hl',      {}))
  const [noteText,   setNoteText]    = useState('')
  const [searchQ,    setSearchQ]     = useState('')
  const [searchR,    setSearchR]     = useState([])
  const [expBook,    setExpBook]     = useState(() => ls.get('bsa_book',    'Genesis'))     // opens to last-read book
  const [isDark,     setIsDark]      = useState(() => ls.get('bsa_dark',    false))
  const [fontSz,     setFontSz]      = useState(() => ls.get('bsa_font',    17))
  const [aiConvo,    setAiConvo]     = useState([])
  const [aiInput,    setAiInput]     = useState('')
  const [aiLoading,  setAiLoading]   = useState(false)
  const [copied,     setCopied]      = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyDraft,  setApiKeyDraft]  = useState(() => ls.get('bsa_api_key', ''))
  const [savedTick,    setSavedTick]    = useState(false)

  const verseRefs   = useRef({})
  const convoRef    = useRef(null)
  const aiInputRef  = useRef(null)
  const searchTimer = useRef(null)   // debounce ref

  // ── Persistence effects ────────────────────────────────────────────────────
  useEffect(() => { ls.set('bsa_book',    curBook)    }, [curBook])
  useEffect(() => { ls.set('bsa_chapter', curChapter) }, [curChapter])
  useEffect(() => { ls.set('bsa_notes',   notes)      }, [notes])
  useEffect(() => { ls.set('bsa_hl',      highlights) }, [highlights])
  useEffect(() => { ls.set('bsa_dark',    isDark)     }, [isDark])
  useEffect(() => { ls.set('bsa_font',    fontSz)     }, [fontSz])

  // ── Reset study panel when verse changes ──────────────────────────────────
  useEffect(() => {
    if (selVerse !== null) {
      setNoteText(notes[`${curBook}-${curChapter}-${selVerse}`] || '')
      setAiConvo([])
      setAiInput('')
    }
  }, [selVerse, curBook, curChapter]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll AI conversation ───────────────────────────────────────────
  useEffect(() => {
    if (convoRef.current) convoRef.current.scrollTop = convoRef.current.scrollHeight
  }, [aiConvo])

  // ── Derived values ────────────────────────────────────────────────────────
  const book       = getBook(curBook)
  const bIdx       = BOOKS.findIndex(b => b.name === curBook)
  const chIdx      = book.chapters.findIndex(c => Number(c.chapter) === Number(curChapter))
  const safeChIdx  = chIdx >= 0 ? chIdx : 0
  const chapter    = book.chapters[safeChIdx]
  const selKey     = selVerse !== null ? `${curBook}-${curChapter}-${selVerse}` : null
  const selVerseTxt= selVerse !== null ? chapter?.verses.find(v => Number(v.verse) === selVerse)?.text : null
  const totalNotes = Object.keys(notes).length
  const atStart    = bIdx === 0 && safeChIdx === 0
  const atEnd      = bIdx === BOOKS.length - 1 && safeChIdx === book.chapters.length - 1
  const otBooks    = BOOKS.filter(b => OT_SET.has(b.name))
  const ntBooks    = BOOKS.filter(b => !OT_SET.has(b.name))

  // ── Theme ─────────────────────────────────────────────────────────────────
  const d = isDark ? {
    bg: '#0d1117', nav: '#0d1117', sidebar: '#111827', surface: '#161d2b', card: '#1e2a3d',
    border: '#263347', text: '#dde3ed', muted: '#8896aa', hint: '#556070',
    accent: '#7c9ef5', accentSoft: 'rgba(124,158,245,0.12)',
    selBg: 'rgba(124,158,245,0.13)', selRing: 'rgba(124,158,245,0.3)',
    aBook: 'rgba(124,158,245,0.15)', aBookT: '#9db5fa',
    btnBg: 'rgba(124,158,245,0.1)', inputBg: '#1a2233',
    userB: '#1e2a3d', assistB: 'rgba(124,158,245,0.08)',
    aiPanel: 'rgba(124,158,245,0.06)', aiPBorder: 'rgba(124,158,245,0.18)',
    aiHeader: 'rgba(124,158,245,0.1)',
  } : {
    bg: '#f7f6f2', nav: '#ffffff', sidebar: '#ffffff', surface: '#f0ede6', card: '#ffffff',
    border: '#e5e0d8', text: '#1a1714', muted: '#7a726a', hint: '#b0a89e',
    accent: '#5046e4', accentSoft: 'rgba(80,70,228,0.07)',
    selBg: 'rgba(80,70,228,0.06)', selRing: 'rgba(80,70,228,0.22)',
    aBook: 'rgba(80,70,228,0.08)', aBookT: '#5046e4',
    btnBg: 'rgba(80,70,228,0.07)', inputBg: '#eceae4',
    userB: '#ede9e2', assistB: 'rgba(80,70,228,0.05)',
    aiPanel: 'rgba(80,70,228,0.03)', aiPBorder: 'rgba(80,70,228,0.14)',
    aiHeader: 'rgba(80,70,228,0.06)',
  }

  // ── Shared style shorthands ───────────────────────────────────────────────
  const sf = { fontFamily: 'system-ui, sans-serif' }
  const sLabel = { fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: d.hint, padding: '10px 10px 3px', ...sf }
  const navTabStyle = t => ({
    padding: '0 22px', height: '100%', border: 'none', background: 'transparent',
    color: mainTab === t ? d.accent : d.muted, fontSize: 13,
    fontWeight: mainTab === t ? 700 : 400, cursor: 'pointer',
    borderBottom: `2px solid ${mainTab === t ? d.accent : 'transparent'}`,
    transition: 'color .15s', letterSpacing: '0.01em', ...sf,
  })

  // ── Handlers ──────────────────────────────────────────────────────────────
  const loadChapter = useCallback((bName, chNum) => {
    setCurBook(bName)
    setCurChapter(Number(chNum))
    setSelVerse(null)
    setAiConvo([])
    setSearchQ('')
    setSearchR([])
    setExpBook(bName)
  }, [])

  const goNext = () => {
    const ni = safeChIdx + 1
    if (ni < book.chapters.length) loadChapter(curBook, book.chapters[ni].chapter)
    else if (bIdx < BOOKS.length - 1) { const nb = BOOKS[bIdx + 1]; loadChapter(nb.name, nb.chapters[0].chapter) }
  }

  const goPrev = () => {
    const pi = safeChIdx - 1
    if (pi >= 0) loadChapter(curBook, book.chapters[pi].chapter)
    else if (bIdx > 0) { const pb = BOOKS[bIdx - 1]; loadChapter(pb.name, pb.chapters[pb.chapters.length - 1].chapter) }
  }

  const doCopy = (e, text, vNum) => {
    e.stopPropagation()
    navigator.clipboard.writeText(`"${text}" — ${curBook} ${curChapter}:${vNum} (KJV)`)
    setCopied(vNum)
    setTimeout(() => setCopied(null), 2000)
  }

  const doHL = (e, vid, ck) => {
    e.stopPropagation()
    setHighlights(prev => {
      const n = { ...prev }
      n[vid] === ck ? delete n[vid] : (n[vid] = ck)
      return n
    })
  }

  const saveNote = () => {
    if (selVerse === null || !noteText.trim()) return
    setNotes(prev => ({ ...prev, [`${curBook}-${curChapter}-${selVerse}`]: noteText.trim() }))
  }

  const delNote = k => setNotes(prev => { const n = { ...prev }; delete n[k]; return n })

  // Debounced search — 300ms delay prevents stutter on 31k+ verses
  const doSearch = useCallback(q => {
    setSearchQ(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.trim().length < 3) { setSearchR([]); return }
    searchTimer.current = setTimeout(() => {
      const ql = q.toLowerCase(), res = []
      outer: for (const b of BOOKS) {
        for (const ch of b.chapters) {
          for (const v of ch.verses) {
            if (v.text.toLowerCase().includes(ql)) {
              res.push({ book: b.name, chapter: ch.chapter, verse: v.verse, text: v.text })
              if (res.length >= 50) break outer
            }
          }
        }
      }
      setSearchR(res)
    }, 300)
  }, [])

  // ── AI conversation ────────────────────────────────────────────────────────
  const sendAi = async msg => {
    if (!msg.trim() || aiLoading) return
    setAiLoading(true)
    const vt  = chapter?.verses.find(v => Number(v.verse) === selVerse)?.text
    const ref = `${curBook} ${curChapter}:${selVerse}`
    const newMsg  = { role: 'user', content: msg }
    const updated = [...aiConvo, newMsg]
    setAiConvo(updated)
    setAiInput('')
    try {
      const systemPrompt = `You are a warm, knowledgeable biblical scholar. The user is studying ${ref} (KJV): "${vt}". Answer questions helpfully and concisely. Plain text only — no asterisks, markdown, or symbols.`
      const apiKey = ls.get('bsa_api_key', '')
      if (!apiKey) {
        setAiConvo([...updated, { role: 'assistant', content: 'Add your Anthropic API key in Settings (⚙) to use Scholar.' }])
        setAiLoading(false)
        return
      }
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: systemPrompt,
          messages: updated,
        }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      const reply = data.content?.[0]?.text ?? 'No response received.'
      setAiConvo([...updated, { role: 'assistant', content: reply }])
    } catch {
      setAiConvo([...updated, { role: 'assistant', content: 'Connection failed. Please check your network and try again.' }])
    } finally {
      setAiLoading(false)
      setTimeout(() => aiInputRef.current?.focus(), 100)
    }
  }

  // ── All notes grouped by book ─────────────────────────────────────────────
  const allNotesGrouped = useMemo(() => {
    const g = {}
    Object.entries(notes).forEach(([k, text]) => {
      const { book, chapter, verse } = parseKey(k)
      if (!g[book]) g[book] = []
      g[book].push({ key: k, chapter, verse, text })
    })
    Object.values(g).forEach(arr => arr.sort((a, b) => a.chapter - b.chapter || a.verse - b.verse))
    return g
  }, [notes])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: d.bg, color: d.text, fontFamily: 'Georgia, "Times New Roman", serif', overflow: 'hidden', transition: 'background .2s, color .2s' }}>
      <style>{`
        @keyframes bop { 0%,80%,100%{transform:scale(.45);opacity:.5} 40%{transform:scale(1);opacity:1} }
        ::-webkit-scrollbar { width: 5px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: ${d.border}; border-radius: 3px }
      `}</style>

      {/* ── Top Navigation Bar ────────────────────────────────────────────── */}
      <header style={{ height: 50, flexShrink: 0, background: d.nav, borderBottom: `1px solid ${d.border}`, display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: d.accent, letterSpacing: '-0.3px' }}>Study Bible</span>
          <span style={{ fontSize: 10, color: d.hint, ...sf }}>KJV</span>
        </div>

        {/* Main tabs */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <button onClick={() => setMainTab('read')}  style={navTabStyle('read')}>Read</button>
          <button onClick={() => setMainTab('study')} style={navTabStyle('study')}>
            Study
            {selVerse !== null && <span style={{ marginLeft: 5, width: 5, height: 5, borderRadius: '50%', background: d.accent, display: 'inline-block', verticalAlign: 'middle' }} />}
          </button>
          <button onClick={() => setMainTab('notes')} style={navTabStyle('notes')}>
            Notes{totalNotes > 0 && <span style={{ marginLeft: 5, fontSize: 10, color: d.hint, ...sf }}>({totalNotes})</span>}
          </button>
        </div>

        {/* Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {mainTab === 'read' && (
            <div style={{ position: 'relative', marginRight: 4 }}>
              <input
                value={searchQ}
                onChange={e => doSearch(e.target.value)}
                placeholder="Search all verses…"
                style={{ width: 170, padding: '5px 26px 5px 10px', background: d.inputBg, border: `1px solid ${d.border}`, borderRadius: 16, fontSize: 12, color: d.text, outline: 'none', ...sf }}
              />
              {searchQ && (
                <button onClick={() => { setSearchQ(''); setSearchR([]) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: d.hint, fontSize: 12 }}>✕</button>
              )}
            </div>
          )}
          <button onClick={() => setFontSz(p => p <= 15 ? 19 : p >= 19 ? 15 : p + 2)} style={{ ...iBtn(d), fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 12, padding: '5px 8px' }}>aA</button>
          <button onClick={() => setIsDark(p => !p)} style={{ ...iBtn(d), fontSize: 15, padding: '5px 8px' }}>{isDark ? '☀' : '🌙'}</button>
          <button onClick={() => setShowSettings(p => !p)} style={{ ...iBtn(d), fontSize: 15, padding: '5px 8px' }} title="Scholar Settings">⚙</button>
        </div>
      </header>

      {/* ── Settings Panel ────────────────────────────────────────────────── */}
      {showSettings && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '60px 20px 0' }}
        >
          <div style={{ background: d.sidebar, border: `1px solid ${d.border}`, borderRadius: 12, padding: 20, width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.35)', ...sf }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: d.text }}>Scholar Settings</span>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: d.hint, fontSize: 14, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: d.hint, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>Anthropic API Key</div>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={e => setApiKeyDraft(e.target.value)}
              placeholder="sk-ant-..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: d.inputBg, border: `1px solid ${d.border}`, borderRadius: 8, fontSize: 13, color: d.text, outline: 'none', marginBottom: 6 }}
            />
            <div style={{ fontSize: 11, color: d.hint, marginBottom: 14, lineHeight: 1.6 }}>
              Get a free key at console.anthropic.com — personal use costs pennies.
            </div>
            <button
              onClick={() => { ls.set('bsa_api_key', apiKeyDraft); setSavedTick(true); setTimeout(() => setSavedTick(false), 2000) }}
              style={{ padding: '9px 18px', background: d.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {savedTick ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── Content Area ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar — Read tab only ─────────────────────────────────────── */}
        {mainTab === 'read' && (
          <aside style={{ width: 210, flexShrink: 0, background: d.sidebar, borderRight: `1px solid ${d.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Highlight legend */}
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${d.border}`, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {Object.entries(HC).map(([k, c]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot }} />
                  <span style={{ fontSize: 9, color: d.hint, ...sf }}>{c.label}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              <div style={sLabel}>Old Testament</div>
              {otBooks.map(b => (
                <BookEntry key={b.name} book={b} isExpanded={expBook === b.name} isActive={curBook === b.name} curChapter={curBook === b.name ? curChapter : null} onBookClick={n => setExpBook(p => p === n ? null : n)} onChapterClick={ch => loadChapter(b.name, ch)} d={d} />
              ))}
              <div style={{ ...sLabel, paddingTop: 12 }}>New Testament</div>
              {ntBooks.map(b => (
                <BookEntry key={b.name} book={b} isExpanded={expBook === b.name} isActive={curBook === b.name} curChapter={curBook === b.name ? curChapter : null} onBookClick={n => setExpBook(p => p === n ? null : n)} onChapterClick={ch => loadChapter(b.name, ch)} d={d} />
              ))}
            </div>
          </aside>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            READ TAB
        ══════════════════════════════════════════════════════════════════ */}
        {mainTab === 'read' && (
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {/* Chapter nav bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 28px', borderBottom: `1px solid ${d.border}`, background: d.sidebar, flexShrink: 0 }}>
              <button onClick={goPrev} disabled={atStart} style={{ ...iBtn(d), opacity: atStart ? .3 : 1 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, flex: 1, textAlign: 'center' }}>{curBook} {curChapter}</h2>
              <button onClick={goNext} disabled={atEnd} style={{ ...iBtn(d), opacity: atEnd ? .3 : 1 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* Verse list / search results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px 90px' }}>
              <div>

                {/* Search results */}
                {searchR.length > 0 || (searchQ.length >= 3 && searchR.length === 0) ? (
                  <div>
                    <div style={{ fontSize: 11, color: d.hint, marginBottom: 14, ...sf }}>
                      {searchR.length}{searchR.length === 50 ? '+' : ''} result{searchR.length !== 1 ? 's' : ''} for "{searchQ}"
                    </div>
                    {searchR.length === 0 && <div style={{ color: d.muted, textAlign: 'center', padding: '40px 0', ...sf }}>No results found</div>}
                    {searchR.map((r, i) => (
                      <div key={i} onClick={() => { loadChapter(r.book, r.chapter); setTimeout(() => { setSelVerse(Number(r.verse)); verseRefs.current[r.verse]?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 60) }}
                        style={{ padding: '11px 13px', marginBottom: 7, background: d.card, border: `1px solid ${d.border}`, borderRadius: 9, cursor: 'pointer' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: d.accent, marginBottom: 4, ...sf }}>{r.book} {r.chapter}:{r.verse}</div>
                        <div style={{ fontSize: fontSz - 2, lineHeight: 1.65 }}>{r.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Verse list */
                  chapter?.verses.map(v => {
                    const vNum   = Number(v.verse)
                    const vid    = `${curBook}-${curChapter}-${v.verse}`
                    const isSel  = vNum === selVerse
                    const hlC    = highlights[vid]
                    const hlBg   = hlC ? (isDark ? HC[hlC].dark : HC[hlC].light) : 'transparent'
                    return (
                      <div key={v.verse} ref={el => { verseRefs.current[v.verse] = el }} onClick={() => setSelVerse(p => p === vNum ? null : vNum)}
                        style={{ display: 'flex', gap: 13, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 2, background: isSel ? d.selBg : hlBg, boxShadow: isSel ? `inset 0 0 0 1px ${d.selRing}` : 'none', transition: 'background .12s' }}>
                        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: isSel ? d.accent : d.hint, width: 26, textAlign: 'right', paddingTop: 5, ...sf }}>{v.verse}</span>
                        <p style={{ flex: 1, margin: 0, fontSize: fontSz, lineHeight: 1.88, color: d.text }}>{v.text}</p>
                        {/* Hover/select actions */}
                        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-start', paddingTop: 3, opacity: isSel ? 1 : 0, transition: 'opacity .15s', flexShrink: 0 }}>
                          {notes[vid] && <span style={{ fontSize: 10, marginRight: 1, paddingTop: 2 }} title="Has note">📝</span>}
                          <button onClick={e => doCopy(e, v.text, v.verse)} style={{ ...iBtn(d), color: copied === vNum ? '#22c55e' : d.muted }} title="Copy verse">
                            {copied === vNum
                              ? <span style={{ fontSize: 11, ...sf }}>✓</span>
                              : <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            }
                          </button>
                          {/* Color swatches */}
                          {Object.entries(HC).map(([key, c]) => (
                            <button key={key} onClick={e => doHL(e, vid, key)} title={c.label}
                              style={{ width: 13, height: 13, borderRadius: '50%', background: c.dot, border: highlights[vid] === key ? `2px solid ${isDark ? '#dde3ed' : '#374151'}` : '2px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'transform .1s', transform: highlights[vid] === key ? 'scale(1.4)' : 'scale(1)' }} />
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Floating "Open in Study" pill */}
            {selVerse !== null && (
              <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: d.card, border: `1px solid ${d.border}`, borderRadius: 24, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: `0 4px 18px rgba(0,0,0,${isDark ? .35 : .12})`, ...sf }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: d.muted }}>{curBook} {curChapter}:{selVerse}</span>
                <button onClick={() => setMainTab('study')} style={{ padding: '5px 13px', background: d.accent, color: '#fff', border: 'none', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Open in Study →
                </button>
              </div>
            )}
          </main>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STUDY TAB
        ══════════════════════════════════════════════════════════════════ */}
        {mainTab === 'study' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {selVerse === null ? (
              /* Empty state */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <div style={{ fontSize: 40, lineHeight: 1 }}>📖</div>
                <div style={{ fontSize: 15, color: d.muted, textAlign: 'center', lineHeight: 1.7, ...sf }}>
                  No verse selected<br />
                  <span style={{ fontSize: 13 }}>Go to Read and tap a verse to study it</span>
                </div>
                <button onClick={() => setMainTab('read')} style={{ padding: '9px 22px', background: d.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', ...sf }}>
                  Go to Read →
                </button>
              </div>
            ) : (
              <>
                {/* Left column — notes & color picker */}
                <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${d.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: d.sidebar }}>
                  {/* Verse card */}
                  <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${d.border}`, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: d.hint, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 6, ...sf }}>Selected Verse</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: d.accent, marginBottom: 6, ...sf }}>{curBook} {curChapter}:{selVerse}</div>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.78, fontStyle: 'italic', color: d.muted, borderLeft: `2px solid ${d.accent}`, paddingLeft: 10 }}>"{selVerseTxt}"</p>
                    {highlights[selKey] && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: HC[highlights[selKey]].dot }} />
                        <span style={{ fontSize: 10, color: d.hint, ...sf }}>{HC[highlights[selKey]].label}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
                    {/* Color picker */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: d.hint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, ...sf }}>Highlight Color</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Object.entries(HC).map(([key, c]) => (
                          <button key={key} onClick={e => doHL(e, selKey, key)} title={c.label}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: `1px solid ${highlights[selKey] === key ? c.dot : d.border}`, background: highlights[selKey] === key ? (isDark ? HC[key].dark : HC[key].light) : 'transparent', cursor: 'pointer', transition: 'all .12s' }}>
                            <div style={{ width: 9, height: 9, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: highlights[selKey] === key ? d.text : d.muted, ...sf }}>{c.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Note editor */}
                    <div style={{ fontSize: 10, fontWeight: 700, color: d.hint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, ...sf }}>My Note</div>
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write your thoughts on this verse…"
                      style={{ width: '100%', height: 120, padding: '10px', background: d.inputBg, border: `1px solid ${d.border}`, borderRadius: 8, fontSize: 13, color: d.text, fontFamily: 'Georgia, serif', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 8, lineHeight: 1.7 }} />
                    <button onClick={saveNote} disabled={!noteText.trim()}
                      style={{ width: '100%', padding: '9px', background: d.accent, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', ...sf, opacity: noteText.trim() ? 1 : .4, transition: 'opacity .15s', marginBottom: 16 }}>
                      Save Note
                    </button>

                    {/* Quick prompts */}
                    <div style={{ fontSize: 10, fontWeight: 700, color: d.hint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, ...sf }}>Quick Prompts</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {['What does this verse mean to me personally?', 'How can I apply this today?', 'What questions does this raise for me?'].map(p => (
                        <button key={p} onClick={() => setNoteText(prev => prev ? `${prev}\n${p}` : p)}
                          style={{ textAlign: 'left', padding: '7px 10px', background: d.card, border: `1px solid ${d.border}`, borderRadius: 7, fontSize: 12, color: d.muted, cursor: 'pointer', ...sf }}>
                          + {p}
                        </button>
                      ))}
                    </div>

                    <button onClick={() => setMainTab('read')}
                      style={{ marginTop: 16, width: '100%', padding: '7px', background: 'transparent', color: d.muted, border: `1px solid ${d.border}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', ...sf }}>
                      ← Back to Read
                    </button>
                  </div>
                </div>

                {/* Right column — AI Scholar */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px 12px', borderBottom: `1px solid ${d.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <svg width="14" height="14" fill="none" stroke={d.accent} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <span style={{ fontSize: 11, fontWeight: 700, color: d.accent, letterSpacing: '0.07em', textTransform: 'uppercase', ...sf }}>AI Scholar</span>
                    </div>
                    {aiConvo.length > 0 && (
                      <button onClick={() => { setAiConvo([]); setAiInput('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: d.hint, fontSize: 11, ...sf }}>Clear</button>
                    )}
                  </div>

                  {/* Conversation thread */}
                  <div ref={convoRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                    {aiConvo.length === 0 && !aiLoading && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, paddingBottom: 40 }}>
                        <div style={{ fontSize: 11, color: d.hint, textAlign: 'center', lineHeight: 1.7, ...sf }}>
                          Ask anything about {curBook} {curChapter}:{selVerse}<br />or generate a full commentary to start
                        </div>
                        <button onClick={() => sendAi('Please give me a scholarly commentary on this verse: historical context, key word meanings, and a practical application for today.')}
                          style={{ padding: '10px 22px', background: d.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', ...sf }}>
                          Generate Commentary
                        </button>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 360 }}>
                          {['What is the historical context?', 'Original Hebrew or Greek meaning?', 'Cross references to other scriptures?', 'Practical application today?'].map(q => (
                            <button key={q} onClick={() => sendAi(q)}
                              style={{ padding: '5px 11px', background: d.card, border: `1px solid ${d.border}`, borderRadius: 14, fontSize: 11, color: d.muted, cursor: 'pointer', ...sf }}>
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiConvo.map((msg, i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: msg.role === 'user' ? d.accent : d.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4, ...sf }}>
                          {msg.role === 'user' ? 'You' : 'Scholar'}
                        </div>
                        <div style={{ padding: '10px 13px', borderRadius: 10, background: msg.role === 'user' ? d.userB : d.assistB, fontSize: 13, lineHeight: 1.78, color: d.text, ...sf, whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </div>
                      </div>
                    ))}

                    {aiLoading && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: d.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4, ...sf }}>Scholar</div>
                        <div style={{ padding: '10px 13px', borderRadius: 10, background: d.assistB, display: 'flex', gap: 5, alignItems: 'center' }}>
                          {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: d.accent, animation: 'bop 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />)}
                        </div>
                      </div>
                    )}

                    {aiConvo.length > 0 && !aiLoading && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                        {['Original Greek or Hebrew?', 'Cross references?', 'Apply this today?'].map(q => (
                          <button key={q} onClick={() => sendAi(q)}
                            style={{ padding: '4px 10px', background: d.card, border: `1px solid ${d.border}`, borderRadius: 12, fontSize: 11, color: d.muted, cursor: 'pointer', ...sf }}>
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input bar */}
                  {aiConvo.length > 0 && (
                    <div style={{ padding: '12px 16px', borderTop: `1px solid ${d.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
                      <input ref={aiInputRef} value={aiInput} onChange={e => setAiInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAi(aiInput) } }}
                        placeholder="Ask a follow-up question…" disabled={aiLoading}
                        style={{ flex: 1, padding: '9px 12px', background: d.inputBg, border: `1px solid ${d.border}`, borderRadius: 10, fontSize: 13, color: d.text, outline: 'none', ...sf, opacity: aiLoading ? .5 : 1 }} />
                      <button onClick={() => sendAi(aiInput)} disabled={!aiInput.trim() || aiLoading}
                        style={{ padding: '9px 13px', background: d.accent, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', opacity: !aiInput.trim() || aiLoading ? .4 : 1, display: 'flex', alignItems: 'center' }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            NOTES TAB
        ══════════════════════════════════════════════════════════════════ */}
        {mainTab === 'notes' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
            {totalNotes === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, paddingBottom: 60 }}>
                <div style={{ fontSize: 40, lineHeight: 1 }}>📝</div>
                <div style={{ fontSize: 15, color: d.muted, textAlign: 'center', lineHeight: 1.7, ...sf }}>
                  No notes yet<br />
                  <span style={{ fontSize: 13 }}>Select a verse in Read, then save a note in Study</span>
                </div>
                <button onClick={() => setMainTab('read')} style={{ padding: '9px 22px', background: d.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', ...sf }}>
                  Go to Read →
                </button>
              </div>
            ) : (
              <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{totalNotes} Note{totalNotes !== 1 ? 's' : ''}</h2>
                  <span style={{ fontSize: 12, color: d.hint, ...sf }}>{Object.keys(allNotesGrouped).length} book{Object.keys(allNotesGrouped).length !== 1 ? 's' : ''}</span>
                </div>
                {Object.entries(allNotesGrouped).map(([bookName, bookNotes]) => (
                  <div key={bookName} style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: d.accent, marginBottom: 12, paddingBottom: 7, borderBottom: `1px solid ${d.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...sf }}>
                      <span>{bookName}</span>
                      <span style={{ fontSize: 11, color: d.hint, fontWeight: 400 }}>{bookNotes.length} note{bookNotes.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                      {bookNotes.map(n => {
                        const hlC = highlights[n.key]
                        return (
                          <div key={n.key}
                            onClick={() => { loadChapter(bookName, n.chapter); setTimeout(() => { setSelVerse(n.verse); setMainTab('study') }, 80) }}
                            style={{ padding: '12px 14px', background: d.card, border: `1px solid ${d.border}`, borderLeft: `3px solid ${hlC ? HC[hlC].dot : d.accent}`, borderRadius: 9, cursor: 'pointer', transition: 'box-shadow .15s' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: d.accent, ...sf }}>{bookName} {n.chapter}:{n.verse}</span>
                                {hlC && <div style={{ width: 7, height: 7, borderRadius: '50%', background: HC[hlC].dot }} title={HC[hlC].label} />}
                              </div>
                              <button onClick={e => { e.stopPropagation(); delNote(n.key) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: d.hint, fontSize: 11, lineHeight: 1 }}>✕</button>
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: d.text, lineHeight: 1.65, ...sf }}>{n.text}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sidebar Book Entry ─────────────────────────────────────────────────────────
function BookEntry({ book, isExpanded, isActive, curChapter, onBookClick, onChapterClick, d }) {
  return (
    <div style={{ marginBottom: 1 }}>
      <div onClick={() => onBookClick(book.name)}
        style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, background: isActive ? d.aBook : 'transparent', color: isActive ? d.aBookT : d.text, fontWeight: isActive ? 600 : 400, margin: '0 4px', transition: 'background .12s' }}>
        <span style={{ fontSize: 8, color: d.hint, width: 9, fontFamily: 'system-ui, sans-serif' }}>{isExpanded ? '▼' : '▶'}</span>
        {book.name}
      </div>
      {isExpanded && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, padding: '4px 8px 5px 20px' }}>
          {book.chapters.map(ch => {
            const isChAct = isActive && Number(ch.chapter) === Number(curChapter)
            return (
              <div key={ch.chapter} onClick={() => onChapterClick(ch.chapter)}
                style={{ textAlign: 'center', padding: '3px 2px', borderRadius: 5, fontSize: 10, cursor: 'pointer', fontFamily: 'system-ui, sans-serif', fontWeight: isChAct ? 700 : 400, background: isChAct ? d.accent : 'transparent', color: isChAct ? '#fff' : d.muted, transition: 'background .1s' }}>
                {ch.chapter}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
