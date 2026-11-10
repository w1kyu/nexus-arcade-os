// @ts-check
import { h, icon } from '../dom.js';
import './engine.css';

/**
 * @typedef {object} VisualizerStep
 * @property {string} [type] - e.g. 'compare', 'swap', 'visit', 'set', 'highlight'
 * @property {number} [line] - 1-based line number in pseudocode
 * @property {Record<string, number>} [counters] - Delta or absolute counters
 * @property {string} [message] - Textual explanation of current step
 * @property {any} [data] - Step specific payload (indices, node, value, etc.)
 */

/**
 * @typedef {object} EngineOptions
 * @property {(step: VisualizerStep, counters: Record<string, number>) => void} [onStep]
 * @property {() => void} [onReset]
 * @property {() => any} [getSnapshot]
 * @property {(snapshot: any) => void} [restoreSnapshot]
 * @property {number} [defaultSpeed] - Interval in ms (default 200)
 */

export class VisualizerEngine {
  /**
   * @param {EngineOptions} [opts]
   */
  constructor(opts = {}) {
    this.opts = opts;
    this.speed = opts.defaultSpeed ?? 200;
    this.generator = null;
    this.generatorFn = null;
    this.generatorArgs = [];

    /** @type {VisualizerStep[]} */
    this.history = [];
    /** @type {Array<Record<string, number>>} */
    this.countersHistory = [];
    /** @type {any[]} */
    this.statesHistory = [];

    this.currentIndex = -1;
    this.isPlaying = false;
    this.isDone = false;
    /** @type {Record<string, number>} */
    this.counters = { comparisons: 0, swaps: 0, visited: 0, operations: 0 };
    this.initialCounters = { ...this.counters };
    this.initialState = null;

    /** @type {Array<() => void>} */
    this.listeners = [];
    this._timer = null;
  }

  /**
   * Sets up an algorithm generator function and initial arguments.
   * @param {GeneratorFunction} genFn
   * @param  {...any} args
   */
  init(genFn, ...args) {
    this.pause();
    this.generatorFn = genFn;
    this.generatorArgs = args;
    this.history = [];
    this.countersHistory = [];
    this.statesHistory = [];
    this.currentIndex = -1;
    this.isDone = false;
    this.counters = { comparisons: 0, swaps: 0, visited: 0, operations: 0 };
    if (this.opts.getSnapshot) {
      this.initialState = JSON.parse(JSON.stringify(this.opts.getSnapshot()));
    }
    this.generator = genFn(...args);
    this._notify();
  }

  /**
   * Registers a state change callback (e.g. for re-rendering controls).
   * @param {() => void} fn
   */
  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  _notify() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.error('VisualizerEngine listener error:', err);
      }
    }
  }

  /**
   * Advances by one step.
   * @returns {boolean} True if advanced, false if finished.
   */
  stepForward() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      const step = this.history[this.currentIndex];
      this.counters = { ...this.countersHistory[this.currentIndex] };
      if (this.opts.restoreSnapshot && this.statesHistory[this.currentIndex] !== undefined) {
        this.opts.restoreSnapshot(JSON.parse(JSON.stringify(this.statesHistory[this.currentIndex])));
      }
      this.opts.onStep?.(step, this.counters);
      this._notify();
      return true;
    }

    if (!this.generator || this.isDone) {
      this.pause();
      return false;
    }

    const next = this.generator.next();
    if (next.done) {
      this.isDone = true;
      this.pause();
      this._notify();
      return false;
    }

    const step = next.value || {};
    // Update counters
    if (step.counters) {
      for (const [k, v] of Object.entries(step.counters)) {
        this.counters[k] = (this.counters[k] || 0) + v;
      }
    } else if (step.type === 'compare') {
      this.counters.comparisons = (this.counters.comparisons || 0) + 1;
    } else if (step.type === 'swap') {
      this.counters.swaps = (this.counters.swaps || 0) + 1;
    } else if (step.type === 'visit') {
      this.counters.visited = (this.counters.visited || 0) + 1;
    }
    this.counters.operations = (this.counters.operations || 0) + 1;

    this.history.push(step);
    this.countersHistory.push({ ...this.counters });
    if (this.opts.getSnapshot) {
      this.statesHistory.push(JSON.parse(JSON.stringify(this.opts.getSnapshot())));
    }
    this.currentIndex++;

    this.opts.onStep?.(step, this.counters);
    this._notify();
    return true;
  }

  /**
   * Steps backward by one step.
   * @returns {boolean} True if stepped back, false if already at start.
   */
  stepBackward() {
    this.pause();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const step = this.history[this.currentIndex];
      this.counters = { ...this.countersHistory[this.currentIndex] };
      if (this.opts.restoreSnapshot && this.statesHistory[this.currentIndex] !== undefined) {
        this.opts.restoreSnapshot(JSON.parse(JSON.stringify(this.statesHistory[this.currentIndex])));
      }
      this.opts.onStep?.(step, this.counters);
      this._notify();
      return true;
    } else if (this.currentIndex === 0) {
      this.reset();
      return true;
    }
    return false;
  }

  /**
   * Resets the engine to the initial state without changing inputs.
   */
  reset() {
    this.pause();
    this.currentIndex = -1;
    this.isDone = false;
    this.counters = { comparisons: 0, swaps: 0, visited: 0, operations: 0 };
    if (this.opts.restoreSnapshot && this.initialState !== null) {
      this.opts.restoreSnapshot(JSON.parse(JSON.stringify(this.initialState)));
    }
    this.opts.onReset?.();
    if (this.generatorFn) {
      this.history = [];
      this.countersHistory = [];
      this.statesHistory = [];
      this.generator = this.generatorFn(...this.generatorArgs);
    }
    this._notify();
  }

  /**
   * Starts playback.
   */
  play() {
    if (this.isPlaying || this.isDone) return;
    this.isPlaying = true;
    this._notify();

    const loop = () => {
      if (!this.isPlaying) return;
      const ok = this.stepForward();
      if (ok && this.isPlaying) {
        this._timer = setTimeout(loop, this.speed);
      } else {
        this.pause();
      }
    };
    this._timer = setTimeout(loop, this.speed);
  }

  /**
   * Pauses playback.
   */
  pause() {
    this.isPlaying = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._notify();
  }

  /**
   * Toggles between play and pause.
   */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      if (this.isDone) {
        this.reset();
      }
      this.play();
    }
  }

  /**
   * Sets playback speed in milliseconds per step.
   * @param {number} ms
   */
  setSpeed(ms) {
    this.speed = Math.max(10, Math.min(2000, ms));
  }

  /**
   * Current active step.
   * @returns {VisualizerStep | null}
   */
  getCurrentStep() {
    return this.currentIndex >= 0 && this.currentIndex < this.history.length ? this.history[this.currentIndex] : null;
  }

  /**
   * Returns serializable state for saving to VFS.
   */
  exportState() {
    return {
      version: 1,
      currentIndex: this.currentIndex,
      counters: this.counters,
      historyLength: this.history.length,
      snapshot: this.opts.getSnapshot ? this.opts.getSnapshot() : null,
    };
  }
}

/**
 * Renders standard visualizer toolbar controls (play/pause/step/speed/counters).
 * @param {VisualizerEngine} engine
 * @param {object} [opts]
 * @param {(k: string, v?: Record<string, any>) => string} [opts.t]
 * @param {HTMLElement[]} [opts.customButtons]
 * @param {boolean} [opts.showCounters]
 * @returns {HTMLElement}
 */
export function renderVisualizerControls(engine, opts = {}) {
  const t = opts.t || ((k) => k);
  const toolbar = h('div', { class: 'nx-cs-engine-toolbar' });

  const controls = h('div', { class: 'nx-cs-engine-controls' });

  const playBtn = h(
    'button',
    { class: 'nx-cs-btn primary', title: t('engine.play', 'Play / Pause') },
    icon('play', { size: 14 }),
    h('span', { class: 'nx-cs-btn-text' }, t('engine.play', 'Play')),
  );
  playBtn.addEventListener('click', () => engine.togglePlay());

  const stepBackBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('engine.stepBack', 'Step Back') },
    icon('skip-back', { size: 14 }),
  );
  stepBackBtn.addEventListener('click', () => engine.stepBackward());

  const stepForwardBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('engine.stepForward', 'Step Forward') },
    icon('skip-forward', { size: 14 }),
  );
  stepForwardBtn.addEventListener('click', () => engine.stepForward());

  const resetBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('engine.reset', 'Reset') },
    icon('refresh', { size: 14 }),
  );
  resetBtn.addEventListener('click', () => engine.reset());

  controls.append(playBtn, stepBackBtn, stepForwardBtn, resetBtn);

  if (opts.customButtons) {
    for (const b of opts.customButtons) controls.append(b);
  }

  // Speed slider
  const speedWrap = h('div', { class: 'nx-cs-engine-speed' });
  const speedLabel = h('span', {}, t('engine.speed', 'Speed:'));
  const speedInput = h('input', {
    type: 'range',
    min: '10',
    max: '800',
    step: '10',
    value: String(810 - engine.speed),
    title: t('engine.speedSlider', 'Adjust execution speed'),
  });
  speedInput.addEventListener('input', () => {
    // Inverted so right is faster (smaller ms)
    engine.setSpeed(810 - Number(speedInput.value));
  });
  speedWrap.append(speedLabel, speedInput);

  // Counters
  const countersWrap = h('div', { class: 'nx-cs-engine-counters' });
  const stepBadge = h('span', { class: 'nx-cs-counter-badge' });
  const compBadge = h('span', { class: 'nx-cs-counter-badge' });
  const swapBadge = h('span', { class: 'nx-cs-counter-badge' });

  if (opts.showCounters !== false) {
    countersWrap.append(stepBadge, compBadge, swapBadge);
  }

  toolbar.append(controls, speedWrap, countersWrap);

  function update() {
    const playText = playBtn.querySelector('.nx-cs-btn-text');
    if (playText) {
      playText.textContent = engine.isPlaying ? t('engine.pause', 'Pause') : t('engine.play', 'Play');
    }
    // Update play button icon
    const existingSvg = playBtn.querySelector('.nx-icon');
    if (existingSvg) {
      existingSvg.outerHTML = icon(engine.isPlaying ? 'pause' : 'play', { size: 14 });
    }

    stepBackBtn.disabled = engine.currentIndex < 0 || engine.isPlaying;
    stepForwardBtn.disabled = engine.isDone || engine.isPlaying;

    stepBadge.innerHTML = `${t('engine.step', 'Step')}: <strong>${Math.max(0, engine.currentIndex + 1)}</strong>`;
    compBadge.innerHTML = `${t('engine.comparisons', 'Comparisons')}: <strong>${engine.counters.comparisons || 0}</strong>`;
    swapBadge.innerHTML = `${t('engine.swaps', 'Swaps/Writes')}: <strong>${(engine.counters.swaps || 0) + (engine.counters.visited || 0)}</strong>`;
  }

  engine.subscribe(update);
  update();

  return toolbar;
}

/**
 * Renders a pseudocode panel with current line highlighting and EN/DE toggle.
 * @param {object} codeByLocale - { en: string[], de: string[] }
 * @param {() => number} getCurrentLine - Function returning current 1-based line or -1
 * @param {object} [opts]
 * @param {string} [opts.locale] - 'en' | 'de'
 * @param {string} [opts.title] - panel title
 * @param {(k: string) => string} [opts.t]
 * @returns {HTMLElement & { update: () => void, setLocale: (loc: string) => void }}
 */
export function renderPseudocodePanel(codeByLocale, getCurrentLine, opts = {}) {
  const t = opts.t || ((k) => k);
  let activeLocale = opts.locale === 'de' ? 'de' : 'en';

  const panel = h('div', { class: 'nx-cs-pseudo-panel' });
  const header = h('div', { class: 'nx-cs-pseudo-header' });
  const title = h('span', {}, opts.title || t('engine.pseudocode', 'Pseudocode'));

  const langSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: 'en', selected: activeLocale === 'en' }, 'EN'),
    h('option', { value: 'de', selected: activeLocale === 'de' }, 'DE'),
  ]);
  langSelect.addEventListener('change', () => {
    activeLocale = langSelect.value;
    renderLines();
  });

  header.append(title, langSelect);
  const linesContainer = h('div', { class: 'nx-cs-pseudo-lines' });
  panel.append(header, linesContainer);

  function renderLines() {
    linesContainer.innerHTML = '';
    const lines = codeByLocale[activeLocale] || codeByLocale.en || [];
    const activeLine = getCurrentLine();

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const isCurrent = lineNum === activeLine;
      const lineEl = h(
        'div',
        { class: `nx-cs-pseudo-line${isCurrent ? ' active' : ''}` },
        h('span', { class: 'nx-cs-pseudo-line-num' }, String(lineNum)),
        h('span', { class: 'nx-cs-pseudo-line-code' }, lineText),
      );
      linesContainer.append(lineEl);
      if (isCurrent) {
        lineEl.scrollIntoView?.({ block: 'nearest' });
      }
    });
  }

  renderLines();

  return Object.assign(panel, {
    update: renderLines,
    setLocale: (/** @type {string} */ loc) => {
      activeLocale = loc === 'de' ? 'de' : 'en';
      langSelect.value = activeLocale;
      renderLines();
    },
  });
}

/**
 * Exports an SVG element to a downloadable .svg file or saves to VFS if ctx provided.
 * @param {SVGElement} svgEl
 * @param {string} filename
 * @param {import('../../kernel/types').VFS} [fs]
 */
export async function exportSvg(svgEl, filename = 'visualizer.svg', fs = undefined) {
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgEl);
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  if (fs) {
    try {
      await fs.writeFile(`/home/pictures/${filename}`, source);
      return;
    } catch {
      // fallback to browser download
    }
  }

  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports a Canvas or SVG element to a PNG image.
 * @param {HTMLCanvasElement | SVGElement} el
 * @param {string} filename
 * @param {import('../../kernel/types').VFS} [fs]
 */
export async function exportPng(el, filename = 'visualizer.png', fs = undefined) {
  let canvas;
  if (el instanceof HTMLCanvasElement) {
    canvas = el;
  } else {
    // Render SVG into canvas
    canvas = document.createElement('canvas');
    const rect = el.getBoundingClientRect();
    canvas.width = rect.width || 800;
    canvas.height = rect.height || 500;
    const ctx = canvas.getContext('2d');
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(el);
    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    await new Promise((resolve, reject) => {
      img.onload = () => {
        if (ctx) ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  const dataUrl = canvas.toDataURL('image/png');
  if (fs) {
    try {
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await fs.writeFile(`/home/pictures/${filename}`, bytes);
      return;
    } catch {
      // fallback
    }
  }

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Saves state object to VFS or downloads it.
 * @param {import('../../kernel/types').VFS} fs
 * @param {string} path
 * @param {any} state
 */
export async function saveStateToVfs(fs, path, state) {
  const json = JSON.stringify(state, null, 2);
  if (fs) {
    await fs.writeFile(path, json);
  } else {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'state.csstate';
    a.click();
    URL.revokeObjectURL(url);
  }
}

/**
 * Loads state from VFS or returns parsed object.
 * @param {import('../../kernel/types').VFS} fs
 * @param {string} path
 */
export async function loadStateFromVfs(fs, path) {
  if (!fs) return null;
  const content = await fs.readFile(path);
  const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
  return JSON.parse(text);
}
