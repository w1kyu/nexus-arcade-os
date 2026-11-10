// @ts-check
import { h, icon } from '../../ui/dom.js';
import {
  VisualizerEngine,
  exportPng,
  exportSvg,
  loadStateFromVfs,
  renderVisualizerControls,
  saveStateToVfs,
} from '../../ui/visualizer/engine.js';
import {
  EPSILON,
  batchTestWords,
  complementDfa,
  convertNfaToDfa,
  minimizeDfa,
  regexToNfa,
  simulateWord,
  validateAutomaton,
} from './engine.js';
import { AUTOMATA_PRESETS } from './presets.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  const defaultPreset = AUTOMATA_PRESETS.div3;
  /** @type {import('./engine').Automaton} */
  let automaton = {
    isDfa: defaultPreset.isDfa,
    alphabet: [...defaultPreset.alphabet],
    states: defaultPreset.states.map((s) => ({ ...s })),
    transitions: defaultPreset.transitions.map((tr) => ({ ...tr })),
  };

  let activeTool = 'select'; // 'select' | 'addState' | 'addTransition' | 'toggleStart' | 'toggleFinal' | 'delete'
  let inputWord = '110';
  /** @type {Set<string>} */
  let activeStateIds = new Set();
  let simulationMessage = '';
  /** @type {Array<{ word: string, accepted: boolean }>} */
  let batchResults = [];

  const engine = new VisualizerEngine({
    defaultSpeed: 400,
    onStep: (step) => {
      if (step.activeStates) {
        activeStateIds = new Set(step.activeStates);
      }
      if (step.message) simulationMessage = step.message;
      updateInfo();
      renderSvg();
    },
    onReset: () => {
      activeStateIds.clear();
      simulationMessage = '';
      updateInfo();
      renderSvg();
    },
  });

  // UI Setup
  const root = h('div', { class: 'nx-automata-app' });
  const header = h('div', { class: 'nx-automata-header' });
  const controlsRow = h('div', { class: 'nx-automata-controls-row' });

  // Preset select
  const presetSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: '', disabled: true, selected: true }, t('controls.preset')),
    ...Object.entries(AUTOMATA_PRESETS).map(([k, p]) =>
      h('option', { value: k }, p.name[ctx.i18n.currentLocale === 'de' ? 'de' : 'en'] || p.name.en),
    ),
  ]);
  presetSelect.addEventListener('change', () => {
    const p = AUTOMATA_PRESETS[presetSelect.value];
    if (p) {
      automaton = {
        isDfa: p.isDfa,
        alphabet: [...p.alphabet],
        states: p.states.map((s) => ({ ...s })),
        transitions: p.transitions.map((tr) => ({ ...tr })),
      };
      resetSimulation();
    }
    presetSelect.selectedIndex = 0;
  });

  // Tool Mode Select
  const toolSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: 'select', selected: true }, t('controls.select')),
    h('option', { value: 'addState' }, t('controls.addState')),
    h('option', { value: 'addTransition' }, t('controls.addTransition')),
    h('option', { value: 'toggleStart' }, t('controls.toggleStart')),
    h('option', { value: 'toggleFinal' }, t('controls.toggleFinal')),
    h('option', { value: 'delete' }, t('controls.delete')),
  ]);
  toolSelect.addEventListener('change', () => {
    activeTool = toolSelect.value;
    transitionSourceStateId = null;
  });

  // Conversion Menu Select
  const convertSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: '', disabled: true, selected: true }, t('controls.convert')),
    h('option', { value: 'nfaToDfa' }, t('controls.nfaToDfa')),
    h('option', { value: 'minimize' }, t('controls.minimize')),
    h('option', { value: 'regexToNfa' }, t('controls.regexToNfa')),
    h('option', { value: 'complement' }, t('controls.complement')),
  ]);
  convertSelect.addEventListener('change', () => {
    const val = convertSelect.value;
    try {
      if (val === 'nfaToDfa') {
        automaton = convertNfaToDfa(automaton);
      } else if (val === 'minimize') {
        automaton = minimizeDfa(automaton);
      } else if (val === 'regexToNfa') {
        const regex = prompt('Enter regular expression (e.g. (a|b)*abb):', '(a|b)*abb');
        if (regex) automaton = regexToNfa(regex.trim());
      } else if (val === 'complement') {
        automaton = complementDfa(automaton);
      }
      resetSimulation();
    } catch (err) {
      alert(`Conversion error: ${err.message || err}`);
    }
    convertSelect.selectedIndex = 0;
  });

  // Batch Test Button
  const batchBtn = h('button', { class: 'nx-cs-btn' }, t('controls.batchTest'));
  batchBtn.addEventListener('click', () => {
    const input = prompt('Enter candidate words separated by commas or spaces:', '0, 11, 110, 1001, 1010');
    if (input) {
      const words = input.split(/[\s,]+/).filter(Boolean);
      batchResults = batchTestWords(automaton, words);
      updateInfo();
    }
  });

  // Save / Load / Export
  const saveBtn = h('button', { class: 'nx-cs-btn', title: t('controls.save') }, icon('download', { size: 14 }));
  saveBtn.addEventListener('click', async () => {
    const filename = `automaton_${Date.now()}.csstate`;
    await saveStateToVfs(ctx.fs, `/home/documents/${filename}`, automaton);
    ctx.notify({ title: t('app.title'), message: `Saved ${filename}` });
  });

  const loadBtn = h('button', { class: 'nx-cs-btn', title: t('controls.load') }, icon('folder-open', { size: 14 }));
  loadBtn.addEventListener('click', async () => {
    const path = prompt('Enter VFS path to load automaton:', '/home/documents/automaton_state.csstate');
    if (!path) return;
    try {
      const data = await loadStateFromVfs(ctx.fs, path);
      if (data && data.states && data.transitions) {
        automaton = data;
        resetSimulation();
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
    exportPng(svg, 'automaton.png', ctx.fs);
  });

  const exportSvgBtn = h('button', { class: 'nx-cs-btn', title: t('controls.exportSvg') }, icon('image', { size: 14 }));
  exportSvgBtn.addEventListener('click', () => {
    exportSvg(svg, 'automaton.svg', ctx.fs);
  });

  controlsRow.append(presetSelect, toolSelect, convertSelect, batchBtn, saveBtn, loadBtn, exportPngBtn, exportSvgBtn);
  header.append(controlsRow);

  // Simulation Bar
  const simBar = h('div', { class: 'nx-automata-sim-bar' });
  const wordLabel = h('span', { style: 'font-size:var(--text-xs);color:var(--text-2)' }, t('controls.word'));
  const wordInput = h('input', {
    type: 'text',
    class: 'nx-input small',
    value: inputWord,
    style: 'width:120px;font-family:var(--font-mono)',
  });
  wordInput.addEventListener('input', () => {
    inputWord = wordInput.value;
  });

  const simBtn = h('button', { class: 'nx-cs-btn primary' }, t('controls.simulate'));
  simBtn.addEventListener('click', () => {
    engine.init(simulateWord, automaton, inputWord);
    engine.play();
  });

  simBar.append(wordLabel, wordInput, simBtn);

  // Engine controls
  const engineToolbar = renderVisualizerControls(engine, { t });

  // Main Canvas & Sidebar
  const main = h('div', { class: 'nx-automata-main' });
  const canvasWrap = h('div', { class: 'nx-automata-canvas-wrap' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'nx-automata-svg');
  canvasWrap.append(svg);

  const sidebar = h('div', { class: 'nx-automata-sidebar' });
  const infoPanel = h('div', { class: 'nx-automata-panel' });
  infoPanel.append(h('h4', {}, t('info.title')));
  const infoContent = h('div');
  infoPanel.append(infoContent);

  sidebar.append(infoPanel);
  main.append(canvasWrap, sidebar);
  root.append(header, simBar, engineToolbar, main);
  container.append(root);

  function resetSimulation() {
    activeStateIds.clear();
    simulationMessage = '';
    engine.init(simulateWord, automaton, inputWord);
    updateInfo();
    renderSvg();
  }

  function updateInfo() {
    const val = validateAutomaton(automaton);

    let batchHtml = '';
    if (batchResults.length > 0) {
      const rows = batchResults.map(
        (r) =>
          `<tr><td>${r.word || 'ε'}</td><td><span class="${r.accepted ? 'nx-badge-accept' : 'nx-badge-reject'}">${r.accepted ? 'Accepted' : 'Rejected'}</span></td></tr>`,
      );
      batchHtml = `
        <h4 style="margin-top:12px;">${t('info.batchTitle')}</h4>
        <table class="nx-batch-table">
          <thead><tr><th>Word</th><th>Verdict</th></tr></thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      `;
    }

    infoContent.innerHTML = `
      <div>${t('info.type')}: <strong>${automaton.isDfa ? 'DFA' : 'NFA (with ε)'}</strong></div>
      <div>${t('info.states')}: <strong>${automaton.states.length}</strong></div>
      <div>${t('info.alphabet')}: <strong>{${val.alphabet.join(', ')}}</strong></div>
      <div>${t('info.complete')}: <strong>${val.isCompleteDfa ? t('info.yes') : t('info.no')}</strong></div>
      ${simulationMessage ? `<div style="margin-top:8px;color:var(--accent)"><strong>${t('info.simulation')}:</strong><br>${simulationMessage}</div>` : ''}
      ${batchHtml}
    `;
  }

  // ─── SVG Rendering ───
  let draggedState = null;
  let transitionSourceStateId = null;

  function renderSvg() {
    svg.innerHTML = '';

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="aut-arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#8791b3" />
      </marker>
      <marker id="aut-arrow-start" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#3ef0ff" />
      </marker>
    `;
    svg.appendChild(defs);

    const stateMap = new Map(automaton.states.map((s) => [s.id, s]));

    // Draw Transitions
    for (const tr of automaton.transitions) {
      const u = stateMap.get(tr.from);
      const v = stateMap.get(tr.to);
      if (!u || !v) continue;

      if (u.id === v.id) {
        // Self-loop
        const loop = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const x = u.x || 100;
        const y = u.y || 100;
        const d = `M ${x - 10} ${y - 18} C ${x - 25} ${y - 50}, ${x + 25} ${y - 50}, ${x + 10} ${y - 18}`;
        loop.setAttribute('d', d);
        loop.setAttribute('fill', 'none');
        loop.setAttribute('stroke', '#8791b3');
        loop.setAttribute('stroke-width', '2');
        loop.setAttribute('marker-end', 'url(#aut-arrow)');
        svg.appendChild(loop);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(x));
        text.setAttribute('y', String(y - 52));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#ffc857');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.textContent = tr.symbol || EPSILON;
        svg.appendChild(text);
      } else {
        // Curve transition line
        const ux = u.x || 100;
        const uy = u.y || 100;
        const vx = v.x || 200;
        const vy = v.y || 100;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(ux));
        line.setAttribute('y1', String(uy));
        line.setAttribute('x2', String(vx));
        line.setAttribute('y2', String(vy));
        line.setAttribute('stroke', '#8791b3');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('marker-end', 'url(#aut-arrow)');

        line.style.cursor = 'pointer';
        line.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (activeTool === 'delete') {
            automaton.transitions = automaton.transitions.filter((t) => t.id !== tr.id);
            resetSimulation();
          }
        });
        svg.appendChild(line);

        // Transition symbol
        const midX = (ux + vx) / 2;
        const midY = (uy + vy) / 2 - 6;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(midX));
        text.setAttribute('y', String(midY));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#ffc857');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.textContent = tr.symbol || EPSILON;
        svg.appendChild(text);
      }
    }

    // Draw States
    for (const s of automaton.states) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.cursor = 'pointer';

      const x = s.x || 100;
      const y = s.y || 100;

      // Start state arrow
      if (s.isStart) {
        const startArrow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        startArrow.setAttribute('x1', String(x - 45));
        startArrow.setAttribute('y1', String(y));
        startArrow.setAttribute('x2', String(x - 22));
        startArrow.setAttribute('y2', String(y));
        startArrow.setAttribute('stroke', '#3ef0ff');
        startArrow.setAttribute('stroke-width', '2.5');
        startArrow.setAttribute('marker-end', 'url(#aut-arrow-start)');
        svg.appendChild(startArrow);
      }

      // Outer circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(x));
      circle.setAttribute('cy', String(y));
      circle.setAttribute('r', '22');

      const isActive = activeStateIds.has(s.id);
      circle.setAttribute('fill', isActive ? 'rgba(62, 240, 255, 0.4)' : '#121628');
      circle.setAttribute('stroke', isActive ? '#ffc857' : '#3ef0ff');
      circle.setAttribute('stroke-width', isActive ? '3.5' : '2');
      g.appendChild(circle);

      // Inner circle for Accepting (final) state
      if (s.isAccepting) {
        const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerCircle.setAttribute('cx', String(x));
        innerCircle.setAttribute('cy', String(y));
        innerCircle.setAttribute('r', '17');
        innerCircle.setAttribute('fill', 'none');
        innerCircle.setAttribute('stroke', isActive ? '#ffc857' : '#3ef0ff');
        innerCircle.setAttribute('stroke-width', '1.5');
        g.appendChild(innerCircle);
      }

      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(y + 4));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#eef2ff');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', 'bold');
      label.textContent = s.label || s.id;
      g.appendChild(label);

      // Event listeners
      g.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        if (activeTool === 'select') {
          draggedState = s;
        } else if (activeTool === 'delete') {
          automaton.states = automaton.states.filter((st) => st.id !== s.id);
          automaton.transitions = automaton.transitions.filter((t) => t.from !== s.id && t.to !== s.id);
          resetSimulation();
        } else if (activeTool === 'toggleStart') {
          s.isStart = !s.isStart;
          resetSimulation();
        } else if (activeTool === 'toggleFinal') {
          s.isAccepting = !s.isAccepting;
          resetSimulation();
        } else if (activeTool === 'addTransition') {
          if (!transitionSourceStateId) {
            transitionSourceStateId = s.id;
            circle.setAttribute('stroke', '#ffc857');
          } else {
            const sym = prompt('Transition symbol (e.g. 0, 1, a, b, or empty/ε for epsilon):', '0');
            if (sym !== null) {
              automaton.transitions.push({
                id: `tr_${Date.now()}`,
                from: transitionSourceStateId,
                to: s.id,
                symbol: sym === '' ? EPSILON : sym,
              });
              transitionSourceStateId = null;
              resetSimulation();
            } else {
              transitionSourceStateId = null;
              renderSvg();
            }
          }
        }
      });

      svg.appendChild(g);
    }
  }

  svg.addEventListener('mousemove', (e) => {
    if (draggedState && activeTool === 'select') {
      const rect = svg.getBoundingClientRect();
      draggedState.x = e.clientX - rect.left;
      draggedState.y = e.clientY - rect.top;
      renderSvg();
    }
  });

  window.addEventListener('mouseup', () => {
    draggedState = null;
  });

  svg.addEventListener('click', (e) => {
    if (activeTool === 'addState') {
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = `q${automaton.states.length}`;
      automaton.states.push({ id, label: id, isStart: false, isAccepting: false, x, y });
      resetSimulation();
    }
  });

  resetSimulation();

  return () => {
    engine.pause();
  };
}

export const commands = {
  'automata.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.automata', args });
  },
};

export const terminal = {
  automata: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.automata' });
      return 0;
    }

    const presetKey = args[0].toLowerCase();
    const word = args[1] || '110';
    const preset = AUTOMATA_PRESETS[presetKey] || AUTOMATA_PRESETS.div3;

    io.stdout?.(`Simulating word "${word}" on ${preset.name.en}...\n`);
    const gen = simulateWord(
      {
        isDfa: preset.isDfa,
        alphabet: preset.alphabet,
        states: preset.states,
        transitions: preset.transitions,
      },
      word,
    );

    let step = gen.next();
    while (!step.done) {
      if (step.value?.message) io.stdout?.(`  ${step.value.message}\n`);
      step = gen.next();
    }

    return 0;
  },
};
