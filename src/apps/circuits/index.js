// @ts-check
import { h } from '../../ui/dom.js';
import { exportPng, exportSvg, loadStateFromVfs, saveStateToVfs } from '../../ui/visualizer/engine.js';
import { CIRCUIT_PRESETS, generateTruthTable, simulateCircuit } from './circuits-engine.js';
import { buildKarnaughMap, checkEquivalence, generateExpressionTruthTable, quineMcCluskey } from './boolean-engine.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  let activeTab = 'circuits'; // 'circuits' | 'boolean'

  // --- Circuits State ---
  let selectedPresetKey = 'halfAdder';
  /** @type {any[]} */
  let components = JSON.parse(JSON.stringify(CIRCUIT_PRESETS.halfAdder.components));
  /** @type {any[]} */
  let wires = JSON.parse(JSON.stringify(CIRCUIT_PRESETS.halfAdder.wires));
  let truthTableResult = null;

  // --- Boolean State ---
  let boolExpr = '(A & B) | !C';
  let compareExpr = '!( !A | !B ) | !C';
  let tableData = null;
  let kvData = null;
  let minData = null;
  let equivData = null;

  simulateCircuit(components, wires);

  // Root UI
  const root = h('div', { class: 'nx-circuits-app' });

  // Tab Header
  const tabHeader = h('div', { class: 'nx-circuits-header' });

  const tabCircuitsBtn = h('button', { class: 'nx-cs-btn active' }, t('tabs.circuits'));
  const tabBooleanBtn = h('button', { class: 'nx-cs-btn' }, t('tabs.boolean'));

  tabCircuitsBtn.addEventListener('click', () => {
    activeTab = 'circuits';
    tabCircuitsBtn.classList.add('active');
    tabBooleanBtn.classList.remove('active');
    renderView();
  });

  tabBooleanBtn.addEventListener('click', () => {
    activeTab = 'boolean';
    tabBooleanBtn.classList.add('active');
    tabCircuitsBtn.classList.remove('active');
    renderView();
  });

  const contentArea = h('div', { class: 'nx-circuits-main' });

  tabHeader.append(h('div', { style: 'display:flex;gap:6px;' }, tabCircuitsBtn, tabBooleanBtn));

  root.append(tabHeader, contentArea);
  container.append(root);

  // Initial boolean computation
  updateBooleanLab();

  function renderView() {
    contentArea.innerHTML = '';
    if (activeTab === 'circuits') {
      renderCircuitView();
    } else {
      renderBooleanView();
    }
  }

  // --- RENDER CIRCUIT VIEW ---
  function renderCircuitView() {
    const canvasWrap = h('div', { class: 'nx-circuits-canvas-wrap' });
    const sidebar = h('div', { class: 'nx-circuits-sidebar' });

    // Toolbar
    const toolbar = h('div', {
      style:
        'position:absolute;top:10px;left:10px;display:flex;flex-wrap:wrap;gap:6px;z-index:10;background:var(--surface-2);padding:6px;border-radius:6px;border:1px solid var(--border)',
    });

    // Preset select
    const presetSelect = h('select', { class: 'nx-input small' }, [
      ...Object.entries(CIRCUIT_PRESETS).map(([k, p]) =>
        h(
          'option',
          { value: k, selected: k === selectedPresetKey },
          p.name[ctx.i18n.currentLocale === 'de' ? 'de' : 'en'] || p.name.en,
        ),
      ),
    ]);
    presetSelect.addEventListener('change', () => {
      selectedPresetKey = presetSelect.value;
      const p = CIRCUIT_PRESETS[selectedPresetKey];
      components = JSON.parse(JSON.stringify(p.components));
      wires = JSON.parse(JSON.stringify(p.wires));
      truthTableResult = null;
      simulateCircuit(components, wires);
      renderCircuitCanvas();
      renderCircuitSidebar();
    });

    const addSelect = h('select', { class: 'nx-input small' }, [
      h('option', { value: '' }, t('controls.tool')),
      h('option', { value: 'switch' }, t('controls.switch')),
      h('option', { value: 'clock' }, t('controls.clock')),
      h('option', { value: 'led' }, t('controls.led')),
      h('option', { value: 'and' }, t('controls.and')),
      h('option', { value: 'or' }, t('controls.or')),
      h('option', { value: 'not' }, t('controls.not')),
      h('option', { value: 'xor' }, t('controls.xor')),
      h('option', { value: 'nand' }, t('controls.nand')),
      h('option', { value: 'nor' }, t('controls.nor')),
    ]);
    addSelect.addEventListener('change', () => {
      const type = addSelect.value;
      if (!type) return;
      const id = `${type}_${Date.now() % 10000}`;
      components.push({
        id,
        type,
        label: type.toUpperCase(),
        x: 150 + Math.random() * 200,
        y: 150 + Math.random() * 150,
        state: 0,
        inPins: [0, 0],
        outPins: [0],
      });
      addSelect.value = '';
      simulateCircuit(components, wires);
      renderCircuitCanvas();
      renderCircuitSidebar();
    });

    const tableBtn = h('button', { class: 'nx-cs-btn' }, t('controls.generateTable'));
    tableBtn.addEventListener('click', () => {
      truthTableResult = generateTruthTable(components, wires);
      renderCircuitSidebar();
    });

    const clearBtn = h('button', { class: 'nx-cs-btn danger' }, t('controls.clear'));
    clearBtn.addEventListener('click', () => {
      components = [];
      wires = [];
      truthTableResult = null;
      renderCircuitCanvas();
      renderCircuitSidebar();
    });

    const saveBtn = h('button', { class: 'nx-cs-btn' }, t('controls.save'));
    saveBtn.addEventListener('click', async () => {
      const path = await saveStateToVfs(ctx, 'circuits', { components, wires });
      if (path) ctx.notify?.({ title: 'Saved Circuit', message: path });
    });

    const loadBtn = h('button', { class: 'nx-cs-btn' }, t('controls.load'));
    loadBtn.addEventListener('click', async () => {
      const state = await loadStateFromVfs(ctx, 'circuits');
      if (state?.components && state?.wires) {
        components = state.components;
        wires = state.wires;
        truthTableResult = null;
        simulateCircuit(components, wires);
        renderCircuitCanvas();
        renderCircuitSidebar();
      }
    });

    const pngBtn = h('button', { class: 'nx-cs-btn' }, t('controls.exportPng'));
    pngBtn.addEventListener('click', () => exportPng(canvasWrap, 'circuit.png'));

    const svgBtn = h('button', { class: 'nx-cs-btn' }, t('controls.exportSvg'));
    svgBtn.addEventListener('click', () => {
      const svg = canvasWrap.querySelector('svg');
      if (svg) exportSvg(svg, 'circuit.svg');
    });

    toolbar.append(presetSelect, addSelect, tableBtn, clearBtn, saveBtn, loadBtn, pngBtn, svgBtn);
    canvasWrap.append(toolbar);

    // SVG container
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'nx-circuits-svg');
    canvasWrap.append(svgEl);

    contentArea.append(canvasWrap, sidebar);

    function renderCircuitCanvas() {
      svgEl.innerHTML = '';

      // Draw wires
      for (const w of wires) {
        const src = components.find((c) => c.id === w.fromComp);
        const dst = components.find((c) => c.id === w.toComp);
        if (!src || !dst) continue;

        const x1 = src.x + 80;
        const y1 = src.y + 20 + (w.fromPin || 0) * 16;
        const x2 = dst.x;
        const y2 = dst.y + 16 + (w.toPin || 0) * 16;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const dx = Math.abs(x2 - x1) * 0.5;
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
        path.setAttribute('stroke', w.state === 1 ? '#3ef0ff' : '#334155');
        path.setAttribute('stroke-width', w.state === 1 ? '3' : '2');
        path.setAttribute('fill', 'none');
        svgEl.append(path);
      }

      // Draw components
      for (const comp of components) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${comp.x}, ${comp.y})`);
        g.style.cursor = comp.type === 'switch' ? 'pointer' : 'default';

        // Background box
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '80');
        rect.setAttribute('height', '45');
        rect.setAttribute('rx', '6');

        if (comp.type === 'switch') {
          rect.setAttribute('fill', comp.state === 1 ? '#047857' : '#1e293b');
          rect.setAttribute('stroke', comp.state === 1 ? '#34d399' : '#64748b');
        } else if (comp.type === 'led') {
          rect.setAttribute('fill', comp.state === 1 ? '#7c2d12' : '#1e293b');
          rect.setAttribute('stroke', comp.state === 1 ? '#fb923c' : '#64748b');
        } else {
          rect.setAttribute('fill', '#0f172a');
          rect.setAttribute('stroke', '#38bdf8');
        }
        rect.setAttribute('stroke-width', '1.5');
        g.append(rect);

        // Label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '40');
        text.setAttribute('y', '27');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#f8fafc');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-family', 'var(--font-sans)');
        text.textContent = comp.type === 'switch' || comp.type === 'led' ? `${comp.label}: ${comp.state}` : comp.label;
        g.append(text);

        // Toggle switch on click
        if (comp.type === 'switch') {
          g.addEventListener('click', () => {
            comp.state = comp.state === 1 ? 0 : 1;
            simulateCircuit(components, wires);
            renderCircuitCanvas();
            renderCircuitSidebar();
          });
        }

        svgEl.append(g);
      }
    }

    function renderCircuitSidebar() {
      sidebar.innerHTML = '';

      // Info Panel
      const infoPanel = h('div', { class: 'nx-circuits-panel' }, [
        h('h4', {}, t('info.circuitsTitle')),
        h('p', {}, `Components: ${components.length}`),
        h('p', {}, `Wires: ${wires.length}`),
        h('p', {}, `Switches: ${components.filter((c) => c.type === 'switch').length}`),
        h('p', {}, `Outputs (LEDs): ${components.filter((c) => c.type === 'led').length}`),
      ]);
      sidebar.append(infoPanel);

      // Truth Table Panel
      if (truthTableResult) {
        const tablePanel = h('div', { class: 'nx-circuits-panel' }, [h('h4', {}, t('info.truthTitle'))]);

        const table = h('table', { class: 'nx-kv-table', style: 'width:100%' });
        const thead = h('thead');
        const headerRow = h('tr');
        for (const inLab of truthTableResult.inputLabels) {
          headerRow.append(h('th', {}, inLab));
        }
        for (const outLab of truthTableResult.outputLabels) {
          headerRow.append(h('th', { style: 'color:var(--accent)' }, outLab));
        }
        thead.append(headerRow);
        table.append(thead);

        const tbody = h('tbody');
        for (const row of truthTableResult.rows) {
          const tr = h('tr');
          for (const val of row.inputs) {
            tr.append(h('td', {}, String(val)));
          }
          for (const val of row.outputs) {
            tr.append(h('td', { class: val === 1 ? 'cell-one' : '' }, String(val)));
          }
          tbody.append(tr);
        }
        table.append(tbody);
        tablePanel.append(table);
        sidebar.append(tablePanel);
      }
    }

    renderCircuitCanvas();
    renderCircuitSidebar();
  }

  // --- RENDER BOOLEAN VIEW ---
  function updateBooleanLab() {
    tableData = generateExpressionTruthTable(boolExpr);
    kvData = buildKarnaughMap(boolExpr);
    minData = tableData ? quineMcCluskey(tableData.minterms, tableData.variables) : null;
    if (compareExpr.trim()) {
      equivData = checkEquivalence(boolExpr, compareExpr);
    } else {
      equivData = null;
    }
  }

  function renderBooleanView() {
    const mainWrap = h('div', {
      style: 'flex:1;display:flex;flex-direction:column;gap:12px;padding:14px;overflow-y:auto;',
    });

    // Expression Input Controls
    const inputCard = h('div', { class: 'nx-circuits-panel' }, [
      h('h4', {}, t('controls.expression')),
      h('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:8px;' }, [
        h('input', {
          type: 'text',
          class: 'nx-input',
          value: boolExpr,
          style: 'flex:1;font-family:var(--font-mono)',
          id: 'bool-expr-input',
        }),
        h('button', { class: 'nx-cs-btn primary', id: 'eval-bool-btn' }, t('controls.evaluate')),
      ]),
      h('div', { style: 'display:flex;gap:8px;align-items:center;' }, [
        h('span', { style: 'font-size:12px;color:var(--text-2)' }, t('controls.compareWith')),
        h('input', {
          type: 'text',
          class: 'nx-input',
          value: compareExpr,
          style: 'flex:1;font-family:var(--font-mono)',
          id: 'compare-expr-input',
        }),
        h('button', { class: 'nx-cs-btn', id: 'check-equiv-btn' }, t('controls.checkEquiv')),
      ]),
    ]);

    const exprInput = inputCard.querySelector('#bool-expr-input');
    const compareInput = inputCard.querySelector('#compare-expr-input');
    const evalBtn = inputCard.querySelector('#eval-bool-btn');
    const equivBtn = inputCard.querySelector('#check-equiv-btn');

    evalBtn?.addEventListener('click', () => {
      boolExpr = /** @type {HTMLInputElement} */ (exprInput).value;
      updateBooleanLab();
      renderBooleanView();
    });

    equivBtn?.addEventListener('click', () => {
      boolExpr = /** @type {HTMLInputElement} */ (exprInput).value;
      compareExpr = /** @type {HTMLInputElement} */ (compareInput).value;
      updateBooleanLab();
      renderBooleanView();
    });

    mainWrap.append(inputCard);

    // Results container
    const cols = h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px;' });

    // Left Column: Truth Table & Classification
    const leftCol = h('div', { style: 'display:flex;flex-direction:column;gap:12px;' });

    if (tableData) {
      const classKey = `info.${tableData.classification}`;
      const classLabel = t(classKey);

      const tableCard = h('div', { class: 'nx-circuits-panel' }, [
        h('h4', {}, t('info.truthTitle')),
        h('p', {}, `${t('info.classification')}: ${classLabel}`),
        h('p', {}, `Minterms: m(${tableData.minterms.join(', ')})`),
      ]);

      const table = h('table', { class: 'nx-kv-table', style: 'width:100%;margin-top:8px;' });
      const thead = h('thead');
      const trH = h('tr');
      for (const v of tableData.variables) trH.append(h('th', {}, v));
      trH.append(h('th', { style: 'color:var(--accent)' }, 'Output'));
      thead.append(trH);
      table.append(thead);

      const tbody = h('tbody');
      for (const r of tableData.rows) {
        const tr = h('tr');
        for (const v of tableData.variables) {
          tr.append(h('td', {}, String(r.assignment[v])));
        }
        tr.append(h('td', { class: r.result === 1 ? 'cell-one' : '' }, String(r.result)));
        tbody.append(tr);
      }
      table.append(tbody);
      tableCard.append(table);
      leftCol.append(tableCard);
    }

    // Right Column: KV Map and Minimization
    const rightCol = h('div', { style: 'display:flex;flex-direction:column;gap:12px;' });

    if (minData) {
      const minCard = h('div', { class: 'nx-circuits-panel' }, [
        h('h4', {}, t('info.minimizedTitle')),
        h('p', {}, [h('strong', {}, 'DNF (SOP): '), h('code', { style: 'color:var(--accent)' }, minData.dnf)]),
        h('p', {}, [h('strong', {}, 'CNF (POS): '), h('code', { style: 'color:var(--accent)' }, minData.cnf)]),
        h('p', {}, `Prime Implicants: ${minData.primeImplicants.join(', ')}`),
      ]);
      rightCol.append(minCard);
    }

    if (equivData) {
      const eqCard = h('div', { class: 'nx-circuits-panel' }, [
        h('h4', {}, 'Equivalence Result'),
        h(
          'p',
          { style: `font-weight:bold;color:${equivData.equivalent ? '#34d399' : '#f87171'}` },
          equivData.equivalent ? 'Expressions are EQUIVALENT' : 'Expressions are NOT equivalent',
        ),
        equivData.counterExample ? h('p', {}, `Counterexample: ${JSON.stringify(equivData.counterExample)}`) : '',
      ]);
      rightCol.append(eqCard);
    }

    if (kvData) {
      const kvCard = h('div', { class: 'nx-circuits-panel' }, [
        h('h4', {}, t('info.kvTitle')),
        h('p', { style: 'color:var(--text-2)' }, `Rows: ${kvData.rowVars} | Columns: ${kvData.colVars}`),
      ]);

      const kvTable = h('table', { class: 'nx-kv-table' });
      const thead = h('thead');
      const trH = h('tr', {}, [
        h('th', {}, `${kvData.rowVars} \\ ${kvData.colVars}`),
        ...kvData.colLabels.map((c) => h('th', {}, c)),
      ]);
      thead.append(trH);
      kvTable.append(thead);

      const tbody = h('tbody');
      kvData.grid.forEach((row, rIdx) => {
        const tr = h('tr', {}, [
          h('th', {}, kvData.rowLabels[rIdx]),
          ...row.map((cell) => h('td', { class: cell.result === 1 ? 'cell-one' : '' }, String(cell.result))),
        ]);
        tbody.append(tr);
      });
      kvTable.append(tbody);
      kvCard.append(kvTable);
      rightCol.append(kvCard);
    }

    cols.append(leftCol, rightCol);
    mainWrap.append(cols);
    contentArea.append(mainWrap);
  }

  renderView();

  return () => {};
}

export const commands = {
  'circuits.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.circuits', args });
  },
};

export const terminal = {
  circuits: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.circuits' });
      return 0;
    }

    const sub = args[0].toLowerCase();
    if (sub === 'eval') {
      const expr = args.slice(1).join(' ') || 'A & B';
      const res = generateExpressionTruthTable(expr);
      if (!res) {
        io.stderr?.(`Invalid expression: ${expr}\n`);
        return 1;
      }
      io.stdout?.(`Expression: ${expr}\nVariables: ${res.variables.join(', ')}\nType: ${res.classification}\n`);
      for (const r of res.rows) {
        io.stdout?.(`${JSON.stringify(r.assignment)} => ${r.result}\n`);
      }
      const min = quineMcCluskey(res.minterms, res.variables);
      io.stdout?.(`Minimal DNF: ${min.dnf}\nMinimal CNF: ${min.cnf}\n`);
      return 0;
    }

    if (sub === 'preset') {
      const key = args[1] || 'halfAdder';
      const preset = CIRCUIT_PRESETS[key] || CIRCUIT_PRESETS.halfAdder;
      const comps = JSON.parse(JSON.stringify(preset.components));
      const wires = JSON.parse(JSON.stringify(preset.wires));
      const table = generateTruthTable(comps, wires);
      io.stdout?.(
        `Preset: ${preset.name.en}\nInputs: ${table?.inputLabels.join(', ')}\nOutputs: ${table?.outputLabels.join(', ')}\n`,
      );
      table?.rows.forEach((r) => {
        io.stdout?.(`In: [${r.inputs.join(', ')}] -> Out: [${r.outputs.join(', ')}]\n`);
      });
      return 0;
    }

    io.stderr?.(`Unknown subcommand: ${sub}. Usage: circuits [eval <expr> | preset <name>]\n`);
    return 1;
  },
};
