// @ts-check
import { createGameShell, formatTime, gsButton, gsSelect, gsStat } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { BUNDLED_PUZZLES, computeLineClues, generateProceduralPuzzle } from './puzzles.js';
import './styles.css';

const APP_ID = 'nexus.nonogram';

export const commands = {
  'nonogram.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  nonogram: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

const CELL_EMPTY = 0;
const CELL_FILLED = 1;
const CELL_CROSSED = 2;

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-nonogram' });
  const { t, root, audio } = shell;
  await shell.load();

  /** @type {import('./puzzles.js').NonogramPuzzle} */
  let currentPuzzle = BUNDLED_PUZZLES[0];
  /** @type {number[][]} */
  let userGrid = [];
  /** @type {'fill' | 'cross'} */
  let activeTool = 'fill';
  let penaltyEnabled = false;
  let errorCount = 0;
  let elapsedSeconds = 0;
  let startTime = 0;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timerInterval;
  let isMouseDown = false;
  let isGameOver = false;

  /** @type {number[][][]} */
  const history = [];

  // Top Bar & HUD
  const topBar = h('div', { class: 'nx-gs-bar' });
  const statErrors = gsStat(t('hud.errors'), 'ng-errors');
  const statTime = gsStat(t('hud.time'), 'ng-time');

  const puzzleSelect = gsSelect(
    BUNDLED_PUZZLES.map((p, i) => ({ value: String(i), label: p.title[ctx.i18n.locale] ?? p.title.en })),
    '0',
    (v) => {
      loadPuzzle(BUNDLED_PUZZLES[Number(v)]);
    },
    { 'data-testid': 'ng-puzzle-select', 'aria-label': t('hud.puzzle') },
  );

  const btnToolFill = gsButton(t('actions.toolFill'), () => setTool('fill'), {
    'data-testid': 'ng-tool-fill',
    class: 'primary',
  });
  const btnToolCross = gsButton(t('actions.toolCross'), () => setTool('cross'), { 'data-testid': 'ng-tool-cross' });

  const btnPenalty = gsButton(
    t('actions.penalty'),
    () => {
      penaltyEnabled = !penaltyEnabled;
      btnPenalty.classList.toggle('primary', penaltyEnabled);
    },
    { 'data-testid': 'ng-penalty' },
  );

  const btnProcedural = gsButton(
    t('actions.procedural'),
    () => {
      const seed = Math.floor(Math.random() * 100000);
      const proc = generateProceduralPuzzle(10, 10, seed);
      loadPuzzle(proc);
    },
    { 'data-testid': 'ng-procedural' },
  );

  const btnUndo = gsButton(t('actions.undo'), () => undo(), { 'data-testid': 'ng-undo' });
  const btnReset = gsButton(t('actions.reset'), () => resetPuzzle(), { 'data-testid': 'ng-reset' });

  topBar.append(
    puzzleSelect,
    btnToolFill,
    btnToolCross,
    btnPenalty,
    btnProcedural,
    btnUndo,
    btnReset,
    statErrors.el,
    statTime.el,
  );

  // Stage & Board elements
  const stageEl = h('div', { class: 'nx-ng-stage', 'data-testid': 'ng-stage' });
  const boardEl = h('div', { class: 'nx-ng-board', 'data-testid': 'ng-board' });
  stageEl.append(boardEl);

  root.append(topBar, stageEl);

  // Mouse drag listeners
  window.addEventListener('mouseup', () => (isMouseDown = false));

  function setTool(tool) {
    activeTool = tool;
    btnToolFill.classList.toggle('primary', activeTool === 'fill');
    btnToolCross.classList.toggle('primary', activeTool === 'cross');
  }

  function startTimer() {
    clearInterval(timerInterval);
    startTime = Date.now();
    elapsedSeconds = 0;
    statTime.set('0:00');
    timerInterval = setInterval(() => {
      if (isGameOver) return;
      elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      statTime.set(formatTime(elapsedSeconds));
    }, 1000);
  }

  function loadPuzzle(puzzle) {
    currentPuzzle = puzzle;
    resetPuzzle();
  }

  function resetPuzzle() {
    isGameOver = false;
    errorCount = 0;
    history.length = 0;
    statErrors.set(0);
    startTimer();

    userGrid = [];
    for (let r = 0; r < currentPuzzle.height; r++) {
      userGrid.push(new Array(currentPuzzle.width).fill(CELL_EMPTY));
    }

    renderBoard();
  }

  function saveSnapshot() {
    history.push(userGrid.map((row) => [...row]));
  }

  function undo() {
    if (!history.length || isGameOver) return;
    userGrid = history.pop() || userGrid;
    renderBoard();
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    const { width, height, rowClues, colClues } = currentPuzzle;

    // Corner cell
    const corner = h('div', { class: 'nx-ng-corner' });

    // Top column clues
    const colCluesEl = h('div', { class: 'nx-ng-col-clues' });
    for (let c = 0; c < width; c++) {
      const clueItem = h('div', {
        class: `nx-ng-col-clue-item ${(c + 1) % 5 === 0 && c < width - 1 ? 'quad-right' : ''}`,
      });
      // Check if satisfied
      const userCol = [];
      for (let r = 0; r < height; r++) userCol.push(userGrid[r][c] === CELL_FILLED ? 1 : 0);
      const satisfied = arraysEqual(computeLineClues(userCol), colClues[c]);

      colClues[c].forEach((num) => {
        clueItem.append(h('span', { class: `nx-ng-clue ${satisfied ? 'satisfied' : ''}` }, String(num)));
      });
      colCluesEl.append(clueItem);
    }

    // Left row clues
    const rowCluesEl = h('div', { class: 'nx-ng-row-clues' });
    for (let r = 0; r < height; r++) {
      const clueItem = h('div', {
        class: `nx-ng-row-clue-item ${(r + 1) % 5 === 0 && r < height - 1 ? 'quad-bottom' : ''}`,
      });
      const userRow = userGrid[r].map((cell) => (cell === CELL_FILLED ? 1 : 0));
      const satisfied = arraysEqual(computeLineClues(userRow), rowClues[r]);

      rowClues[r].forEach((num) => {
        clueItem.append(h('span', { class: `nx-ng-clue ${satisfied ? 'satisfied' : ''}` }, String(num)));
      });
      rowCluesEl.append(clueItem);
    }

    // Grid Cells
    const gridEl = h('div', { class: 'nx-ng-grid' });
    gridEl.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${height}, 1fr)`;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const val = userGrid[r][c];
        const isQuadRight = (c + 1) % 5 === 0 && c < width - 1;
        const isQuadBottom = (r + 1) % 5 === 0 && r < height - 1;

        const cellEl = h('button', {
          type: 'button',
          class: `nx-ng-cell ${isQuadRight ? 'quad-right' : ''} ${isQuadBottom ? 'quad-bottom' : ''}`,
          'data-row': String(r),
          'data-col': String(c),
        });

        if (val === CELL_FILLED) {
          cellEl.classList.add('filled');
        } else if (val === CELL_CROSSED) {
          cellEl.classList.add('crossed');
          cellEl.textContent = '✕';
        }

        cellEl.onmousedown = (e) => {
          if (isGameOver) return;
          isMouseDown = true;
          if (e.button === 2) {
            applyCellAction(r, c, 'cross');
          } else {
            applyCellAction(r, c, activeTool);
          }
        };

        cellEl.onmouseenter = () => {
          if (isMouseDown && !isGameOver) {
            applyCellAction(r, c, activeTool);
          }
        };

        cellEl.oncontextmenu = (e) => e.preventDefault();
        gridEl.append(cellEl);
      }
    }

    // Compose Board grid
    boardEl.style.gridTemplateColumns = 'auto 1fr';
    boardEl.style.gridTemplateRows = 'auto 1fr';
    boardEl.append(corner, colCluesEl, rowCluesEl, gridEl);
  }

  function applyCellAction(r, c, tool) {
    const cur = userGrid[r][c];
    const next =
      tool === 'fill'
        ? cur === CELL_FILLED
          ? CELL_EMPTY
          : CELL_FILLED
        : cur === CELL_CROSSED
          ? CELL_EMPTY
          : CELL_CROSSED;

    // Penalty check
    if (penaltyEnabled && next === CELL_FILLED && currentPuzzle.solution[r][c] === 0) {
      errorCount++;
      statErrors.set(errorCount);
      startTime -= 20000; // Add 20s penalty
      audio.play('explosion');
      shell.toast(t('status.penaltyMsg'));
      userGrid[r][c] = CELL_CROSSED; // Auto-cross on mistake
      renderBoard();
      return;
    }

    saveSnapshot();
    userGrid[r][c] = next;
    audio.play('laser');
    renderBoard();
    checkWinCondition();
  }

  function checkWinCondition() {
    const { width, height, solution } = currentPuzzle;
    let won = true;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const isSolFilled = solution[r][c] === 1;
        const isUserFilled = userGrid[r][c] === CELL_FILLED;
        if (isSolFilled !== isUserFilled) {
          won = false;
          break;
        }
      }
      if (!won) break;
    }

    if (won) {
      isGameOver = true;
      clearInterval(timerInterval);
      audio.play('victory');
      shell.confetti();

      ctx.achievements?.unlock('nonogram_first_win');
      if (width >= 10 && errorCount === 0) ctx.achievements?.unlock('nonogram_flawless');
      if (width >= 15) ctx.achievements?.unlock('nonogram_expert');
      if (elapsedSeconds > 0 && elapsedSeconds < 120) ctx.achievements?.unlock('nonogram_speed');

      const score = Math.max(100, 5000 - elapsedSeconds * 10 - errorCount * 100);
      shell.finish({
        won: true,
        score,
        mode: currentPuzzle.id,
        time: elapsedSeconds,
        title: t('status.solved'),
        scoreText: `${formatTime(elapsedSeconds)} (${errorCount} ${t('hud.errors')})`,
        onRestart: () => resetPuzzle(),
      });
    }
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  shell.enablePause({
    canPause: () => !isGameOver,
    onRestart: () => resetPuzzle(),
  });

  resetPuzzle();

  return {
    unmount: () => {
      clearInterval(timerInterval);
      shell.dispose();
    },
  };
}
