// PROTOTYPE: static mock scenes for phase 14. No state, no persistence, no tests.
import { ICONS } from '../../src/ui/icons/icons.js';

const params = new URLSearchParams(location.search);
const variant = params.get('variant') ?? 'A';
const scene = params.get('scene') ?? 'settings';
const theme = params.get('theme') ?? 'neon';
const shot = params.has('shot');
// Dock: position bottom|left|right (existing setting) × style float|rail (planned, from variant C).
const dockPos = params.get('dock') ?? 'bottom';
const dockStyle = params.get('dockstyle') ?? (variant === 'D' && dockPos !== 'bottom' ? 'rail' : 'float');
document.documentElement.dataset.dock = dockPos;

document.documentElement.dataset.theme = theme;
document.documentElement.dataset.variant = variant;

const ic = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ICONS.info}</svg>`;
const tile = (icon, cat = 'system', size = '') => `<span class="tile ${size} t-${cat}">${ic(icon)}</span>`;

// ───────────── Shared chrome ─────────────
function topbar(app, { menu = variant === 'D' } = {}) {
  return `<header class="topbar">
    <span style="color:var(--accent);display:flex">${ic('nexus-mark')}</span>
    <span class="app">${app}</span>
    ${menu ? `<nav class="menu"><span>File</span><span>Edit</span><span>View</span><span>Window</span><span>Help</span></nav>` : ''}
    <span class="ws"><i class="on"></i><i></i><i></i></span>
    <span class="tray">${ic('online')}${ic('volume')}${ic('bell')}<span class="clock num">Sun 15 Nov&nbsp;&nbsp;09:41</span></span>
  </header>`;
}

const DOCK = [
  ['folder', 'system', 'Files'],
  ['terminal', 'dev', 'Terminal'],
  ['note', 'productivity', 'Notes', 'run'],
  ['calendar', 'productivity', 'Calendar'],
  ['cards', 'study', 'Flashcards'],
  ['code', 'dev', 'Code'],
  ['palette', 'creative', 'Paint'],
  ['gamepad', 'games', 'Arcade'],
  ['settings', 'system', 'Settings'],
];
function dock(focusName) {
  const slots = DOCK.map(([icon, cat, name, run]) => {
    const cls = name === focusName ? 'run focus' : run ? 'run' : '';
    return `<span class="slot ${cls}">${tile(icon, cat)}</span>`;
  }).join('');
  return `<nav class="dock" data-position="${dockPos}" data-style="${dockStyle}">${slots}<span class="sep"></span><span class="slot">${tile('apps')}</span></nav>`;
}

function win({ x, y, w, h, icon, cat, title, doc = '', focused = false, body }) {
  return `<section class="win ${focused ? 'focused' : ''}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">
    <div class="titlebar">${tile(icon, cat, 'xs')}<span>${title}</span>${doc ? `<span class="doc">${doc}</span>` : ''}
      <span class="ctl"><span>${ic('minimize')}</span><span>${ic('maximize')}</span><span>${ic('close')}</span></span></div>
    ${body}
  </section>`;
}

// ───────────── Notes (background window) ─────────────
function notesBody() {
  const notes = [
    ['Algorithms: week 5', 'Dijkstra with a binary heap…', true],
    ['Shopping', 'Oat milk, coffee, batteries'],
    ['Thesis ideas', 'Drone inventory scanning…'],
    ['Reading list', 'Refactoring UI, Laws of UX'],
  ];
  return `<div class="frame" style="--side:200px">
    <aside class="side">${notes
      .map(
        ([t, s, on]) => `<div class="nav ${on ? 'on' : ''}" style="height:auto;padding:8px 10px;display:block">
        <div style="font-weight:550">${t}</div><div style="font-size:12px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s}</div></div>`,
      )
      .join('')}</aside>
    <div class="main"><div class="content"><h1 class="page" style="font-size:19px">Algorithms: week 5</h1>
      <p class="sub" style="max-width:52ch">Dijkstra with a binary heap runs in O((V + E) log V). Relax each edge once; the heap always yields the closest unvisited node.</p></div></div>
  </div>`;
}

// ───────────── Settings (variant A) ─────────────
const THEMES = [
  ...(variant === 'D' ? [['Nexus HUD', '#07090d', '#1a1b20', '#ffb040']] : []),
  ['Neon Night', '#060811', '#121729', '#3ef0ff'],
  ['Synthwave', '#1a0b2e', '#2b1450', '#ff4fd8'],
  ['Matrix', '#020a04', '#0b1d10', '#3dff7a'],
  ['Blade', '#120806', '#24110c', '#ff9a3c'],
  ['Deep Ocean', '#03121c', '#0a2333', '#2fd3c4'],
  ['Arctic Light', '#e9eef6', '#ffffff', '#0a64eb'],
  ['Paper', '#f5f1e8', '#fffdf8', '#3a3a3a'],
  ['High Contrast', '#000', '#000', '#ffff00'],
];
const themeCards = (selected) =>
  THEMES.map(
    ([name, bg, s, a]) => `<div class="tcard ${name === selected ? 'on' : ''}">
    <div class="pv" style="background:${bg}"><i style="background:${s};outline:1px solid ${a}55"></i><b style="background:${a}"></b></div>${name}</div>`,
  ).join('');

const SETTINGS_NAV = [
  ['palette', 'Personalization', true],
  ['dock', 'Desktop and dock'],
  ['window', 'Windows'],
  ['bell', 'Notifications'],
  ['keyboard', 'Shortcuts'],
  ['-', 'System'],
  ['language', 'Language and region'],
  ['lock', 'Profiles and lock'],
  ['hard-drive', 'Storage'],
  ['apps', 'Apps'],
  ['shield', 'Privacy'],
  ['eye', 'Accessibility'],
  ['archive', 'Backup'],
  ['info', 'About Nexus'],
];

function settingsBody(selectedTheme) {
  const nav = SETTINGS_NAV.map(([icon, label, on]) =>
    icon === '-' ? `<div class="label">${label}</div>` : `<div class="nav ${on ? 'on' : ''}">${ic(icon)}${label}</div>`,
  ).join('');
  const accents = ['var(--accent)', '#6aa8ff', '#b36bff', '#ff5cc8', '#ff6b5c', '#ffb340', '#3ddc97'];
  return `<div class="frame">
    <aside class="side">
      <div class="field" style="margin-bottom:8px">${ic('search')}<span style="flex:1">Search settings</span><span class="kbd">/</span></div>
      ${nav}
    </aside>
    <div class="main"><div class="content">
      <h1 class="page">Personalization</h1>
      <p class="sub">Theme, accent color, motion and wallpaper.</p>
      <h2 class="sec">Theme</h2>
      <div class="themes">${themeCards(selectedTheme)}</div>
      <div class="group" style="margin-top:14px">
        <div class="row"><div class="txt"><b>Accent color</b><small>Used for buttons, selection and focus.</small></div>
          <div style="display:flex;gap:10px;align-items:center">${accents.map((c, i) => `<span class="swatch ${i === 0 ? 'on' : ''}" style="background:${c}"></span>`).join('')}</div></div>
        <div class="row"><div class="txt"><b>Switch between light and dark</b><small>Arctic Light from 07:00, Neon Night from 19:00.</small></div><span class="toggle on"></span></div>
      </div>
      <h2 class="sec">Motion and effects</h2>
      <div class="group">
        <div class="row"><div class="txt"><b>Animations</b></div><div class="seg"><span class="on">System</span><span>Full</span><span>Reduced</span><span>Off</span></div></div>
        <div class="row"><div class="txt"><b>Transparency</b><small>Glass behind the dock, top bar and menus.</small></div>
          <div class="slider"><div class="track"><div class="fill" style="width:80%"></div><div class="knob" style="left:80%"></div></div><span class="v">80%</span></div></div>
        <div class="row"><div class="txt"><b>Battery saver</b><small>Turns off particles, blur and animated wallpapers.</small></div><span class="toggle"></span></div>
      </div>
    </div></div>
  </div>`;
}

function sceneSettings() {
  const sel =
    theme === 'arctic'
      ? 'Arctic Light'
      : theme === 'hc'
        ? 'High Contrast'
        : variant === 'D'
          ? 'Nexus HUD'
          : 'Neon Night';
  return `<div class="desk">
    ${topbar('Settings')}
    ${win({ x: 90, y: 92, w: 560, h: 470, icon: 'note', cat: 'productivity', title: 'Algorithms: week 5', doc: '— Notes', body: notesBody() })}
    ${win({ x: 330, y: 70, w: 1000, h: 724, icon: 'settings', cat: 'system', title: 'Settings', focused: true, body: variant === 'D' ? bentoSettingsBody(sel) : settingsBody(sel) })}
    ${dock('Settings')}
  </div>`;
}

// ───────────── Arcade ─────────────
function cover(kind, hue) {
  const bg = `<defs><linearGradient id="g${kind}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="color-mix(in oklab, ${hue} 55%, #0a0a1a)"/><stop offset="1" stop-color="color-mix(in oklab, ${hue} 18%, #05050d)"/></linearGradient></defs><rect width="320" height="180" fill="url(#g${kind})"/>`;
  const L = `color-mix(in oklab, ${hue} 60%, white)`;
  const art = {
    snake: `<path d="M40 130 C 80 130 80 70 120 70 S 160 120 200 120 S 250 60 270 60" fill="none" stroke="${L}" stroke-width="14" stroke-linecap="round"/><circle cx="270" cy="60" r="11" fill="#fff"/><circle cx="90" cy="45" r="6" fill="#ffd166"/>`,
    breakout:
      [...Array(18)]
        .map(
          (_, i) =>
            `<rect x="${34 + (i % 6) * 43}" y="${30 + Math.floor(i / 6) * 18}" width="38" height="13" rx="3" fill="${L}" opacity="${1 - Math.floor(i / 6) * 0.25}"/>`,
        )
        .join('') +
      `<rect x="130" y="150" width="64" height="8" rx="4" fill="#fff"/><circle cx="175" cy="118" r="6" fill="#fff"/>`,
    blocks: [
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
      [5, 4],
      [6, 4],
      [0, 3],
      [1, 3],
      [5, 3],
      [6, 3],
      [6, 2],
      [3, 1],
      [3, 0],
      [4, 0],
      [4, 1],
    ]
      .map(
        ([cx, cy]) =>
          `<rect x="${96 + cx * 19}" y="${62 + cy * 19}" width="17" height="17" rx="3" fill="${cy < 2 ? '#fff' : L}" opacity="${cy < 2 ? 1 : 0.85}"/>`,
      )
      .join(''),
    mahjong: [0, 1, 2]
      .map((r) =>
        [0, 1, 2, 3]
          .map(
            (c) =>
              `<g transform="translate(${88 + c * 36 + r * 6} ${36 + r * 34 - r * 4})"><rect width="32" height="42" rx="5" fill="color-mix(in oklab, ${hue} 30%, #000)"/><rect y="-4" width="32" height="42" rx="5" fill="#f4f1ea"/><circle cx="16" cy="17" r="7" fill="none" stroke="${hue}" stroke-width="3"/></g>`,
          )
          .join(''),
      )
      .join(''),
    merge: [...Array(16)]
      .map((_, i) => {
        const v = [2, 4, 0, 8, 0, 16, 2, 0, 32, 0, 4, 64, 0, 2, 128, 4][i];
        return `<g transform="translate(${104 + (i % 4) * 29} ${32 + Math.floor(i / 4) * 29})"><rect width="26" height="26" rx="4" fill="${v ? L : '#ffffff'}" opacity="${v ? Math.min(1, 0.35 + Math.log2(v) / 8) : 0.08}"/>${v ? `<text x="13" y="17" font-size="${v > 64 ? 9 : 11}" font-weight="700" text-anchor="middle" fill="#111" font-family="Inter Variable">${v}</text>` : ''}</g>`;
      })
      .join(''),
    mines:
      [...Array(40)]
        .map((_, i) => {
          const x = 70 + (i % 10) * 18,
            y = 45 + Math.floor(i / 10) * 18;
          const open = [11, 12, 13, 21, 22, 23, 24, 31, 32, 33].includes(i);
          const n = { 12: 1, 22: 2, 23: 1, 32: 3 }[i];
          return `<rect x="${x}" y="${y}" width="16" height="16" rx="2" fill="${open ? '#ffffff' : L}" opacity="${open ? 0.12 : 0.8}"/>${n ? `<text x="${x + 8}" y="${y + 12}" font-size="10" font-weight="700" text-anchor="middle" fill="${['', '#7dd3fc', '#86efac', '#fca5a5'][n]}" font-family="Inter Variable">${n}</text>` : ''}`;
        })
        .join('') + `<path d="M236 64v14M236 64l8 4-8 4" stroke="#fff" stroke-width="2" fill="#ff5c7a"/>`,
    pong: `<path d="M160 20v140" stroke="#fff" stroke-opacity=".3" stroke-width="3" stroke-dasharray="8 8"/><rect x="40" y="58" width="9" height="46" rx="4" fill="${L}"/><rect x="272" y="84" width="9" height="46" rx="4" fill="#fff"/><circle cx="200" cy="74" r="7" fill="#fff"/>`,
    chess:
      [...Array(25)]
        .map(
          (_, i) =>
            `<rect x="${110 + (i % 5) * 20}" y="${40 + Math.floor(i / 5) * 20}" width="20" height="20" fill="${((i % 5) + Math.floor(i / 5)) % 2 ? L : '#ffffff'}" opacity="${((i % 5) + Math.floor(i / 5)) % 2 ? 0.7 : 0.14}"/>`,
        )
        .join('') + `<circle cx="160" cy="90" r="8" fill="#fff"/><path d="M152 102h16l-2-8h-12z" fill="#fff"/>`,
  }[kind];
  return `<svg class="cover" viewBox="0 0 320 180" aria-hidden="true">${bg}${art}</svg>`;
}

const GAMES = [
  ['Snake Evolution', 'snake', 'Eat, grow, and don’t bite your tail.', 'Action', '1,240', 12, '#22c55e'],
  ['Breakout Nexus', 'breakout', 'Break every brick with one ball.', 'Arcade', '8,900', 7, '#f97316'],
  ['Blockfall', 'blocks', 'Stack falling blocks and clear lines.', 'Puzzle', '23,450', 31, '#06b6d4'],
  ['2048 Cyber', 'merge', 'Slide tiles and merge them to 2048.', 'Puzzle', '4,096', 18, '#eab308'],
  ['Minesweeper', 'mines', 'Clear the field without hitting a mine.', 'Puzzle', '1:52', 9, '#3b82f6'],
  ['Neon Pong', 'pong', 'Classic paddles, against a friend or the computer.', 'Arcade', '11 – 7', 4, '#ec4899'],
  ['Nexus Chess', 'chess', 'Play chess against a friend or the computer.', 'Board', '3 wins', 6, '#a855f7'],
  ['Mahjong Solitaire', 'mahjong', 'Match free tile pairs until the board is clear.', 'Cards', '4:12', 22, '#ef4444'],
];

function arcadeBody() {
  const cats = [
    ['gamepad', 'All games', 30, true],
    ['star', 'Favorites', 3],
    ['clock', 'Recently played', 5],
  ];
  const groups = [
    ['zap', 'Action', 6],
    ['rocket', 'Arcade', 7],
    ['target', 'Puzzle', 8],
    ['cards', 'Cards', 3],
    ['table', 'Board', 6],
  ];
  const row = ([icon, label, n, on]) =>
    `<div class="nav ${on ? 'on' : ''}">${ic(icon)}${label}<span class="count num">${n}</span></div>`;
  const cards = GAMES.slice(0, 8)
    .map(
      ([name, kind, desc, , best, plays, hue]) => `<article class="gcard">${cover(kind, hue)}<div class="body">
      <div class="name">${name}</div><div class="desc">${desc}</div>
      <div class="meta"><span>Best <b class="num">${best}</b></span><span class="num">${plays} plays</span></div></div></article>`,
    )
    .join('');
  const [fName, fKind, , , , , fHue] = GAMES[7];
  return `<div class="frame" style="--side:220px">
    <aside class="side">
      <div class="label" style="padding-top:2px">Library</div>${cats.map(row).join('')}
      <div class="label">Categories</div>${groups.map(row).join('')}
      <div style="margin-top:auto;padding:12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;font-size:13px"><b>Level 4</b><span class="num" style="color:var(--text-3)">320 / 500 XP</span></div>
        <div style="height:6px;border-radius:9px;background:var(--surface-3);margin-top:8px"><div style="width:64%;height:100%;border-radius:9px;background:var(--accent)"></div></div>
      </div>
    </aside>
    <div class="main">
      <div class="toolbar">
        <div class="field" style="width:280px">${ic('search')}<span>Search games…</span></div>
        <div class="seg" style="margin-left:6px"><span class="on">${ic('apps')}</span><span>${ic('view-list')}</span></div>
        <span style="flex:1"></span>
        <button class="btn">${ic('sparkles')}Surprise me</button>
        <button class="btn">${ic('users')}Two players</button>
      </div>
      <div class="content" style="padding-top:20px">
        <div style="display:flex;gap:18px;align-items:center;padding:14px;border-radius:14px;background:var(--surface-2);border:1px solid var(--border)">
          <div style="width:220px;border-radius:10px;overflow:hidden;flex:none">${cover(fKind, fHue)}</div>
          <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--text-3)">Continue playing</div>
            <div style="font-size:20px;font-weight:650;letter-spacing:-0.01em;margin-top:2px">${fName}</div>
            <div class="sub" style="margin-top:2px">Last played yesterday. Your best time is <span class="num">4:12</span>.</div></div>
          <button class="btn primary lg">${ic('play')}Resume</button>
        </div>
        <h2 class="sec" style="display:flex;justify-content:space-between">All games<span style="font-weight:500;color:var(--text-3)">Sort: Recently played</span></h2>
        <div class="grid4">${cards}</div>
      </div>
    </div>
  </div>`;
}

function sceneArcade() {
  return `<div class="desk">
    ${topbar('Arcade Hub')}
    ${win({ x: 110, y: 58, w: 1220, h: 760, icon: 'gamepad', cat: 'games', title: 'Arcade Hub', focused: true, body: arcadeBody() })}
    ${dock('Arcade')}
  </div>`;
}

// ───────────── First-boot setup ─────────────
function sceneSetup() {
  const steps = [
    ['You', 'done'],
    ['Language', 'done'],
    ['Look', 'on'],
    ['Ready', ''],
  ];
  return `<div class="desk" style="display:grid;place-items:center">
    <div style="position:absolute;top:36px;left:50%;translate:-50%;display:flex;align-items:center;gap:10px;color:var(--text-2);font-weight:600">
      <span style="color:var(--accent);display:flex">${ic('nexus-mark')}</span>Set up Nexus</div>
    <section class="win focused" style="position:relative;width:860px;height:600px">
      <div class="frame" style="--side:220px">
        <aside class="side" style="padding:28px 14px">
          ${steps
            .map(
              ([s, st], i) => `<div class="nav ${st === 'on' ? 'on' : ''}" style="height:40px">
              <span style="width:22px;height:22px;border-radius:99px;display:grid;place-items:center;font-size:12px;font-weight:700;${
                st === 'done'
                  ? 'background:var(--accent-soft);color:var(--accent)'
                  : st === 'on'
                    ? 'background:var(--accent);color:var(--accent-contrast)'
                    : 'border:1.5px solid var(--border-strong);color:var(--text-3)'
              }">${st === 'done' ? `<svg class="i" viewBox="0 0 24 24" style="width:13px;height:13px;stroke-width:3">${ICONS.check}</svg>` : i + 1}</span>${s}</div>`,
            )
            .join('')}
          <div style="margin-top:auto;font-size:12.5px;color:var(--text-3);padding:0 10px">Everything stays on this device.</div>
        </aside>
        <div class="main"><div class="content" style="padding:36px 40px;display:flex;flex-direction:column;height:100%">
          <div style="font-size:13px;color:var(--text-3);font-weight:550" class="num">Step 3 of 4</div>
          <h1 class="page" style="font-size:26px;margin-top:4px">Choose a look</h1>
          <p class="sub">You can change this anytime in Settings.</p>
          <div class="themes" style="grid-template-columns:repeat(3,1fr);margin-top:24px">
            ${THEMES.filter(([n]) =>
              [
                variant === 'D' ? 'Nexus HUD' : 'Neon Night',
                'Arctic Light',
                'Synthwave',
                'Paper',
                variant === 'D' ? 'Neon Night' : 'Deep Ocean',
                'High Contrast',
              ].includes(n),
            )
              .map(
                ([name, bg, s, a]) =>
                  `<div class="tcard ${name === (variant === 'D' ? 'Nexus HUD' : 'Neon Night') ? 'on' : ''}"><div class="pv" style="height:84px;background:${bg}"><i style="background:${s};outline:1px solid ${a}55"></i><b style="background:${a}"></b></div>${name}</div>`,
              )
              .join('')}
          </div>
          <div class="row" style="padding:18px 0 0;min-height:0"><div class="txt"><b>Accent color</b></div>
            <div style="display:flex;gap:10px">${['var(--accent)', '#6aa8ff', '#b36bff', '#ff5cc8', '#ff6b5c', '#ffb340', '#3ddc97'].map((c, i) => `<span class="swatch ${i ? '' : 'on'}" style="background:${c}"></span>`).join('')}</div></div>
          <div style="margin-top:auto;display:flex;gap:8px;align-items:center">
            <button class="btn ghost">Back</button><span style="flex:1"></span>
            <button class="btn ghost">Skip setup</button><button class="btn primary lg">Continue</button>
          </div>
        </div></div>
      </div>
    </section>
  </div>`;
}

// ───────────── Command palette ─────────────
function scenePalette() {
  const opt = (icon, name, kind, { on, desc, tileCat, hint } = {}) => `<div class="opt ${on ? 'on' : ''}">
    ${tileCat ? tile(icon, tileCat, 'sm') : `<span class="ic">${ic(icon)}</span>`}
    <div class="nm">${name}${on && desc ? `<small>${desc}</small>` : ''}</div>
    ${on ? `<span class="kbd">↵</span>` : hint ? `<span style="color:var(--text-3);font-size:12px">${hint}</span>` : `<span class="badge">${kind}</span>`}</div>`;
  return `<div class="desk">
    ${topbar('Notes')}
    ${win({ x: 160, y: 80, w: 1120, h: 700, icon: 'note', cat: 'productivity', title: 'Algorithms: week 5', doc: '— Notes', focused: true, body: notesBody() })}
    ${dock('Notes')}
    <div class="scrim"></div>
    <div class="palette">
      <div class="q">${ic('search')}<span>notes</span><span class="caret"></span><span style="flex:1"></span><span class="kbd">esc</span></div>
      <div class="list">
        <div class="gl">Apps</div>
        ${opt('note', '<mark>Notes</mark>', 'App', { on: true, desc: 'Write and link notes in Markdown.', tileCat: 'productivity' })}
        ${opt('sticky-note', 'Sticky <mark>Notes</mark>', 'App', { tileCat: 'productivity' })}
        ${opt('book', 'Journal', 'App', { tileCat: 'productivity', hint: 'matches “daily notes”' })}
        <div class="gl">Commands</div>
        ${opt('plus', 'New note', 'Command', { hint: '<span class="kbd">⌘</span> <span class="kbd">N</span>' })}
        ${opt('search', 'Search in all notes…', 'Command')}
        <div class="gl">Files</div>
        ${opt('file-text', 'lecture-<mark>notes</mark>.md <span style="color:var(--text-3)">in Documents/Uni</span>', 'File')}
        <div class="gl">Settings</div>
        ${opt('sliders', '<mark>Notes</mark>: default folder', 'Setting')}
      </div>
      <div class="foot"><span><span class="kbd">↑</span><span class="kbd">↓</span> move</span><span><span class="kbd">↵</span> open</span><span><span class="kbd">tab</span> more actions</span><span style="margin-left:auto">Prefix <span class="kbd">&gt;</span> for commands</span></div>
    </div>
  </div>`;
}

// ───────────── Mobile ─────────────
function sceneMobile() {
  const files = [
    ['folder', 'Documents', '12 items', true],
    ['folder', 'Pictures', '48 items', true],
    ['folder', 'Uni', '7 items', true],
    ['file-text', 'lecture-notes.md', '4 KB · Today'],
    ['file-image', 'whiteboard.png', '1.2 MB · Yesterday'],
    ['file-code', 'dijkstra.js', '2 KB · Mon'],
    ['file-zip', 'nexus-backup.zip', '8.4 MB · 2 Nov'],
  ];
  return `<div class="desk" style="background:var(--bg);display:flex;flex-direction:column">
    <div style="height:44px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 22px;font-weight:600;font-size:14px" class="num"><span>9:41</span><span style="display:flex;gap:6px;color:var(--text-2)">${ic('online')}${ic('battery')}</span></div>
    <div style="padding:6px 16px 0;display:flex;align-items:center;gap:8px">
      <button class="btn ghost icon" style="width:44px;height:44px;margin-left:-10px">${ic('chevron-left')}</button>
      <span style="flex:1"></span><button class="btn ghost icon" style="width:44px;height:44px">${ic('plus')}</button><button class="btn ghost icon" style="width:44px;height:44px;margin-right:-10px">${ic('more-horizontal')}</button>
    </div>
    <h1 class="page" style="font-size:30px;padding:2px 20px 12px">Files</h1>
    <div style="padding:0 16px 12px"><div class="field" style="height:44px;font-size:16px">${ic('search')}<span>Search files</span></div></div>
    <div style="padding:0 16px 12px;display:flex;gap:8px">
      <span class="badge" style="height:32px;padding:0 14px;font-size:13px;background:var(--accent-soft);color:var(--accent)">Recent</span>
      <span class="badge" style="height:32px;padding:0 14px;font-size:13px">Starred</span>
      <span class="badge" style="height:32px;padding:0 14px;font-size:13px">Trash</span></div>
    <div style="margin:0 16px;flex:1;overflow:hidden" class="group">
      ${files
        .map(
          ([icon, name, meta, dir]) => `<div class="row" style="min-height:60px;padding:8px 14px">
        <span class="ic" style="width:36px;height:36px;border-radius:9px;display:grid;place-items:center;background:${dir ? 'var(--accent-soft)' : 'var(--surface-3)'};color:${dir ? 'var(--accent)' : 'var(--text-2)'}">${ic(icon)}</span>
        <div class="txt"><b>${name}</b><small>${meta}</small></div><span style="color:var(--text-3)">${ic('chevron-right')}</span></div>`,
        )
        .join('')}
    </div>
    <div class="toast" style="left:16px;right:16px;bottom:96px;padding:12px 8px 12px 14px">
      <span style="color:var(--success);display:flex">${ic('success')}</span><span style="flex:1">Nexus now works offline.</span><button class="btn ghost sm" style="height:36px">Dismiss</button></div>
    <nav style="height:84px;flex:none;margin-top:12px;display:grid;grid-template-columns:repeat(4,1fr);padding:8px 8px 26px;border-top:1px solid var(--border);background:var(--glass);backdrop-filter:blur(16px)">
      ${[
        ['home', 'Home'],
        ['apps', 'Apps', true],
        ['layers', 'Switcher'],
        ['search', 'Search'],
      ]
        .map(
          ([icon, label, on]) =>
            `<span style="display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:550;color:${on ? 'var(--accent)' : 'var(--text-3)'}">${ic(icon)}${label}</span>`,
        )
        .join('')}
    </nav>
  </div>`;
}

// ───────────── Component gallery (3 themes side by side) ─────────────
function componentColumn(t, label) {
  return `<section data-theme="${t}" style="background:var(--surface-1);color:var(--text-1);border-radius:16px;border:1px solid var(--border);padding:22px;display:flex;flex-direction:column;gap:18px;box-shadow:var(--shadow-2)">
    <div style="display:flex;align-items:center;justify-content:space-between"><b style="font-size:16px">${label}</b><span class="badge">tokens v2</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary">${ic('plus')}New note</button><button class="btn">Export…</button><button class="btn ghost">Cancel</button><button class="btn danger">${ic('trash')}Delete</button></div>
    <div style="display:flex;gap:8px;align-items:center"><button class="btn icon">${ic('edit')}</button><button class="btn icon focusring">${ic('share')}</button><span style="font-size:12px;color:var(--text-3)">focus ring</span><span style="flex:1"></span><div class="seg"><span class="on">Day</span><span>Week</span><span>Month</span></div></div>
    <div class="field">${ic('search')}<span>Search notes…</span><span style="flex:1"></span><span class="kbd">⌘</span><span class="kbd">K</span></div>
    <div style="display:flex;align-items:center;gap:14px"><span class="toggle on"></span><span class="toggle"></span><span class="check on">${ic('check')}</span><span class="check"></span><div class="slider" style="width:auto;flex:1"><div class="track"><div class="fill" style="width:60%"></div><div class="knob" style="left:60%"></div></div><span class="v">60%</span></div></div>
    <div class="tabs"><span class="on">General</span><span>Sharing</span><span>History</span></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="badge">Draft</span><span class="badge info">Synced</span><span class="badge success">Saved</span><span class="badge warning">Offline</span><span class="badge danger">Conflict</span></div>
    <div class="group">
      <div class="row" style="min-height:48px">${tile('note', 'productivity', 'sm')}<div class="txt"><b>Algorithms: week 5</b><small>Edited 2 min ago</small></div><span class="badge success">Saved</span></div>
      <div class="row" style="min-height:48px">${tile('calendar', 'productivity', 'sm')}<div class="txt"><b>Exam: Theoretical CS</b><small>Thu 26 Nov, 10:00</small></div><span class="badge warning">In 11 days</span></div>
    </div>
    <div style="text-align:center;padding:18px;border:1.5px dashed var(--border-strong);border-radius:12px">
      <div style="color:var(--text-3);display:flex;justify-content:center">${ic('checklist')}</div>
      <b style="display:block;margin-top:6px">No tasks yet</b><div style="color:var(--text-3);font-size:13px;margin:2px 0 12px">Add a task, or import from a file.</div>
      <button class="btn primary sm">${ic('plus')}Add a task</button></div>
  </section>`;
}
function sceneComponents() {
  document.body.style.background = theme === 'arctic' ? '#dfe5ee' : '#03040a';
  return `<div class="desk" style="padding:28px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px;align-content:start">
    ${componentColumn('neon', 'Neon Night')}${componentColumn('arctic', 'Arctic Light')}${componentColumn('hc', 'High Contrast')}
  </div>`;
}

// ───────────── Variant B: calm pro, taskbar + bento settings ─────────────
function bentoSettingsBody(selected) {
  const card = (
    title,
    body,
    span = 1,
  ) => `<div style="grid-column:span ${span};background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:16px 18px">
    <div style="font-weight:600;margin-bottom:12px">${title}</div>${body}</div>`;
  const body = `<div class="frame" style="--side:210px">
    <aside class="side" style="background:var(--surface-1)">
      ${SETTINGS_NAV.filter(([i]) => i !== '-')
        .slice(0, 11)
        .map(([icon, label, on]) => `<div class="nav ${on ? 'on' : ''}" style="height:32px">${ic(icon)}${label}</div>`)
        .join('')}
    </aside>
    <div class="main" style="background:var(--surface-1)">
      <div class="toolbar" style="border:0;height:60px"><h1 class="page" style="font-size:20px">Personalization</h1><span style="flex:1"></span><div class="field" style="width:240px">${ic('search')}<span>Search settings</span></div></div>
      <div class="content" style="padding-top:4px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-content:start">
        ${card('Theme', `<div class="themes" style="grid-template-columns:repeat(${THEMES.length > 8 ? 5 : 4},1fr)">${themeCards(selected)}</div>`, 3)}
        ${card('Accent', `<div style="display:flex;gap:10px">${['var(--accent)', '#6aa8ff', '#3ef0ff', '#ff5cc8', '#8b93ff', '#3ddc97'].map((c, i) => `<span class="swatch ${i ? '' : 'on'}" style="background:${c}"></span>`).join('')}</div>`)}
        ${card('Animations', `<div class="seg"><span class="on">System</span><span>Full</span><span>Off</span></div>`)}
        ${card('Transparency', `<div class="slider" style="width:auto"><div class="track"><div class="fill" style="width:30%"></div><div class="knob" style="left:30%"></div></div><span class="v">30%</span></div>`)}
        ${card('Wallpaper', `<div style="display:flex;gap:10px">${['linear-gradient(160deg,#2a2d36,#111)', 'linear-gradient(160deg,#20304a,#0b1020)', 'linear-gradient(160deg,#3a2a40,#120c16)'].map((g, i) => `<span style="width:96px;height:56px;border-radius:8px;background:${g};${i ? '' : 'outline:2px solid var(--accent);outline-offset:2px'}"></span>`).join('')}</div>`, 2)}
        ${card('Light and dark', `<div style="display:flex;justify-content:space-between;align-items:center;color:var(--text-2)">Follow the time of day<span class="toggle on"></span></div>`)}
      </div>
    </div></div>`;
  return body;
}

function variantB() {
  const body = bentoSettingsBody('Neon Night');
  const task = [
    ['folder', 'system', 'Files'],
    ['note', 'productivity', 'Notes'],
    ['settings', 'system', 'Settings', true],
  ];
  return `<div class="desk">
    ${win({ x: 200, y: 56, w: 1040, h: 720, icon: 'settings', cat: 'system', title: 'Settings', focused: true, body })}
    <nav style="position:absolute;inset:auto 0 0;height:52px;display:flex;align-items:center;gap:8px;padding:0 10px;background:rgb(20 21 25 / .92);backdrop-filter:blur(18px);border-top:1px solid var(--border)">
      <span class="btn" style="background:var(--accent);color:var(--accent-contrast);border:0">${ic('nexus-mark')}Start</span>
      <div class="field" style="width:300px;background:var(--surface-2)">${ic('search')}<span>Search apps, files and settings</span></div>
      ${task.map(([icon, cat, name, on]) => `<span class="btn ${on ? '' : 'ghost'}" style="${on ? 'background:var(--surface-active);border-color:transparent' : ''}">${tile(icon, cat, 'xs')}${name}</span>`).join('')}
      <span style="margin-left:auto;display:flex;gap:14px;align-items:center;color:var(--text-2);font-size:13px" class="num">${ic('online')}${ic('volume')}${ic('bell')}<span style="color:var(--text-1);text-align:right;line-height:1.25">09:41<br><span style="color:var(--text-3)">15.11.2026</span></span></span>
    </nav>
  </div>`;
}

// ───────────── Variant C: HUD, left rail + global menu + live preview ─────────────
function variantC() {
  const chamfer = 'clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)';
  const rail = ['folder', 'terminal', 'note', 'calendar', 'code', 'palette', 'gamepad', 'settings']
    .map(
      (i) =>
        `<span style="width:44px;height:44px;display:grid;place-items:center;color:${i === 'settings' ? 'var(--accent)' : 'var(--text-2)'};${i === 'settings' ? 'background:var(--accent-soft);border-left:2px solid var(--accent)' : ''}">${ic(i)}</span>`,
    )
    .join('');
  const kv = (k, v) =>
    `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--border)"><span style="color:var(--text-3)">${k}</span><span class="num" style="font-family:'JetBrains Mono Variable';font-size:12.5px">${v}</span></div>`;
  const body = `<div style="flex:1;display:grid;grid-template-columns:200px 1fr 300px;min-height:0">
    <aside class="side">${SETTINGS_NAV.filter(([i]) => i !== '-')
      .slice(0, 10)
      .map(([icon, label, on]) => `<div class="nav ${on ? 'on' : ''}">${ic(icon)}${label}</div>`)
      .join('')}</aside>
    <div class="content">
      <div style="font:600 11px 'JetBrains Mono Variable';color:var(--accent);letter-spacing:.08em">SYS / PERSONALIZATION</div>
      <h1 class="page" style="margin-top:6px">Personalization</h1>
      <h2 class="sec">Theme</h2><div class="themes" style="grid-template-columns:repeat(4,1fr)">${themeCards('Blade')}</div>
      <h2 class="sec">Motion</h2>
      <div class="group" style="border-radius:0;${chamfer}">
        <div class="row"><div class="txt"><b>Animations</b></div><div class="seg" style="border-radius:0"><span class="on" style="border-radius:0">System</span><span>Full</span><span>Reduced</span><span>Off</span></div></div>
        <div class="row"><div class="txt"><b>Scanlines</b><small>CRT overlay on the desktop.</small></div><span class="toggle on"></span></div>
        <div class="row"><div class="txt"><b>Transparency</b></div><div class="slider"><div class="track"><div class="fill" style="width:65%"></div><div class="knob" style="left:65%"></div></div><span class="v">65%</span></div></div>
      </div>
    </div>
    <aside style="border-left:1px solid var(--border);padding:18px;background:var(--surface-sunken)">
      <div style="font:600 11px 'JetBrains Mono Variable';color:var(--text-3);letter-spacing:.08em">LIVE PREVIEW</div>
      <div style="margin-top:10px;height:150px;background:#120806;position:relative;${chamfer};border:1px solid var(--border-strong)">
        <div style="position:absolute;left:18%;top:20%;width:64%;height:60%;background:#24110c;outline:1px solid #ff9a3c88"></div>
        <div style="position:absolute;left:26%;top:60%;width:22%;height:9%;background:#ff9a3c"></div></div>
      <div style="margin-top:16px">${kv('Theme', 'blade')}${kv('Accent', '#ff9a3c')}${kv('Contrast', '7.9 : 1')}${kv('Glow budget', '3 / 3')}${kv('Motion', 'system')}</div>
      <button class="btn primary" style="width:100%;margin-top:18px;justify-content:center;border-radius:0;${chamfer}">Apply theme</button>
    </aside>
  </div>`;
  return `<div class="desk">
    ${topbar('Settings', { menu: true })}
    <nav style="position:absolute;left:0;top:36px;bottom:0;width:56px;display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:14px;background:var(--glass);border-right:1px solid var(--border)">${rail}</nav>
    <section class="win focused" style="left:120px;top:70px;width:1240px;height:770px;border-radius:0;${chamfer}">
      <div class="titlebar" style="font-family:'JetBrains Mono Variable';font-size:12px;letter-spacing:.04em">${tile('settings', 'system', 'xs')}SETTINGS<span class="ctl"><span>${ic('minimize')}</span><span>${ic('maximize')}</span><span>${ic('close')}</span></span></div>
      ${body}
    </section>
  </div>`;
}

// ───────────── Render + switcher ─────────────
const SCENES = {
  settings: sceneSettings,
  arcade: sceneArcade,
  setup: sceneSetup,
  palette: scenePalette,
  mobile: sceneMobile,
  components: sceneComponents,
};
const render = variant === 'B' ? variantB : variant === 'C' ? variantC : (SCENES[scene] ?? sceneSettings);
document.getElementById('root').innerHTML = render();

if (!shot) {
  const go = (patch) => {
    const p = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    location.search = p.toString();
  };
  const variants = ['A', 'B', 'C', 'D'];
  const names = { A: 'Refined neon', B: 'Calm pro', C: 'HUD', D: 'HUD shell + calm inside (chosen)' };
  const bar = document.createElement('div');
  bar.className = 'proto-bar';
  bar.innerHTML = `<button data-d="-1">←</button><span class="lbl">${variant} (${names[variant]})</span><button data-d="1">→</button>
    <select data-k="scene">${Object.keys(SCENES)
      .map((s) => `<option ${s === scene ? 'selected' : ''}>${s}</option>`)
      .join('')}</select>
    <select data-k="theme">${['neon', 'arctic', 'hc'].map((s) => `<option ${s === theme ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
  document.body.append(bar);
  const cycle = (d) => go({ variant: variants[(variants.indexOf(variant) + d + variants.length) % variants.length] });
  bar.addEventListener('click', (e) => e.target.dataset.d && cycle(Number(e.target.dataset.d)));
  bar.addEventListener('change', (e) => go({ [e.target.dataset.k]: e.target.value }));
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input,textarea,select,[contenteditable]')) return;
    if (e.key === 'ArrowLeft') cycle(-1);
    if (e.key === 'ArrowRight') cycle(1);
  });
}
