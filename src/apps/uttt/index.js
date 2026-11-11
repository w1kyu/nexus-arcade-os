// @ts-check
import { createGameShell, gsButton, gsSelect, gsToggleGroup, readLobbyArgs } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { EMPTY, PLAYER_O, PLAYER_X, TIE, chooseAIMove, createUTTTState, makeMove, undoMove } from './logic.js';
import './styles.css';

const APP_ID = 'nexus.uttt';

export const commands = {
  'uttt.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  uttt: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx, args) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-uttt' });
  const { t, root, audio } = shell;
  await shell.load();
  const lobby = readLobbyArgs(args);

  /** @type {'ai' | 'local'} */
  let mode = lobby.local ? 'local' : 'ai';
  /** @type {'easy' | 'medium' | 'hard'} */
  let difficulty = 'medium';
  let state = createUTTTState();
  let thinking = false;
  let startTime = Date.now();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let aiTimer;

  // Status HUD
  const statusEl = h('div', { class: 'nx-uttt-status', role: 'status', 'data-testid': 'uttt-status' });

  // Mode Group & Difficulty
  const modeGroup = gsToggleGroup(
    [
      { value: 'ai', label: t('mode.ai') },
      { value: 'local', label: t('mode.local') },
    ],
    mode,
    (val) => {
      mode = /** @type {any} */ (val);
      diffSelect.hidden = mode !== 'ai';
      newGame();
    },
    'uttt-mode',
  );

  const diffSelect = gsSelect(
    ['easy', 'medium', 'hard'].map((d) => ({ value: d, label: t(`difficulty.${d}`) })),
    difficulty,
    (val) => {
      difficulty = /** @type {any} */ (val);
      newGame();
    },
    { 'aria-label': t('difficulty.label') },
  );
  diffSelect.hidden = mode !== 'ai';

  const btnUndo = gsButton(t('actions.undo'), () => onUndoClick(), { 'data-testid': 'uttt-undo' });

  const bar = h(
    'div',
    { class: 'nx-uttt-bar' },
    modeGroup.el,
    diffSelect,
    h('span', { style: 'flex: 1' }),
    btnUndo,
    gsButton(t('actions.newGame'), () => newGame(), { 'data-testid': 'uttt-new' }),
    gsButton(shell.labels().stats, () =>
      shell.statsDialog(
        ['easy', 'medium', 'hard'].map((d) => ({ mode: d, label: t(`difficulty.${d}`) })),
        { moves: true },
      ),
    ),
    gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
  );

  // Macro Grid of 9 Sub-Boards
  const macroGrid = h('div', { class: 'nx-uttt-macro-grid', 'data-testid': 'uttt-board' });
  /** @type {HTMLElement[]} */
  const subBoardEls = [];
  /** @type {HTMLButtonElement[][]} */
  const cellButtons = [];

  for (let b = 0; b < 9; b++) {
    const subEl = h('div', { class: 'nx-uttt-sub-board', 'data-board': String(b) });
    const buttons = [];

    for (let c = 0; c < 9; c++) {
      const btn = /** @type {HTMLButtonElement} */ (
        h('button', {
          type: 'button',
          class: 'nx-uttt-cell',
          'data-cell': String(c),
          onclick: () => onCellClick(b, c),
        })
      );
      buttons.push(btn);
      subEl.append(btn);
    }

    subBoardEls.push(subEl);
    cellButtons.push(buttons);
    macroGrid.append(subEl);
  }

  const main = h('div', { class: 'nx-uttt-main' }, macroGrid);
  root.append(bar, statusEl, main);

  function newGame() {
    clearTimeout(aiTimer);
    state = createUTTTState();
    thinking = false;
    startTime = Date.now();
    render();
    updateStatus();
  }

  function updateStatus() {
    if (state.winner !== EMPTY) {
      if (state.winner === TIE) statusEl.textContent = t('status.draw');
      else if (mode === 'ai') statusEl.textContent = state.winner === PLAYER_X ? t('status.won') : t('status.lost');
      else statusEl.textContent = t('status.playerWon', { n: state.winner });
      return;
    }

    if (thinking) {
      statusEl.textContent = t('status.ai');
    } else if (mode === 'ai') {
      statusEl.textContent = state.turn === PLAYER_X ? t('status.you') : t('status.ai');
    } else {
      statusEl.textContent = t('status.player', { n: state.turn });
    }
  }

  function render() {
    btnUndo.disabled = state.moveHistory.length === 0 || thinking || state.winner !== EMPTY;

    for (let b = 0; b < 9; b++) {
      const subEl = subBoardEls[b];
      const macroVal = state.macro[b];

      // Active sub-board highlighting
      const isActive =
        state.winner === EMPTY && macroVal === EMPTY && (state.activeBoard === -1 || state.activeBoard === b);
      subEl.classList.toggle('active', isActive);
      subEl.classList.toggle('won-x', macroVal === PLAYER_X);
      subEl.classList.toggle('won-o', macroVal === PLAYER_O);

      // Macro overlay if won
      subEl.querySelector('.nx-uttt-macro-overlay')?.remove();
      if (macroVal === PLAYER_X || macroVal === PLAYER_O) {
        const overlay = h(
          'div',
          { class: `nx-uttt-macro-overlay ${macroVal === PLAYER_X ? 'x' : 'o'}` },
          macroVal === PLAYER_X ? 'X' : 'O',
        );
        subEl.append(overlay);
      }

      for (let c = 0; c < 9; c++) {
        const btn = cellButtons[b][c];
        const val = state.cells[b * 9 + c];

        btn.textContent = val === PLAYER_X ? 'X' : val === PLAYER_O ? 'O' : '';
        btn.classList.toggle('x', val === PLAYER_X);
        btn.classList.toggle('o', val === PLAYER_O);
        btn.disabled = !isActive || val !== EMPTY || thinking || state.winner !== EMPTY;
      }
    }
  }

  function onCellClick(board, cell) {
    if (thinking || state.winner !== EMPTY || shell.paused) return;
    executeTurn(board, cell);
  }

  function executeTurn(board, cell) {
    const success = makeMove(state, board, cell);
    if (!success) return;

    audio.play('place');
    render();
    updateStatus();

    if (state.winner !== EMPTY) {
      handleGameOver();
      return;
    }

    // Trigger AI move if in AI mode and it's O's turn
    if (mode === 'ai' && state.turn === PLAYER_O) {
      thinking = true;
      render();
      updateStatus();

      aiTimer = setTimeout(() => {
        thinking = false;
        const aiMove = chooseAIMove(state, difficulty);
        if (aiMove) {
          executeTurn(aiMove.board, aiMove.cell);
        }
      }, 350);
    }
  }

  function onUndoClick() {
    if (thinking || state.moveHistory.length === 0) return;
    clearTimeout(aiTimer);
    thinking = false;
    undoMove(state);
    if (mode === 'ai' && state.turn === PLAYER_O) {
      undoMove(state); // Undo AI move as well
    }
    render();
    updateStatus();
  }

  function handleGameOver() {
    const isWin = state.winner === PLAYER_X;
    const isDraw = state.winner === TIE;
    const movesCount = state.moveHistory.length;
    const duration = (Date.now() - startTime) / 1000;

    if (mode === 'ai' && isWin) {
      ctx.achievements.unlock('uttt_first_win');
      if (difficulty === 'hard') ctx.achievements.unlock('uttt_beat_hard');
    }

    setTimeout(() => {
      shell.finish({
        won: isWin,
        draw: isDraw,
        ranked: mode === 'ai',
        mode: difficulty,
        moves: movesCount,
        time: duration,
        score: isWin ? (difficulty === 'hard' ? 3000 : difficulty === 'medium' ? 1500 : 750) : isDraw ? 200 : 0,
        scoreText: `${movesCount} moves (${Math.round(duration)}s)`,
        onRestart: newGame,
      });
    }, 600);
  }

  shell.enablePause({
    onRestart: newGame,
  });

  shell.onDispose(() => {
    clearTimeout(aiTimer);
  });

  newGame();

  return {
    unmount: () => shell.dispose(),
  };
}
