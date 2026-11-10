// @ts-check

/**
 * Example preset graphs
 */
export const GRAPH_PRESETS = {
  k5: {
    name: { en: 'Complete Graph K₅', de: 'Vollständiger Graph K₅' },
    directed: false,
    nodes: [
      { id: '1', label: '1', x: 300, y: 70 },
      { id: '2', label: '2', x: 440, y: 170 },
      { id: '3', label: '3', x: 390, y: 320 },
      { id: '4', label: '4', x: 210, y: 320 },
      { id: '5', label: '5', x: 160, y: 170 },
    ],
    edges: [
      { id: 'e1', from: '1', to: '2', weight: 4 },
      { id: 'e2', from: '1', to: '3', weight: 2 },
      { id: 'e3', from: '1', to: '4', weight: 5 },
      { id: 'e4', from: '1', to: '5', weight: 3 },
      { id: 'e5', from: '2', to: '3', weight: 1 },
      { id: 'e6', from: '2', to: '4', weight: 6 },
      { id: 'e7', from: '2', to: '5', weight: 2 },
      { id: 'e8', from: '3', to: '4', weight: 4 },
      { id: 'e9', from: '3', to: '5', weight: 5 },
      { id: 'e10', from: '4', to: '5', weight: 1 },
    ],
  },
  petersen: {
    name: { en: 'Petersen Graph', de: 'Petersen-Graph' },
    directed: false,
    nodes: [
      // Outer 5
      { id: '0', label: '0', x: 300, y: 60 },
      { id: '1', label: '1', x: 470, y: 180 },
      { id: '2', label: '2', x: 400, y: 350 },
      { id: '3', label: '3', x: 200, y: 350 },
      { id: '4', label: '4', x: 130, y: 180 },
      // Inner 5
      { id: '5', label: '5', x: 300, y: 150 },
      { id: '6', label: '6', x: 380, y: 210 },
      { id: '7', label: '7', x: 350, y: 290 },
      { id: '8', label: '8', x: 250, y: 290 },
      { id: '9', label: '9', x: 220, y: 210 },
    ],
    edges: [
      { id: 'e1', from: '0', to: '1', weight: 1 },
      { id: 'e2', from: '1', to: '2', weight: 1 },
      { id: 'e3', from: '2', to: '3', weight: 1 },
      { id: 'e4', from: '3', to: '4', weight: 1 },
      { id: 'e5', from: '4', to: '0', weight: 1 },
      { id: 'e6', from: '0', to: '5', weight: 1 },
      { id: 'e7', from: '1', to: '6', weight: 1 },
      { id: 'e8', from: '2', to: '7', weight: 1 },
      { id: 'e9', from: '3', to: '8', weight: 1 },
      { id: 'e10', from: '4', to: '9', weight: 1 },
      { id: 'e11', from: '5', to: '7', weight: 1 },
      { id: 'e12', from: '7', to: '9', weight: 1 },
      { id: 'e13', from: '9', to: '6', weight: 1 },
      { id: 'e14', from: '6', to: '8', weight: 1 },
      { id: 'e15', from: '8', to: '5', weight: 1 },
    ],
  },
  bipartite: {
    name: { en: 'Bipartite Graph K₃,₃', de: 'Bipartiter Graph K₃,₃' },
    directed: false,
    nodes: [
      { id: 'A1', label: 'A1', x: 200, y: 100 },
      { id: 'A2', label: 'A2', x: 200, y: 200 },
      { id: 'A3', label: 'A3', x: 200, y: 300 },
      { id: 'B1', label: 'B1', x: 420, y: 100 },
      { id: 'B2', label: 'B2', x: 420, y: 200 },
      { id: 'B3', label: 'B3', x: 420, y: 300 },
    ],
    edges: [
      { id: 'e1', from: 'A1', to: 'B1', weight: 2 },
      { id: 'e2', from: 'A1', to: 'B2', weight: 4 },
      { id: 'e3', from: 'A1', to: 'B3', weight: 1 },
      { id: 'e4', from: 'A2', to: 'B1', weight: 3 },
      { id: 'e5', from: 'A2', to: 'B2', weight: 5 },
      { id: 'e6', from: 'A2', to: 'B3', weight: 2 },
      { id: 'e7', from: 'A3', to: 'B1', weight: 4 },
      { id: 'e8', from: 'A3', to: 'B2', weight: 1 },
      { id: 'e9', from: 'A3', to: 'B3', weight: 3 },
    ],
  },
  dag: {
    name: { en: 'DAG (Topological)', de: 'DAG (Topologisch)' },
    directed: true,
    nodes: [
      { id: 'A', label: 'A', x: 150, y: 120 },
      { id: 'B', label: 'B', x: 150, y: 280 },
      { id: 'C', label: 'C', x: 300, y: 120 },
      { id: 'D', label: 'D', x: 300, y: 280 },
      { id: 'E', label: 'E', x: 450, y: 200 },
    ],
    edges: [
      { id: 'e1', from: 'A', to: 'C', weight: 3 },
      { id: 'e2', from: 'A', to: 'D', weight: 2 },
      { id: 'e3', from: 'B', to: 'D', weight: 4 },
      { id: 'e4', from: 'C', to: 'E', weight: 1 },
      { id: 'e5', from: 'D', to: 'E', weight: 5 },
    ],
  },
  negative: {
    name: { en: 'Negative Cycle Example', de: 'Negativer Zyklus Beispiel' },
    directed: true,
    nodes: [
      { id: '1', label: '1', x: 180, y: 160 },
      { id: '2', label: '2', x: 320, y: 100 },
      { id: '3', label: '3', x: 440, y: 220 },
      { id: '4', label: '4', x: 280, y: 300 },
    ],
    edges: [
      { id: 'e1', from: '1', to: '2', weight: 1 },
      { id: 'e2', from: '2', to: '3', weight: -3 },
      { id: 'e3', from: '3', to: '4', weight: 1 },
      { id: 'e4', from: '4', to: '2', weight: 1 }, // Cycle 2->3->4->2 total weight = -3+1+1 = -1
    ],
  },
};
