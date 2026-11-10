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
import {
  BinaryHeapModel,
  CircularBufferModel,
  DynamicArrayModel,
  HashTableModel,
  LinkedListModel,
  QueueModel,
  StackModel,
  TreeModel,
  TrieModel,
} from './structures.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);

  let currentStructureKey = 'avl';
  let activeModel = new TreeModel(true);

  let explanationLog = '';
  let activeElement = null;

  const engine = new VisualizerEngine({
    defaultSpeed: 150,
    onStep: (step) => {
      if (step.message) explanationLog = step.message;
      activeElement = step;
      updateInfo();
      pseudoPanel.update();
      renderDisplay();
    },
    onReset: () => {
      activeElement = null;
      updateInfo();
      pseudoPanel.update();
      renderDisplay();
    },
  });

  // UI Setup
  const root = h('div', { class: 'nx-ds-app' });
  const header = h('div', { class: 'nx-ds-header' });
  const controlsRow = h('div', { class: 'nx-ds-controls-row' });

  // Structure selector
  const structSelect = h('select', { class: 'nx-input small' }, [
    h('option', { value: 'array' }, t('structures.array')),
    h('option', { value: 'stack' }, t('structures.stack')),
    h('option', { value: 'queue' }, t('structures.queue')),
    h('option', { value: 'circular' }, t('structures.circular')),
    h('option', { value: 'slist' }, t('structures.slist')),
    h('option', { value: 'dlist' }, t('structures.dlist')),
    h('option', { value: 'bst' }, t('structures.bst')),
    h('option', { value: 'avl', selected: true }, t('structures.avl')),
    h('option', { value: 'heap' }, t('structures.heap')),
    h('option', { value: 'hash' }, t('structures.hash')),
    h('option', { value: 'trie' }, t('structures.trie')),
  ]);
  structSelect.addEventListener('change', () => {
    switchStructure(structSelect.value);
  });

  // Buttons
  const insertBtn = h('button', { class: 'nx-cs-btn primary' }, t('controls.insert'));
  insertBtn.addEventListener('click', () => {
    const val = prompt('Enter value to insert:', String(Math.floor(Math.random() * 90) + 10));
    if (val !== null && val.trim()) runCommand('insert', val.trim());
  });

  const deleteBtn = h('button', { class: 'nx-cs-btn' }, t('controls.delete'));
  deleteBtn.addEventListener('click', () => {
    const val = prompt('Enter value / index to delete:');
    if (val !== null && val.trim()) runCommand('delete', val.trim());
  });

  const searchBtn = h('button', { class: 'nx-cs-btn' }, t('controls.search'));
  searchBtn.addEventListener('click', () => {
    const val = prompt('Enter value to search:');
    if (val !== null && val.trim()) runCommand('search', val.trim());
  });

  const randomBtn = h('button', { class: 'nx-cs-btn' }, t('controls.random'));
  randomBtn.addEventListener('click', () => {
    populateRandom();
  });

  const clearBtn = h('button', { class: 'nx-cs-btn' }, icon('trash', { size: 14 }));
  clearBtn.addEventListener('click', () => {
    switchStructure(currentStructureKey);
  });

  // Save / Load / Export
  const saveBtn = h('button', { class: 'nx-cs-btn', title: t('controls.save') }, icon('download', { size: 14 }));
  saveBtn.addEventListener('click', async () => {
    const filename = `ds_${currentStructureKey}_${Date.now()}.csstate`;
    await saveStateToVfs(ctx.fs, `/home/documents/${filename}`, {
      type: currentStructureKey,
      model: activeModel,
    });
    ctx.notify({ title: t('app.title'), message: `Saved ${filename}` });
  });

  const loadBtn = h('button', { class: 'nx-cs-btn', title: t('controls.load') }, icon('folder-open', { size: 14 }));
  loadBtn.addEventListener('click', async () => {
    const path = prompt('Enter VFS path to load state:', '/home/documents/ds_state.csstate');
    if (!path) return;
    try {
      const data = await loadStateFromVfs(ctx.fs, path);
      if (data && data.type) {
        structSelect.value = data.type;
        switchStructure(data.type);
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
    exportPng(displayArea, `${currentStructureKey}.png`, ctx.fs);
  });

  const exportSvgBtn = h('button', { class: 'nx-cs-btn', title: t('controls.exportSvg') }, icon('image', { size: 14 }));
  exportSvgBtn.addEventListener('click', () => {
    const svgEl = displayArea.querySelector('svg');
    if (svgEl) exportSvg(svgEl, `${currentStructureKey}.svg`, ctx.fs);
    else exportPng(displayArea, `${currentStructureKey}.png`, ctx.fs);
  });

  controlsRow.append(
    structSelect,
    insertBtn,
    deleteBtn,
    searchBtn,
    randomBtn,
    clearBtn,
    saveBtn,
    loadBtn,
    exportPngBtn,
    exportSvgBtn,
  );
  header.append(controlsRow);

  // CLI Bar
  const cliBar = h('div', { class: 'nx-ds-cli-bar' });
  const cliPrompt = h('span', { style: 'color:var(--accent);font-family:var(--font-mono)' }, 'nexus:ds$');
  const cliInput = h('input', {
    type: 'text',
    class: 'nx-input nx-ds-cli-input',
    placeholder: t('controls.cliPlaceholder'),
  });
  cliInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const line = cliInput.value.trim();
      if (line) {
        handleCliCommand(line);
        cliInput.value = '';
      }
    }
  });
  cliBar.append(cliPrompt, cliInput);

  // Engine controls
  const engineToolbar = renderVisualizerControls(engine, { t });

  // Main Panes
  const main = h('div', { class: 'nx-ds-main' });
  const viewPane = h('div', { class: 'nx-ds-view-pane' });
  const displayArea = h('div', { class: 'nx-ds-display' });
  viewPane.append(displayArea);

  // Sidebar
  const sidebar = h('div', { class: 'nx-ds-sidebar' });
  const infoPanel = h('div', { class: 'nx-ds-info' });
  infoPanel.append(h('h4', {}, t('info.title')));
  const infoContent = h('div');
  infoPanel.append(infoContent);

  const pseudocodeMap = {
    en: [
      'function executeOperation():',
      '  validate parameters and structure state',
      '  traverse or rebalance as required',
      '  update pointers / memory slots',
    ],
    de: [
      'Funktion führeOperationAus():',
      '  validiere Parameter und Strukturzustand',
      '  traversiere oder balanciere nach Bedarf',
      '  aktualisiere Zeiger / Speicherzellen',
    ],
  };

  const pseudoPanel = renderPseudocodePanel(pseudocodeMap, () => (engine.getCurrentStep() ? 2 : 1), {
    locale: ctx.i18n.currentLocale,
    t,
  });

  sidebar.append(infoPanel, pseudoPanel);
  main.append(viewPane, sidebar);
  root.append(header, cliBar, engineToolbar, main);
  container.append(root);

  function switchStructure(type) {
    currentStructureKey = type;
    if (type === 'array') activeModel = new DynamicArrayModel(4);
    else if (type === 'stack') activeModel = new StackModel();
    else if (type === 'queue') activeModel = new QueueModel();
    else if (type === 'circular') activeModel = new CircularBufferModel(6);
    else if (type === 'slist') activeModel = new LinkedListModel(false);
    else if (type === 'dlist') activeModel = new LinkedListModel(true);
    else if (type === 'bst') activeModel = new TreeModel(false);
    else if (type === 'avl') activeModel = new TreeModel(true);
    else if (type === 'heap') activeModel = new BinaryHeapModel('max');
    else if (type === 'hash') activeModel = new HashTableModel('chaining', 7);
    else if (type === 'trie') activeModel = new TrieModel();

    populateRandom();
  }

  function populateRandom() {
    if (currentStructureKey === 'array') {
      const arr = [12, 45, 78];
      activeModel = new DynamicArrayModel(4);
      for (const x of arr) {
        const g = activeModel.insert(x);
        while (!g.next().done);
      }
    } else if (currentStructureKey === 'stack') {
      activeModel = new StackModel();
      for (const x of [10, 20, 30]) {
        const g = activeModel.push(x);
        while (!g.next().done);
      }
    } else if (currentStructureKey === 'queue') {
      activeModel = new QueueModel();
      for (const x of [15, 25, 35]) {
        const g = activeModel.enqueue(x);
        while (!g.next().done);
      }
    } else if (currentStructureKey === 'circular') {
      activeModel = new CircularBufferModel(6);
      for (const x of [1, 2, 3]) {
        const g = activeModel.enqueue(x);
        while (!g.next().done);
      }
    } else if (currentStructureKey === 'slist' || currentStructureKey === 'dlist') {
      activeModel = new LinkedListModel(currentStructureKey === 'dlist');
      for (const x of [7, 14, 21]) {
        const g = activeModel.insertTail(x);
        while (!g.next().done);
      }
    } else if (currentStructureKey === 'bst' || currentStructureKey === 'avl') {
      activeModel = new TreeModel(currentStructureKey === 'avl');
      for (const x of [50, 25, 75, 10, 30, 60, 90]) {
        const g = activeModel.insert(x);
        while (!g.next().done);
      }
    } else if (currentStructureKey === 'heap') {
      activeModel = new BinaryHeapModel('max');
      for (const x of [60, 40, 50, 10, 30, 20]) {
        const g = activeModel.insert(x);
        while (!g.next().done);
      }
    } else if (currentStructureKey === 'hash') {
      activeModel = new HashTableModel('chaining', 7);
      for (const x of [12, 19, 26, 8, 15]) {
        const g = activeModel.insert(x);
        while (!g.next().done);
      }
    } else if (currentStructureKey === 'trie') {
      activeModel = new TrieModel();
      for (const w of ['cat', 'car', 'cart', 'dog']) {
        const g = activeModel.insert(w);
        while (!g.next().done);
      }
    }

    explanationLog = 'Initialized with sample values.';
    updateInfo();
    renderDisplay();
  }

  function runCommand(op, arg) {
    const num = Number(arg);
    const val = isNaN(num) ? arg : num;
    let gen = null;

    if (op === 'insert' || op === 'push' || op === 'enqueue') {
      if (activeModel.insert) gen = activeModel.insert(val);
      else if (activeModel.push) gen = activeModel.push(val);
      else if (activeModel.enqueue) gen = activeModel.enqueue(val);
      else if (activeModel.insertTail) gen = activeModel.insertTail(val);
    } else if (op === 'delete' || op === 'pop' || op === 'dequeue') {
      if (activeModel.delete) gen = activeModel.delete(val);
      else if (activeModel.pop) gen = activeModel.pop();
      else if (activeModel.dequeue) gen = activeModel.dequeue();
    } else if (op === 'search') {
      if (activeModel.search) gen = activeModel.search(val);
    } else if (op === 'extract') {
      if (activeModel.extract) gen = activeModel.extract();
    }

    if (gen) {
      engine.init(() => gen);
      engine.play();
    }
  }

  function handleCliCommand(cmd) {
    const parts = cmd.trim().split(/\s+/);
    const op = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');
    runCommand(op, arg);
  }

  function updateInfo() {
    let sizeText = '';
    if (activeModel.size !== undefined) sizeText = `Size: ${activeModel.size}, Cap: ${activeModel.capacity}`;
    else if (activeModel.items) sizeText = `Items: ${activeModel.items.length}`;
    else if (activeModel.count !== undefined) sizeText = `Count: ${activeModel.count}`;
    else if (activeModel.heap) sizeText = `Heap size: ${activeModel.heap.length}`;

    infoContent.innerHTML = `
      <div><strong>${t(`structures.${currentStructureKey}`)}</strong></div>
      <div>${sizeText}</div>
      <div style="margin-top:8px;color:var(--accent)">${explanationLog}</div>
    `;
  }

  function renderDisplay() {
    displayArea.innerHTML = '';

    if (currentStructureKey === 'array') {
      const arrContainer = h('div', { style: 'display:flex;align-items:center;' });
      for (let i = 0; i < activeModel.capacity; i++) {
        const val = activeModel.data[i];
        const isHighlight = activeElement && activeElement.index === i;
        const box = h(
          'div',
          { class: `nx-ds-box${isHighlight ? ' highlight' : ''}` },
          val !== null ? String(val) : '—',
        );
        arrContainer.append(box);
      }
      displayArea.append(arrContainer);
    } else if (currentStructureKey === 'stack') {
      const stackContainer = h('div', {
        style:
          'display:flex;flex-direction:column-reverse;align-items:center;border-bottom:3px solid var(--accent);padding:8px;',
      });
      for (let i = 0; i < activeModel.items.length; i++) {
        const val = activeModel.items[i];
        const box = h('div', { class: 'nx-ds-box' }, String(val));
        stackContainer.append(box);
      }
      displayArea.append(stackContainer);
    } else if (currentStructureKey === 'queue' || currentStructureKey === 'circular') {
      const qContainer = h('div', { style: 'display:flex;align-items:center;' });
      const items = currentStructureKey === 'circular' ? activeModel.buffer : activeModel.items;
      for (let i = 0; i < items.length; i++) {
        const val = items[i];
        let label = val !== null ? String(val) : '—';
        if (currentStructureKey === 'circular') {
          if (i === activeModel.head) label += ' (H)';
          if (i === activeModel.tail) label += ' (T)';
        }
        const box = h('div', { class: 'nx-ds-box' }, label);
        qContainer.append(box);
      }
      displayArea.append(qContainer);
    } else if (currentStructureKey === 'slist' || currentStructureKey === 'dlist') {
      const listContainer = h('div', { style: 'display:flex;align-items:center;' });
      for (let i = 0; i < activeModel.nodes.length; i++) {
        const node = activeModel.nodes[i];
        const box = h('div', { class: 'nx-ds-box' }, String(node.val));
        listContainer.append(box);
        if (i < activeModel.nodes.length - 1) {
          listContainer.append(h('span', { class: 'nx-ds-arrow' }, currentStructureKey === 'dlist' ? '⇄' : '→'));
        }
      }
      displayArea.append(listContainer);
    } else if (currentStructureKey === 'bst' || currentStructureKey === 'avl') {
      renderTreeSvg(activeModel.root);
    } else if (currentStructureKey === 'heap') {
      // Tree view + Array view
      const wrap = h('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:16px;' });
      const arrView = h('div', { style: 'display:flex;align-items:center;' });
      for (let i = 0; i < activeModel.heap.length; i++) {
        const box = h('div', { class: 'nx-ds-box' }, String(activeModel.heap[i]));
        arrView.append(box);
      }
      wrap.append(arrView);
      displayArea.append(wrap);
      renderHeapSvg(activeModel.heap, wrap);
    } else if (currentStructureKey === 'hash') {
      const hashContainer = h('div', { style: 'display:flex;flex-direction:column;gap:6px;' });
      for (let i = 0; i < activeModel.capacity; i++) {
        const row = h('div', { style: 'display:flex;align-items:center;gap:8px;' });
        const idxBox = h('span', { class: 'nx-cs-counter-badge' }, `[${i}]`);
        row.append(idxBox);

        if (activeModel.mode === 'chaining') {
          const chain = activeModel.buckets[i] || [];
          for (const item of chain) {
            row.append(h('div', { class: 'nx-ds-box small' }, String(item)));
            row.append(h('span', { class: 'nx-ds-arrow' }, '→'));
          }
        } else {
          const val = activeModel.buckets[i];
          row.append(h('div', { class: 'nx-ds-box small' }, val !== null ? String(val) : '—'));
        }
        hashContainer.append(row);
      }
      displayArea.append(hashContainer);
    } else if (currentStructureKey === 'trie') {
      renderTrieSvg(activeModel.root);
    }
  }

  function renderTreeSvg(rootNode) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '580');
    svg.setAttribute('height', '320');
    svg.style.overflow = 'visible';

    function drawNode(node, x, y, dx) {
      if (!node) return;
      if (node.left) {
        const lx = x - dx;
        const ly = y + 55;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x));
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(lx));
        line.setAttribute('y2', String(ly));
        line.setAttribute('stroke', '#8791b3');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
        drawNode(node.left, lx, ly, dx * 0.55);
      }
      if (node.right) {
        const rx = x + dx;
        const ry = y + 55;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x));
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(rx));
        line.setAttribute('y2', String(ry));
        line.setAttribute('stroke', '#8791b3');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
        drawNode(node.right, rx, ry, dx * 0.55);
      }

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(x));
      circle.setAttribute('cy', String(y));
      circle.setAttribute('r', '18');
      circle.setAttribute('fill', '#121628');
      circle.setAttribute('stroke', '#3ef0ff');
      circle.setAttribute('stroke-width', '2');
      svg.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(y + 4));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#eef2ff');
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', 'bold');
      text.textContent = String(node.val);
      svg.appendChild(text);
    }

    drawNode(rootNode, 290, 40, 120);
    displayArea.append(svg);
  }

  function renderHeapSvg(heap, parentContainer) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '580');
    svg.setAttribute('height', '260');

    function drawHeapNode(i, x, y, dx) {
      if (i >= heap.length) return;
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      if (left < heap.length) {
        const lx = x - dx;
        const ly = y + 55;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x));
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(lx));
        line.setAttribute('y2', String(ly));
        line.setAttribute('stroke', '#8791b3');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
        drawHeapNode(left, lx, ly, dx * 0.55);
      }
      if (right < heap.length) {
        const rx = x + dx;
        const ry = y + 55;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x));
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(rx));
        line.setAttribute('y2', String(ry));
        line.setAttribute('stroke', '#8791b3');
        line.setAttribute('stroke-width', '2');
        svg.appendChild(line);
        drawHeapNode(right, rx, ry, dx * 0.55);
      }

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(x));
      circle.setAttribute('cy', String(y));
      circle.setAttribute('r', '18');
      circle.setAttribute('fill', '#121628');
      circle.setAttribute('stroke', '#ffc857');
      circle.setAttribute('stroke-width', '2');
      svg.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(y + 4));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#eef2ff');
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', 'bold');
      text.textContent = String(heap[i]);
      svg.appendChild(text);
    }

    drawHeapNode(0, 290, 30, 120);
    parentContainer.append(svg);
  }

  function renderTrieSvg(rootNode) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '580');
    svg.setAttribute('height', '320');

    function drawTrieNode(node, label, x, y, dx) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(x));
      circle.setAttribute('cy', String(y));
      circle.setAttribute('r', '14');
      circle.setAttribute('fill', node.isEndOfWord ? 'rgba(61, 220, 151, 0.4)' : '#121628');
      circle.setAttribute('stroke', node.isEndOfWord ? '#3ddc97' : '#3ef0ff');
      circle.setAttribute('stroke-width', '2');
      svg.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(y + 4));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#eef2ff');
      text.setAttribute('font-size', '11');
      text.textContent = label;
      svg.appendChild(text);

      const children = Object.entries(node.children);
      const childCount = children.length;
      if (childCount === 0) return;

      const spacing = dx / Math.max(1, childCount);
      children.forEach(([char, child], idx) => {
        const cx = x - dx / 2 + (idx + 0.5) * spacing;
        const cy = y + 55;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x));
        line.setAttribute('y1', String(y));
        line.setAttribute('x2', String(cx));
        line.setAttribute('y2', String(cy));
        line.setAttribute('stroke', '#8791b3');
        line.setAttribute('stroke-width', '1.5');
        svg.appendChild(line);

        drawTrieNode(child, char, cx, cy, spacing);
      });
    }

    drawTrieNode(rootNode, '•', 290, 30, 260);
    displayArea.append(svg);
  }

  switchStructure(currentStructureKey);

  return () => {
    engine.pause();
  };
}

export const commands = {
  'datastructures.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.datastructures', args });
  },
};

export const terminal = {
  ds: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.datastructures' });
      return 0;
    }

    const type = args[0].toLowerCase();
    io.stdout?.(`Demonstrating ${type} operations...\n`);
    if (type === 'avl' || type === 'tree') {
      const tree = new TreeModel(true);
      for (const x of [30, 20, 10]) {
        const g = tree.insert(x);
        let s = g.next();
        while (!s.done) {
          if (s.value?.type === 'rotate') io.stdout?.(`  Rotated: ${s.value.message}\n`);
          s = g.next();
        }
      }
      io.stdout?.(`Root value after AVL balancing: ${tree.root?.val}\n`);
    } else if (type === 'heap') {
      const heap = new BinaryHeapModel('max');
      for (const x of [10, 40, 20, 50]) {
        const g = heap.insert(x);
        while (!g.next().done);
      }
      io.stdout?.(`Max heap contents: [${heap.heap.join(', ')}]\n`);
    } else {
      io.stdout?.(`Type "${type}" supported in UI.\n`);
    }
    return 0;
  },
};
