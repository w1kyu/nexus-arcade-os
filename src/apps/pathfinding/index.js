// @ts-check
import { h, icon } from '../../ui/dom.js';
import {
  VisualizerEngine,
  exportPng,
  exportSvg,
  loadStateFromVfs,
  renderPseudocodePanel,
  renderVisualizerControls,
  saveStateToVfs,
} from '../../ui/visualizer/engine.js';
import { PATHFINDING_ALGORITHMS } from './algorithms.js';
import {
  createEmptyGrid,
  generateKruskalMaze,
  generatePrimMaze,
  generateRandomTerrain,
  generateRecursiveBacktracker,
  generateRecursiveDivision,
} from './mazes.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const rows = 23;
  const cols = 39;
  const cellSize = 22;

  let grid = createEmptyGrid(rows, cols);
  let start = [11, 6];
  let goal = [11, 32];
  let currentAlgoKey = 'astar';
  let heuristic = 'manhattan';
  let allowDiagonal = false;
  let activeTool = 'wall'; // 'wall' | 'mud' | 'erase' | 'start' | 'goal'

  /** @type {Set<string>} */
  let visitedNodes = new Set();
  /** @type {Set<string>} */
  let frontierNodes = new Set();
  /** @type {Array<[number, number]>} */
  let finalPath = [];
  let pathCost = 0;
  let searchStatus = 'idle';

  const engine = new VisualizerEngine({
    defaultSpeed: 40,
    getSnapshot: () => ({
      grid: grid.map((r) => [...r]),
      visited: Array.from(visitedNodes),
      frontier: Array.from(frontierNodes),
      path: [...finalPath],
      pathCost,
      status: searchStatus,
    }),
    restoreSnapshot: (snap) => {
      grid = snap.grid.map((r) => [...r]);
      visitedNodes = new Set(snap.visited);
      frontierNodes = new Set(snap.frontier);
      finalPath = [...snap.path];
      pathCost = snap.pathCost;
      searchStatus = snap.status;
      updateStats();
      draw();
    },
    onStep: (step) => {
      if (step.type === 'visit') {
        visitedNodes.add(`${step.r},${step.c}`);
        frontierNodes.delete(`${step.r},${step.c}`);
        searchStatus = 'searching';
      } else if (step.type === 'frontier') {
        frontierNodes.add(`${step.r},${step.c}`);
      } else if (step.type === 'path') {
        finalPath = step.path;
        pathCost = step.cost;
        searchStatus = 'found';
      }
      updateStats();
      pseudoPanel.update();
      draw();
    },
    onReset: () => {
      clearPathOnly();
      searchStatus = 'idle';
      updateStats();
      pseudoPanel.update();
      draw();
    },
  });

  // UI Setup
  const root = h('div', { class: 'nx-pathfinding-app' });
  const header = h('div', { class: 'nx-pathfinding-header' });
  const controlsRow = h('div', { class: 'nx-pathfinding-controls-row' });

  // Algo select
  const algoSelect = h('select', { class: 'nx-input small' }, [
    ...Object.entries(PATHFINDING_ALGORITHMS).map(([k, meta]) =>
      h(
        'option',
        { value: k, selected: k === currentAlgoKey },
        meta.name[ctx.i18n.currentLocale === 'de' ? 'de' : 'en'] || meta.name.en,
      ),
    ),
  ]);
  algoSelect.addEventListener('change', () => {
    currentAlgoKey = algoSelect.value;
    heuristicSelect.hidden = currentAlgoKey !== 'astar' && currentAlgoKey !== 'greedy';
    resetAlgorithm();
  });

  // Heuristic select
  const heuristicSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: 'manhattan', selected: true }, t('heuristics.manhattan')),
    h('option', { value: 'euclidean' }, t('heuristics.euclidean')),
    h('option', { value: 'chebyshev' }, t('heuristics.chebyshev')),
  ]);
  heuristicSelect.addEventListener('change', () => {
    heuristic = heuristicSelect.value;
    resetAlgorithm();
  });

  // Diagonal toggle
  const diagBtn = h(
    'button',
    { class: `nx-cs-btn${allowDiagonal ? ' primary' : ''}`, title: t('controls.diagonal') },
    h('span', {}, t('controls.diagonal')),
  );
  diagBtn.addEventListener('click', () => {
    allowDiagonal = !allowDiagonal;
    diagBtn.classList.toggle('primary', allowDiagonal);
    resetAlgorithm();
  });

  // Maze Generator Select
  const mazeSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: '', disabled: true, selected: true }, t('mazes.select')),
    h('option', { value: 'backtracker' }, t('mazes.backtracker')),
    h('option', { value: 'prim' }, t('mazes.prim')),
    h('option', { value: 'kruskal' }, t('mazes.kruskal')),
    h('option', { value: 'division' }, t('mazes.division')),
    h('option', { value: 'terrain' }, t('mazes.terrain')),
  ]);
  mazeSelect.addEventListener('change', () => {
    const val = mazeSelect.value;
    if (val === 'backtracker') grid = generateRecursiveBacktracker(rows, cols);
    else if (val === 'prim') grid = generatePrimMaze(rows, cols);
    else if (val === 'kruskal') grid = generateKruskalMaze(rows, cols);
    else if (val === 'division') grid = generateRecursiveDivision(rows, cols);
    else if (val === 'terrain') grid = generateRandomTerrain(rows, cols);

    // Keep start and goal clear
    grid[start[0]][start[1]] = 1;
    grid[goal[0]][goal[1]] = 1;
    mazeSelect.selectedIndex = 0;
    resetAlgorithm();
  });

  // Tool Select (Wall, Mud, Erase, Start, Goal)
  const toolSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: 'wall', selected: true }, t('controls.wall')),
    h('option', { value: 'mud' }, t('controls.mud')),
    h('option', { value: 'erase' }, t('controls.erase')),
    h('option', { value: 'start' }, t('controls.start')),
    h('option', { value: 'goal' }, t('controls.goal')),
  ]);
  toolSelect.addEventListener('change', () => {
    activeTool = toolSelect.value;
  });

  // Clear Walls
  const clearWallsBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('controls.clearWalls') },
    h('span', {}, t('controls.clearWalls')),
  );
  clearWallsBtn.addEventListener('click', () => {
    grid = createEmptyGrid(rows, cols);
    resetAlgorithm();
  });

  // Clear Path
  const clearPathBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('controls.clearPath') },
    h('span', {}, t('controls.clearPath')),
  );
  clearPathBtn.addEventListener('click', () => {
    resetAlgorithm();
  });

  // Save / Load / Export
  const saveBtn = h('button', { class: 'nx-cs-btn', title: t('controls.save') }, icon('download', { size: 14 }));
  saveBtn.addEventListener('click', async () => {
    const filename = `pathfinding_${Date.now()}.csstate`;
    await saveStateToVfs(ctx.fs, `/home/documents/${filename}`, {
      grid,
      start,
      goal,
      algorithm: currentAlgoKey,
    });
    ctx.notify({ title: t('app.title'), message: `Saved ${filename}` });
  });

  const loadBtn = h('button', { class: 'nx-cs-btn', title: t('controls.load') }, icon('folder-open', { size: 14 }));
  loadBtn.addEventListener('click', async () => {
    const path = prompt('Enter VFS path to load:', '/home/documents/pathfinding_state.csstate');
    if (!path) return;
    try {
      const data = await loadStateFromVfs(ctx.fs, path);
      if (data && data.grid) {
        grid = data.grid;
        if (data.start) start = data.start;
        if (data.goal) goal = data.goal;
        if (data.algorithm) {
          currentAlgoKey = data.algorithm;
          algoSelect.value = currentAlgoKey;
        }
        resetAlgorithm();
      }
    } catch (err) {
      alert(`Load failed: ${err}`);
    }
  });

  const exportPngBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('controls.exportPng') },
    icon('camera', { size: 14 }),
  );
  exportPngBtn.addEventListener('click', () => {
    exportPng(canvas, 'pathfinding.png', ctx.fs);
  });

  const exportSvgBtn = h('button', { class: 'nx-cs-btn', title: t('controls.exportSvg') }, icon('image', { size: 14 }));
  exportSvgBtn.addEventListener('click', () => {
    const w = cols * cellSize;
    const h = rows * cellSize;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', String(w));
    bg.setAttribute('height', String(h));
    bg.setAttribute('fill', '#121628');
    svg.appendChild(bg);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let fill = null;
        if (r === start[0] && c === start[1]) fill = '#3ef0ff';
        else if (r === goal[0] && c === goal[1]) fill = '#ff5c7a';
        else if (grid[r][c] === Infinity) fill = '#05060d';
        else if (grid[r][c] === 5) fill = '#8c6239';

        if (fill) {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', String(c * cellSize));
          rect.setAttribute('y', String(r * cellSize));
          rect.setAttribute('width', String(cellSize - 1));
          rect.setAttribute('height', String(cellSize - 1));
          rect.setAttribute('fill', fill);
          svg.appendChild(rect);
        }
      }
    }
    exportSvg(svg, 'pathfinding.svg', ctx.fs);
  });

  controlsRow.append(
    algoSelect,
    heuristicSelect,
    diagBtn,
    mazeSelect,
    toolSelect,
    clearWallsBtn,
    clearPathBtn,
    saveBtn,
    loadBtn,
    exportPngBtn,
    exportSvgBtn,
  );
  header.append(controlsRow);

  // Engine controls
  const engineToolbar = renderVisualizerControls(engine, { t });

  // Main Canvas Pane
  const main = h('div', { class: 'nx-pathfinding-main' });
  const gridWrap = h('div', { class: 'nx-pathfinding-grid-wrap' });
  const canvas = document.createElement('canvas');
  canvas.className = 'nx-pathfinding-canvas';
  canvas.width = cols * cellSize;
  canvas.height = rows * cellSize;
  gridWrap.append(canvas);

  // Sidebar with stats & pseudocode
  const sidebar = h('div', { class: 'nx-pathfinding-sidebar' });
  const statsPanel = h('div', { class: 'nx-pathfinding-stats' });
  statsPanel.append(h('h4', {}, t('stats.title')));

  const statsGrid = h('div', { class: 'nx-stats-grid' });
  statsPanel.append(statsGrid);

  // Legend
  const legend = h('div', { class: 'nx-legend' }, [
    h(
      'div',
      { class: 'nx-legend-item' },
      h('div', { class: 'nx-legend-swatch', style: 'background:#3ef0ff' }),
      h('span', {}, t('legend.start')),
    ),
    h(
      'div',
      { class: 'nx-legend-item' },
      h('div', { class: 'nx-legend-swatch', style: 'background:#ff5c7a' }),
      h('span', {}, t('legend.goal')),
    ),
    h(
      'div',
      { class: 'nx-legend-item' },
      h('div', { class: 'nx-legend-swatch', style: 'background:#05060d;border:1px solid #333' }),
      h('span', {}, t('legend.wall')),
    ),
    h(
      'div',
      { class: 'nx-legend-item' },
      h('div', { class: 'nx-legend-swatch', style: 'background:#8c6239' }),
      h('span', {}, t('legend.mud')),
    ),
    h(
      'div',
      { class: 'nx-legend-item' },
      h('div', { class: 'nx-legend-swatch', style: 'background:#6aa8ff' }),
      h('span', {}, t('legend.visited')),
    ),
    h(
      'div',
      { class: 'nx-legend-item' },
      h('div', { class: 'nx-legend-swatch', style: 'background:#ffc857' }),
      h('span', {}, t('legend.path')),
    ),
  ]);
  statsPanel.append(legend);

  // Pseudocode panel
  const pseudoPanel = renderPseudocodePanel(
    PATHFINDING_ALGORITHMS[currentAlgoKey].pseudocode,
    () => {
      const step = engine.getCurrentStep();
      return step ? step.line || -1 : -1;
    },
    { locale: ctx.i18n.currentLocale, t },
  );

  sidebar.append(statsPanel, pseudoPanel);
  main.append(gridWrap, sidebar);
  root.append(header, engineToolbar, main);
  container.append(root);

  function updateStats() {
    let statusText = t('stats.idle');
    if (searchStatus === 'searching') statusText = t('stats.searching');
    else if (searchStatus === 'found') statusText = t('stats.found');
    else if (searchStatus === 'noPath') statusText = t('stats.noPath');

    statsGrid.innerHTML = `
      <div class="nx-stats-item"><span>${t('stats.visited')}</span><span>${visitedNodes.size}</span></div>
      <div class="nx-stats-item"><span>${t('stats.pathLength')}</span><span>${finalPath.length}</span></div>
      <div class="nx-stats-item"><span>${t('stats.pathCost')}</span><span>${Math.round(pathCost * 10) / 10}</span></div>
      <div class="nx-stats-item"><span>${t('stats.status')}</span><span>${statusText}</span></div>
    `;
  }

  function clearPathOnly() {
    visitedNodes.clear();
    frontierNodes.clear();
    finalPath = [];
    pathCost = 0;
  }

  function resetAlgorithm() {
    clearPathOnly();
    searchStatus = 'idle';
    const meta = PATHFINDING_ALGORITHMS[currentAlgoKey];
    if (meta) {
      engine.init(meta.generator, grid, start, goal, {
        diagonal: allowDiagonal,
        heuristic,
      });
    }
    updateStats();
    pseudoPanel.setLocale(ctx.i18n.currentLocale);
    draw();
  }

  // Canvas Drawing
  function draw() {
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    const pathSet = new Set(finalPath.map((p) => `${p[0]},${p[1]}`));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellSize;
        const y = r * cellSize;
        const key = `${r},${c}`;

        // Base cell
        if (grid[r][c] === Infinity) {
          ctx2d.fillStyle = '#05060d';
        } else if (grid[r][c] === 5) {
          ctx2d.fillStyle = '#8c6239'; // mud
        } else if (pathSet.has(key)) {
          ctx2d.fillStyle = '#ffc857'; // gold path
        } else if (visitedNodes.has(key)) {
          ctx2d.fillStyle = 'rgba(106, 168, 255, 0.45)'; // visited
        } else if (frontierNodes.has(key)) {
          ctx2d.fillStyle = 'rgba(62, 240, 255, 0.25)'; // frontier
        } else {
          ctx2d.fillStyle = '#121628';
        }

        ctx2d.fillRect(x, y, cellSize, cellSize);

        // Border grid line
        ctx2d.strokeStyle = 'rgba(120, 150, 255, 0.1)';
        ctx2d.strokeRect(x, y, cellSize, cellSize);

        // Start / Goal Markers
        if (r === start[0] && c === start[1]) {
          ctx2d.fillStyle = '#3ef0ff';
          ctx2d.beginPath();
          ctx2d.arc(x + cellSize / 2, y + cellSize / 2, cellSize / 2.6, 0, Math.PI * 2);
          ctx2d.fill();
          ctx2d.fillStyle = '#021014';
          ctx2d.font = 'bold 11px sans-serif';
          ctx2d.textAlign = 'center';
          ctx2d.textBaseline = 'middle';
          ctx2d.fillText('S', x + cellSize / 2, y + cellSize / 2);
        } else if (r === goal[0] && c === goal[1]) {
          ctx2d.fillStyle = '#ff5c7a';
          ctx2d.beginPath();
          ctx2d.arc(x + cellSize / 2, y + cellSize / 2, cellSize / 2.6, 0, Math.PI * 2);
          ctx2d.fill();
          ctx2d.fillStyle = '#ffffff';
          ctx2d.font = 'bold 11px sans-serif';
          ctx2d.textAlign = 'center';
          ctx2d.textBaseline = 'middle';
          ctx2d.fillText('G', x + cellSize / 2, y + cellSize / 2);
        }
      }
    }

    // Connect path with a glowing line
    if (finalPath.length > 1) {
      ctx2d.beginPath();
      ctx2d.moveTo(start[1] * cellSize + cellSize / 2, start[0] * cellSize + cellSize / 2);
      for (const p of finalPath) {
        ctx2d.lineTo(p[1] * cellSize + cellSize / 2, p[0] * cellSize + cellSize / 2);
      }
      ctx2d.strokeStyle = '#ffc857';
      ctx2d.lineWidth = 3;
      ctx2d.lineCap = 'round';
      ctx2d.lineJoin = 'round';
      ctx2d.stroke();
    }
  }

  // Mouse Interaction
  let isMouseDown = false;

  function handleCellAction(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);

    if (r < 0 || r >= rows || c < 0 || c >= cols) return;

    if (activeTool === 'start') {
      if (grid[r][c] < Infinity && !(r === goal[0] && c === goal[1])) {
        start = [r, c];
        resetAlgorithm();
      }
    } else if (activeTool === 'goal') {
      if (grid[r][c] < Infinity && !(r === start[0] && c === start[1])) {
        goal = [r, c];
        resetAlgorithm();
      }
    } else {
      if ((r === start[0] && c === start[1]) || (r === goal[0] && c === goal[1])) return;

      if (activeTool === 'wall') {
        grid[r][c] = Infinity;
      } else if (activeTool === 'mud') {
        grid[r][c] = 5;
      } else if (activeTool === 'erase') {
        grid[r][c] = 1;
      }
      clearPathOnly();
      draw();
    }
  }

  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    handleCellAction(e);
  });

  window.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isMouseDown && activeTool !== 'start' && activeTool !== 'goal') {
      handleCellAction(e);
    }
  });

  resetAlgorithm();

  return () => {
    engine.pause();
  };
}

export const commands = {
  'pathfinding.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.pathfinding', args });
  },
};

export const terminal = {
  pathfind: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.pathfinding' });
      return 0;
    }

    const algoKey = PATHFINDING_ALGORITHMS[args[0].toLowerCase()] ? args[0].toLowerCase() : 'astar';
    const grid = createEmptyGrid(10, 10);
    const start = [0, 0];
    const goal = [9, 9];
    const algo = PATHFINDING_ALGORITHMS[algoKey];

    io.stdout?.(`Running ${algo.name.en} on 10x10 grid from (0,0) to (9,9)...\n`);
    const gen = algo.generator(grid, start, goal, { diagonal: false });
    let visited = 0;
    let path = [];
    let cost = 0;

    let step = gen.next();
    while (!step.done) {
      if (step.value?.type === 'visit') visited++;
      if (step.value?.type === 'path') {
        path = step.value.path;
        cost = step.value.cost;
      }
      step = gen.next();
    }

    io.stdout?.(`Path found with length ${path.length}, total cost ${cost}, visited ${visited} nodes.\n`);
    return 0;
  },
};
