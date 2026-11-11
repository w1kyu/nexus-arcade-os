// @ts-check
import { createGameShell, gsButton, gsSelect } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { COLS, PATTERNS, ROWS, createGrid, getPopulation, stampPattern, stepGeneration } from './logic.js';
import './styles.css';

const APP_ID = 'nexus.life';
const CELL_SIZE = 10;

export const commands = {
  'life.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  life: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-life' });
  const { t, root, audio } = shell;
  await shell.load();

  let grid = createGrid();
  let ruleId = 'conway';
  let selectedPattern = 'none';
  let running = false;
  let generation = 0;
  let animId = 0;
  let lastStepTime = performance.now();
  let stepInterval = 80; // ms per generation (approx 12 gen/sec)

  // Top Bar HUD
  const genEl = h('b', {}, '0');
  const popEl = h('b', {}, '0');

  const hud = h(
    'div',
    { class: 'nx-life-hud' },
    h('div', {}, t('hud.gen') + ':', genEl),
    h('div', {}, t('hud.pop') + ':', popEl),
  );

  const btnPlayPause = gsButton(t('actions.play'), () => togglePlay(), {
    class: 'primary',
    'data-testid': 'life-play',
  });

  const ruleSelect = gsSelect(
    [
      { value: 'conway', label: t('rules.conway') },
      { value: 'highlife', label: t('rules.highlife') },
      { value: 'seeds', label: t('rules.seeds') },
      { value: 'brians_brain', label: t('rules.brians_brain') },
      { value: 'day_night', label: t('rules.day_night') },
    ],
    ruleId,
    (val) => {
      ruleId = val;
    },
    { 'aria-label': t('hud.rule') },
  );

  const patternSelect = gsSelect(
    [
      { value: 'none', label: t('patterns.none') },
      ...Object.keys(PATTERNS).map((k) => ({ value: k, label: t(`patterns.${k}`) })),
    ],
    selectedPattern,
    (val) => {
      selectedPattern = val;
    },
    { 'aria-label': t('actions.stampPattern') },
  );

  const bar = h(
    'div',
    { class: 'nx-life-bar' },
    hud,
    h('span', { style: 'flex: 1' }),
    patternSelect,
    ruleSelect,
    btnPlayPause,
    gsButton(t('actions.step'), () => step(), { 'data-testid': 'life-step' }),
    gsButton(t('actions.clear'), () => clearGrid()),
    gsButton(t('actions.random'), () => randomizeGrid()),
    gsButton('⏸', () => shell.pause(), { 'aria-label': shell.labels().pause }),
  );

  // Main Canvas
  const canvas = /** @type {HTMLCanvasElement} */ (
    h('canvas', {
      class: 'nx-life-canvas',
      width: COLS * CELL_SIZE,
      height: ROWS * CELL_SIZE,
      'data-testid': 'life-canvas',
      tabindex: '0',
    })
  );
  const ctx2d = canvas.getContext('2d');
  const main = h('div', { class: 'nx-life-main' }, canvas);

  root.append(bar, main);

  function updateHUD() {
    genEl.textContent = String(generation);
    const pop = getPopulation(grid);
    popEl.textContent = String(pop);

    if (pop >= 500) ctx.achievements.unlock('life_pop_500');
    if (generation >= 100) ctx.achievements.unlock('life_gen_100');
  }

  function togglePlay() {
    running = !running;
    btnPlayPause.textContent = running ? t('actions.pause') : t('actions.play');
    btnPlayPause.classList.toggle('primary', !running);
    if (running) audio.play('blip');
  }

  function step() {
    grid = stepGeneration(grid, /** @type {any} */ (ruleId));
    generation++;
    updateHUD();
  }

  function clearGrid() {
    grid = createGrid();
    generation = 0;
    running = false;
    btnPlayPause.textContent = t('actions.play');
    btnPlayPause.classList.add('primary');
    updateHUD();
  }

  function randomizeGrid() {
    grid = createGrid();
    for (let i = 0; i < grid.length; i++) {
      if (Math.random() < 0.22) grid[i] = 1;
    }
    generation = 0;
    updateHUD();
    audio.play('place');
  }

  // Pointer Interaction
  let isDrawing = false;
  let drawValue = 1;

  function handlePointer(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const gx = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const gy = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);

    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;

    if (selectedPattern !== 'none') {
      stampPattern(grid, /** @type {any} */ (selectedPattern), gx, gy);
      audio.play('place');
      updateHUD();
      return;
    }

    grid[gy * COLS + gx] = drawValue;
    updateHUD();
  }

  canvas.addEventListener('pointerdown', (e) => {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const gx = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const gy = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);

    if (selectedPattern === 'none' && gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) {
      drawValue = grid[gy * COLS + gx] === 1 ? 0 : 1;
    }
    handlePointer(e);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (isDrawing && selectedPattern === 'none') {
      handlePointer(e);
    }
  });

  window.addEventListener('pointerup', () => {
    isDrawing = false;
  });

  // Render Loop
  function render() {
    if (!ctx2d) return;

    // Background
    ctx2d.fillStyle = '#060814';
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid
    ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx2d.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx2d.beginPath();
      ctx2d.moveTo(x * CELL_SIZE, 0);
      ctx2d.lineTo(x * CELL_SIZE, ROWS * CELL_SIZE);
      ctx2d.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx2d.beginPath();
      ctx2d.moveTo(0, y * CELL_SIZE);
      ctx2d.lineTo(COLS * CELL_SIZE, y * CELL_SIZE);
      ctx2d.stroke();
    }

    // Cells
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const val = grid[y * COLS + x];
        if (val === 1) {
          ctx2d.fillStyle = '#00f0ff';
          ctx2d.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        } else if (val === 2) {
          ctx2d.fillStyle = '#3b82f6';
          ctx2d.fillRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        }
      }
    }
  }

  function loop(now) {
    if (!shell.paused && running) {
      if (now - lastStepTime >= stepInterval) {
        lastStepTime = now;
        step();
      }
    }

    render();
    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  shell.enablePause({
    onRestart: clearGrid,
    onPause: () => {
      running = false;
      btnPlayPause.textContent = t('actions.play');
      btnPlayPause.classList.add('primary');
    },
    onResume: () => {
      lastStepTime = performance.now();
    },
  });

  shell.onDispose(() => {
    cancelAnimationFrame(animId);
  });

  // Seed default glider
  stampPattern(grid, 'glider', 4, 4);
  updateHUD();

  return {
    unmount: () => shell.dispose(),
  };
}
