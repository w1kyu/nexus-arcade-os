// @ts-check
import { h, icon } from '../../ui/dom.js';
import { openMenu } from '../../ui/menu.js';
import { openModal } from '../../ui/overlay.js';
import {
  createBoard,
  exportToSvg,
  generateElementId,
  getBoardBounds,
  getElementBounds,
  hitTestElement,
  parseBoard,
  serializeBoard,
  STICKY_COLORS,
  WHITEBOARD_TEMPLATES,
} from './model.js';
import './styles.css';

/**
 * Commands exported by nexus.whiteboard.
 * @type {import('../../kernel/types').AppModule['commands']}
 */
export const commands = {
  'whiteboard.new': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.whiteboard', args: { newFile: true } }),
};

/**
 * Main application mount for Nexus Whiteboard.
 * @type {import('../../kernel/types').AppModule['mount']}
 */
export async function mount(container, ctx, args) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>=} */ vars) => ctx.i18n.t(key, vars);
  const fs = /** @type {any} */ (ctx.fs);

  let currentPath = /** @type {string | null} */ (args.path ?? null);
  let isDirty = false;

  // Board Data
  let board = createBoard(t('app.untitled', 'Untitled Whiteboard'));

  // Active Tool & Properties
  /** @type {'select' | 'pen' | 'highlighter' | 'eraser' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text' | 'sticky' | 'frame'} */
  let activeTool = 'select';
  let activeStrokeColor = '#2563eb';
  let activeFillColor = '#dbeafe';
  let activeStrokeWidth = 3;
  let activeStickyColor = 'yellow';

  // Selection
  /** @type {string[]} */
  let selectedIds = [];

  // Interaction State
  let isPointerDown = false;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  /** @type {import('./model.js').BoardElement | null} */
  let drawingElement = null;

  // History Stack (Undo/Redo)
  /** @type {string[]} */
  const undoStack = [];
  /** @type {string[]} */
  const redoStack = [];
  const MAX_HISTORY = 100;

  // Load existing file or restored state
  if (currentPath && fs) {
    try {
      const data = await fs.readFile(currentPath);
      board = parseBoard(data);
    } catch (e) {
      console.warn('Failed to load board file:', e);
    }
  } else if (args.restoredState) {
    try {
      board = parseBoard(args.restoredState.board);
      currentPath = args.restoredState.path ?? null;
    } catch {
      board = createBoard();
    }
  }

  // Root layout
  const root = h('div', { class: 'nx-whiteboard' });
  container.appendChild(root);

  // ─── Header ─────────────────────────────────────────────────────────────
  const titleInput = h('input', {
    class: 'nx-whiteboard-title-input',
    type: 'text',
    value: board.title,
    title: t('app.title', 'Nexus Whiteboard'),
  });

  const statusLabel = h('span', { class: 'nx-whiteboard-status' }, '');

  function updateStatus(dirty) {
    isDirty = dirty;
    statusLabel.textContent = dirty ? '●' : '';
    statusLabel.title = dirty ? 'Unsaved changes' : 'All changes saved';
  }

  titleInput.oninput = () => {
    board.title = titleInput.value.trim() || t('app.untitled', 'Untitled Whiteboard');
    updateStatus(true);
  };

  const fileMenuBtn = h('button', { class: 'nx-whiteboard-btn', title: t('file.menu', 'File') }, icon('menu'), ' File');
  fileMenuBtn.onclick = () => showFileMenu(fileMenuBtn);

  const templatesBtn = h(
    'button',
    { class: 'nx-whiteboard-btn', title: t('file.templates', 'Board Templates') },
    icon('cards'),
    ' Templates',
  );
  templatesBtn.onclick = () => showTemplatesDialog();

  const exportBtn = h(
    'button',
    { class: 'nx-whiteboard-btn', title: t('file.export', 'Export') },
    icon('download'),
    ' Export',
  );
  exportBtn.onclick = () => showExportMenu(exportBtn);

  const header = h(
    'div',
    { class: 'nx-whiteboard-header' },
    h(
      'div',
      { class: 'nx-whiteboard-title-area' },
      h('div', { class: 'nx-whiteboard-icon' }, icon('layers')),
      titleInput,
      statusLabel,
    ),
    h('div', { class: 'nx-whiteboard-actions' }, fileMenuBtn, templatesBtn, exportBtn),
  );

  // ─── Tool Shelf ─────────────────────────────────────────────────────────
  const toolButtons = /** @type {Record<string, HTMLButtonElement>} */ ({});

  function setTool(tool) {
    activeTool = tool;
    Object.keys(toolButtons).forEach((k) => {
      toolButtons[k].classList.toggle('active', k === tool);
    });
    viewport.className = `nx-whiteboard-viewport tool-${tool}`;
    updatePropsBar();
  }

  function makeToolBtn(tool, iconName, labelKey) {
    const btn = h(
      'button',
      { class: `nx-whiteboard-btn ${activeTool === tool ? 'active' : ''}`, title: t(labelKey) },
      icon(iconName),
    );
    btn.onclick = () => setTool(tool);
    toolButtons[tool] = btn;
    return btn;
  }

  const toolbar = h(
    'div',
    { class: 'nx-whiteboard-toolbar' },
    h(
      'div',
      { class: 'nx-whiteboard-toolbar-group' },
      h(
        'button',
        {
          class: 'nx-whiteboard-btn',
          title: t('actions.undo', 'Undo'),
          onclick: () => undoAction(),
        },
        icon('undo'),
      ),
      h(
        'button',
        {
          class: 'nx-whiteboard-btn',
          title: t('actions.redo', 'Redo'),
          onclick: () => redoAction(),
        },
        icon('redo'),
      ),
    ),
    h('div', { class: 'nx-whiteboard-separator' }),
    h(
      'div',
      { class: 'nx-whiteboard-toolbar-group' },
      makeToolBtn('select', 'select-box', 'tools.select'),
      makeToolBtn('pen', 'edit', 'tools.pen'),
      makeToolBtn('highlighter', 'sun', 'tools.highlighter'),
      makeToolBtn('eraser', 'trash', 'tools.eraser'),
    ),
    h('div', { class: 'nx-whiteboard-separator' }),
    h(
      'div',
      { class: 'nx-whiteboard-toolbar-group' },
      makeToolBtn('rect', 'maximize', 'tools.rect'),
      makeToolBtn('ellipse', 'target', 'tools.ellipse'),
      makeToolBtn('line', 'minus', 'tools.line'),
      makeToolBtn('arrow', 'arrow-right', 'tools.arrow'),
    ),
    h('div', { class: 'nx-whiteboard-separator' }),
    h(
      'div',
      { class: 'nx-whiteboard-toolbar-group' },
      makeToolBtn('sticky', 'sticky-note', 'tools.sticky'),
      makeToolBtn('text', 'file-text', 'tools.text'),
      makeToolBtn('frame', 'layout-quarters', 'tools.frame'),
    ),
    h('div', { class: 'nx-whiteboard-separator' }),
    h(
      'div',
      { class: 'nx-whiteboard-toolbar-group' },
      h(
        'button',
        {
          class: 'nx-whiteboard-btn',
          title: t('actions.duplicate', 'Duplicate'),
          onclick: () => duplicateSelected(),
        },
        icon('copy'),
      ),
      h(
        'button',
        {
          class: 'nx-whiteboard-btn',
          title: t('actions.delete', 'Delete'),
          onclick: () => deleteSelected(),
        },
        icon('trash'),
      ),
    ),
  );

  // ─── Property Bar ───────────────────────────────────────────────────────
  const propsBar = h('div', { class: 'nx-whiteboard-props' });

  function updatePropsBar() {
    propsBar.innerHTML = '';

    // Color Swatches
    const colorSwatches = ['#000000', '#2563eb', '#16a34a', '#dc2626', '#d97706', '#9333ea'];
    const swatchGroup = h('div', { class: 'nx-whiteboard-prop-item' }, h('span', {}, 'Color:'));
    colorSwatches.forEach((col) => {
      const swatch = h('span', {
        class: 'nx-whiteboard-color-swatch',
        style: `background-color: ${col}; ${activeStrokeColor === col ? 'outline: 2px solid var(--accent); outline-offset: 1px;' : ''}`,
        onclick: () => {
          activeStrokeColor = col;
          if (selectedIds.length > 0) {
            saveHistory();
            board.elements.forEach((el) => {
              if (selectedIds.includes(el.id)) {
                el.stroke = col;
                if (el.type === 'text') el.color = col;
              }
            });
            render();
          }
          updatePropsBar();
        },
      });
      swatchGroup.appendChild(swatch);
    });
    propsBar.appendChild(swatchGroup);

    // Thickness
    const widthGroup = h(
      'div',
      { class: 'nx-whiteboard-prop-item', style: 'margin-left: 12px;' },
      h('span', {}, t('properties.strokeWidth', 'Thickness:')),
    );
    [2, 4, 8].forEach((w) => {
      const btn = h(
        'button',
        {
          class: `nx-whiteboard-btn ${activeStrokeWidth === w ? 'active' : ''}`,
          onclick: () => {
            activeStrokeWidth = w;
            if (selectedIds.length > 0) {
              saveHistory();
              board.elements.forEach((el) => {
                if (selectedIds.includes(el.id)) el.strokeWidth = w;
              });
              render();
            }
            updatePropsBar();
          },
        },
        `${w}px`,
      );
      widthGroup.appendChild(btn);
    });
    propsBar.appendChild(widthGroup);

    // Sticky note color options
    if (
      activeTool === 'sticky' ||
      selectedIds.some((id) => board.elements.find((e) => e.id === id)?.type === 'sticky')
    ) {
      const stickyGroup = h(
        'div',
        { class: 'nx-whiteboard-prop-item', style: 'margin-left: 12px;' },
        h('span', {}, 'Sticky:'),
      );
      Object.keys(STICKY_COLORS).forEach((colorKey) => {
        const swatch = h('span', {
          class: 'nx-whiteboard-color-swatch',
          style: `background-color: ${STICKY_COLORS[colorKey]}; ${activeStickyColor === colorKey ? 'outline: 2px solid var(--accent);' : ''}`,
          onclick: () => {
            activeStickyColor = colorKey;
            if (selectedIds.length > 0) {
              saveHistory();
              board.elements.forEach((el) => {
                if (selectedIds.includes(el.id) && el.type === 'sticky') el.color = colorKey;
              });
              render();
            }
            updatePropsBar();
          },
        });
        stickyGroup.appendChild(swatch);
      });
      propsBar.appendChild(stickyGroup);
    }
  }
  updatePropsBar();

  // ─── Canvas Viewport ────────────────────────────────────────────────────
  const canvas = h('canvas', { class: 'nx-whiteboard-canvas' });
  const viewport = h('div', { class: 'nx-whiteboard-viewport tool-select' }, canvas);

  // Zoom Widget
  const zoomLabel = h('span', { class: 'nx-whiteboard-zoom-label' }, '100%');
  const zoomInBtn = h('button', { class: 'nx-whiteboard-btn', title: t('actions.zoomIn', 'Zoom In') }, icon('zoom-in'));
  const zoomOutBtn = h(
    'button',
    { class: 'nx-whiteboard-btn', title: t('actions.zoomOut', 'Zoom Out') },
    icon('zoom-out'),
  );
  const zoomResetBtn = h(
    'button',
    { class: 'nx-whiteboard-btn', title: t('actions.zoomReset', 'Reset Zoom') },
    icon('refresh'),
  );
  const zoomFitBtn = h(
    'button',
    { class: 'nx-whiteboard-btn', title: t('actions.zoomFit', 'Fit Content') },
    icon('maximize'),
  );

  zoomInBtn.onclick = () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.2);
  zoomOutBtn.onclick = () => zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / 1.2);
  zoomResetBtn.onclick = () => {
    board.viewport.zoom = 1;
    board.viewport.x = 0;
    board.viewport.y = 0;
    updateZoomLabel();
    render();
  };
  zoomFitBtn.onclick = () => fitAllContent();

  const zoomWidget = h(
    'div',
    { class: 'nx-whiteboard-zoom-widget' },
    zoomOutBtn,
    zoomLabel,
    zoomInBtn,
    zoomResetBtn,
    zoomFitBtn,
  );
  viewport.appendChild(zoomWidget);

  root.appendChild(header);
  root.appendChild(toolbar);
  root.appendChild(propsBar);
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
    zoomLabel.textContent = `${Math.round(board.viewport.zoom * 100)}%`;
  }

  function zoomAt(screenX, screenY, factor) {
    const oldZoom = board.viewport.zoom;
    const newZoom = Math.max(0.1, Math.min(5, oldZoom * factor));
    const worldX = (screenX - board.viewport.x) / oldZoom;
    const worldY = (screenY - board.viewport.y) / oldZoom;
    board.viewport.zoom = newZoom;
    board.viewport.x = screenX - worldX * newZoom;
    board.viewport.y = screenY - worldY * newZoom;
    updateZoomLabel();
    render();
  }

  function fitAllContent() {
    if (board.elements.length === 0) return;
    const bounds = getBoardBounds(board.elements);
    const padding = 80;
    const vw = viewport.clientWidth - padding * 2;
    const vh = viewport.clientHeight - padding * 2;
    const scale = Math.max(0.1, Math.min(2, Math.min(vw / bounds.width, vh / bounds.height)));
    board.viewport.zoom = scale;
    board.viewport.x = (viewport.clientWidth - bounds.width * scale) / 2 - bounds.minX * scale;
    board.viewport.y = (viewport.clientHeight - bounds.height * scale) / 2 - bounds.minY * scale;
    updateZoomLabel();
    render();
  }

  // Convert screen coordinates to world coordinates
  function screenToWorld(sx, sy) {
    return {
      x: (sx - board.viewport.x) / board.viewport.zoom,
      y: (sy - board.viewport.y) / board.viewport.zoom,
    };
  }

  // ─── History Management ─────────────────────────────────────────────────
  function saveHistory() {
    undoStack.push(serializeBoard(board));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    updateStatus(true);
  }

  function undoAction() {
    if (undoStack.length === 0) return;
    redoStack.push(serializeBoard(board));
    const prev = undoStack.pop();
    if (prev) {
      board = parseBoard(prev);
      selectedIds = [];
      render();
    }
  }

  function redoAction() {
    if (redoStack.length === 0) return;
    undoStack.push(serializeBoard(board));
    const next = redoStack.pop();
    if (next) {
      board = parseBoard(next);
      selectedIds = [];
      render();
    }
  }

  // ─── Rendering Engine ───────────────────────────────────────────────────
  function render() {
    if (!ctx2d) return;
    const dpr = window.devicePixelRatio || 1;

    ctx2d.save();
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    ctx2d.scale(dpr, dpr);
    ctx2d.translate(board.viewport.x, board.viewport.y);
    ctx2d.scale(board.viewport.zoom, board.viewport.zoom);

    // 1. Render all committed elements
    board.elements.forEach((el) => {
      drawElement(ctx2d, el, selectedIds.includes(el.id));
    });

    // 2. Render actively drawing element
    if (drawingElement) {
      drawElement(ctx2d, drawingElement, false);
    }

    // 3. Selection Bounding Boxes & Handles
    if (selectedIds.length > 0) {
      selectedIds.forEach((id) => {
        const el = board.elements.find((e) => e.id === id);
        if (el) {
          const b = getElementBounds(el);
          ctx2d.save();
          ctx2d.strokeStyle = '#3b82f6';
          ctx2d.lineWidth = 1.5 / board.viewport.zoom;
          ctx2d.setLineDash([4 / board.viewport.zoom, 4 / board.viewport.zoom]);
          ctx2d.strokeRect(b.minX - 4, b.minY - 4, b.width + 8, b.height + 8);
          ctx2d.restore();
        }
      });
    }

    ctx2d.restore();
  }

  function drawElement(ctx, el, _isSelected) {
    ctx.save();
    if (typeof el.opacity === 'number') ctx.globalAlpha = el.opacity;

    switch (el.type) {
      case 'pen':
      case 'highlighter': {
        if (!el.points || el.points.length === 0) break;
        ctx.strokeStyle = el.stroke || '#000000';
        ctx.lineWidth = el.strokeWidth || (el.type === 'highlighter' ? 14 : 3);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (el.type === 'highlighter') ctx.globalAlpha = 0.35;

        ctx.beginPath();
        el.points.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        break;
      }
      case 'rect': {
        const rw = el.width || 100;
        const rh = el.height || 60;
        ctx.fillStyle = el.fill || '#dbeafe';
        ctx.strokeStyle = el.stroke || '#2563eb';
        ctx.lineWidth = el.strokeWidth || 2;
        ctx.fillRect(el.x, el.y, rw, rh);
        ctx.strokeRect(el.x, el.y, rw, rh);
        break;
      }
      case 'ellipse': {
        const rx = (el.width || 100) / 2;
        const ry = (el.height || 60) / 2;
        ctx.fillStyle = el.fill || '#dbeafe';
        ctx.strokeStyle = el.stroke || '#2563eb';
        ctx.lineWidth = el.strokeWidth || 2;
        ctx.beginPath();
        ctx.ellipse(el.x + rx, el.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'line': {
        ctx.strokeStyle = el.stroke || '#000000';
        ctx.lineWidth = el.strokeWidth || 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x2 ?? el.x, el.y2 ?? el.y);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        ctx.strokeStyle = el.stroke || '#2563eb';
        ctx.lineWidth = el.strokeWidth || 2;
        ctx.lineCap = 'round';
        const tx = el.x2 ?? el.x;
        const ty = el.y2 ?? el.y;

        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        // Draw Arrowhead
        const angle = Math.atan2(ty - el.y, tx - el.x);
        const headLength = 12;
        ctx.fillStyle = el.stroke || '#2563eb';
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - headLength * Math.cos(angle - Math.PI / 6), ty - headLength * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(tx - headLength * Math.cos(angle + Math.PI / 6), ty - headLength * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'sticky': {
        const sw = el.width || 140;
        const sh = el.height || 140;
        const scolor = STICKY_COLORS[el.color || 'yellow'] || STICKY_COLORS.yellow;

        // Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;

        ctx.fillStyle = scolor;
        ctx.fillRect(el.x, el.y, sw, sh);

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        ctx.strokeRect(el.x, el.y, sw, sh);

        // Sticky text
        ctx.fillStyle = '#1f2937';
        ctx.font = '14px sans-serif';
        const lines = (el.text || '').split('\n');
        lines.forEach((l, i) => {
          ctx.fillText(l, el.x + 12, el.y + 26 + i * 18, sw - 24);
        });
        break;
      }
      case 'text': {
        ctx.fillStyle = el.color || '#000000';
        const fs = el.fontSize || 18;
        ctx.font = `${fs}px ${el.fontFamily || 'sans-serif'}`;
        const tlines = (el.text || '').split('\n');
        tlines.forEach((l, i) => {
          ctx.fillText(l, el.x, el.y + fs + i * (fs * 1.3));
        });
        break;
      }
      case 'frame': {
        const fw = el.width || 400;
        const fh = el.height || 300;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(el.x, el.y, fw, fh);
        ctx.setLineDash([]);

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(el.title || 'Frame', el.x + 6, el.y - 8);
        break;
      }
    }
    ctx.restore();
  }

  // ─── Pointer Event Handlers ─────────────────────────────────────────────
  viewport.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    const rect = viewport.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Pan with Space or middle click or right click
    if (e.spaceKey || e.button === 1 || e.button === 2) {
      isPanning = true;
      panStartX = sx - board.viewport.x;
      panStartY = sy - board.viewport.y;
      viewport.classList.add('tool-panning');
      return;
    }

    const { x, y } = screenToWorld(sx, sy);
    dragStartX = x;
    dragStartY = y;

    if (activeTool === 'select') {
      // Find element clicked (reverse order to pick top element)
      const hit = [...board.elements].reverse().find((el) => hitTestElement(el, x, y));
      if (hit) {
        if (e.shiftKey) {
          if (selectedIds.includes(hit.id)) {
            selectedIds = selectedIds.filter((id) => id !== hit.id);
          } else {
            selectedIds.push(hit.id);
          }
        } else {
          if (!selectedIds.includes(hit.id)) {
            selectedIds = [hit.id];
          }
        }
      } else {
        selectedIds = [];
      }
      render();
    } else if (activeTool === 'pen' || activeTool === 'highlighter') {
      drawingElement = {
        id: generateElementId('stroke'),
        type: activeTool,
        x,
        y,
        stroke: activeStrokeColor,
        strokeWidth: activeTool === 'highlighter' ? 16 : activeStrokeWidth,
        points: [{ x, y, pressure: e.pressure || 0.5 }],
      };
      render();
    } else if (activeTool === 'eraser') {
      eraseAt(x, y);
    } else if (activeTool === 'rect' || activeTool === 'ellipse') {
      drawingElement = {
        id: generateElementId('shape'),
        type: activeTool,
        x,
        y,
        width: 0,
        height: 0,
        stroke: activeStrokeColor,
        strokeWidth: activeStrokeWidth,
        fill: activeFillColor,
      };
    } else if (activeTool === 'line' || activeTool === 'arrow') {
      drawingElement = {
        id: generateElementId('line'),
        type: activeTool,
        x,
        y,
        x2: x,
        y2: y,
        stroke: activeStrokeColor,
        strokeWidth: activeStrokeWidth,
      };
    } else if (activeTool === 'sticky') {
      saveHistory();
      const newSticky = {
        id: generateElementId('sticky'),
        type: /** @type {const} */ ('sticky'),
        x: Math.round(x - 70),
        y: Math.round(y - 70),
        width: 140,
        height: 140,
        color: activeStickyColor,
        text: 'New Note',
      };
      board.elements.push(newSticky);
      selectedIds = [newSticky.id];
      setTool('select');
      render();
    } else if (activeTool === 'text') {
      saveHistory();
      const newText = {
        id: generateElementId('text'),
        type: /** @type {const} */ ('text'),
        x: Math.round(x),
        y: Math.round(y),
        color: activeStrokeColor,
        fontSize: 18,
        text: 'Type text here',
      };
      board.elements.push(newText);
      selectedIds = [newText.id];
      setTool('select');
      render();
    } else if (activeTool === 'frame') {
      drawingElement = {
        id: generateElementId('frame'),
        type: 'frame',
        x,
        y,
        width: 0,
        height: 0,
        title: `Slide ${board.elements.filter((e) => e.type === 'frame').length + 1}`,
      };
    }
  });

  viewport.addEventListener('pointermove', (e) => {
    const rect = viewport.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (isPanning) {
      board.viewport.x = sx - panStartX;
      board.viewport.y = sy - panStartY;
      render();
      return;
    }

    if (!isPointerDown) return;
    const { x, y } = screenToWorld(sx, sy);

    if (activeTool === 'select' && selectedIds.length > 0) {
      const dx = x - dragStartX;
      const dy = y - dragStartY;
      dragStartX = x;
      dragStartY = y;

      board.elements.forEach((el) => {
        if (selectedIds.includes(el.id)) {
          el.x += dx;
          el.y += dy;
          if (el.x2 !== undefined) el.x2 += dx;
          if (el.y2 !== undefined) el.y2 += dy;
          if (el.points) {
            el.points.forEach((p) => {
              p.x += dx;
              p.y += dy;
            });
          }
        }
      });
      render();
    } else if (drawingElement) {
      if (drawingElement.type === 'pen' || drawingElement.type === 'highlighter') {
        drawingElement.points?.push({ x, y, pressure: e.pressure || 0.5 });
      } else if (
        drawingElement.type === 'rect' ||
        drawingElement.type === 'ellipse' ||
        drawingElement.type === 'frame'
      ) {
        drawingElement.width = Math.round(x - drawingElement.x);
        drawingElement.height = Math.round(y - drawingElement.y);
      } else if (drawingElement.type === 'line' || drawingElement.type === 'arrow') {
        drawingElement.x2 = Math.round(x);
        drawingElement.y2 = Math.round(y);
      }
      render();
    } else if (activeTool === 'eraser') {
      eraseAt(x, y);
    }
  });

  viewport.addEventListener('pointerup', () => {
    if (isPanning) {
      isPanning = false;
      viewport.classList.remove('tool-panning');
    }

    if (drawingElement) {
      saveHistory();
      // Normalize negative width/height
      if (drawingElement.width !== undefined && drawingElement.width < 0) {
        drawingElement.x += drawingElement.width;
        drawingElement.width = Math.abs(drawingElement.width);
      }
      if (drawingElement.height !== undefined && drawingElement.height < 0) {
        drawingElement.y += drawingElement.height;
        drawingElement.height = Math.abs(drawingElement.height);
      }

      board.elements.push(drawingElement);
      selectedIds = [drawingElement.id];
      drawingElement = null;
      render();
    }

    isPointerDown = false;
  });

  // Wheel zoom
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
        board.viewport.x -= e.deltaX;
        board.viewport.y -= e.deltaY;
        render();
      }
    },
    { passive: false },
  );

  function eraseAt(x, y) {
    const toRemove = board.elements.filter((el) => hitTestElement(el, x, y, 12));
    if (toRemove.length > 0) {
      saveHistory();
      const removeIds = new Set(toRemove.map((e) => e.id));
      board.elements = board.elements.filter((e) => !removeIds.has(e.id));
      selectedIds = selectedIds.filter((id) => !removeIds.has(id));
      render();
    }
  }

  // Double click to edit sticky or text inline
  viewport.addEventListener('dblclick', async (e) => {
    const rect = viewport.getBoundingClientRect();
    const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const hit = [...board.elements].reverse().find((el) => hitTestElement(el, x, y));

    if (hit && (hit.type === 'sticky' || hit.type === 'text')) {
      const textarea = h('textarea', {
        rows: 5,
        style: 'width: 100%; font-size: 14px;',
      });
      textarea.value = hit.text || '';

      const ok = await openModal({
        title: 'Edit Text',
        body: textarea,
        actions: [
          { label: 'Cancel', value: false, variant: 'ghost' },
          { label: 'Apply', value: true, variant: 'primary' },
        ],
        dismissValue: false,
      });

      if (ok) {
        saveHistory();
        hit.text = textarea.value;
        render();
      }
    }
  });

  // ─── Actions & Shortcuts ────────────────────────────────────────────────
  function deleteSelected() {
    if (selectedIds.length === 0) return;
    saveHistory();
    board.elements = board.elements.filter((el) => !selectedIds.includes(el.id));
    selectedIds = [];
    render();
  }

  function duplicateSelected() {
    if (selectedIds.length === 0) return;
    saveHistory();
    const newElements = [];
    const newSelectedIds = [];
    board.elements.forEach((el) => {
      if (selectedIds.includes(el.id)) {
        const copy = JSON.parse(JSON.stringify(el));
        copy.id = generateElementId('copy');
        copy.x += 30;
        copy.y += 30;
        if (copy.x2 !== undefined) copy.x2 += 30;
        if (copy.y2 !== undefined) copy.y2 += 30;
        if (copy.points) {
          copy.points.forEach((p) => {
            p.x += 30;
            p.y += 30;
          });
        }
        newElements.push(copy);
        newSelectedIds.push(copy.id);
      }
    });
    board.elements.push(...newElements);
    selectedIds = newSelectedIds;
    render();
  }

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelected();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redoAction();
      else undoAction();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      redoAction();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      duplicateSelected();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveBoard();
    } else if (e.key === 'v' || e.key === 'V') {
      setTool('select');
    } else if (e.key === 'p' || e.key === 'P') {
      setTool('pen');
    } else if (e.key === 'h' || e.key === 'H') {
      setTool('highlighter');
    } else if (e.key === 'e' || e.key === 'E') {
      setTool('eraser');
    } else if (e.key === 'r' || e.key === 'R') {
      setTool('rect');
    } else if (e.key === 'o' || e.key === 'O') {
      setTool('ellipse');
    } else if (e.key === 'l' || e.key === 'L') {
      setTool('line');
    } else if (e.key === 'a' || e.key === 'A') {
      setTool('arrow');
    } else if (e.key === 's' || e.key === 'S') {
      setTool('sticky');
    } else if (e.key === 't' || e.key === 'T') {
      setTool('text');
    } else if (e.key === 'f' || e.key === 'F') {
      setTool('frame');
    }
  });

  // ─── File Operations & Exports ──────────────────────────────────────────
  async function saveBoard() {
    if (!currentPath) {
      await saveAsBoard();
      return;
    }
    if (fs) {
      board.metadata.modified = Date.now();
      await fs.writeFile(currentPath, serializeBoard(board));
      updateStatus(false);
    }
  }

  async function saveAsBoard() {
    const defaultName = `${board.title.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'whiteboard'}.nboard`;
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
      await saveBoard();
    }
  }

  function showFileMenu(anchor) {
    openMenu(
      [
        {
          label: t('file.new', 'New Whiteboard'),
          icon: 'file-plus',
          run: () => {
            board = createBoard(t('app.untitled', 'Untitled Whiteboard'));
            titleInput.value = board.title;
            currentPath = null;
            selectedIds = [];
            updateStatus(false);
            render();
          },
        },
        {
          label: t('file.open', 'Open...'),
          icon: 'folder-open',
          run: () => promptOpenBoard(),
        },
        'separator',
        {
          label: t('file.save', 'Save'),
          icon: 'download',
          shortcut: 'Mod+S',
          run: () => saveBoard(),
        },
        {
          label: t('file.saveAs', 'Save As...'),
          icon: 'download',
          run: () => saveAsBoard(),
        },
        'separator',
        {
          label: t('file.templates', 'Board Templates'),
          icon: 'cards',
          run: () => showTemplatesDialog(),
        },
        {
          label: t('file.export', 'Export'),
          icon: 'share',
          submenu: [
            {
              label: t('file.exportSvg', 'Export as SVG (.svg)'),
              run: () => exportSvgFile(),
            },
            {
              label: t('file.exportPng', 'Export as PNG (.png)'),
              run: () => exportPngFile(),
            },
            {
              label: t('file.exportNboard', 'Export as Nexus Board (.nboard)'),
              run: () => downloadFile(`${board.title}.nboard`, serializeBoard(board), 'application/json'),
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
          label: t('file.exportNboard', 'Export as Nexus Board (.nboard)'),
          icon: 'download',
          run: () => downloadFile(`${board.title}.nboard`, serializeBoard(board), 'application/json'),
        },
      ],
      { anchor },
    );
  }

  async function promptOpenBoard() {
    const input = h('input', { type: 'text', placeholder: '/home/documents/board.nboard', class: 'nx-input' });
    const ok = await openModal({
      title: t('file.open', 'Open Whiteboard'),
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
      board = parseBoard(data);
      titleInput.value = board.title;
      selectedIds = [];
      updateStatus(false);
      render();
    }
  }

  async function showTemplatesDialog() {
    const templateList = Object.values(WHITEBOARD_TEMPLATES);
    const list = h('div', { style: 'display: flex; flex-direction: column; gap: 8px;' });

    let chosen = templateList[0];

    const modal = openModal({
      title: t('templates.choose', 'Choose a Board Template'),
      body: list,
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        {
          label: t('templates.use', 'Use Template'),
          value: true,
          variant: 'primary',
          accept: () => {
            if (isDirty) {
              if (!confirm(t('dialog.confirmUnsaved', 'You have unsaved changes. Continue anyway?'))) {
                return false;
              }
            }
            board = chosen.create();
            titleInput.value = board.title;
            currentPath = null;
            selectedIds = [];
            updateStatus(false);
            fitAllContent();
            return true;
          },
        },
      ],
      dismissValue: false,
    });

    templateList.forEach((tmpl, i) => {
      const radio = h('input', { type: 'radio', name: 'wb_template', checked: i === 0 });
      const row = h(
        'label',
        {
          style:
            'display: flex; align-items: flex-start; gap: 10px; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;',
          onclick: () => {
            radio.checked = true;
            chosen = tmpl;
          },
        },
        radio,
        h(
          'div',
          {},
          h('strong', {}, tmpl.name.en),
          h('div', { style: 'font-size: 12px; color: var(--text-3);' }, tmpl.description.en),
        ),
      );
      list.appendChild(row);
    });

    await modal;
  }

  function exportSvgFile() {
    const svgStr = exportToSvg(board.elements);
    downloadFile(`${board.title}.svg`, svgStr, 'image/svg+xml');
  }

  function exportPngFile() {
    const bounds = getBoardBounds(board.elements);
    const offCanvas = document.createElement('canvas');
    offCanvas.width = bounds.width;
    offCanvas.height = bounds.height;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    // Fill white background
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, bounds.width, bounds.height);

    offCtx.translate(-bounds.minX, -bounds.minY);
    board.elements.forEach((el) => {
      drawElement(offCtx, el, false);
    });

    offCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${board.title}.png`;
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
      board: serializeBoard(board),
      path: currentPath,
    }),
  };
}
