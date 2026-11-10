// @ts-check
import { h, icon } from '../../ui/dom.js';
import { openMenu } from '../../ui/menu.js';
import { openModal } from '../../ui/overlay.js';
import {
  addChildNode,
  addSiblingNode,
  computeLayout,
  createMindmap,
  deleteNode,
  exportMindmapToSvg,
  exportToMarkdown,
  findNode,
  findParent,
  importFromMarkdown,
  NODE_COLORS,
  parseMindmap,
  serializeMindmap,
} from './model.js';
import './styles.css';

/**
 * Commands exported by nexus.mindmap.
 * @type {import('../../kernel/types').AppModule['commands']}
 */
export const commands = {
  'mindmap.new': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.mindmap', args: { newFile: true } }),
};

/**
 * Main application mount for Nexus Mind Map.
 * @type {import('../../kernel/types').AppModule['mount']}
 */
export async function mount(container, ctx, args) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>=} */ vars) => ctx.i18n.t(key, vars);
  const fs = /** @type {any} */ (ctx.fs);

  let currentPath = /** @type {string | null} */ (args.path ?? null);

  let mapData = createMindmap(t('app.untitled', 'Untitled Mind Map'));
  let selectedId = 'root';

  // Viewport pan/zoom
  const viewportState = {
    x: 100,
    y: 300,
    zoom: 1,
  };

  let isPanning = false;
  let startX = 0;
  let startY = 0;

  // History stack
  /** @type {string[]} */
  const undoStack = [];
  /** @type {string[]} */
  const redoStack = [];
  const MAX_HISTORY = 100;

  // Load existing file or restored state
  if (currentPath && fs) {
    try {
      const data = await fs.readFile(currentPath);
      if (currentPath.endsWith('.md')) {
        mapData.root = importFromMarkdown(data);
        mapData.title = mapData.root.text;
      } else {
        mapData = parseMindmap(data);
      }
    } catch (e) {
      console.warn('Failed to load mindmap file:', e);
    }
  } else if (args.restoredState) {
    try {
      mapData = parseMindmap(args.restoredState.mapData);
      currentPath = args.restoredState.path ?? null;
    } catch {
      mapData = createMindmap();
    }
  }

  // Root Layout
  const root = h('div', { class: 'nx-mindmap' });
  container.appendChild(root);

  // ─── Header ─────────────────────────────────────────────────────────────
  const titleInput = h('input', {
    class: 'nx-mindmap-title-input',
    type: 'text',
    value: mapData.title,
    title: t('app.title', 'Nexus Mind Map'),
  });

  const statusLabel = h('span', { class: 'nx-mindmap-status' }, '');

  function updateStatus(dirty) {
    statusLabel.textContent = dirty ? '●' : '';
    statusLabel.title = dirty ? 'Unsaved changes' : 'All changes saved';
  }

  titleInput.oninput = () => {
    mapData.title = titleInput.value.trim() || t('app.untitled', 'Untitled Mind Map');
    if (mapData.root) mapData.root.text = mapData.title;
    updateStatus(true);
    render();
  };

  const fileMenuBtn = h('button', { class: 'nx-mindmap-btn', title: t('file.menu', 'File') }, icon('menu'), ' File');
  fileMenuBtn.onclick = () => showFileMenu(fileMenuBtn);

  const exportBtn = h(
    'button',
    { class: 'nx-mindmap-btn', title: t('file.export', 'Export') },
    icon('download'),
    ' Export',
  );
  exportBtn.onclick = () => showExportMenu(exportBtn);

  // Layout mode switcher
  const layoutSelect = h(
    'select',
    { class: 'nx-mindmap-select', title: t('toolbar.layout', 'Layout') },
    h('option', { value: 'right' }, t('toolbar.layoutRight', 'Right Tree')),
    h('option', { value: 'radial' }, t('toolbar.layoutRadial', 'Radial Tree')),
    h('option', { value: 'org' }, t('toolbar.layoutOrg', 'Org Chart')),
  );
  layoutSelect.value = mapData.layout || 'right';
  layoutSelect.onchange = () => {
    const val = layoutSelect.value;
    mapData.layout = val === 'radial' || val === 'org' ? val : 'right';
    updateStatus(true);
    render();
  };

  const header = h(
    'div',
    { class: 'nx-mindmap-header' },
    h(
      'div',
      { class: 'nx-mindmap-title-area' },
      h('div', { class: 'nx-mindmap-icon' }, icon('share')),
      titleInput,
      statusLabel,
    ),
    h('div', { class: 'nx-mindmap-actions' }, layoutSelect, fileMenuBtn, exportBtn),
  );

  // ─── Toolbar ─────────────────────────────────────────────────────────────
  const addChildBtn = h(
    'button',
    { class: 'nx-mindmap-btn', title: t('toolbar.addChild', 'Add Subtopic (Tab)') },
    icon('plus'),
    ' Subtopic',
  );
  addChildBtn.onclick = () => onAddChild();

  const addSiblingBtn = h(
    'button',
    { class: 'nx-mindmap-btn', title: t('toolbar.addSibling', 'Add Sibling (Enter)') },
    icon('plus'),
    ' Sibling',
  );
  addSiblingBtn.onclick = () => onAddSibling();

  const deleteBtn = h(
    'button',
    { class: 'nx-mindmap-btn', title: t('toolbar.delete', 'Delete (Del)') },
    icon('trash'),
    ' Delete',
  );
  deleteBtn.onclick = () => onDeleteSelected();

  const collapseBtn = h(
    'button',
    { class: 'nx-mindmap-btn', title: t('toolbar.collapse', 'Collapse / Expand (Space)') },
    icon('minus'),
    ' Fold',
  );
  collapseBtn.onclick = () => onToggleCollapse();

  const toTasksBtn = h(
    'button',
    { class: 'nx-mindmap-btn', title: t('toolbar.toTasks', 'Create Tasks from Branch') },
    icon('checklist'),
    ' To Tasks',
  );
  toTasksBtn.onclick = () => onTurnBranchIntoTasks();

  // Swatches for node colors
  const colorGroup = h('div', { class: 'nx-mindmap-toolbar-group', style: 'margin-left: 8px;' });
  NODE_COLORS.forEach((col) => {
    const swatch = h('span', {
      class: 'nx-mindmap-color-swatch',
      style: `background-color: ${col};`,
      onclick: () => {
        const node = findNode(mapData.root, selectedId);
        if (node) {
          saveHistory();
          node.color = col;
          render();
        }
      },
    });
    colorGroup.appendChild(swatch);
  });

  const toolbar = h(
    'div',
    { class: 'nx-mindmap-toolbar' },
    h(
      'div',
      { class: 'nx-mindmap-toolbar-group' },
      h(
        'button',
        { class: 'nx-mindmap-btn', title: t('toolbar.undo', 'Undo'), onclick: () => undoAction() },
        icon('undo'),
      ),
      h(
        'button',
        { class: 'nx-mindmap-btn', title: t('toolbar.redo', 'Redo'), onclick: () => redoAction() },
        icon('redo'),
      ),
    ),
    h('div', { class: 'nx-mindmap-separator' }),
    h('div', { class: 'nx-mindmap-toolbar-group' }, addChildBtn, addSiblingBtn, deleteBtn, collapseBtn),
    h('div', { class: 'nx-mindmap-separator' }),
    colorGroup,
    h('div', { class: 'nx-mindmap-separator' }),
    toTasksBtn,
  );

  // ─── Canvas Viewport ────────────────────────────────────────────────────
  const canvas = h('canvas', { class: 'nx-mindmap-canvas' });
  const viewport = h('div', { class: 'nx-mindmap-viewport' }, canvas);

  // Zoom Widget
  const zoomLabel = h('span', { class: 'nx-mindmap-zoom-label' }, '100%');
  const zoomInBtn = h('button', { class: 'nx-mindmap-btn', title: t('toolbar.zoomIn', 'Zoom In') }, icon('zoom-in'));
  const zoomOutBtn = h(
    'button',
    { class: 'nx-mindmap-btn', title: t('toolbar.zoomOut', 'Zoom Out') },
    icon('zoom-out'),
  );
  const zoomResetBtn = h(
    'button',
    { class: 'nx-mindmap-btn', title: t('toolbar.zoomReset', 'Reset Zoom') },
    icon('refresh'),
  );
  const zoomFitBtn = h(
    'button',
    { class: 'nx-mindmap-btn', title: t('toolbar.zoomFit', 'Fit Content') },
    icon('maximize'),
  );

  zoomInBtn.onclick = () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.2);
  zoomOutBtn.onclick = () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / 1.2);
  zoomResetBtn.onclick = () => {
    viewportState.zoom = 1;
    viewportState.x = viewport.clientWidth / 3;
    viewportState.y = viewport.clientHeight / 2;
    updateZoomLabel();
    render();
  };
  zoomFitBtn.onclick = () => fitAllContent();

  const zoomWidget = h(
    'div',
    { class: 'nx-mindmap-zoom-widget' },
    zoomOutBtn,
    zoomLabel,
    zoomInBtn,
    zoomResetBtn,
    zoomFitBtn,
  );
  viewport.appendChild(zoomWidget);

  root.appendChild(header);
  root.appendChild(toolbar);
  root.appendChild(viewport);

  const ctx2d = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    render();
  }

  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 0);

  function updateZoomLabel() {
    zoomLabel.textContent = `${Math.round(viewportState.zoom * 100)}%`;
  }

  function zoomAt(screenX, screenY, factor) {
    const oldZoom = viewportState.zoom;
    const newZoom = Math.max(0.2, Math.min(3, oldZoom * factor));
    const worldX = (screenX - viewportState.x) / oldZoom;
    const worldY = (screenY - viewportState.y) / oldZoom;
    viewportState.zoom = newZoom;
    viewportState.x = screenX - worldX * newZoom;
    viewportState.y = screenY - worldY * newZoom;
    updateZoomLabel();
    render();
  }

  function fitAllContent() {
    const layout = computeLayout(mapData.root, mapData.layout);
    /** @type {import('./model.js').LayoutNode[]} */
    const all = [];
    function collect(n) {
      all.push(n);
      n.children.forEach(collect);
    }
    collect(layout);

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    all.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    });

    const w = maxX - minX;
    const h = maxY - minY;
    const padding = 80;
    const vw = viewport.clientWidth - padding * 2;
    const vh = viewport.clientHeight - padding * 2;
    const scale = Math.max(0.2, Math.min(1.5, Math.min(vw / w, vh / h)));

    viewportState.zoom = scale;
    viewportState.x = (viewport.clientWidth - w * scale) / 2 - minX * scale;
    viewportState.y = (viewport.clientHeight - h * scale) / 2 - minY * scale;
    updateZoomLabel();
    render();
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - viewportState.x) / viewportState.zoom,
      y: (sy - viewportState.y) / viewportState.zoom,
    };
  }

  // ─── History Stack ───────────────────────────────────────────────────────
  function saveHistory() {
    undoStack.push(serializeMindmap(mapData));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    updateStatus(true);
  }

  function undoAction() {
    if (undoStack.length === 0) return;
    redoStack.push(serializeMindmap(mapData));
    const prev = undoStack.pop();
    if (prev) {
      mapData = parseMindmap(prev);
      titleInput.value = mapData.title;
      render();
    }
  }

  function redoAction() {
    if (redoStack.length === 0) return;
    undoStack.push(serializeMindmap(mapData));
    const next = redoStack.pop();
    if (next) {
      mapData = parseMindmap(next);
      titleInput.value = mapData.title;
      render();
    }
  }

  // ─── Rendering ───────────────────────────────────────────────────────────
  let currentLayoutRoot = /** @type {import('./model.js').LayoutNode | null} */ (null);

  function render() {
    if (!ctx2d) return;
    const dpr = window.devicePixelRatio || 1;

    ctx2d.save();
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    ctx2d.scale(dpr, dpr);
    ctx2d.translate(viewportState.x, viewportState.y);
    ctx2d.scale(viewportState.zoom, viewportState.zoom);

    currentLayoutRoot = computeLayout(mapData.root, mapData.layout);

    // 1. Draw connecting curves
    drawCurves(ctx2d, currentLayoutRoot);

    // 2. Draw nodes
    drawNodes(ctx2d, currentLayoutRoot);

    ctx2d.restore();
  }

  function drawCurves(ctx, node) {
    node.children.forEach((c) => {
      ctx.save();
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 2.5;

      let x1, y1, x2, y2;
      if (mapData.layout === 'org') {
        x1 = node.x + node.width / 2;
        y1 = node.y + node.height;
        x2 = c.x + c.width / 2;
        y2 = c.y;
        const midY = (y1 + y2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1, midY, x2, midY, x2, y2);
        ctx.stroke();
      } else {
        x1 = node.x + node.width;
        y1 = node.y + node.height / 2;
        x2 = c.x;
        y2 = c.y + c.height / 2;
        const midX = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
        ctx.stroke();
      }

      ctx.restore();
      drawCurves(ctx, c);
    });
  }

  function drawNodes(ctx, node) {
    const isSelected = node.id === selectedId;
    const isRoot = node.id === 'root';

    ctx.save();

    // Node shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // Node capsule pill
    ctx.fillStyle = node.color;
    roundRect(ctx, node.x, node.y, node.width, node.height, isRoot ? 16 : 10);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      roundRect(ctx, node.x - 3, node.y - 3, node.width + 6, node.height + 6, isRoot ? 18 : 12);
      ctx.stroke();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      roundRect(ctx, node.x - 5, node.y - 5, node.width + 10, node.height + 10, isRoot ? 20 : 14);
      ctx.stroke();
    }

    // Node text
    ctx.fillStyle = '#ffffff';
    ctx.font = isRoot ? 'bold 15px sans-serif' : '500 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.text, node.x + node.width / 2, node.y + node.height / 2);

    // Collapsed indicator badge
    if (node.hasChildren && node.collapsed) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(node.x + node.width, node.y + node.height / 2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('+', node.x + node.width, node.y + node.height / 2);
    }

    ctx.restore();

    node.children.forEach((c) => drawNodes(ctx, c));
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function hitTestNode(node, wx, wy) {
    if (wx >= node.x && wx <= node.x + node.width && wy >= node.y && wy <= node.y + node.height) {
      return node;
    }
    for (const child of node.children) {
      const hit = hitTestNode(child, wx, wy);
      if (hit) return hit;
    }
    return null;
  }

  // ─── Interaction Handlers ───────────────────────────────────────────────
  viewport.addEventListener('pointerdown', (e) => {
    const rect = viewport.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x, y } = screenToWorld(sx, sy);

    if (currentLayoutRoot) {
      const hit = hitTestNode(currentLayoutRoot, x, y);
      if (hit) {
        selectedId = hit.id;
        render();
        return;
      }
    }

    // Pan canvas
    isPanning = true;
    startX = sx - viewportState.x;
    startY = sy - viewportState.y;
    viewport.classList.add('panning');
  });

  viewport.addEventListener('pointermove', (e) => {
    if (isPanning) {
      const rect = viewport.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      viewportState.x = sx - startX;
      viewportState.y = sy - startY;
      render();
    }
  });

  viewport.addEventListener('pointerup', () => {
    if (isPanning) {
      isPanning = false;
      viewport.classList.remove('panning');
    }
  });

  // Wheel zoom and pan
  viewport.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        zoomAt(sx, sy, factor);
      } else {
        viewportState.x -= e.deltaX;
        viewportState.y -= e.deltaY;
        render();
      }
    },
    { passive: false },
  );

  // Double click node to edit text
  viewport.addEventListener('dblclick', async (e) => {
    const rect = viewport.getBoundingClientRect();
    const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    if (!currentLayoutRoot) return;
    const hit = hitTestNode(currentLayoutRoot, x, y);
    if (hit) {
      await promptEditNode(hit.id);
    }
  });

  // ─── Keyboard Navigation & Operations ───────────────────────────────────
  function onAddChild() {
    saveHistory();
    const newChild = addChildNode(mapData.root, selectedId, 'New Subtopic');
    if (newChild) {
      selectedId = newChild.id;
      render();
      promptEditNode(newChild.id);
    }
  }

  function onAddSibling() {
    saveHistory();
    const newSibling = addSiblingNode(mapData.root, selectedId, 'New Topic');
    if (newSibling) {
      selectedId = newSibling.id;
      render();
      promptEditNode(newSibling.id);
    }
  }

  function onDeleteSelected() {
    if (selectedId === 'root') return;
    saveHistory();
    const parent = findParent(mapData.root, selectedId);
    if (deleteNode(mapData.root, selectedId)) {
      if (parent) selectedId = parent.id;
      render();
    }
  }

  function onToggleCollapse() {
    const node = findNode(mapData.root, selectedId);
    if (node && node.children.length > 0) {
      saveHistory();
      node.collapsed = !node.collapsed;
      render();
    }
  }

  async function promptEditNode(id) {
    const node = findNode(mapData.root, id);
    if (!node) return;

    const input = h('input', {
      type: 'text',
      value: node.text,
      class: 'nx-input',
      style: 'width: 100%; font-size: 14px;',
    });

    const ok = await openModal({
      title: t('dialog.editNode', 'Edit Topic Text'),
      body: h('div', {}, h('label', {}, t('dialog.enterText', 'Topic text:'), input)),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: 'Save', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok && input.value.trim()) {
      saveHistory();
      node.text = input.value.trim();
      if (node.id === 'root') {
        mapData.title = node.text;
        titleInput.value = node.text;
      }
      render();
    }
  }

  async function onTurnBranchIntoTasks() {
    const node = findNode(mapData.root, selectedId);
    if (!node) return;

    const tasks = [];
    function collectTasks(n) {
      tasks.push(`- [ ] ${n.text}`);
      n.children.forEach(collectTasks);
    }
    collectTasks(node);

    const text = tasks.join('\n');
    await openModal({
      title: t('toolbar.toTasks', 'Create Tasks from Branch'),
      body: h(
        'div',
        {},
        h('p', {}, 'Tasks extracted from selected branch:'),
        h(
          'textarea',
          { rows: 8, style: 'width: 100%; font-family: var(--font-mono); font-size: 13px;', readonly: true },
          text,
        ),
      ),
      actions: [
        {
          label: 'Copy to Clipboard',
          value: true,
          variant: 'primary',
          accept: () => {
            navigator.clipboard?.writeText(text);
            return true;
          },
        },
        { label: 'Close', value: false, variant: 'ghost' },
      ],
      dismissValue: false,
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      onAddChild();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onAddSibling();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDeleteSelected();
    } else if (e.key === ' ') {
      e.preventDefault();
      onToggleCollapse();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      const node = findNode(mapData.root, selectedId);
      if (node && node.children.length > 0 && !node.collapsed) {
        selectedId = node.children[0].id;
        render();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const parent = findParent(mapData.root, selectedId);
      if (parent) {
        selectedId = parent.id;
        render();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redoAction();
      else undoAction();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      redoAction();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveMap();
    }
  });

  // ─── File Operations & Exports ──────────────────────────────────────────
  async function saveMap() {
    if (!currentPath) {
      await saveAsMap();
      return;
    }
    if (fs) {
      mapData.metadata.modified = Date.now();
      const content = currentPath.endsWith('.md') ? exportToMarkdown(mapData.root) : serializeMindmap(mapData);
      await fs.writeFile(currentPath, content);
      updateStatus(false);
    }
  }

  async function saveAsMap() {
    const defaultName = `${mapData.title.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'mindmap'}.nmap`;
    const input = h('input', {
      type: 'text',
      value: currentPath || `/home/documents/${defaultName}`,
      class: 'nx-input',
    });

    const ok = await openModal({
      title: t('file.saveAs', 'Save As...'),
      body: h('div', {}, h('label', {}, 'Destination path:', input)),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: 'Save', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok && input.value.trim()) {
      currentPath = input.value.trim();
      await saveMap();
    }
  }

  function showFileMenu(anchor) {
    openMenu(
      [
        {
          label: t('file.new', 'New Mind Map'),
          icon: 'file-plus',
          run: () => {
            mapData = createMindmap(t('app.untitled', 'Untitled Mind Map'));
            titleInput.value = mapData.title;
            currentPath = null;
            selectedId = 'root';
            updateStatus(false);
            fitAllContent();
          },
        },
        {
          label: t('file.open', 'Open...'),
          icon: 'folder-open',
          run: () => promptOpenMap(),
        },
        'separator',
        {
          label: t('file.save', 'Save'),
          icon: 'download',
          shortcut: 'Mod+S',
          run: () => saveMap(),
        },
        {
          label: t('file.saveAs', 'Save As...'),
          icon: 'download',
          run: () => saveAsMap(),
        },
        'separator',
        {
          label: t('file.import', 'Import'),
          icon: 'upload',
          submenu: [
            {
              label: t('file.importMd', 'Import Markdown Outline'),
              run: () => promptImportMarkdown(),
            },
          ],
        },
        {
          label: t('file.export', 'Export'),
          icon: 'share',
          submenu: [
            {
              label: t('file.exportMd', 'Export as Markdown (.md)'),
              run: () => downloadFile(`${mapData.title}.md`, exportToMarkdown(mapData.root), 'text/markdown'),
            },
            {
              label: t('file.exportSvg', 'Export as SVG (.svg)'),
              run: () => exportSvgFile(),
            },
            {
              label: t('file.exportPng', 'Export as PNG (.png)'),
              run: () => exportPngFile(),
            },
            {
              label: t('file.exportNmap', 'Export as Nexus Map (.nmap)'),
              run: () => downloadFile(`${mapData.title}.nmap`, serializeMindmap(mapData), 'application/json'),
            },
          ],
        },
      ],
      { anchor },
    );
  }

  function showExportMenu(anchor) {
    openMenu(
      [
        {
          label: t('file.exportMd', 'Export as Markdown (.md)'),
          icon: 'file-text',
          run: () => downloadFile(`${mapData.title}.md`, exportToMarkdown(mapData.root), 'text/markdown'),
        },
        {
          label: t('file.exportSvg', 'Export as SVG (.svg)'),
          icon: 'download',
          run: () => exportSvgFile(),
        },
        {
          label: t('file.exportPng', 'Export as PNG (.png)'),
          icon: 'image',
          run: () => exportPngFile(),
        },
        {
          label: t('file.exportNmap', 'Export as Nexus Map (.nmap)'),
          icon: 'download',
          run: () => downloadFile(`${mapData.title}.nmap`, serializeMindmap(mapData), 'application/json'),
        },
      ],
      { anchor },
    );
  }

  async function promptOpenMap() {
    const input = h('input', { type: 'text', placeholder: '/home/documents/map.nmap', class: 'nx-input' });
    const ok = await openModal({
      title: t('file.open', 'Open Mind Map'),
      body: h('div', {}, h('label', {}, 'Enter file path in VFS:', input)),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: 'Open', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok && input.value.trim() && fs) {
      currentPath = input.value.trim();
      const data = await fs.readFile(currentPath);
      if (currentPath.endsWith('.md')) {
        mapData.root = importFromMarkdown(data);
        mapData.title = mapData.root.text;
      } else {
        mapData = parseMindmap(data);
      }
      titleInput.value = mapData.title;
      selectedId = 'root';
      updateStatus(false);
      fitAllContent();
    }
  }

  async function promptImportMarkdown() {
    const textarea = h('textarea', {
      rows: 10,
      style: 'width: 100%; font-family: var(--font-mono); font-size: 13px;',
      placeholder: '# Main Topic\n- Subtopic 1\n  - Detail A\n- Subtopic 2',
    });

    const ok = await openModal({
      title: t('dialog.importMd', 'Import Markdown Outline'),
      body: h('div', {}, h('p', {}, t('dialog.pasteMd', 'Paste markdown outline:')), textarea),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: 'Import', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok && textarea.value.trim()) {
      saveHistory();
      mapData.root = importFromMarkdown(textarea.value);
      mapData.title = mapData.root.text;
      titleInput.value = mapData.title;
      selectedId = 'root';
      updateStatus(true);
      fitAllContent();
    }
  }

  function exportSvgFile() {
    const layout = computeLayout(mapData.root, mapData.layout);
    const svgStr = exportMindmapToSvg(layout);
    downloadFile(`${mapData.title}.svg`, svgStr, 'image/svg+xml');
  }

  function exportPngFile() {
    const layout = computeLayout(mapData.root, mapData.layout);
    /** @type {import('./model.js').LayoutNode[]} */
    const all = [];
    function collect(n) {
      all.push(n);
      n.children.forEach(collect);
    }
    collect(layout);

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    all.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    });

    const pad = 60;
    const width = maxX - minX + pad * 2;
    const height = maxY - minY + pad * 2;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.fillStyle = '#f8fafc';
    offCtx.fillRect(0, 0, width, height);

    offCtx.translate(-minX + pad, -minY + pad);
    drawCurves(offCtx, layout);
    drawNodes(offCtx, layout);

    offCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mapData.title}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Initial draw
  render();

  return {
    saveState: () => ({
      mapData: serializeMindmap(mapData),
      path: currentPath,
    }),
  };
}
