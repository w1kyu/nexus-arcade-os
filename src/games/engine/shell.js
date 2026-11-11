// @ts-check
// Game shell: the baseline every arcade title shares — localized pause menu (Escape), game-over
// celebration, high scores, per-mode statistics, XP, toasts, and a keyboard/gamepad grid cursor.

import { h } from '../../ui/dom.js';
import { GameAudio } from './audio.js';
import de from './i18n/de.json';
import en from './i18n/en.json';
import { GameScoreService } from './scores.js';
import { createGameOverModal, createPauseModal } from './ui.js';

/**
 * @typedef {object} ModeStats
 * @property {number} played
 * @property {number} won
 * @property {number} streak
 * @property {number} bestStreak
 * @property {number | null} bestTime Fastest win in seconds
 * @property {number | null} bestMoves Fewest moves of a win
 * @property {number} bestScore
 */

/** @returns {ModeStats} */
export const emptyStats = () => ({
  played: 0,
  won: 0,
  streak: 0,
  bestStreak: 0,
  bestTime: null,
  bestMoves: null,
  bestScore: 0,
});

/**
 * Pure: the statistics after one finished game.
 * @param {Partial<ModeStats> | undefined} stats
 * @param {{ won: boolean, time?: number, moves?: number, score?: number }} result
 * @returns {ModeStats}
 */
export function applyResult(stats, { won, time, moves, score }) {
  const s = { ...emptyStats(), ...stats };
  s.played++;
  if (won) {
    s.won++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if (typeof time === 'number') s.bestTime = s.bestTime === null ? time : Math.min(s.bestTime, time);
    if (typeof moves === 'number') s.bestMoves = s.bestMoves === null ? moves : Math.min(s.bestMoves, moves);
  } else {
    s.streak = 0;
  }
  if (typeof score === 'number') s.bestScore = Math.max(s.bestScore, score);
  return s;
}

/** @param {number} seconds */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Local date as YYYY-MM-DD (daily puzzles). @param {Date} [date] */
export function dayKey(date = new Date()) {
  const p = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** XP a score earns (same formula as GameScoreService.submitScore). @param {number} score */
export const xpForScore = (score) => Math.min(50, Math.max(5, Math.floor(score / 50)));

/** Per-mode statistics kept in the app's key-value store. */
export class GameStats {
  /**
   * @param {import('../../kernel/types').AppContext} [ctx]
   * @param {string} [key]
   */
  constructor(ctx, key = 'stats') {
    this.ctx = ctx;
    this.key = key;
    /** @type {Record<string, ModeStats>} */
    this.data = {};
  }

  async load() {
    try {
      const stored = await this.ctx?.storage?.kv?.get(this.key);
      if (stored && typeof stored === 'object') this.data = /** @type {any} */ (stored);
    } catch {
      // keep empty statistics
    }
    return this;
  }

  /** @param {string} mode */
  get(mode) {
    return { ...emptyStats(), ...this.data[mode] };
  }

  /**
   * @param {string} mode
   * @param {{ won: boolean, time?: number, moves?: number, score?: number }} result
   */
  async record(mode, result) {
    this.data[mode] = applyResult(this.data[mode], result);
    try {
      await this.ctx?.storage?.kv?.set(this.key, this.data);
    } catch {
      // read-only storage: statistics stay in memory
    }
    return this.data[mode];
  }
}

/**
 * @typedef {object} PauseHooks
 * @property {() => boolean} [canPause] Default: always
 * @property {() => void} [onPause]
 * @property {() => void} [onResume]
 * @property {() => void} onRestart
 * @property {() => void} [onQuit]
 */

/**
 * Builds the shared frame of a game window.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {{ appId: string, className: string }} options
 */
export function createGameShell(container, ctx, { appId, className }) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ vars = {}) => ctx.i18n.t(key, vars);
  /** Shared engine texts in the OS language. */
  const labels = () => (ctx?.i18n?.locale === 'de' ? de : en);
  const root = h('div', { class: `nx-gs ${className}`, tabindex: '-1', 'data-testid': `${appId}.root` });
  const audio = new GameAudio({ output: /** @type {any} */ (ctx)?.sound?.output?.('games') ?? null });
  const scores = new GameScoreService(appId, ctx);
  const stats = new GameStats(ctx);
  /** @type {(() => void)[]} */
  const cleanups = [];
  /** @type {HTMLElement | null} */
  let pauseModal = null;
  /** @type {PauseHooks | null} */
  let pauseHooks = null;
  let disposed = false;

  /** Keeps keyboard input inside this window: canvases and plain areas are not focusable. */
  const focus = () => {
    const active = document.activeElement;
    if (!active || !root.contains(active) || active === document.body) root.focus({ preventScroll: true });
  };
  root.addEventListener('pointerdown', () => queueMicrotask(focus));

  function resume() {
    if (!pauseModal) return;
    pauseModal.remove();
    pauseModal = null;
    root.dataset.paused = 'false';
    pauseHooks?.onResume?.();
    focus();
  }

  function pause() {
    if (pauseModal || !pauseHooks || root.querySelector('.nx-game-modal-overlay')) return;
    if (pauseHooks.canPause && !pauseHooks.canPause()) return;
    const hooks = pauseHooks;
    hooks.onPause?.();
    root.dataset.paused = 'true';
    pauseModal = createPauseModal({
      labels: labels(),
      audio,
      onResume: () => {
        pauseModal = null;
        root.dataset.paused = 'false';
        hooks.onResume?.();
        focus();
      },
      onRestart: () => {
        pauseModal = null;
        root.dataset.paused = 'false';
        hooks.onResume?.();
        hooks.onRestart();
        focus();
      },
      onQuit: hooks.onQuit
        ? () => {
            pauseModal = null;
            root.dataset.paused = 'false';
            hooks.onResume?.();
            hooks.onQuit?.();
            focus();
          }
        : undefined,
    });
    root.append(pauseModal);
  }

  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (pauseModal) {
      e.preventDefault();
      resume();
    } else if (pauseHooks && !root.querySelector('.nx-game-modal-overlay')) {
      e.preventDefault();
      pause();
    }
  };
  root.addEventListener('keydown', onKeyDown);

  /** Short celebration: colored paper falling over the window. */
  function confetti() {
    const layer = h('div', { class: 'nx-gs-confetti', 'aria-hidden': 'true' });
    const colors = ['#00f0ff', '#ff3366', '#ffd700', '#00ff88', '#b388ff', '#ff9f1c'];
    for (let i = 0; i < 48; i++) {
      const piece = h('i', {});
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.6}s`;
      piece.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.append(piece);
    }
    root.append(layer);
    const timer = setTimeout(() => layer.remove(), 3600);
    cleanups.push(() => clearTimeout(timer));
  }

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let toastTimer;
  /** @param {string} message */
  function toast(message) {
    root.querySelector('.nx-gs-toast')?.remove();
    clearTimeout(toastTimer);
    const el = h('div', { class: 'nx-gs-toast', role: 'status', 'data-testid': 'game-toast' }, message);
    root.append(el);
    toastTimer = setTimeout(() => el.remove(), 2200);
  }

  /**
   * A modal inside the game window.
   * @param {string} title
   * @param {(Node | string)[]} body
   * @param {{ label: string, primary?: boolean, onClick?: () => void | false }[]} [buttons] `false` keeps it open
   */
  function dialog(title, body, buttons) {
    const overlay = h('div', { class: 'nx-game-modal-overlay', 'data-testid': 'game-dialog' });
    const close = () => {
      overlay.remove();
      focus();
    };
    const actions = (buttons ?? [{ label: labels().close, primary: true }]).map((b) =>
      h(
        'button',
        {
          class: `nx-game-btn ${b.primary ? 'nx-btn-primary' : ''}`,
          onclick: () => {
            if (b.onClick?.() !== false) close();
          },
        },
        b.label,
      ),
    );
    overlay.append(
      h(
        'div',
        { class: 'nx-game-modal nx-gs-dialog' },
        h('h2', { class: 'nx-game-modal-title' }, title),
        h('div', { class: 'nx-gs-dialog-body' }, ...body),
        h('div', { class: 'nx-game-modal-actions' }, ...actions),
      ),
    );
    root.append(overlay);
    return { overlay, close };
  }

  /**
   * Statistics dialog: one column per mode.
   * @param {{ mode: string, label: string }[]} modes
   * @param {{ time?: boolean, moves?: boolean, score?: boolean }} [show]
   */
  function statsDialog(modes, show = { time: true }) {
    const L = labels();
    const pct = (/** @type {ModeStats} */ s) => (s.played ? `${Math.round((s.won / s.played) * 100)}%` : '–');
    /** @type {[string, (s: ModeStats) => string][]} */
    const rows = [
      [L.played, (s) => String(s.played)],
      [L.won, (s) => String(s.won)],
      [L.winRate, pct],
      [L.streak, (s) => String(s.streak)],
      [L.bestStreak, (s) => String(s.bestStreak)],
    ];
    if (show.time) rows.push([L.bestTime, (s) => (s.bestTime === null ? '–' : formatTime(s.bestTime))]);
    if (show.moves) rows.push([L.bestMoves, (s) => (s.bestMoves === null ? '–' : String(s.bestMoves))]);
    if (show.score) rows.push([L.bestScore, (s) => String(s.bestScore)]);
    const table = h(
      'table',
      { class: 'nx-gs-stats', 'data-testid': 'game-stats' },
      h('thead', {}, h('tr', {}, h('th', {}), ...modes.map((m) => h('th', {}, m.label)))),
      h(
        'tbody',
        {},
        ...rows.map(([label, value]) =>
          h('tr', {}, h('th', {}, label), ...modes.map((m) => h('td', {}, value(stats.get(m.mode))))),
        ),
      ),
    );
    return dialog(L.stats, [table]);
  }

  /**
   * Top-10 list of one mode.
   * @param {string} mode
   * @param {(entry: import('./scores.js').HighScoreEntry) => string} [format]
   */
  async function leaderboardDialog(mode, format = (e) => String(e.score)) {
    const L = labels();
    const list = await scores.getLeaderboard(mode);
    const body = list.length
      ? h(
          'ol',
          { class: 'nx-gs-board' },
          ...list.map((e) =>
            h('li', {}, h('span', {}, format(e)), h('time', {}, ctx.i18n.date(e.timestamp, { dateStyle: 'medium' }))),
          ),
        )
      : h('p', {}, L.noScores);
    return dialog(L.leaderboard, [body]);
  }

  /**
   * Ends a game: records score, statistics and XP, celebrates, and shows the result.
   * @param {object} result
   * @param {boolean} result.won
   * @param {boolean} [result.draw]
   * @param {number} result.score Leaderboard value (higher is better); also decides the XP
   * @param {string} [result.mode] Leaderboard and statistics bucket
   * @param {number} [result.time] Seconds
   * @param {number} [result.moves]
   * @param {string} [result.title]
   * @param {string} [result.scoreLabel]
   * @param {string} [result.scoreText]
   * @param {boolean} [result.ranked] false: no leaderboard/statistics entry (e.g. local 2-player)
   * @param {() => void} result.onRestart
   * @param {() => void} [result.onQuit]
   */
  async function finish({
    won,
    draw = false,
    score,
    mode = 'classic',
    time,
    moves,
    title,
    scoreLabel,
    scoreText,
    ranked = true,
    onRestart,
    onQuit,
  }) {
    const L = labels();
    let res = { rank: 0, isNewHigh: false };
    if (ranked) {
      await stats.record(mode, { won, time, moves, score });
      res = await scores.submitScore(score, mode, { details: { time, moves, won } });
    }
    if (disposed) return res;
    if (won) {
      audio.play('victory');
      confetti();
    } else if (!draw) {
      audio.play('gameover');
    }
    const modal = createGameOverModal({
      labels: L,
      title: title ?? (won ? L.youWin : draw ? L.draw : L.gameOver),
      won: won || draw,
      score,
      scoreLabel,
      scoreText,
      isNewHigh: ranked && won && res.isNewHigh,
      rank: ranked && won ? res.rank : 0,
      xpEarned: ranked ? xpForScore(score) : 0,
      onRestart: () => {
        onRestart();
        focus();
      },
      onQuit,
      onLeaderboard: ranked ? () => void leaderboardDialog(mode) : undefined,
    });
    modal.dataset.result = won ? 'won' : draw ? 'draw' : 'lost';
    root.append(modal);
    return res;
  }

  container.append(root);
  queueMicrotask(focus);

  return {
    root,
    t,
    labels,
    audio,
    scores,
    stats,
    focus,
    toast,
    dialog,
    statsDialog,
    leaderboardDialog,
    confetti,
    finish,
    pause,
    resume,
    /** True while the pause menu is open. */
    get paused() {
      return pauseModal !== null;
    },
    /** Enables the Escape pause menu. @param {PauseHooks} hooks */
    enablePause(hooks) {
      pauseHooks = hooks;
    },
    /** Loads the stored statistics. */
    async load() {
      await stats.load();
    },
    /** Runs on dispose. @param {() => void} fn */
    onDispose(fn) {
      cleanups.push(fn);
    },
    dispose() {
      disposed = true;
      clearTimeout(toastTimer);
      root.removeEventListener('keydown', onKeyDown);
      for (const fn of cleanups) fn();
      cleanups.length = 0;
      audio.dispose();
      root.remove();
    },
  };
}

/** @typedef {ReturnType<typeof createGameShell>} GameShell */

/**
 * Keyboard (arrows + Enter/Space) and gamepad (d-pad/stick + A) cursor over a grid, for board games.
 * `gamepad()` limits input to one pad (local multiplayer); null accepts any pad.
 */
export class GridCursor {
  /**
   * @param {HTMLElement} target Element that receives key events
   * @param {object} options
   * @param {() => { cols: number, rows: number }} options.size
   * @param {(x: number, y: number) => void} options.onMove
   * @param {(x: number, y: number) => void} options.onSelect
   * @param {() => void} [options.onCancel]
   * @param {() => boolean} [options.enabled]
   * @param {() => number | null} [options.gamepad]
   */
  constructor(target, { size, onMove, onSelect, onCancel, enabled = () => true, gamepad = () => null }) {
    this.x = 0;
    this.y = 0;
    this.active = false;
    this.size = size;
    this.onMove = onMove;
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.enabled = enabled;
    this.gamepad = gamepad;
    this.target = target;
    this.lastPad = 0;
    /** @type {Set<number>} */
    this.padDown = new Set();
    this.frame = 0;

    this.onKey = (/** @type {KeyboardEvent} */ e) => {
      if (!this.enabled() || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = /** @type {HTMLElement} */ (e.target)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (dir) {
        e.preventDefault();
        this.move(dir[0], dir[1]);
      } else if ((e.key === 'Enter' || e.key === ' ') && tag !== 'BUTTON') {
        e.preventDefault();
        this.select();
      } else if (e.key === 'Backspace' && this.onCancel) {
        this.onCancel();
      }
    };
    target.addEventListener('keydown', this.onKey);

    const poll = () => {
      this.frame = requestAnimationFrame(poll);
      if (!this.enabled() || typeof navigator === 'undefined' || !navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      const wanted = this.gamepad();
      const pad = wanted === null ? [...pads].find((p) => p) : pads[wanted];
      if (!pad) return;
      const now = performance.now();
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const dx = pad.buttons[14]?.pressed || ax < -0.5 ? -1 : pad.buttons[15]?.pressed || ax > 0.5 ? 1 : 0;
      const dy = pad.buttons[12]?.pressed || ay < -0.5 ? -1 : pad.buttons[13]?.pressed || ay > 0.5 ? 1 : 0;
      if ((dx || dy) && now - this.lastPad > 170) {
        this.lastPad = now;
        this.move(dx, dy);
      }
      for (const [index, action] of /** @type {[number, () => void][]} */ ([
        [0, () => this.select()],
        [1, () => this.onCancel?.()],
      ])) {
        const pressed = !!pad.buttons[index]?.pressed;
        if (pressed && !this.padDown.has(index)) action();
        if (pressed) this.padDown.add(index);
        else this.padDown.delete(index);
      }
    };
    if (typeof requestAnimationFrame !== 'undefined') this.frame = requestAnimationFrame(poll);
  }

  /** @param {number} dx @param {number} dy */
  move(dx, dy) {
    const { cols, rows } = this.size();
    this.active = true;
    this.x = Math.max(0, Math.min(cols - 1, this.x + dx));
    this.y = Math.max(0, Math.min(rows - 1, this.y + dy));
    this.onMove(this.x, this.y);
  }

  select() {
    if (!this.active) {
      this.active = true;
      this.onMove(this.x, this.y);
      return;
    }
    this.onSelect(this.x, this.y);
  }

  /** @param {number} x @param {number} y */
  set(x, y) {
    this.x = x;
    this.y = y;
  }

  dispose() {
    this.target.removeEventListener('keydown', this.onKey);
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}

/**
 * Who controls each side in a local game. The Arcade lobby passes `players` as launch arguments.
 * @param {unknown} args
 * @returns {{ local: boolean, gamepads: (number | null)[] }}
 */
export function readLobbyArgs(args) {
  const a = /** @type {any} */ (args);
  const players = Array.isArray(a?.players) ? a.players : null;
  return {
    local: a?.mode === 'local' || !!players,
    gamepads: [0, 1].map((i) => {
      const p = players?.[i];
      return p && p.device === 'gamepad' && Number.isInteger(p.index) ? p.index : null;
    }),
  };
}

// ── Small toolbar widgets ───────────────────────────────────────────────────────────────────

/**
 * @param {string} label
 * @param {(e: MouseEvent) => void} onClick
 * @param {Record<string, any>} [props] e.g. `{ 'data-testid': 'new', class: 'primary' }`
 */
export function gsButton(label, onClick, props = {}) {
  const { class: extra = '', ...rest } = props;
  return h('button', { type: 'button', class: `nx-gs-btn ${extra}`.trim(), onclick: onClick, ...rest }, label);
}

/**
 * A labelled counter for the toolbar ("Moves 12").
 * @param {string} label
 * @param {string} [testid]
 */
export function gsStat(label, testid) {
  const value = h('b', { 'data-testid': testid }, '0');
  const el = h('span', { class: 'nx-gs-stat' }, label, value);
  return { el, set: (/** @type {string | number} */ v) => void (value.textContent = String(v)) };
}

/**
 * @param {{ value: string, label: string }[]} options
 * @param {string} value
 * @param {(value: string) => void} onChange
 * @param {Record<string, any>} [props]
 */
export function gsSelect(options, value, onChange, props = {}) {
  const select = h(
    'select',
    { class: 'nx-gs-select', onchange: () => onChange(select.value), ...props },
    ...options.map((o) => h('option', { value: o.value }, o.label)),
  );
  select.value = value;
  return select;
}

/**
 * A row of mutually exclusive buttons.
 * @param {{ value: string, label: string }[]} options
 * @param {string} value
 * @param {(value: string) => void} onChange
 * @param {string} [testidPrefix]
 */
export function gsToggleGroup(options, value, onChange, testidPrefix) {
  const el = h('div', { class: 'nx-gs-group', role: 'group' });
  const set = (/** @type {string} */ v) => {
    for (const b of el.children)
      b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.value === v));
  };
  for (const o of options)
    el.append(
      gsButton(
        o.label,
        () => {
          set(o.value);
          onChange(o.value);
        },
        { 'data-value': o.value, 'data-testid': testidPrefix ? `${testidPrefix}-${o.value}` : undefined },
      ),
    );
  set(value);
  return { el, set };
}
