// @ts-check
import {
  GridCursor,
  createGameShell,
  gsButton,
  gsSelect,
  gsToggleGroup,
  readLobbyArgs,
} from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { COLS, ROWS, chooseMove, createBoard, drop, findWin, isFull, landingRow } from './logic.js';
import './styles.css';

const APP_ID = 'nexus.connectfour';
const SCORE = { easy: 500, medium: 1200, hard: 2500 };

export const commands = {
  'connectfour.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  connectfour: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx, args) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-c4' });
  const { t, root, audio } = shell;
  await shell.load();
  const lobby = readLobbyArgs(args);

  /** @type {'ai' | 'local'} */
  let mode = lobby.local ? 'local' : 'ai';
  /** @type {'easy' | 'medium' | 'hard'} */
  let difficulty = 'medium';
  let board = createBoard();
  let turn = 1;
  let over = false;
  let thinking = false;
  let moves = 0;
  let startedAt = 0;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let aiTimer;

  const status = h('div', { class: 'nx-gs-status', role: 'status', 'data-testid': 'c4-status' });
  const boardEl = h('div', { class: 'nx-c4-board', 'data-testid': 'c4-board' });
  /** @type {HTMLButtonElement[]} */
  const columns = [];
  /** @type {HTMLElement[]} */
  const cells = new Array(COLS * ROWS);
  for (let c = 0; c < COLS; c++) {
    const col = h('button', {
      type: 'button',
      class: 'nx-c4-col',
      'data-col': String(c),
      'data-testid': `c4-col-${c}`,
      'aria-label': t('column', { n: c + 1 }),
      onclick: () => play(c),
    });
    for (let r = 0; r < ROWS; r++) {
      const cell = h('span', { class: 'nx-c4-cell', 'data-cell': String(r * COLS + c) });
      cells[r * COLS + c] = cell;
      col.append(cell);
    }
    columns.push(col);
    boardEl.append(col);
  }

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
    'c4-mode',
  );
  const diffSelect = gsSelect(
    ['easy', 'medium', 'hard'].map((d) => ({ value: d, label: t(`difficulty.${d}`) })),
    difficulty,
    (v) => {
      difficulty = /** @type {any} */ (v);
      newGame();
    },
    { 'data-testid': 'c4-difficulty', 'aria-label': t('difficulty.label') },
  );
  diffSelect.hidden = mode !== 'ai';

  const bar = h(
    'div',
    { class: 'nx-gs-bar' },
    modeGroup.el,
    diffSelect,
    h('span', { class: 'nx-gs-spacer' }),
    gsButton(t('new'), () => newGame(), { 'data-testid': 'c4-new' }),
    gsButton(
      shell.labels().stats,
      () =>
        shell.statsDialog(
          ['easy', 'medium', 'hard'].map((d) => ({ mode: d, label: t(`difficulty.${d}`) })),
          { moves: true },
        ),
      { 'data-testid': 'c4-stats' },
    ),
    gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
  );
  root.append(bar, status, h('div', { class: 'nx-gs-main' }, boardEl));

  function render() {
    for (let i = 0; i < cells.length; i++) cells[i].dataset.player = String(board[i]);
    boardEl.dataset.turn = String(turn);
    for (let c = 0; c < COLS; c++) columns[c].disabled = over || thinking || board[c] !== 0;
    root.dataset.state = over ? 'over' : thinking ? 'thinking' : 'playing';
  }

  function setStatus() {
    if (over) return;
    if (mode === 'ai') status.textContent = turn === 1 ? t('status.you') : t('status.ai');
    else status.textContent = t('status.player', { n: turn });
    status.dataset.turn = String(turn);
  }

  function newGame() {
    clearTimeout(aiTimer);
    root.querySelector('.nx-game-modal-overlay')?.remove();
    board = createBoard();
    turn = 1;
    over = false;
    thinking = false;
    moves = 0;
    startedAt = Date.now();
    for (const cell of cells) cell.classList.remove('win', 'drop');
    render();
    setStatus();
  }

  /** @param {number} col */
  function play(col) {
    if (over || thinking || shell.paused) return;
    place(col);
  }

  /** @param {number} col */
  function place(col) {
    const row = drop(board, col, turn);
    if (row < 0) return;
    moves++;
    audio.play('blip');
    const cell = cells[row * COLS + col];
    cell.style.setProperty('--fall', String(row + 1));
    cell.classList.remove('drop');
    void cell.offsetWidth;
    cell.classList.add('drop');

    const win = findWin(board);
    if (win || isFull(board)) {
      over = true;
      render();
      if (win) for (const i of win.cells) cells[i].classList.add('win');
      endGame(win ? win.player : 0);
      return;
    }
    turn = 3 - turn;
    if (mode === 'ai' && turn === 2) {
      thinking = true;
      render();
      setStatus();
      aiTimer = setTimeout(() => {
        thinking = false;
        place(chooseMove(board, 2, difficulty));
      }, 350);
      return;
    }
    render();
    setStatus();
  }

  /** @param {number} winner 0 = draw */
  function endGame(winner) {
    const ai = mode === 'ai';
    const won = ai ? winner === 1 : winner !== 0;
    status.textContent = !winner
      ? t('status.draw')
      : ai
        ? t(winner === 1 ? 'status.won' : 'status.lost')
        : t('status.playerWon', { n: winner });
    if (ai && won) {
      ctx.achievements.unlock('connectfour_first_win');
      if (difficulty === 'hard') ctx.achievements.unlock('connectfour_beat_hard');
      if (moves <= 15) ctx.achievements.unlock('connectfour_quick');
    }
    // The winning line pulses for a moment before the result covers it.
    aiTimer = setTimeout(
      () =>
        void shell.finish({
          won,
          draw: winner === 0,
          ranked: ai,
          mode: difficulty,
          score: ai && won ? SCORE[difficulty] + Math.max(0, 42 - moves) * 10 : winner === 0 ? 100 : 0,
          moves: Math.ceil(moves / 2),
          time: (Date.now() - startedAt) / 1000,
          title: ai || !winner ? undefined : t('status.playerWon', { n: winner }),
          scoreLabel: t('movesLabel'),
          scoreText: String(Math.ceil(moves / 2)),
          onRestart: newGame,
        }),
      winner ? 1100 : 300,
    );
  }

  const cursor = new GridCursor(root, {
    size: () => ({ cols: COLS, rows: 1 }),
    enabled: () => !over && !thinking && !shell.paused && !root.querySelector('.nx-game-modal-overlay'),
    gamepad: () => (mode === 'local' ? lobby.gamepads[turn - 1] : null),
    onMove: (x) => {
      for (const c of columns) c.classList.remove('cursor');
      columns[x].classList.add('cursor');
    },
    onSelect: (x) => {
      if (landingRow(board, x) >= 0) play(x);
    },
  });
  cursor.set(3, 0);

  shell.enablePause({ onRestart: newGame });
  shell.onDispose(() => {
    clearTimeout(aiTimer);
    cursor.dispose();
  });
  newGame();

  return { unmount: () => shell.dispose() };
}
