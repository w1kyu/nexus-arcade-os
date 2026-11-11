// @ts-check
import { GameAudio, GameScoreService, SeededRng } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { cloneBoard, createEmptyBoard, getHighestTile, isGameOver, moveBoard, spawnTile } from './logic.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
  const scores = new GameScoreService('nexus.2048', ctx);
  const rng = new SeededRng();

  let boardSize = 4;
  let score = 0;
  let highScore = 0;
  /** @type {number[][]} */
  let board = createEmptyBoard(boardSize);
  /** @type {{ board: number[][], score: number }[]} */
  let history = [];
  let reached2048 = false;

  const root = h('div', { class: 'nx-2048-app' });

  // Header
  const header = h('div', { class: 'nx-2048-header' });
  const titleGroup = h('div', { class: 'nx-2048-title-group' }, h('h1', {}, '2048'));
  const scoresGroup = h('div', { class: 'nx-2048-scores' });

  const scoreBox = h(
    'div',
    { class: 'nx-2048-score-box' },
    h('div', { class: 'nx-2048-score-label' }, t('ui.score')),
    h('div', { class: 'nx-2048-score-num nx-val-score' }, '0'),
  );

  const bestBox = h(
    'div',
    { class: 'nx-2048-score-box' },
    h('div', { class: 'nx-2048-score-label' }, t('ui.best')),
    h('div', { class: 'nx-2048-score-num nx-val-best' }, '0'),
  );

  scoresGroup.append(scoreBox, bestBox);
  header.append(titleGroup, scoresGroup);

  // Controls bar
  const controlsBar = h('div', { class: 'nx-2048-controls-bar' });
  const sizeSelect = h('select', { class: 'nx-2048-select' });
  for (let s = 3; s <= 8; s++) {
    const opt = h('option', { value: String(s) }, `${s}x${s}`);
    if (s === 4) opt.selected = true;
    sizeSelect.append(opt);
  }

  const btnUndo = h('button', { class: 'nx-game-btn' }, t('ui.undo'));
  const btnRestart = h('button', { class: 'nx-game-btn nx-btn-primary' }, t('ui.restart'));

  controlsBar.append(
    h(
      'div',
      { style: 'display: flex; align-items: center; gap: 8px;' },
      h('span', { style: 'font-size: 13px; color: #8b9bb4;' }, t('ui.boardSize')),
      sizeSelect,
    ),
    h('div', { style: 'display: flex; gap: 8px;' }, btnUndo, btnRestart),
  );

  // Board
  const boardEl = h('div', { class: 'nx-2048-board' });
  const hintEl = h('div', { class: 'nx-2048-hint' }, t('ui.hint'));

  root.append(header, controlsBar, boardEl, hintEl);
  container.append(root);

  async function updateHighScoreDisplay() {
    const list = await scores.getLeaderboard(String(boardSize));
    highScore = list.length > 0 ? list[0].score : 0;
    const bestEl = root.querySelector('.nx-val-best');
    if (bestEl) bestEl.textContent = String(highScore);
  }

  function initGame() {
    board = createEmptyBoard(boardSize);
    score = 0;
    history = [];
    reached2048 = false;
    spawnTile(board, rng);
    spawnTile(board, rng);
    renderGrid();
    updateHighScoreDisplay();
  }

  function renderGrid() {
    boardEl.innerHTML = '';
    boardEl.style.setProperty('--board-size', String(boardSize));

    const scoreEl = root.querySelector('.nx-val-score');
    if (scoreEl) scoreEl.textContent = String(score);

    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const val = board[r][c];
        const cell = h(
          'div',
          {
            class: 'nx-2048-cell',
            'data-val': val > 0 ? String(val) : '',
          },
          val > 0 ? String(val) : '',
        );
        boardEl.append(cell);
      }
    }
  }

  /**
   * @param {'left' | 'right' | 'up' | 'down'} dir
   */
  async function handleMove(dir) {
    const res = moveBoard(board, dir);
    if (!res.changed) return;

    // Save previous state for undo (limit to 10)
    history.push({ board: cloneBoard(board), score });
    if (history.length > 10) history.shift();

    board = res.board;
    score += res.score;
    if (res.score > 0) {
      audio.play('coin');
      scores.unlockAchievement('2048_first_merge');
    } else {
      audio.play('jump');
    }

    spawnTile(board, rng);
    renderGrid();

    // Check tile milestones
    const highest = getHighestTile(board);
    if (highest >= 512) scores.unlockAchievement('2048_reach_512');
    if (highest >= 2048 && !reached2048) {
      reached2048 = true;
      audio.play('victory');
      scores.unlockAchievement('2048_reach_2048');
    }
    if (highest >= 4096) scores.unlockAchievement('2048_reach_4096');

    // Check game over
    if (isGameOver(board)) {
      audio.play('gameover');
      await scores.submitScore(score, String(boardSize));
      setTimeout(() => {
        alert(t('ui.gameOver'));
      }, 300);
    }
  }

  function handleUndo() {
    if (history.length === 0) return;
    const prev = history.pop();
    if (prev) {
      board = prev.board;
      score = prev.score;
      audio.play('blip');
      scores.unlockAchievement('2048_undo_master');
      renderGrid();
    }
  }

  // Event Listeners
  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        handleMove('left');
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        handleMove('right');
        break;
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault();
        handleMove('up');
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        handleMove('down');
        break;
      case 'KeyZ':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleUndo();
        }
        break;
    }
  };

  // Swipe support on board
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  const onTouchStart = (/** @type {TouchEvent} */ e) => {
    if (e.touches.length > 0) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = performance.now();
    }
  };

  const onTouchEnd = (/** @type {TouchEvent} */ e) => {
    if (e.changedTouches.length > 0) {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const dt = performance.now() - touchStartTime;
      const dist = Math.hypot(dx, dy);

      if (dist > 30 && dt < 400) {
        if (Math.abs(dx) > Math.abs(dy)) {
          handleMove(dx > 0 ? 'right' : 'left');
        } else {
          handleMove(dy > 0 ? 'down' : 'up');
        }
      }
    }
  };

  window.addEventListener('keydown', onKeyDown);
  boardEl.addEventListener('touchstart', onTouchStart, { passive: true });
  boardEl.addEventListener('touchend', onTouchEnd, { passive: true });

  btnUndo.addEventListener('click', handleUndo);
  btnRestart.addEventListener('click', initGame);
  sizeSelect.addEventListener('change', () => {
    boardSize = Number(sizeSelect.value);
    initGame();
  });

  initGame();

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    boardEl.removeEventListener('touchstart', onTouchStart);
    boardEl.removeEventListener('touchend', onTouchEnd);
    audio.dispose();
  };
}

export const terminal = {
  play2048: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching 2048 Cyber...');
    if (ctx.commands) {
      await ctx.commands.execute('2048.open');
    }
    return 0;
  },
};
