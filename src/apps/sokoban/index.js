// @ts-check
import { createGameShell, gsButton, gsSelect, gsStat } from '../../games/engine/index.js';
import { h } from '../../ui/dom.js';
import { SOKOBAN_LEVELS } from './levels.js';
import { BOX, FLOOR, PLAYER, TARGET, WALL, parseLevel, solveSokoban } from './solver.js';
import './styles.css';

const APP_ID = 'nexus.sokoban';

export const commands = {
  'sokoban.open': (/** @type {any} */ ctx) => ctx.commands.execute('shell.launchApp', { appId: APP_ID }),
};

export const terminal = {
  sokoban: async (/** @type {any} */ ctx) => {
    await ctx.commands.execute('shell.launchApp', { appId: APP_ID });
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const shell = createGameShell(container, ctx, { appId: APP_ID, className: 'nx-sokoban' });
  const { t, root, audio } = shell;
  await shell.load();

  /** @type {'play' | 'editor'} */
  let mode = 'play';
  let levelIdx = 0;
  let clearedCount = 0;

  // Active game state
  /** @type {import('./solver.js').SokobanLevel} */
  let currentLevel = SOKOBAN_LEVELS[0];
  let playerPos = currentLevel.playerStart;
  /** @type {number[]} */
  let boxPositions = [...currentLevel.boxesStart];
  let steps = 0;
  let pushes = 0;
  /** @type {{ p: number, b: number[], steps: number, pushes: number }[]} */
  const history = [];

  // Editor state
  let editorTool = WALL;
  let editorWidth = 8;
  let editorHeight = 7;
  /** @type {string[][]} */
  let editorGrid = [];

  // Top Bar & HUD
  const topBar = h('div', { class: 'nx-gs-bar' });
  const statSteps = gsStat(t('hud.steps'), 'sk-steps');
  const statPushes = gsStat(t('hud.pushes'), 'sk-pushes');

  const levelSelect = gsSelect(
    SOKOBAN_LEVELS.map((_, i) => ({ value: String(i), label: `${t('hud.level')} ${i + 1}` })),
    '0',
    (v) => {
      levelIdx = Number(v);
      loadLevel(levelIdx);
    },
    { 'data-testid': 'sk-level-select', 'aria-label': t('hud.level') },
  );

  const btnPrev = gsButton(t('actions.prev'), () => prevLevel(), { 'data-testid': 'sk-prev' });
  const btnNext = gsButton(t('actions.next'), () => nextLevel(), { 'data-testid': 'sk-next' });
  const btnRestart = gsButton(t('actions.restart'), () => restartLevel(), { 'data-testid': 'sk-restart' });
  const btnUndo = gsButton(t('actions.undo'), () => undo(), { 'data-testid': 'sk-undo' });
  const btnEditor = gsButton(t('actions.editor'), () => toggleEditor(), { 'data-testid': 'sk-editor' });
  const btnExport = gsButton(t('actions.export'), () => showExportDialog(), { 'data-testid': 'sk-export' });
  const btnImport = gsButton(t('actions.import'), () => showImportDialog(), { 'data-testid': 'sk-import' });
  const btnSolveTest = gsButton(t('actions.testSolve'), () => runSolveTest(), { 'data-testid': 'sk-solve' });
  btnSolveTest.hidden = true;

  topBar.append(
    levelSelect,
    btnPrev,
    btnNext,
    btnRestart,
    btnUndo,
    btnEditor,
    btnExport,
    btnImport,
    btnSolveTest,
    statSteps.el,
    statPushes.el,
  );

  // Editor Toolbar
  const editorBar = h('div', { class: 'nx-sk-editor-bar' });
  editorBar.hidden = true;

  const tools = [
    { id: WALL, label: t('editor.wall') },
    { id: FLOOR, label: t('editor.floor') },
    { id: TARGET, label: t('editor.target') },
    { id: BOX, label: t('editor.box') },
    { id: PLAYER, label: t('editor.player') },
  ];

  /** @type {Record<string, HTMLButtonElement>} */
  const toolBtns = {};
  tools.forEach(({ id, label }) => {
    const btn = /** @type {HTMLButtonElement} */ (
      h(
        'button',
        {
          type: 'button',
          class: `nx-sk-tool-btn ${editorTool === id ? 'active' : ''}`,
          onclick: () => {
            editorTool = id;
            Object.values(toolBtns).forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
          },
        },
        label,
      )
    );
    toolBtns[id] = btn;
    editorBar.append(btn);
  });

  // Main Stage
  const stageEl = h('div', { class: 'nx-sk-stage', 'data-testid': 'sk-stage' });
  const gridEl = h('div', { class: 'nx-sk-grid', 'data-testid': 'sk-grid' });
  stageEl.append(gridEl);

  root.append(topBar, editorBar, stageEl);

  function loadLevel(idx) {
    currentLevel = SOKOBAN_LEVELS[idx];
    restartLevel();
  }

  function prevLevel() {
    if (levelIdx > 0) {
      levelIdx--;
      levelSelect.value = String(levelIdx);
      loadLevel(levelIdx);
    }
  }

  function nextLevel() {
    if (levelIdx < SOKOBAN_LEVELS.length - 1) {
      levelIdx++;
      levelSelect.value = String(levelIdx);
      loadLevel(levelIdx);
    }
  }

  function restartLevel() {
    playerPos = currentLevel.playerStart;
    boxPositions = [...currentLevel.boxesStart];
    steps = 0;
    pushes = 0;
    history.length = 0;
    statSteps.set(0);
    statPushes.set(0);
    renderGrid();
  }

  function saveSnapshot() {
    history.push({
      p: playerPos,
      b: [...boxPositions],
      steps,
      pushes,
    });
  }

  function undo() {
    if (!history.length || mode !== 'play') return;
    const snap = history.pop();
    playerPos = snap.p;
    boxPositions = snap.b;
    steps = snap.steps;
    pushes = snap.pushes;
    statSteps.set(steps);
    statPushes.set(pushes);
    renderGrid();
  }

  function move(dr, dc) {
    if (mode !== 'play') return;
    const { width, height, map } = currentLevel;
    const r = Math.floor(playerPos / width);
    const c = playerPos % width;
    const nr = r + dr;
    const nc = c + dc;

    if (nr < 0 || nr >= height || nc < 0 || nc >= width) return;
    if (map[nr][nc] === WALL) return;

    const nPos = nr * width + nc;
    const boxIdx = boxPositions.indexOf(nPos);

    if (boxIdx !== -1) {
      // Pushing box
      const nnr = nr + dr;
      const nnc = nc + dc;
      if (nnr < 0 || nnr >= height || nnc < 0 || nnc >= width) return;
      if (map[nnr][nnc] === WALL) return;
      const nnPos = nnr * width + nnc;
      if (boxPositions.includes(nnPos)) return; // Box blocked by another box

      saveSnapshot();
      boxPositions[boxIdx] = nnPos;
      boxPositions.sort((a, b) => a - b);
      playerPos = nPos;
      steps++;
      pushes++;
      statSteps.set(steps);
      statPushes.set(pushes);
      audio.play('explosion');
      renderGrid();
      checkWin();
    } else {
      // Simple player step
      saveSnapshot();
      playerPos = nPos;
      steps++;
      statSteps.set(steps);
      audio.play('laser');
      renderGrid();
    }
  }

  function checkWin() {
    const targetSet = new Set(currentLevel.targets);
    const won = boxPositions.every((b) => targetSet.has(b));
    if (won) {
      audio.play('victory');
      shell.confetti();
      clearedCount++;

      ctx.achievements?.unlock('sokoban_first_win');
      if (clearedCount >= 10) ctx.achievements?.unlock('sokoban_10_levels');
      if (clearedCount >= 30) ctx.achievements?.unlock('sokoban_master');

      const score = Math.max(50, 2000 - steps * 10 - pushes * 15);
      shell.finish({
        won: true,
        score,
        mode: `level-${currentLevel.id}`,
        title: t('status.cleared'),
        scoreText: `${steps} ${t('hud.steps')}, ${pushes} ${t('hud.pushes')}`,
        onRestart: () => nextLevel(),
      });
    }
  }

  // Keyboard navigation
  const onKeyDown = (/** @type {KeyboardEvent} */ e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dirMap = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      w: [-1, 0],
      s: [1, 0],
      a: [0, -1],
      d: [0, 1],
      W: [-1, 0],
      S: [1, 0],
      A: [0, -1],
      D: [0, 1],
    };
    const dir = dirMap[e.key];
    if (dir) {
      e.preventDefault();
      move(dir[0], dir[1]);
    } else if (e.key === 'z' || e.key === 'Z') {
      undo();
    }
  };
  root.addEventListener('keydown', onKeyDown);
  shell.onDispose(() => root.removeEventListener('keydown', onKeyDown));

  // Editor mode toggle
  function toggleEditor() {
    mode = mode === 'play' ? 'editor' : 'play';
    btnEditor.textContent = mode === 'editor' ? t('actions.play') : t('actions.editor');
    btnEditor.classList.toggle('primary', mode === 'editor');
    editorBar.hidden = mode !== 'editor';
    btnSolveTest.hidden = mode !== 'editor';
    levelSelect.hidden = mode === 'editor';
    btnPrev.hidden = mode === 'editor';
    btnNext.hidden = mode === 'editor';
    btnRestart.hidden = mode === 'editor';
    btnUndo.hidden = mode === 'editor';

    if (mode === 'editor') {
      initEditorGrid();
    } else {
      currentLevel = parseEditorLevel();
      restartLevel();
    }
    renderGrid();
  }

  function initEditorGrid() {
    editorGrid = [];
    for (let r = 0; r < editorHeight; r++) {
      const row = [];
      for (let c = 0; c < editorWidth; c++) {
        if (r === 0 || r === editorHeight - 1 || c === 0 || c === editorWidth - 1) row.push(WALL);
        else row.push(FLOOR);
      }
      editorGrid.push(row);
    }
  }

  function parseEditorLevel() {
    const lines = editorGrid.map((r) => r.join(''));
    return parseLevel(lines, 999);
  }

  function runSolveTest() {
    const lvl = parseEditorLevel();
    const solvable = solveSokoban(lvl, 30000);
    shell.toast(solvable ? t('editor.solvable') : t('editor.unsolvable'));
    if (solvable) {
      ctx.achievements?.unlock('sokoban_builder');
    }
  }

  function renderGrid() {
    gridEl.innerHTML = '';

    if (mode === 'editor') {
      gridEl.style.gridTemplateColumns = `repeat(${editorWidth}, 1fr)`;
      gridEl.style.gridTemplateRows = `repeat(${editorHeight}, 1fr)`;

      for (let r = 0; r < editorHeight; r++) {
        for (let c = 0; c < editorWidth; c++) {
          const ch = editorGrid[r][c];
          const cell = h('button', {
            type: 'button',
            class: `nx-sk-cell ${ch === WALL ? 'wall' : 'floor'}`,
            onclick: () => {
              editorGrid[r][c] = editorTool;
              renderGrid();
            },
          });
          if (ch === TARGET) cell.classList.add('target');
          else if (ch === BOX) cell.classList.add('box');
          else if (ch === PLAYER) cell.textContent = '🤖';
          gridEl.append(cell);
        }
      }
      return;
    }

    // Play mode grid
    const { width, height, map, targets } = currentLevel;
    gridEl.style.gridTemplateColumns = `repeat(${width}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${height}, 1fr)`;
    const targetSet = new Set(targets);
    const boxSet = new Set(boxPositions);

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const idx = r * width + c;
        const isWall = map[r][c] === WALL;
        const isTarget = targetSet.has(idx);
        const isBox = boxSet.has(idx);
        const isPlayer = playerPos === idx;

        const cell = h('div', { class: 'nx-sk-cell' });
        if (isWall) {
          cell.classList.add('wall');
        } else {
          cell.classList.add('floor');
          if (isTarget) cell.classList.add('target');
          if (isBox) {
            cell.classList.add(isTarget ? 'box-on-target' : 'box');
            cell.textContent = '📦';
          }
          if (isPlayer) {
            cell.classList.add('player');
            cell.textContent = '🤖';
          }
        }
        gridEl.append(cell);
      }
    }
  }

  function showExportDialog() {
    const lines = mode === 'editor' ? editorGrid.map((r) => r.join('')) : currentLevel.map;
    const text = lines.join('\n');
    const textarea = h('textarea', { readonly: true }, text);
    shell.dialog(
      t('actions.export'),
      [textarea],
      [
        {
          label: shell.labels().copy ?? 'Copy',
          primary: true,
          onClick: () => {
            if (ctx.clipboard?.writeText) ctx.clipboard.writeText(text);
            shell.toast('Copied to clipboard');
          },
        },
        { label: shell.labels().close },
      ],
    );
  }

  function showImportDialog() {
    const textarea = h('textarea', { placeholder: '#####\n#@$.#\n#####' });
    shell.dialog(
      t('actions.import'),
      [textarea],
      [
        {
          label: t('actions.import'),
          primary: true,
          onClick: () => {
            const raw = textarea.value.trim();
            if (!raw) return;
            try {
              const parsed = parseLevel(raw, 999);
              currentLevel = parsed;
              if (mode === 'editor') {
                editorHeight = parsed.height;
                editorWidth = parsed.width;
                editorGrid = parsed.map.map((line) => line.split(''));
              }
              restartLevel();
              ctx.achievements?.unlock('sokoban_builder');
              shell.toast(t('status.imported'));
            } catch {
              return false;
            }
          },
        },
        { label: shell.labels().close },
      ],
    );
  }

  shell.enablePause({
    canPause: () => mode === 'play',
    onRestart: () => restartLevel(),
  });

  loadLevel(0);

  return {
    unmount: () => shell.dispose(),
  };
}
