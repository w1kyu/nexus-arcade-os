// @ts-check
import { createGameShell, gsButton, gsSelect } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import {
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  MAPS,
  TOWER_TYPES,
  canPlaceTower,
  createGameState,
  getUpgradeCost,
  placeTower,
  sellTower,
  startNextWave,
  stepSimulation,
  upgradeTower,
} from './logic.js';
import './styles.css';

const APP_ID = 'nexus.griddefense';

export const commands = {
  'griddefense.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  griddefense: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-gd' });
  const { t, root, audio } = shell;
  await shell.load();

  let mapIdx = 0;
  let state = createGameState(mapIdx);
  /** @type {string | null} */
  let selectedBuildType = 'pulse';
  let hoverGx = -1;
  let hoverGy = -1;
  let animId = 0;
  let lastTime = performance.now();

  // Top Bar HUD
  const creditEl = h('b', {}, String(state.credits));
  const livesEl = h('b', {}, String(state.lives));
  const waveEl = h('b', {}, `${state.waveIndex}/${state.totalWaves}`);
  const scoreEl = h('b', {}, String(state.score));

  const hud = h(
    'div',
    { class: 'nx-gd-hud' },
    h('div', { class: 'nx-gd-hud-item' }, t('hud.credits') + ':', creditEl),
    h('div', { class: 'nx-gd-hud-item lives' }, t('hud.lives') + ':', livesEl),
    h('div', { class: 'nx-gd-hud-item' }, t('hud.wave') + ':', waveEl),
    h('div', { class: 'nx-gd-hud-item' }, t('hud.score') + ':', scoreEl),
  );

  const speedSelect = gsSelect(
    [
      { value: '1', label: '1x' },
      { value: '2', label: '2x' },
      { value: '4', label: '4x' },
    ],
    '1',
    (val) => {
      state.speedMultiplier = Number(val);
    },
    { 'aria-label': t('hud.speed') },
  );

  const mapSelect = gsSelect(
    MAPS.map((m, idx) => ({ value: String(idx), label: m.name })),
    '0',
    (val) => {
      mapIdx = Number(val);
      newGame();
    },
    { 'aria-label': t('actions.selectMap') },
  );

  const btnStartWave = gsButton(t('actions.startWave'), () => onStartWaveClick(), {
    class: 'primary',
    'data-testid': 'gd-start-wave',
  });

  const bar = h(
    'div',
    { class: 'nx-gd-bar' },
    hud,
    h('span', { style: 'flex: 1' }),
    mapSelect,
    speedSelect,
    btnStartWave,
    gsButton(shell.labels().stats, () =>
      shell.statsDialog(
        MAPS.map((m) => ({ mode: m.id, label: m.name })),
        { score: true },
      ),
    ),
    gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
  );

  // Main Canvas & Viewport
  const canvas = /** @type {HTMLCanvasElement} */ (
    h('canvas', {
      class: 'nx-gd-canvas',
      width: GRID_COLS * CELL_SIZE,
      height: GRID_ROWS * CELL_SIZE,
      'data-testid': 'gd-canvas',
      tabindex: '0',
    })
  );
  const ctx2d = canvas.getContext('2d');

  // Sidebar for Selected Tower Info
  const sidebar = h('div', { class: 'nx-gd-sidebar' });
  const viewport = h('div', { class: 'nx-gd-viewport' }, canvas);
  const main = h('div', { class: 'nx-gd-main' }, viewport, sidebar);

  // Bottom Build Bar
  const buildBar = h('div', { class: 'nx-gd-build-bar' });
  /** @type {Record<string, HTMLButtonElement>} */
  const buildButtons = {};
  for (const [key, def] of Object.entries(TOWER_TYPES)) {
    const btn = /** @type {HTMLButtonElement} */ (
      h(
        'button',
        {
          class: `nx-gd-build-btn ${key === selectedBuildType ? 'selected' : ''}`,
          'data-type': key,
          onclick: () => {
            selectedBuildType = selectedBuildType === key ? null : key;
            state.selectedTowerIndex = -1;
            updateBuildBar();
            updateSidebar();
          },
        },
        h('span', {}, def.icon),
        h('span', {}, t(`towers.${key}`)),
        h('span', { class: 'nx-gd-build-cost' }, `${def.cost}c`),
      )
    );
    buildButtons[key] = btn;
    buildBar.append(btn);
  }

  root.append(bar, main, buildBar);

  function updateBuildBar() {
    for (const [key, btn] of Object.entries(buildButtons)) {
      btn.classList.toggle('selected', key === selectedBuildType);
      const def = TOWER_TYPES[/** @type {keyof typeof TOWER_TYPES} */ (key)];
      btn.disabled = state.credits < def.cost;
    }
  }

  function updateSidebar() {
    sidebar.innerHTML = '';
    const selIdx = state.selectedTowerIndex;
    if (selIdx < 0 || !state.towers[selIdx]) {
      sidebar.append(
        h(
          'p',
          { style: 'color: #64748b; font-size: 13px;' },
          'Select a turret or choose one below to place on the grid.',
        ),
      );
      return;
    }

    const tower = state.towers[selIdx];
    const upgradeCost = getUpgradeCost(tower);
    const refund = Math.floor(tower.totalInvested * 0.7);

    const title = h('h3', { class: 'nx-gd-panel-title' }, `${t(`towers.${tower.type}`)} (Lv. ${tower.level})`);

    const info = h(
      'div',
      { class: 'nx-gd-info-rows' },
      h('div', { class: 'nx-gd-info-row' }, h('span', {}, t('status.damage')), h('span', {}, String(tower.damage))),
      h('div', { class: 'nx-gd-info-row' }, h('span', {}, t('status.range')), h('span', {}, String(tower.range))),
      h('div', { class: 'nx-gd-info-row' }, h('span', {}, t('status.fireRate')), h('span', {}, `${tower.fireRate}/s`)),
      h('div', { class: 'nx-gd-info-row' }, h('span', {}, t('status.kills')), h('span', {}, String(tower.kills))),
    );

    const targetModes = ['first', 'last', 'strong', 'weak'];
    const btnTarget = h(
      'button',
      {
        class: 'nx-gd-btn',
        onclick: () => {
          tower.targetMode = (tower.targetMode + 1) % 4;
          btnTarget.textContent = t(`targetModes.${targetModes[tower.targetMode]}`);
        },
      },
      t(`targetModes.${targetModes[tower.targetMode]}`),
    );

    const btnUpgrade = h(
      'button',
      {
        class: 'nx-gd-btn primary',
        disabled: tower.level >= 3 || state.credits < upgradeCost,
        onclick: () => {
          if (upgradeTower(state, selIdx)) {
            audio.play('blip');
            updateUI();
          }
        },
      },
      tower.level >= 3 ? t('status.maxLevel') : `${t('actions.upgrade')} (${upgradeCost}c)`,
    );

    const btnSell = h(
      'button',
      {
        class: 'nx-gd-btn danger',
        onclick: () => {
          sellTower(state, selIdx);
          audio.play('drop');
          updateUI();
        },
      },
      `${t('actions.sell')} (+${refund}c)`,
    );

    sidebar.append(title, info, btnTarget, btnUpgrade, btnSell);
  }

  function updateUI() {
    creditEl.textContent = String(state.credits);
    livesEl.textContent = String(state.lives);
    waveEl.textContent = `${state.waveIndex}/${state.totalWaves}`;
    scoreEl.textContent = String(state.score);

    btnStartWave.disabled = state.waveInProgress || state.gameOver;
    btnStartWave.textContent = state.waveInProgress
      ? t('actions.waveActive')
      : state.waveIndex === 0
        ? t('actions.startWave')
        : t('actions.nextWave');

    updateBuildBar();
    updateSidebar();
  }

  function onStartWaveClick() {
    if (startNextWave(state)) {
      audio.play('launch');
      updateUI();
    }
  }

  function newGame() {
    state = createGameState(mapIdx);
    selectedBuildType = 'pulse';
    hoverGx = -1;
    hoverGy = -1;
    updateUI();
  }

  // Pointer / Click Handling on Canvas
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    hoverGx = Math.floor(cx / CELL_SIZE);
    hoverGy = Math.floor(cy / CELL_SIZE);
  });

  canvas.addEventListener('pointerleave', () => {
    hoverGx = -1;
    hoverGy = -1;
  });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const gx = Math.floor(cx / CELL_SIZE);
    const gy = Math.floor(cy / CELL_SIZE);

    // Check if clicked an existing tower
    const towerIdx = state.towers.findIndex((t) => t.gx === gx && t.gy === gy);
    if (towerIdx >= 0) {
      state.selectedTowerIndex = towerIdx;
      selectedBuildType = null;
      audio.play('blip');
      updateUI();
      return;
    }

    // Attempt to build
    if (selectedBuildType && canPlaceTower(state, gx, gy, selectedBuildType)) {
      const placed = placeTower(state, gx, gy, selectedBuildType);
      if (placed) {
        audio.play('place');
        updateUI();
      }
    } else {
      state.selectedTowerIndex = -1;
      updateSidebar();
    }
  });

  // Render Loop
  function render() {
    if (!ctx2d) return;

    // Background
    ctx2d.fillStyle = '#060913';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid Lines
    ctx2d.strokeStyle = '#0f172a';
    ctx2d.lineWidth = 1;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx2d.beginPath();
      ctx2d.moveTo(c * CELL_SIZE, 0);
      ctx2d.lineTo(c * CELL_SIZE, GRID_ROWS * CELL_SIZE);
      ctx2d.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx2d.beginPath();
      ctx2d.moveTo(0, r * CELL_SIZE);
      ctx2d.lineTo(GRID_COLS * CELL_SIZE, r * CELL_SIZE);
      ctx2d.stroke();
    }

    // Draw Roads / Paths
    ctx2d.fillStyle = '#1e293b';
    for (const path of state.mapDef.paths) {
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            ctx2d.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          }
        }
      }
    }

    // Draw Waypoint Guidelines
    ctx2d.strokeStyle = '#38bdf844';
    ctx2d.lineWidth = 3;
    ctx2d.setLineDash([6, 6]);
    for (const path of state.mapDef.paths) {
      ctx2d.beginPath();
      for (let i = 0; i < path.length; i++) {
        const px = path[i].x * CELL_SIZE + CELL_SIZE / 2;
        const py = path[i].y * CELL_SIZE + CELL_SIZE / 2;
        if (i === 0) ctx2d.moveTo(px, py);
        else ctx2d.lineTo(px, py);
      }
      ctx2d.stroke();
    }
    ctx2d.setLineDash([]);

    // Draw Obstacles
    if (state.mapDef.obstacles) {
      ctx2d.fillStyle = '#334155';
      for (const [ox, oy] of state.mapDef.obstacles) {
        ctx2d.fillRect(ox * CELL_SIZE + 2, oy * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }
    }

    // Draw Hover Placement Indicator
    if (hoverGx >= 0 && hoverGy >= 0) {
      const valid = selectedBuildType && canPlaceTower(state, hoverGx, hoverGy, selectedBuildType);
      ctx2d.fillStyle = valid ? 'rgba(56, 189, 248, 0.25)' : 'rgba(239, 68, 68, 0.25)';
      ctx2d.fillRect(hoverGx * CELL_SIZE, hoverGy * CELL_SIZE, CELL_SIZE, CELL_SIZE);

      if (selectedBuildType && valid) {
        const def = TOWER_TYPES[/** @type {keyof typeof TOWER_TYPES} */ (selectedBuildType)];
        ctx2d.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx2d.lineWidth = 1.5;
        ctx2d.beginPath();
        ctx2d.arc(hoverGx * CELL_SIZE + CELL_SIZE / 2, hoverGy * CELL_SIZE + CELL_SIZE / 2, def.range, 0, Math.PI * 2);
        ctx2d.stroke();
      }
    }

    // Draw Selected Tower Range
    if (state.selectedTowerIndex >= 0 && state.towers[state.selectedTowerIndex]) {
      const sel = state.towers[state.selectedTowerIndex];
      ctx2d.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx2d.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx2d.lineWidth = 1.5;
      ctx2d.beginPath();
      ctx2d.arc(sel.x, sel.y, sel.range, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.stroke();
    }

    // Draw Towers
    for (const tower of state.towers) {
      const def = TOWER_TYPES[/** @type {keyof typeof TOWER_TYPES} */ (tower.type)];
      ctx2d.fillStyle = def.color;
      ctx2d.beginPath();
      ctx2d.arc(tower.x, tower.y, CELL_SIZE * 0.36, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.strokeStyle = '#ffffff';
      ctx2d.lineWidth = 2;
      ctx2d.stroke();

      // Tower Level Badges
      ctx2d.fillStyle = '#0f172a';
      ctx2d.font = '10px monospace';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText(tower.level > 1 ? `L${tower.level}` : def.icon, tower.x, tower.y);
    }

    // Draw Beams
    for (const b of state.beamEvents) {
      ctx2d.strokeStyle = b.color;
      ctx2d.lineWidth = 3;
      ctx2d.beginPath();
      ctx2d.moveTo(b.x1, b.y1);
      ctx2d.lineTo(b.x2, b.y2);
      ctx2d.stroke();
    }

    // Draw Projectiles
    for (const p of state.projectiles) {
      ctx2d.fillStyle = p.color;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx2d.fill();
    }

    // Draw Explosions / Bursts
    for (const b of state.burstEvents) {
      ctx2d.strokeStyle = b.color;
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      ctx2d.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx2d.stroke();
    }

    // Draw Creeps
    for (const c of state.creeps) {
      ctx2d.fillStyle = c.color;
      ctx2d.beginPath();
      ctx2d.arc(c.x, c.y, c.size, 0, Math.PI * 2);
      ctx2d.fill();

      // Health Bar
      const hpWidth = c.size * 2;
      const hpPct = Math.max(0, c.hp / c.maxHp);
      ctx2d.fillStyle = '#ef4444';
      ctx2d.fillRect(c.x - c.size, c.y - c.size - 6, hpWidth, 3);
      ctx2d.fillStyle = '#22c55e';
      ctx2d.fillRect(c.x - c.size, c.y - c.size - 6, hpWidth * hpPct, 3);

      // Shield Bar
      if (c.shieldHp > 0) {
        const shPct = Math.max(0, c.shieldHp / c.maxShieldHp);
        ctx2d.fillStyle = '#38bdf8';
        ctx2d.fillRect(c.x - c.size, c.y - c.size - 9, hpWidth * shPct, 2);
      }
    }
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (!shell.paused && !state.gameOver) {
      const prevWaveIdx = state.waveIndex;
      const prevLives = state.lives;

      stepSimulation(state, dt);

      if (state.waveIndex !== prevWaveIdx || state.lives !== prevLives) {
        updateUI();
        if (state.waveIndex === 1 && state.spawnQueue.length === 0 && state.creeps.length === 0) {
          ctx.achievements.unlock('griddefense_first_wave');
        }
      }

      if (state.gameOver) {
        updateUI();
        if (state.won) {
          if (state.lives === 20) ctx.achievements.unlock('griddefense_flawless');
          shell.finish({
            won: true,
            score: state.score + state.lives * 250,
            mode: state.mapDef.id,
            scoreText: String(state.score + state.lives * 250),
            onRestart: newGame,
          });
        } else {
          shell.finish({
            won: false,
            score: state.score,
            mode: state.mapDef.id,
            scoreText: String(state.score),
            onRestart: newGame,
          });
        }
      }
    }

    render();
    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  shell.enablePause({
    onRestart: newGame,
    onPause: () => {},
    onResume: () => {
      lastTime = performance.now();
    },
  });

  shell.onDispose(() => {
    cancelAnimationFrame(animId);
  });

  updateUI();

  return {
    unmount: () => shell.dispose(),
  };
}
