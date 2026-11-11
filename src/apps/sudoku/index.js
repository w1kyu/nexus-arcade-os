// @ts-check
import { GameAudio, GameScoreService, createGameOverModal, createPauseModal } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { computeCandidates, findHint, generateSudoku, isValidPlacement } from './solver.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const root = h('div', { class: 'nx-sudoku-app' });
  const audio = new GameAudio({ output: ctx?.sound?.output?.('games') ?? null });
  const scores = new GameScoreService('nexus.sudoku', ctx);

  let currentDiff = 'medium';
  let notesMode = false;
  let mistakes = 0;
  const maxMistakes = 3;
  let selectedR = 0;
  let selectedC = 0;
  let secondsElapsed = 0;
  /** @type {number | null} */
  let timerId = null;
  let isPaused = false;
  let isGameOver = false;

  // Board state
  /** @type {number[][]} */
  let initialPuzzle = [];
  /** @type {number[][]} */
  let currentBoard = [];
  /** @type {number[][]} */
  let solution = [];
  /** @type {Set<number>[][]} */
  let userNotes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  /** @type {Array<{ board: number[][], notes: Set<number>[][] }>} */
  const moveHistory = [];

  // Toolbar & Diff buttons
  const toolbar = h('div', { class: 'nx-sudoku-toolbar' });
  const diffGroup = h('div', { class: 'nx-sudoku-diff-group' });
  /** @type {Record<string, HTMLButtonElement>} */
  const diffBtns = {};

  for (const diff of ['veryEasy', 'easy', 'medium', 'hard', 'expert', 'daily']) {
    const btn = /** @type {HTMLButtonElement} */ (
      h('button', { class: `nx-sudoku-btn ${diff === currentDiff ? 'active' : ''}` }, t(`difficulty.${diff}`))
    );
    btn.addEventListener('click', () => {
      currentDiff = diff;
      for (const [k, b] of Object.entries(diffBtns)) {
        b.classList.toggle('active', k === currentDiff);
      }
      startNewGame();
    });
    diffBtns[diff] = btn;
    diffGroup.append(btn);
  }
  toolbar.append(diffGroup);

  // Status display: Mistakes and Timer
  const statusEl = h('div', { class: 'nx-sudoku-status' });
  const mistakeEl = h('span', {}, t('status.mistakes', { count: mistakes, max: maxMistakes }));
  const timerEl = h('span', {}, '00:00');
  statusEl.append(mistakeEl, timerEl);

  // 9x9 Board
  const boardEl = h('div', { class: 'nx-sudoku-board' });

  // Action buttons
  const actionsEl = h('div', { class: 'nx-sudoku-actions' });
  const btnUndo = h('button', { class: 'nx-sudoku-btn' }, '↩ ' + t('actions.undo'));
  const btnErase = h('button', { class: 'nx-sudoku-btn' }, '⌫ ' + t('actions.erase'));
  const btnNotes = h('button', { class: 'nx-sudoku-btn' }, '✏️ ' + t('actions.notes'));
  const btnAutoNotes = h('button', { class: 'nx-sudoku-btn' }, '⚡ ' + t('actions.autoNotes'));
  const btnHint = h('button', { class: 'nx-sudoku-btn' }, '💡 ' + t('actions.hint'));

  btnUndo.addEventListener('click', () => undo());
  btnErase.addEventListener('click', () => eraseCell());
  btnNotes.addEventListener('click', () => {
    notesMode = !notesMode;
    btnNotes.classList.toggle('active', notesMode);
    audio.play('blip');
  });
  btnAutoNotes.addEventListener('click', () => autoNotes());
  btnHint.addEventListener('click', () => showHint());

  actionsEl.append(btnUndo, btnErase, btnNotes, btnAutoNotes, btnHint);

  // Keypad 1..9
  const keypadEl = h('div', { class: 'nx-sudoku-keypad' });
  for (let num = 1; num <= 9; num++) {
    const key = h('button', { class: 'nx-sudoku-key' }, String(num));
    key.addEventListener('click', () => handleNumberInput(num));
    keypadEl.append(key);
  }

  function startTimer() {
    stopTimer();
    secondsElapsed = 0;
    timerId = window.setInterval(() => {
      if (!isPaused && !isGameOver) {
        secondsElapsed++;
        const mins = Math.floor(secondsElapsed / 60);
        const secs = secondsElapsed % 60;
        timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startNewGame() {
    stopTimer();
    isGameOver = false;
    mistakes = 0;
    updateStatus();

    let rng = Math.random;
    if (currentDiff === 'daily') {
      // Seed based on current date YYYY-MM-DD
      const dateStr = new Date().toISOString().slice(0, 10);
      let seed = 0;
      for (let i = 0; i < dateStr.length; i++) seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
      rng = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    }

    const genDiff = currentDiff === 'daily' ? 'medium' : /** @type {any} */ (currentDiff);
    const gen = generateSudoku(genDiff, rng);
    initialPuzzle = gen.puzzle.map((row) => [...row]);
    currentBoard = gen.puzzle.map((row) => [...row]);
    solution = gen.solution;
    userNotes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    moveHistory.length = 0;

    selectedR = 0;
    selectedC = 0;

    startTimer();
    renderBoard();
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cellEl = h('div', {
          class: 'nx-sudoku-cell',
          'data-row': String(r),
          'data-col': String(c),
        });
        cellEl.addEventListener('click', () => {
          selectedR = r;
          selectedC = c;
          updateHighlights();
        });
        boardEl.append(cellEl);
      }
    }
    updateCellDisplays();
    updateHighlights();
  }

  function updateStatus() {
    mistakeEl.textContent = t('status.mistakes', { count: mistakes, max: maxMistakes });
  }

  function updateCellDisplays() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const idx = r * 9 + c;
        const cellEl = /** @type {HTMLElement} */ (boardEl.children[idx]);
        if (!cellEl) continue;

        cellEl.innerHTML = '';
        cellEl.className = 'nx-sudoku-cell';
        if (initialPuzzle[r][c] !== 0) {
          cellEl.classList.add('clue');
          cellEl.textContent = String(initialPuzzle[r][c]);
        } else if (currentBoard[r][c] !== 0) {
          const val = currentBoard[r][c];
          cellEl.textContent = String(val);
          // Check if conflicts with row, col, or box
          if (!isValidPlacement(currentBoard, r, c, val)) {
            cellEl.classList.add('conflict');
          }
        } else {
          // Render pencil notes
          const notes = userNotes[r][c];
          if (notes.size > 0) {
            const notesGrid = h('div', { class: 'nx-sudoku-notes' });
            for (let num = 1; num <= 9; num++) {
              const noteSpan = h(
                'span',
                { class: `nx-sudoku-note-num ${notes.has(num) ? 'active' : ''}` },
                notes.has(num) ? String(num) : '',
              );
              notesGrid.append(noteSpan);
            }
            cellEl.append(notesGrid);
          }
        }
      }
    }
  }

  function updateHighlights() {
    const activeVal = currentBoard[selectedR][selectedC];
    const sBoxR = Math.floor(selectedR / 3) * 3;
    const sBoxC = Math.floor(selectedC / 3) * 3;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const idx = r * 9 + c;
        const cellEl = /** @type {HTMLElement} */ (boardEl.children[idx]);
        if (!cellEl) continue;

        cellEl.classList.toggle('selected', r === selectedR && c === selectedC);
        const inSameBox = Math.floor(r / 3) * 3 === sBoxR && Math.floor(c / 3) * 3 === sBoxC;
        cellEl.classList.toggle(
          'peer',
          (r === selectedR || c === selectedC || inSameBox) && !(r === selectedR && c === selectedC),
        );
        cellEl.classList.toggle('same-num', activeVal !== 0 && currentBoard[r][c] === activeVal);

        // Highlight matching pencil marks
        const noteSpans = cellEl.querySelectorAll('.nx-sudoku-note-num');
        noteSpans.forEach((span, i) => {
          span.classList.toggle('highlight', activeVal !== 0 && i + 1 === activeVal);
        });
      }
    }
  }

  function saveHistory() {
    moveHistory.push({
      board: currentBoard.map((row) => [...row]),
      notes: userNotes.map((row) => row.map((s) => new Set(s))),
    });
  }

  function undo() {
    if (moveHistory.length === 0 || isGameOver) return;
    const prev = moveHistory.pop();
    if (!prev) return;
    currentBoard = prev.board;
    userNotes = prev.notes;
    audio.play('blip');
    updateCellDisplays();
    updateHighlights();
  }

  function eraseCell() {
    if (initialPuzzle[selectedR][selectedC] !== 0 || isGameOver) return;
    saveHistory();
    currentBoard[selectedR][selectedC] = 0;
    userNotes[selectedR][selectedC].clear();
    audio.play('hit');
    updateCellDisplays();
    updateHighlights();
  }

  /**
   * @param {number} num
   */
  function handleNumberInput(num) {
    if (initialPuzzle[selectedR][selectedC] !== 0 || isGameOver) return;
    saveHistory();

    if (notesMode) {
      // Toggle note candidate
      const set = userNotes[selectedR][selectedC];
      if (set.has(num)) set.delete(num);
      else set.add(num);
      audio.play('blip');
    } else {
      currentBoard[selectedR][selectedC] = num;
      // Check correctness
      if (solution[selectedR][selectedC] !== num) {
        mistakes++;
        updateStatus();
        audio.play('hit');
        if (mistakes >= maxMistakes) {
          triggerGameOver(false);
          return;
        }
      } else {
        audio.play('coin');
        // Clear this note from peers
        clearPeerNotes(selectedR, selectedC, num);
      }
    }

    updateCellDisplays();
    updateHighlights();
    checkWin();
  }

  function clearPeerNotes(r, c, num) {
    for (let i = 0; i < 9; i++) {
      userNotes[r][i].delete(num);
      userNotes[i][c].delete(num);
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        userNotes[br + dr][bc + dc].delete(num);
      }
    }
  }

  function autoNotes() {
    if (isGameOver) return;
    saveHistory();
    const cands = computeCandidates(currentBoard);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard[r][c] === 0) {
          userNotes[r][c] = cands[r][c];
        }
      }
    }
    audio.play('powerup');
    updateCellDisplays();
    updateHighlights();
  }

  function showHint() {
    if (isGameOver) return;
    const hint = findHint(currentBoard, solution);
    if (!hint) return;

    selectedR = hint.r;
    selectedC = hint.c;
    updateHighlights();

    const overlay = h('div', { class: 'nx-game-modal-overlay' });
    const modal = h('div', { class: 'nx-sudoku-hint-dialog' });

    const title = h('div', { class: 'nx-sudoku-hint-tech' }, '💡 ' + hint.technique);
    const desc = h('div', { class: 'nx-sudoku-hint-desc' }, hint.explanation);
    const btnApply = h('button', { class: 'nx-sudoku-btn active' }, t('actions.applyHint'));

    btnApply.addEventListener('click', () => {
      overlay.remove();
      handleNumberInput(hint.value);
    });

    modal.append(title, desc, btnApply);
    overlay.append(modal);
    root.append(overlay);
    audio.play('powerup');
  }

  function checkWin() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard[r][c] === 0 || currentBoard[r][c] !== solution[r][c]) {
          return;
        }
      }
    }
    triggerGameOver(true);
  }

  function triggerGameOver(won) {
    isGameOver = true;
    stopTimer();

    if (won) {
      audio.play('victory');
      const finalScore = Math.max(10, 2000 - secondsElapsed * 2);
      scores.submitScore(finalScore, currentDiff, { details: { time: secondsElapsed } }).then((res) => {
        const modal = createGameOverModal({
          score: secondsElapsed,
          isNewHigh: res.isNewHigh,
          rank: res.rank,
          xpEarned: currentDiff === 'expert' ? 50 : 25,
          onRestart: () => startNewGame(),
        });
        const label = modal.querySelector('.nx-game-score-label');
        if (label) label.textContent = 'TIME (SECONDS)';
        root.append(modal);
      });

      if (ctx?.achievements?.unlock) {
        ctx.achievements.unlock('sudoku_complete');
        if (currentDiff === 'expert') ctx.achievements.unlock('sudoku_expert');
        if (currentDiff === 'daily') ctx.achievements.unlock('sudoku_daily');
      }
    } else {
      audio.play('gameover');
      const modal = createGameOverModal({
        score: 0,
        onRestart: () => startNewGame(),
      });
      root.append(modal);
    }
  }

  // Keyboard controls
  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    if (isGameOver) return;
    if (e.key >= '1' && e.key <= '9') {
      handleNumberInput(parseInt(e.key, 10));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      eraseCell();
    } else if (e.key === 'ArrowUp' || e.key === 'KeyW') {
      selectedR = (selectedR + 8) % 9;
      updateHighlights();
    } else if (e.key === 'ArrowDown' || e.key === 'KeyS') {
      selectedR = (selectedR + 1) % 9;
      updateHighlights();
    } else if (e.key === 'ArrowLeft' || e.key === 'KeyA') {
      selectedC = (selectedC + 8) % 9;
      updateHighlights();
    } else if (e.key === 'ArrowRight' || e.key === 'KeyD') {
      selectedC = (selectedC + 1) % 9;
      updateHighlights();
    } else if (e.key === 'KeyN') {
      notesMode = !notesMode;
      btnNotes.classList.toggle('active', notesMode);
    } else if (e.key === 'KeyH') {
      showHint();
    } else if (e.key === 'Escape') {
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
          title: 'SUDOKU PAUSED',
        });
        root.append(modal);
      }
    }
  };
  window.addEventListener('keydown', onKeyDown);

  root.append(toolbar, statusEl, boardEl, actionsEl, keypadEl);
  container.append(root);
  startNewGame();

  return () => {
    stopTimer();
    window.removeEventListener('keydown', onKeyDown);
  };
}

export const terminal = {
  sudoku: async (/** @type {import('../../kernel/types').AppContext} */ ctx, /** @type {any} */ io) => {
    io.println('Launching Sudoku...');
    if (ctx.commands) {
      await ctx.commands.execute('sudoku.open');
    }
    return 0;
  },
};
