// @ts-check
import { h, icon } from '../../ui/dom.js';
import {
  VisualizerEngine,
  exportPng,
  exportSvg,
  loadStateFromVfs,
  renderPseudocodePanel,
  renderVisualizerControls,
  saveStateToVfs,
} from '../../ui/visualizer/engine.js';
import { GRAPH_ALGORITHMS } from './algorithms.js';
import {
  applyCircularLayout,
  applyForceDirectedLayout,
  applyGridLayout,
  exportToAdjacencyMatrix,
  exportToDot,
  parseDot,
} from './formats.js';
import { GRAPH_PRESETS } from './presets.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  // Initialize with K5 preset
  const defaultPreset = GRAPH_PRESETS.k5;
  /** @type {import('./algorithms').GraphNode[]} */
  let nodes = defaultPreset.nodes.map((n) => ({ ...n }));
  /** @type {import('./algorithms').GraphEdge[]} */
  let edges = defaultPreset.edges.map((e) => ({ ...e }));
  let isDirected = defaultPreset.directed;
  let currentAlgoKey = 'bfs';
  let activeTool = 'select'; // 'select' | 'addNode' | 'addEdge' | 'delete'
  let startNodeId = nodes[0]?.id || '';

  // Algorithm visualization state
  let activeNodeId = null;
  let activeEdgeId = null;
  /** @type {Set<string>} */
  let visitedNodeIds = new Set();
  /** @type {Set<string>} */
  let mstEdgeIds = new Set();
  /** @type {Record<string, number>} */
  let nodeColors = {};
  let algorithmStatus = 'idle';
  let algorithmResult = '';
  /** @type {number[][] | null} */
  let floydMatrix = null;

  const engine = new VisualizerEngine({
    defaultSpeed: 250,
    getSnapshot: () => ({
      activeNode: activeNodeId,
      activeEdge: activeEdgeId,
      visited: Array.from(visitedNodeIds),
      mst: Array.from(mstEdgeIds),
      colors: { ...nodeColors },
      status: algorithmStatus,
      result: algorithmResult,
      matrix: floydMatrix ? floydMatrix.map((r) => [...r]) : null,
    }),
    restoreSnapshot: (snap) => {
      activeNodeId = snap.activeNode;
      activeEdgeId = snap.activeEdge;
      visitedNodeIds = new Set(snap.visited);
      mstEdgeIds = new Set(snap.mst);
      nodeColors = { ...snap.colors };
      algorithmStatus = snap.status;
      algorithmResult = snap.result;
      floydMatrix = snap.matrix ? snap.matrix.map((r) => [...r]) : null;
      updateInfo();
      renderSvg();
    },
    onStep: (step) => {
      activeNodeId = step.activeNode || null;
      activeEdgeId = step.activeEdge || null;
      algorithmStatus = 'running';

      if (step.type === 'visit' || step.type === 'discover') {
        if (step.activeNode) visitedNodeIds.add(step.activeNode);
      } else if (step.type === 'addMstEdge') {
        if (step.activeEdge) mstEdgeIds.add(step.activeEdge);
      } else if (step.type === 'color') {
        nodeColors = step.colors || nodeColors;
      } else if (step.type === 'updateMatrix' || step.type === 'initMatrix') {
        floydMatrix = step.matrix;
      } else if (step.type === 'finish') {
        algorithmStatus = 'finished';
        if (step.hasCycle !== undefined) {
          algorithmResult = step.hasCycle ? 'Cycle detected!' : 'No cycle.';
        } else if (step.isBipartite !== undefined) {
          algorithmResult = step.isBipartite ? 'Graph is bipartite.' : 'Graph is NOT bipartite.';
        } else if (step.order) {
          algorithmResult = `Topological: ${step.order.join(' → ')}`;
        } else if (step.maxFlow !== undefined) {
          algorithmResult = `Max Flow: ${step.maxFlow}`;
        }
      }

      updateInfo();
      pseudoPanel.update();
      renderSvg();
    },
    onReset: () => {
      clearAlgorithmState();
      updateInfo();
      pseudoPanel.update();
      renderSvg();
    },
  });

  function clearAlgorithmState() {
    activeNodeId = null;
    activeEdgeId = null;
    visitedNodeIds.clear();
    mstEdgeIds.clear();
    nodeColors = {};
    algorithmStatus = 'idle';
    algorithmResult = '';
    floydMatrix = null;
  }

  // UI Structure
  const root = h('div', { class: 'nx-graphlab-app' });
  const header = h('div', { class: 'nx-graphlab-header' });
  const controlsRow = h('div', { class: 'nx-graphlab-controls-row' });

  // Algo select
  const algoSelect = h('select', { class: 'nx-input small' }, [
    ...Object.entries(GRAPH_ALGORITHMS).map(([k, meta]) =>
      h(
        'option',
        { value: k, selected: k === currentAlgoKey },
        meta.name[ctx.i18n.currentLocale === 'de' ? 'de' : 'en'] || meta.name.en,
      ),
    ),
  ]);
  algoSelect.addEventListener('change', () => {
    currentAlgoKey = algoSelect.value;
    resetAlgorithm();
  });

  // Start Node select
  const startSelect = h('select', { class: 'nx-input small', title: t('info.startNode') });
  function updateStartSelect() {
    startSelect.innerHTML = '';
    for (const n of nodes) {
      startSelect.append(h('option', { value: n.id, selected: n.id === startNodeId }, n.label || n.id));
    }
  }
  startSelect.addEventListener('change', () => {
    startNodeId = startSelect.value;
    resetAlgorithm();
  });

  // Preset select
  const presetSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: '', disabled: true, selected: true }, t('controls.preset')),
    ...Object.entries(GRAPH_PRESETS).map(([k, p]) =>
      h('option', { value: k }, p.name[ctx.i18n.currentLocale === 'de' ? 'de' : 'en'] || p.name.en),
    ),
  ]);
  presetSelect.addEventListener('change', () => {
    const p = GRAPH_PRESETS[presetSelect.value];
    if (p) {
      nodes = p.nodes.map((n) => ({ ...n }));
      edges = p.edges.map((e) => ({ ...e }));
      isDirected = p.directed;
      directedBtn.classList.toggle('primary', isDirected);
      startNodeId = nodes[0]?.id || '';
      updateStartSelect();
      resetAlgorithm();
    }
    presetSelect.selectedIndex = 0;
  });

  // Layout select
  const layoutSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: '', disabled: true, selected: true }, t('controls.layout')),
    h('option', { value: 'force' }, t('controls.force')),
    h('option', { value: 'circular' }, t('controls.circular')),
    h('option', { value: 'grid' }, t('controls.grid')),
  ]);
  layoutSelect.addEventListener('change', () => {
    const val = layoutSelect.value;
    const rect = canvasWrap.getBoundingClientRect();
    const w = rect.width || 600;
    const h = rect.height || 400;

    if (val === 'force') applyForceDirectedLayout(nodes, edges, w, h);
    else if (val === 'circular') applyCircularLayout(nodes, w, h);
    else if (val === 'grid') applyGridLayout(nodes, w, h);

    layoutSelect.selectedIndex = 0;
    renderSvg();
  });

  // Directed toggle
  const directedBtn = h(
    'button',
    { class: `nx-cs-btn${isDirected ? ' primary' : ''}`, title: t('controls.directed') },
    h('span', {}, t('controls.directed')),
  );
  directedBtn.addEventListener('click', () => {
    isDirected = !isDirected;
    directedBtn.classList.toggle('primary', isDirected);
    resetAlgorithm();
  });

  // Tool Mode Select
  const toolSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: 'select', selected: true }, t('controls.select')),
    h('option', { value: 'addNode' }, t('controls.addNode')),
    h('option', { value: 'addEdge' }, t('controls.addEdge')),
    h('option', { value: 'delete' }, t('controls.delete')),
  ]);
  toolSelect.addEventListener('change', () => {
    activeTool = toolSelect.value;
    edgeSourceNodeId = null;
  });

  // Clear button
  const clearBtn = h('button', { class: 'nx-cs-btn', title: t('controls.clear') }, icon('trash', { size: 14 }));
  clearBtn.addEventListener('click', () => {
    nodes = [];
    edges = [];
    updateStartSelect();
    resetAlgorithm();
  });

  // Import / Export
  const importExportBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('controls.importExport') },
    icon('file-text', { size: 14 }),
    h('span', {}, t('controls.importExport')),
  );
  importExportBtn.addEventListener('click', () => {
    const choice = prompt('Choose action: "dot" (export DOT), "matrix" (export Matrix), "import" (import DOT):', 'dot');
    if (choice === 'dot') {
      alert(exportToDot(nodes, edges, isDirected));
    } else if (choice === 'matrix') {
      alert(exportToAdjacencyMatrix(nodes, edges, isDirected));
    } else if (choice === 'import') {
      const code = prompt('Paste Graphviz DOT string:');
      if (code) {
        const parsed = parseDot(code);
        nodes = parsed.nodes;
        edges = parsed.edges;
        isDirected = parsed.directed;
        directedBtn.classList.toggle('primary', isDirected);
        updateStartSelect();
        resetAlgorithm();
      }
    }
  });

  // Save / Load
  const saveBtn = h('button', { class: 'nx-cs-btn', title: t('controls.save') }, icon('download', { size: 14 }));
  saveBtn.addEventListener('click', async () => {
    const filename = `graph_${Date.now()}.csstate`;
    await saveStateToVfs(ctx.fs, `/home/documents/${filename}`, { nodes, edges, isDirected });
    ctx.notify({ title: t('app.title'), message: `Saved ${filename}` });
  });

  const loadBtn = h('button', { class: 'nx-cs-btn', title: t('controls.load') }, icon('folder-open', { size: 14 }));
  loadBtn.addEventListener('click', async () => {
    const path = prompt('Enter VFS file path:', '/home/documents/graph_state.csstate');
    if (!path) return;
    try {
      const data = await loadStateFromVfs(ctx.fs, path);
      if (data && data.nodes) {
        nodes = data.nodes;
        edges = data.edges || [];
        isDirected = data.isDirected || false;
        directedBtn.classList.toggle('primary', isDirected);
        updateStartSelect();
        resetAlgorithm();
      }
    } catch (err) {
      alert(`Load failed: ${err}`);
    }
  });

  const exportPngBtn = h(
    'button',
    { class: 'nx-cs-btn', title: t('controls.exportPng') },
    icon('camera', { size: 14 }),
  );
  exportPngBtn.addEventListener('click', () => {
    exportPng(svg, 'graph.png', ctx.fs);
  });

  const exportSvgBtn = h('button', { class: 'nx-cs-btn', title: t('controls.exportSvg') }, icon('image', { size: 14 }));
  exportSvgBtn.addEventListener('click', () => {
    exportSvg(svg, 'graph.svg', ctx.fs);
  });

  controlsRow.append(
    algoSelect,
    startSelect,
    presetSelect,
    layoutSelect,
    directedBtn,
    toolSelect,
    clearBtn,
    importExportBtn,
    saveBtn,
    loadBtn,
    exportPngBtn,
    exportSvgBtn,
  );
  header.append(controlsRow);

  const engineToolbar = renderVisualizerControls(engine, { t });

  // Main canvas wrap & SVG
  const main = h('div', { class: 'nx-graphlab-main' });
  const canvasWrap = h('div', { class: 'nx-graphlab-canvas-wrap' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'nx-graphlab-svg');
  canvasWrap.append(svg);

  // Sidebar info & pseudocode
  const sidebar = h('div', { class: 'nx-graphlab-sidebar' });
  const infoPanel = h('div', { class: 'nx-graphlab-info' });
  infoPanel.append(h('h4', {}, t('info.title')));
  const infoContent = h('div');
  infoPanel.append(infoContent);

  // Pseudocode panel
  const pseudoPanel = renderPseudocodePanel(
    GRAPH_ALGORITHMS[currentAlgoKey].pseudocode,
    () => {
      const step = engine.getCurrentStep();
      return step ? step.line || -1 : -1;
    },
    { locale: ctx.i18n.currentLocale, t },
  );

  sidebar.append(infoPanel, pseudoPanel);
  main.append(canvasWrap, sidebar);
  root.append(header, engineToolbar, main);
  container.append(root);

  updateStartSelect();

  function updateInfo() {
    let matrixHtml = '';
    if (floydMatrix && floydMatrix.length > 0) {
      const labels = nodes.map((n) => n.label || n.id);
      const rows = floydMatrix.map((r, i) => `${labels[i]}: ${r.map((v) => (v === Infinity ? '∞' : v)).join(' ')}`);
      matrixHtml = `<div class="nx-matrix-view"><strong>Dist Matrix:</strong>\n${rows.join('\n')}</div>`;
    }

    infoContent.innerHTML = `
      <div>${t('info.nodes')}: <strong>${nodes.length}</strong></div>
      <div>${t('info.edges')}: <strong>${edges.length}</strong></div>
      <div>${t('info.status')}: <strong>${algorithmStatus}</strong></div>
      ${algorithmResult ? `<div>${t('info.result')}: <strong style="color:var(--accent)">${algorithmResult}</strong></div>` : ''}
      ${matrixHtml}
    `;
  }

  function resetAlgorithm() {
    clearAlgorithmState();
    const meta = GRAPH_ALGORITHMS[currentAlgoKey];
    if (meta && nodes.length > 0) {
      engine.init(meta.generator, nodes, edges, isDirected, startNodeId);
    }
    updateInfo();
    pseudoPanel.setLocale(ctx.i18n.currentLocale);
    renderSvg();
  }

  // ─── SVG Rendering ───
  let draggedNode = null;
  let edgeSourceNodeId = null;

  function renderSvg() {
    svg.innerHTML = '';

    // Defs for arrows
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#8791b3" />
      </marker>
      <marker id="arrow-active" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#ffc857" />
      </marker>
      <marker id="arrow-mst" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#3ddc97" />
      </marker>
    `;
    svg.appendChild(defs);

    const nodePosMap = new Map(nodes.map((n) => [n.id, n]));

    // Draw Edges
    for (const e of edges) {
      const u = nodePosMap.get(e.from);
      const v = nodePosMap.get(e.to);
      if (!u || !v) continue;

      const isMst = mstEdgeIds.has(e.id);
      const isActive = activeEdgeId === e.id;

      let stroke = 'rgba(120, 150, 255, 0.4)';
      let strokeWidth = 2;
      let markerEnd = isDirected ? 'url(#arrow)' : '';

      if (isActive) {
        stroke = '#ffc857';
        strokeWidth = 3.5;
        if (isDirected) markerEnd = 'url(#arrow-active)';
      } else if (isMst) {
        stroke = '#3ddc97';
        strokeWidth = 3;
        if (isDirected) markerEnd = 'url(#arrow-mst)';
      }

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(u.x));
      line.setAttribute('y1', String(u.y));
      line.setAttribute('x2', String(v.x));
      line.setAttribute('y2', String(v.y));
      line.setAttribute('stroke', stroke);
      line.setAttribute('stroke-width', String(strokeWidth));
      if (markerEnd) line.setAttribute('marker-end', markerEnd);

      // Edge click for delete or weight edit
      line.style.cursor = 'pointer';
      line.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (activeTool === 'delete') {
          edges = edges.filter((edge) => edge.id !== e.id);
          resetAlgorithm();
        } else {
          const newW = prompt('Edit edge weight:', String(e.weight ?? 1));
          if (newW !== null && !isNaN(Number(newW))) {
            e.weight = Number(newW);
            resetAlgorithm();
          }
        }
      });
      svg.appendChild(line);

      // Edge weight label
      if (e.weight !== undefined) {
        const midX = (u.x + v.x) / 2;
        const midY = (u.y + v.y) / 2 - 4;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(midX));
        text.setAttribute('y', String(midY));
        text.setAttribute('fill', '#b4bdd8');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-family', 'var(--font-mono, monospace)');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = String(e.weight);
        svg.appendChild(text);
      }
    }

    // Draw Nodes
    for (const n of nodes) {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.cursor = 'pointer';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(n.x));
      circle.setAttribute('cy', String(n.y));
      circle.setAttribute('r', '18');

      let fill = '#121628';
      let stroke = '#3ef0ff';
      let strokeWidth = 2;

      if (n.id === activeNodeId) {
        stroke = '#ffc857';
        strokeWidth = 4;
        fill = 'rgba(255, 200, 87, 0.3)';
      } else if (visitedNodeIds.has(n.id)) {
        fill = 'rgba(62, 240, 255, 0.35)';
      }

      // 2-coloring for bipartite
      if (nodeColors[n.id] !== undefined) {
        fill = nodeColors[n.id] === 0 ? 'rgba(62, 240, 255, 0.5)' : 'rgba(255, 92, 122, 0.5)';
      }

      circle.setAttribute('fill', fill);
      circle.setAttribute('stroke', stroke);
      circle.setAttribute('stroke-width', String(strokeWidth));
      g.appendChild(circle);

      // Label
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(n.x));
      label.setAttribute('y', String(n.y + 4));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', '#eef2ff');
      label.setAttribute('font-size', '12');
      label.setAttribute('font-weight', 'bold');
      label.textContent = n.label || n.id;
      g.appendChild(label);

      // Node Event Listeners
      g.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        if (activeTool === 'select') {
          draggedNode = n;
        } else if (activeTool === 'delete') {
          nodes = nodes.filter((node) => node.id !== n.id);
          edges = edges.filter((e) => e.from !== n.id && e.to !== n.id);
          updateStartSelect();
          resetAlgorithm();
        } else if (activeTool === 'addEdge') {
          if (!edgeSourceNodeId) {
            edgeSourceNodeId = n.id;
            circle.setAttribute('stroke', '#ffc857');
          } else {
            if (edgeSourceNodeId !== n.id) {
              const w = prompt('Edge weight:', '1');
              edges.push({
                id: `e${Date.now()}`,
                from: edgeSourceNodeId,
                to: n.id,
                weight: Number(w) || 1,
              });
              edgeSourceNodeId = null;
              resetAlgorithm();
            } else {
              edgeSourceNodeId = null;
              renderSvg();
            }
          }
        }
      });

      svg.appendChild(g);
    }
  }

  // Canvas interaction (drag node or click to add)
  svg.addEventListener('mousemove', (e) => {
    if (draggedNode && activeTool === 'select') {
      const rect = svg.getBoundingClientRect();
      draggedNode.x = e.clientX - rect.left;
      draggedNode.y = e.clientY - rect.top;
      renderSvg();
    }
  });

  window.addEventListener('mouseup', () => {
    draggedNode = null;
  });

  svg.addEventListener('click', (e) => {
    if (activeTool === 'addNode') {
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = String(nodes.length + 1);
      nodes.push({ id, label: id, x, y });
      updateStartSelect();
      resetAlgorithm();
    }
  });

  resetAlgorithm();

  return () => {
    engine.pause();
  };
}

export const commands = {
  'graphlab.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.graphlab', args });
  },
};

export const terminal = {
  graph: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.graphlab' });
      return 0;
    }

    const algoKey = GRAPH_ALGORITHMS[args[0].toLowerCase()] ? args[0].toLowerCase() : 'bfs';
    const preset = GRAPH_PRESETS.k5;
    const algo = GRAPH_ALGORITHMS[algoKey];

    io.stdout?.(`Running ${algo.name.en} on complete graph K5...\n`);
    const gen = algo.generator(preset.nodes, preset.edges, preset.directed, preset.nodes[0].id);

    let steps = 0;
    let step = gen.next();
    while (!step.done) {
      steps++;
      step = gen.next();
    }

    io.stdout?.(`Completed in ${steps} steps.\n`);
    return 0;
  },
};
