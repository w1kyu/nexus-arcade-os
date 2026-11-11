// @ts-check
import { createGameShell, formatTime, gsButton, gsSelect, gsStat } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { RANK_NAMES, SUIT_COLORS, SUIT_SYMBOLS, cloneState } from './cards.js';
import {
  canFreeCellTableau,
  canKlondikeFoundation,
  canKlondikeTableau,
  canSpiderTableau,
  checkSpiderRun,
  createFreeCell,
  createKlondike,
  createSpider,
  maxFreeCellMove,
} from './games.js';
import './styles.css';

const APP_ID = 'nexus.solitaire';

export const commands = {
  'solitaire.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  solitaire: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-solitaire' });
  const { t, root, audio } = shell;
  await shell.load();

  /** @type {'klondike1' | 'klondike3' | 'freecell' | 'spider1' | 'spider2' | 'spider4'} */
  let currentMode = 'klondike1';
  let currentSeed = Math.floor(Math.random() * 1000000);
  /** @type {any} */
  let game = null;
  /** @type {any[]} */
  const history = [];
  let moves = 0;
  let startTime = 0;
  let elapsedSeconds = 0;
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timerInterval;

  /** @type {{ source: string, index: number, cardIdx?: number } | null} */
  let selected = null;

  // Header & Controls
  const topBar = h('div', { class: 'nx-gs-bar' });
  const statMoves = gsStat(t('hud.moves'), 'sol-moves');
  const statTime = gsStat(t('hud.time'), 'sol-time');

  const modeSelect = gsSelect(
    [
      { value: 'klondike1', label: t('mode.klondike1') },
      { value: 'klondike3', label: t('mode.klondike3') },
      { value: 'freecell', label: t('mode.freecell') },
      { value: 'spider1', label: t('mode.spider1') },
      { value: 'spider2', label: t('mode.spider2') },
      { value: 'spider4', label: t('mode.spider4') },
    ],
    currentMode,
    (v) => {
      currentMode = /** @type {any} */ (v);
      newDeal();
    },
    { 'data-testid': 'sol-mode-select', 'aria-label': t('mode.label') },
  );

  const btnNew = gsButton(t('actions.newGame'), () => newDeal(), { 'data-testid': 'sol-new' });
  const btnRestart = gsButton(t('actions.restart'), () => restartDeal(), { 'data-testid': 'sol-restart' });
  const btnUndo = gsButton(t('actions.undo'), () => undo(), { 'data-testid': 'sol-undo' });
  const btnAuto = gsButton(t('actions.autoComplete'), () => runAutoComplete(), {
    'data-testid': 'sol-auto',
    class: 'nx-sol-btn-auto',
  });
  btnAuto.hidden = true;

  const btnStats = gsButton(
    t('actions.stats'),
    () => {
      shell.statsDialog(
        [
          { mode: 'klondike1', label: t('mode.klondike1') },
          { mode: 'klondike3', label: t('mode.klondike3') },
          { mode: 'freecell', label: t('mode.freecell') },
          { mode: 'spider1', label: t('mode.spider1') },
          { mode: 'spider2', label: t('mode.spider2') },
          { mode: 'spider4', label: t('mode.spider4') },
        ],
        { time: true, moves: true },
      );
    },
    { 'data-testid': 'sol-stats' },
  );

  topBar.append(modeSelect, btnNew, btnRestart, btnUndo, btnAuto, btnStats, statMoves.el, statTime.el);

  // Table area
  const tableEl = h('div', { class: 'nx-sol-table', 'data-testid': 'sol-table' });
  root.append(topBar, tableEl);

  function startTimer() {
    clearInterval(timerInterval);
    startTime = Date.now();
    elapsedSeconds = 0;
    statTime.set('0:00');
    timerInterval = setInterval(() => {
      elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      statTime.set(formatTime(elapsedSeconds));
    }, 1000);
  }

  function saveSnapshot() {
    history.push({
      game: cloneState(game),
      moves,
    });
  }

  function undo() {
    if (!history.length) return;
    const snap = history.pop();
    game = snap.game;
    moves = snap.moves;
    statMoves.set(moves);
    selected = null;
    render();
  }

  function newDeal() {
    currentSeed = Math.floor(Math.random() * 1000000);
    restartDeal();
  }

  function restartDeal() {
    history.length = 0;
    moves = 0;
    selected = null;
    statMoves.set(0);
    startTimer();

    if (currentMode === 'klondike1') game = createKlondike(currentSeed, 1);
    else if (currentMode === 'klondike3') game = createKlondike(currentSeed, 3);
    else if (currentMode === 'freecell') game = createFreeCell(currentSeed);
    else if (currentMode === 'spider1') game = createSpider(currentSeed, 1);
    else if (currentMode === 'spider2') game = createSpider(currentSeed, 2);
    else if (currentMode === 'spider4') game = createSpider(currentSeed, 4);

    render();
  }

  function renderCard(card, isSelected = false) {
    if (!card.faceUp) {
      return h('div', { class: 'nx-card face-down', 'data-card-id': card.id });
    }
    const color = SUIT_COLORS[card.suit];
    const symbol = SUIT_SYMBOLS[card.suit];
    const rankName = RANK_NAMES[card.rank];

    const cardEl = h(
      'div',
      {
        class: `nx-card face-up ${color} ${isSelected ? 'selected' : ''}`,
        'data-card-id': card.id,
      },
      h('div', { class: 'nx-card-corner nx-card-top' }, h('span', {}, rankName), h('span', {}, symbol)),
      h('div', { class: 'nx-card-center' }, symbol),
      h('div', { class: 'nx-card-corner nx-card-bottom' }, h('span', {}, rankName), h('span', {}, symbol)),
    );
    return cardEl;
  }

  function render() {
    tableEl.innerHTML = '';
    if (!game) return;

    if (game.type === 'klondike') renderKlondike();
    else if (game.type === 'freecell') renderFreeCell();
    else if (game.type === 'spider') renderSpider();

    checkAutoCompleteAvailable();
    checkWinCondition();
  }

  // ── Klondike Renderer ───────────────────────────────────────────────────────
  function renderKlondike() {
    tableEl.style.setProperty('--cols', '7');
    const topRow = h('div', { class: 'nx-sol-top-row' });

    // Stock & Waste
    const stockArea = h('div', { class: 'nx-sol-area' });
    const stockSlot = h('div', { class: 'nx-sol-slot clickable', 'data-testid': 'sol-stock' });
    if (game.stock.length) {
      const topStock = renderCard(game.stock[game.stock.length - 1]);
      stockSlot.append(topStock);
    } else {
      stockSlot.append(h('span', { class: 'nx-sol-slot-icon' }, '↺'));
    }
    stockSlot.onclick = () => {
      saveSnapshot();
      moves++;
      statMoves.set(moves);
      if (!game.stock.length) {
        // Recycle waste to stock
        game.stock = game.waste.reverse().map((c) => ({ ...c, faceUp: false }));
        game.waste = [];
        audio.play('laser');
      } else {
        const count = Math.min(game.drawCount, game.stock.length);
        for (let i = 0; i < count; i++) {
          const c = game.stock.pop();
          c.faceUp = true;
          game.waste.push(c);
        }
        audio.play('laser');
      }
      render();
    };

    const wasteSlot = h('div', { class: 'nx-sol-slot', 'data-testid': 'sol-waste' });
    if (game.waste.length) {
      const topWaste = game.waste[game.waste.length - 1];
      const isSel = selected?.source === 'waste';
      const el = renderCard(topWaste, isSel);
      el.onclick = (e) => {
        e.stopPropagation();
        handleWasteClick();
      };
      wasteSlot.append(el);
    }
    stockArea.append(stockSlot, wasteSlot);

    // Foundations
    const foundArea = h('div', { class: 'nx-sol-area' });
    for (let f = 0; f < 4; f++) {
      const fSlot = h('div', { class: 'nx-sol-slot clickable', 'data-testid': `sol-found-${f}` });
      fSlot.onclick = () => handleFoundationTargetClick(f);
      const pile = game.foundations[f];
      if (pile.length) {
        const topF = pile[pile.length - 1];
        const isSel = selected?.source === 'foundation' && selected.index === f;
        const cardEl = renderCard(topF, isSel);
        cardEl.onclick = (e) => {
          e.stopPropagation();
          handleFoundationClick(f);
        };
        fSlot.append(cardEl);
      } else {
        fSlot.append(h('span', { class: 'nx-sol-slot-icon' }, '♠'));
      }
      foundArea.append(fSlot);
    }

    topRow.append(stockArea, foundArea);

    // Tableau
    const tableauEl = h('div', { class: 'nx-sol-tableau' });
    for (let col = 0; col < 7; col++) {
      const colEl = h('div', { class: 'nx-sol-col', 'data-col': String(col), 'data-testid': `sol-tab-${col}` });
      colEl.onclick = () => handleTableauColClick(col);
      const pile = game.tableau[col];

      pile.forEach((card, r) => {
        const isSel = selected?.source === 'tableau' && selected.index === col && r >= (selected.cardIdx ?? 0);
        const cardEl = renderCard(card, isSel);
        cardEl.style.top = `${r * (card.faceUp ? 26 : 14)}px`;
        cardEl.style.zIndex = String(r);

        if (card.faceUp) {
          cardEl.onclick = (e) => {
            e.stopPropagation();
            handleTableauCardClick(col, r);
          };
          cardEl.ondblclick = (e) => {
            e.stopPropagation();
            tryAutoMoveToFoundation(card, col, r);
          };
        }
        colEl.append(cardEl);
      });
      tableauEl.append(colEl);
    }

    tableEl.append(topRow, tableauEl);
  }

  // ── FreeCell Renderer ──────────────────────────────────────────────────────
  function renderFreeCell() {
    tableEl.style.setProperty('--cols', '8');
    const topRow = h('div', { class: 'nx-sol-top-row' });

    // 4 Freecells
    const fcArea = h('div', { class: 'nx-sol-area' });
    for (let i = 0; i < 4; i++) {
      const slot = h('div', { class: 'nx-sol-slot clickable', 'data-testid': `sol-fc-${i}` });
      slot.onclick = () => handleFreeCellTargetClick(i);
      const card = game.freecells[i];
      if (card) {
        const isSel = selected?.source === 'freecell' && selected.index === i;
        const el = renderCard(card, isSel);
        el.onclick = (e) => {
          e.stopPropagation();
          handleFreeCellClick(i);
        };
        el.ondblclick = (e) => {
          e.stopPropagation();
          tryAutoMoveFreeCellToFoundation(i);
        };
        slot.append(el);
      }
      fcArea.append(slot);
    }

    // 4 Foundations
    const foundArea = h('div', { class: 'nx-sol-area' });
    for (let f = 0; f < 4; f++) {
      const slot = h('div', { class: 'nx-sol-slot clickable', 'data-testid': `sol-found-${f}` });
      slot.onclick = () => handleFoundationTargetClick(f);
      const pile = game.foundations[f];
      if (pile.length) {
        const top = pile[pile.length - 1];
        slot.append(renderCard(top));
      } else {
        slot.append(h('span', { class: 'nx-sol-slot-icon' }, '▲'));
      }
      foundArea.append(slot);
    }
    topRow.append(fcArea, foundArea);

    // 8 Tableau Cascades
    const tableauEl = h('div', { class: 'nx-sol-tableau' });
    for (let col = 0; col < 8; col++) {
      const colEl = h('div', { class: 'nx-sol-col', 'data-col': String(col), 'data-testid': `sol-tab-${col}` });
      colEl.onclick = () => handleFreeCellTableauColClick(col);
      const pile = game.tableau[col];

      pile.forEach((card, r) => {
        const isSel = selected?.source === 'tableau' && selected.index === col && r >= (selected.cardIdx ?? 0);
        const cardEl = renderCard(card, isSel);
        cardEl.style.top = `${r * 28}px`;
        cardEl.style.zIndex = String(r);

        cardEl.onclick = (e) => {
          e.stopPropagation();
          handleFreeCellTableauCardClick(col, r);
        };
        cardEl.ondblclick = (e) => {
          e.stopPropagation();
          if (r === pile.length - 1) tryAutoMoveToFoundation(card, col, r);
        };
        colEl.append(cardEl);
      });
      tableauEl.append(colEl);
    }

    tableEl.append(topRow, tableauEl);
  }

  // ── Spider Renderer ────────────────────────────────────────────────────────
  function renderSpider() {
    tableEl.style.setProperty('--cols', '10');
    const topRow = h('div', { class: 'nx-sol-top-row' });

    // Stock & Completed Sets
    const stockArea = h('div', { class: 'nx-sol-area' });
    const stockSlot = h('div', { class: 'nx-sol-slot clickable', 'data-testid': 'sol-stock' });
    if (game.stock.length) {
      stockSlot.append(renderCard({ id: 'spider-stock', suit: 'spades', rank: 1, faceUp: false }));
    } else {
      stockSlot.append(h('span', { class: 'nx-sol-slot-icon' }, '✓'));
    }
    stockSlot.onclick = () => {
      if (!game.stock.length) return;
      // In Spider, deal 1 card to each of the 10 tableau columns
      saveSnapshot();
      moves++;
      statMoves.set(moves);
      const pack = game.stock.pop();
      for (let c = 0; c < 10; c++) {
        game.tableau[c].push(pack[c]);
        checkSpiderRun(game.tableau[c]);
      }
      audio.play('laser');
      render();
    };

    const setsSlot = h(
      'div',
      { class: 'nx-sol-slot' },
      h('span', { class: 'nx-sol-slot-icon' }, `★ ${game.completedSuits}/8`),
    );
    stockArea.append(stockSlot, setsSlot);
    topRow.append(stockArea);

    // 10 Tableau Columns
    const tableauEl = h('div', { class: 'nx-sol-tableau' });
    for (let col = 0; col < 10; col++) {
      const colEl = h('div', { class: 'nx-sol-col', 'data-col': String(col), 'data-testid': `sol-tab-${col}` });
      colEl.onclick = () => handleSpiderColClick(col);
      const pile = game.tableau[col];

      pile.forEach((card, r) => {
        const isSel = selected?.source === 'tableau' && selected.index === col && r >= (selected.cardIdx ?? 0);
        const cardEl = renderCard(card, isSel);
        cardEl.style.top = `${r * (card.faceUp ? 24 : 12)}px`;
        cardEl.style.zIndex = String(r);

        if (card.faceUp) {
          cardEl.onclick = (e) => {
            e.stopPropagation();
            handleSpiderCardClick(col, r);
          };
        }
        colEl.append(cardEl);
      });
      tableauEl.append(colEl);
    }

    tableEl.append(topRow, tableauEl);
  }

  // ── Move Handlers: Klondike ────────────────────────────────────────────────
  function handleWasteClick() {
    if (!game.waste.length) return;
    if (selected?.source === 'waste') selected = null;
    else selected = { source: 'waste', index: 0 };
    render();
  }

  function handleFoundationClick(f) {
    if (!game.foundations[f].length) return;
    if (selected?.source === 'foundation' && selected.index === f) selected = null;
    else selected = { source: 'foundation', index: f };
    render();
  }

  function handleFoundationTargetClick(f) {
    if (!selected) return;
    const foundation = game.foundations[f];
    let cardToMove;

    if (selected.source === 'waste') {
      cardToMove = game.waste[game.waste.length - 1];
      if (canKlondikeFoundation(cardToMove, foundation)) {
        saveSnapshot();
        moves++;
        statMoves.set(moves);
        game.foundations[f].push(game.waste.pop());
        audio.play('laser');
      }
    } else if (selected.source === 'freecell') {
      cardToMove = game.freecells[selected.index];
      if (cardToMove && canKlondikeFoundation(cardToMove, foundation)) {
        saveSnapshot();
        moves++;
        statMoves.set(moves);
        game.foundations[f].push(cardToMove);
        game.freecells[selected.index] = null;
        audio.play('laser');
      }
    } else if (selected.source === 'tableau') {
      const col = game.tableau[selected.index];
      if (selected.cardIdx === col.length - 1) {
        cardToMove = col[col.length - 1];
        if (canKlondikeFoundation(cardToMove, foundation)) {
          saveSnapshot();
          moves++;
          statMoves.set(moves);
          game.foundations[f].push(col.pop());
          if (col.length && !col[col.length - 1].faceUp) {
            col[col.length - 1].faceUp = true;
          }
          audio.play('laser');
        }
      }
    }
    selected = null;
    render();
  }

  function handleTableauCardClick(colIdx, cardIdx) {
    if (selected) {
      handleTableauColClick(colIdx);
      return;
    }
    selected = { source: 'tableau', index: colIdx, cardIdx };
    render();
  }

  function handleTableauColClick(targetCol) {
    if (!selected) return;
    const destCol = game.tableau[targetCol];

    if (selected.source === 'waste') {
      const card = game.waste[game.waste.length - 1];
      if (canKlondikeTableau(card, destCol)) {
        saveSnapshot();
        moves++;
        statMoves.set(moves);
        destCol.push(game.waste.pop());
        audio.play('laser');
      }
    } else if (selected.source === 'foundation') {
      const fPile = game.foundations[selected.index];
      const card = fPile[fPile.length - 1];
      if (canKlondikeTableau(card, destCol)) {
        saveSnapshot();
        moves++;
        statMoves.set(moves);
        destCol.push(fPile.pop());
        audio.play('laser');
      }
    } else if (selected.source === 'tableau' && selected.index !== targetCol) {
      const srcCol = game.tableau[selected.index];
      const movingStack = srcCol.slice(selected.cardIdx);
      if (canKlondikeTableau(movingStack[0], destCol)) {
        saveSnapshot();
        moves++;
        statMoves.set(moves);
        srcCol.splice(selected.cardIdx);
        destCol.push(...movingStack);
        if (srcCol.length && !srcCol[srcCol.length - 1].faceUp) {
          srcCol[srcCol.length - 1].faceUp = true;
        }
        audio.play('laser');
      }
    }
    selected = null;
    render();
  }

  function tryAutoMoveToFoundation(card, colIdx, rIdx) {
    const col = game.tableau[colIdx];
    if (rIdx !== col.length - 1) return;
    for (let f = 0; f < 4; f++) {
      if (canKlondikeFoundation(card, game.foundations[f])) {
        saveSnapshot();
        moves++;
        statMoves.set(moves);
        game.foundations[f].push(col.pop());
        if (col.length && !col[col.length - 1].faceUp) col[col.length - 1].faceUp = true;
        audio.play('laser');
        selected = null;
        render();
        return;
      }
    }
  }

  // ── Move Handlers: FreeCell ────────────────────────────────────────────────
  function handleFreeCellClick(fcIdx) {
    if (!game.freecells[fcIdx]) return;
    if (selected?.source === 'freecell' && selected.index === fcIdx) selected = null;
    else selected = { source: 'freecell', index: fcIdx };
    render();
  }

  function handleFreeCellTargetClick(fcIdx) {
    if (!selected) return;
    if (game.freecells[fcIdx]) return; // Occupied

    let card;
    if (selected.source === 'freecell') {
      card = game.freecells[selected.index];
      saveSnapshot();
      moves++;
      statMoves.set(moves);
      game.freecells[fcIdx] = card;
      game.freecells[selected.index] = null;
      audio.play('laser');
    } else if (selected.source === 'tableau') {
      const col = game.tableau[selected.index];
      if (selected.cardIdx === col.length - 1) {
        card = col.pop();
        saveSnapshot();
        moves++;
        statMoves.set(moves);
        game.freecells[fcIdx] = card;
        audio.play('laser');
      }
    }
    selected = null;
    render();
  }

  function handleFreeCellTableauCardClick(colIdx, cardIdx) {
    if (selected) {
      handleFreeCellTableauColClick(colIdx);
      return;
    }
    selected = { source: 'tableau', index: colIdx, cardIdx };
    render();
  }

  function handleFreeCellTableauColClick(targetCol) {
    if (!selected) return;
    const destCol = game.tableau[targetCol];

    if (selected.source === 'freecell') {
      const card = game.freecells[selected.index];
      if (card && canFreeCellTableau(card, destCol)) {
        saveSnapshot();
        moves++;
        statMoves.set(moves);
        destCol.push(card);
        game.freecells[selected.index] = null;
        audio.play('laser');
      }
    } else if (selected.source === 'tableau' && selected.index !== targetCol) {
      const srcCol = game.tableau[selected.index];
      const movingStack = srcCol.slice(selected.cardIdx);
      const emptyCells = game.freecells.filter((c) => c === null).length;
      const emptyCols = game.tableau.filter((c) => c.length === 0).length;
      const maxMove = maxFreeCellMove(emptyCells, emptyCols, destCol.length === 0);

      if (movingStack.length <= maxMove && canFreeCellTableau(movingStack[0], destCol)) {
        saveSnapshot();
        moves++;
        statMoves.set(moves);
        srcCol.splice(selected.cardIdx);
        destCol.push(...movingStack);
        audio.play('laser');
      }
    }
    selected = null;
    render();
  }

  function tryAutoMoveFreeCellToFoundation(fcIdx) {
    const card = game.freecells[fcIdx];
    if (!card) return;
    for (let f = 0; f < 4; f++) {
      if (canKlondikeFoundation(card, game.foundations[f])) {
        saveSnapshot();
        moves++;
        statMoves.set(moves);
        game.foundations[f].push(card);
        game.freecells[fcIdx] = null;
        audio.play('laser');
        selected = null;
        render();
        return;
      }
    }
  }

  // ── Move Handlers: Spider ──────────────────────────────────────────────────
  function handleSpiderCardClick(colIdx, cardIdx) {
    if (selected) {
      handleSpiderColClick(colIdx);
      return;
    }
    const col = game.tableau[colIdx];
    const stack = col.slice(cardIdx);
    // Verify stack is descending of same suit
    let valid = true;
    for (let i = 0; i < stack.length - 1; i++) {
      if (stack[i].suit !== stack[i + 1].suit || stack[i].rank !== stack[i + 1].rank + 1) {
        valid = false;
        break;
      }
    }
    if (valid) {
      selected = { source: 'tableau', index: colIdx, cardIdx };
      render();
    }
  }

  function handleSpiderColClick(targetCol) {
    if (!selected) return;
    if (selected.index === targetCol) {
      selected = null;
      render();
      return;
    }
    const srcCol = game.tableau[selected.index];
    const destCol = game.tableau[targetCol];
    const stack = srcCol.slice(selected.cardIdx);

    if (canSpiderTableau(stack, destCol)) {
      saveSnapshot();
      moves++;
      statMoves.set(moves);
      srcCol.splice(selected.cardIdx);
      destCol.push(...stack);
      if (srcCol.length && !srcCol[srcCol.length - 1].faceUp) {
        srcCol[srcCol.length - 1].faceUp = true;
      }
      if (checkSpiderRun(destCol)) {
        game.completedSuits++;
        audio.play('victory');
      } else {
        audio.play('laser');
      }
    }
    selected = null;
    render();
  }

  // ── Auto-Complete & Win Check ──────────────────────────────────────────────
  function checkAutoCompleteAvailable() {
    if (game.type !== 'klondike') {
      btnAuto.hidden = true;
      return;
    }
    // Available if stock and waste are empty, and all tableau cards are face-up
    const stockEmpty = game.stock.length === 0 && game.waste.length === 0;
    const allTableauFaceUp = game.tableau.every((col) => col.every((c) => c.faceUp));
    btnAuto.hidden = !(stockEmpty && allTableauFaceUp && game.tableau.some((c) => c.length > 0));
  }

  function runAutoComplete() {
    if (game.type !== 'klondike') return;
    let madeMove = false;
    for (let col = 0; col < 7; col++) {
      const pile = game.tableau[col];
      if (!pile.length) continue;
      const top = pile[pile.length - 1];
      for (let f = 0; f < 4; f++) {
        if (canKlondikeFoundation(top, game.foundations[f])) {
          game.foundations[f].push(pile.pop());
          madeMove = true;
          break;
        }
      }
      if (madeMove) break;
    }
    if (madeMove) {
      moves++;
      statMoves.set(moves);
      audio.play('laser');
      render();
      setTimeout(runAutoComplete, 60);
    }
  }

  function checkWinCondition() {
    let won = false;
    if (game.type === 'klondike' || game.type === 'freecell') {
      const total = game.foundations.reduce((acc, f) => acc + f.length, 0);
      won = total === 52;
    } else if (game.type === 'spider') {
      won = game.completedSuits === 8;
    }

    if (won) {
      clearInterval(timerInterval);
      ctx.achievements?.unlock('solitaire_first_win');
      if (game.type === 'freecell') ctx.achievements?.unlock('solitaire_freecell_win');
      if (game.type === 'spider') ctx.achievements?.unlock('solitaire_spider_win');
      if (elapsedSeconds > 0 && elapsedSeconds < 180) ctx.achievements?.unlock('solitaire_fast_win');

      const score = Math.max(100, 10000 - moves * 20 - elapsedSeconds * 5);
      shell.finish({
        won: true,
        score,
        mode: currentMode,
        time: elapsedSeconds,
        moves,
        title: t('win.title'),
        scoreText: t('win.moves', { moves, time: formatTime(elapsedSeconds) }),
        onRestart: () => newDeal(),
      });
    }
  }

  shell.enablePause({
    canPause: () => true,
    onRestart: () => restartDeal(),
  });

  newDeal();

  return {
    unmount: () => {
      clearInterval(timerInterval);
      shell.dispose();
    },
  };
}
