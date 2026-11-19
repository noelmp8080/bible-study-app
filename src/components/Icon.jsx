// Inline stroke icons (24×24, stroke 1.75) so nothing loads from a CDN.
// Each entry is a list of path data strings, or [tag, attrs] for other shapes.
const ICONS = {
  today: [["circle", { cx: 12, cy: 12, r: 4 }], "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"],
  read: ["M4 19.5V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0 0 4h14"],
  notes: [["rect", { x: 5, y: 3, width: 14, height: 18, rx: 1 }], "M9 8h6M9 12h6M9 16h3"],
  ask: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  search: [["circle", { cx: 11, cy: 11, r: 6 }], "M20 20l-4.5-4.5"],
  prefs: ["M4 7h10M18 7h2M4 17h2M10 17h10", ["circle", { cx: 16, cy: 7, r: 2 }], ["circle", { cx: 8, cy: 17, r: 2 }]],
  checkCircle: [["circle", { cx: 12, cy: 12, r: 9 }], "M8 12l3 3 5-6"],
  chevDown: ["M6 9l6 6 6-6"],
  chevUp: ["M6 15l6-6 6 6"],
  chevRight: ["M9 6l6 6-6 6"],
  chevLeft: ["M15 6l-6 6 6 6"],
  compare: [["rect", { x: 3, y: 4, width: 18, height: 16, rx: 1 }], "M12 4v16"],
  panel: [["rect", { x: 3, y: 4, width: 18, height: 16, rx: 1 }], "M9 4v16"],
  bookmark: ["M7 3h10v18l-5-4-5 4z"],
  check: ["M5 12l5 5 9-10"],
  close: ["M6 6l12 12M18 6L6 18"],
  copy: [["rect", { x: 9, y: 9, width: 11, height: 11, rx: 1 }], "M5 15V5a1 1 0 0 1 1-1h10"],
  share: ["M12 15V3M8 7l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"],
  memorize: ["M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5"],
  plus: ["M12 5v14M5 12h14"],
  minus: ["M5 12h14"],
  trash: ["M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"],
  mic: [["rect", { x: 9, y: 3, width: 6, height: 11, rx: 3 }], "M5 11a7 7 0 0 0 14 0M12 18v3"],
  stop: [["rect", { x: 6, y: 6, width: 12, height: 12 }]],
  play: ["M7 4l13 8-13 8z"],
  pause: ["M8 5v14M16 5v14"],
  camera: ["M4 8h3l2-3h6l2 3h3v11H4z", ["circle", { cx: 12, cy: 13, r: 3.5 }]],
  pencil: ["M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3"],
  arrowLeft: ["M19 12H5M11 6l-6 6 6 6"],
  arrowRight: ["M5 12h14M13 6l6 6-6 6"],
  arrowUp: ["M12 19V5M6 11l6-6 6 6"],
  arrowDown: ["M12 5v14M6 13l6 6 6-6"],
  grid: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
  thread: ["M6 5v14", ["circle", { cx: 6, cy: 5, r: 1.5 }], ["circle", { cx: 6, cy: 12, r: 1.5 }], ["circle", { cx: 6, cy: 19, r: 1.5 }], "M11 5h9M11 12h9M11 19h6"],
  users: [["circle", { cx: 9, cy: 8, r: 3 }], "M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6", ["circle", { cx: 17, cy: 9, r: 2.5 }], "M16.5 14.2c2.6.5 4.5 2.8 4.5 5.8"],
  speaker: ["M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"],
  cloudOff: ["M3 3l18 18M7 18a4 4 0 0 1-.7-7.9M9.5 6.6A6 6 0 0 1 18 10a4 4 0 0 1 2.6 6.6"],
  alert: ["M12 4l9 16H3zM12 10v4M12 17v.5"],
  download: ["M12 4v11M7 11l5 5 5-5M5 20h14"],
  image: [["rect", { x: 4, y: 5, width: 16, height: 14, rx: 1 }], "M4 16l4-4 4 4 3-3 5 5", ["circle", { cx: 9, cy: 9, r: 1.5 }]],
  drag: ["M9 6v.01M15 6v.01M9 12v.01M15 12v.01M9 18v.01M15 18v.01"],
  undo: ["M9 7L5 11l4 4M5 11h9a5 5 0 0 1 0 10h-2"],
  eraser: ["M5 16l9-9 5 5-7 7H8zM3 20h18"],
  highlight: ["M5 19h14M8 15l8-8 3 3-8 8H8z"],
  signout: ["M10 4H5v16h5M15 8l4 4-4 4M9 12h10"],
  clock: [["circle", { cx: 12, cy: 12, r: 9 }], "M12 7v5l3 2"],
  sync: ["M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5"],
};

export default function Icon({ name, size = 18, stroke = 1.75, ...rest }) {
  const parts = ICONS[name] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={name === "drag" ? 2.75 : stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {parts.map((p, i) => {
        if (typeof p === "string") return <path key={i} d={p} />;
        const [Tag, attrs] = p;
        return <Tag key={i} {...attrs} />;
      })}
    </svg>
  );
}
