// @ts-check
import { h } from '../../ui/dom.js';
import {
  VisualizerEngine,
  exportPng,
  loadStateFromVfs,
  renderVisualizerControls,
  saveStateToVfs,
} from '../../ui/visualizer/engine.js';
import {
  encodeIEEE754,
  explainFloatProblem,
  formatInteger,
  getStepByStepDivision,
  simulateIntegerAddition,
} from './number-engine.js';
import { CPU_PRESETS, Nexus8Cpu, assembleNexus8, runCpu } from './cpu-engine.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  let activeTab = 'numbers'; // 'numbers' | 'cpu'

  // --- Number Lab State ---
  let intVal = -42;
  let intBits = 8;
  let floatVal = 0.15625;
  /** @type {'half' | 'single' | 'double'} */
  let floatPrec = 'single';
  let addA = 42;
  let addB = 95;

  // --- CPU State ---
  let selectedPresetKey = 'counter';
  let asmCode = CPU_PRESETS.counter.code;
  const cpu = new Nexus8Cpu();
  let binaryMap = assembleNexus8(asmCode);
  cpu.memory.set(binaryMap.binary);

  const engine = new VisualizerEngine({
    defaultSpeed: 150,
    getSnapshot: () => ({
      memory: new Uint8Array(cpu.memory),
      A: cpu.A,
      B: cpu.B,
      C: cpu.C,
      PC: cpu.PC,
      SP: cpu.SP,
      flags: { ...cpu.flags },
      cycles: cpu.cycles,
      halted: cpu.halted,
      stage: cpu.stage,
      output: [...cpu.output],
    }),
    restoreSnapshot: (snap) => {
      cpu.memory.set(snap.memory);
      cpu.A = snap.A;
      cpu.B = snap.B;
      cpu.C = snap.C;
      cpu.PC = snap.PC;
      cpu.SP = snap.SP;
      cpu.flags = { ...snap.flags };
      cpu.cycles = snap.cycles;
      cpu.halted = snap.halted;
      cpu.stage = snap.stage;
      cpu.output = [...snap.output];
      renderCpuViews();
    },
    onStep: (step) => {
      if (step.registers) {
        cpu.A = step.registers.A;
        cpu.B = step.registers.B;
        cpu.C = step.registers.C;
        cpu.PC = step.registers.PC;
        cpu.SP = step.registers.SP;
      }
      if (step.flags) cpu.flags = { ...step.flags };
      if (step.stage) cpu.stage = step.stage;
      if (step.output) cpu.output = [...step.output];
      renderCpuViews();
    },
    onReset: () => {
      resetCpuState();
    },
  });

  // UI Root
  const root = h('div', { class: 'nx-archlab-app' });
  const header = h('div', { class: 'nx-archlab-header' });
  const content = h('div', { class: 'nx-archlab-main' });

  // Tab buttons
  const tabNumBtn = h('button', { class: 'nx-cs-btn active' }, t('tabs.numbers'));
  const tabCpuBtn = h('button', { class: 'nx-cs-btn' }, t('tabs.cpu'));

  tabNumBtn.addEventListener('click', () => {
    activeTab = 'numbers';
    tabNumBtn.classList.add('active');
    tabCpuBtn.classList.remove('active');
    engine.pause();
    renderView();
  });

  tabCpuBtn.addEventListener('click', () => {
    activeTab = 'cpu';
    tabCpuBtn.classList.add('active');
    tabNumBtn.classList.remove('active');
    renderView();
  });

  header.append(h('div', { style: 'display:flex;gap:6px;' }, tabNumBtn, tabCpuBtn));
  root.append(header, content);
  container.append(root);

  function resetCpuState() {
    cpu.reset();
    binaryMap = assembleNexus8(asmCode);
    cpu.memory.set(binaryMap.binary);
    engine.init(runCpu, cpu, 2000);
    renderCpuViews();
  }

  function renderView() {
    content.innerHTML = '';
    if (activeTab === 'numbers') {
      renderNumbersTab();
    } else {
      renderCpuTab();
    }
  }

  // --- TAB 1: NUMBER REPRESENTATION ---
  function renderNumbersTab() {
    const wrap = h('div', { class: 'nx-archlab-content' });

    // 1. Controls Bar
    const controlsBar = h('div', { style: 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;' }, [
      h('span', { style: 'font-size:12px;color:var(--text-2)' }, t('numbers.input')),
      h('input', {
        type: 'number',
        class: 'nx-input small',
        value: String(intVal),
        id: 'num-int-input',
        style: 'width:100px;',
      }),
      h('span', { style: 'font-size:12px;color:var(--text-2)' }, t('numbers.bits')),
      h('select', { class: 'nx-input small', id: 'num-bits-select' }, [
        h('option', { value: '4', selected: intBits === 4 }, '4 bits'),
        h('option', { value: '8', selected: intBits === 8 }, '8 bits'),
        h('option', { value: '16', selected: intBits === 16 }, '16 bits'),
        h('option', { value: '32', selected: intBits === 32 }, '32 bits'),
      ]),
    ]);

    const intInput = /** @type {HTMLInputElement} */ (controlsBar.querySelector('#num-int-input'));
    const bitsSelect = /** @type {HTMLSelectElement} */ (controlsBar.querySelector('#num-bits-select'));

    intInput?.addEventListener('input', () => {
      intVal = parseInt(intInput.value, 10) || 0;
      updateIntegerCards();
    });

    bitsSelect?.addEventListener('change', () => {
      intBits = parseInt(bitsSelect.value, 10) || 8;
      updateIntegerCards();
    });

    wrap.append(controlsBar);

    // 2. Integer Formats Grid
    const formatsContainer = h('div', {
      style: 'display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;',
    });
    wrap.append(formatsContainer);

    function updateIntegerCards() {
      formatsContainer.innerHTML = '';
      const rep = formatInteger(intVal, intBits);

      const makeCard = (title, val, inRange, note = '') =>
        h('div', { class: 'nx-archlab-panel' }, [
          h('h4', {}, title),
          h(
            'div',
            {
              style: `font-size:16px;font-family:var(--font-mono);font-weight:bold;color:${inRange ? 'var(--accent)' : '#f87171'}`,
            },
            val,
          ),
          note ? h('div', { style: 'font-size:11px;color:var(--text-2);margin-top:4px;' }, note) : '',
        ]);

      formatsContainer.append(
        makeCard(
          t('numbers.twosComp'),
          rep.twosComplement.binary,
          rep.twosComplement.inRange,
          `Range: [${rep.twosComplement.min}, ${rep.twosComplement.max}] | Hex: ${rep.hex}`,
        ),
        makeCard(t('numbers.unsigned'), rep.unsigned.value, rep.unsigned.inRange, `Max: ${rep.unsigned.max}`),
        makeCard(
          t('numbers.signMag'),
          rep.signMagnitude.binary,
          rep.signMagnitude.inRange,
          'Sign bit + Magnitude bits',
        ),
        makeCard(
          t('numbers.onesComp'),
          rep.onesComplement.binary,
          rep.onesComplement.inRange,
          'Inverted bits if negative',
        ),
      );
    }
    updateIntegerCards();

    // 3. Binary Addition & Flags
    const additionCard = h('div', { class: 'nx-archlab-panel' });
    function updateAdditionCard() {
      additionCard.innerHTML = '';
      const addRes = simulateIntegerAddition(addA, addB, intBits);
      additionCard.append(
        h('h4', {}, t('numbers.addition')),
        h('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:8px;' }, [
          h('span', {}, 'A:'),
          h('input', {
            type: 'number',
            class: 'nx-input small',
            value: String(addA),
            style: 'width:80px',
            oninput: (e) => {
              addA = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10) || 0;
              updateAdditionCard();
            },
          }),
          h('span', {}, 'B:'),
          h('input', {
            type: 'number',
            class: 'nx-input small',
            value: String(addB),
            style: 'width:80px',
            oninput: (e) => {
              addB = parseInt(/** @type {HTMLInputElement} */ (e.target).value, 10) || 0;
              updateAdditionCard();
            },
          }),
          h('span', { style: 'font-family:var(--font-mono)' }, `-> Sum: ${addRes.sum} (0b${addRes.binarySum})`),
        ]),
        h('div', { class: 'nx-flags-bar' }, [
          h('div', { class: `nx-flag-badge${addRes.flags.C ? ' active' : ''}` }, `Carry (C): ${addRes.flags.C}`),
          h('div', { class: `nx-flag-badge${addRes.flags.V ? ' active' : ''}` }, `Overflow (V): ${addRes.flags.V}`),
          h('div', { class: `nx-flag-badge${addRes.flags.Z ? ' active' : ''}` }, `Zero (Z): ${addRes.flags.Z}`),
          h('div', { class: `nx-flag-badge${addRes.flags.S ? ' active' : ''}` }, `Sign (S): ${addRes.flags.S}`),
        ]),
      );
    }
    updateAdditionCard();
    wrap.append(additionCard);

    // 4. IEEE 754 Inspector
    const ieeeCard = h('div', { class: 'nx-archlab-panel' });
    function updateIeeeCard() {
      ieeeCard.innerHTML = '';
      const ieee = encodeIEEE754(floatVal, floatPrec);

      const headerRow = h('div', { style: 'display:flex;justify-content:space-between;align-items:center;' }, [
        h('h4', { style: 'margin:0' }, t('numbers.ieeeTitle')),
        h('div', { style: 'display:flex;gap:8px;align-items:center;' }, [
          h('input', {
            type: 'number',
            step: 'any',
            class: 'nx-input small',
            value: String(floatVal),
            style: 'width:120px;',
            oninput: (e) => {
              floatVal = parseFloat(/** @type {HTMLInputElement} */ (e.target).value) || 0;
              updateIeeeCard();
            },
          }),
          h(
            'select',
            {
              class: 'nx-input small',
              onchange: (e) => {
                floatPrec = /** @type {any} */ (/** @type {HTMLSelectElement} */ (e.target).value);
                updateIeeeCard();
              },
            },
            [
              h('option', { value: 'half', selected: floatPrec === 'half' }, 'Half (16-bit)'),
              h('option', { value: 'single', selected: floatPrec === 'single' }, 'Single (32-bit)'),
              h('option', { value: 'double', selected: floatPrec === 'double' }, 'Double (64-bit)'),
            ],
          ),
        ]),
      ]);

      const bitStrip = h('div', { class: 'nx-bit-strip' });
      // Sign bit
      bitStrip.append(
        h('div', { class: 'nx-bit-box sign' }, [h('span', {}, ieee.signBit), h('span', { class: 'nx-bit-idx' }, 's')]),
      );
      // Exponent bits
      for (let i = 0; i < ieee.expBits.length; i++) {
        bitStrip.append(
          h('div', { class: 'nx-bit-box exp' }, [
            h('span', {}, ieee.expBits[i]),
            h('span', { class: 'nx-bit-idx' }, `e${ieee.expBits.length - 1 - i}`),
          ]),
        );
      }
      // Mantissa bits
      for (let i = 0; i < ieee.mantissaBits.length; i++) {
        bitStrip.append(
          h('div', { class: 'nx-bit-box mantissa' }, [
            h('span', {}, ieee.mantissaBits[i]),
            h('span', { class: 'nx-bit-idx' }, `m${i}`),
          ]),
        );
      }

      const formulaInfo = h('div', { style: 'margin-top:8px;font-family:var(--font-mono);font-size:12px;' }, [
        h('p', {}, `Value Type: ${ieee.type} | Formula: ${ieee.formula}`),
        h(
          'p',
          { style: 'color:var(--text-2)' },
          `Sign: ${ieee.signBit === '0' ? '+1' : '-1'} | Exp (raw): ${parseInt(ieee.expBits, 2)} | Exp (val): ${ieee.expVal}`,
        ),
      ]);

      const floatProbBtn = h(
        'button',
        { class: 'nx-cs-btn small', style: 'margin-top:8px;' },
        t('numbers.floatProblem'),
      );
      const probExplainer = h('div', {
        style: 'display:none;margin-top:8px;padding:8px;background:var(--surface-2);border-radius:6px;font-size:11px;',
      });
      floatProbBtn.addEventListener('click', () => {
        const prob = explainFloatProblem();
        probExplainer.style.display = probExplainer.style.display === 'none' ? 'block' : 'none';
        probExplainer.innerHTML =
          `<strong>0.1 + 0.2 === 0.3?</strong> ${prob.equal ? 'true' : 'false'}<br>` +
          `0.1 = ${prob.a.exact}<br>` +
          `0.2 = ${prob.b.exact}<br>` +
          `Sum = ${prob.sum.exact}<br>` +
          `Expected = ${prob.expected.exact}<br>` +
          `Diff = ${prob.diff}<br><br>${prob.explanation}`;
      });

      ieeeCard.append(headerRow, bitStrip, formulaInfo, floatProbBtn, probExplainer);
    }
    updateIeeeCard();
    wrap.append(ieeeCard);

    // 5. Step-by-Step Base Conversion
    const baseCard = h('div', { class: 'nx-archlab-panel' }, [
      h('h4', {}, t('numbers.baseConv')),
      h('p', { style: 'color:var(--text-2)' }, `Division steps for integer part (${Math.abs(intVal)}):`),
    ]);
    const steps = getStepByStepDivision(Math.abs(intVal), 2);
    const stepsList = h(
      'ul',
      { style: 'padding-left:16px;font-family:var(--font-mono);font-size:11px;margin:4px 0;' },
      [...steps.map((s) => h('li', {}, s.division))],
    );
    baseCard.append(stepsList);
    wrap.append(baseCard);

    content.append(wrap);
  }

  // --- TAB 2: NEXUS-8 CPU SIMULATOR ---
  let memGridEl = null;
  let regBarEl = null;
  let flagBarEl = null;
  let outputBoxEl = null;

  function renderCpuViews() {
    if (regBarEl) {
      regBarEl.innerHTML =
        `A: <strong>0x${cpu.A.toString(16).padStart(2, '0').toUpperCase()}</strong> (${cpu.A}) | ` +
        `B: <strong>0x${cpu.B.toString(16).padStart(2, '0').toUpperCase()}</strong> | ` +
        `C: <strong>0x${cpu.C.toString(16).padStart(2, '0').toUpperCase()}</strong> | ` +
        `PC: <strong>0x${cpu.PC.toString(16).padStart(2, '0').toUpperCase()}</strong> | ` +
        `SP: <strong>0x${cpu.SP.toString(16).padStart(2, '0').toUpperCase()}</strong> | ` +
        `Cycles: <strong>${cpu.cycles}</strong> | ` +
        `Stage: <span style="color:var(--accent);font-weight:bold">${cpu.stage}</span>`;
    }

    if (flagBarEl) {
      flagBarEl.innerHTML = `Flags: [Z:${cpu.flags.Z} C:${cpu.flags.C} V:${cpu.flags.V} N:${cpu.flags.N}]`;
    }

    if (outputBoxEl) {
      outputBoxEl.textContent = cpu.output.length > 0 ? cpu.output.join(', ') : '(empty)';
    }

    if (memGridEl) {
      memGridEl.innerHTML = '';
      for (let i = 0; i < 256; i++) {
        const val = cpu.memory[i];
        const isPC = i === cpu.PC;
        const isSP = i === cpu.SP;
        const cell = h(
          'div',
          {
            class: `nx-mem-cell${isPC ? ' pc' : ''}${isSP ? ' sp' : ''}`,
            title: `[0x${i.toString(16).padStart(2, '0')}]: ${val}`,
          },
          val.toString(16).padStart(2, '0').toUpperCase(),
        );
        memGridEl.append(cell);
      }
    }
  }

  function renderCpuTab() {
    const wrap = h('div', { class: 'nx-archlab-content' });

    // Controls Row
    const controlsRow = h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;' });

    const presetSelect = h('select', { class: 'nx-input small' }, [
      ...Object.entries(CPU_PRESETS).map(([k, p]) =>
        h(
          'option',
          { value: k, selected: k === selectedPresetKey },
          p.name[ctx.i18n.currentLocale === 'de' ? 'de' : 'en'] || p.name.en,
        ),
      ),
    ]);
    presetSelect.addEventListener('change', () => {
      selectedPresetKey = presetSelect.value;
      asmCode = CPU_PRESETS[selectedPresetKey].code;
      if (editorTextarea) editorTextarea.value = asmCode;
      resetCpuState();
    });

    const assembleBtn = h('button', { class: 'nx-cs-btn primary' }, t('cpu.assemble'));
    assembleBtn.addEventListener('click', () => {
      if (editorTextarea) asmCode = editorTextarea.value;
      resetCpuState();
    });

    const saveBtn = h('button', { class: 'nx-cs-btn' }, t('controls.save'));
    saveBtn.addEventListener('click', async () => {
      const path = await saveStateToVfs(ctx, 'archlab', {
        asmCode,
        registers: { A: cpu.A, B: cpu.B, C: cpu.C, PC: cpu.PC, SP: cpu.SP },
      });
      if (path) ctx.notify?.({ title: 'Saved State', message: path });
    });

    const loadBtn = h('button', { class: 'nx-cs-btn' }, t('controls.load'));
    loadBtn.addEventListener('click', async () => {
      const state = await loadStateFromVfs(ctx, 'archlab');
      if (state?.asmCode) {
        asmCode = state.asmCode;
        if (editorTextarea) editorTextarea.value = asmCode;
        resetCpuState();
      }
    });

    const pngBtn = h('button', { class: 'nx-cs-btn' }, t('controls.exportPng'));
    pngBtn.addEventListener('click', () => exportPng(wrap, 'cpu-state.png'));

    controlsRow.append(presetSelect, assembleBtn, saveBtn, loadBtn, pngBtn);
    wrap.append(controlsRow);

    // Visualizer Engine Controls
    wrap.append(renderVisualizerControls(engine));

    // Split Layout: Editor on left, CPU inspection on right
    const split = h('div', { style: 'display:grid;grid-template-columns:1fr 1.2fr;gap:12px;flex:1;min-height:0;' });

    // Left: Assembly Editor
    const editorCard = h('div', { class: 'nx-archlab-panel', style: 'display:flex;flex-direction:column;' }, [
      h('h4', {}, 'Assembly Code (Nexus-8)'),
    ]);
    const editorTextarea = h('textarea', {
      class: 'nx-input',
      style: 'flex:1;font-family:var(--font-mono);font-size:12px;line-height:1.4;resize:none;min-height:240px;',
    });
    editorTextarea.value = asmCode;
    editorCard.append(editorTextarea);

    // Right: Status, Registers, Flags, Memory
    const inspectCard = h('div', { class: 'nx-archlab-panel', style: 'display:flex;flex-direction:column;gap:8px;' });

    regBarEl = h('div', {
      style: 'font-family:var(--font-mono);font-size:12px;background:var(--surface-2);padding:6px;border-radius:4px;',
    });
    flagBarEl = h('div', { style: 'font-family:var(--font-mono);font-size:11px;color:var(--text-2);' });
    outputBoxEl = h('div', {
      style:
        'font-family:var(--font-mono);font-size:12px;color:var(--accent);background:var(--surface-2);padding:6px;border-radius:4px;',
    });

    inspectCard.append(
      h('h4', { style: 'margin:0' }, t('cpu.registers')),
      regBarEl,
      flagBarEl,
      h('h4', { style: 'margin:4px 0 0 0' }, t('cpu.output')),
      outputBoxEl,
      h('h4', { style: 'margin:4px 0 0 0' }, t('cpu.memory')),
    );

    memGridEl = h('div', { class: 'nx-mem-grid' });
    inspectCard.append(memGridEl);

    split.append(editorCard, inspectCard);
    wrap.append(split);
    content.append(wrap);

    resetCpuState();
  }

  renderView();

  return () => {
    engine.pause();
  };
}

export const commands = {
  'archlab.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.archlab', args });
  },
};

export const terminal = {
  archlab: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.archlab' });
      return 0;
    }

    const sub = args[0].toLowerCase();
    if (sub === 'num') {
      const val = parseInt(args[1] || '42', 10);
      const rep = formatInteger(val, 8);
      io.stdout?.(
        `Integer Representation for ${val} (8-bit):\n` +
          `  Hex: ${rep.hex}\n` +
          `  Two's Complement: ${rep.twosComplement.binary}\n` +
          `  Sign-Magnitude:   ${rep.signMagnitude.binary}\n` +
          `  One's Complement: ${rep.onesComplement.binary}\n` +
          `  Unsigned:         ${rep.unsigned.value}\n`,
      );
      return 0;
    }

    if (sub === 'ieee') {
      const val = parseFloat(args[1] || '0.15625');
      const ieee = encodeIEEE754(val, 'single');
      io.stdout?.(
        `IEEE-754 Single Precision (32-bit) for ${val}:\n` +
          `  Sign bit:     ${ieee.signBit}\n` +
          `  Exponent:     ${ieee.expBits} (biased ${parseInt(ieee.expBits, 2)}, unadjusted ${ieee.expVal})\n` +
          `  Mantissa:     ${ieee.mantissaBits}\n` +
          `  Formula:      ${ieee.formula}\n`,
      );
      return 0;
    }

    if (sub === 'cpu') {
      const presetKey = args[1] || 'counter';
      const preset = CPU_PRESETS[presetKey] || CPU_PRESETS.counter;
      const cpu = new Nexus8Cpu();
      const bin = assembleNexus8(preset.code);
      cpu.memory.set(bin.binary);

      io.stdout?.(`Running Nexus-8 preset: ${preset.name.en}...\n`);
      const runner = runCpu(cpu, 500);
      let step = runner.next();
      while (!step.done) {
        step = runner.next();
      }
      io.stdout?.(`CPU Finished. Cycles: ${cpu.cycles}. Output: [${cpu.output.join(', ')}]\n`);
      return 0;
    }

    io.stderr?.(`Usage: archlab [num <val> | ieee <float> | cpu <preset>]\n`);
    return 1;
  },
};
