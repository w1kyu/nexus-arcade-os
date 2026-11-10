// @ts-check
// Nexus Calculator: Standard, Scientific, Programmer (8/16/32/64-bit with clickable bits),
// Graphing canvas plot & root finder, Matrix & Equation solvers, and Statistics.
import { button, h, replace } from '../../ui/dom.js';
import { evaluate, formatResult } from '../../ui/calc.js';
import {
  computeStatistics,
  findRoot,
  formatProgrammerValues,
  performBitwiseOp,
  sampleGraphPoints,
  solveLinear2x2,
  solveQuadratic,
  toggleBit,
} from './model.js';
import './styles.css';

/**
 * Terminal command handler: `calc <expression>`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async calc(ctx, io) {
    const expr = io.args.join(' ').trim();
    if (!expr) {
      io.err('Usage: calc <expression> (e.g. calc 2pi + sqrt(16))\n');
      return 1;
    }
    const val = evaluate(expr);
    if (val === null) {
      io.err(`Could not evaluate: "${expr}"\n`);
      return 1;
    }
    io.out(`${formatResult(val, (n) => String(n))}\n`);
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'calculator.open': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.calculator' }),
};

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(root, ctx) {
  /** @type {'standard' | 'scientific' | 'programmer' | 'graphing' | 'equations' | 'stats'} */
  let activeMode = 'standard';

  // Standard/Scientific State
  let currentExpr = '';
  let currentDisplay = '0';

  // Programmer State
  let progVal = 0n;
  /** @type {import('./model.js').WordSize} */
  let progWordSize = 64;

  const container = h('div', { class: 'nx-calculator' });
  replace(root, container);

  function render() {
    // Nav bar with mode selector
    const nav = h(
      'header',
      { class: 'nx-calc-nav' },
      h(
        'div',
        { class: 'nx-calc-modes' },
        button({
          label: ctx.i18n.t('modeStandard'),
          size: 'small',
          variant: activeMode === 'standard' ? 'primary' : 'secondary',
          onClick: () => {
            activeMode = 'standard';
            render();
          },
        }),
        button({
          label: ctx.i18n.t('modeScientific'),
          size: 'small',
          variant: activeMode === 'scientific' ? 'primary' : 'secondary',
          onClick: () => {
            activeMode = 'scientific';
            render();
          },
        }),
        button({
          label: ctx.i18n.t('modeProgrammer'),
          size: 'small',
          variant: activeMode === 'programmer' ? 'primary' : 'secondary',
          onClick: () => {
            activeMode = 'programmer';
            render();
          },
        }),
        button({
          label: ctx.i18n.t('modeGraphing'),
          size: 'small',
          variant: activeMode === 'graphing' ? 'primary' : 'secondary',
          onClick: () => {
            activeMode = 'graphing';
            render();
          },
        }),
        button({
          label: ctx.i18n.t('modeSolver'),
          size: 'small',
          variant: activeMode === 'equations' ? 'primary' : 'secondary',
          onClick: () => {
            activeMode = 'equations';
            render();
          },
        }),
        button({
          label: ctx.i18n.t('modeStats'),
          size: 'small',
          variant: activeMode === 'stats' ? 'primary' : 'secondary',
          onClick: () => {
            activeMode = 'stats';
            render();
          },
        }),
      ),
    );

    const body = h('div', { class: 'nx-calc-body' });

    if (activeMode === 'standard' || activeMode === 'scientific') {
      renderStandardOrScientific(body, activeMode === 'scientific');
    } else if (activeMode === 'programmer') {
      renderProgrammer(body);
    } else if (activeMode === 'graphing') {
      renderGraphing(body);
    } else if (activeMode === 'equations') {
      renderEquations(body);
    } else if (activeMode === 'stats') {
      renderStats(body);
    }

    replace(container, nav, body);
  }

  /**
   * @param {HTMLElement} host
   * @param {boolean} isScientific
   */
  function renderStandardOrScientific(host, isScientific) {
    const displayWrap = h(
      'div',
      { class: 'nx-calc-display-wrap' },
      h('div', { class: 'nx-calc-expr', text: currentExpr }),
      h('div', { class: 'nx-calc-display', text: currentDisplay }),
    );

    const pad = h('div', { class: `nx-calc-pad${isScientific ? ' nx-calc-pad-scientific' : ''}` });

    function pushChar(char) {
      if (currentDisplay === '0' && !['+', '-', '*', '/', '%', '^'].includes(char)) {
        currentDisplay = char;
      } else {
        currentDisplay += char;
      }
      renderStandardOrScientific(host, isScientific);
    }

    function calculate() {
      const res = evaluate(currentDisplay);
      if (res !== null) {
        currentExpr = `${currentDisplay} =`;
        currentDisplay = formatResult(res, (n) => String(n));
      } else {
        currentExpr = currentDisplay;
        currentDisplay = 'Error';
      }
      renderStandardOrScientific(host, isScientific);
    }

    function clear() {
      currentExpr = '';
      currentDisplay = '0';
      renderStandardOrScientific(host, isScientific);
    }

    /** @type {Array<{ label: string, isOp?: boolean, isEquals?: boolean, action: () => void }>} */
    const basicButtons = [
      { label: 'C', action: clear },
      { label: '(', action: () => pushChar('(') },
      { label: ')', action: () => pushChar(')') },
      { label: '÷', isOp: true, action: () => pushChar('/') },

      { label: '7', action: () => pushChar('7') },
      { label: '8', action: () => pushChar('8') },
      { label: '9', action: () => pushChar('9') },
      { label: '×', isOp: true, action: () => pushChar('*') },

      { label: '4', action: () => pushChar('4') },
      { label: '5', action: () => pushChar('5') },
      { label: '6', action: () => pushChar('6') },
      { label: '-', isOp: true, action: () => pushChar('-') },

      { label: '1', action: () => pushChar('1') },
      { label: '2', action: () => pushChar('2') },
      { label: '3', action: () => pushChar('3') },
      { label: '+', isOp: true, action: () => pushChar('+') },

      { label: '0', action: () => pushChar('0') },
      { label: '.', action: () => pushChar('.') },
      { label: '%', action: () => pushChar('%') },
      { label: '=', isEquals: true, action: calculate },
    ];

    /** @type {Array<{ label: string, action: () => void }>} */
    const sciButtons = [
      { label: 'sin', action: () => pushChar('sin(') },
      { label: 'cos', action: () => pushChar('cos(') },
      { label: 'tan', action: () => pushChar('tan(') },
      { label: 'ln', action: () => pushChar('ln(') },
      { label: 'log', action: () => pushChar('log(') },

      { label: 'sqrt', action: () => pushChar('sqrt(') },
      { label: '^', action: () => pushChar('^') },
      { label: 'pi', action: () => pushChar('pi') },
      { label: 'e', action: () => pushChar('e') },
      { label: 'fact', action: () => pushChar('fact(') },
    ];

    if (isScientific) {
      for (const btn of sciButtons) {
        pad.appendChild(
          h('button', {
            class: 'nx-calc-btn',
            text: btn.label,
            onClick: btn.action,
          }),
        );
      }
    }

    for (const btn of basicButtons) {
      pad.appendChild(
        h('button', {
          class: `nx-calc-btn${btn.isOp ? ' is-op' : ''}${btn.isEquals ? ' is-equals' : ''}`,
          text: btn.label,
          onClick: btn.action,
        }),
      );
    }

    const pane = h('div', { style: { display: 'flex', flexDirection: 'column', width: '100%' } }, displayWrap, pad);
    replace(host, pane);
  }

  /**
   * Programmer Mode (HEX, DEC, OCT, BIN, 64 clickable bits)
   * @param {HTMLElement} host
   */
  function renderProgrammer(host) {
    const formatted = formatProgrammerValues(progVal, progWordSize);

    const sizeSel = h(
      'select',
      { class: 'nx-select' },
      h('option', { value: '64', selected: progWordSize === 64, text: '64-bit (QWORD)' }),
      h('option', { value: '32', selected: progWordSize === 32, text: '32-bit (DWORD)' }),
      h('option', { value: '16', selected: progWordSize === 16, text: '16-bit (WORD)' }),
      h('option', { value: '8', selected: progWordSize === 8, text: '8-bit (BYTE)' }),
    );
    sizeSel.addEventListener('change', (e) => {
      progWordSize = /** @type {import('./model.js').WordSize} */ (
        parseInt(/** @type {HTMLSelectElement} */ (e.target).value, 10)
      );
      renderProgrammer(host);
    });

    const basesGrid = h(
      'div',
      { class: 'nx-calc-bases-grid' },
      h(
        'div',
        { class: 'nx-calc-base-row' },
        h('span', { class: 'nx-calc-base-label', text: 'HEX' }),
        h('span', { class: 'nx-calc-base-val', text: formatted.hex }),
      ),
      h(
        'div',
        { class: 'nx-calc-base-row' },
        h('span', { class: 'nx-calc-base-label', text: 'DEC' }),
        h('span', { class: 'nx-calc-base-val', text: formatted.dec }),
      ),
      h(
        'div',
        { class: 'nx-calc-base-row' },
        h('span', { class: 'nx-calc-base-label', text: 'OCT' }),
        h('span', { class: 'nx-calc-base-val', text: formatted.oct }),
      ),
      h(
        'div',
        { class: 'nx-calc-base-row' },
        h('span', { class: 'nx-calc-base-label', text: 'BIN' }),
        h('span', { class: 'nx-calc-base-val', text: formatted.bin }),
      ),
    );

    // 64-bit clickable grid
    const bitCells = [];
    for (let i = progWordSize - 1; i >= 0; i--) {
      const isOn = formatted.bits[i];
      bitCells.push(
        h('div', {
          class: `nx-calc-bit${isOn ? ' is-on' : ''}`,
          text: isOn ? '1' : '0',
          title: `Bit ${i}`,
          onClick: () => {
            progVal = toggleBit(progVal, i, progWordSize);
            renderProgrammer(host);
          },
        }),
      );
    }

    const bitGrid = h('div', { class: 'nx-calc-bits-grid' }, ...bitCells);

    // Bitwise operators
    const opsBar = h(
      'div',
      { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      button({
        label: 'AND',
        onClick: () => {
          const val = prompt('Operand (hex or dec):');
          if (val) {
            progVal = performBitwiseOp('AND', progVal, BigInt(val), progWordSize);
            renderProgrammer(host);
          }
        },
      }),
      button({
        label: 'OR',
        onClick: () => {
          const val = prompt('Operand (hex or dec):');
          if (val) {
            progVal = performBitwiseOp('OR', progVal, BigInt(val), progWordSize);
            renderProgrammer(host);
          }
        },
      }),
      button({
        label: 'XOR',
        onClick: () => {
          const val = prompt('Operand (hex or dec):');
          if (val) {
            progVal = performBitwiseOp('XOR', progVal, BigInt(val), progWordSize);
            renderProgrammer(host);
          }
        },
      }),
      button({
        label: 'NOT',
        onClick: () => {
          progVal = performBitwiseOp('NOT', progVal, 0n, progWordSize);
          renderProgrammer(host);
        },
      }),
      button({
        label: '<< 1',
        onClick: () => {
          progVal = performBitwiseOp('SHL', progVal, 1n, progWordSize);
          renderProgrammer(host);
        },
      }),
      button({
        label: '>> 1',
        onClick: () => {
          progVal = performBitwiseOp('SHR', progVal, 1n, progWordSize);
          renderProgrammer(host);
        },
      }),
      button({
        label: ctx.i18n.t('clear'),
        variant: 'secondary',
        onClick: () => {
          progVal = 0n;
          renderProgrammer(host);
        },
      }),
    );

    const wrap = h(
      'div',
      { class: 'nx-calc-prog-wrap' },
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        h('span', { style: { fontWeight: '600' }, text: 'Programmer Math' }),
        sizeSel,
      ),
      basesGrid,
      h('span', {
        style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' },
        text: 'Click any bit to toggle (Bit 63..0):',
      }),
      bitGrid,
      opsBar,
    );

    replace(host, wrap);
  }

  /**
   * Graphing Mode
   * @param {HTMLElement} host
   */
  function renderGraphing(host) {
    let fnExpr = 'x^2 - 4';
    let xMin = -10;
    let xMax = 10;

    const fnInput = h('input', { type: 'text', class: 'nx-input', value: fnExpr, style: { flex: '1' } });
    fnInput.addEventListener('input', (e) => {
      fnExpr = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-calc-canvas', width: 600, height: 360 }));

    function drawPlot() {
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) return;

      const w = canvas.width;
      const hCanvas = canvas.height;
      ctx2d.clearRect(0, 0, w, hCanvas);

      // Draw Axes
      ctx2d.strokeStyle = '#2d3342';
      ctx2d.lineWidth = 1;

      // x and y zero lines
      const zeroX = w / 2;
      const zeroY = hCanvas / 2;

      ctx2d.beginPath();
      ctx2d.moveTo(0, zeroY);
      ctx2d.lineTo(w, zeroY);
      ctx2d.moveTo(zeroX, 0);
      ctx2d.lineTo(zeroX, hCanvas);
      ctx2d.stroke();

      // Sample points
      const points = sampleGraphPoints(fnExpr, xMin, xMax, 300);
      ctx2d.strokeStyle = '#ff8a3d';
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();

      let started = false;
      const scaleX = w / (xMax - xMin);
      const scaleY = hCanvas / 20; // range -10 to +10

      for (const pt of points) {
        if (pt.y === null || isNaN(pt.y)) {
          started = false;
          continue;
        }
        const canvasX = (pt.x - xMin) * scaleX;
        const canvasY = zeroY - pt.y * scaleY;

        if (!started) {
          ctx2d.moveTo(canvasX, canvasY);
          started = true;
        } else {
          ctx2d.lineTo(canvasX, canvasY);
        }
      }
      ctx2d.stroke();
    }

    const plotBtn = button({
      label: ctx.i18n.t('plot'),
      variant: 'primary',
      onClick: () => {
        drawPlot();
        const root = findRoot(fnExpr, 0, 5);
        if (root !== null) {
          rootLabel.textContent = `Root near [0, 5]: x = ${root}`;
        } else {
          rootLabel.textContent = 'No root found in [0, 5]';
        }
      },
    });

    const rootLabel = h('span', { style: { fontSize: '12px', color: '#ff8a3d', fontWeight: '600' } });

    const toolbar = h(
      'div',
      { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
      h('span', { text: 'f(x) =' }),
      fnInput,
      plotBtn,
    );

    const wrap = h('div', { class: 'nx-calc-graph-wrap' }, toolbar, canvas, rootLabel);
    replace(host, wrap);
    setTimeout(() => drawPlot(), 50);
  }

  /**
   * Equations Mode (Linear 2x2 & Quadratic)
   * @param {HTMLElement} host
   */
  function renderEquations(host) {
    // 2x2: a1 x + b1 y = c1
    let a1 = 2,
      b1 = 3,
      c1 = 8;
    let a2 = 1,
      b2 = -1,
      c2 = 1;
    const resLinear = h('div', { style: { fontSize: '14px', fontWeight: '700', color: '#4ade80' } });

    function solveSys() {
      const sol = solveLinear2x2(a1, b1, c1, a2, b2, c2);
      if (sol) {
        resLinear.textContent = `Result: x = ${sol.x}, y = ${sol.y}`;
      } else {
        resLinear.textContent = 'No unique solution (system is singular)';
      }
    }
    solveSys();

    // Quadratic: ax^2 + bx + c = 0
    let qa = 1,
      qb = -5,
      qc = 6;
    const resQuad = h('div', { style: { fontSize: '14px', fontWeight: '700', color: '#4ade80' } });

    function solveQ() {
      const q = solveQuadratic(qa, qb, qc);
      if (q.isComplex) {
        resQuad.textContent = `Complex roots: ${q.real1} ± ${q.real2}i`;
      } else {
        resQuad.textContent = `Roots: x1 = ${q.real1}, x2 = ${q.real2}`;
      }
    }
    solveQ();

    const wrap = h(
      'div',
      { style: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' } },
      h(
        'div',
        {
          style: {
            padding: '16px',
            background: 'var(--nx-bg-surface, #1a1d26)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          },
        },
        h('strong', { text: ctx.i18n.t('linearSolver') }),
        h('div', { text: 'Row 1: 2x + 3y = 8' }),
        h('div', { text: 'Row 2: 1x - 1y = 1' }),
        resLinear,
      ),
      h(
        'div',
        {
          style: {
            padding: '16px',
            background: 'var(--nx-bg-surface, #1a1d26)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          },
        },
        h('strong', { text: ctx.i18n.t('quadSolver') }),
        h('div', { text: 'Equation: 1x² - 5x + 6 = 0' }),
        resQuad,
      ),
    );

    replace(host, wrap);
  }

  /**
   * Statistics Mode
   * @param {HTMLElement} host
   */
  function renderStats(host) {
    let dataStr = '12, 15, 18, 22, 25, 30, 42';

    const ta = h('textarea', { class: 'nx-textarea', value: dataStr, style: { width: '100%', height: '80px' } });
    const statsBox = h('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        padding: '14px',
        background: 'var(--nx-bg-surface, #1a1d26)',
        borderRadius: '8px',
      },
    });

    function update() {
      const nums = ta.value
        .split(/[,;\s]+/)
        .map(parseFloat)
        .filter((n) => !isNaN(n));
      const s = computeStatistics(nums);

      statsBox.innerHTML = '';
      statsBox.appendChild(
        h(
          'div',
          {},
          h('div', {
            style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' },
            text: ctx.i18n.t('statsCount'),
          }),
          h('div', { style: { fontSize: '18px', fontWeight: '700' }, text: String(s.count) }),
        ),
      );
      statsBox.appendChild(
        h(
          'div',
          {},
          h('div', {
            style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' },
            text: ctx.i18n.t('statsMean'),
          }),
          h('div', { style: { fontSize: '18px', fontWeight: '700', color: '#ff8a3d' }, text: String(s.mean) }),
        ),
      );
      statsBox.appendChild(
        h(
          'div',
          {},
          h('div', {
            style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' },
            text: ctx.i18n.t('statsMedian'),
          }),
          h('div', { style: { fontSize: '18px', fontWeight: '700' }, text: String(s.median) }),
        ),
      );
      statsBox.appendChild(
        h(
          'div',
          {},
          h('div', {
            style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' },
            text: ctx.i18n.t('statsStdDev'),
          }),
          h('div', { style: { fontSize: '18px', fontWeight: '700' }, text: String(s.stdDev) }),
        ),
      );
      statsBox.appendChild(
        h(
          'div',
          {},
          h('div', {
            style: { fontSize: '11px', color: 'var(--nx-text-muted, #7d8590)' },
            text: ctx.i18n.t('statsSum'),
          }),
          h('div', { style: { fontSize: '18px', fontWeight: '700' }, text: String(s.sum) }),
        ),
      );
    }

    ta.addEventListener('input', () => update());
    update();

    const wrap = h(
      'div',
      { style: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' } },
      h('label', { style: { fontSize: '12px', fontWeight: '600' } }, ctx.i18n.t('statsData'), ta),
      statsBox,
    );

    replace(host, wrap);
  }

  render();
}
