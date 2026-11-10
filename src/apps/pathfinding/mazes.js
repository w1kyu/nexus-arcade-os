// @ts-check

/**
 * Initializes an empty grid with 1s.
 * @param {number} rows
 * @param {number} cols
 */
export function createEmptyGrid(rows, cols) {
  return Array.from({ length: rows }, () => new Array(cols).fill(1));
}

/**
 * Initializes a grid filled with walls (Infinity).
 * @param {number} rows
 * @param {number} cols
 */
export function createWallGrid(rows, cols) {
  return Array.from({ length: rows }, () => new Array(cols).fill(Infinity));
}

/**
 * Recursive Backtracker maze generator
 * @param {number} rows
 * @param {number} cols
 */
export function generateRecursiveBacktracker(rows, cols) {
  const grid = createWallGrid(rows, cols);
  // Ensure odd dimensions for classic grid paths
  const rStart = 1;
  const cStart = 1;
  grid[rStart][cStart] = 1;
  const stack = [[rStart, cStart]];
  const dirs = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ];

  while (stack.length > 0) {
    const curr = stack[stack.length - 1];
    const [r, c] = curr;
    // Find unvisited neighbors at step 2
    const unvisited = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === Infinity) {
        unvisited.push([nr, nc, dr / 2, dc / 2]);
      }
    }

    if (unvisited.length > 0) {
      const [nr, nc, wallR, wallC] = unvisited[Math.floor(Math.random() * unvisited.length)];
      grid[r + wallR][c + wallC] = 1;
      grid[nr][nc] = 1;
      stack.push([nr, nc]);
    } else {
      stack.pop();
    }
  }
  return grid;
}

/**
 * Randomized Prim's maze generator
 * @param {number} rows
 * @param {number} cols
 */
export function generatePrimMaze(rows, cols) {
  const grid = createWallGrid(rows, cols);
  const rStart = 1;
  const cStart = 1;
  grid[rStart][cStart] = 1;

  const walls = [];
  const dirs = [
    [-2, 0, -1, 0],
    [2, 0, 1, 0],
    [0, -2, 0, -1],
    [0, 2, 0, 1],
  ];

  for (const [dr, dc, wr, wc] of dirs) {
    const nr = rStart + dr;
    const nc = cStart + dc;
    if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1) {
      walls.push({ r: nr, c: nc, wr: rStart + wr, wc: cStart + wc, pr: rStart, pc: cStart });
    }
  }

  while (walls.length > 0) {
    const idx = Math.floor(Math.random() * walls.length);
    const { r, c, wr, wc } = walls.splice(idx, 1)[0];

    if (grid[r][c] === Infinity) {
      grid[wr][wc] = 1;
      grid[r][c] = 1;

      for (const [dr, dc, dwr, dwc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === Infinity) {
          walls.push({ r: nr, c: nc, wr: r + dwr, wc: c + dwc, pr: r, pc: c });
        }
      }
    }
  }
  return grid;
}

/**
 * Randomized Kruskal's maze generator
 * @param {number} rows
 * @param {number} cols
 */
export function generateKruskalMaze(rows, cols) {
  const grid = createWallGrid(rows, cols);
  const cells = [];
  const parent = new Map();

  function find(i) {
    if (parent.get(i) === i) return i;
    const root = find(parent.get(i));
    parent.set(i, root);
    return root;
  }

  function union(i, j) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent.set(rootI, rootJ);
      return true;
    }
    return false;
  }

  const walls = [];
  for (let r = 1; r < rows - 1; r += 2) {
    for (let c = 1; c < cols - 1; c += 2) {
      const id = `${r},${c}`;
      cells.push([r, c]);
      parent.set(id, id);
      grid[r][c] = 1;
      if (r + 2 < rows - 1) {
        walls.push({ r1: r, c1: c, r2: r + 2, c2: c, wr: r + 1, wc: c });
      }
      if (c + 2 < cols - 1) {
        walls.push({ r1: r, c1: c, r2: r, c2: c + 2, wr: r, wc: c + 1 });
      }
    }
  }

  // Shuffle walls
  for (let i = walls.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = walls[i];
    walls[i] = walls[j];
    walls[j] = tmp;
  }

  for (const { r1, c1, r2, c2, wr, wc } of walls) {
    const id1 = `${r1},${c1}`;
    const id2 = `${r2},${c2}`;
    if (union(id1, id2)) {
      grid[wr][wc] = 1;
    }
  }

  return grid;
}

/**
 * Recursive Division maze generator
 * @param {number} rows
 * @param {number} cols
 */
export function generateRecursiveDivision(rows, cols) {
  const grid = createEmptyGrid(rows, cols);
  // Add outer boundary walls
  for (let r = 0; r < rows; r++) {
    grid[r][0] = Infinity;
    grid[r][cols - 1] = Infinity;
  }
  for (let c = 0; c < cols; c++) {
    grid[0][c] = Infinity;
    grid[rows - 1][c] = Infinity;
  }

  function divide(r1, r2, c1, c2) {
    if (r2 - r1 < 2 || c2 - c1 < 2) return;
    const horizontal = r2 - r1 > c2 - c1;

    if (horizontal) {
      const midR = Math.floor((r1 + r2) / 2);
      const holeC = Math.floor(Math.random() * (c2 - c1 + 1)) + c1;
      for (let c = c1; c <= c2; c++) {
        if (c !== holeC) grid[midR][c] = Infinity;
      }
      divide(r1, midR - 1, c1, c2);
      divide(midR + 1, r2, c1, c2);
    } else {
      const midC = Math.floor((c1 + c2) / 2);
      const holeR = Math.floor(Math.random() * (r2 - r1 + 1)) + r1;
      for (let r = r1; r <= r2; r++) {
        if (r !== holeR) grid[r][midC] = Infinity;
      }
      divide(r1, r2, c1, midC - 1);
      divide(r1, r2, midC + 1, c2);
    }
  }

  divide(1, rows - 2, 1, cols - 2);
  return grid;
}

/**
 * Generates random terrain with mud/water weights and scattered walls
 * @param {number} rows
 * @param {number} cols
 */
export function generateRandomTerrain(rows, cols) {
  const grid = createEmptyGrid(rows, cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rand = Math.random();
      if (rand < 0.22) {
        grid[r][c] = Infinity; // wall
      } else if (rand < 0.45) {
        grid[r][c] = 5; // mud
      }
    }
  }
  return grid;
}
