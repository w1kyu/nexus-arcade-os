// @ts-check
import { h, icon } from './dom.js';
import './diff.css';

/**
 * Computes longest common subsequence between two arrays.
 * @template T
 * @param {T[]} a
 * @param {T[]} b
 * @param {(x: T, y: T) => boolean} equals
 * @returns {{ type: 'equal' | 'delete' | 'insert', aItem?: T, bItem?: T, aIndex?: number, bIndex?: number }[]}
 */
export function diffArrays(a, b, equals = (x, y) => x === y) {
  const n = a.length;
  const m = b.length;
  // DP table for LCS length
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (equals(a[i], b[j])) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack
  const result = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && equals(a[i - 1], b[j - 1])) {
      result.unshift({
        type: /** @type {const} */ ('equal'),
        aItem: a[i - 1],
        bItem: b[j - 1],
        aIndex: i - 1,
        bIndex: j - 1,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: /** @type {const} */ ('insert'), bItem: b[j - 1], bIndex: j - 1 });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.unshift({ type: /** @type {const} */ ('delete'), aItem: a[i - 1], aIndex: i - 1 });
      i--;
    }
  }
  return result;
}

/**
 * Word level diff for two strings.
 * @param {string} a
 * @param {string} b
 */
export function diffWords(a, b) {
  // tokenize words & spaces
  const tokenize = (/** @type {string} */ s) => s.match(/\w+|[^\w\s]+|\s+/g) || [];
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);
  return diffArrays(wordsA, wordsB);
}

/**
 * Line-level diff with options.
 * @param {string} textA
 * @param {string} textB
 * @param {{ ignoreWhitespace?: boolean, ignoreCase?: boolean }} [options]
 */
export function diffLines(textA, textB, options = {}) {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');

  const normalize = (/** @type {string} */ s) => {
    let res = s;
    if (options.ignoreWhitespace) res = res.trim().replace(/\s+/g, ' ');
    if (options.ignoreCase) res = res.toLowerCase();
    return res;
  };

  const diff = diffArrays(linesA, linesB, (x, y) => normalize(x) === normalize(y));

  // Count changes
  let added = 0;
  let deleted = 0;
  for (const item of diff) {
    if (item.type === 'insert') added++;
    else if (item.type === 'delete') deleted++;
  }

  return { diff, linesA, linesB, added, deleted };
}

/**
 * Generates unified diff patch (.patch).
 * @param {string} filename
 * @param {string} oldText
 * @param {string} newText
 * @param {string} [oldHeader]
 * @param {string} [newHeader]
 */
export function createUnifiedPatch(filename, oldText, newText, oldHeader = 'a/', newHeader = 'b/') {
  const { diff, linesA, linesB } = diffLines(oldText, newText);
  let patch = `--- ${oldHeader}${filename}\n+++ ${newHeader}${filename}\n`;
  patch += `@@ -1,${linesA.length} +1,${linesB.length} @@\n`;
  for (const item of diff) {
    if (item.type === 'equal') {
      patch += ` ${item.aItem}\n`;
    } else if (item.type === 'delete') {
      patch += `-${item.aItem}\n`;
    } else if (item.type === 'insert') {
      patch += `+${item.bItem}\n`;
    }
  }
  return patch;
}

/**
 * Creates an interactive Diff Viewer component.
 * @param {object} opts
 * @param {string} [opts.oldText]
 * @param {string} [opts.newText]
 * @param {string} [opts.oldTitle]
 * @param {string} [opts.newTitle]
 * @param {'split' | 'inline'} [opts.mode]
 * @param {(patch: string) => void} [opts.onExportPatch]
 */
export function createDiffViewer(opts = {}) {
  let oldText = opts.oldText || '';
  let newText = opts.newText || '';
  let mode = opts.mode || 'split';
  let ignoreWhitespace = false;
  let ignoreCase = false;
  let changeIndices = /** @type {number[]} */ ([]);
  let currentChangeIndex = -1;

  const root = h('div', { class: 'nx-diff-viewer' });

  // Toolbar
  const toolbar = h('div', { class: 'nx-diff-toolbar' });
  const statsEl = h('div', { class: 'nx-diff-stats' });
  const navEl = h('div', { style: 'display: flex; gap: 4px; align-items: center;' });

  const prevBtn = h(
    'button',
    { class: 'nx-button ghost small', title: 'Previous change' },
    icon('chevron-up', { size: 14 }),
  );
  const nextBtn = h(
    'button',
    { class: 'nx-button ghost small', title: 'Next change' },
    icon('chevron-down', { size: 14 }),
  );
  const changeCountEl = h(
    'span',
    { style: 'font-size: 11px; color: var(--text-2); min-width: 48px; text-align: center;' },
    '0/0',
  );
  navEl.append(prevBtn, nextBtn, changeCountEl);

  // View toggles
  const modeBtn = h(
    'button',
    { class: 'nx-button ghost small', title: 'Toggle Split / Inline view' },
    icon('layout-split', { size: 14 }),
    'Split',
  );
  modeBtn.addEventListener('click', () => {
    mode = mode === 'split' ? 'inline' : 'split';
    modeBtn.textContent = mode === 'split' ? 'Split' : 'Inline';
    render();
  });

  const wsBtn = h('button', { class: 'nx-button ghost small', title: 'Ignore whitespace' }, 'Ignore WS');
  wsBtn.addEventListener('click', () => {
    ignoreWhitespace = !ignoreWhitespace;
    wsBtn.classList.toggle('primary', ignoreWhitespace);
    render();
  });

  const caseBtn = h('button', { class: 'nx-button ghost small', title: 'Ignore case' }, 'Ignore Case');
  caseBtn.addEventListener('click', () => {
    ignoreCase = !ignoreCase;
    caseBtn.classList.toggle('primary', ignoreCase);
    render();
  });

  const patchBtn = h(
    'button',
    { class: 'nx-button ghost small', title: 'Export .patch unified diff' },
    icon('download', { size: 14 }),
    'Export Patch',
  );
  patchBtn.addEventListener('click', () => {
    const patch = createUnifiedPatch('file.txt', oldText, newText);
    const blob = new Blob([patch], { type: 'text/x-diff;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'changes.patch';
    a.click();
    URL.revokeObjectURL(url);
    opts.onExportPatch?.(patch);
  });

  toolbar.append(statsEl, navEl, modeBtn, wsBtn, caseBtn, patchBtn);

  // Diff Container
  const container = h('div', { class: 'nx-diff-container' });
  root.append(toolbar, container);

  function render() {
    container.replaceChildren();
    const { diff, added, deleted } = diffLines(oldText, newText, { ignoreWhitespace, ignoreCase });

    statsEl.innerHTML = `<span class="nx-diff-stat-add">+${added}</span> <span class="nx-diff-stat-del">-${deleted}</span>`;

    changeIndices = [];
    currentChangeIndex = -1;

    if (mode === 'split') {
      renderSplit(diff);
    } else {
      renderInline(diff);
    }

    updateNav();
  }

  /** @param {ReturnType<typeof diffLines>['diff']} diff */
  function renderInline(diff) {
    let lineA = 1;
    let lineB = 1;
    let rowIdx = 0;

    for (let k = 0; k < diff.length; k++) {
      const item = diff[k];
      let lineCls = 'nx-diff-line';
      let prefix = ' ';
      let text = '';
      let numText = '';

      if (item.type === 'equal') {
        text = item.aItem ?? '';
        numText = `${lineA++} ${lineB++}`;
      } else if (item.type === 'delete') {
        lineCls += ' nx-diff-deleted';
        prefix = '-';
        text = item.aItem ?? '';
        numText = `${lineA++}   `;
        changeIndices.push(rowIdx);
      } else if (item.type === 'insert') {
        lineCls += ' nx-diff-added';
        prefix = '+';
        text = item.bItem ?? '';
        numText = `   ${lineB++}`;
        changeIndices.push(rowIdx);
      }

      const row = h(
        'div',
        { class: lineCls, 'data-row-index': String(rowIdx) },
        h('span', { class: 'nx-diff-line-num' }, numText),
        h('span', { class: 'nx-diff-line-prefix' }, prefix),
        h('span', { class: 'nx-diff-line-content' }, text),
      );
      container.append(row);
      rowIdx++;
    }
  }

  /** @param {ReturnType<typeof diffLines>['diff']} diff */
  function renderSplit(diff) {
    const splitWrapper = h('div', { class: 'nx-diff-split' });
    const leftSide = h('div', { class: 'nx-diff-split-side' });
    const rightSide = h('div', { class: 'nx-diff-split-side' });
    splitWrapper.append(leftSide, rightSide);
    container.append(splitWrapper);

    let lineA = 1;
    let lineB = 1;
    let rowIdx = 0;

    let idx = 0;
    while (idx < diff.length) {
      const item = diff[idx];
      if (item.type === 'equal') {
        const leftRow = h(
          'div',
          { class: 'nx-diff-line', 'data-row-index': String(rowIdx) },
          h('span', { class: 'nx-diff-line-num' }, String(lineA++)),
          h('span', { class: 'nx-diff-line-prefix' }, ' '),
          h('span', { class: 'nx-diff-line-content' }, item.aItem ?? ''),
        );
        const rightRow = h(
          'div',
          { class: 'nx-diff-line', 'data-row-index': String(rowIdx) },
          h('span', { class: 'nx-diff-line-num' }, String(lineB++)),
          h('span', { class: 'nx-diff-line-prefix' }, ' '),
          h('span', { class: 'nx-diff-line-content' }, item.bItem ?? ''),
        );
        leftSide.append(leftRow);
        rightSide.append(rightRow);
        rowIdx++;
        idx++;
      } else if (item.type === 'delete') {
        // check if next is insert (modification)
        const next = diff[idx + 1];
        if (next && next.type === 'insert') {
          // Word diff highlighting
          const wDiff = diffWords(item.aItem ?? '', next.bItem ?? '');
          const leftContent = h('span', { class: 'nx-diff-line-content' });
          const rightContent = h('span', { class: 'nx-diff-line-content' });

          for (const w of wDiff) {
            if (w.type === 'equal') {
              leftContent.append(document.createTextNode(w.aItem ?? ''));
              rightContent.append(document.createTextNode(w.bItem ?? ''));
            } else if (w.type === 'delete') {
              leftContent.append(h('span', { class: 'nx-diff-word-change' }, w.aItem ?? ''));
            } else if (w.type === 'insert') {
              rightContent.append(h('span', { class: 'nx-diff-word-change' }, w.bItem ?? ''));
            }
          }

          const leftRow = h(
            'div',
            { class: 'nx-diff-line nx-diff-deleted', 'data-row-index': String(rowIdx) },
            h('span', { class: 'nx-diff-line-num' }, String(lineA++)),
            h('span', { class: 'nx-diff-line-prefix' }, '-'),
            leftContent,
          );
          const rightRow = h(
            'div',
            { class: 'nx-diff-line nx-diff-added', 'data-row-index': String(rowIdx) },
            h('span', { class: 'nx-diff-line-num' }, String(lineB++)),
            h('span', { class: 'nx-diff-line-prefix' }, '+'),
            rightContent,
          );
          leftSide.append(leftRow);
          rightSide.append(rightRow);
          changeIndices.push(rowIdx);
          rowIdx++;
          idx += 2;
        } else {
          // pure deletion
          const leftRow = h(
            'div',
            { class: 'nx-diff-line nx-diff-deleted', 'data-row-index': String(rowIdx) },
            h('span', { class: 'nx-diff-line-num' }, String(lineA++)),
            h('span', { class: 'nx-diff-line-prefix' }, '-'),
            h('span', { class: 'nx-diff-line-content' }, item.aItem ?? ''),
          );
          const rightRow = h(
            'div',
            { class: 'nx-diff-line nx-diff-empty', 'data-row-index': String(rowIdx) },
            h('span', { class: 'nx-diff-line-num' }, ''),
            h('span', { class: 'nx-diff-line-prefix' }, ''),
            h('span', { class: 'nx-diff-line-content' }, ''),
          );
          leftSide.append(leftRow);
          rightSide.append(rightRow);
          changeIndices.push(rowIdx);
          rowIdx++;
          idx++;
        }
      } else if (item.type === 'insert') {
        // pure insertion
        const leftRow = h(
          'div',
          { class: 'nx-diff-line nx-diff-empty', 'data-row-index': String(rowIdx) },
          h('span', { class: 'nx-diff-line-num' }, ''),
          h('span', { class: 'nx-diff-line-prefix' }, ''),
          h('span', { class: 'nx-diff-line-content' }, ''),
        );
        const rightRow = h(
          'div',
          { class: 'nx-diff-line nx-diff-added', 'data-row-index': String(rowIdx) },
          h('span', { class: 'nx-diff-line-num' }, String(lineB++)),
          h('span', { class: 'nx-diff-line-prefix' }, '+'),
          h('span', { class: 'nx-diff-line-content' }, item.bItem ?? ''),
        );
        leftSide.append(leftRow);
        rightSide.append(rightRow);
        changeIndices.push(rowIdx);
        rowIdx++;
        idx++;
      }
    }
  }

  function updateNav() {
    changeCountEl.textContent = `${changeIndices.length > 0 ? currentChangeIndex + 1 : 0}/${changeIndices.length}`;
  }

  function jumpToChange(/** @type {number} */ delta) {
    if (changeIndices.length === 0) return;
    currentChangeIndex = (currentChangeIndex + delta + changeIndices.length) % changeIndices.length;
    const targetRowIdx = changeIndices[currentChangeIndex];

    const prevActive = container.querySelectorAll('.active-change');
    prevActive.forEach((el) => el.classList.remove('active-change'));

    const rows = container.querySelectorAll(`[data-row-index="${targetRowIdx}"]`);
    rows.forEach((row) => row.classList.add('active-change'));
    if (rows[0]) {
      rows[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    updateNav();
  }

  prevBtn.addEventListener('click', () => jumpToChange(-1));
  nextBtn.addEventListener('click', () => jumpToChange(1));

  // Initial render
  render();

  return {
    root,
    setValues(/** @type {string} */ nextOld, /** @type {string} */ nextNew) {
      oldText = nextOld;
      newText = nextNew;
      render();
    },
    exportPatch() {
      return createUnifiedPatch('file.txt', oldText, newText);
    },
  };
}
