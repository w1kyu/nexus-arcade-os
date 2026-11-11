// @ts-check
import { GameAudio, GameScoreService, createGameOverModal, createPauseModal } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { DIFFICULTIES, MinesweeperBoard } from './logic.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const root = h('div', { class: 'nx-minesweeper-app' });
  const audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
  const scores = new GameScoreService('nexus.minesweeper', ctx);

  let currentDiffKey = 'beginner';
  let customConfig = { rows: 9, cols: 9, mines: 10 };
  let flagMode = false; // For mobile / touch

  /** @type {MinesweeperBoard} */
  let board;
  /** @type {number | null} */
  let timerId = null;
  let secondsElapsed = 0;
  let timerRunning = false;
  let isPaused = false;

  // Header Elements
  const lcdMines = h('div', { class: 'nx-minesweeper-lcd' }, '010');
  const faceBtn = h('button', { class: 'nx-minesweeper-face-btn' }, '🙂');
  const lcdTimer = h('div', { class: 'nx-minesweeper-lcd' }, '000');

  const header = h('div', { class: 'nx-minesweeper-header' }, lcdMines, faceBtn, lcdTimer);

  // Difficulty buttons
  const diffGroup = h('div', { class: 'nx-minesweeper-diff-group' });
  /** @type {Record<string, HTMLButtonElement>} */
  const diffBtns = {};

  for (const diff of ['beginner', 'intermediate', 'expert', 'custom']) {
    const btn = /** @type {HTMLButtonElement} */ (
      h('button', { class: `nx-minesweeper-btn ${diff === currentDiffKey ? 'active' : ''}` }, t(`difficulty.${diff}`))
    );
    btn.addEventListener('click', () => {
      if (diff === 'custom') {
        openCustomPrompt();
      } else {
        currentDiffKey = diff;
        updateDiffButtons();
        startNewGame();
      }
    });
    diffBtns[diff] = btn;
    diffGroup.append(btn);
  }

  function updateDiffButtons() {
    for (const [k, b] of Object.entries(diffBtns)) {
      b.classList.toggle('active', k === currentDiffKey);
    }
  }

  // Touch Flag mode toggle
  const flagToggleBtn = h('button', { class: 'nx-minesweeper-btn' }, '⛏️ Dig');
  flagToggleBtn.addEventListener('click', () => {
    flagMode = !flagMode;
    flagToggleBtn.textContent = flagMode ? '🚩 Flag' : '⛏️ Dig';
    flagToggleBtn.classList.toggle('active', flagMode);
  });

  const toolbar = h('div', { class: 'nx-minesweeper-toolbar' }, diffGroup, flagToggleBtn);

  // Board container
  const boardWrap = h('div', { class: 'nx-minesweeper-board-wrap' });
  const boardEl = h('div', { class: 'nx-minesweeper-board' });
  boardWrap.append(boardEl);

  faceBtn.addEventListener('click', () => {
    startNewGame();
  });

  function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    timerId = window.setInterval(() => {
      if (!isPaused) {
        secondsElapsed = Math.min(999, secondsElapsed + 1);
        lcdTimer.textContent = String(secondsElapsed).padStart(3, '0');
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    timerRunning = false;
  }

  function updateLcdMines() {
    const remaining = Math.max(-99, board.totalMines - board.flagsCount);
    lcdMines.textContent = remaining < 0 ? String(remaining) : String(remaining).padStart(3, '0');
  }

  function startNewGame() {
    stopTimer();
    secondsElapsed = 0;
    lcdTimer.textContent = '000';
    faceBtn.textContent = '🙂';

    const cfg = currentDiffKey === 'custom' ? customConfig : DIFFICULTIES[currentDiffKey];
    board = new MinesweeperBoard(cfg.rows, cfg.cols, cfg.mines);
    updateLcdMines();
    renderBoard();
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${board.cols}, 30px)`;
    boardEl.style.gridTemplateRows = `repeat(${board.rows}, 30px)`;

    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const cellEl = h('div', {
          class: 'nx-minesweeper-cell',
          'data-row': String(r),
          'data-col': String(c),
        });

        // Mouse down face reaction
        cellEl.addEventListener('mousedown', (e) => {
          if (e.button === 0 && !board.gameOver) {
            faceBtn.textContent = '😮';
          }
        });
        window.addEventListener(
          'mouseup',
          () => {
            if (!board.gameOver) faceBtn.textContent = '🙂';
          },
          { once: true },
        );

        // Click / Dig
        cellEl.addEventListener('click', () => {
          if (board.gameOver) return;
          if (flagMode) {
            handleRightClick(r, c);
          } else {
            handleLeftClick(r, c);
          }
        });

        // Right-click / Flag
        cellEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          handleRightClick(r, c);
        });

        // Chording on double click or middle click
        cellEl.addEventListener('dblclick', () => {
          handleChord(r, c);
        });
        cellEl.addEventListener('auxclick', (e) => {
          if (e.button === 1) {
            e.preventDefault();
            handleChord(r, c);
          }
        });

        boardEl.append(cellEl);
      }
    }
    updateCellElements();
  }

  /**
   * @param {number} r
   * @param {number} c
   */
  function handleLeftClick(r, c) {
    if (board.gameOver) return;
    const cell = board.grid[r][c];

    // If already revealed and has adjacent mines, clicking chords
    if (cell.revealed && cell.adjacentMines > 0) {
      handleChord(r, c);
      return;
    }

    if (!timerRunning) startTimer();

    const res = board.reveal(r, c);
    updateCellElements();
    updateLcdMines();

    if (res.status === 'mine') {
      audio.play('explosion');
      faceBtn.textContent = '💥';
      stopTimer();
      showGameOver(false);
    } else if (res.status === 'won') {
      audio.play('victory');
      faceBtn.textContent = '😎';
      stopTimer();
      showGameOver(true);
    } else if (res.status === 'safe') {
      audio.play('blip');
    }
  }

  /**
   * @param {number} r
   * @param {number} c
   */
  function handleRightClick(r, c) {
    if (board.gameOver) return;
    board.toggleMark(r, c);
    audio.play('hit');
    updateCellElements();
    updateLcdMines();
  }

  /**
   * @param {number} r
   * @param {number} c
   */
  function handleChord(r, c) {
    if (board.gameOver) return;
    const res = board.chord(r, c);
    if (res.status === 'ignored') return;

    updateCellElements();
    updateLcdMines();

    if (res.status === 'mine') {
      audio.play('explosion');
      faceBtn.textContent = '💥';
      stopTimer();
      showGameOver(false);
    } else if (res.status === 'won') {
      audio.play('victory');
      faceBtn.textContent = '😎';
      stopTimer();
      showGameOver(true);
    } else {
      audio.play('blip');
    }

    if (ctx?.achievements?.unlock) {
      ctx.achievements.unlock('minesweeper_chord_clear');
    }
  }

  function updateCellElements() {
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const cell = board.grid[r][c];
        const idx = r * board.cols + c;
        const el = /** @type {HTMLElement} */ (boardEl.children[idx]);
        if (!el) continue;

        el.className = 'nx-minesweeper-cell';
        el.removeAttribute('data-count');
        el.textContent = '';

        if (cell.revealed) {
          el.classList.add('revealed');
          if (cell.mine) {
            el.textContent = '💣';
            if (cell.exploded) el.classList.add('exploded');
          } else if (cell.adjacentMines > 0) {
            el.textContent = String(cell.adjacentMines);
            el.setAttribute('data-count', String(cell.adjacentMines));
          }
        } else {
          if (cell.mark === 'flag') {
            el.textContent = '🚩';
          } else if (cell.mark === 'question') {
            el.textContent = '?';
          }
        }
      }
    }
  }

  function showGameOver(won) {
    const finalScore = won ? Math.max(1, 1000 - secondsElapsed) : 0;
    scores.submitScore(finalScore, currentDiffKey, { details: { time: secondsElapsed } }).then((res) => {
      const modal = createGameOverModal({
        score: won ? secondsElapsed : 0,
        isNewHigh: res.isNewHigh,
        rank: res.rank,
        xpEarned: won ? (currentDiffKey === 'expert' ? 40 : currentDiffKey === 'intermediate' ? 25 : 15) : 5,
        onRestart: () => startNewGame(),
      });
      // Customize score label in modal for Minesweeper (Time vs Score)
      const label = modal.querySelector('.nx-game-score-label');
      if (label && won) label.textContent = 'TIME (SECONDS)';
      root.append(modal);
    });

    if (won && ctx?.achievements?.unlock) {
      if (currentDiffKey === 'beginner') ctx.achievements.unlock('minesweeper_win_beginner');
      if (currentDiffKey === 'intermediate') ctx.achievements.unlock('minesweeper_win_intermediate');
      if (currentDiffKey === 'expert') ctx.achievements.unlock('minesweeper_win_expert');
    }
  }

  function openCustomPrompt() {
    const overlay = h('div', { class: 'nx-game-modal-overlay' });
    const modal = h('div', { class: 'nx-minesweeper-custom-dialog' });

    const title = h('h3', {}, t('custom.title'));
    const rowR = h(
      'label',
      { class: 'nx-minesweeper-input-row' },
      h('span', {}, t('custom.rows')),
      h('input', { type: 'number', min: '8', max: '30', value: String(customConfig.rows) }),
    );
    const rowC = h(
      'label',
      { class: 'nx-minesweeper-input-row' },
      h('span', {}, t('custom.cols')),
      h('input', { type: 'number', min: '8', max: '40', value: String(customConfig.cols) }),
    );
    const rowM = h(
      'label',
      { class: 'nx-minesweeper-input-row' },
      h('span', {}, t('custom.mines')),
      h('input', { type: 'number', min: '1', max: '200', value: String(customConfig.mines) }),
    );

    const btnOk = h('button', { class: 'nx-minesweeper-btn active' }, t('custom.apply'));
    const btnCancel = h('button', { class: 'nx-minesweeper-btn' }, t('custom.cancel'));

    btnOk.addEventListener('click', () => {
      const inputR = /** @type {HTMLInputElement} */ (rowR.querySelector('input'));
      const inputC = /** @type {HTMLInputElement} */ (rowC.querySelector('input'));
      const inputM = /** @type {HTMLInputElement} */ (rowM.querySelector('input'));

      const r = Math.max(8, Math.min(30, parseInt(inputR.value, 10) || 9));
      const c = Math.max(8, Math.min(40, parseInt(inputC.value, 10) || 9));
      const m = Math.max(1, Math.min(r * c - 9, parseInt(inputM.value, 10) || 10));

      customConfig = { rows: r, cols: c, mines: m };
      currentDiffKey = 'custom';
      updateDiffButtons();
      overlay.remove();
      startNewGame();
    });

    btnCancel.addEventListener('click', () => {
      overlay.remove();
    });

    const actions = h(
      'div',
      { style: 'display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;' },
      btnCancel,
      btnOk,
    );
    modal.append(title, rowR, rowC, rowM, actions);
    overlay.append(modal);
    root.append(overlay);
  }

  // Keyboard shortcut: Escape to Pause
  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    if (e.key === 'Escape') {
      if (isPaused) {
        isPaused = false;
      } else {
        isPaused = true;
        const modal = createPauseModal({
          onResume: () => {
            isPaused = false;
          },
          onRestart: () => {
            isPaused = false;
            startNewGame();
          },
          audio,
          title: 'MINESWEEPER PAUSED',
        });
        root.append(modal);
      }
    }
  };
  window.addEventListener('keydown', onKeyDown);

  root.append(toolbar, header, boardWrap);
  container.append(root);
  startNewGame();

  return () => {
    stopTimer();
    window.removeEventListener('keydown', onKeyDown);
  };
}

export const terminal = {
  minesweeper: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Minesweeper...');
    if (ctx.commands) {
      await ctx.commands.execute('minesweeper.open');
    }
    return 0;
  },
};
