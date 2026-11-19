import Icon from "../../components/Icon.jsx";
import Sheet from "../../components/Sheet.jsx";
import { COLORS } from "./useVerseActions.js";

const NAMES = { gold: "Gold", rose: "Rose", sage: "Sage", sky: "Sky" };
const TOO_LONG = "This passage is too long for a card. Select about 400 characters or fewer.";

function Swatches({ actions, large }) {
  return (
    <div className={large ? "swatch-row" : "swatches"} role="group" aria-label="Highlight color">
      {COLORS.map((c) => {
        const on = actions.currentColor === c;
        return (
          <button key={c} type="button" className={`swatch ${c}`} aria-pressed={on}
            aria-label={`${on ? "Remove" : "Highlight"} ${NAMES[c].toLowerCase()}${on ? " highlight" : ""}`} title={NAMES[c]}
            onClick={() => actions.setColor(c)}>
            {on && <Icon name="check" size={large ? 18 : 15} stroke={2.25} />}
          </button>
        );
      })}
      {large && (
        <button type="button" className="none" aria-pressed={actions.currentColor === null} onClick={() => actions.setColor(null)}>None</button>
      )}
    </div>
  );
}

/** Inline toolbar inside the selected verse (tablet and desktop). */
export function VerseToolbar({ actions, onThread, onStudy, onClear, showStudy }) {
  return (
    <div className="verse-toolbar" role="toolbar" aria-label={`Actions for ${actions.reference}`}>
      <Swatches actions={actions} />
      <div className="sep" aria-hidden="true" />
      <button type="button" className="btn btn-sm" onClick={actions.addNote}>Add note</button>
      <button type="button" className="btn btn-sm" onClick={actions.askAI}>Ask AI</button>
      <button type="button" className="btn btn-sm" onClick={actions.copy}>Copy</button>
      <button type="button" className="btn btn-sm" onClick={actions.shareImage} disabled={actions.cardTooLong}
        title={actions.cardTooLong ? TOO_LONG : undefined}>Share as image</button>
      <button type="button" className="btn btn-sm" onClick={actions.memorize}>Memorize</button>
      <button type="button" className="btn btn-sm" onClick={actions.toggleBookmark} aria-pressed={actions.allBookmarked}>
        {actions.allBookmarked ? "Remove bookmark" : "Bookmark"}
      </button>
      <button type="button" className="btn btn-sm" onClick={onThread}>Add to thread</button>
      {showStudy && <button type="button" className="btn btn-sm btn-outline" onClick={onStudy}>Study</button>}
      <button type="button" className="btn btn-sm btn-quiet" onClick={onClear} aria-label="Clear selection">Done</button>
      {actions.cardTooLong && <span className="muted" style={{ fontSize: 11, flexBasis: "100%" }}>{TOO_LONG}</span>}
    </div>
  );
}

/** Bottom sheet with the same actions (phone, spec A2). */
export function VerseSheet({ actions, onThread, onStudy, onClose, onScrim, studyHint }) {
  const many = actions.picked.length > 1;
  return (
    <Sheet title={`Actions for ${actions.reference}`} onClose={onClose} onScrim={onScrim} clear head={(
      <div className="sheet-head" style={{ marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 28 }}>{actions.reference}</h2>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, marginTop: 3 }}>
            {many ? `${actions.picked.length} verses · tap a verse to add or remove it` : "Tap more verses to select a passage"}
          </div>
        </div>
        <button type="button" className="icon-btn bare" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
      </div>
    )}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="stack-sm">
          <div className="label">Highlight</div>
          <Swatches actions={actions} large />
        </div>
        <div className="action-grid">
          <button type="button" onClick={actions.addNote}><Icon name="notes" size={19} />Add note</button>
          <button type="button" onClick={actions.askAI}><Icon name="ask" size={19} />Ask AI</button>
          <button type="button" onClick={actions.copy}><Icon name="copy" size={19} />Copy</button>
          <button type="button" onClick={actions.shareImage} disabled={actions.cardTooLong}><Icon name="share" size={19} />Share as image</button>
          <button type="button" onClick={actions.toggleBookmark} aria-pressed={actions.allBookmarked}>
            <Icon name="bookmark" size={19} />{actions.allBookmarked ? "Remove bookmark" : "Bookmark"}
          </button>
          <button type="button" onClick={actions.memorize}><Icon name="memorize" size={19} />Memorize</button>
        </div>
        {actions.cardTooLong && <p className="muted" style={{ fontSize: 12 }}>{TOO_LONG}</p>}
        <div>
          <button type="button" className="list-link" onClick={onThread}>
            <span><strong>Add to a thread</strong><small>Trace one idea through Scripture</small></span>
            <Icon name="chevRight" size={16} stroke={2} />
          </button>
          <button type="button" className="list-link" onClick={onStudy}>
            <span><strong>Cross-references and word study</strong><small>{studyHint}</small></span>
            <Icon name="chevRight" size={16} stroke={2} />
          </button>
        </div>
      </div>
    </Sheet>
  );
}
