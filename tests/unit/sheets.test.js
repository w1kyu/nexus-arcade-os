import { describe, it, expect } from 'vitest';
import {
  colToLetters,
  lettersToCol,
  parseCellAddress,
  formatCellAddress,
  parseRangeAddress,
  shiftFormula,
  evaluateFormula,
  DependencyGraph,
  ERRORS,
} from '../../src/apps/sheets/engine.js';
import { SpreadsheetModel } from '../../src/apps/sheets/model.js';

describe('Nexus Sheets Formula Engine', () => {
  describe('Coordinate conversions', () => {
    it('converts column index to letters and back', () => {
      expect(colToLetters(0)).toBe('A');
      expect(colToLetters(25)).toBe('Z');
      expect(colToLetters(26)).toBe('AA');
      expect(colToLetters(27)).toBe('AB');
      expect(colToLetters(701)).toBe('ZZ');
      expect(colToLetters(702)).toBe('AAA');

      expect(lettersToCol('A')).toBe(0);
      expect(lettersToCol('Z')).toBe(25);
      expect(lettersToCol('AA')).toBe(26);
      expect(lettersToCol('AB')).toBe(27);
      expect(lettersToCol('ZZ')).toBe(701);
      expect(lettersToCol('AAA')).toBe(702);
    });

    it('parses and formats cell addresses', () => {
      expect(parseCellAddress('A1')).toEqual({
        sheet: undefined,
        col: 0,
        row: 0,
        colFixed: false,
        rowFixed: false,
      });

      expect(parseCellAddress('$B$4')).toEqual({
        sheet: undefined,
        col: 1,
        row: 3,
        colFixed: true,
        rowFixed: true,
      });

      expect(parseCellAddress('Sheet2!$C5')).toEqual({
        sheet: 'Sheet2',
        col: 2,
        row: 4,
        colFixed: true,
        rowFixed: false,
      });

      expect(parseCellAddress("'Sales 2026'!D$10")).toEqual({
        sheet: 'Sales 2026',
        col: 3,
        row: 9,
        colFixed: false,
        rowFixed: true,
      });

      expect(formatCellAddress(0, 0)).toBe('A1');
      expect(formatCellAddress(1, 3, true, true)).toBe('$B$4');
      expect(formatCellAddress(2, 4, true, false, 'Sheet2')).toBe('Sheet2!$C5');
      expect(formatCellAddress(3, 9, false, true, 'Sales 2026')).toBe("'Sales 2026'!D$10");
    });

    it('parses range addresses', () => {
      expect(parseRangeAddress('A1:B5')).toEqual({
        sheet: undefined,
        startCol: 0,
        startRow: 0,
        endCol: 1,
        endRow: 4,
      });

      expect(parseRangeAddress('Sheet1!B2:D10')).toEqual({
        sheet: 'Sheet1',
        startCol: 1,
        startRow: 1,
        endCol: 3,
        endRow: 9,
      });
    });
  });

  describe('Relative formula shifting', () => {
    it('shifts relative cell references and preserves fixed ones', () => {
      expect(shiftFormula('=A1 + B1', 0, 1)).toBe('=A2 + B2');
      expect(shiftFormula('=A1 + B1', 1, 0)).toBe('=B1 + C1');
      expect(shiftFormula('=$A$1 + B1', 1, 1)).toBe('=$A$1 + C2');
      expect(shiftFormula('=SUM(A$1:A$10)', 2, 5)).toBe('=SUM(C$1:C$10)');
    });
  });

  describe('Formula Evaluation', () => {
    const mockData = {
      Sheet1: {
        '0:0': 10, // A1
        '1:0': 20, // B1
        '2:0': 30, // C1
        '0:1': 5, // A2
        '1:1': 15, // B2
        '2:1': 25, // C2
        '0:2': 'apple', // A3
        '1:2': 'banana', // B3
        '2:2': 'apple', // C3
      },
    };

    const ctx = {
      getCellValue: (sheet, col, row) => {
        const s = sheet || 'Sheet1';
        return mockData[s]?.[`${col}:${row}`] ?? '';
      },
      getRangeValues: (sheet, startCol, startRow, endCol, endRow) => {
        const s = sheet || 'Sheet1';
        const rows = [];
        for (let r = startRow; r <= endRow; r++) {
          const row = [];
          for (let c = startCol; c <= endCol; c++) {
            row.push(mockData[s]?.[`${c}:${r}`] ?? '');
          }
          rows.push(row);
        }
        return rows;
      },
    };

    it('evaluates basic math and operators', () => {
      expect(evaluateFormula('=1 + 2 * 3', ctx)).toBe(7);
      expect(evaluateFormula('=(1 + 2) * 3', ctx)).toBe(9);
      expect(evaluateFormula('=2 ^ 3', ctx)).toBe(8);
      expect(evaluateFormula('=10 / 2', ctx)).toBe(5);
      expect(evaluateFormula('=10 / 0', ctx)).toBe(ERRORS.DIV0);
      expect(evaluateFormula('="Hello " & "World"', ctx)).toBe('Hello World');
    });

    it('evaluates cell references', () => {
      expect(evaluateFormula('=A1 + B1', ctx)).toBe(30);
      expect(evaluateFormula('=A1 * A2', ctx)).toBe(50);
      expect(evaluateFormula('=A1 > A2', ctx)).toBe(true);
      expect(evaluateFormula('=A1 = B1', ctx)).toBe(false);
    });

    it('evaluates Math functions: SUM, AVERAGE, MIN, MAX, ROUND, ABS, SQRT, POWER, MOD, STDEV, MEDIAN', () => {
      expect(evaluateFormula('=SUM(A1:C1)', ctx)).toBe(60);
      expect(evaluateFormula('=AVERAGE(A1:C1)', ctx)).toBe(20);
      expect(evaluateFormula('=MIN(A1:C2)', ctx)).toBe(5);
      expect(evaluateFormula('=MAX(A1:C2)', ctx)).toBe(30);
      expect(evaluateFormula('=ROUND(3.14159, 2)', ctx)).toBe(3.14);
      expect(evaluateFormula('=ABS(-42)', ctx)).toBe(42);
      expect(evaluateFormula('=SQRT(144)', ctx)).toBe(12);
      expect(evaluateFormula('=POWER(2, 8)', ctx)).toBe(256);
      expect(evaluateFormula('=MOD(10, 3)', ctx)).toBe(1);
      expect(evaluateFormula('=MEDIAN(1, 5, 2, 8, 7)', ctx)).toBe(5);
      expect(evaluateFormula('=ROUND(STDEV(2, 4, 4, 4, 5, 5, 7, 9), 2)', ctx)).toBe(2.14);
    });

    it('evaluates Counting & Conditionals: COUNT, COUNTA, COUNTIF, SUMIF, AVERAGEIF, IF, IFS, AND, OR, NOT', () => {
      expect(evaluateFormula('=COUNT(A1:C2)', ctx)).toBe(6);
      expect(evaluateFormula('=COUNTA(A1:C3)', ctx)).toBe(9);
      expect(evaluateFormula('=COUNTIF(A3:C3, "apple")', ctx)).toBe(2);
      expect(evaluateFormula('=COUNTIF(A1:C2, ">15")', ctx)).toBe(3);
      expect(evaluateFormula('=SUMIF(A1:C1, ">10")', ctx)).toBe(50);
      expect(evaluateFormula('=AVERAGEIF(A1:C1, ">10")', ctx)).toBe(25);

      expect(evaluateFormula('=IF(A1 > 5, "Big", "Small")', ctx)).toBe('Big');
      expect(evaluateFormula('=IF(A2 > 10, "Big", "Small")', ctx)).toBe('Small');
      expect(evaluateFormula('=IFS(A1 < 5, "Low", A1 = 10, "Exact", A1 > 10, "High")', ctx)).toBe('Exact');

      expect(evaluateFormula('=AND(A1 > 0, B1 > 0)', ctx)).toBe(true);
      expect(evaluateFormula('=AND(A1 > 0, B1 < 0)', ctx)).toBe(false);
      expect(evaluateFormula('=OR(A1 < 0, B1 > 0)', ctx)).toBe(true);
      expect(evaluateFormula('=NOT(A1 = B1)', ctx)).toBe(true);
    });

    it('evaluates Text functions: CONCAT, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM', () => {
      expect(evaluateFormula('=CONCAT("Foo", "Bar", "Baz")', ctx)).toBe('FooBarBaz');
      expect(evaluateFormula('=LEFT("Nexus", 3)', ctx)).toBe('Nex');
      expect(evaluateFormula('=RIGHT("Nexus", 2)', ctx)).toBe('us');
      expect(evaluateFormula('=MID("Nexus OS", 7, 2)', ctx)).toBe('OS');
      expect(evaluateFormula('=LEN("Arcade")', ctx)).toBe(6);
      expect(evaluateFormula('=UPPER("nexus")', ctx)).toBe('NEXUS');
      expect(evaluateFormula('=LOWER("NEXUS")', ctx)).toBe('nexus');
      expect(evaluateFormula('=TRIM("   spacious   ")', ctx)).toBe('spacious');
    });

    it('evaluates Date functions: DATE, YEAR, MONTH, DAY, TODAY', () => {
      expect(evaluateFormula('=DATE(2026, 11, 10)', ctx)).toBe('2026-11-10');
      expect(evaluateFormula('=YEAR("2026-11-10")', ctx)).toBe(2026);
      expect(evaluateFormula('=MONTH("2026-11-10")', ctx)).toBe(11);
      expect(evaluateFormula('=DAY("2026-11-10")', ctx)).toBe(10);
      expect(typeof evaluateFormula('=TODAY()', ctx)).toBe('string');
    });

    it('evaluates Lookup functions: VLOOKUP, XLOOKUP, INDEX, MATCH', () => {
      // Table:
      // Row 0: 10, 20, 30
      // Row 1: 5, 15, 25
      expect(evaluateFormula('=VLOOKUP(10, A1:C2, 2, true)', ctx)).toBe(20);
      expect(evaluateFormula('=VLOOKUP(5, A1:C2, 3, true)', ctx)).toBe(25);
      expect(evaluateFormula('=VLOOKUP(999, A1:C2, 2, true)', ctx)).toBe(ERRORS.NA);

      expect(evaluateFormula('=XLOOKUP(10, A1:C1, A2:C2)', ctx)).toBe(5);
      expect(evaluateFormula('=XLOOKUP(30, A1:C1, A2:C2)', ctx)).toBe(25);
      expect(evaluateFormula('=XLOOKUP(999, A1:C1, A2:C2, "Not Found")', ctx)).toBe('Not Found');

      expect(evaluateFormula('=INDEX(A1:C2, 1, 2)', ctx)).toBe(20);
      expect(evaluateFormula('=INDEX(A1:C2, 2, 3)', ctx)).toBe(25);

      expect(evaluateFormula('=MATCH(20, A1:C1, 0)', ctx)).toBe(2);
      expect(evaluateFormula('=MATCH(30, A1:C1, 0)', ctx)).toBe(3);
    });
  });

  describe('Dependency Graph & Cycle Detection', () => {
    it('detects cycles and topological order', () => {
      const graph = new DependencyGraph();

      // A1 -> B1 -> C1
      graph.setDependencies('Sheet1:0:0', ['Sheet1:1:0']);
      graph.setDependencies('Sheet1:1:0', ['Sheet1:2:0']);

      expect(graph.hasCycle('Sheet1:0:0')).toBe(false);

      // Now create cycle: C1 -> A1
      graph.setDependencies('Sheet1:2:0', ['Sheet1:0:0']);
      expect(graph.hasCycle('Sheet1:0:0')).toBe(true);

      // Resolve cycle
      graph.setDependencies('Sheet1:2:0', []);
      expect(graph.hasCycle('Sheet1:0:0')).toBe(false);

      // Evaluation order when C1 changes
      const order = graph.getEvaluationOrder(['Sheet1:2:0']);
      expect(order).toEqual(['Sheet1:1:0', 'Sheet1:0:0']);
    });
  });

  describe('SpreadsheetModel Document Operations', () => {
    it('manages cells, formats, and recomputes dependencies', () => {
      const model = new SpreadsheetModel();
      const sheet = model.getActiveSheet();

      model.setCell(sheet.id, 0, 0, '100'); // A1
      model.setCell(sheet.id, 0, 1, '200'); // A2
      model.setCell(sheet.id, 0, 2, '=SUM(A1:A2)', undefined, 'currency'); // A3

      expect(model.getCell(sheet.id, 0, 2).value).toBe(300);
      expect(model.getDisplayValue(sheet.id, 0, 2)).toContain('300');

      // Update A1 -> A3 should automatically recompute
      model.setCell(sheet.id, 0, 0, '500');
      expect(model.getCell(sheet.id, 0, 2).value).toBe(700);
    });

    it('supports undo and redo', () => {
      const model = new SpreadsheetModel();
      const sheet = model.getActiveSheet();

      model.setCell(sheet.id, 0, 0, 'Alpha');
      expect(model.getCell(sheet.id, 0, 0).raw).toBe('Alpha');

      model.setCell(sheet.id, 0, 0, 'Beta');
      expect(model.getCell(sheet.id, 0, 0).raw).toBe('Beta');

      expect(model.undo()).toBe(true);
      expect(model.getCell(sheet.id, 0, 0).raw).toBe('Alpha');

      expect(model.redo()).toBe(true);
      expect(model.getCell(sheet.id, 0, 0).raw).toBe('Beta');
    });

    it('sorts a range by column', () => {
      const model = new SpreadsheetModel();
      const sheet = model.getActiveSheet();

      model.setCell(sheet.id, 0, 0, 'Banana');
      model.setCell(sheet.id, 1, 0, '3');
      model.setCell(sheet.id, 0, 1, 'Apple');
      model.setCell(sheet.id, 1, 1, '10');
      model.setCell(sheet.id, 0, 2, 'Cherry');
      model.setCell(sheet.id, 1, 2, '1');

      // Sort rows 0..2 by column 0 (name) ascending
      model.sortRange(sheet.id, 0, 0, 1, 2, 0, true);
      expect(model.getCell(sheet.id, 0, 0).raw).toBe('Apple');
      expect(model.getCell(sheet.id, 0, 1).raw).toBe('Banana');
      expect(model.getCell(sheet.id, 0, 2).raw).toBe('Cherry');

      // Sort rows 0..2 by column 1 (number) ascending
      model.sortRange(sheet.id, 0, 0, 1, 2, 1, true);
      expect(model.getCell(sheet.id, 0, 0).raw).toBe('Cherry');
      expect(model.getCell(sheet.id, 1, 0).raw).toBe('1');
      expect(model.getCell(sheet.id, 0, 1).raw).toBe('Banana');
      expect(model.getCell(sheet.id, 1, 1).raw).toBe('3');
      expect(model.getCell(sheet.id, 0, 2).raw).toBe('Apple');
      expect(model.getCell(sheet.id, 1, 2).raw).toBe('10');
    });

    it('exports and imports TSV and CSV', () => {
      const model = new SpreadsheetModel();
      const sheet = model.getActiveSheet();

      model.setCell(sheet.id, 0, 0, 'Item');
      model.setCell(sheet.id, 1, 0, 'Qty');
      model.setCell(sheet.id, 0, 1, 'Pen');
      model.setCell(sheet.id, 1, 1, '5');

      const tsv = model.exportTSV(sheet.id, 0, 0, 1, 1);
      expect(tsv).toBe('Item\tQty\nPen\t5');

      const csv = model.exportCSV(sheet.id);
      expect(csv).toBe('Item,Qty\nPen,5');

      // Import TSV into new sheet
      const s2 = model.addSheet('Imported');
      model.importTSV(s2.id, 0, 0, 'City\tPop\nBerlin\t3700000');
      expect(model.getCell(s2.id, 0, 0).raw).toBe('City');
      expect(model.getCell(s2.id, 1, 1).raw).toBe('3700000');
    });

    it('manages charts in sheets', () => {
      const model = new SpreadsheetModel();
      const sheet = model.getActiveSheet();

      model.addChart(sheet.id, {
        type: 'bar',
        title: 'Quarterly Sales',
        range: 'A1:B4',
        col: 5,
        row: 1,
      });

      expect(sheet.charts.length).toBe(1);
      expect(sheet.charts[0].title).toBe('Quarterly Sales');

      model.removeChart(sheet.id, sheet.charts[0].id);
      expect(sheet.charts.length).toBe(0);
    });
  });
});
