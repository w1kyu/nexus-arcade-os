// @ts-check
// Nexus Unit Converter: two-way live conversions across 16 categories,
// SI vs IEC data size, number bases (2, 8, 10, 16), and Roman numerals.
import { h, icon, replace } from '../../ui/dom.js';
import { arabicToRoman, CATEGORIES, convertBase, convertUnit, romanToArabic } from './model.js';
import './styles.css';

/**
 * Terminal command handler: `convert <value> <from> to <to>`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async convert(ctx, io) {
    // Usage: convert 100 km to mi  OR  convert 1024 MiB to MB
    const args = io.args;
    if (args.length < 4 || args[2].toLowerCase() !== 'to') {
      io.err('Usage: convert <value> <from> to <to> (e.g. convert 100 km to mi)\n');
      return 1;
    }
    const val = parseFloat(args[0]);
    const from = args[1];
    const to = args[3];

    if (isNaN(val)) {
      io.err(`Invalid number: "${args[0]}"\n`);
      return 1;
    }

    // Find category that has both units
    let foundCat = null;
    let fromUnitId = '';
    let toUnitId = '';

    for (const cat of CATEGORIES) {
      const f = cat.units.find(
        (u) => u.id.toLowerCase() === from.toLowerCase() || u.name.en.toLowerCase().includes(from.toLowerCase()),
      );
      const t = cat.units.find(
        (u) => u.id.toLowerCase() === to.toLowerCase() || u.name.en.toLowerCase().includes(to.toLowerCase()),
      );
      if (f && t) {
        foundCat = cat;
        fromUnitId = f.id;
        toUnitId = t.id;
        break;
      }
    }

    if (!foundCat) {
      io.err(`Could not find conversion from "${from}" to "${to}".\n`);
      return 1;
    }

    const res = convertUnit(val, fromUnitId, toUnitId, foundCat.id);
    io.out(`${val} ${fromUnitId} = ${res} ${toUnitId}\n`);
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'converter.open': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.converter' }),
};

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(root, ctx) {
  let selectedCatId = 'length';
  let fromUnitId = 'm';
  let toUnitId = 'km';
  let leftValStr = '1000';
  let rightValStr = '1';

  const container = h('div', { class: 'nx-converter' });
  replace(root, container);

  function render() {
    const curCat = CATEGORIES.find((c) => c.id === selectedCatId) ?? CATEGORIES[0];

    // Ensure valid units
    if (!curCat.units.some((u) => u.id === fromUnitId)) {
      fromUnitId = curCat.units[0].id;
    }
    if (!curCat.units.some((u) => u.id === toUnitId)) {
      toUnitId = curCat.units[1]?.id ?? curCat.units[0].id;
    }

    // Category Selector
    const catOptions = CATEGORIES.map((c) =>
      h('option', { value: c.id, selected: c.id === selectedCatId, text: c.name[ctx.i18n.lang] ?? c.name.en }),
    );
    const catSelect = h('select', { class: 'nx-select', style: { width: '220px' } }, ...catOptions);
    catSelect.addEventListener('change', (e) => {
      selectedCatId = /** @type {HTMLSelectElement} */ (e.target).value;
      const cat = CATEGORIES.find((c) => c.id === selectedCatId);
      if (cat) {
        fromUnitId = cat.units[0].id;
        toUnitId = cat.units[1]?.id ?? cat.units[0].id;
        updateFromLeft();
      }
      render();
    });

    const toolbar = h(
      'header',
      { class: 'nx-conv-toolbar' },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' } },
        icon('refresh-cw', { size: 18 }),
        h('span', { text: ctx.i18n.t('appTitle') }),
      ),
      catSelect,
    );

    // Left Panel
    const fromOptions = curCat.units.map((u) =>
      h('option', { value: u.id, selected: u.id === fromUnitId, text: u.name[ctx.i18n.lang] ?? u.name.en }),
    );
    const fromSelect = h('select', { class: 'nx-select' }, ...fromOptions);
    const leftInput = h('input', { type: 'number', step: 'any', class: 'nx-conv-val-input', value: leftValStr });

    // Right Panel
    const toOptions = curCat.units.map((u) =>
      h('option', { value: u.id, selected: u.id === toUnitId, text: u.name[ctx.i18n.lang] ?? u.name.en }),
    );
    const toSelect = h('select', { class: 'nx-select' }, ...toOptions);
    const rightInput = h('input', { type: 'number', step: 'any', class: 'nx-conv-val-input', value: rightValStr });

    function updateFromLeft() {
      const num = parseFloat(leftInput.value);
      if (isNaN(num)) {
        rightInput.value = '';
        rightValStr = '';
      } else {
        const res = convertUnit(num, fromUnitId, toUnitId, curCat.id);
        rightInput.value = String(res);
        rightValStr = String(res);
      }
      leftValStr = leftInput.value;
    }

    function updateFromRight() {
      const num = parseFloat(rightInput.value);
      if (isNaN(num)) {
        leftInput.value = '';
        leftValStr = '';
      } else {
        const res = convertUnit(num, toUnitId, fromUnitId, curCat.id);
        leftInput.value = String(res);
        leftValStr = String(res);
      }
      rightValStr = rightInput.value;
    }

    leftInput.addEventListener('input', updateFromLeft);
    rightInput.addEventListener('input', updateFromRight);

    fromSelect.addEventListener('change', (e) => {
      fromUnitId = /** @type {HTMLSelectElement} */ (e.target).value;
      updateFromLeft();
    });

    toSelect.addEventListener('change', (e) => {
      toUnitId = /** @type {HTMLSelectElement} */ (e.target).value;
      updateFromLeft();
    });

    const swapBtn = h(
      'button',
      {
        class: 'nx-conv-swap-btn',
        title: ctx.i18n.t('swap'),
        onClick: () => {
          const tmp = fromUnitId;
          fromUnitId = toUnitId;
          toUnitId = tmp;
          fromSelect.value = fromUnitId;
          toSelect.value = toUnitId;
          updateFromLeft();
        },
      },
      icon('refresh-cw', { size: 16 }),
    );

    const leftPanel = h(
      'div',
      { class: 'nx-conv-panel' },
      h('span', { style: { fontSize: '12px', color: 'var(--nx-text-muted, #7d8590)' } }, ctx.i18n.t('from')),
      leftInput,
      fromSelect,
    );
    const rightPanel = h(
      'div',
      { class: 'nx-conv-panel' },
      h('span', { style: { fontSize: '12px', color: 'var(--nx-text-muted, #7d8590)' } }, ctx.i18n.t('to')),
      rightInput,
      toSelect,
    );

    const grid = h('div', { class: 'nx-conv-grid' }, leftPanel, swapBtn, rightPanel);

    // Number Bases Card (live across 2, 8, 10, 16)
    let decBaseVal = '42';
    const binIn = h('input', { type: 'text', class: 'nx-input', value: convertBase(decBaseVal, 10, 2) });
    const octIn = h('input', { type: 'text', class: 'nx-input', value: convertBase(decBaseVal, 10, 8) });
    const decIn = h('input', { type: 'text', class: 'nx-input', value: decBaseVal });
    const hexIn = h('input', { type: 'text', class: 'nx-input', value: convertBase(decBaseVal, 10, 16) });

    decIn.addEventListener('input', () => {
      decBaseVal = decIn.value;
      binIn.value = convertBase(decBaseVal, 10, 2);
      octIn.value = convertBase(decBaseVal, 10, 8);
      hexIn.value = convertBase(decBaseVal, 10, 16);
    });

    binIn.addEventListener('input', () => {
      const d = convertBase(binIn.value, 2, 10);
      decIn.value = d;
      octIn.value = convertBase(d, 10, 8);
      hexIn.value = convertBase(d, 10, 16);
    });

    hexIn.addEventListener('input', () => {
      const d = convertBase(hexIn.value, 16, 10);
      decIn.value = d;
      binIn.value = convertBase(d, 10, 2);
      octIn.value = convertBase(d, 10, 8);
    });

    const basesCard = h(
      'div',
      { class: 'nx-conv-extra-card' },
      h('span', { style: { fontSize: '13px', fontWeight: '600' }, text: ctx.i18n.t('numberBases') }),
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' } },
        h('label', { style: { fontSize: '11px' } }, 'BIN (2)', binIn),
        h('label', { style: { fontSize: '11px' } }, 'OCT (8)', octIn),
        h('label', { style: { fontSize: '11px' } }, 'DEC (10)', decIn),
        h('label', { style: { fontSize: '11px' } }, 'HEX (16)', hexIn),
      ),
    );

    // Roman Numerals Card
    const arabIn = h('input', { type: 'number', class: 'nx-input', value: '2026', min: '1', max: '3999' });
    const romIn = h('input', { type: 'text', class: 'nx-input', value: 'MMXXVI' });

    arabIn.addEventListener('input', () => {
      const num = parseInt(arabIn.value, 10);
      romIn.value = arabicToRoman(num);
    });

    romIn.addEventListener('input', () => {
      const num = romanToArabic(romIn.value);
      if (num !== null) arabIn.value = String(num);
    });

    const romanCard = h(
      'div',
      { class: 'nx-conv-extra-card' },
      h('span', { style: { fontSize: '13px', fontWeight: '600' }, text: ctx.i18n.t('romanNumerals') }),
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
        h('label', { style: { fontSize: '11px' } }, ctx.i18n.t('arabic'), arabIn),
        h('label', { style: { fontSize: '11px' } }, ctx.i18n.t('roman'), romIn),
      ),
    );

    const body = h('div', { class: 'nx-conv-body' }, grid, basesCard, romanCard);
    replace(container, toolbar, body);
  }

  render();
}
