// @ts-check
import { createGameShell, gsButton, gsSelect } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import {
  BUILTIN_LEVELS,
  LEVEL_COLS,
  LEVEL_ROWS,
  TILE,
  TILE_SIZE,
  createRunnerState,
  respawnPlayer,
  stepRunner,
} from './logic.js';
import './styles.css';

const APP_ID = 'nexus.runner';

export const commands = {
  'runner.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  runner: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-runner' });
  const { t, root, audio } = shell;
  await shell.load();

  let currentLevelIdx = 0;
  let state = createRunnerState(currentLevelIdx);
  let isEditor = false;
  let selectedEditorTile = TILE.SOLID;
  let animId = 0;
  let lastTime = performance.now();
  let jumpPressedThisFrame = false;

  const input = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
  };

  // Top Bar HUD
  const levelEl = h('b', {}, String(currentLevelIdx + 1));
  const coinsEl = h('b', {}, `${state.player.coins}/${state.totalCoins}`);
  const deathsEl = h('b', {}, String(state.deaths));
  const timeEl = h('b', {}, '0.0s');

  const hud = h(
    'div',
    { class: 'nx-runner-hud' },
    h('div', {}, t('hud.level') + ':', levelEl),
    h('div', {}, t('hud.coins') + ':', coinsEl),
    h('div', {}, t('hud.deaths') + ':', deathsEl),
    h('div', {}, t('hud.time') + ':', timeEl),
  );

  const levelSelect = gsSelect(
    BUILTIN_LEVELS.map((lvl, idx) => ({ value: String(idx), label: `L${lvl.id}: ${lvl.name}` })),
    '0',
    (val) => {
      currentLevelIdx = Number(val);
      loadLevel(currentLevelIdx);
    },
    { 'aria-label': t('hud.level') },
  );

  const btnToggleEditor = gsButton(t('actions.editor'), () => toggleEditor(), {
    'data-testid': 'runner-toggle-editor',
  });

  const bar = h(
    'div',
    { class: 'nx-runner-bar' },
    hud,
    h('span', { style: 'flex: 1' }),
    levelSelect,
    btnToggleEditor,
    gsButton(shell.labels().stats, () =>
      shell.statsDialog(
        BUILTIN_LEVELS.slice(0, 10).map((lvl) => ({ mode: `lvl_${lvl.id}`, label: lvl.name })),
        { time: true, score: false },
      ),
    ),
    gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
  );

  // Main Canvas
  const canvas = /** @type {HTMLCanvasElement} */ (
    h('canvas', {
      class: 'nx-runner-canvas',
      width: LEVEL_COLS * TILE_SIZE,
      height: LEVEL_ROWS * TILE_SIZE,
      'data-testid': 'runner-canvas',
      tabindex: '0',
    })
  );
  const ctx2d = canvas.getContext('2d');
  const main = h('div', { class: 'nx-runner-main' }, canvas);

  // Editor Toolbar (hidden by default)
  const editorBar = h('div', { class: 'nx-runner-editor-bar', hidden: true });
  const tileOptions = [
    { tile: TILE.SOLID, label: t('editor.tileSolid') },
    { tile: TILE.SPIKE, label: t('editor.tileSpike') },
    { tile: TILE.COIN, label: t('editor.tileCoin') },
    { tile: TILE.BOUNCER, label: t('editor.tileBouncer') },
    { tile: TILE.ONEWAY, label: t('editor.tileOneway') },
    { tile: TILE.CRUMBLE, label: t('editor.tileCrumble') },
    { tile: TILE.CHECKPOINT, label: t('editor.tileCheckpoint') },
    { tile: TILE.PORTAL, label: t('editor.tilePortal') },
    { tile: TILE.KEY, label: t('editor.tileKey') },
    { tile: TILE.DOOR, label: t('editor.tileDoor') },
    { tile: TILE.AIR, label: t('editor.eraser') },
  ];

  /** @type {HTMLButtonElement[]} */
  const editorTileButtons = [];
  for (const opt of tileOptions) {
    const btn = /** @type {HTMLButtonElement} */ (
      h(
        'button',
        {
          class: `nx-runner-tile-btn ${opt.tile === selectedEditorTile ? 'selected' : ''}`,
          onclick: () => {
            selectedEditorTile = opt.tile;
            editorTileButtons.forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
          },
        },
        opt.label,
      )
    );
    editorTileButtons.push(btn);
    editorBar.append(btn);
  }

  editorBar.append(
    h('span', { style: 'flex: 1' }),
    gsButton(t('actions.export'), () => exportCustomLevel()),
    gsButton(t('actions.import'), () => importCustomLevel()),
    gsButton(t('actions.newLevel'), () => {
      state.grid.fill(TILE.AIR);
    }),
  );

  root.append(bar, main, editorBar);

  function loadLevel(idx) {
    state = createRunnerState(idx);
    updateHUD();
    canvas.focus();
  }

  function toggleEditor() {
    isEditor = !isEditor;
    editorBar.hidden = !isEditor;
    btnToggleEditor.textContent = isEditor ? t('actions.play') : t('actions.editor');
    if (!isEditor) {
      // Return to play mode
      state.player.x = state.level.spawn.x * TILE_SIZE;
      state.player.y = state.level.spawn.y * TILE_SIZE;
      state.player.dead = false;
      state.player.finished = false;
    }
  }

  function exportCustomLevel() {
    const json = JSON.stringify(
      {
        name: 'Custom Level',
        spawn: state.level.spawn,
        data: state.grid,
      },
      null,
      2,
    );
    shell.dialog('Export Level JSON', [
      h('textarea', { style: 'width: 100%; height: 160px; font-family: monospace; font-size: 11px;' }, json),
    ]);
  }

  function importCustomLevel() {
    const area = /** @type {HTMLTextAreaElement} */ (
      h('textarea', {
        placeholder: 'Paste level JSON here...',
        style: 'width: 100%; height: 140px; font-family: monospace; font-size: 11px;',
      })
    );
    shell.dialog(
      'Import Level JSON',
      [area],
      [
        {
          label: 'Import',
          primary: true,
          onClick: () => {
            try {
              const parsed = JSON.parse(area.value);
              if (Array.isArray(parsed.data) && parsed.data.length === LEVEL_COLS * LEVEL_ROWS) {
                state.grid = [...parsed.data];
                state.player.x = (parsed.spawn?.x ?? 2) * TILE_SIZE;
                state.player.y = (parsed.spawn?.y ?? 10) * TILE_SIZE;
                shell.toast('Level imported successfully!');
                return true;
              }
            } catch {
              // Ignore
            }
            shell.toast('Invalid level JSON data');
            return false;
          },
        },
      ],
    );
  }

  function updateHUD() {
    levelEl.textContent = String(currentLevelIdx + 1);
    coinsEl.textContent = `${state.player.coins}/${state.totalCoins}`;
    deathsEl.textContent = String(state.deaths);
    timeEl.textContent = `${state.time.toFixed(1)}s`;
  }

  // Keyboard Event Handlers
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      if (!input.jump) {
        jumpPressedThisFrame = true;
        audio.play('jump');
      }
      input.jump = true;
    }
    if (e.key === 'r' || e.key === 'R') {
      if (state.player.dead) respawnPlayer(state);
      else loadLevel(currentLevelIdx);
    }
  });

  canvas.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') input.jump = false;
  });

  // Editor Mouse Painting on Canvas
  let isPainting = false;
  function paintTile(e) {
    if (!isEditor) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const tx = Math.floor(((e.clientX - rect.left) * scaleX) / TILE_SIZE);
    const ty = Math.floor(((e.clientY - rect.top) * scaleY) / TILE_SIZE);
    if (tx >= 0 && tx < LEVEL_COLS && ty >= 0 && ty < LEVEL_ROWS) {
      state.grid[ty * LEVEL_COLS + tx] = selectedEditorTile;
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    isPainting = true;
    paintTile(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (isPainting) paintTile(e);
  });
  window.addEventListener('pointerup', () => {
    isPainting = false;
  });

  // Render Function
  function render() {
    if (!ctx2d) return;

    // Background
    ctx2d.fillStyle = '#060814';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    // Tiles
    for (let y = 0; y < LEVEL_ROWS; y++) {
      for (let x = 0; x < LEVEL_COLS; x++) {
        const tile = state.grid[y * LEVEL_COLS + x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (tile === TILE.SOLID) {
          ctx2d.fillStyle = '#1e293b';
          ctx2d.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx2d.strokeStyle = '#38bdf8';
          ctx2d.lineWidth = 1;
          ctx2d.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else if (tile === TILE.SPIKE) {
          ctx2d.fillStyle = '#ef4444';
          ctx2d.beginPath();
          ctx2d.moveTo(px + 2, py + TILE_SIZE);
          ctx2d.lineTo(px + TILE_SIZE / 2, py + 4);
          ctx2d.lineTo(px + TILE_SIZE - 2, py + TILE_SIZE);
          ctx2d.fill();
        } else if (tile === TILE.COIN) {
          ctx2d.fillStyle = '#facc15';
          ctx2d.beginPath();
          ctx2d.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 6, 0, Math.PI * 2);
          ctx2d.fill();
        } else if (tile === TILE.BOUNCER) {
          ctx2d.fillStyle = '#f97316';
          ctx2d.fillRect(px + 4, py + TILE_SIZE - 10, TILE_SIZE - 8, 10);
          ctx2d.fillStyle = '#fdba74';
          ctx2d.fillRect(px + 6, py + TILE_SIZE - 14, TILE_SIZE - 12, 4);
        } else if (tile === TILE.ONEWAY) {
          ctx2d.fillStyle = '#64748b';
          ctx2d.fillRect(px, py, TILE_SIZE, 6);
        } else if (tile === TILE.CRUMBLE) {
          ctx2d.fillStyle = '#78350f';
          ctx2d.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else if (tile === TILE.CHECKPOINT) {
          ctx2d.fillStyle = '#10b981';
          ctx2d.fillRect(px + 6, py + 4, 3, TILE_SIZE - 4);
          ctx2d.fillRect(px + 9, py + 6, 14, 10);
        } else if (tile === TILE.PORTAL) {
          ctx2d.fillStyle = '#a855f7';
          ctx2d.beginPath();
          ctx2d.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 12, 0, Math.PI * 2);
          ctx2d.fill();
        } else if (tile === TILE.KEY) {
          ctx2d.fillStyle = '#fbbf24';
          ctx2d.font = '14px sans-serif';
          ctx2d.textAlign = 'center';
          ctx2d.fillText('🔑', px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 5);
        } else if (tile === TILE.DOOR) {
          ctx2d.fillStyle = '#d97706';
          ctx2d.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx2d.fillStyle = '#78350f';
          ctx2d.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        }
      }
    }

    // Grid lines in Editor Mode
    if (isEditor) {
      ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx2d.lineWidth = 1;
      for (let x = 0; x <= LEVEL_COLS; x++) {
        ctx2d.beginPath();
        ctx2d.moveTo(x * TILE_SIZE, 0);
        ctx2d.lineTo(x * TILE_SIZE, LEVEL_ROWS * TILE_SIZE);
        ctx2d.stroke();
      }
      for (let y = 0; y <= LEVEL_ROWS; y++) {
        ctx2d.beginPath();
        ctx2d.moveTo(0, y * TILE_SIZE);
        ctx2d.lineTo(LEVEL_COLS * TILE_SIZE, y * TILE_SIZE);
        ctx2d.stroke();
      }
    }

    // Player
    const p = state.player;
    if (!p.dead) {
      ctx2d.fillStyle = '#00f0ff';
      ctx2d.fillRect(p.x, p.y, p.width, p.height);

      // Eye
      ctx2d.fillStyle = '#ffffff';
      const eyeX = p.facingLeft ? p.x + 3 : p.x + p.width - 7;
      ctx2d.fillRect(eyeX, p.y + 6, 4, 4);
    } else {
      ctx2d.fillStyle = '#ef4444';
      ctx2d.font = '14px sans-serif';
      ctx2d.textAlign = 'center';
      ctx2d.fillText(t('status.youDied'), canvas.width / 2, canvas.height / 2);
    }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (!shell.paused && !isEditor) {
      input.jumpPressed = jumpPressedThisFrame;
      jumpPressedThisFrame = false;

      const prevCoins = state.player.coins;
      stepRunner(state, dt, input);

      if (state.player.coins !== prevCoins) {
        audio.play('blip');
      }

      updateHUD();

      if (state.player.finished) {
        audio.play('victory');
        if (currentLevelIdx === 0) ctx.achievements.unlock('runner_first_clear');
        if (currentLevelIdx >= 9) ctx.achievements.unlock('runner_ten_levels');
        if (state.player.coins === state.totalCoins && state.totalCoins > 0) {
          ctx.achievements.unlock('runner_all_coins');
        }

        shell.finish({
          won: true,
          score: Math.max(100, Math.round(1000 - state.time * 10 - state.deaths * 50 + state.player.coins * 100)),
          mode: `lvl_${BUILTIN_LEVELS[currentLevelIdx].id}`,
          time: state.time,
          scoreText: `${state.time.toFixed(1)}s (${state.deaths} deaths)`,
          onRestart: () => {
            if (currentLevelIdx + 1 < BUILTIN_LEVELS.length) {
              currentLevelIdx++;
              levelSelect.value = String(currentLevelIdx);
            }
            loadLevel(currentLevelIdx);
          },
        });
      }
    }

    render();
    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  shell.enablePause({
    onRestart: () => loadLevel(currentLevelIdx),
    onResume: () => {
      lastTime = performance.now();
      canvas.focus();
    },
  });

  shell.onDispose(() => {
    cancelAnimationFrame(animId);
  });

  loadLevel(0);

  return {
    unmount: () => shell.dispose(),
  };
}
