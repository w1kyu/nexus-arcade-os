// @ts-check

/**
 * Exports graph to Graphviz DOT format.
 * @param {import('./algorithms').GraphNode[]} nodes
 * @param {import('./algorithms').GraphEdge[]} edges
 * @param {boolean} directed
 */
export function exportToDot(nodes, edges, directed = false) {
  const op = directed ? '->' : '--';
  const type = directed ? 'digraph' : 'graph';
  const lines = [`${type} G {`];
  for (const n of nodes) {
    lines.push(`  "${n.id}" [label="${n.label || n.id}"];`);
  }
  for (const e of edges) {
    const weightAttr = e.weight !== undefined ? ` [weight=${e.weight}, label="${e.weight}"]` : '';
    lines.push(`  "${e.from}" ${op} "${e.to}"${weightAttr};`);
  }
  lines.push('}');
  return lines.join('\n');
}

/**
 * Parses simple Graphviz DOT format string.
 * @param {string} dotStr
 */
export function parseDot(dotStr) {
  const directed = /^\s*digraph/i.test(dotStr);
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  const edgeRegex = /"([^"]+)"\s*(?:->|--)\s*"([^"]+)"(?:\s*\[([^\]]*)\])?/g;
  let match;
  let edgeId = 1;

  while ((match = edgeRegex.exec(dotStr)) !== null) {
    const from = match[1];
    const to = match[2];
    const attrs = match[3] || '';
    let weight = 1;
    const wMatch = attrs.match(/(?:weight|label)\s*=\s*"?(-?\d+(?:\.\d+)?)"?/);
    if (wMatch) weight = Number(wMatch[1]);

    if (!nodeMap.has(from)) {
      const n = { id: from, label: from, x: 100 + nodes.length * 40, y: 100 + (nodes.length % 5) * 40 };
      nodes.push(n);
      nodeMap.set(from, n);
    }
    if (!nodeMap.has(to)) {
      const n = { id: to, label: to, x: 100 + nodes.length * 40, y: 100 + (nodes.length % 5) * 40 };
      nodes.push(n);
      nodeMap.set(to, n);
    }

    edges.push({ id: `e${edgeId++}`, from, to, weight });
  }

  return { nodes, edges, directed };
}

/**
 * Exports graph as an Adjacency List string.
 */
export function exportToAdjacencyList(nodes, edges, directed = false) {
  const lines = [];
  for (const n of nodes) {
    const neighbors = [];
    for (const e of edges) {
      if (e.from === n.id) neighbors.push(`${e.to}(${e.weight ?? 1})`);
      else if (!directed && e.to === n.id) neighbors.push(`${e.from}(${e.weight ?? 1})`);
    }
    lines.push(`${n.label || n.id}: ${neighbors.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * Exports graph as an Adjacency Matrix string.
 */
export function exportToAdjacencyMatrix(nodes, edges, directed = false) {
  const labels = nodes.map((n) => n.label || n.id);
  const matrix = Array.from({ length: nodes.length }, () => new Array(nodes.length).fill(0));
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));

  for (const e of edges) {
    const u = nodeIndex.get(e.from);
    const v = nodeIndex.get(e.to);
    if (u !== undefined && v !== undefined) {
      matrix[u][v] = e.weight ?? 1;
      if (!directed) matrix[v][u] = e.weight ?? 1;
    }
  }

  const header = [' ', ...labels].map((s) => s.padEnd(5)).join(' ');
  const rows = matrix.map((row, i) => {
    return [labels[i].padEnd(5), ...row.map((val) => String(val).padEnd(5))].join(' ');
  });
  return [header, ...rows].join('\n');
}

/**
 * Computes force-directed layout positions.
 * @param {import('./algorithms').GraphNode[]} nodes
 * @param {import('./algorithms').GraphEdge[]} edges
 * @param {number} width
 * @param {number} height
 * @param {number} iterations
 */
export function applyForceDirectedLayout(nodes, edges, width = 600, height = 400, iterations = 80) {
  if (nodes.length <= 1) return;
  const k = Math.sqrt((width * height) / nodes.length) * 0.75;
  const positions = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, dx: 0, dy: 0 }]));

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsive forces between all nodes
    for (let i = 0; i < nodes.length; i++) {
      const u = nodes[i].id;
      const posU = positions.get(u);
      if (!posU) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        const v = nodes[j].id;
        const posV = positions.get(v);
        if (!posV) continue;

        const dx = posU.x - posV.x || (Math.random() - 0.5) * 2;
        const dy = posU.y - posV.y || (Math.random() - 0.5) * 2;
        const dist = Math.hypot(dx, dy) || 1;
        const force = (k * k) / dist;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        posU.dx += fx;
        posU.dy += fy;
        posV.dx -= fx;
        posV.dy -= fy;
      }
    }

    // Attractive forces along edges
    for (const e of edges) {
      const posU = positions.get(e.from);
      const posV = positions.get(e.to);
      if (!posU || !posV) continue;

      const dx = posU.x - posV.x;
      const dy = posU.y - posV.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = (dist * dist) / k;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      posU.dx -= fx;
      posU.dy -= fy;
      posV.dx += fx;
      posV.dy += fy;
    }

    // Update positions with damping
    const temp = Math.max(1, (1 - iter / iterations) * 25);
    for (const n of nodes) {
      const p = positions.get(n.id);
      if (!p) continue;
      const d = Math.hypot(p.dx, p.dy) || 1;
      p.x += (p.dx / d) * Math.min(d, temp);
      p.y += (p.dy / d) * Math.min(d, temp);
      p.x = Math.max(40, Math.min(width - 40, p.x));
      p.y = Math.max(40, Math.min(height - 40, p.y));
      p.dx = 0;
      p.dy = 0;
    }
  }

  for (const n of nodes) {
    const p = positions.get(n.id);
    if (p) {
      n.x = p.x;
      n.y = p.y;
    }
  }
}

/**
 * Applies circular layout.
 */
export function applyCircularLayout(nodes, width = 600, height = 400) {
  const n = nodes.length;
  if (n === 0) return;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(cx, cy) - 50;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    nodes[i].x = cx + r * Math.cos(angle);
    nodes[i].y = cy + r * Math.sin(angle);
  }
}

/**
 * Applies grid layout.
 */
export function applyGridLayout(nodes, width = 600, height = 400) {
  const n = nodes.length;
  if (n === 0) return;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const padX = width / (cols + 1);
  const padY = height / (rows + 1);

  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    nodes[i].x = (c + 1) * padX;
    nodes[i].y = (r + 1) * padY;
  }
}
