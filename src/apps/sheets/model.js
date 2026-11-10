// @ts-check
import { evaluateFormula, extractDependencies, DependencyGraph, ERRORS } from './engine.js';

/**
 * Cell formatting helper.
 * @param {any} val
 * @param {string} [format]
 * @returns {string}
 */
export function formatValue(val, format = 'general') {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'string' && val.startsWith('#')) return val;

  const num = Number(val);
  const isNum = !isNaN(num) && typeof val !== 'boolean';

  switch (format) {
    case 'number':
    case 'number-2':
      return isNum
        ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(val);
    case 'number-0':
      return isNum ? Math.round(num).toLocaleString() : String(val);
    case 'currency':
      return isNum ? num.toLocaleString(undefined, { style: 'currency', currency: 'EUR' }) : String(val);
    case 'currency-usd':
      return isNum ? num.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : String(val);
    case 'percent':
      return isNum ? `${(num * 100).toFixed(1)}%` : String(val);
    case 'date':
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
      if (isNum) {
        // Serial date approximation or timestamp
        const d = new Date(num);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      }
      return String(val);
    default:
      if (isNum && !Number.isInteger(num)) {
        return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
      }
      return String(val);
  }
}

/**
 * Spreadsheet Document Model with multiple sheets, virtual layout,
 * incremental formula recalculation, undo/redo, and CSV/TSV handling.
 */
export class SpreadsheetModel {
  /**
   * @param {object} [data]
   */
  constructor(data = {}) {
    this.title = data.title || 'Untitled Spreadsheet';
    this.sheets = data.sheets || [
      {
        id: 'sheet1',
        name: 'Sheet1',
        rowCount: 1000,
        colCount: 52,
        colWidths: {},
        rowHeights: {},
        frozenRows: 0,
        frozenCols: 0,
        cells: {},
        charts: [],
      },
    ];
    this.activeSheetId = data.activeSheetId || this.sheets[0].id;
    this.graph = new DependencyGraph();

    /** @type {Array<string>} History stack (JSON snapshots) */
    this.undoStack = [];
    /** @type {Array<string>} Redo stack */
    this.redoStack = [];
    this.maxHistory = 100;

    this.rebuildGraphAndCompute();
  }

  /**
   * Retrieves active sheet object.
   */
  getActiveSheet() {
    let s = this.sheets.find((sheet) => sheet.id === this.activeSheetId);
    if (!s) {
      s = this.sheets[0];
      this.activeSheetId = s.id;
    }
    return s;
  }

  /**
   * Gets a sheet by ID or Name.
   * @param {string} idOrName
   */
  getSheet(idOrName) {
    return this.sheets.find((s) => s.id === idOrName || s.name.toLowerCase() === idOrName.toLowerCase());
  }

  /**
   * Pushes current state to undo history.
   */
  pushHistory() {
    this.undoStack.push(JSON.stringify(this.toJSON()));
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  /**
   * Undoes the last action.
   */
  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(JSON.stringify(this.toJSON()));
    const snapshot = JSON.parse(this.undoStack.pop());
    this.loadJSON(snapshot);
    return true;
  }

  /**
   * Redoes the last undone action.
   */
  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(JSON.stringify(this.toJSON()));
    const snapshot = JSON.parse(this.redoStack.pop());
    this.loadJSON(snapshot);
    return true;
  }

  /**
   * Rebuilds all dependencies and computes every formula in the workbook.
   */
  rebuildGraphAndCompute() {
    this.graph = new DependencyGraph();

    // Register all dependencies
    for (const sheet of this.sheets) {
      for (const [key, cell] of Object.entries(sheet.cells)) {
        if (cell.raw && typeof cell.raw === 'string' && cell.raw.startsWith('=')) {
          const [colStr, rowStr] = key.split(':');
          const cellKey = `${sheet.name}:${colStr}:${rowStr}`;
          const deps = extractDependencies(cell.raw, sheet.name).map((d) => `${d.sheet}:${d.col}:${d.row}`);
          this.graph.setDependencies(cellKey, deps);
        }
      }
    }

    // Evaluate all cells
    for (const sheet of this.sheets) {
      for (const key of Object.keys(sheet.cells)) {
        this.evaluateCell(sheet, key, false);
      }
    }
  }

  /**
   * Evaluates a single cell in a sheet.
   * @param {any} sheet
   * @param {string} key "col:row"
   * @param {boolean} [recomputeDependents=true]
   */
  evaluateCell(sheet, key, recomputeDependents = true) {
    const cell = sheet.cells[key];
    if (!cell) return;

    if (!cell.raw || typeof cell.raw !== 'string' || !cell.raw.startsWith('=')) {
      cell.value = cell.raw;
    } else {
      const [colStr, rowStr] = key.split(':');
      const cellKey = `${sheet.name}:${colStr}:${rowStr}`;

      if (this.graph.hasCycle(cellKey)) {
        cell.value = ERRORS.REF;
      } else {
        const ctx = {
          getCellValue: (targetSheet, col, row) => {
            const s = this.getSheet(targetSheet || sheet.name);
            if (!s) return ERRORS.REF;
            const targetCell = s.cells[`${col}:${row}`];
            return targetCell ? targetCell.value : '';
          },
          getRangeValues: (targetSheet, startCol, startRow, endCol, endRow) => {
            const s = this.getSheet(targetSheet || sheet.name);
            if (!s) return [];
            const rows = [];
            for (let r = startRow; r <= endRow; r++) {
              const row = [];
              for (let c = startCol; c <= endCol; c++) {
                const targetCell = s.cells[`${c}:${r}`];
                row.push(targetCell ? targetCell.value : '');
              }
              rows.push(row);
            }
            return rows;
          },
        };

        cell.value = evaluateFormula(cell.raw, ctx, sheet.name);
      }
    }

    if (recomputeDependents) {
      const [colStr, rowStr] = key.split(':');
      const startKey = `${sheet.name}:${colStr}:${rowStr}`;
      const dependents = this.graph.getEvaluationOrder([startKey]);

      for (const depKey of dependents) {
        const [depSheetName, depCol, depRow] = depKey.split(':');
        const depSheet = this.getSheet(depSheetName);
        if (depSheet) {
          this.evaluateCell(depSheet, `${depCol}:${depRow}`, false);
        }
      }
    }
  }

  /**
   * Sets the content and styling of a cell.
   * @param {string} sheetId
   * @param {number} col
   * @param {number} row
   * @param {string} raw
   * @param {object} [style]
   * @param {string} [format]
   */
  setCell(sheetId, col, row, raw, style = undefined, format = undefined) {
    const sheet = this.getSheet(sheetId);
    if (!sheet) return;

    this.pushHistory();

    const key = `${col}:${row}`;
    const cellKey = `${sheet.name}:${col}:${row}`;

    // If empty raw string and no style, delete cell
    if ((raw === '' || raw === null || raw === undefined) && !style && !format) {
      delete sheet.cells[key];
      this.graph.removeCell(cellKey);
      this.evaluateCell(sheet, key, true);
      return;
    }

    if (!sheet.cells[key]) {
      sheet.cells[key] = { raw: '', value: '' };
    }
    const cell = sheet.cells[key];
    cell.raw = raw;
    if (style !== undefined) cell.style = { ...(cell.style || {}), ...style };
    if (format !== undefined) cell.format = format;

    // Update dependency graph
    if (typeof raw === 'string' && raw.startsWith('=')) {
      const deps = extractDependencies(raw, sheet.name).map((d) => `${d.sheet}:${d.col}:${d.row}`);
      this.graph.setDependencies(cellKey, deps);
    } else {
      this.graph.removeCell(cellKey);
    }

    this.evaluateCell(sheet, key, true);
  }

  /**
   * Gets a cell object.
   * @param {string} sheetId
   * @param {number} col
   * @param {number} row
   */
  getCell(sheetId, col, row) {
    const sheet = this.getSheet(sheetId);
    if (!sheet) return null;
    return sheet.cells[`${col}:${row}`] || null;
  }

  /**
   * Gets formatted display string for a cell.
   * @param {string} sheetId
   * @param {number} col
   * @param {number} row
   */
  getDisplayValue(sheetId, col, row) {
    const cell = this.getCell(sheetId, col, row);
    if (!cell) return '';
    return formatValue(cell.value, cell.format);
  }

  /**
   * Adds a new sheet.
   * @param {string} name
   */
  addSheet(name) {
    this.pushHistory();
    const id = 'sheet_' + Math.random().toString(36).slice(2, 8);
    const sheetName = name || `Sheet${this.sheets.length + 1}`;
    const newSheet = {
      id,
      name: sheetName,
      rowCount: 1000,
      colCount: 52,
      colWidths: {},
      rowHeights: {},
      frozenRows: 0,
      frozenCols: 0,
      cells: {},
      charts: [],
    };
    this.sheets.push(newSheet);
    this.activeSheetId = id;
    return newSheet;
  }

  /**
   * Deletes a sheet by ID.
   * @param {string} id
   */
  deleteSheet(id) {
    if (this.sheets.length <= 1) return false;
    this.pushHistory();
    this.sheets = this.sheets.filter((s) => s.id !== id);
    if (this.activeSheetId === id) {
      this.activeSheetId = this.sheets[0].id;
    }
    this.rebuildGraphAndCompute();
    return true;
  }

  /**
   * Renames a sheet.
   * @param {string} id
   * @param {string} newName
   */
  renameSheet(id, newName) {
    const sheet = this.getSheet(id);
    if (!sheet || !newName.trim()) return false;
    this.pushHistory();
    sheet.name = newName.trim();
    this.rebuildGraphAndCompute();
    return true;
  }

  /**
   * Sorts a 2D range by a specific column.
   * @param {string} sheetId
   * @param {number} startCol
   * @param {number} startRow
   * @param {number} endCol
   * @param {number} endRow
   * @param {number} sortCol
   * @param {boolean} [ascending=true]
   */
  sortRange(sheetId, startCol, startRow, endCol, endRow, sortCol, ascending = true) {
    const sheet = this.getSheet(sheetId);
    if (!sheet) return;

    this.pushHistory();

    // Collect rows
    const rowsData = [];
    for (let r = startRow; r <= endRow; r++) {
      const rowCells = [];
      for (let c = startCol; c <= endCol; c++) {
        const cell = sheet.cells[`${c}:${r}`];
        rowCells.push(cell ? { ...cell } : null);
      }
      const sortVal = sheet.cells[`${sortCol}:${r}`]?.value ?? '';
      rowsData.push({ rowCells, sortVal });
    }

    // Sort rows
    rowsData.sort((a, b) => {
      const vA = a.sortVal;
      const vB = b.sortVal;
      const numA = Number(vA);
      const numB = Number(vB);
      let cmp;
      if (!isNaN(numA) && !isNaN(numB) && vA !== '' && vB !== '') {
        cmp = numA - numB;
      } else {
        cmp = String(vA).localeCompare(String(vB));
      }
      return ascending ? cmp : -cmp;
    });

    // Write back rows
    for (let i = 0; i < rowsData.length; i++) {
      const targetRow = startRow + i;
      for (let c = 0; c < rowsData[i].rowCells.length; c++) {
        const targetCol = startCol + c;
        const key = `${targetCol}:${targetRow}`;
        const source = rowsData[i].rowCells[c];
        if (source) {
          sheet.cells[key] = source;
        } else {
          delete sheet.cells[key];
        }
      }
    }

    this.rebuildGraphAndCompute();
  }

  /**
   * Exports a range as TSV (Tab Separated Values) for clipboard copy.
   * @param {string} sheetId
   * @param {number} startCol
   * @param {number} startRow
   * @param {number} endCol
   * @param {number} endRow
   * @returns {string}
   */
  exportTSV(sheetId, startCol, startRow, endCol, endRow) {
    const sheet = this.getSheet(sheetId);
    if (!sheet) return '';
    const lines = [];

    for (let r = startRow; r <= endRow; r++) {
      const line = [];
      for (let c = startCol; c <= endCol; c++) {
        const cell = sheet.cells[`${c}:${r}`];
        line.push(cell ? formatValue(cell.value, cell.format) : '');
      }
      lines.push(line.join('\t'));
    }
    return lines.join('\n');
  }

  /**
   * Imports TSV string starting at targetCol, targetRow.
   * @param {string} sheetId
   * @param {number} targetCol
   * @param {number} targetRow
   * @param {string} tsv
   */
  importTSV(sheetId, targetCol, targetRow, tsv) {
    const sheet = this.getSheet(sheetId);
    if (!sheet || !tsv) return;

    this.pushHistory();

    const lines = tsv.split(/\r?\n/);
    for (let r = 0; r < lines.length; r++) {
      if (!lines[r] && r === lines.length - 1) continue;
      const cells = lines[r].split('\t');
      for (let c = 0; c < cells.length; c++) {
        const col = targetCol + c;
        const row = targetRow + r;
        const raw = cells[c];
        const key = `${col}:${row}`;
        if (!sheet.cells[key]) sheet.cells[key] = { raw: '', value: '' };
        sheet.cells[key].raw = raw;
      }
    }

    this.rebuildGraphAndCompute();
  }

  /**
   * Exports entire sheet to CSV.
   * @param {string} sheetId
   * @returns {string}
   */
  exportCSV(sheetId) {
    const sheet = this.getSheet(sheetId);
    if (!sheet) return '';

    // Find bounding box
    let maxCol = 0;
    let maxRow = 0;
    for (const key of Object.keys(sheet.cells)) {
      const [c, r] = key.split(':').map(Number);
      if (c > maxCol) maxCol = c;
      if (r > maxRow) maxRow = r;
    }

    const rows = [];
    for (let r = 0; r <= maxRow; r++) {
      const row = [];
      for (let c = 0; c <= maxCol; c++) {
        const cell = sheet.cells[`${c}:${r}`];
        let val = cell ? formatValue(cell.value, cell.format) : '';
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        row.push(val);
      }
      rows.push(row.join(','));
    }
    return rows.join('\n');
  }

  /**
   * Imports CSV text into a sheet.
   * @param {string} sheetId
   * @param {string} csvText
   */
  importCSV(sheetId, csvText) {
    const sheet = this.getSheet(sheetId);
    if (!sheet) return;

    this.pushHistory();
    sheet.cells = {};

    // Simple CSV parser supporting quotes
    const rows = [];
    let curRow = [];
    let curField = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const c = csvText[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 < csvText.length && csvText[i + 1] === '"') {
            curField += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          curField += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          curRow.push(curField);
          curField = '';
        } else if (c === '\n' || c === '\r') {
          if (c === '\r' && i + 1 < csvText.length && csvText[i + 1] === '\n') {
            i++;
          }
          curRow.push(curField);
          rows.push(curRow);
          curRow = [];
          curField = '';
        } else {
          curField += c;
        }
      }
    }
    if (curField || curRow.length > 0) {
      curRow.push(curField);
      rows.push(curRow);
    }

    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const raw = rows[r][c];
        if (raw !== '') {
          sheet.cells[`${c}:${r}`] = { raw, value: raw };
        }
      }
    }

    this.rebuildGraphAndCompute();
  }

  /**
   * Adds an embedded chart to a sheet.
   * @param {string} sheetId
   * @param {{ type: 'bar'|'line'|'pie'|'scatter', title: string, range: string, col: number, row: number }} chart
   */
  addChart(sheetId, chart) {
    const sheet = this.getSheet(sheetId);
    if (!sheet) return;
    this.pushHistory();
    const id = 'chart_' + Math.random().toString(36).slice(2, 8);
    sheet.charts.push({
      id,
      type: chart.type || 'bar',
      title: chart.title || 'Chart',
      range: chart.range || 'A1:B5',
      col: chart.col ?? 4,
      row: chart.row ?? 1,
      width: 420,
      height: 260,
    });
  }

  /**
   * Removes an embedded chart.
   * @param {string} sheetId
   * @param {string} chartId
   */
  removeChart(sheetId, chartId) {
    const sheet = this.getSheet(sheetId);
    if (!sheet) return;
    this.pushHistory();
    sheet.charts = sheet.charts.filter((c) => c.id !== chartId);
  }

  /**
   * Serializes model to JSON.
   */
  toJSON() {
    return {
      title: this.title,
      activeSheetId: this.activeSheetId,
      sheets: this.sheets,
    };
  }

  /**
   * Loads state from a JSON object.
   * @param {any} data
   */
  loadJSON(data) {
    if (!data) return;
    this.title = data.title || 'Untitled Spreadsheet';
    this.sheets = data.sheets || [];
    this.activeSheetId = data.activeSheetId || (this.sheets[0] ? this.sheets[0].id : 'sheet1');
    this.rebuildGraphAndCompute();
  }
}
