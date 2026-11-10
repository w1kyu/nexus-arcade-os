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
import { SORTING_ALGORITHMS, generateInputArray } from './algorithms.js';
import { SortingAudioSynthesizer } from './audio.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);
  const audio = new SortingAudioSynthesizer();

  let selectedAlgorithmKey = 'bubble';
  let inputType = 'random';
  let arraySize = 30;
  let customInputStr = '';
  let viewMode = 'bars'; // 'bars' | 'dots' | 'wheel'
  let isRaceMode = false;

  /** @type {number[]} */
  let array = generateInputArray(inputType, arraySize);
  /** @type {Set<number>} */
  let comparingIndices = new Set();
  /** @type {Set<number>} */
  let swappingIndices = new Set();
  /** @type {Set<number>} */
  let sortedIndices = new Set();

  const engine = new VisualizerEngine({
    defaultSpeed: 100,
    getSnapshot: () => ({
      array: [...array],
      comparing: Array.from(comparingIndices),
      swapping: Array.from(swappingIndices),
      sorted: Array.from(sortedIndices),
    }),
    restoreSnapshot: (snap) => {
      array = [...snap.array];
      comparingIndices = new Set(snap.comparing);
      swappingIndices = new Set(snap.swapping);
      sortedIndices = new Set(snap.sorted);
      draw();
    },
    onStep: (step) => {
      comparingIndices.clear();
      swappingIndices.clear();

      if (step.type === 'compare' && step.indices) {
        step.indices.forEach((idx) => {
          comparingIndices.add(idx);
          if (array[idx] !== undefined) {
            audio.playTone(array[idx], 1, Math.max(...array, 100));
          }
        });
      } else if (step.type === 'swap' && step.indices) {
        step.indices.forEach((idx) => swappingIndices.add(idx));
      } else if (step.type === 'set' && step.indices) {
        step.indices.forEach((idx) => swappingIndices.add(idx));
      } else if (step.type === 'sorted' && step.indices) {
        step.indices.forEach((idx) => sortedIndices.add(idx));
      }

      pseudoPanel.update();
      draw();
    },
    onReset: () => {
      comparingIndices.clear();
      swappingIndices.clear();
      sortedIndices.clear();
      pseudoPanel.update();
      draw();
    },
  });

  // Root UI
  const root = h('div', { class: 'nx-sorting-app' });

  // ─── Header Controls ───
  const header = h('div', { class: 'nx-sorting-header' });
  const controlsRow = h('div', { class: 'nx-sorting-controls-row' });

  // Algorithm select
  const algoSelect = h('select', { class: 'nx-input small' }, [
    ...Object.entries(SORTING_ALGORITHMS).map(([key, meta]) =>
      h(
        'option',
        { value: key, selected: key === selectedAlgorithmKey },
        meta.name[ctx.i18n.currentLocale === 'de' ? 'de' : 'en'] || meta.name.en,
      ),
    ),
  ]);
  algoSelect.addEventListener('change', () => {
    selectedAlgorithmKey = algoSelect.value;
    updateAlgorithm();
  });

  // Input select
  const inputSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: 'random', selected: true }, t('inputs.random')),
    h('option', { value: 'sorted' }, t('inputs.sorted')),
    h('option', { value: 'reversed' }, t('inputs.reversed')),
    h('option', { value: 'nearly' }, t('inputs.nearly')),
    h('option', { value: 'few_unique' }, t('inputs.few_unique')),
    h('option', { value: 'custom' }, t('inputs.custom')),
  ]);
  inputSelect.addEventListener('change', async () => {
    inputType = inputSelect.value;
    if (inputType === 'custom') {
      const val = prompt(t('controls.customPrompt'), customInputStr || '15, 8, 42, 4, 16, 23');
      if (val) customInputStr = val;
    }
    resetInput();
  });

  // Size slider
  const sizeSlider = h('input', {
    type: 'range',
    min: '5',
    max: '200',
    value: String(arraySize),
    class: 'nx-input small',
    title: t('controls.size'),
  });
  sizeSlider.addEventListener('input', () => {
    arraySize = Number(sizeSlider.value);
    resetInput();
  });

  // View select
  const viewSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: 'bars', selected: true }, t('controls.bars')),
    h('option', { value: 'dots' }, t('controls.dots')),
    h('option', { value: 'wheel' }, t('controls.wheel')),
  ]);
  viewSelect.addEventListener('change', () => {
    viewMode = viewSelect.value;
    draw();
  });

  // Sound toggle button
  const soundBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('controls.sound') },
    icon('volume-off', { size: 14 }),
    h('span', {}, t('controls.sound')),
  );
  soundBtn.addEventListener('click', () => {
    const on = audio.toggle();
    soundBtn.classList.toggle('primary', on);
    const existingSvg = soundBtn.querySelector('.nx-icon');
    if (existingSvg) {
      existingSvg.outerHTML = icon(on ? 'volume' : 'volume-off', { size: 14 });
    }
  });

  // Race mode toggle button
  const raceBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('controls.race') },
    icon('trophy', { size: 14 }),
    h('span', {}, t('controls.race')),
  );
  raceBtn.addEventListener('click', () => {
    isRaceMode = !isRaceMode;
    raceBtn.classList.toggle('primary', isRaceMode);
    toggleRaceMode();
  });

  // Export / Save buttons
  const saveBtn = h('button', { class: 'nx-cs-btn', title: t('controls.save') }, icon('download', { size: 14 }));
  saveBtn.addEventListener('click', async () => {
    const filename = `sorting_${selectedAlgorithmKey}_${Date.now()}.csstate`;
    await saveStateToVfs(ctx.fs, `/home/documents/${filename}`, {
      algorithm: selectedAlgorithmKey,
      array,
      counters: engine.counters,
    });
    ctx.notify({ title: t('app.title'), message: `Saved ${filename}` });
  });

  const loadBtn = h('button', { class: 'nx-cs-btn', title: t('controls.load') }, icon('folder-open', { size: 14 }));
  loadBtn.addEventListener('click', async () => {
    const path = prompt('Enter VFS path to load state:', '/home/documents/sorting_state.csstate');
    if (!path) return;
    try {
      const data = await loadStateFromVfs(ctx.fs, path);
      if (data && data.array) {
        array = data.array;
        if (data.algorithm && SORTING_ALGORITHMS[data.algorithm]) {
          selectedAlgorithmKey = data.algorithm;
          algoSelect.value = selectedAlgorithmKey;
        }
        updateAlgorithm(false);
      }
    } catch (err) {
      alert(`Failed to load state: ${err}`);
    }
  });

  const exportPngBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('controls.exportPng') },
    icon('camera', { size: 14 }),
  );
  exportPngBtn.addEventListener('click', () => {
    exportPng(canvas, `sorting_${selectedAlgorithmKey}.png`, ctx.fs);
  });

  const exportSvgBtn = h('button', { class: 'nx-cs-btn', title: t('controls.exportSvg') }, icon('image', { size: 14 }));
  exportSvgBtn.addEventListener('click', () => {
    const w = 800;
    const h = 400;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    const n = array.length;
    const maxVal = Math.max(...array, 1);
    const barWidth = w / n;
    for (let i = 0; i < n; i++) {
      const barH = (array[i] / maxVal) * (h - 20);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(i * barWidth));
      rect.setAttribute('y', String(h - barH - 10));
      rect.setAttribute('width', String(barWidth - 1));
      rect.setAttribute('height', String(barH));
      rect.setAttribute('fill', '#3ef0ff');
      svg.appendChild(rect);
    }
    exportSvg(svg, `sorting_${selectedAlgorithmKey}.svg`, ctx.fs);
  });

  controlsRow.append(
    algoSelect,
    inputSelect,
    sizeSlider,
    viewSelect,
    soundBtn,
    raceBtn,
    saveBtn,
    loadBtn,
    exportPngBtn,
    exportSvgBtn,
  );
  header.append(controlsRow);

  // Engine Toolbar
  const engineToolbar = renderVisualizerControls(engine, { t });

  // ─── Main Content ───
  const main = h('div', { class: 'nx-sorting-main' });
  const viewPane = h('div', { class: 'nx-sorting-view-pane' });
  const canvasWrap = h('div', { class: 'nx-sorting-canvas-wrap' });
  const canvas = document.createElement('canvas');
  canvasWrap.append(canvas);
  viewPane.append(canvasWrap);

  // Race Mode Grid Container (hidden by default)
  const raceGrid = h('div', { class: 'nx-sorting-race-grid' });
  raceGrid.hidden = true;
  viewPane.append(raceGrid);

  // ─── Sidebar ───
  const sidebar = h('div', { class: 'nx-sorting-sidebar' });

  // Complexity Panel
  const complexityPanel = h('div', { class: 'nx-sorting-complexity' });
  const complexityTitle = h('h4', {}, t('complexity.title'));
  const complexityGrid = h('div', { class: 'nx-complexity-grid' });
  complexityPanel.append(complexityTitle, complexityGrid);

  // Pseudocode Panel
  const pseudoPanel = renderPseudocodePanel(
    SORTING_ALGORITHMS[selectedAlgorithmKey].pseudocode,
    () => {
      const step = engine.getCurrentStep();
      return step ? step.line || -1 : -1;
    },
    {
      locale: ctx.i18n.currentLocale,
      t,
    },
  );

  sidebar.append(complexityPanel, pseudoPanel);
  main.append(viewPane, sidebar);
  root.append(header, engineToolbar, main);
  container.append(root);

  function updateComplexity() {
    const meta = SORTING_ALGORITHMS[selectedAlgorithmKey];
    if (!meta) return;
    complexityGrid.innerHTML = `
      <div class="nx-complexity-item"><span>${t('complexity.best')}</span><span>${meta.complexity.best}</span></div>
      <div class="nx-complexity-item"><span>${t('complexity.average')}</span><span>${meta.complexity.average}</span></div>
      <div class="nx-complexity-item"><span>${t('complexity.worst')}</span><span>${meta.complexity.worst}</span></div>
      <div class="nx-complexity-item"><span>${t('complexity.space')}</span><span>${meta.complexity.space}</span></div>
      <div class="nx-complexity-item"><span>${t('complexity.stable')}</span><span>${meta.complexity.stable ? t('complexity.yes') : t('complexity.no')}</span></div>
      <div class="nx-complexity-item"><span>${t('complexity.inPlace')}</span><span>${meta.complexity.inPlace ? t('complexity.yes') : t('complexity.no')}</span></div>
    `;
  }

  function resetInput() {
    array = generateInputArray(inputType, arraySize, customInputStr);
    updateAlgorithm();
  }

  function updateAlgorithm(resetArray = true) {
    if (resetArray) {
      array = generateInputArray(inputType, arraySize, customInputStr);
    }
    const meta = SORTING_ALGORITHMS[selectedAlgorithmKey];
    if (!meta) return;

    comparingIndices.clear();
    swappingIndices.clear();
    sortedIndices.clear();

    engine.init(meta.generator, array);
    updateComplexity();
    pseudoPanel.setLocale(ctx.i18n.currentLocale);
    draw();
  }

  function resizeCanvas() {
    const rect = canvasWrap.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      draw();
    }
  }

  function draw() {
    if (isRaceMode) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx2d.save();
    ctx2d.scale(dpr, dpr);
    ctx2d.clearRect(0, 0, w, h);

    const n = array.length;
    if (n === 0) {
      ctx2d.restore();
      return;
    }
    const maxVal = Math.max(...array, 1);

    if (viewMode === 'bars') {
      const gap = n > 80 ? 0 : 2;
      const barWidth = Math.max(1, (w - (n + 1) * gap) / n);
      for (let i = 0; i < n; i++) {
        const val = array[i];
        const barHeight = Math.max(2, (val / maxVal) * (h - 20));
        const x = gap + i * (barWidth + gap);
        const y = h - barHeight - 10;

        if (comparingIndices.has(i)) {
          ctx2d.fillStyle = '#ffc857'; // warning / yellow
        } else if (swappingIndices.has(i)) {
          ctx2d.fillStyle = '#ff5c7a'; // danger / red
        } else if (sortedIndices.has(i)) {
          ctx2d.fillStyle = '#3ddc97'; // success / green
        } else {
          ctx2d.fillStyle = '#3ef0ff'; // accent cyan
        }

        ctx2d.fillRect(x, y, barWidth, barHeight);
      }
    } else if (viewMode === 'dots') {
      const radius = Math.max(2, Math.min(6, (w / n) * 0.4));
      for (let i = 0; i < n; i++) {
        const val = array[i];
        const cx = (i + 0.5) * (w / n);
        const cy = h - 20 - (val / maxVal) * (h - 40);

        if (comparingIndices.has(i)) {
          ctx2d.fillStyle = '#ffc857';
        } else if (swappingIndices.has(i)) {
          ctx2d.fillStyle = '#ff5c7a';
        } else if (sortedIndices.has(i)) {
          ctx2d.fillStyle = '#3ddc97';
        } else {
          ctx2d.fillStyle = '#3ef0ff';
        }

        ctx2d.beginPath();
        ctx2d.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx2d.fill();
      }
    } else if (viewMode === 'wheel') {
      const cx = w / 2;
      const cy = h / 2;
      const outerR = Math.min(cx, cy) - 20;
      const innerR = 20;
      const anglePerElem = (Math.PI * 2) / n;

      for (let i = 0; i < n; i++) {
        const val = array[i];
        const startAngle = i * anglePerElem - Math.PI / 2;
        const endAngle = startAngle + anglePerElem;

        const hue = Math.floor((val / maxVal) * 360);
        if (comparingIndices.has(i)) {
          ctx2d.fillStyle = '#ffffff';
        } else if (swappingIndices.has(i)) {
          ctx2d.fillStyle = '#ff5c7a';
        } else {
          ctx2d.fillStyle = `hsl(${hue}, 85%, 60%)`;
        }

        ctx2d.beginPath();
        ctx2d.arc(cx, cy, outerR, startAngle, endAngle);
        ctx2d.arc(cx, cy, innerR, endAngle, startAngle, true);
        ctx2d.closePath();
        ctx2d.fill();
      }
    }

    ctx2d.restore();
  }

  // ─── Race Mode ───
  /** @type {any[]} */
  let raceRacerStates = [];
  let raceTimer = null;

  function toggleRaceMode() {
    engine.pause();
    if (isRaceMode) {
      canvasWrap.hidden = true;
      raceGrid.hidden = false;
      sidebar.hidden = true;
      setupRace();
    } else {
      canvasWrap.hidden = false;
      raceGrid.hidden = true;
      sidebar.hidden = false;
      if (raceTimer) clearInterval(raceTimer);
      updateAlgorithm();
    }
  }

  function setupRace() {
    raceGrid.innerHTML = '';
    const raceAlgos = ['quick', 'merge', 'heap', 'bubble'];
    const sharedInput = [...array];

    raceRacerStates = raceAlgos.map((key) => {
      const meta = SORTING_ALGORITHMS[key];
      const rArr = [...sharedInput];
      const gen = meta.generator(rArr);
      const card = h('div', { class: 'nx-race-card' });
      const rHeader = h('div', { class: 'nx-race-card-header' });
      const titleSpan = h('span', {}, meta.name[ctx.i18n.currentLocale === 'de' ? 'de' : 'en'] || meta.name.en);
      const rankBadge = h('span', { class: 'nx-cs-counter-badge' }, t('race.running'));
      rHeader.append(titleSpan, rankBadge);

      const rCanvas = document.createElement('canvas');
      rCanvas.className = 'nx-race-card-canvas';

      const stats = h('div', { class: 'nx-race-stats' });
      const compsSpan = h('span', {}, `${t('race.comps')}: 0`);
      const swapsSpan = h('span', {}, `${t('race.swaps')}: 0`);
      stats.append(compsSpan, swapsSpan);

      card.append(rHeader, rCanvas, stats);
      raceGrid.append(card);

      return {
        key,
        arr: rArr,
        gen,
        card,
        canvas: rCanvas,
        compsSpan,
        swapsSpan,
        rankBadge,
        comps: 0,
        swaps: 0,
        done: false,
        rank: 0,
      };
    });

    let finishedCount = 0;
    if (raceTimer) clearInterval(raceTimer);

    raceTimer = setInterval(() => {
      let anyActive = false;
      for (const racer of raceRacerStates) {
        if (!racer.done) {
          anyActive = true;
          // Step 2-4 times per tick for smooth race
          for (let step = 0; step < 3 && !racer.done; step++) {
            const next = racer.gen.next();
            if (next.done) {
              racer.done = true;
              finishedCount++;
              racer.rank = finishedCount;
              racer.rankBadge.innerHTML = `<strong>#${racer.rank}</strong> ${t('race.finished')}`;
              break;
            }
            const s = next.value;
            if (s.type === 'compare') racer.comps++;
            if (s.type === 'swap' || s.type === 'set') racer.swaps++;
          }
          racer.compsSpan.textContent = `${t('race.comps')}: ${racer.comps}`;
          racer.swapsSpan.textContent = `${t('race.swaps')}: ${racer.swaps}`;
        }
        drawMiniBars(racer.canvas, racer.arr);
      }
      if (!anyActive && raceTimer) {
        clearInterval(raceTimer);
      }
    }, 40);
  }

  function drawMiniBars(miniCanvas, arr) {
    const dpr = window.devicePixelRatio || 1;
    const rect = miniCanvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    miniCanvas.width = rect.width * dpr;
    miniCanvas.height = (rect.height || 120) * dpr;
    const ctx = miniCanvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const n = arr.length;
    const maxVal = Math.max(...arr, 1);
    const barWidth = Math.max(1, rect.width / n);
    ctx.fillStyle = '#3ef0ff';
    for (let i = 0; i < n; i++) {
      const h = (arr[i] / maxVal) * (rect.height - 10);
      ctx.fillRect(i * barWidth, rect.height - h, barWidth - 1, h);
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    resizeCanvas();
  });
  resizeObserver.observe(canvasWrap);

  updateAlgorithm();
  setTimeout(resizeCanvas, 50);

  return () => {
    resizeObserver.disconnect();
    engine.pause();
    if (raceTimer) clearInterval(raceTimer);
  };
}

export const commands = {
  'sorting.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.sorting', args });
  },
};

export const terminal = {
  sort: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.sorting' });
      return 0;
    }

    let algoKey = 'bubble';
    let nums;

    if (SORTING_ALGORITHMS[args[0].toLowerCase()]) {
      algoKey = args[0].toLowerCase();
      nums = args
        .slice(1)
        .map(Number)
        .filter((n) => !isNaN(n));
    } else {
      nums = args.map(Number).filter((n) => !isNaN(n));
    }

    if (nums.length === 0) {
      nums = [5, 2, 9, 1, 5, 6];
    }

    const algo = SORTING_ALGORITHMS[algoKey];
    io.stdout?.(`Sorting ${nums.length} elements with ${algo.name.en}...\n`);
    const copy = [...nums];
    const gen = algo.generator(copy);
    let comps = 0;
    let swaps = 0;

    let step = gen.next();
    while (!step.done) {
      if (step.value?.type === 'compare') comps++;
      if (step.value?.type === 'swap' || step.value?.type === 'set') swaps++;
      step = gen.next();
    }

    io.stdout?.(`Result: [${copy.join(', ')}]\n`);
    io.stdout?.(`Comparisons: ${comps}, Swaps: ${swaps}\n`);
    return 0;
  },
};
