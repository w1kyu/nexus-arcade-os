// @ts-check
import { createGameShell, gsButton, gsStat } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import {
  CELL_EMPTY,
  CELL_HIT,
  CELL_MISS,
  CELL_SUNK,
  GRID_SIZE,
  SHIPS,
  canPlaceShip,
  chooseAiShot,
  createEmptyGrid,
  fireShot,
  isFleetSunk,
  placeShip,
  randomizeFleet,
} from './logic.js';
import './styles.css';

const APP_ID = 'nexus.battleships';

export const commands = {
  'battleships.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  battleships: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-battleships' });
  const { t, root, audio } = shell;
  await shell.load();

  /** @type {'placement' | 'battle' | 'over'} */
  let phase = 'placement';
  let placingShipIdx = 0;
  let placingHorizontal = true;

  // Grids
  let playerShipGrid = createEmptyGrid();
  let playerShotsGrid = createEmptyGrid(); // Shots AI fired at player
  let enemyShipGrid = createEmptyGrid();
  let enemyShotsGrid = createEmptyGrid(); // Shots player fired at enemy

  /** @type {import('./logic.js').PlacedShip[]} */
  let playerFleet = [];
  /** @type {import('./logic.js').PlacedShip[]} */
  let enemyFleet = [];

  let playerShotsCount = 0;
  let playerHitsCount = 0;
  let aiThinking = false;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let aiTimer;

  // Top Bar & HUD
  const topBar = h('div', { class: 'nx-gs-bar' });
  const statShots = gsStat(t('hud.shots'), 'bs-shots');
  const statHits = gsStat(t('hud.hits'), 'bs-hits');
  const statAcc = gsStat(t('hud.accuracy'), 'bs-acc');

  const btnRotate = gsButton(t('placement.rotate'), () => toggleOrientation(), { 'data-testid': 'bs-rotate' });
  const btnRandom = gsButton(t('placement.randomize'), () => autoRandomize(), { 'data-testid': 'bs-random' });
  const btnReady = gsButton(t('placement.ready'), () => startBattle(), {
    'data-testid': 'bs-ready',
    class: 'primary',
  });
  btnReady.hidden = true;

  const btnNewGame = gsButton(t('placement.randomize'), () => resetGame(), { 'data-testid': 'bs-new' });
  btnNewGame.hidden = true;

  topBar.append(btnRotate, btnRandom, btnReady, btnNewGame, statShots.el, statHits.el, statAcc.el);

  // Status line
  const statusEl = h('div', { class: 'nx-gs-status', role: 'status', 'data-testid': 'bs-status' });

  // Boards
  const contentEl = h('div', { class: 'nx-bs-content' });

  // Player Board
  const playerPanel = h('div', { class: 'nx-bs-board-panel' });
  const playerTitle = h('div', { class: 'nx-bs-board-title' }, '🛡 ' + t('battle.yourFleet'));
  const playerTracker = h('div', { class: 'nx-bs-fleet', 'data-testid': 'bs-player-fleet' });
  const playerGridEl = h('div', { class: 'nx-bs-grid player', 'data-testid': 'bs-player-grid' });
  playerPanel.append(playerTitle, playerTracker, playerGridEl);

  // Enemy Board
  const enemyPanel = h('div', { class: 'nx-bs-board-panel' });
  const enemyTitle = h('div', { class: 'nx-bs-board-title enemy' }, '🎯 ' + t('battle.enemyFleet'));
  const enemyTracker = h('div', { class: 'nx-bs-fleet', 'data-testid': 'bs-enemy-fleet' });
  const enemyGridEl = h('div', { class: 'nx-bs-grid enemy', 'data-testid': 'bs-enemy-grid' });
  enemyPanel.append(enemyTitle, enemyTracker, enemyGridEl);

  contentEl.append(playerPanel, enemyPanel);
  root.append(topBar, statusEl, contentEl);

  // Initialize cells
  /** @type {HTMLButtonElement[]} */
  const playerCells = [];
  /** @type {HTMLButtonElement[]} */
  const enemyCells = [];

  for (let i = 0; i < 100; i++) {
    const pBtn = /** @type {HTMLButtonElement} */ (
      h('button', { type: 'button', class: 'nx-bs-cell', 'data-idx': String(i) })
    );
    pBtn.addEventListener('click', () => onPlayerCellClick(i));
    pBtn.addEventListener('mouseenter', () => onPlayerCellHover(i));
    pBtn.addEventListener('mouseleave', () => clearPreview());
    playerCells.push(pBtn);
    playerGridEl.append(pBtn);

    const eBtn = /** @type {HTMLButtonElement} */ (
      h('button', { type: 'button', class: 'nx-bs-cell', 'data-idx': String(i) })
    );
    eBtn.addEventListener('click', () => onEnemyCellClick(i));
    enemyCells.push(eBtn);
    enemyGridEl.append(eBtn);
  }

  // Keyboard shortcut: R to rotate ship
  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    if (phase === 'placement' && (e.key === 'r' || e.key === 'R')) {
      toggleOrientation();
    }
  };
  root.addEventListener('keydown', onKeyDown);
  shell.onDispose(() => root.removeEventListener('keydown', onKeyDown));

  function toggleOrientation() {
    placingHorizontal = !placingHorizontal;
    btnRotate.textContent = placingHorizontal ? t('placement.rotate') : t('placement.rotateVert');
  }

  function resetGame() {
    clearTimeout(aiTimer);
    phase = 'placement';
    placingShipIdx = 0;
    placingHorizontal = true;
    playerShotsCount = 0;
    playerHitsCount = 0;
    aiThinking = false;
    statShots.set(0);
    statHits.set(0);
    statAcc.set('0%');

    btnRotate.hidden = false;
    btnRandom.hidden = false;
    btnReady.hidden = true;
    btnNewGame.hidden = true;

    playerShipGrid = createEmptyGrid();
    playerShotsGrid = createEmptyGrid();
    enemyShipGrid = createEmptyGrid();
    enemyShotsGrid = createEmptyGrid();
    playerFleet = [];
    enemyFleet = randomizeFleet(enemyShipGrid);

    updatePlacementStatus();
    renderGrids();
  }

  function autoRandomize() {
    playerShipGrid = createEmptyGrid();
    playerFleet = randomizeFleet(playerShipGrid);
    placingShipIdx = SHIPS.length;
    btnReady.hidden = false;
    btnRotate.hidden = true;
    statusEl.textContent = t('placement.ready');
    renderGrids();
  }

  function onPlayerCellClick(idx) {
    if (phase !== 'placement' || placingShipIdx >= SHIPS.length) return;
    const r = Math.floor(idx / GRID_SIZE);
    const c = idx % GRID_SIZE;
    const ship = SHIPS[placingShipIdx];

    if (canPlaceShip(playerShipGrid, ship.size, r, c, placingHorizontal)) {
      playerFleet.push(placeShip(playerShipGrid, ship, r, c, placingHorizontal, placingShipIdx + 1));
      placingShipIdx++;
      audio.play('laser');

      if (placingShipIdx >= SHIPS.length) {
        btnReady.hidden = false;
        btnRotate.hidden = true;
        statusEl.textContent = t('placement.ready');
      } else {
        updatePlacementStatus();
      }
      renderGrids();
    }
  }

  function onPlayerCellHover(idx) {
    if (phase !== 'placement' || placingShipIdx >= SHIPS.length) return;
    const r = Math.floor(idx / GRID_SIZE);
    const c = idx % GRID_SIZE;
    const ship = SHIPS[placingShipIdx];
    const valid = canPlaceShip(playerShipGrid, ship.size, r, c, placingHorizontal);

    for (let i = 0; i < ship.size; i++) {
      const cr = placingHorizontal ? r : r + i;
      const cc = placingHorizontal ? c + i : c;
      if (cr >= 0 && cr < GRID_SIZE && cc >= 0 && cc < GRID_SIZE) {
        const cell = playerCells[cr * GRID_SIZE + cc];
        cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
      }
    }
  }

  function clearPreview() {
    playerCells.forEach((btn) => btn.classList.remove('preview-valid', 'preview-invalid'));
  }

  function updatePlacementStatus() {
    const cur = SHIPS[placingShipIdx];
    if (cur) {
      statusEl.textContent = t('placement.instruction', {
        ship: cur.name[ctx.i18n.locale] ?? cur.name.en,
        size: cur.size,
      });
    }
  }

  function startBattle() {
    phase = 'battle';
    btnRotate.hidden = true;
    btnRandom.hidden = true;
    btnReady.hidden = true;
    btnNewGame.hidden = false;
    statusEl.textContent = t('battle.yourTurn');
    enemyGridEl.classList.add('active-target');
    renderGrids();
  }

  function onEnemyCellClick(idx) {
    if (phase !== 'battle' || aiThinking || enemyShotsGrid[idx] !== CELL_EMPTY) return;

    // Fire player shot
    playerShotsCount++;
    statShots.set(playerShotsCount);

    const res = fireShot(enemyShipGrid, enemyShotsGrid, enemyFleet, idx);
    if (res.hit) {
      playerHitsCount++;
      statHits.set(playerHitsCount);
      audio.play(res.sunkShip ? 'explosion' : 'laser');
      if (res.sunkShip) {
        const sName = res.sunkShip.id;
        shell.toast(t('battle.sunk', { ship: t(`ships.${sName}`) }));
      }
    } else {
      audio.play('laser');
    }

    const acc = Math.round((playerHitsCount / playerShotsCount) * 100);
    statAcc.set(`${acc}%`);
    renderGrids();

    if (isFleetSunk(enemyFleet)) {
      handleGameOver(true);
      return;
    }

    // AI turn
    aiThinking = true;
    statusEl.textContent = t('battle.aiThinking');
    enemyGridEl.classList.remove('active-target');

    aiTimer = setTimeout(() => {
      triggerAiTurn();
    }, 450);
  }

  function triggerAiTurn() {
    if (phase !== 'battle') return;
    const targetIdx = chooseAiShot(playerShotsGrid, playerFleet);
    const res = fireShot(playerShipGrid, playerShotsGrid, playerFleet, targetIdx);

    if (res.hit) {
      audio.play(res.sunkShip ? 'explosion' : 'laser');
      if (res.sunkShip) {
        const sName = res.sunkShip.id;
        shell.toast(t('battle.aiSunk', { ship: t(`ships.${sName}`) }));
      }
    }

    aiThinking = false;
    renderGrids();

    if (isFleetSunk(playerFleet)) {
      handleGameOver(false);
      return;
    }

    statusEl.textContent = t('battle.yourTurn');
    enemyGridEl.classList.add('active-target');
  }

  function handleGameOver(playerWon) {
    phase = 'over';
    clearTimeout(aiTimer);
    const acc = Math.round((playerHitsCount / playerShotsCount) * 100);

    if (playerWon) {
      ctx.achievements?.unlock('battleships_first_win');
      if (playerFleet.every((s) => !s.sunk)) ctx.achievements?.unlock('battleships_flawless');
      if (acc >= 60) ctx.achievements?.unlock('battleships_sniper');

      const score = Math.max(100, 5000 - playerShotsCount * 50 + acc * 20);
      shell.finish({
        won: true,
        score,
        mode: 'standard',
        title: t('battle.victory'),
        scoreText: `${t('hud.accuracy')}: ${acc}% (${playerShotsCount} ${t('hud.shots')})`,
        onRestart: () => resetGame(),
      });
    } else {
      shell.finish({
        won: false,
        score: playerHitsCount * 40,
        mode: 'standard',
        title: t('battle.defeat'),
        onRestart: () => resetGame(),
      });
    }
  }

  function renderGrids() {
    // Render Player Grid
    for (let i = 0; i < 100; i++) {
      const btn = playerCells[i];
      btn.className = 'nx-bs-cell';
      if (playerShipGrid[i] > 0) btn.classList.add('has-ship');

      const shot = playerShotsGrid[i];
      if (shot === CELL_MISS) btn.classList.add('miss');
      else if (shot === CELL_HIT) btn.classList.add('hit');
      else if (shot === CELL_SUNK) btn.classList.add('sunk');
    }

    // Render Enemy Grid
    for (let i = 0; i < 100; i++) {
      const btn = enemyCells[i];
      btn.className = 'nx-bs-cell';
      const shot = enemyShotsGrid[i];
      if (shot === CELL_EMPTY) {
        btn.classList.add('unshot');
      } else if (shot === CELL_MISS) {
        btn.classList.add('miss');
      } else if (shot === CELL_HIT) {
        btn.classList.add('hit');
      } else if (shot === CELL_SUNK) {
        btn.classList.add('sunk');
      }
    }

    // Render Trackers
    renderTrackers();
  }

  function renderTrackers() {
    playerTracker.innerHTML = '';
    enemyTracker.innerHTML = '';

    for (const ship of SHIPS) {
      const pShip = playerFleet.find((s) => s.id === ship.id);
      const pPill = h(
        'span',
        {
          class: `nx-bs-ship-pill ${pShip ? (pShip.sunk ? 'sunk' : 'alive') : ''}`,
        },
        t(`ships.${ship.id}`),
      );
      playerTracker.append(pPill);

      const eShip = enemyFleet.find((s) => s.id === ship.id);
      const ePill = h(
        'span',
        {
          class: `nx-bs-ship-pill ${eShip ? (eShip.sunk ? 'sunk' : 'enemy-alive') : ''}`,
        },
        t(`ships.${ship.id}`),
      );
      enemyTracker.append(ePill);
    }
  }

  shell.enablePause({
    canPause: () => phase === 'battle' && !aiThinking,
    onRestart: () => resetGame(),
  });

  resetGame();

  return {
    unmount: () => {
      clearTimeout(aiTimer);
      shell.dispose();
    },
  };
}
