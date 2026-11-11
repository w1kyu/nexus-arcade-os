// @ts-check
// Pure game logic for Minesweeper with safe first click and chording

/**
 * @typedef {object} Cell
 * @property {boolean} mine
 * @property {boolean} revealed
 * @property {'none' | 'flag' | 'question'} mark
 * @property {number} adjacentMines
 * @property {boolean} [exploded]
 */

export const DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

export class MinesweeperBoard {
  /**
   * @param {number} rows
   * @param {number} cols
   * @param {number} mines
   * @param {() => number} [randomFn]
   */
  constructor(rows = 9, cols = 9, mines = 10, randomFn = Math.random) {
    this.rows = Math.max(4, Math.min(40, rows));
    this.cols = Math.max(4, Math.min(50, cols));
    this.totalMines = Math.max(1, Math.min(this.rows * this.cols - 9, mines));
    this.randomFn = randomFn;

    /** @type {Cell[][]} */
    this.grid = [];
    this.minesPlaced = false;
    this.gameOver = false;
    this.won = false;
    this.flagsCount = 0;
    this.revealedCount = 0;

    this._initGrid();
  }

  _initGrid() {
    this.grid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({
        mine: false,
        revealed: false,
        mark: 'none',
        adjacentMines: 0,
      })),
    );
    this.minesPlaced = false;
    this.gameOver = false;
    this.won = false;
    this.flagsCount = 0;
    this.revealedCount = 0;
  }

  /**
   * Safe first click: places mines avoiding the clicked cell AND its immediate 8 neighbors.
   * This guarantees an opening area (adjacentMines = 0 at clicked cell).
   * @param {number} startR
   * @param {number} startC
   */
  placeMines(startR, startC) {
    const forbidden = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = startR + dr;
        const c = startC + dc;
        if (this._inBounds(r, c)) {
          forbidden.add(`${r},${c}`);
        }
      }
    }

    const availableCoords = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!forbidden.has(`${r},${c}`)) {
          availableCoords.push({ r, c });
        }
      }
    }

    // Shuffle available coordinates
    for (let i = availableCoords.length - 1; i > 0; i--) {
      const j = Math.floor(this.randomFn() * (i + 1));
      const temp = availableCoords[i];
      availableCoords[i] = availableCoords[j];
      availableCoords[j] = temp;
    }

    // Place mines
    const count = Math.min(this.totalMines, availableCoords.length);
    for (let i = 0; i < count; i++) {
      const { r, c } = availableCoords[i];
      this.grid[r][c].mine = true;
    }

    // Calculate adjacent numbers
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.grid[r][c].mine) {
          this.grid[r][c].adjacentMines = this._countAdjacentMines(r, c);
        }
      }
    }

    this.minesPlaced = true;
  }

  _inBounds(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  _countAdjacentMines(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (this._inBounds(nr, nc) && this.grid[nr][nc].mine) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Toggles flag / question mark on cell
   * @param {number} r
   * @param {number} c
   * @returns {'none' | 'flag' | 'question'}
   */
  toggleMark(r, c) {
    if (this.gameOver || !this._inBounds(r, c)) return 'none';
    const cell = this.grid[r][c];
    if (cell.revealed) return 'none';

    if (cell.mark === 'none') {
      cell.mark = 'flag';
      this.flagsCount++;
    } else if (cell.mark === 'flag') {
      cell.mark = 'question';
      this.flagsCount--;
    } else {
      cell.mark = 'none';
    }
    return cell.mark;
  }

  /**
   * Reveals cell (r, c)
   * @param {number} r
   * @param {number} c
   * @returns {{ status: 'safe' | 'mine' | 'ignored' | 'won', openedCells: { r: number, c: number }[] }}
   */
  reveal(r, c) {
    if (this.gameOver || !this._inBounds(r, c)) {
      return { status: 'ignored', openedCells: [] };
    }

    const cell = this.grid[r][c];
    if (cell.revealed || cell.mark === 'flag') {
      return { status: 'ignored', openedCells: [] };
    }

    // Safe first click guarantee
    if (!this.minesPlaced) {
      this.placeMines(r, c);
    }

    if (cell.mine) {
      cell.exploded = true;
      cell.revealed = true;
      this.gameOver = true;
      this.won = false;
      this._revealAllMines();
      return { status: 'mine', openedCells: [{ r, c }] };
    }

    // Flood fill opening area for 0 adjacent mines
    const openedCells = [];
    const queue = [{ r, c }];
    cell.revealed = true;
    this.revealedCount++;
    openedCells.push({ r, c });

    while (queue.length > 0) {
      const cur = queue.shift();
      if (!cur) continue;
      const curCell = this.grid[cur.r][cur.c];

      if (curCell.adjacentMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = cur.r + dr;
            const nc = cur.c + dc;

            if (this._inBounds(nr, nc)) {
              const nCell = this.grid[nr][nc];
              if (!nCell.revealed && nCell.mark !== 'flag' && !nCell.mine) {
                nCell.revealed = true;
                this.revealedCount++;
                openedCells.push({ r: nr, c: nc });
                if (nCell.adjacentMines === 0) {
                  queue.push({ r: nr, c: nc });
                }
              }
            }
          }
        }
      }
    }

    // Check win condition: all non-mine cells revealed
    const totalSafe = this.rows * this.cols - this.totalMines;
    if (this.revealedCount >= totalSafe) {
      this.gameOver = true;
      this.won = true;
      return { status: 'won', openedCells };
    }

    return { status: 'safe', openedCells };
  }

  /**
   * Chording: reveals unflagged neighbors if number of adjacent flags matches adjacentMines
   * @param {number} r
   * @param {number} c
   * @returns {{ status: 'safe' | 'mine' | 'won' | 'ignored', openedCells: { r: number, c: number }[] }}
   */
  chord(r, c) {
    if (this.gameOver || !this._inBounds(r, c)) {
      return { status: 'ignored', openedCells: [] };
    }
    const cell = this.grid[r][c];
    if (!cell.revealed || cell.adjacentMines === 0) {
      return { status: 'ignored', openedCells: [] };
    }

    // Count adjacent flags
    let flagCount = 0;
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (this._inBounds(nr, nc)) {
          if (this.grid[nr][nc].mark === 'flag') {
            flagCount++;
          } else if (!this.grid[nr][nc].revealed) {
            neighbors.push({ r: nr, c: nc });
          }
        }
      }
    }

    // Only chord if flag count equals clue number
    if (flagCount !== cell.adjacentMines) {
      return { status: 'ignored', openedCells: [] };
    }

    let hitMine = false;
    const allOpened = [];

    for (const n of neighbors) {
      const res = this.reveal(n.r, n.c);
      if (res.status === 'mine') {
        hitMine = true;
      }
      allOpened.push(...res.openedCells);
      if (this.won) {
        return { status: 'won', openedCells: allOpened };
      }
    }

    if (hitMine) {
      return { status: 'mine', openedCells: allOpened };
    }

    return { status: 'safe', openedCells: allOpened };
  }

  _revealAllMines() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.mine) {
          cell.revealed = true;
        }
      }
    }
  }
}
