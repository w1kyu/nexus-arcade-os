// @ts-check

/**
 * @typedef {[number, number]} Point
 */

/**
 * Calculates heuristic distance between two points.
 * @param {Point} a
 * @param {Point} b
 * @param {'manhattan' | 'euclidean' | 'chebyshev'} heuristic
 */
export function calculateHeuristic(a, b, heuristic = 'manhattan') {
  const dr = Math.abs(a[0] - b[0]);
  const dc = Math.abs(a[1] - b[1]);
  if (heuristic === 'euclidean') {
    return Math.hypot(dr, dc);
  }
  if (heuristic === 'chebyshev') {
    return Math.max(dr, dc);
  }
  return dr + dc; // manhattan
}

/**
 * Returns neighbor coordinates and edge cost.
 * @param {number} r
 * @param {number} c
 * @param {number} rows
 * @param {number} cols
 * @param {boolean} diagonal
 * @param {number[][]} grid - Cell weights (1 = normal, 5 = mud, Infinity = wall)
 * @returns {Array<{ r: number, c: number, cost: number }>}
 */
export function getNeighbors(r, c, rows, cols, diagonal, grid) {
  const neighbors = [];
  const dirs4 = [
    [-1, 0, 1],
    [1, 0, 1],
    [0, -1, 1],
    [0, 1, 1],
  ];
  const dirsDiag = [
    [-1, -1, 1.414],
    [-1, 1, 1.414],
    [1, -1, 1.414],
    [1, 1, 1.414],
  ];
  const allDirs = diagonal ? [...dirs4, ...dirsDiag] : dirs4;

  for (const [dr, dc, mult] of allDirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      const weight = grid[nr][nc];
      if (weight < Infinity) {
        neighbors.push({ r: nr, c: nc, cost: weight * mult });
      }
    }
  }
  return neighbors;
}

/**
 * Reconstructs path from parent map.
 * @param {Map<string, Point>} parentMap
 * @param {Point} goal
 * @param {number[][]} grid
 */
export function reconstructPath(parentMap, goal, grid) {
  const path = [];
  let curr = goal;
  let totalCost = 0;
  while (curr) {
    path.unshift(curr);
    const key = `${curr[0]},${curr[1]}`;
    curr = parentMap.get(key) || null;
  }
  for (let i = 1; i < path.length; i++) {
    totalCost += grid[path[i][0]][path[i][1]];
  }
  return { path, totalCost };
}

/**
 * Breadth-First Search (BFS) generator
 */
export function* bfs(grid, start, goal, opts = {}) {
  const rows = grid.length;
  const cols = grid[0].length;
  const diagonal = opts.diagonal || false;
  const queue = [start];
  const visited = new Set([`${start[0]},${start[1]}`]);
  const parentMap = new Map();

  yield { type: 'highlight', line: 1 };
  while (queue.length > 0) {
    const curr = queue.shift();
    if (!curr) break;
    const [r, c] = curr;

    yield { type: 'visit', r, c, line: 3 };

    if (r === goal[0] && c === goal[1]) {
      const { path, totalCost } = reconstructPath(parentMap, goal, grid);
      yield { type: 'path', path, length: path.length, cost: totalCost, line: 5 };
      return;
    }

    const neighbors = getNeighbors(r, c, rows, cols, diagonal, grid);
    for (const nb of neighbors) {
      const key = `${nb.r},${nb.c}`;
      if (!visited.has(key)) {
        visited.add(key);
        parentMap.set(key, [r, c]);
        queue.push([nb.r, nb.c]);
        yield { type: 'frontier', r: nb.r, c: nb.c, line: 4 };
      }
    }
  }
}

/**
 * Depth-First Search (DFS) generator
 */
export function* dfs(grid, start, goal, opts = {}) {
  const rows = grid.length;
  const cols = grid[0].length;
  const diagonal = opts.diagonal || false;
  const stack = [start];
  const visited = new Set();
  const parentMap = new Map();

  yield { type: 'highlight', line: 1 };
  while (stack.length > 0) {
    const curr = stack.pop();
    if (!curr) break;
    const [r, c] = curr;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);

    yield { type: 'visit', r, c, line: 3 };

    if (r === goal[0] && c === goal[1]) {
      const { path, totalCost } = reconstructPath(parentMap, goal, grid);
      yield { type: 'path', path, length: path.length, cost: totalCost, line: 5 };
      return;
    }

    const neighbors = getNeighbors(r, c, rows, cols, diagonal, grid);
    for (const nb of neighbors) {
      const nbKey = `${nb.r},${nb.c}`;
      if (!visited.has(nbKey)) {
        parentMap.set(nbKey, [r, c]);
        stack.push([nb.r, nb.c]);
        yield { type: 'frontier', r: nb.r, c: nb.c, line: 4 };
      }
    }
  }
}

/**
 * Dijkstra's shortest path generator
 */
export function* dijkstra(grid, start, goal, opts = {}) {
  const rows = grid.length;
  const cols = grid[0].length;
  const diagonal = opts.diagonal || false;
  const dist = new Map();
  const parentMap = new Map();
  const pq = [{ r: start[0], c: start[1], d: 0 }];
  dist.set(`${start[0]},${start[1]}`, 0);

  yield { type: 'highlight', line: 1 };
  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const curr = pq.shift();
    if (!curr) break;
    const { r, c, d } = curr;

    if (d > (dist.get(`${r},${c}`) ?? Infinity)) continue;
    yield { type: 'visit', r, c, dist: d, line: 3 };

    if (r === goal[0] && c === goal[1]) {
      const { path, totalCost } = reconstructPath(parentMap, goal, grid);
      yield { type: 'path', path, length: path.length, cost: totalCost, line: 5 };
      return;
    }

    const neighbors = getNeighbors(r, c, rows, cols, diagonal, grid);
    for (const nb of neighbors) {
      const alt = d + nb.cost;
      const key = `${nb.r},${nb.c}`;
      if (alt < (dist.get(key) ?? Infinity)) {
        dist.set(key, alt);
        parentMap.set(key, [r, c]);
        pq.push({ r: nb.r, c: nb.c, d: alt });
        yield { type: 'frontier', r: nb.r, c: nb.c, line: 4 };
      }
    }
  }
}

/**
 * A* search generator
 */
export function* astar(grid, start, goal, opts = {}) {
  const rows = grid.length;
  const cols = grid[0].length;
  const diagonal = opts.diagonal || false;
  const heuristic = opts.heuristic || 'manhattan';
  const gScore = new Map();
  const parentMap = new Map();
  const startKey = `${start[0]},${start[1]}`;
  gScore.set(startKey, 0);

  const pq = [
    {
      r: start[0],
      c: start[1],
      f: calculateHeuristic(start, goal, heuristic),
      g: 0,
    },
  ];

  yield { type: 'highlight', line: 1 };
  while (pq.length > 0) {
    pq.sort((a, b) => a.f - b.f);
    const curr = pq.shift();
    if (!curr) break;
    const { r, c, g } = curr;

    yield { type: 'visit', r, c, line: 3 };

    if (r === goal[0] && c === goal[1]) {
      const { path, totalCost } = reconstructPath(parentMap, goal, grid);
      yield { type: 'path', path, length: path.length, cost: totalCost, line: 5 };
      return;
    }

    const neighbors = getNeighbors(r, c, rows, cols, diagonal, grid);
    for (const nb of neighbors) {
      const tentativeG = g + nb.cost;
      const key = `${nb.r},${nb.c}`;
      if (tentativeG < (gScore.get(key) ?? Infinity)) {
        gScore.set(key, tentativeG);
        parentMap.set(key, [r, c]);
        const h = calculateHeuristic([nb.r, nb.c], goal, heuristic);
        pq.push({ r: nb.r, c: nb.c, f: tentativeG + h, g: tentativeG });
        yield { type: 'frontier', r: nb.r, c: nb.c, line: 4 };
      }
    }
  }
}

/**
 * Greedy Best-First Search generator
 */
export function* greedyBestFirst(grid, start, goal, opts = {}) {
  const rows = grid.length;
  const cols = grid[0].length;
  const diagonal = opts.diagonal || false;
  const heuristic = opts.heuristic || 'manhattan';
  const visited = new Set();
  const parentMap = new Map();
  const pq = [{ r: start[0], c: start[1], h: calculateHeuristic(start, goal, heuristic) }];
  visited.add(`${start[0]},${start[1]}`);

  yield { type: 'highlight', line: 1 };
  while (pq.length > 0) {
    pq.sort((a, b) => a.h - b.h);
    const curr = pq.shift();
    if (!curr) break;
    const { r, c } = curr;

    yield { type: 'visit', r, c, line: 3 };

    if (r === goal[0] && c === goal[1]) {
      const { path, totalCost } = reconstructPath(parentMap, goal, grid);
      yield { type: 'path', path, length: path.length, cost: totalCost, line: 5 };
      return;
    }

    const neighbors = getNeighbors(r, c, rows, cols, diagonal, grid);
    for (const nb of neighbors) {
      const key = `${nb.r},${nb.c}`;
      if (!visited.has(key)) {
        visited.add(key);
        parentMap.set(key, [r, c]);
        const h = calculateHeuristic([nb.r, nb.c], goal, heuristic);
        pq.push({ r: nb.r, c: nb.c, h });
        yield { type: 'frontier', r: nb.r, c: nb.c, line: 4 };
      }
    }
  }
}

/**
 * Bidirectional BFS generator
 */
export function* bidirectionalBfs(grid, start, goal, opts = {}) {
  const rows = grid.length;
  const cols = grid[0].length;
  const diagonal = opts.diagonal || false;

  const startQueue = [start];
  const goalQueue = [goal];
  const startVisited = new Map([[`${start[0]},${start[1]}`, null]]);
  const goalVisited = new Map([[`${goal[0]},${goal[1]}`, null]]);

  yield { type: 'highlight', line: 1 };
  while (startQueue.length > 0 && goalQueue.length > 0) {
    // Expand start frontier
    const currS = startQueue.shift();
    if (currS) {
      const [sr, sc] = currS;
      yield { type: 'visit', r: sr, c: sc, line: 3 };
      const sNeighbors = getNeighbors(sr, sc, rows, cols, diagonal, grid);
      for (const nb of sNeighbors) {
        const key = `${nb.r},${nb.c}`;
        if (goalVisited.has(key)) {
          // Intersection found!
          startVisited.set(key, [sr, sc]);
          const pathStart = [];
          let p = [nb.r, nb.c];
          while (p) {
            pathStart.unshift(p);
            p = startVisited.get(`${p[0]},${p[1]}`);
          }
          let q = goalVisited.get(key);
          const pathGoal = [];
          while (q) {
            pathGoal.push(q);
            q = goalVisited.get(`${q[0]},${q[1]}`);
          }
          const fullPath = [...pathStart, ...pathGoal];
          let totalCost = 0;
          for (let i = 1; i < fullPath.length; i++) {
            totalCost += grid[fullPath[i][0]][fullPath[i][1]];
          }
          yield { type: 'path', path: fullPath, length: fullPath.length, cost: totalCost, line: 5 };
          return;
        }
        if (!startVisited.has(key)) {
          startVisited.set(key, [sr, sc]);
          startQueue.push([nb.r, nb.c]);
          yield { type: 'frontier', r: nb.r, c: nb.c, line: 4 };
        }
      }
    }

    // Expand goal frontier
    const currG = goalQueue.shift();
    if (currG) {
      const [gr, gc] = currG;
      yield { type: 'visit', r: gr, c: gc, line: 3 };
      const gNeighbors = getNeighbors(gr, gc, rows, cols, diagonal, grid);
      for (const nb of gNeighbors) {
        const key = `${nb.r},${nb.c}`;
        if (startVisited.has(key)) {
          // Intersection found!
          goalVisited.set(key, [gr, gc]);
          const pathStart = [];
          let p = [nb.r, nb.c];
          while (p) {
            pathStart.unshift(p);
            p = startVisited.get(`${p[0]},${p[1]}`);
          }
          let q = [gr, gc];
          const pathGoal = [];
          while (q) {
            pathGoal.push(q);
            q = goalVisited.get(`${q[0]},${q[1]}`);
          }
          const fullPath = [...pathStart, ...pathGoal];
          let totalCost = 0;
          for (let i = 1; i < fullPath.length; i++) {
            totalCost += grid[fullPath[i][0]][fullPath[i][1]];
          }
          yield { type: 'path', path: fullPath, length: fullPath.length, cost: totalCost, line: 5 };
          return;
        }
        if (!goalVisited.has(key)) {
          goalVisited.set(key, [gr, gc]);
          goalQueue.push([nb.r, nb.c]);
          yield { type: 'frontier', r: nb.r, c: nb.c, line: 4 };
        }
      }
    }
  }
}

export const PATHFINDING_ALGORITHMS = {
  bfs: {
    name: { en: 'Breadth-First Search (BFS)', de: 'Breitensuche (BFS)' },
    pseudocode: {
      en: [
        'queue = [start]; visited = {start}',
        'while queue not empty:',
        '  current = queue.pop()',
        '  if current == goal: return reconstructPath()',
        '  for neighbor of current: add to queue',
      ],
      de: [
        'Warteschlange = [Start]; besucht = {Start}',
        'solange Warteschlange nicht leer:',
        '  aktuell = Warteschlange.entferne()',
        '  wenn aktuell == Ziel: Pfad rekonstruieren',
        '  für Nachbar von aktuell: in Warteschlange einfügen',
      ],
    },
    generator: bfs,
  },
  dfs: {
    name: { en: 'Depth-First Search (DFS)', de: 'Tiefensuche (DFS)' },
    pseudocode: {
      en: [
        'stack = [start]; visited = {}',
        'while stack not empty:',
        '  current = stack.pop()',
        '  if current == goal: return reconstructPath()',
        '  for neighbor of current: push to stack',
      ],
      de: [
        'Stapel = [Start]; besucht = {}',
        'solange Stapel nicht leer:',
        '  aktuell = Stapel.entferne()',
        '  wenn aktuell == Ziel: Pfad rekonstruieren',
        '  für Nachbar von aktuell: auf Stapel legen',
      ],
    },
    generator: dfs,
  },
  dijkstra: {
    name: { en: "Dijkstra's Algorithm", de: 'Dijkstra-Algorithmus' },
    pseudocode: {
      en: [
        'pq = [(0, start)]; dist[start] = 0',
        'while pq not empty:',
        '  (d, u) = pq.extractMin()',
        '  if u == goal: return reconstructPath()',
        '  for (v, weight) of neighbors:',
        '    if d + weight < dist[v]: relax(u, v)',
      ],
      de: [
        'Prioritätswarteschlange = [(0, Start)]; dist[Start] = 0',
        'solange Warteschlange nicht leer:',
        '  (d, u) = Warteschlange.minExtrahiere()',
        '  wenn u == Ziel: Pfad rekonstruieren',
        '  für jeden Nachbarn v mit Kantengewicht:',
        '    wenn d + gewicht < dist[v]: relaxiere(u, v)',
      ],
    },
    generator: dijkstra,
  },
  astar: {
    name: { en: 'A* Search', de: 'A*-Suche' },
    pseudocode: {
      en: [
        'openSet = [start]; g[start] = 0; f[start] = h(start)',
        'while openSet not empty:',
        '  current = node in openSet with lowest f',
        '  if current == goal: return reconstructPath()',
        '  for neighbor of current: eval g + cost + h',
      ],
      de: [
        'OffeneMenge = [Start]; g[Start] = 0; f[Start] = h(Start)',
        'solange OffeneMenge nicht leer:',
        '  aktuell = Knoten mit minimalem f-Wert',
        '  wenn aktuell == Ziel: Pfad rekonstruieren',
        '  für jeden Nachbarn: berechne g + kosten + h',
      ],
    },
    generator: astar,
  },
  greedy: {
    name: { en: 'Greedy Best-First Search', de: 'Greedy-Best-First-Suche' },
    pseudocode: {
      en: [
        'pq = [(h(start), start)]; visited = {start}',
        'while pq not empty:',
        '  current = pq.extractMinByHeuristic()',
        '  if current == goal: return reconstructPath()',
        '  for neighbor of current: insert with h(neighbor)',
      ],
      de: [
        'Warteschlange = [(h(Start), Start)]; besucht = {Start}',
        'solange Warteschlange nicht leer:',
        '  aktuell = Knoten mit geringster Heuristik h',
        '  wenn aktuell == Ziel: Pfad rekonstruieren',
        '  für jeden Nachbarn: einfügen mit h(Nachbar)',
      ],
    },
    generator: greedyBestFirst,
  },
  bidirectional: {
    name: { en: 'Bidirectional BFS', de: 'Bidirektionale BFS' },
    pseudocode: {
      en: [
        'qStart = [start]; qGoal = [goal]',
        'while both queues not empty:',
        '  expand frontier from start',
        '  expand frontier from goal',
        '  if frontiers meet: join paths and return',
      ],
      de: [
        'qStart = [Start]; qZiel = [Ziel]',
        'solange beide Schlangen nicht leer:',
        '  erweitere Front von Start',
        '  erweitere Front von Ziel',
        '  wenn Fronten sich treffen: Pfade verbinden',
      ],
    },
    generator: bidirectionalBfs,
  },
};
