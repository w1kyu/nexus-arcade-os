// @ts-check
import { h, icon } from '../../ui/dom.js';
import {
  VisualizerEngine,
  exportPng,
  loadStateFromVfs,
  renderVisualizerControls,
  saveStateToVfs,
} from '../../ui/visualizer/engine.js';
import { BLANK, TURING_PRESETS, getVisibleTape, runTuringMachine } from './engine.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  let selectedPresetKey = 'binaryIncrement';
  let activeMachine = { ...TURING_PRESETS.binaryIncrement };
  let inputTapeStr = activeMachine.defaultInput;
  let stepLimit = 2000;

  // Runtime State
  let currentHead = 0;
  let currentState = activeMachine.startState;
  /** @type {Map<number, string>} */
  let currentTape = new Map();
  let haltStatus = 'idle';
  let activeTransitionKey = null;

  const engine = new VisualizerEngine({
    defaultSpeed: 180,
    getSnapshot: () => ({
      head: currentHead,
      state: currentState,
      tape: new Map(currentTape),
      status: haltStatus,
      transKey: activeTransitionKey,
    }),
    restoreSnapshot: (snap) => {
      currentHead = snap.head;
      currentState = snap.state;
      currentTape = new Map(snap.tape);
      haltStatus = snap.status;
      activeTransitionKey = snap.transKey;
      updateSidebar();
      renderTape();
    },
    onStep: (step) => {
      if (step.tape) currentTape = new Map(step.tape);
      if (step.head !== undefined) currentHead = step.head;
      if (step.state) currentState = step.state;
      if (step.status) haltStatus = step.status;
      if (step.prevState && step.readSymbol) {
        activeTransitionKey = `${step.prevState}:${step.readSymbol}`;
      } else {
        activeTransitionKey = null;
      }
      updateSidebar();
      renderTape();
    },
    onReset: () => {
      resetMachineState();
    },
  });

  // UI Setup
  const root = h('div', { class: 'nx-turing-app' });
  const header = h('div', { class: 'nx-turing-header' });
  const controlsRow = h('div', { class: 'nx-turing-controls-row' });

  // Preset Select
  const presetSelect = h('select', { class: 'nx-input small' }, [
    ...Object.entries(TURING_PRESETS).map(([k, p]) =>
      h(
        'option',
        { value: k, selected: k === selectedPresetKey },
        p.name[ctx.i18n.currentLocale === 'de' ? 'de' : 'en'] || p.name.en,
      ),
    ),
  ]);
  presetSelect.addEventListener('change', () => {
    selectedPresetKey = presetSelect.value;
    activeMachine = { ...TURING_PRESETS[selectedPresetKey] };
    inputTapeStr = activeMachine.defaultInput;
    tapeInput.value = inputTapeStr;
    resetMachineState();
  });

  // Input Field
  const inputLabel = h('span', { style: 'font-size:var(--text-xs);color:var(--text-2)' }, t('controls.input'));
  const tapeInput = h('input', {
    type: 'text',
    class: 'nx-input small',
    value: inputTapeStr,
    style: 'width:130px;font-family:var(--font-mono)',
  });
  tapeInput.addEventListener('input', () => {
    inputTapeStr = tapeInput.value;
    resetMachineState();
  });

  // Reset Button
  const resetBtn = h('button', { class: 'nx-cs-btn' }, t('controls.reset'));
  resetBtn.addEventListener('click', () => {
    resetMachineState();
  });

  // Save / Load / Export
  const saveBtn = h('button', { class: 'nx-cs-btn', title: t('controls.save') }, icon('download', { size: 14 }));
  saveBtn.addEventListener('click', async () => {
    const filename = `turing_${selectedPresetKey}_${Date.now()}.csstate`;
    await saveStateToVfs(ctx.fs, `/home/documents/${filename}`, {
      preset: selectedPresetKey,
      input: inputTapeStr,
    });
    ctx.notify({ title: t('app.title'), message: `Saved ${filename}` });
  });

  const loadBtn = h('button', { class: 'nx-cs-btn', title: t('controls.load') }, icon('folder-open', { size: 14 }));
  loadBtn.addEventListener('click', async () => {
    const path = prompt('Enter VFS path to load:', '/home/documents/turing_state.csstate');
    if (!path) return;
    try {
      const data = await loadStateFromVfs(ctx.fs, path);
      if (data && data.preset && TURING_PRESETS[data.preset]) {
        presetSelect.value = data.preset;
        selectedPresetKey = data.preset;
        activeMachine = { ...TURING_PRESETS[selectedPresetKey] };
        inputTapeStr = data.input || '';
        tapeInput.value = inputTapeStr;
        resetMachineState();
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
    exportPng(tapePane, 'turing_tape.png', ctx.fs);
  });

  const exportSvgBtn = h('button', { class: 'nx-cs-btn', title: t('controls.exportSvg') }, icon('image', { size: 14 }));
  exportSvgBtn.addEventListener('click', () => {
    exportPng(tapePane, 'turing_tape.png', ctx.fs);
  });

  controlsRow.append(presetSelect, inputLabel, tapeInput, resetBtn, saveBtn, loadBtn, exportPngBtn, exportSvgBtn);
  header.append(controlsRow);

  const engineToolbar = renderVisualizerControls(engine, { t });

  // Main Panes
  const main = h('div', { class: 'nx-turing-main' });
  const tapePane = h('div', { class: 'nx-turing-tape-pane' });
  const tapeTrack = h('div', { class: 'nx-tape-track' });
  tapePane.append(tapeTrack);

  const sidebar = h('div', { class: 'nx-turing-sidebar' });
  const infoPanel = h('div', { class: 'nx-cs-pseudo-panel', style: 'padding:12px;' });
  infoPanel.append(h('h4', { style: 'margin:0 0 8px 0;color:var(--accent)' }, t('info.title')));
  const infoContent = h('div');
  infoPanel.append(infoContent);

  // Transition Table panel
  const transTablePanel = h('div', { class: 'nx-cs-pseudo-panel', style: 'padding:12px;' });
  transTablePanel.append(h('h4', { style: 'margin:0 0 8px 0;color:var(--accent)' }, t('info.tableTitle')));
  const transTableContainer = h('div', { style: 'overflow-y:auto;max-height:260px;' });
  transTablePanel.append(transTableContainer);

  sidebar.append(infoPanel, transTablePanel);
  main.append(tapePane, sidebar);
  root.append(header, engineToolbar, main);
  container.append(root);

  function resetMachineState() {
    currentTape = new Map();
    for (let i = 0; i < inputTapeStr.length; i++) {
      currentTape.set(i, inputTapeStr[i]);
    }
    currentHead = 0;
    currentState = activeMachine.startState;
    haltStatus = 'idle';
    activeTransitionKey = null;

    engine.init(runTuringMachine, activeMachine, inputTapeStr, stepLimit);
    updateSidebar();
    renderTape();
  }

  function updateSidebar() {
    infoContent.innerHTML = `
      <div>${t('info.state')}: <strong style="color:var(--accent)">${currentState}</strong></div>
      <div>${t('info.head')}: <strong>${currentHead}</strong></div>
      <div>${t('info.steps')}: <strong>${Math.max(0, engine.currentIndex + 1)}</strong></div>
      <div>${t('info.status')}: <strong>${haltStatus}</strong></div>
    `;

    renderTransitionTable();
  }

  function renderTransitionTable() {
    transTableContainer.innerHTML = '';
    const table = h('table', { class: 'nx-table-view' });
    table.innerHTML = `
      <thead>
        <tr>
          <th>State (q)</th>
          <th>Read (σ)</th>
          <th>Next (q')</th>
          <th>Write (σ')</th>
          <th>Move</th>
        </tr>
      </thead>
      <tbody>
        ${activeMachine.transitions
          .map((tr) => {
            const key = `${tr.state}:${tr.read}`;
            const isActive = key === activeTransitionKey;
            return `
            <tr class="${isActive ? 'active-trans' : ''}">
              <td>${tr.state}</td>
              <td>${tr.read === BLANK ? '␣' : tr.read}</td>
              <td>${tr.nextState}</td>
              <td>${tr.write === BLANK ? '␣' : tr.write}</td>
              <td>${tr.move}</td>
            </tr>
          `;
          })
          .join('')}
      </tbody>
    `;
    transTableContainer.append(table);
  }

  function renderTape() {
    tapeTrack.innerHTML = '';
    const visibleCells = getVisibleTape(currentTape, currentHead, 8);

    for (const cell of visibleCells) {
      const cellEl = h(
        'div',
        { class: `nx-tape-cell${cell.isHead ? ' head' : ''}` },
        cell.isHead ? h('span', { class: 'nx-tape-head-pointer' }, '▼') : '',
        h('span', { class: 'nx-tape-cell-val' }, cell.symbol === BLANK ? '␣' : cell.symbol),
        h('span', { class: 'nx-tape-cell-idx' }, String(cell.index)),
      );
      tapeTrack.append(cellEl);

      if (cell.isHead) {
        cellEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }

  resetMachineState();

  return () => {
    engine.pause();
  };
}

export const commands = {
  'turing.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.turing', args });
  },
};

export const terminal = {
  turing: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.turing' });
      return 0;
    }

    const presetKey = args[0].toLowerCase();
    const inputStr = args[1] || '';
    const preset = TURING_PRESETS[presetKey] || TURING_PRESETS.binaryIncrement;

    io.stdout?.(`Running Turing Machine "${preset.name.en}" with input "${inputStr}"...\n`);
    const gen = runTuringMachine(preset, inputStr, 2000);

    let last = null;
    let step = gen.next();
    while (!step.done) {
      last = step.value;
      step = gen.next();
    }

    io.stdout?.(`Result: ${last?.message}\n`);
    return 0;
  },
};
