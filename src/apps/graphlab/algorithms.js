// @ts-check

/**
 * @typedef {object} GraphNode
 * @property {string} id
 * @property {string} label
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {object} GraphEdge
 * @property {string} id
 * @property {string} from
 * @property {string} to
 * @property {number} weight
 */

/**
 * Builds adjacency list from nodes and edges.
 * @param {GraphNode[]} nodes
 * @param {GraphEdge[]} edges
 * @param {boolean} directed
 */
export function buildAdjacencyList(nodes, edges, directed = false) {
  /** @type {Map<string, Array<{ to: string, weight: number, edgeId: string }>>} */
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)?.push({ to: e.to, weight: e.weight ?? 1, edgeId: e.id });
    if (!directed) {
      adj.get(e.to)?.push({ to: e.from, weight: e.weight ?? 1, edgeId: e.id });
    }
  }
  return adj;
}

/**
 * BFS generator
 */
export function* bfs(nodes, edges, directed, startId) {
  if (nodes.length === 0) return;
  const start = startId || nodes[0].id;
  const adj = buildAdjacencyList(nodes, edges, directed);
  const visited = new Set([start]);
  const queue = [start];

  yield { type: 'highlight', line: 1, activeNode: start };
  while (queue.length > 0) {
    const u = queue.shift();
    if (!u) break;
    yield { type: 'visit', line: 3, activeNode: u, visited: Array.from(visited) };

    const neighbors = adj.get(u) || [];
    for (const nb of neighbors) {
      yield { type: 'inspect', line: 4, activeEdge: nb.edgeId };
      if (!visited.has(nb.to)) {
        visited.add(nb.to);
        queue.push(nb.to);
        yield { type: 'discover', line: 4, activeNode: nb.to, activeEdge: nb.edgeId };
      }
    }
  }
  yield { type: 'finish', line: 5, visited: Array.from(visited) };
}

/**
 * DFS generator with discovery and finish times d[u], f[u]
 */
export function* dfs(nodes, edges, directed, startId) {
  if (nodes.length === 0) return;
  const adj = buildAdjacencyList(nodes, edges, directed);
  const visited = new Set();
  const d = {};
  const f = {};
  let time = 0;

  yield { type: 'highlight', line: 1 };

  function* dfsVisit(u) {
    time++;
    d[u] = time;
    visited.add(u);
    yield { type: 'visit', line: 2, activeNode: u, dTime: time, visited: Array.from(visited) };

    const neighbors = adj.get(u) || [];
    for (const nb of neighbors) {
      yield { type: 'inspect', line: 3, activeEdge: nb.edgeId };
      if (!visited.has(nb.to)) {
        yield* dfsVisit(nb.to);
      }
    }

    time++;
    f[u] = time;
    yield { type: 'finishNode', line: 4, activeNode: u, fTime: time, d, f };
  }

  const startList = startId
    ? [startId, ...nodes.map((n) => n.id).filter((id) => id !== startId)]
    : nodes.map((n) => n.id);
  for (const id of startList) {
    if (!visited.has(id)) {
      yield* dfsVisit(id);
    }
  }
  yield { type: 'finish', line: 5, d, f };
}

/**
 * Dijkstra's shortest path generator
 */
export function* dijkstra(nodes, edges, directed, startId) {
  if (nodes.length === 0) return;
  const start = startId || nodes[0].id;
  const adj = buildAdjacencyList(nodes, edges, directed);
  const dist = {};
  const prev = {};
  for (const n of nodes) dist[n.id] = Infinity;
  dist[start] = 0;

  const pq = [{ id: start, d: 0 }];
  const visited = new Set();

  yield { type: 'highlight', line: 1 };
  while (pq.length > 0) {
    pq.sort((a, b) => a.d - b.d);
    const curr = pq.shift();
    if (!curr) break;
    const { id: u, d } = curr;
    if (d > dist[u]) continue;
    visited.add(u);

    yield { type: 'visit', line: 3, activeNode: u, dist: { ...dist } };

    const neighbors = adj.get(u) || [];
    for (const nb of neighbors) {
      if (nb.weight < 0) {
        yield { type: 'error', message: 'Negative edge weight detected' };
      }
      yield { type: 'inspect', line: 4, activeEdge: nb.edgeId };
      const alt = d + nb.weight;
      if (alt < dist[nb.to]) {
        dist[nb.to] = alt;
        prev[nb.to] = u;
        pq.push({ id: nb.to, d: alt });
        yield { type: 'relax', line: 4, activeNode: nb.to, activeEdge: nb.edgeId, dist: { ...dist } };
      }
    }
  }
  yield { type: 'finish', line: 5, dist, prev };
}

/**
 * Bellman-Ford algorithm generator with negative cycle detection
 */
export function* bellmanFord(nodes, edges, directed, startId) {
  if (nodes.length === 0) return;
  const start = startId || nodes[0].id;
  const dist = {};
  const prev = {};
  for (const n of nodes) dist[n.id] = Infinity;
  dist[start] = 0;

  // Flatten edges according to directed/undirected
  const edgeList = [];
  for (const e of edges) {
    edgeList.push({ from: e.from, to: e.to, weight: e.weight ?? 1, id: e.id });
    if (!directed) {
      edgeList.push({ from: e.to, to: e.from, weight: e.weight ?? 1, id: e.id });
    }
  }

  yield { type: 'highlight', line: 1 };
  // Relax edges |V| - 1 times
  for (let i = 1; i < nodes.length; i++) {
    let updated = false;
    for (const e of edgeList) {
      if (dist[e.from] !== Infinity && dist[e.from] + e.weight < dist[e.to]) {
        dist[e.to] = dist[e.from] + e.weight;
        prev[e.to] = e.from;
        updated = true;
        yield { type: 'relax', line: 3, activeEdge: e.id, activeNode: e.to, dist: { ...dist }, pass: i };
      }
    }
    if (!updated) break;
  }

  // Check for negative-weight cycles
  let hasNegCycle = false;
  for (const e of edgeList) {
    if (dist[e.from] !== Infinity && dist[e.from] + e.weight < dist[e.to]) {
      hasNegCycle = true;
      yield { type: 'negCycle', line: 5, activeEdge: e.id, message: 'Negative cycle detected!' };
      break;
    }
  }

  yield { type: 'finish', line: 6, dist, prev, hasNegCycle };
}

/**
 * Floyd-Warshall all-pairs shortest paths generator
 */
export function* floydWarshall(nodes, edges, directed) {
  const n = nodes.length;
  if (n === 0) return;
  const nodeIndex = new Map(nodes.map((node, i) => [node.id, i]));
  const matrix = Array.from({ length: n }, () => new Array(n).fill(Infinity));
  for (let i = 0; i < n; i++) matrix[i][i] = 0;

  for (const e of edges) {
    const u = nodeIndex.get(e.from);
    const v = nodeIndex.get(e.to);
    if (u !== undefined && v !== undefined) {
      matrix[u][v] = Math.min(matrix[u][v], e.weight ?? 1);
      if (!directed) {
        matrix[v][u] = Math.min(matrix[v][u], e.weight ?? 1);
      }
    }
  }

  yield { type: 'initMatrix', line: 1, matrix: matrix.map((row) => [...row]) };

  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (matrix[i][k] !== Infinity && matrix[k][j] !== Infinity) {
          if (matrix[i][k] + matrix[k][j] < matrix[i][j]) {
            matrix[i][j] = matrix[i][k] + matrix[k][j];
            yield {
              type: 'updateMatrix',
              line: 3,
              k,
              i,
              j,
              val: matrix[i][j],
              matrix: matrix.map((row) => [...row]),
            };
          }
        }
      }
    }
  }

  yield { type: 'finish', line: 5, matrix };
}

/**
 * Prim's Minimum Spanning Tree (MST) generator
 */
export function* prim(nodes, edges, directed, startId) {
  if (nodes.length === 0) return;
  const start = startId || nodes[0].id;
  const adj = buildAdjacencyList(nodes, edges, false); // MST is defined on undirected
  const inMST = new Set([start]);
  const mstEdges = [];

  yield { type: 'highlight', line: 1, inMST: Array.from(inMST) };
  while (inMST.size < nodes.length) {
    let minEdge = null;
    let minWeight = Infinity;
    let nextNode = null;

    for (const u of inMST) {
      const neighbors = adj.get(u) || [];
      for (const nb of neighbors) {
        if (!inMST.has(nb.to) && nb.weight < minWeight) {
          minWeight = nb.weight;
          minEdge = nb.edgeId;
          nextNode = nb.to;
        }
      }
    }

    if (!minEdge || !nextNode) break; // Graph disconnected
    inMST.add(nextNode);
    mstEdges.push(minEdge);

    yield {
      type: 'addMstEdge',
      line: 3,
      activeEdge: minEdge,
      activeNode: nextNode,
      mstEdges: [...mstEdges],
      inMST: Array.from(inMST),
    };
  }

  yield { type: 'finish', line: 5, mstEdges, inMST: Array.from(inMST) };
}

/**
 * Kruskal's Minimum Spanning Tree (MST) with Union-Find generator
 */
export function* kruskal(nodes, edges) {
  if (nodes.length === 0) return;
  const parent = new Map();
  for (const n of nodes) parent.set(n.id, n.id);

  function find(i) {
    if (parent.get(i) === i) return i;
    const r = find(parent.get(i));
    parent.set(i, r);
    return r;
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

  const sortedEdges = [...edges].sort((a, b) => (a.weight ?? 1) - (b.weight ?? 1));
  const mstEdges = [];

  yield { type: 'highlight', line: 1 };
  for (const e of sortedEdges) {
    yield { type: 'inspect', line: 2, activeEdge: e.id };
    if (union(e.from, e.to)) {
      mstEdges.push(e.id);
      yield { type: 'addMstEdge', line: 3, activeEdge: e.id, mstEdges: [...mstEdges] };
    }
  }

  yield { type: 'finish', line: 5, mstEdges };
}

/**
 * Topological Sort generator (Kahn's algorithm)
 */
export function* topologicalSort(nodes, edges) {
  const inDegree = new Map();
  for (const n of nodes) inDegree.set(n.id, 0);
  for (const e of edges) {
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const order = [];
  yield { type: 'highlight', line: 1, queue: [...queue] };

  const adj = buildAdjacencyList(nodes, edges, true);
  while (queue.length > 0) {
    const u = queue.shift();
    if (!u) break;
    order.push(u);
    yield { type: 'visit', line: 3, activeNode: u, order: [...order] };

    const neighbors = adj.get(u) || [];
    for (const nb of neighbors) {
      const curDeg = (inDegree.get(nb.to) || 1) - 1;
      inDegree.set(nb.to, curDeg);
      if (curDeg === 0) {
        queue.push(nb.to);
        yield { type: 'zeroDegree', line: 4, activeNode: nb.to, queue: [...queue] };
      }
    }
  }

  const hasCycle = order.length !== nodes.length;
  yield { type: 'finish', line: 5, order, hasCycle };
}

/**
 * Tarjan's Strongly Connected Components (SCC) generator
 */
export function* tarjanScc(nodes, edges, directed = true) {
  const adj = buildAdjacencyList(nodes, edges, directed);
  const indices = new Map();
  const lowlinks = new Map();
  const onStack = new Set();
  const stack = [];
  let index = 0;
  const sccs = [];

  yield { type: 'highlight', line: 1 };

  function* strongConnect(u) {
    indices.set(u, index);
    lowlinks.set(u, index);
    index++;
    stack.push(u);
    onStack.add(u);

    yield { type: 'visit', line: 2, activeNode: u, lowlink: lowlinks.get(u) };

    const neighbors = adj.get(u) || [];
    for (const nb of neighbors) {
      if (!indices.has(nb.to)) {
        yield* strongConnect(nb.to);
        lowlinks.set(u, Math.min(lowlinks.get(u), lowlinks.get(nb.to)));
      } else if (onStack.has(nb.to)) {
        lowlinks.set(u, Math.min(lowlinks.get(u), indices.get(nb.to)));
      }
    }

    if (lowlinks.get(u) === indices.get(u)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        if (w) {
          onStack.delete(w);
          scc.push(w);
        }
      } while (w !== u);
      sccs.push(scc);
      yield { type: 'sccFound', line: 4, scc, sccs: [...sccs] };
    }
  }

  for (const n of nodes) {
    if (!indices.has(n.id)) {
      yield* strongConnect(n.id);
    }
  }

  yield { type: 'finish', line: 5, sccs };
}

/**
 * Bipartite Check (2-coloring) generator
 */
export function* bipartiteCheck(nodes, edges, directed = false) {
  const adj = buildAdjacencyList(nodes, edges, directed);
  const colors = new Map();
  let isBipartite = true;

  yield { type: 'highlight', line: 1 };
  for (const n of nodes) {
    if (!colors.has(n.id)) {
      colors.set(n.id, 0);
      const queue = [n.id];
      yield { type: 'color', line: 2, activeNode: n.id, color: 0, colors: Object.fromEntries(colors) };

      while (queue.length > 0) {
        const u = queue.shift();
        if (!u) break;
        const uColor = colors.get(u);
        const nextColor = 1 - uColor;

        const neighbors = adj.get(u) || [];
        for (const nb of neighbors) {
          if (!colors.has(nb.to)) {
            colors.set(nb.to, nextColor);
            queue.push(nb.to);
            yield {
              type: 'color',
              line: 3,
              activeNode: nb.to,
              color: nextColor,
              colors: Object.fromEntries(colors),
            };
          } else if (colors.get(nb.to) === uColor) {
            isBipartite = false;
            yield {
              type: 'conflict',
              line: 4,
              activeEdge: nb.edgeId,
              message: 'Color conflict found! Not bipartite.',
            };
            break;
          }
        }
        if (!isBipartite) break;
      }
    }
    if (!isBipartite) break;
  }

  yield { type: 'finish', line: 5, isBipartite, colors: Object.fromEntries(colors) };
}

/**
 * Cycle Detection generator (directed & undirected)
 */
export function* cycleDetection(nodes, edges, directed = false) {
  const adj = buildAdjacencyList(nodes, edges, directed);
  let hasCycle = false;
  const cycleEdges = [];

  yield { type: 'highlight', line: 1 };
  if (directed) {
    const visited = new Set();
    const recStack = new Set();

    function* dfsCycle(u) {
      visited.add(u);
      recStack.add(u);
      yield { type: 'visit', line: 2, activeNode: u };

      const neighbors = adj.get(u) || [];
      for (const nb of neighbors) {
        if (!visited.has(nb.to)) {
          yield* dfsCycle(nb.to);
          if (hasCycle) return;
        } else if (recStack.has(nb.to)) {
          hasCycle = true;
          cycleEdges.push(nb.edgeId);
          yield { type: 'cycleFound', line: 4, activeEdge: nb.edgeId };
          return;
        }
      }
      recStack.delete(u);
    }

    for (const n of nodes) {
      if (!visited.has(n.id)) {
        yield* dfsCycle(n.id);
        if (hasCycle) break;
      }
    }
  } else {
    const visited = new Set();
    function* dfsCycleUndirected(u, parent) {
      visited.add(u);
      yield { type: 'visit', line: 2, activeNode: u };

      const neighbors = adj.get(u) || [];
      for (const nb of neighbors) {
        if (!visited.has(nb.to)) {
          yield* dfsCycleUndirected(nb.to, u);
          if (hasCycle) return;
        } else if (nb.to !== parent) {
          hasCycle = true;
          cycleEdges.push(nb.edgeId);
          yield { type: 'cycleFound', line: 4, activeEdge: nb.edgeId };
          return;
        }
      }
    }

    for (const n of nodes) {
      if (!visited.has(n.id)) {
        yield* dfsCycleUndirected(n.id, null);
        if (hasCycle) break;
      }
    }
  }

  yield { type: 'finish', line: 5, hasCycle, cycleEdges };
}

/**
 * Edmonds-Karp Max Flow generator
 */
export function* maxFlow(nodes, edges, sourceId, sinkId) {
  if (nodes.length < 2) return;
  const s = sourceId || nodes[0].id;
  const t = sinkId || nodes[nodes.length - 1].id;

  // Capacity matrix
  const cap = new Map();
  for (const e of edges) {
    cap.set(`${e.from},${e.to}`, (cap.get(`${e.from},${e.to}`) || 0) + (e.weight || 1));
    if (!cap.has(`${e.to},${e.from}`)) cap.set(`${e.to},${e.from}`, 0);
  }

  let totalFlow = 0;
  yield { type: 'highlight', line: 1, flow: 0 };

  while (true) {
    // Find augmenting path with BFS
    const parent = new Map();
    const queue = [s];
    while (queue.length > 0) {
      const u = queue.shift();
      if (u === t) break;
      for (const n of nodes) {
        const v = n.id;
        const residual = cap.get(`${u},${v}`) || 0;
        if (residual > 0 && !parent.has(v) && v !== s) {
          parent.set(v, u);
          queue.push(v);
        }
      }
    }

    if (!parent.has(t)) break; // No more augmenting paths

    // Find bottleneck capacity
    let pathCap = Infinity;
    let curr = t;
    while (curr !== s) {
      const prev = parent.get(curr);
      pathCap = Math.min(pathCap, cap.get(`${prev},${curr}`) || 0);
      curr = prev;
    }

    // Update residual capacities
    curr = t;
    const path = [];
    while (curr !== s) {
      const prev = parent.get(curr);
      path.unshift(curr);
      cap.set(`${prev},${curr}`, (cap.get(`${prev},${curr}`) || 0) - pathCap);
      cap.set(`${curr},${prev}`, (cap.get(`${curr},${prev}`) || 0) + pathCap);
      curr = prev;
    }
    path.unshift(s);

    totalFlow += pathCap;
    yield { type: 'augment', line: 3, path, bottleneck: pathCap, flow: totalFlow };
  }

  yield { type: 'finish', line: 5, maxFlow: totalFlow };
}

export const GRAPH_ALGORITHMS = {
  bfs: {
    name: { en: 'Breadth-First Search (BFS)', de: 'Breitensuche (BFS)' },
    pseudocode: {
      en: [
        'queue = [start]; visited = {start}',
        'while queue not empty:',
        '  u = queue.dequeue(); visit(u)',
        '  for neighbor v of u: if not visited: enqueue(v)',
      ],
      de: [
        'Schlange = [Start]; besucht = {Start}',
        'solange Schlange nicht leer:',
        '  u = Schlange.entferne(); besuche(u)',
        '  für jeden Nachbarn v von u: falls unbesucht: anfügen',
      ],
    },
    generator: bfs,
  },
  dfs: {
    name: { en: 'Depth-First Search (DFS)', de: 'Tiefensuche (DFS)' },
    pseudocode: {
      en: [
        'time = 0; visited = {}',
        'dfsVisit(u): d[u] = ++time; visited.add(u)',
        'for neighbor v of u: if not visited: dfsVisit(v)',
        'f[u] = ++time',
      ],
      de: [
        'zeit = 0; besucht = {}',
        'dfsBesuch(u): d[u] = ++zeit; besucht.hinzufügen(u)',
        'für Nachbarn v von u: falls unbesucht: dfsBesuch(v)',
        'f[u] = ++zeit',
      ],
    },
    generator: dfs,
  },
  dijkstra: {
    name: { en: "Dijkstra's Algorithm", de: 'Dijkstra-Algorithmus' },
    pseudocode: {
      en: [
        'dist[start] = 0; pq.push((0, start))',
        'while pq not empty:',
        '  (d, u) = pq.pop()',
        '  for (v, weight) of neighbors:',
        '    if d + weight < dist[v]: relax(u, v)',
      ],
      de: [
        'dist[Start] = 0; pq.einfügen((0, Start))',
        'solange pq nicht leer:',
        '  (d, u) = pq.entferneMin()',
        '  für jeden Nachbarn (v, gewicht):',
        '    wenn d + gewicht < dist[v]: relaxiere(u, v)',
      ],
    },
    generator: dijkstra,
  },
  bellmanFord: {
    name: { en: 'Bellman-Ford Algorithm', de: 'Bellman-Ford-Algorithmus' },
    pseudocode: {
      en: [
        'dist[start] = 0; all other dist = inf',
        'repeat |V|-1 times:',
        '  for each edge (u, v, w): relax(u, v, w)',
        'check for negative cycle:',
        '  if can still relax: negative cycle exists!',
      ],
      de: [
        'dist[Start] = 0; alle anderen dist = unendlich',
        'wiederhole |V|-1 mal:',
        '  für jede Kante (u, v, w): relaxiere(u, v, w)',
        'prüfe auf negativen Zyklus:',
        '  wenn weiter relaxierbar: negativer Zyklus existiert!',
      ],
    },
    generator: bellmanFord,
  },
  floydWarshall: {
    name: { en: 'Floyd-Warshall All-Pairs', de: 'Floyd-Warshall-Algorithmus' },
    pseudocode: {
      en: [
        'D[i][j] = weight(i, j) or inf',
        'for k from 1 to |V|:',
        '  for i from 1 to |V|; for j from 1 to |V|:',
        '    D[i][j] = min(D[i][j], D[i][k] + D[k][j])',
      ],
      de: [
        'D[i][j] = gewicht(i, j) oder unendlich',
        'für k von 1 bis |V|:',
        '  für i von 1 bis |V|; für j von 1 bis |V|:',
        '    D[i][j] = min(D[i][j], D[i][k] + D[k][j])',
      ],
    },
    generator: floydWarshall,
  },
  prim: {
    name: { en: "Prim's MST", de: 'Prim-Algorithmus (MST)' },
    pseudocode: {
      en: [
        'inMST = {start}; mstEdges = []',
        'while inMST.size < |V|:',
        '  find min weight edge (u, v) with u in inMST, v not in inMST',
        '  inMST.add(v); mstEdges.add((u, v))',
      ],
      de: [
        'inMST = {Start}; mstKanten = []',
        'solange |inMST| < |V|:',
        '  finde minimale Kante (u, v) mit u in inMST, v unbesucht',
        '  inMST.hinzufügen(v); mstKanten.hinzufügen((u, v))',
      ],
    },
    generator: prim,
  },
  kruskal: {
    name: { en: "Kruskal's MST", de: 'Kruskal-Algorithmus (MST)' },
    pseudocode: {
      en: [
        'sort all edges by weight ascending',
        'initialize disjoint sets for each node',
        'for each edge (u, v):',
        '  if find(u) != find(v): union(u, v); add to MST',
      ],
      de: [
        'sortiere Kanten aufsteigend nach Gewicht',
        'initialisiere Union-Find Mengen für Knoten',
        'für jede Kante (u, v):',
        '  wenn find(u) != find(v): union(u, v); Kante in MST',
      ],
    },
    generator: kruskal,
  },
  topological: {
    name: { en: 'Topological Sort', de: 'Topologische Sortierung' },
    pseudocode: {
      en: [
        'compute in-degrees for all nodes',
        'queue = nodes with in-degree 0',
        'while queue not empty: pop u, append to order',
        'reduce in-degree of neighbors; if 0: enqueue',
      ],
      de: [
        'berechne Eingangsgrade aller Knoten',
        'Schlange = Knoten mit Eingangsgrad 0',
        'solange Schlange nicht leer: entnimm u, an Reihenfolge anhängen',
        'verringere Eingangsgrad der Nachbarn; falls 0: anfügen',
      ],
    },
    generator: topologicalSort,
  },
  scc: {
    name: { en: "Tarjan's SCC", de: 'Tarjan-Algorithmus (ZHK)' },
    pseudocode: {
      en: [
        'assign discovery index and lowlink',
        'push node to stack',
        'recurse neighbors, update lowlinks',
        'if lowlink == index: pop stack to form SCC',
      ],
      de: [
        'Index und Lowlink-Wert zuweisen',
        'Knoten auf Stapel legen',
        'Nachbarn rekursiv besuchen, Lowlinks anpassen',
        'wenn Lowlink == Index: Stapel abräumen zu ZHK',
      ],
    },
    generator: tarjanScc,
  },
  bipartite: {
    name: { en: 'Bipartite Check (2-Color)', de: 'Bipartitionsprüfung (2-Färbung)' },
    pseudocode: {
      en: [
        'color start node with 0',
        'BFS/DFS traversal to color neighbors with 1 - color',
        'if neighbor has same color: not bipartite!',
      ],
      de: [
        'färbe Startknoten mit 0',
        'BFS/DFS Traversierung: Nachbarn mit 1 - Farbe färben',
        'wenn Nachbar gleiche Farbe hat: nicht bipartit!',
      ],
    },
    generator: bipartiteCheck,
  },
  cycle: {
    name: { en: 'Cycle Detection', de: 'Zykluserkennung' },
    pseudocode: {
      en: ['DFS traversal maintaining recursion stack', 'if reach node currently in recursion stack: cycle!'],
      de: ['DFS-Traversierung mit Rekursionsstapel', 'wenn Knoten im aktuellen Rekursionsstapel erreicht: Zyklus!'],
    },
    generator: cycleDetection,
  },
  maxFlow: {
    name: { en: 'Max Flow (Edmonds-Karp)', de: 'Maximaler Fluss (Edmonds-Karp)' },
    pseudocode: {
      en: [
        'initialize residual capacity = edge capacity',
        'while BFS finds augmenting path from s to t:',
        '  bottleneck = min residual capacity along path',
        '  augment flow by bottleneck along path',
      ],
      de: [
        'initialisiere Residualkapazität = Kantengewicht',
        'solange BFS augmentierenden Pfad von s nach t findet:',
        '  Flaschenhals = minimale Restkapazität auf Pfad',
        '  Fluss um Flaschenhals entlang Pfad erhöhen',
      ],
    },
    generator: maxFlow,
  },
};
