// @ts-check
import { createGameShell, gsButton, gsSelect } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { LAYOUTS, areTilesMatching, findAvailableMatches, generateSolvableDeal, isTileFree } from './logic.js';
import './styles.css';

const APP_ID = 'nexus.mahjong';

export const commands = {
  'mahjong.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  mahjong: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-mahjong' });
  const { t, root, audio } = shell;
  await shell.load();

  let layoutId = 'turtle';
  /** @type {import('./logic.js').Tile[]} */
  let tiles = [];
  /** @type {import('./logic.js').Tile | null} */
  let selectedTile = null;
  /** @type {[import('./logic.js').Tile, import('./logic.js').Tile][]} */
  const history = [];
  let highlightFree = true;
  let startTime = Date.now();
  let timerId = 0;
  let elapsed = 0;

  // Top Bar HUD
  const tilesLeftEl = h('b', {}, '0');
  const matchesEl = h('b', {}, '0');
  const timeEl = h('b', {}, '0:00');

  const hud = h(
    'div',
    { class: 'nx-mahjong-hud' },
    h('div', {}, t('hud.tilesLeft') + ':', tilesLeftEl),
    h('div', {}, t('hud.matches') + ':', matchesEl),
    h('div', {}, t('hud.time') + ':', timeEl),
  );

  const layoutSelect = gsSelect(
    Object.values(LAYOUTS).map((l) => ({ value: l.id, label: l.name })),
    layoutId,
    (val) => {
      layoutId = val;
      newDeal();
    },
    { 'aria-label': t('actions.selectLayout') },
  );

  const btnHint = gsButton(t('actions.hint'), () => showHint(), { 'data-testid': 'mahjong-hint' });
  const btnShuffle = gsButton(t('actions.shuffle'), () => shuffleRemaining(), { 'data-testid': 'mahjong-shuffle' });
  const btnUndo = gsButton(t('actions.undo'), () => undoLastMatch(), { 'data-testid': 'mahjong-undo' });

  const bar = h(
    'div',
    { class: 'nx-mahjong-bar' },
    hud,
    h('span', { style: 'flex: 1' }),
    layoutSelect,
    btnHint,
    btnShuffle,
    btnUndo,
    gsButton(t('actions.newDeal'), () => newDeal(), { 'data-testid': 'mahjong-new' }),
    gsButton(shell.labels().stats, () =>
      shell.statsDialog(
        Object.values(LAYOUTS).map((l) => ({ mode: l.id, label: l.name })),
        { time: true, score: false },
      ),
    ),
    gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
  );

  // Board Area
  const boardEl = h('div', { class: 'nx-mahjong-board', 'data-testid': 'mahjong-board' });
  const main = h('div', { class: 'nx-mahjong-main' }, boardEl);

  root.append(bar, main);

  function newDeal() {
    selectedTile = null;
    history.length = 0;
    tiles = generateSolvableDeal(layoutId);
    startTime = Date.now();
    elapsed = 0;
    renderBoard();
    updateHUD();
  }

  function updateHUD() {
    const remaining = tiles.filter((t) => !t.matched);
    const available = findAvailableMatches(tiles);

    tilesLeftEl.textContent = String(remaining.length);
    matchesEl.textContent = String(available.length);
    btnUndo.disabled = history.length === 0;

    const mins = Math.floor(elapsed / 60);
    const secs = String(Math.floor(elapsed % 60)).padStart(2, '0');
    timeEl.textContent = `${mins}:${secs}`;
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    const active = tiles.filter((t) => !t.matched);

    // Sort by layer z, then y, then x for natural stacking
    active.sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z;
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    for (const tile of active) {
      const free = isTileFree(tile, tiles);
      const isSel = selectedTile?.id === tile.id;

      const tileEl = h(
        'button',
        {
          type: 'button',
          class: `nx-mahjong-tile ${isSel ? 'selected' : ''} ${!free && highlightFree ? 'dimmed' : ''}`,
          style: `left: ${tile.x * 24 + tile.z * 5}px; top: ${tile.y * 32 - tile.z * 5}px; z-index: ${tile.z * 100 + tile.y};`,
          'data-id': String(tile.id),
          onclick: () => onTileClick(tile),
        },
        h('span', {}, tile.glyph),
      );

      boardEl.append(tileEl);
    }
  }

  function onTileClick(tile) {
    if (tile.matched || !isTileFree(tile, tiles) || shell.paused) return;

    if (!selectedTile) {
      selectedTile = tile;
      audio.play('blip');
      renderBoard();
      return;
    }

    if (selectedTile.id === tile.id) {
      selectedTile = null;
      renderBoard();
      return;
    }

    // Try matching
    if (areTilesMatching(selectedTile, tile)) {
      audio.play('place');
      selectedTile.matched = true;
      tile.matched = true;
      history.push([selectedTile, tile]);
      selectedTile = null;

      renderBoard();
      updateHUD();

      // Check board clear
      const remaining = tiles.filter((t) => !t.matched);
      if (remaining.length === 0) {
        handleVictory();
      }
    } else {
      // Switch selection
      selectedTile = tile;
      audio.play('blip');
      renderBoard();
    }
  }

  function showHint() {
    const matches = findAvailableMatches(tiles);
    if (matches.length === 0) {
      shell.toast(t('status.noMoves'));
      return;
    }

    const pair = matches[0];
    const el1 = boardEl.querySelector(`[data-id="${pair[0].id}"]`);
    const el2 = boardEl.querySelector(`[data-id="${pair[1].id}"]`);

    el1?.classList.add('hint');
    el2?.classList.add('hint');
    audio.play('blip');

    setTimeout(() => {
      el1?.classList.remove('hint');
      el2?.classList.remove('hint');
    }, 1800);
  }

  function shuffleRemaining() {
    const remaining = tiles.filter((t) => !t.matched);
    if (remaining.length < 2) return;

    // Reshuffle suits/values among remaining slots
    const symbols = remaining.map((t) => ({ suit: t.suit, val: t.val, glyph: t.glyph }));
    for (let i = symbols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
    }

    for (let i = 0; i < remaining.length; i++) {
      remaining[i].suit = symbols[i].suit;
      remaining[i].val = symbols[i].val;
      remaining[i].glyph = symbols[i].glyph;
    }

    selectedTile = null;
    audio.play('drop');
    renderBoard();
    updateHUD();
    shell.toast('Tiles reshuffled!');
  }

  function undoLastMatch() {
    const last = history.pop();
    if (!last) return;

    last[0].matched = false;
    last[1].matched = false;
    selectedTile = null;

    audio.play('drop');
    renderBoard();
    updateHUD();
  }

  function handleVictory() {
    audio.play('victory');
    ctx.achievements.unlock('mahjong_first_clear');
    if (elapsed < 240) ctx.achievements.unlock('mahjong_speed_match');

    shell.finish({
      won: true,
      score: Math.max(100, Math.round(10000 - elapsed * 10)),
      mode: layoutId,
      time: elapsed,
      scoreText: `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`,
      onRestart: newDeal,
    });
  }

  // Timer loop
  timerId = window.setInterval(() => {
    if (!shell.paused && tiles.some((t) => !t.matched)) {
      elapsed = (Date.now() - startTime) / 1000;
      updateHUD();
    }
  }, 1000);

  shell.enablePause({
    onRestart: newDeal,
  });

  shell.onDispose(() => {
    clearInterval(timerId);
  });

  newDeal();

  return {
    unmount: () => shell.dispose(),
  };
}
