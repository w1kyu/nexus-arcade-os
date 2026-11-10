// @ts-check
import { h, icon } from '../../ui/dom.js';
import { colToLetters, shiftFormula, parseRangeAddress, formatCellAddress } from './engine.js';
import { SpreadsheetModel, formatValue } from './model.js';
import './styles.css';

const DEFAULT_ROW_HEIGHT = 24;
const DEFAULT_COL_WIDTH = 80;
const HEADER_WIDTH = 44;
const HEADER_HEIGHT = 24;

/**
 * Named mount function required by kernel registry.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {any} [args]
 */
export async function mount(container, ctx, args = {}) {
  const t = (key, fallback = '') => ctx.i18n.t(key) || fallback;

  let model = new SpreadsheetModel();
  let currentFilePath = args?.path || null;

  // Load from file if path provided
  if (currentFilePath && ctx.fs) {
    try {
      const content = await ctx.fs.readFile(currentFilePath);
      if (typeof content === 'string') {
        if (currentFilePath.endsWith('.csv')) {
          model.importCSV(model.activeSheetId, content);
        } else {
          model.loadJSON(JSON.parse(content));
        }
      }
    } catch (e) {
      console.warn('Failed to load sheets file:', e);
    }
  }

  // Active UI state
  let activeCol = 0;
  let activeRow = 0;
  let selectStartCol = 0;
  let selectStartRow = 0;
  let isEditing = false;
  let inlineInputEl = null;

  // Virtual scrolling state
  let scrollTop = 0;
  let scrollLeft = 0;
  let viewportWidth = 800;
  let viewportHeight = 600;

  // Build UI
  const root = h('div', { class: 'nx-sheets', 'data-testid': 'sheets-app' });

  // 1. Toolbar
  const formatSelect = h(
    'select',
    {
      class: 'nx-sheets-select',
      onchange: (e) => applyFormat(/** @type {HTMLSelectElement} */ (e.target).value),
    },
    h('option', { value: 'general' }, t('toolbar.formatGeneral', 'General')),
    h('option', { value: 'number' }, t('toolbar.formatNumber', 'Number (1,234.56)')),
    h('option', { value: 'currency' }, t('toolbar.formatCurrency', 'Currency (€)')),
    h('option', { value: 'currency-usd' }, t('toolbar.formatCurrencyUsd', 'Currency ($)')),
    h('option', { value: 'percent' }, t('toolbar.formatPercent', 'Percent (%)')),
    h('option', { value: 'date' }, t('toolbar.formatDate', 'Date (YYYY-MM-DD)')),
  );

  const toolbar = h(
    'div',
    { class: 'nx-sheets-toolbar' },
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.undo', 'Undo'),
        onclick: () => {
          model.undo();
          renderGrid();
        },
      },
      icon('undo'),
    ),
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.redo', 'Redo'),
        onclick: () => {
          model.redo();
          renderGrid();
        },
      },
      icon('redo'),
    ),
    h('div', { class: 'nx-sheets-separator' }),
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.bold', 'Bold'),
        onclick: () => toggleStyle('bold'),
      },
      h('strong', {}, 'B'),
    ),
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.italic', 'Italic'),
        onclick: () => toggleStyle('italic'),
      },
      h('em', {}, 'I'),
    ),
    h('div', { class: 'nx-sheets-separator' }),
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.alignLeft', 'Align Left'),
        onclick: () => setAlign('left'),
      },
      icon('view-list'),
    ),
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.alignCenter', 'Align Center'),
        onclick: () => setAlign('center'),
      },
      icon('menu'),
    ),
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.alignRight', 'Align Right'),
        onclick: () => setAlign('right'),
      },
      icon('view-details'),
    ),
    h('div', { class: 'nx-sheets-separator' }),
    formatSelect,
    h('div', { class: 'nx-sheets-separator' }),
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.sortAsc', 'Sort Ascending'),
        onclick: () => sortSelection(true),
      },
      icon('sort'),
      ' ▲',
    ),
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.sortDesc', 'Sort Descending'),
        onclick: () => sortSelection(false),
      },
      icon('sort'),
      ' ▼',
    ),
    h('div', { class: 'nx-sheets-separator' }),
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.addChart', 'Insert Chart'),
        onclick: showAddChartDialog,
      },
      icon('activity'),
      ' Chart',
    ),
    h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('toolbar.exportCsv', 'Export CSV'),
        onclick: exportCsvFile,
      },
      icon('download'),
      ' CSV',
    ),
  );

  // 2. Formula Bar
  const cellAddrDisplay = h('div', { class: 'nx-sheets-cell-addr' }, 'A1');
  const formulaInput = h('input', {
    class: 'nx-sheets-formula-input',
    placeholder: t('formula.placeholder', 'Enter value or formula (e.g. =SUM(A1:B10))'),
    onkeydown: (e) => {
      if (e.key === 'Enter') {
        commitFormula(formulaInput.value);
        viewport.focus();
      } else if (e.key === 'Escape') {
        updateFormulaBar();
        viewport.focus();
      }
    },
    onblur: () => {
      commitFormula(formulaInput.value);
    },
  });

  const formulaBar = h(
    'div',
    { class: 'nx-sheets-formula-bar' },
    cellAddrDisplay,
    h('span', { class: 'nx-sheets-fx' }, 'fx'),
    formulaInput,
  );

  // 3. Viewport & Grid
  const viewport = h('div', {
    class: 'nx-sheets-viewport',
    tabIndex: 0,
    onscroll: () => {
      scrollTop = viewport.scrollTop;
      scrollLeft = viewport.scrollLeft;
      renderGrid();
    },
    onkeydown: handleKeyDown,
  });

  const grid = h('div', { class: 'nx-sheets-grid' });
  viewport.appendChild(grid);

  // 4. Tabs Bar
  const tabsBar = h('div', { class: 'nx-sheets-tabs-bar' });

  root.appendChild(toolbar);
  root.appendChild(formulaBar);
  root.appendChild(viewport);
  root.appendChild(tabsBar);
  container.appendChild(root);

  // Measure initial size
  requestAnimationFrame(() => {
    viewportWidth = viewport.clientWidth || 800;
    viewportHeight = viewport.clientHeight || 600;
    renderTabs();
    renderGrid();
    updateFormulaBar();
  });

  window.addEventListener('resize', onResize);

  function onResize() {
    viewportWidth = viewport.clientWidth || 800;
    viewportHeight = viewport.clientHeight || 600;
    renderGrid();
  }

  function getColWidth(sheet, col) {
    return sheet.colWidths?.[col] || DEFAULT_COL_WIDTH;
  }

  function getRowHeight(sheet, row) {
    return sheet.rowHeights?.[row] || DEFAULT_ROW_HEIGHT;
  }

  function getColOffset(sheet, targetCol) {
    let offset = HEADER_WIDTH;
    for (let c = 0; c < targetCol; c++) {
      offset += getColWidth(sheet, c);
    }
    return offset;
  }

  function getRowOffset(sheet, targetRow) {
    let offset = HEADER_HEIGHT;
    for (let r = 0; r < targetRow; r++) {
      offset += getRowHeight(sheet, r);
    }
    return offset;
  }

  function renderTabs() {
    tabsBar.innerHTML = '';
    for (const sheet of model.sheets) {
      const tab = h(
        'button',
        {
          class: `nx-sheets-tab ${sheet.id === model.activeSheetId ? 'is-active' : ''}`,
          onclick: () => {
            model.activeSheetId = sheet.id;
            renderTabs();
            renderGrid();
            updateFormulaBar();
          },
        },
        sheet.name,
      );
      tabsBar.appendChild(tab);
    }

    const addBtn = h(
      'button',
      {
        class: 'nx-sheets-btn',
        title: t('sheet.add', 'Add Sheet'),
        onclick: () => {
          model.addSheet();
          renderTabs();
          renderGrid();
          updateFormulaBar();
        },
      },
      icon('plus'),
    );
    tabsBar.appendChild(addBtn);
  }

  function renderGrid() {
    grid.innerHTML = '';
    const sheet = model.getActiveSheet();

    const totalWidth = getColOffset(sheet, sheet.colCount);
    const totalHeight = getRowOffset(sheet, sheet.rowCount);

    grid.style.width = `${totalWidth}px`;
    grid.style.height = `${totalHeight}px`;

    // Calculate visible window
    let startCol = 0;
    let endCol = sheet.colCount - 1;
    let currentX = HEADER_WIDTH;
    for (let c = 0; c < sheet.colCount; c++) {
      const w = getColWidth(sheet, c);
      if (currentX + w < scrollLeft) {
        startCol = c + 1;
      }
      if (currentX > scrollLeft + viewportWidth) {
        endCol = c;
        break;
      }
      currentX += w;
    }

    let startRow = 0;
    let endRow = sheet.rowCount - 1;
    let currentY = HEADER_HEIGHT;
    for (let r = 0; r < sheet.rowCount; r++) {
      const h_row = getRowHeight(sheet, r);
      if (currentY + h_row < scrollTop) {
        startRow = r + 1;
      }
      if (currentY > scrollTop + viewportHeight) {
        endRow = r;
        break;
      }
      currentY += h_row;
    }

    // Add extra padding rows/cols for smooth scrolling
    startCol = Math.max(0, startCol - 2);
    endCol = Math.min(sheet.colCount - 1, endCol + 3);
    startRow = Math.max(0, startRow - 3);
    endRow = Math.min(sheet.rowCount - 1, endRow + 5);

    // 1. Corner Header
    const corner = h('div', { class: 'nx-sheets-corner' });
    grid.appendChild(corner);

    // 2. Column Headers
    for (let c = startCol; c <= endCol; c++) {
      const colX = getColOffset(sheet, c);
      const colW = getColWidth(sheet, c);
      const header = h(
        'div',
        {
          class: 'nx-sheets-col-header',
          style: `left: ${colX}px; width: ${colW}px;`,
        },
        colToLetters(c),
      );
      grid.appendChild(header);
    }

    // 3. Row Headers
    for (let r = startRow; r <= endRow; r++) {
      const rowY = getRowOffset(sheet, r);
      const rowH = getRowHeight(sheet, r);
      const header = h(
        'div',
        {
          class: 'nx-sheets-row-header',
          style: `top: ${rowY}px; height: ${rowH}px;`,
        },
        String(r + 1),
      );
      grid.appendChild(header);
    }

    // Selection Bounds
    const minCol = Math.min(activeCol, selectStartCol);
    const maxCol = Math.max(activeCol, selectStartCol);
    const minRow = Math.min(activeRow, selectStartRow);
    const maxRow = Math.max(activeRow, selectStartRow);

    // 4. Cells
    for (let r = startRow; r <= endRow; r++) {
      const rowY = getRowOffset(sheet, r);
      const rowH = getRowHeight(sheet, r);

      for (let c = startCol; c <= endCol; c++) {
        const colX = getColOffset(sheet, c);
        const colW = getColWidth(sheet, c);

        const isAct = c === activeCol && r === activeRow;
        const isSel = c >= minCol && c <= maxCol && r >= minRow && r <= maxRow;

        const cell = sheet.cells[`${c}:${r}`];
        const displayVal = cell ? formatValue(cell.value, cell.format) : '';

        let cellStyle = `left: ${colX}px; top: ${rowY}px; width: ${colW}px; height: ${rowH}px;`;
        if (cell?.style?.bold) cellStyle += ' font-weight: bold;';
        if (cell?.style?.italic) cellStyle += ' font-style: italic;';
        if (cell?.style?.color) cellStyle += ` color: ${cell.style.color};`;
        if (cell?.style?.bgColor) cellStyle += ` background-color: ${cell.style.bgColor};`;
        if (cell?.style?.align) cellStyle += ` text-align: ${cell.style.align};`;

        const cellEl = h(
          'div',
          {
            class: `nx-sheets-cell ${isAct ? 'is-active' : ''} ${isSel ? 'is-selected' : ''}`,
            style: cellStyle,
            onmousedown: (e) => onCellMouseDown(c, r, e),
            ondblclick: () => startInlineEdit(c, r),
          },
          displayVal,
        );

        // Fill handle on active or max selection cell
        if (isAct && c === maxCol && r === maxRow) {
          const fillHandle = h('div', {
            class: 'nx-sheets-fill-handle',
            onmousedown: onFillHandleMouseDown,
          });
          cellEl.appendChild(fillHandle);
        }

        grid.appendChild(cellEl);
      }
    }

    // 5. Render Charts
    renderCharts(sheet);
  }

  function renderCharts(sheet) {
    if (!sheet.charts || sheet.charts.length === 0) return;

    for (const chart of sheet.charts) {
      const chartX = getColOffset(sheet, chart.col);
      const chartY = getRowOffset(sheet, chart.row);

      const overlay = h(
        'div',
        {
          class: 'nx-sheets-chart-overlay',
          style: `left: ${chartX}px; top: ${chartY}px; width: ${chart.width}px; height: ${chart.height}px;`,
        },
        h(
          'div',
          { class: 'nx-sheets-chart-header' },
          h('span', {}, chart.title),
          h(
            'button',
            {
              class: 'nx-sheets-btn',
              onclick: () => {
                model.removeChart(sheet.id, chart.id);
                renderGrid();
              },
            },
            icon('close'),
          ),
        ),
      );

      const canvas = /** @type {HTMLCanvasElement} */ (
        h('canvas', {
          class: 'nx-sheets-chart-canvas',
          width: chart.width - 16,
          height: chart.height - 40,
        })
      );
      overlay.appendChild(canvas);
      grid.appendChild(overlay);

      drawChartCanvas(canvas, chart, sheet);
    }
  }

  function drawChartCanvas(canvas, chart, sheet) {
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const range = parseRangeAddress(chart.range);
    if (!range) return;

    // Collect data points from range
    const labels = [];
    const values = [];

    for (let r = range.startRow; r <= range.endRow; r++) {
      const labelCell = sheet.cells[`${range.startCol}:${r}`];
      const valCell = sheet.cells[`${range.startCol + 1}:${r}`];
      labels.push(labelCell ? String(labelCell.value) : `R${r + 1}`);
      values.push(valCell ? Number(valCell.value) || 0 : 0);
    }

    const w = canvas.width;
    const h_can = canvas.height;
    ctx2d.clearRect(0, 0, w, h_can);

    if (values.length === 0) return;

    const maxVal = Math.max(...values, 1);
    const pad = 30;

    if (chart.type === 'pie') {
      const total = values.reduce((a, b) => a + Math.max(0, b), 0) || 1;
      let startAngle = 0;
      const cx = w / 2;
      const cy = h_can / 2;
      const radius = Math.min(cx, cy) - 20;
      const colors = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#34d399', '#fbbf24'];

      for (let i = 0; i < values.length; i++) {
        const slice = (Math.max(0, values[i]) / total) * 2 * Math.PI;
        ctx2d.beginPath();
        ctx2d.moveTo(cx, cy);
        ctx2d.arc(cx, cy, radius, startAngle, startAngle + slice);
        ctx2d.fillStyle = colors[i % colors.length];
        ctx2d.fill();
        startAngle += slice;
      }
    } else if (chart.type === 'line') {
      ctx2d.strokeStyle = '#38bdf8';
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();

      const step = (w - pad * 2) / Math.max(values.length - 1, 1);
      for (let i = 0; i < values.length; i++) {
        const x = pad + i * step;
        const y = h_can - pad - (values[i] / maxVal) * (h_can - pad * 2);
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
      }
      ctx2d.stroke();

      // Draw points
      ctx2d.fillStyle = '#818cf8';
      for (let i = 0; i < values.length; i++) {
        const x = pad + i * step;
        const y = h_can - pad - (values[i] / maxVal) * (h_can - pad * 2);
        ctx2d.beginPath();
        ctx2d.arc(x, y, 4, 0, Math.PI * 2);
        ctx2d.fill();
      }
    } else {
      // Bar chart default
      const barWidth = (w - pad * 2) / values.length - 8;
      ctx2d.fillStyle = '#38bdf8';

      for (let i = 0; i < values.length; i++) {
        const x = pad + i * (barWidth + 8);
        const barHeight = (values[i] / maxVal) * (h_can - pad * 2);
        const y = h_can - pad - barHeight;
        ctx2d.fillRect(x, y, barWidth, barHeight);

        ctx2d.fillStyle = '#94a3b8';
        ctx2d.font = '10px monospace';
        ctx2d.fillText(labels[i].slice(0, 5), x, h_can - 10);
        ctx2d.fillStyle = '#38bdf8';
      }
    }
  }

  function onCellMouseDown(col, row, e) {
    if (isEditing) commitInlineEdit();

    activeCol = col;
    activeRow = row;

    if (e.shiftKey) {
      // Expand selection
    } else {
      selectStartCol = col;
      selectStartRow = row;
    }

    updateFormulaBar();
    renderGrid();

    const onMove = (ev) => {
      // Find hovered cell coordinate
      const rect = viewport.getBoundingClientRect();
      const x = ev.clientX - rect.left + viewport.scrollLeft;
      const y = ev.clientY - rect.top + viewport.scrollTop;

      const sheet = model.getActiveSheet();
      let c = 0;
      let curX = HEADER_WIDTH;
      while (c < sheet.colCount && curX + getColWidth(sheet, c) < x) {
        curX += getColWidth(sheet, c);
        c++;
      }

      let r = 0;
      let curY = HEADER_HEIGHT;
      while (r < sheet.rowCount && curY + getRowHeight(sheet, r) < y) {
        curY += getRowHeight(sheet, r);
        r++;
      }

      activeCol = Math.min(c, sheet.colCount - 1);
      activeRow = Math.min(r, sheet.rowCount - 1);
      updateFormulaBar();
      renderGrid();
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onFillHandleMouseDown(e) {
    e.stopPropagation();
    const sheet = model.getActiveSheet();

    const minCol = Math.min(activeCol, selectStartCol);
    const maxCol = Math.max(activeCol, selectStartCol);
    const minRow = Math.min(activeRow, selectStartRow);
    const maxRow = Math.max(activeRow, selectStartRow);

    const onMove = () => {};

    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      const rect = viewport.getBoundingClientRect();
      const y = ev.clientY - rect.top + viewport.scrollTop;

      let r = 0;
      let curY = HEADER_HEIGHT;
      while (r < sheet.rowCount && curY + getRowHeight(sheet, r) < y) {
        curY += getRowHeight(sheet, r);
        r++;
      }

      const targetRow = Math.min(r, sheet.rowCount - 1);
      if (targetRow > maxRow) {
        // Dragged down: replicate rows
        const height = maxRow - minRow + 1;
        for (let rTarget = maxRow + 1; rTarget <= targetRow; rTarget++) {
          const deltaRow = rTarget - maxRow;
          const sourceRow = minRow + ((rTarget - maxRow - 1) % height);

          for (let c = minCol; c <= maxCol; c++) {
            const sourceCell = sheet.cells[`${c}:${sourceRow}`];
            if (sourceCell) {
              const shiftedRaw = shiftFormula(sourceCell.raw, 0, deltaRow);
              model.setCell(sheet.id, c, rTarget, shiftedRaw, sourceCell.style, sourceCell.format);
            }
          }
        }
        activeRow = targetRow;
        renderGrid();
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startInlineEdit(col, row) {
    if (isEditing) commitInlineEdit();
    isEditing = true;

    const sheet = model.getActiveSheet();
    const cell = sheet.cells[`${col}:${row}`];
    const initialRaw = cell ? cell.raw : '';

    const colX = getColOffset(sheet, col);
    const rowY = getRowOffset(sheet, row);
    const colW = getColWidth(sheet, col);
    const rowH = getRowHeight(sheet, row);

    inlineInputEl = h('input', {
      class: 'nx-sheets-inline-input',
      style: `left: ${colX}px; top: ${rowY}px; width: ${colW}px; height: ${rowH}px;`,
      value: initialRaw,
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          commitInlineEdit();
          activeRow = Math.min(activeRow + 1, sheet.rowCount - 1);
          selectStartRow = activeRow;
          renderGrid();
          updateFormulaBar();
        } else if (e.key === 'Escape') {
          cancelInlineEdit();
        }
      },
      onblur: () => commitInlineEdit(),
    });

    grid.appendChild(inlineInputEl);
    inlineInputEl.focus();
  }

  function commitInlineEdit() {
    if (!isEditing || !inlineInputEl) return;
    const sheet = model.getActiveSheet();
    model.setCell(sheet.id, activeCol, activeRow, inlineInputEl.value);
    inlineInputEl.remove();
    inlineInputEl = null;
    isEditing = false;
    renderGrid();
    updateFormulaBar();
  }

  function cancelInlineEdit() {
    if (inlineInputEl) inlineInputEl.remove();
    inlineInputEl = null;
    isEditing = false;
    renderGrid();
  }

  function updateFormulaBar() {
    cellAddrDisplay.textContent = formatCellAddress(activeCol, activeRow);
    const sheet = model.getActiveSheet();
    const cell = sheet.cells[`${activeCol}:${activeRow}`];
    formulaInput.value = cell ? cell.raw : '';
  }

  function commitFormula(val) {
    const sheet = model.getActiveSheet();
    model.setCell(sheet.id, activeCol, activeRow, val);
    renderGrid();
  }

  function toggleStyle(key) {
    const sheet = model.getActiveSheet();
    const cell = sheet.cells[`${activeCol}:${activeRow}`];
    const current = cell?.style?.[key] || false;
    model.setCell(sheet.id, activeCol, activeRow, cell ? cell.raw : '', { [key]: !current });
    renderGrid();
  }

  function setAlign(align) {
    const sheet = model.getActiveSheet();
    const cell = sheet.cells[`${activeCol}:${activeRow}`];
    model.setCell(sheet.id, activeCol, activeRow, cell ? cell.raw : '', { align });
    renderGrid();
  }

  function applyFormat(format) {
    const sheet = model.getActiveSheet();
    const minCol = Math.min(activeCol, selectStartCol);
    const maxCol = Math.max(activeCol, selectStartCol);
    const minRow = Math.min(activeRow, selectStartRow);
    const maxRow = Math.max(activeRow, selectStartRow);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = sheet.cells[`${c}:${r}`];
        model.setCell(sheet.id, c, r, cell ? cell.raw : '', undefined, format);
      }
    }
    renderGrid();
  }

  function sortSelection(ascending) {
    const sheet = model.getActiveSheet();
    const minCol = Math.min(activeCol, selectStartCol);
    const maxCol = Math.max(activeCol, selectStartCol);
    const minRow = Math.min(activeRow, selectStartRow);
    const maxRow = Math.max(activeRow, selectStartRow);

    model.sortRange(sheet.id, minCol, minRow, maxCol, maxRow, minCol, ascending);
    renderGrid();
  }

  function handleKeyDown(e) {
    if (isEditing) return;
    const sheet = model.getActiveSheet();

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeRow = Math.max(0, activeRow - 1);
      if (!e.shiftKey) selectStartRow = activeRow;
      renderGrid();
      updateFormulaBar();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeRow = Math.min(sheet.rowCount - 1, activeRow + 1);
      if (!e.shiftKey) selectStartRow = activeRow;
      renderGrid();
      updateFormulaBar();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      activeCol = Math.max(0, activeCol - 1);
      if (!e.shiftKey) selectStartCol = activeCol;
      renderGrid();
      updateFormulaBar();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      activeCol = Math.min(sheet.colCount - 1, activeCol + 1);
      if (!e.shiftKey) selectStartCol = activeCol;
      renderGrid();
      updateFormulaBar();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const minCol = Math.min(activeCol, selectStartCol);
      const maxCol = Math.max(activeCol, selectStartCol);
      const minRow = Math.min(activeRow, selectStartRow);
      const maxRow = Math.max(activeRow, selectStartRow);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          model.setCell(sheet.id, c, r, '');
        }
      }
      renderGrid();
      updateFormulaBar();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      startInlineEdit(activeCol, activeRow);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      const minCol = Math.min(activeCol, selectStartCol);
      const maxCol = Math.max(activeCol, selectStartCol);
      const minRow = Math.min(activeRow, selectStartRow);
      const maxRow = Math.max(activeRow, selectStartRow);
      const tsv = model.exportTSV(sheet.id, minCol, minRow, maxCol, maxRow);
      if (ctx.clipboard) ctx.clipboard.write(tsv);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      if (ctx.clipboard) {
        ctx.clipboard.read().then((text) => {
          if (text) {
            model.importTSV(sheet.id, activeCol, activeRow, text);
            renderGrid();
            updateFormulaBar();
          }
        });
      }
    }
  }

  function showAddChartDialog() {
    const sheet = model.getActiveSheet();
    const minCol = Math.min(activeCol, selectStartCol);
    const maxCol = Math.max(activeCol, selectStartCol);
    const minRow = Math.min(activeRow, selectStartRow);
    const maxRow = Math.max(activeRow, selectStartRow);

    const rangeStr = `${formatCellAddress(minCol, minRow)}:${formatCellAddress(maxCol, maxRow)}`;

    model.addChart(sheet.id, {
      type: 'bar',
      title: 'Sales Overview',
      range: rangeStr,
      col: maxCol + 2,
      row: minRow,
    });
    renderGrid();
  }

  function exportCsvFile() {
    const sheet = model.getActiveSheet();
    const csv = model.exportCSV(sheet.id);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheet.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    unmount() {
      window.removeEventListener('resize', onResize);
      root.remove();
    },
    onSuspend() {},
    onResume() {},
    onIntent(intent) {
      if (intent?.action === 'open' && intent?.data) {
        // Open file passed via intent
        try {
          if (typeof intent.data === 'string') {
            model.loadJSON(JSON.parse(intent.data));
            renderTabs();
            renderGrid();
          }
        } catch (e) {
          console.warn('Failed to parse intent file:', e);
        }
      }
    },
  };
}
