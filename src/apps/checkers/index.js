// @ts-check
import {
  GridCursor,
  createGameShell,
  gsButton,
  gsSelect,
  gsStat,
  gsToggleGroup,
  readLobbyArgs,
} from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { applyMove, chooseMove, countPieces, createState, legalMoves, outcome } from './logic.js';
import './styles.css';

const APP_ID = 'nexus.checkers';
const SCORE = { easy: 500, medium: 1300, hard: 2500 };

export const commands = {
  'checkers.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  checkers: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx, args) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-ck' });
  const { t, root, audio } = shell;
  await shell.load();
  const lobby = readLobbyArgs(args);

  /** @type {'ai' | 'local'} */
  let mode = lobby.local ? 'local' : 'ai';
  /** @type {'standard' | 'international'} */
  let variant = 'standard';
  /** @type {'easy' | 'medium' | 'hard'} */
  let difficulty = 'medium';
  let state = createState(variant);
  /** @type {import('./logic.js').Move[]} */
  let moves = [];
  /** @type {import('./logic.js').State[]} */
  let history = [];
  /** Selected piece and the squares already jumped to in a multi-capture. */
  /** @type {{ from: number, prefix: number[] } | null} */
  let selection = null;
  let over = false;
  let thinking = false;
  let plies = 0;
  let startedAt = 0;
  /** @type {number[]} */
  let lastMove = [];
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let aiTimer;

  const status = h('div', { class: 'nx-gs-status', role: 'status', 'data-testid': 'ck-status' });
  const boardEl = h('div', { class: 'nx-ck-board', 'data-testid': 'ck-board' });
  /** @type {HTMLElement[]} */
  let squares = [];
  const countP1 = gsStat('●', 'ck-count-1');
  const countP2 = gsStat('○', 'ck-count-2');
  countP1.el.classList.add('nx-ck-count-1');
  countP2.el.classList.add('nx-ck-count-2');

  const modeGroup = gsToggleGroup(
    [
      { value: 'ai', label: t('mode.ai') },
      { value: 'local', label: t('mode.local') },
    ],
    mode,
    (v) => {
      mode = /** @type {any} */ (v);
      diffSelect.hidden = mode !== 'ai';
      newGame();
    },
    'ck-mode',
  );
  const variantSelect = gsSelect(
    ['standard', 'international'].map((v) => ({ value: v, label: t(`variant.${v}`) })),
    variant,
    (v) => {
      variant = /** @type {any} */ (v);
      newGame();
    },
    { 'data-testid': 'ck-variant', 'aria-label': t('variant.label') },
  );
  const diffSelect = gsSelect(
    ['easy', 'medium', 'hard'].map((d) => ({ value: d, label: t(`difficulty.${d}`) })),
    difficulty,
    (v) => {
      difficulty = /** @type {any} */ (v);
      newGame();
    },
    { 'data-testid': 'ck-difficulty', 'aria-label': t('difficulty.label') },
  );
  diffSelect.hidden = mode !== 'ai';
  const undoBtn = gsButton(t('undo'), () => undo(), { 'data-testid': 'ck-undo' });

  root.append(
    h(
      'div',
      { class: 'nx-gs-bar' },
      modeGroup.el,
      variantSelect,
      diffSelect,
      h('span', { class: 'nx-gs-spacer' }),
      countP1.el,
      countP2.el,
      undoBtn,
      gsButton(t('new'), () => newGame(), { 'data-testid': 'ck-new' }),
      gsButton(
        shell.labels().stats,
        () =>
          shell.statsDialog(
            ['standard', 'international'].flatMap((v) =>
              ['easy', 'medium', 'hard'].map((d) => ({
                mode: `${v}-${d}`,
                label: `${t(`variant.short.${v}`)} ${t(`difficulty.${d}`)}`,
              })),
            ),
          ),
        { 'data-testid': 'ck-stats' },
      ),
      gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
    ),
    status,
    h('div', { class: 'nx-gs-main' }, boardEl),
  );

  function buildBoard() {
    const { size } = state.rules;
    boardEl.replaceChildren();
    boardEl.style.setProperty('--size', String(size));
    squares = [];
    for (let i = 0; i < size * size; i++) {
      const dark = (Math.floor(i / size) + (i % size)) % 2 === 1;
      const sq = h(dark ? 'button' : 'div', {
        class: `nx-ck-sq ${dark ? 'dark' : 'light'}`,
        'data-sq': String(i),
        type: dark ? 'button' : undefined,
        onclick: dark ? () => clickSquare(i) : undefined,
      });
      squares.push(sq);
      boardEl.append(sq);
    }
  }

  /** Legal moves that continue the current selection. */
  function candidates() {
    if (!selection) return [];
    const { from, prefix } = selection;
    return moves.filter((m) => m.from === from && prefix.every((sq, i) => m.path[i] === sq));
  }

  function render() {
    const { board } = state;
    const cands = candidates();
    const step = selection ? selection.prefix.length : 0;
    const targets = new Set(cands.map((m) => m.path[step]));
    const movable = new Set(moves.map((m) => m.from));
    // While a multi-capture is entered, the piece is shown where it currently stands.
    const shown = board.slice();
    /** @type {Set<number>} */
    const jumped = new Set();
    if (selection && step > 0) {
      shown[selection.prefix[step - 1]] = shown[selection.from];
      shown[selection.from] = 0;
      for (const m of cands.slice(0, 1)) for (const c of m.captures.slice(0, step)) jumped.add(c);
    }
    const humanTurn = !over && !thinking && (mode === 'local' || state.turn === 1);
    for (let i = 0; i < squares.length; i++) {
      const sq = squares[i];
      const p = shown[i];
      sq.dataset.piece = p ? `${p > 0 ? 1 : 2}${Math.abs(p) === 2 ? 'k' : ''}` : '';
      sq.classList.toggle('target', targets.has(i));
      sq.classList.toggle('movable', humanTurn && !selection && movable.has(i));
      sq.classList.toggle('selected', !!selection && i === (step ? selection.prefix[step - 1] : selection.from));
      sq.classList.toggle('jumped', jumped.has(i));
      sq.classList.toggle('last', lastMove.includes(i));
    }
    const count = countPieces(state);
    countP1.set(count[1].men + count[1].kings);
    countP2.set(count[-1].men + count[-1].kings);
    undoBtn.disabled = history.length === 0 || thinking;
    root.dataset.state = over ? 'over' : thinking ? 'thinking' : 'playing';
    boardEl.dataset.turn = state.turn === 1 ? '1' : '2';
  }

  function setStatus() {
    if (over) return;
    const mustCapture = moves.length > 0 && moves[0].captures.length > 0;
    let text;
    if (mode === 'ai') text = state.turn === 1 ? t('status.you') : t('status.ai');
    else text = t('status.player', { n: state.turn === 1 ? 1 : 2 });
    if (mustCapture && (mode === 'local' || state.turn === 1)) text += ` — ${t('status.mustCapture')}`;
    status.textContent = text;
  }

  function newGame() {
    clearTimeout(aiTimer);
    root.querySelector('.nx-game-modal-overlay')?.remove();
    state = createState(variant);
    moves = legalMoves(state);
    history = [];
    selection = null;
    over = false;
    thinking = false;
    plies = 0;
    lastMove = [];
    startedAt = Date.now();
    buildBoard();
    render();
    setStatus();
  }

  /** @param {number} sq */
  function clickSquare(sq) {
    if (over || thinking || shell.paused) return;
    if (mode === 'ai' && state.turn !== 1) return;
    if (selection) {
      const step = selection.prefix.length;
      const next = candidates().filter((m) => m.path[step] === sq);
      if (next.length) {
        selection.prefix.push(sq);
        const done = next.find((m) => m.path.length === selection?.prefix.length);
        if (done) {
          commit(done);
          return;
        }
        audio.play('blip');
        render();
        return;
      }
      // A started multi-capture must be finished; otherwise another piece can be picked.
      if (step > 0) return;
    }
    selection = moves.some((m) => m.from === sq) ? { from: sq, prefix: [] } : null;
    if (!selection && Math.sign(state.board[sq]) === state.turn && moves.length && moves[0].captures.length)
      shell.toast(t('status.mustCapture'));
    render();
  }

  /** @param {import('./logic.js').Move} move */
  function commit(move) {
    history.push(state);
    const wasMan = Math.abs(state.board[move.from]) === 1;
    state = applyMove(state, move);
    plies++;
    selection = null;
    lastMove = [move.from, ...move.path];
    const to = /** @type {number} */ (move.path.at(-1));
    const crowned = wasMan && Math.abs(state.board[to]) === 2;
    audio.play(crowned ? 'powerup' : move.captures.length ? 'hit' : 'blip');
    if (crowned && state.turn === -1 && mode === 'ai') ctx.achievements.unlock('checkers_king');
    if (move.captures.length >= 3 && state.turn === -1 && mode === 'ai') ctx.achievements.unlock('checkers_triple');
    moves = legalMoves(state);
    const result = outcome(state);
    if (result.over) {
      over = true;
      render();
      endGame(result.winner);
      return;
    }
    if (mode === 'ai' && state.turn === -1) {
      thinking = true;
      render();
      setStatus();
      aiTimer = setTimeout(() => {
        thinking = false;
        const reply = chooseMove(state, difficulty);
        if (reply) commit(reply);
      }, 300);
      return;
    }
    render();
    setStatus();
  }

  function undo() {
    if (!history.length || thinking) return;
    clearTimeout(aiTimer);
    root.querySelector('.nx-game-modal-overlay')?.remove();
    // Against the AI one undo takes back the reply and the own move.
    let steps = mode === 'ai' && state.turn === 1 && history.length >= 2 ? 2 : 1;
    while (steps-- > 0 && history.length) {
      state = /** @type {import('./logic.js').State} */ (history.pop());
      plies--;
    }
    moves = legalMoves(state);
    selection = null;
    over = false;
    lastMove = [];
    render();
    setStatus();
  }

  /** @param {1 | -1 | 0} winner */
  function endGame(winner) {
    const ai = mode === 'ai';
    const won = ai ? winner === 1 : winner !== 0;
    const n = winner === 1 ? 1 : 2;
    status.textContent = !winner
      ? t('status.draw')
      : ai
        ? t(winner === 1 ? 'status.won' : 'status.lost')
        : t('status.playerWon', { n });
    if (ai && won) {
      ctx.achievements.unlock('checkers_first_win');
      if (difficulty === 'hard') ctx.achievements.unlock('checkers_beat_hard');
    }
    const own = Math.ceil(plies / 2);
    void shell.finish({
      won,
      draw: winner === 0,
      ranked: ai,
      mode: `${variant}-${difficulty}`,
      score: ai && won ? SCORE[difficulty] + (variant === 'international' ? 300 : 0) : winner === 0 ? 100 : 0,
      moves: own,
      time: (Date.now() - startedAt) / 1000,
      title: ai || !winner ? undefined : t('status.playerWon', { n }),
      scoreLabel: t('movesLabel'),
      scoreText: String(own),
      onRestart: newGame,
    });
  }

  const cursor = new GridCursor(root, {
    size: () => ({ cols: state.rules.size, rows: state.rules.size }),
    enabled: () => !over && !thinking && !shell.paused && !root.querySelector('.nx-game-modal-overlay'),
    gamepad: () => (mode === 'local' ? lobby.gamepads[state.turn === 1 ? 0 : 1] : null),
    onMove: (x, y) => {
      for (const s of squares) s.classList.remove('cursor');
      squares[y * state.rules.size + x]?.classList.add('cursor');
    },
    onSelect: (x, y) => {
      const i = y * state.rules.size + x;
      if ((x + y) % 2 === 1) clickSquare(i);
    },
    onCancel: () => {
      if (selection && selection.prefix.length === 0) {
        selection = null;
        render();
      }
    },
  });
  cursor.set(0, state.rules.size - 3);

  shell.enablePause({ onRestart: newGame });
  shell.onDispose(() => {
    clearTimeout(aiTimer);
    cursor.dispose();
  });
  newGame();

  return { unmount: () => shell.dispose() };
}
