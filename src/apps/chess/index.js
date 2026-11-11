// @ts-check
import { createGameShell, gsButton, gsSelect, gsToggleGroup, readLobbyArgs } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import {
  BISHOP,
  BLACK,
  Game,
  KING,
  KNIGHT,
  PAWN,
  Position,
  QUEEN,
  ROOK,
  START_FEN,
  WHITE,
  colorOf,
  fileOf,
  moveToUci,
  rankOf,
  typeOf,
} from './engine.js';
import { CHESS_PUZZLES } from './puzzles.js';
import { LEVELS, search } from './search.js';
import './styles.css';

const APP_ID = 'nexus.chess';

export const commands = {
  'chess.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  chess: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

const PIECE_SYMBOLS = {
  [WHITE]: {
    [PAWN]: '♙',
    [KNIGHT]: '♘',
    [BISHOP]: '♗',
    [ROOK]: '♖',
    [QUEEN]: '♕',
    [KING]: '♔',
  },
  [BLACK]: {
    [PAWN]: '♟',
    [KNIGHT]: '♞',
    [BISHOP]: '♝',
    [ROOK]: '♜',
    [QUEEN]: '♛',
    [KING]: '♚',
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx, args) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-chess' });
  const { t, root, audio } = shell;
  await shell.load();
  const lobby = readLobbyArgs(args);

  /** @type {'ai' | 'local' | 'puzzle'} */
  let mode = lobby.local ? 'local' : 'ai';
  let difficulty = 3;
  let flipped = false;
  let game = new Game();
  let selectedSq = -1;
  /** @type {import('./engine.js').Move[]} */
  let legalTargets = [];
  let viewPly = -1; // -1 means live game position
  let thinking = false;
  let solvedPuzzles = new Set();
  let currentPuzzleIndex = 0;
  let puzzleStep = 0;

  /** @type {Worker | null} */
  let worker = null;
  try {
    if (typeof Worker !== 'undefined') {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        if (!thinking) return;
        thinking = false;
        const { result, ok } = e.data;
        if (ok && result?.move) {
          applyMove(result.move);
        } else {
          fallbackAiMove();
        }
      };
      shell.onDispose(() => worker?.terminate());
    }
  } catch {
    worker = null;
  }

  // UI Structure
  const topBar = h('div', { class: 'nx-gs-bar' });
  const statusEl = h('div', { class: 'nx-gs-status', role: 'status', 'data-testid': 'chess-status' });
  const layout = h('div', { class: 'nx-chess-layout' });
  const boardWrap = h('div', { class: 'nx-chess-board-wrap' });
  const boardEl = h('div', { class: 'nx-chess-board', 'data-testid': 'chess-board' });
  const panelEl = h('div', { class: 'nx-chess-panel' });
  const historyTitle = h('div', { class: 'nx-chess-panel-header' }, t('history.title'));
  const historyList = h('div', { class: 'nx-chess-history', 'data-testid': 'chess-history' });
  panelEl.append(historyTitle, historyList);

  boardWrap.append(statusEl, boardEl);
  layout.append(boardWrap, panelEl);

  // Controls in top bar
  const modeGroup = gsToggleGroup(
    [
      { value: 'ai', label: t('mode.ai') },
      { value: 'local', label: t('mode.local') },
      { value: 'puzzle', label: t('mode.puzzle') },
    ],
    mode,
    (v) => {
      mode = /** @type {any} */ (v);
      diffSelect.hidden = mode !== 'ai';
      puzzleSelect.hidden = mode !== 'puzzle';
      newGame();
    },
    'chess-mode',
  );

  const diffSelect = gsSelect(
    [1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: t(`difficulty.${d}`) })),
    String(difficulty),
    (v) => {
      difficulty = Number(v);
      newGame();
    },
    { 'data-testid': 'chess-difficulty', 'aria-label': t('difficulty.label') },
  );

  const puzzleSelect = gsSelect(
    CHESS_PUZZLES.map((p, idx) => ({ value: String(idx), label: p.title[ctx.i18n.locale] ?? p.title.en })),
    '0',
    (v) => {
      currentPuzzleIndex = Number(v);
      loadPuzzle(currentPuzzleIndex);
    },
    { 'data-testid': 'chess-puzzle-select', 'aria-label': t('puzzle.label') },
  );
  puzzleSelect.hidden = mode !== 'puzzle';

  const btnNew = gsButton(t('actions.newGame'), () => newGame(), { 'data-testid': 'chess-new' });
  const btnFlip = gsButton(t('actions.flip'), () => flipBoard(), { 'data-testid': 'chess-flip' });
  const btnUndo = gsButton(t('actions.undo'), () => undoMove(), { 'data-testid': 'chess-undo' });
  const btnImport = gsButton(t('actions.importPgn'), () => showImportPgnDialog(), { 'data-testid': 'chess-import' });
  const btnExport = gsButton(t('actions.exportPgn'), () => showExportPgnDialog(), { 'data-testid': 'chess-export' });

  topBar.append(modeGroup.el, diffSelect, puzzleSelect, btnNew, btnFlip, btnUndo, btnImport, btnExport);

  // 64 board square buttons
  /** @type {HTMLButtonElement[]} */
  const squares = [];
  for (let i = 0; i < 64; i++) {
    const btn = /** @type {HTMLButtonElement} */ (
      h('button', {
        type: 'button',
        class: 'nx-chess-sq',
        'data-index': String(i),
      })
    );
    btn.addEventListener('click', () => onSquareClick(getSquareByIndex(i)));
    btn.addEventListener('dragover', (e) => e.preventDefault());
    btn.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromStr = e.dataTransfer?.getData('text/plain');
      if (fromStr) {
        const from = Number(fromStr);
        const to = getSquareByIndex(i);
        handleMoveAttempt(from, to);
      }
    });
    squares.push(btn);
    boardEl.append(btn);
  }

  function getSquareByIndex(index) {
    const r = Math.floor(index / 8);
    const f = index % 8;
    const rank = flipped ? r : 7 - r;
    const file = flipped ? 7 - f : f;
    return rank * 16 + file;
  }

  function flipBoard() {
    flipped = !flipped;
    renderBoard();
  }

  function newGame() {
    thinking = false;
    selectedSq = -1;
    legalTargets = [];
    viewPly = -1;
    if (mode === 'puzzle') {
      loadPuzzle(currentPuzzleIndex);
      return;
    }
    game = new Game(START_FEN);
    renderBoard();
    updateStatus();
    updateHistory();
  }

  function loadPuzzle(index) {
    const p = CHESS_PUZZLES[index];
    if (!p) return;
    puzzleStep = 0;
    game = new Game(p.fen);
    viewPly = -1;
    selectedSq = -1;
    legalTargets = [];
    renderBoard();
    updateStatus();
    updateHistory();
    shell.toast(p.hint[ctx.i18n.locale] ?? p.hint.en);
  }

  function undoMove() {
    if (thinking || viewPly !== -1) return;
    if (mode === 'ai') {
      // Undo both AI and human moves
      game.undo();
      game.undo();
    } else {
      game.undo();
    }
    selectedSq = -1;
    legalTargets = [];
    renderBoard();
    updateStatus();
    updateHistory();
  }

  function currentPosition() {
    if (viewPly === -1 || viewPly >= game.moves.length) return game.pos;
    return new Position(game.fenAt(viewPly));
  }

  function renderBoard() {
    const pos = currentPosition();
    const lastMove = game.moves[game.moves.length - 1]?.move;
    const inCheckSq = pos.inCheck() ? pos.kings[pos.turn] : -1;

    for (let i = 0; i < 64; i++) {
      const sq = getSquareByIndex(i);
      const btn = squares[i];
      const rank = rankOf(sq);
      const file = fileOf(sq);
      const isLight = (rank + file) % 2 === 1;

      btn.className = `nx-chess-sq ${isLight ? 'light' : 'dark'}`;
      btn.innerHTML = '';
      btn.removeAttribute('draggable');

      if (sq === selectedSq) btn.classList.add('selected');
      if (lastMove && (sq === lastMove.from || sq === lastMove.to)) btn.classList.add('last-move');
      if (sq === inCheckSq) btn.classList.add('in-check');

      const isTarget = legalTargets.some((m) => m.to === sq);
      if (isTarget) {
        btn.classList.add('target');
        if (pos.board[sq] !== 0) btn.classList.add('has-piece');
      }

      const piece = pos.board[sq];
      if (piece !== 0) {
        const color = colorOf(piece);
        const type = typeOf(piece);
        const pieceEl = h(
          'span',
          { class: `nx-chess-piece ${color === WHITE ? 'white' : 'black'}` },
          PIECE_SYMBOLS[color][type],
        );
        btn.append(pieceEl);

        // Make draggable if it's the live turn and not thinking
        if (viewPly === -1 && !thinking && color === pos.turn) {
          btn.draggable = true;
          btn.ondragstart = (e) => {
            selectedSq = sq;
            legalTargets = pos.legalMoves().filter((m) => m.from === sq);
            e.dataTransfer?.setData('text/plain', String(sq));
            renderBoard();
          };
        }
      }
    }
  }

  function onSquareClick(sq) {
    if (thinking) return;
    if (viewPly !== -1) {
      viewPly = -1;
      renderBoard();
      updateStatus();
      return;
    }

    const pos = game.pos;
    if (selectedSq !== -1) {
      const targetMove = legalTargets.find((m) => m.to === sq);
      if (targetMove) {
        handleMoveAttempt(selectedSq, sq);
        return;
      }
    }

    // Select piece
    const piece = pos.board[sq];
    if (piece !== 0 && colorOf(piece) === pos.turn) {
      selectedSq = sq;
      legalTargets = pos.legalMoves().filter((m) => m.from === sq);
    } else {
      selectedSq = -1;
      legalTargets = [];
    }
    renderBoard();
  }

  function handleMoveAttempt(from, to) {
    const pos = game.pos;
    const moves = pos.legalMoves().filter((m) => m.from === from && m.to === to);
    if (!moves.length) {
      selectedSq = -1;
      legalTargets = [];
      renderBoard();
      return;
    }

    if (moves.some((m) => m.promo)) {
      showPromotionDialog((promoType) => {
        const m = moves.find((x) => x.promo === promoType) || moves[0];
        applyMove(m);
      });
      return;
    }

    applyMove(moves[0]);
  }

  function showPromotionDialog(onSelect) {
    const color = game.pos.turn;
    const pieces = [QUEEN, ROOK, BISHOP, KNIGHT];
    const buttons = pieces.map((type) => {
      const btn = h('button', { type: 'button', class: 'nx-chess-promo-btn' }, PIECE_SYMBOLS[color][type]);
      btn.addEventListener('click', () => {
        close();
        onSelect(type);
      });
      return btn;
    });

    const body = [h('div', { class: 'nx-chess-promo-dialog' }, ...buttons)];
    const { close } = shell.dialog(t('promotion.title'), body, []);
  }

  function applyMove(move) {
    selectedSq = -1;
    legalTargets = [];
    audio.play(move.captured ? 'explosion' : 'laser');

    if (mode === 'puzzle') {
      const p = CHESS_PUZZLES[currentPuzzleIndex];
      const san = game.pos.san(move);
      const expected = p.moves[puzzleStep];

      if (san === expected || moveToUci(move) === expected) {
        game.play(move);
        puzzleStep++;
        renderBoard();
        updateStatus();
        updateHistory();

        if (puzzleStep >= p.moves.length) {
          audio.play('victory');
          shell.confetti();
          shell.toast(t('puzzle.solved'));
          solvedPuzzles.add(p.id);
          if (solvedPuzzles.size >= 5) {
            ctx.achievements?.unlock('chess_puzzle_master');
          }
          setTimeout(() => {
            currentPuzzleIndex = (currentPuzzleIndex + 1) % CHESS_PUZZLES.length;
            puzzleSelect.value = String(currentPuzzleIndex);
            loadPuzzle(currentPuzzleIndex);
          }, 1400);
        } else {
          // Play opponent response
          setTimeout(() => {
            const replySan = p.moves[puzzleStep];
            game.playText(replySan);
            puzzleStep++;
            renderBoard();
            updateStatus();
            updateHistory();
          }, 350);
        }
      } else {
        shell.toast(t('puzzle.wrong'));
        newGame();
      }
      return;
    }

    game.play(move);
    renderBoard();
    updateStatus();
    updateHistory();

    const status = game.status();
    if (status.state !== 'playing') {
      handleGameOver(status);
      return;
    }

    if (mode === 'ai' && game.pos.turn === BLACK) {
      thinking = true;
      updateStatus();
      if (worker) {
        worker.postMessage({ id: Date.now(), fen: game.pos.fen(), level: difficulty });
      } else {
        setTimeout(fallbackAiMove, 60);
      }
    }
  }

  function fallbackAiMove() {
    if (!thinking) return;
    thinking = false;
    const opts = LEVELS[difficulty] ?? LEVELS[3];
    const res = search(game.pos, opts);
    if (res.move) applyMove(res.move);
  }

  function handleGameOver(status) {
    if (status.state === 'checkmate') {
      const won = mode === 'ai' ? status.winner === WHITE : true;
      const winnerName = status.winner === WHITE ? t('turn.white') : t('turn.black');
      if (won && mode === 'ai') {
        ctx.achievements?.unlock('chess_first_win');
        if (difficulty >= 5) ctx.achievements?.unlock('chess_beat_master');
        if (game.moves.length <= 40) ctx.achievements?.unlock('chess_quick_mate');
      }
      shell.finish({
        won,
        score: won ? 1000 * difficulty : 200,
        mode: `chess-lvl-${difficulty}`,
        title: t('turn.checkmate', { winner: winnerName }),
        onRestart: () => newGame(),
      });
    } else {
      let reasonKey = 'stalemate';
      if (status.reason === 'repetition') reasonKey = 'drawRepetition';
      else if (status.reason === 'fifty') reasonKey = 'drawFifty';
      else if (status.reason === 'material') reasonKey = 'drawMaterial';

      shell.finish({
        won: false,
        draw: true,
        score: 300,
        mode: `chess-lvl-${difficulty}`,
        title: t(`turn.${reasonKey}`),
        onRestart: () => newGame(),
      });
    }
  }

  function updateStatus() {
    if (thinking) {
      statusEl.textContent = t('turn.aiThinking');
      return;
    }
    const pos = currentPosition();
    const status = game.status();
    if (status.state === 'checkmate') {
      const winKey = status.winner === WHITE ? 'turn.white' : 'turn.black';
      statusEl.textContent = t('turn.checkmate', { winner: t(winKey) });
    } else if (status.state === 'stalemate') {
      statusEl.textContent = t('turn.stalemate');
    } else if (status.state === 'draw') {
      statusEl.textContent = t(
        `turn.draw${status.reason ? status.reason.charAt(0).toUpperCase() + status.reason.slice(1) : ''}`,
      );
    } else if (pos.inCheck()) {
      statusEl.textContent = `${pos.turn === WHITE ? t('turn.white') : t('turn.black')} (${t('turn.check')})`;
    } else {
      statusEl.textContent = pos.turn === WHITE ? t('turn.white') : t('turn.black');
    }
  }

  function updateHistory() {
    historyList.innerHTML = '';
    const moves = game.moves;
    for (let i = 0; i < moves.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const row = h('div', { class: 'nx-chess-move-row' });
      row.append(h('span', { class: 'nx-chess-move-num' }, `${moveNum}.`));

      const btnW = h(
        'button',
        {
          type: 'button',
          class: `nx-chess-move-btn ${viewPly === i + 1 ? 'active' : ''}`,
          onclick: () => {
            viewPly = i + 1;
            renderBoard();
            updateStatus();
            updateHistory();
          },
        },
        moves[i].san,
      );
      row.append(btnW);

      if (i + 1 < moves.length) {
        const btnB = h(
          'button',
          {
            type: 'button',
            class: `nx-chess-move-btn ${viewPly === i + 2 ? 'active' : ''}`,
            onclick: () => {
              viewPly = i + 2;
              renderBoard();
              updateStatus();
              updateHistory();
            },
          },
          moves[i + 1].san,
        );
        row.append(btnB);
      }
      historyList.append(row);
    }
    historyList.scrollTop = historyList.scrollHeight;
  }

  function showExportPgnDialog() {
    let pgn = `[Event "Nexus Chess"]\n[Site "Nexus Arcade OS"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n[White "Player"]\n[Black "${mode === 'ai' ? 'Nexus AI' : 'Player 2'}"]\n`;
    if (game.startFen !== START_FEN) pgn += `[SetUp "1"]\n[FEN "${game.startFen}"]\n`;
    pgn += '\n';

    for (let i = 0; i < game.moves.length; i++) {
      if (i % 2 === 0) pgn += `${Math.floor(i / 2) + 1}. `;
      pgn += `${game.moves[i].san} `;
    }

    const textarea = h('textarea', { readonly: true }, pgn.trim());
    shell.dialog(
      t('actions.exportPgn'),
      [textarea],
      [
        {
          label: t('pgn.copyBtn'),
          primary: true,
          onClick: () => {
            if (ctx.clipboard?.writeText) ctx.clipboard.writeText(pgn.trim());
            shell.toast(t('pgn.copyBtn'));
          },
        },
        { label: shell.labels().close },
      ],
    );
  }

  function showImportPgnDialog() {
    const textarea = h('textarea', { placeholder: '1. e4 e5 2. Nf3 Nc6...' });
    shell.dialog(
      t('pgn.importTitle'),
      [h('p', {}, t('pgn.pastePrompt')), textarea],
      [
        {
          label: t('pgn.importBtn'),
          primary: true,
          onClick: () => {
            const raw = textarea.value.trim();
            if (!raw) return;
            try {
              const clean = raw
                .replace(/\[.*?\]/gs, '')
                .replace(/\{.*?\}/gs, '')
                .replace(/\d+\./g, '')
                .trim();
              const tokens = clean.split(/\s+/).filter(Boolean);
              const newG = new Game();
              for (const tk of tokens) {
                if (tk === '*' || tk === '1-0' || tk === '0-1' || tk === '1/2-1/2') break;
                if (!newG.playText(tk)) throw new Error(t('pgn.invalid'));
              }
              game = newG;
              renderBoard();
              updateStatus();
              updateHistory();
            } catch {
              shell.toast(t('pgn.invalid'));
              return false;
            }
          },
        },
        { label: shell.labels().close },
      ],
    );
  }

  shell.enablePause({
    canPause: () => !thinking,
    onRestart: () => newGame(),
  });

  root.append(topBar, layout);
  newGame();

  return {
    unmount: () => shell.dispose(),
  };
}
