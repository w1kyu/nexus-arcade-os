// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  GRAPH_ALGORITHMS,
  bellmanFord,
  bfs,
  bipartiteCheck,
  cycleDetection,
  dfs,
  dijkstra,
  floydWarshall,
  kruskal,
  maxFlow,
  prim,
  tarjanScc,
  topologicalSort,
} from '../../src/apps/graphlab/algorithms.js';
import {
  exportToAdjacencyList,
  exportToAdjacencyMatrix,
  exportToDot,
  parseDot,
} from '../../src/apps/graphlab/formats.js';
import { GRAPH_PRESETS } from '../../src/apps/graphlab/presets.js';

describe('Graph Algorithms & Formats', () => {
  const k5 = GRAPH_PRESETS.k5;
  const dag = GRAPH_PRESETS.dag;
  const bipartite = GRAPH_PRESETS.bipartite;
  const negPreset = GRAPH_PRESETS.negative;

  function runGen(gen) {
    let step = gen.next();
    let last = null;
    let count = 0;
    while (!step.done && count < 2000) {
      last = step.value;
      step = gen.next();
      count++;
    }
    return last;
  }

  it('runs BFS and DFS on K5', () => {
    const bfsRes = runGen(bfs(k5.nodes, k5.edges, false, '1'));
    expect(bfsRes).not.toBeNull();
    expect(bfsRes.visited.length).toBe(5);

    const dfsRes = runGen(dfs(k5.nodes, k5.edges, false, '1'));
    expect(dfsRes).not.toBeNull();
    expect(Object.keys(dfsRes.d).length).toBe(5);
    expect(Object.keys(dfsRes.f).length).toBe(5);
  });

  it('runs Dijkstra and Bellman-Ford shortest paths', () => {
    const dijRes = runGen(dijkstra(k5.nodes, k5.edges, false, '1'));
    expect(dijRes.dist['1']).toBe(0);
    expect(dijRes.dist['2']).toBeGreaterThan(0);

    const bfRes = runGen(bellmanFord(k5.nodes, k5.edges, false, '1'));
    expect(bfRes.dist['1']).toBe(0);
    expect(bfRes.hasNegCycle).toBe(false);

    // Negative cycle detection
    const negRes = runGen(bellmanFord(negPreset.nodes, negPreset.edges, true, '1'));
    expect(negRes.hasNegCycle).toBe(true);
  });

  it('runs Floyd-Warshall all-pairs shortest paths', () => {
    const fwRes = runGen(floydWarshall(dag.nodes, dag.edges, true));
    expect(fwRes.matrix.length).toBe(5);
    // Distance from A to itself is 0
    expect(fwRes.matrix[0][0]).toBe(0);
    // Distance from A (idx 0) to E (idx 4): A->C->E = 3+1 = 4, A->D->E = 2+5 = 7 => min is 4
    expect(fwRes.matrix[0][4]).toBe(4);
  });

  it('runs Prim and Kruskal MST', () => {
    const primRes = runGen(prim(k5.nodes, k5.edges, false, '1'));
    expect(primRes.mstEdges.length).toBe(4); // |V| - 1 = 4

    const kruskalRes = runGen(kruskal(k5.nodes, k5.edges));
    expect(kruskalRes.mstEdges.length).toBe(4);
  });

  it('runs Topological Sort on DAG', () => {
    const topRes = runGen(topologicalSort(dag.nodes, dag.edges));
    expect(topRes.hasCycle).toBe(false);
    expect(topRes.order.length).toBe(5);
    // A and B must come before C, D, E
    expect(topRes.order.indexOf('E')).toBe(4);
  });

  it('checks Bipartition on K3,3', () => {
    const bipRes = runGen(bipartiteCheck(bipartite.nodes, bipartite.edges, false));
    expect(bipRes.isBipartite).toBe(true);

    // K5 is odd cycle / clique, not bipartite
    const k5Res = runGen(bipartiteCheck(k5.nodes, k5.edges, false));
    expect(k5Res.isBipartite).toBe(false);
  });

  it('detects cycles in graphs', () => {
    const cycleRes = runGen(cycleDetection(k5.nodes, k5.edges, false));
    expect(cycleRes.hasCycle).toBe(true);

    const dagCycleRes = runGen(cycleDetection(dag.nodes, dag.edges, true));
    expect(dagCycleRes.hasCycle).toBe(false);
  });

  it('computes Tarjan SCC', () => {
    const sccRes = runGen(tarjanScc(dag.nodes, dag.edges, true));
    // In a DAG, every node is its own SCC (5 SCCs)
    expect(sccRes.sccs.length).toBe(5);
  });

  it('computes Edmonds-Karp Max Flow', () => {
    const flowRes = runGen(maxFlow(dag.nodes, dag.edges, 'A', 'E'));
    // Flow from A: cap(A->C)=3, cap(A->D)=2. cap(C->E)=1, cap(D->E)=5 => max flow = min(3,1) + min(2,5) = 1 + 2 = 3
    expect(flowRes.maxFlow).toBe(3);
  });

  it('exports and parses DOT and matrices correctly', () => {
    const dot = exportToDot(k5.nodes, k5.edges, false);
    expect(dot).toContain('graph G {');
    expect(dot).toContain('"1" -- "2"');

    const parsed = parseDot(dot);
    expect(parsed.nodes.length).toBe(5);
    expect(parsed.edges.length).toBe(10);

    const adjList = exportToAdjacencyList(k5.nodes, k5.edges, false);
    expect(adjList).toContain('1:');

    const matrix = exportToAdjacencyMatrix(k5.nodes, k5.edges, false);
    expect(matrix).toContain('1');
  });

  it('has complete metadata for all graph algorithms', () => {
    for (const [, meta] of Object.entries(GRAPH_ALGORITHMS)) {
      expect(meta.name.en).toBeTruthy();
      expect(meta.name.de).toBeTruthy();
      expect(meta.pseudocode.en.length).toBeGreaterThan(0);
      expect(meta.pseudocode.de.length).toBeGreaterThan(0);
    }
  });
});
