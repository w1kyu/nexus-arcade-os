// @ts-check
import { h, icon } from '../../ui/dom.js';
import { openMenu } from '../../ui/menu.js';
import { openModal } from '../../ui/overlay.js';
import {
  applyBlur,
  applyBrightnessContrast,
  applyGrayscale,
  applyHueSaturation,
  applyInvert,
  floodFill,
  generateLayerId,
  parseColorToRgba,
  parsePaintDoc,
  PRESET_PALETTES,
  serializePaintDoc,
} from './model.js';
import './styles.css';

/**
 * Commands exported by nexus.paint.
 * @type {import('../../kernel/types').AppModule['commands']}
 */
export const commands = {
  'paint.new': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.paint', args: { newFile: true } }),
};

/**
 * Main application mount for Nexus Paint.
 * @type {import('../../kernel/types').AppModule['mount']}
 */
export async function mount(container, ctx, args) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ [vars]) => ctx.i18n.t(key, vars);
  const fs = /** @type {any} */ (ctx.fs);

  let currentPath = /** @type {string | null} */ (args.path ?? null);

  // Active Tool & Properties
  /** @type {'brush' | 'softBrush' | 'pencil' | 'spray' | 'eraser' | 'bucket' | 'eyedropper' | 'rect' | 'ellipse' | 'line' | 'text' | 'select'} */
  let activeTool = 'brush';
  let activeColor = '#2563eb';
  let activeBrushSize = 12;
  let activeOpacity = 1;
  let isSymmetry = false;
  let currentZoom = 1;

  // Document Dimensions & Layers
  let docWidth = 800;
  let docHeight = 600;
  let docTitle = t('app.untitled', 'Untitled Painting');

  /**
   * @typedef {object} RuntimeLayer
   * @property {string} id
   * @property {string} name
   * @property {boolean} visible
   * @property {number} opacity
   * @property {GlobalCompositeOperation} blendMode
   * @property {HTMLCanvasElement} canvas
   * @property {CanvasRenderingContext2D} ctx
   */

  /** @type {RuntimeLayer[]} */
  let layers = [];
  let activeLayerId = '';

  // Interaction State
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let shapeStartX = 0;
  let shapeStartY = 0;

  // History Stack (Undo/Redo)
  /** @type {string[]} */
  const undoStack = [];
  /** @type {string[]} */
  const redoStack = [];
  const MAX_HISTORY = 50;

  // Initialize Root
  const root = h('div', { class: 'nx-paint' });
  container.appendChild(root);

  // ─── Header ─────────────────────────────────────────────────────────────
  const titleInput = h('input', {
    class: 'nx-paint-title-input',
    type: 'text',
    value: docTitle,
    title: t('app.title', 'Nexus Paint'),
  });

  const statusLabel = h('span', { class: 'nx-paint-status' }, '');

  function updateStatus(dirty) {
    statusLabel.textContent = dirty ? '●' : '';
    statusLabel.title = dirty ? 'Unsaved changes' : 'All changes saved';
  }

  titleInput.oninput = () => {
    docTitle = titleInput.value.trim() || t('app.untitled', 'Untitled Painting');
    updateStatus(true);
  };

  const fileMenuBtn = h('button', { class: 'nx-paint-btn', title: t('file.menu', 'File') }, icon('menu'), ' File');
  fileMenuBtn.onclick = () => showFileMenu(fileMenuBtn);

  const adjustMenuBtn = h(
    'button',
    { class: 'nx-paint-btn', title: t('adjustments.title', 'Adjustments') },
    icon('sliders'),
    ' Adjust',
  );
  adjustMenuBtn.onclick = () => showAdjustmentsMenu(adjustMenuBtn);

  const resizeBtn = h('button', { class: 'nx-paint-btn', title: t('file.resizeCanvas', 'Resize') }, icon('maximize'));
  resizeBtn.onclick = () => promptResizeCanvas();

  const exportBtn = h(
    'button',
    { class: 'nx-paint-btn', title: t('file.export', 'Export') },
    icon('download'),
    ' Export',
  );
  exportBtn.onclick = () => showExportMenu(exportBtn);

  const header = h(
    'div',
    { class: 'nx-paint-header' },
    h(
      'div',
      { class: 'nx-paint-title-area' },
      h('div', { class: 'nx-paint-icon' }, icon('palette')),
      titleInput,
      statusLabel,
    ),
    h('div', { class: 'nx-paint-actions' }, fileMenuBtn, adjustMenuBtn, resizeBtn, exportBtn),
  );

  // ─── Properties Bar (Horizontal) ─────────────────────────────────────────
  const sizeSlider = h('input', {
    type: 'range',
    min: '1',
    max: '100',
    value: String(activeBrushSize),
    class: 'nx-paint-range',
  });
  const sizeLabel = h('span', { style: 'min-width: 30px;' }, `${activeBrushSize}px`);
  sizeSlider.oninput = () => {
    activeBrushSize = parseInt(sizeSlider.value, 10);
    sizeLabel.textContent = `${activeBrushSize}px`;
  };

  const opacitySlider = h('input', {
    type: 'range',
    min: '1',
    max: '100',
    value: '100',
    class: 'nx-paint-range',
  });
  const opacityLabel = h('span', { style: 'min-width: 32px;' }, '100%');
  opacitySlider.oninput = () => {
    activeOpacity = parseInt(opacitySlider.value, 10) / 100;
    opacityLabel.textContent = `${Math.round(activeOpacity * 100)}%`;
  };

  const colorInput = h('input', {
    type: 'color',
    value: activeColor,
    style:
      'width: 26px; height: 26px; padding: 0; border: 1px solid var(--border); border-radius: 4px; cursor: pointer;',
  });
  colorInput.oninput = () => {
    activeColor = colorInput.value;
  };

  const symmetryBtn = h(
    'button',
    {
      class: `nx-paint-btn ${isSymmetry ? 'active' : ''}`,
      title: t('toolbar.symmetry', 'Symmetry'),
      onclick: () => {
        isSymmetry = !isSymmetry;
        symmetryBtn.classList.toggle('active', isSymmetry);
      },
    },
    icon('layout-split'),
  );

  const propsBar = h(
    'div',
    { class: 'nx-paint-props-bar' },
    h(
      'div',
      { class: 'nx-paint-prop-group' },
      h(
        'button',
        { class: 'nx-paint-btn', title: t('toolbar.undo', 'Undo'), onclick: () => undoAction() },
        icon('undo'),
      ),
      h(
        'button',
        { class: 'nx-paint-btn', title: t('toolbar.redo', 'Redo'), onclick: () => redoAction() },
        icon('redo'),
      ),
    ),
    h('div', { class: 'nx-paint-separator' }),
    h('div', { class: 'nx-paint-prop-group' }, h('span', {}, 'Size:'), sizeSlider, sizeLabel),
    h('div', { class: 'nx-paint-separator' }),
    h('div', { class: 'nx-paint-prop-group' }, h('span', {}, 'Opacity:'), opacitySlider, opacityLabel),
    h('div', { class: 'nx-paint-separator' }),
    h('div', { class: 'nx-paint-prop-group' }, h('span', {}, 'Color:'), colorInput),
    h('div', { class: 'nx-paint-separator' }),
    symmetryBtn,
  );

  // Palette swatches
  PRESET_PALETTES.slice(0, 8).forEach((col) => {
    const swatch = h('span', {
      class: 'nx-paint-color-swatch',
      style: `background-color: ${col};`,
      onclick: () => {
        activeColor = col;
        colorInput.value = col;
      },
    });
    propsBar.appendChild(swatch);
  });

  // ─── Tools Shelf (Left Vertical) ─────────────────────────────────────────
  const toolButtons = /** @type {Record<string, HTMLButtonElement>} */ ({});

  function setTool(tool) {
    activeTool = tool;
    Object.keys(toolButtons).forEach((k) => {
      toolButtons[k].classList.toggle('active', k === tool);
    });
  }

  function makeToolBtn(tool, iconName, labelKey) {
    const btn = h(
      'button',
      { class: `nx-paint-btn ${activeTool === tool ? 'active' : ''}`, title: t(labelKey) },
      icon(iconName),
    );
    btn.onclick = () => setTool(tool);
    toolButtons[tool] = btn;
    return btn;
  }

  const toolsShelf = h(
    'div',
    { class: 'nx-paint-tools-shelf' },
    makeToolBtn('brush', 'edit', 'tools.brush'),
    makeToolBtn('softBrush', 'sun', 'tools.softBrush'),
    makeToolBtn('pencil', 'edit', 'tools.pencil'),
    makeToolBtn('spray', 'sparkles', 'tools.spray'),
    makeToolBtn('eraser', 'trash', 'tools.eraser'),
    makeToolBtn('bucket', 'palette', 'tools.bucket'),
    makeToolBtn('eyedropper', 'target', 'tools.eyedropper'),
    h('div', { class: 'nx-paint-separator', style: 'width: 24px; height: 1px; margin: 4px 0;' }),
    makeToolBtn('rect', 'maximize', 'tools.rect'),
    makeToolBtn('ellipse', 'target', 'tools.ellipse'),
    makeToolBtn('line', 'minus', 'tools.line'),
    makeToolBtn('text', 'file-text', 'tools.text'),
    makeToolBtn('select', 'select-box', 'tools.select'),
  );

  // ─── Center Viewport & Canvas Stage ──────────────────────────────────────
  const stage = h('div', { class: 'nx-paint-stage', style: `width: ${docWidth}px; height: ${docHeight}px;` });
  const previewCanvas = h('canvas', {
    class: 'nx-paint-preview-canvas',
    width: docWidth,
    height: docHeight,
    style: `width: ${docWidth}px; height: ${docHeight}px;`,
  });
  const previewCtx = /** @type {CanvasRenderingContext2D} */ (previewCanvas.getContext('2d'));

  const viewport = h('div', { class: 'nx-paint-viewport' }, stage);

  // ─── Layers Panel (Right Vertical) ───────────────────────────────────────
  const layersList = h('ul', { class: 'nx-paint-layers-list' });

  const addLayerBtn = h('button', { class: 'nx-paint-btn', title: t('layers.add', 'Add Layer') }, icon('plus'));
  addLayerBtn.onclick = () => addNewLayer();

  const dupLayerBtn = h(
    'button',
    { class: 'nx-paint-btn', title: t('layers.duplicate', 'Duplicate Layer') },
    icon('copy'),
  );
  dupLayerBtn.onclick = () => duplicateActiveLayer();

  const mergeLayerBtn = h(
    'button',
    { class: 'nx-paint-btn', title: t('layers.mergeDown', 'Merge Down') },
    icon('chevron-down'),
  );
  mergeLayerBtn.onclick = () => mergeActiveLayerDown();

  const delLayerBtn = h('button', { class: 'nx-paint-btn', title: t('layers.delete', 'Delete Layer') }, icon('trash'));
  delLayerBtn.onclick = () => deleteActiveLayer();

  const layersPanel = h(
    'div',
    { class: 'nx-paint-layers-panel' },
    h('div', { class: 'nx-paint-layers-header' }, h('span', {}, t('layers.title', 'Layers'))),
    layersList,
    h('div', { class: 'nx-paint-layers-footer' }, addLayerBtn, dupLayerBtn, mergeLayerBtn, delLayerBtn),
  );

  // ─── Status Bar / Footer ────────────────────────────────────────────────
  const coordsLabel = h('span', {}, 'X: 0, Y: 0');
  const dimsLabel = h('span', {}, `${docWidth} × ${docHeight} px`);
  const zoomLabel = h('span', {}, '100%');

  const footer = h(
    'div',
    { class: 'nx-paint-footer' },
    h('div', { class: 'nx-paint-status-info' }, dimsLabel, coordsLabel),
    h(
      'div',
      { class: 'nx-paint-status-info' },
      h(
        'button',
        { class: 'nx-paint-btn', title: t('toolbar.zoomOut', 'Zoom Out'), onclick: () => zoom(0.8) },
        icon('minus'),
      ),
      zoomLabel,
      h(
        'button',
        { class: 'nx-paint-btn', title: t('toolbar.zoomIn', 'Zoom In'), onclick: () => zoom(1.25) },
        icon('plus'),
      ),
      h(
        'button',
        { class: 'nx-paint-btn', title: t('toolbar.zoomReset', 'Reset Zoom'), onclick: () => zoom(1, true) },
        icon('refresh'),
      ),
    ),
  );

  function zoom(factor, reset = false) {
    if (reset) currentZoom = 1;
    else currentZoom = Math.max(0.2, Math.min(4, currentZoom * factor));
    stage.style.transform = `scale(${currentZoom})`;
    stage.style.transformOrigin = 'center center';
    zoomLabel.textContent = `${Math.round(currentZoom * 100)}%`;
  }

  // Assemble Body
  const body = h('div', { class: 'nx-paint-body' }, toolsShelf, viewport, layersPanel);
  root.appendChild(header);
  root.appendChild(propsBar);
  root.appendChild(body);
  root.appendChild(footer);

  // ─── Layer Management Implementation ────────────────────────────────────
  function createLayer(name, isBg = false) {
    const canvas = /** @type {HTMLCanvasElement} */ (
      h('canvas', {
        class: 'nx-paint-layer-canvas',
        width: docWidth,
        height: docHeight,
        style: `width: ${docWidth}px; height: ${docHeight}px;`,
      })
    );
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    if (isBg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, docWidth, docHeight);
    }

    const layer = {
      id: generateLayerId(),
      name,
      visible: true,
      opacity: 1,
      blendMode: /** @type {GlobalCompositeOperation} */ ('source-over'),
      canvas,
      ctx,
    };
    return layer;
  }

  function getActiveLayer() {
    return layers.find((l) => l.id === activeLayerId) || layers[0];
  }

  function renderLayersUi() {
    layersList.innerHTML = '';
    // Remove all canvas elements from stage except previewCanvas
    stage.innerHTML = '';

    layers.forEach((layer) => {
      // Sync style
      layer.canvas.style.display = layer.visible ? 'block' : 'none';
      layer.canvas.style.opacity = String(layer.opacity);
      layer.canvas.style.mixBlendMode = layer.blendMode === 'source-over' ? 'normal' : layer.blendMode;
      stage.appendChild(layer.canvas);

      // Create Layer UI Item
      const isActive = layer.id === activeLayerId;
      const eyeBtn = h(
        'button',
        {
          class: 'nx-paint-btn',
          style: 'padding: 0 4px; min-width: 20px;',
          title: t('layers.visibility', 'Visibility'),
          onclick: (e) => {
            e.stopPropagation();
            layer.visible = !layer.visible;
            renderLayersUi();
            updateStatus(true);
          },
        },
        icon(layer.visible ? 'eye' : 'eye-off'),
      );

      const nameSpan = h('span', { class: 'nx-paint-layer-name' }, layer.name);
      nameSpan.ondblclick = async (e) => {
        e.stopPropagation();
        const input = h('input', { type: 'text', value: layer.name, class: 'nx-input' });
        const ok = await openModal({
          title: 'Rename Layer',
          body: input,
          actions: [
            { label: 'Cancel', value: false, variant: 'ghost' },
            { label: 'Rename', value: true, variant: 'primary' },
          ],
          dismissValue: false,
        });
        if (ok && input.value.trim()) {
          layer.name = input.value.trim();
          renderLayersUi();
        }
      };

      const item = h(
        'li',
        {
          class: `nx-paint-layer-item ${isActive ? 'active' : ''}`,
          onclick: () => {
            activeLayerId = layer.id;
            renderLayersUi();
          },
        },
        eyeBtn,
        nameSpan,
      );
      layersList.appendChild(item);
    });

    stage.appendChild(previewCanvas);
  }

  function addNewLayer(name = `Layer ${layers.length + 1}`) {
    saveHistory();
    const l = createLayer(name);
    layers.push(l);
    activeLayerId = l.id;
    renderLayersUi();
  }

  function duplicateActiveLayer() {
    const active = getActiveLayer();
    if (!active) return;
    saveHistory();
    const copy = createLayer(`${active.name} Copy`);
    copy.ctx.drawImage(active.canvas, 0, 0);
    copy.opacity = active.opacity;
    copy.blendMode = active.blendMode;

    const idx = layers.indexOf(active);
    layers.splice(idx + 1, 0, copy);
    activeLayerId = copy.id;
    renderLayersUi();
  }

  function mergeActiveLayerDown() {
    const active = getActiveLayer();
    const idx = layers.indexOf(active);
    if (idx <= 0) return; // Cannot merge bottom layer down
    saveHistory();

    const lower = layers[idx - 1];
    lower.ctx.save();
    lower.ctx.globalAlpha = active.opacity;
    lower.ctx.globalCompositeOperation = active.blendMode;
    lower.ctx.drawImage(active.canvas, 0, 0);
    lower.ctx.restore();

    layers.splice(idx, 1);
    activeLayerId = lower.id;
    renderLayersUi();
  }

  function deleteActiveLayer() {
    if (layers.length <= 1) return; // Keep at least one layer
    if (!confirm(t('dialog.confirmDeleteLayer', 'Delete this layer?'))) return;
    saveHistory();

    const idx = layers.findIndex((l) => l.id === activeLayerId);
    layers.splice(idx, 1);
    activeLayerId = layers[Math.max(0, idx - 1)].id;
    renderLayersUi();
  }

  // Initialize initial background layer
  const bg = createLayer('Background', true);
  layers.push(bg);
  activeLayerId = bg.id;
  renderLayersUi();

  // ─── Drawing Engine Implementation ──────────────────────────────────────
  function getStageCoords(e) {
    const rect = stage.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / currentZoom;
    const sy = (e.clientY - rect.top) / currentZoom;
    return {
      x: Math.round(Math.max(0, Math.min(docWidth, sx))),
      y: Math.round(Math.max(0, Math.min(docHeight, sy))),
    };
  }

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // Left button only
    const { x, y } = getStageCoords(e);
    isDrawing = true;
    lastX = x;
    lastY = y;
    shapeStartX = x;
    shapeStartY = y;

    const layer = getActiveLayer();
    if (!layer || !layer.visible) return;

    if (activeTool === 'eyedropper') {
      pickColor(x, y);
      return;
    }

    if (activeTool === 'bucket') {
      saveHistory();
      const imgData = layer.ctx.getImageData(0, 0, docWidth, docHeight);
      const fillRgba = parseColorToRgba(activeColor, activeOpacity);
      floodFill(imgData, x, y, fillRgba, 20);
      layer.ctx.putImageData(imgData, 0, 0);
      updateStatus(true);
      return;
    }

    if (activeTool === 'text') {
      promptInsertText(x, y);
      return;
    }

    saveHistory();
    drawStroke(layer.ctx, x, y, x, y, e.pressure || 0.5);
  });

  viewport.addEventListener('pointermove', (e) => {
    const { x, y } = getStageCoords(e);
    coordsLabel.textContent = `X: ${x}, Y: ${y}`;

    if (!isDrawing) return;
    const layer = getActiveLayer();
    if (!layer || !layer.visible) return;

    if (['rect', 'ellipse', 'line', 'select'].includes(activeTool)) {
      // Draw shape preview on overlay
      previewCtx.clearRect(0, 0, docWidth, docHeight);
      previewCtx.save();
      previewCtx.strokeStyle = activeColor;
      previewCtx.lineWidth = activeBrushSize;
      previewCtx.fillStyle = activeColor;

      if (activeTool === 'line') {
        previewCtx.beginPath();
        previewCtx.moveTo(shapeStartX, shapeStartY);
        previewCtx.lineTo(x, y);
        previewCtx.stroke();
      } else if (activeTool === 'rect' || activeTool === 'select') {
        const rx = Math.min(shapeStartX, x);
        const ry = Math.min(shapeStartY, y);
        const rw = Math.abs(x - shapeStartX);
        const rh = Math.abs(y - shapeStartY);
        if (activeTool === 'select') {
          previewCtx.strokeStyle = '#3b82f6';
          previewCtx.setLineDash([4, 4]);
        }
        previewCtx.strokeRect(rx, ry, rw, rh);
      } else if (activeTool === 'ellipse') {
        const rx = Math.abs(x - shapeStartX) / 2;
        const ry = Math.abs(y - shapeStartY) / 2;
        const cx = Math.min(shapeStartX, x) + rx;
        const cy = Math.min(shapeStartY, y) + ry;
        previewCtx.beginPath();
        previewCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        previewCtx.stroke();
      }
      previewCtx.restore();
    } else {
      drawStroke(layer.ctx, lastX, lastY, x, y, e.pressure || 0.5);
      lastX = x;
      lastY = y;
    }
  });

  viewport.addEventListener('pointerup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const { x, y } = getStageCoords(e);
    const layer = getActiveLayer();

    if (layer && layer.visible && ['rect', 'ellipse', 'line'].includes(activeTool)) {
      previewCtx.clearRect(0, 0, docWidth, docHeight);
      layer.ctx.save();
      layer.ctx.strokeStyle = activeColor;
      layer.ctx.lineWidth = activeBrushSize;
      layer.ctx.fillStyle = activeColor;
      layer.ctx.globalAlpha = activeOpacity;

      if (activeTool === 'line') {
        layer.ctx.beginPath();
        layer.ctx.moveTo(shapeStartX, shapeStartY);
        layer.ctx.lineTo(x, y);
        layer.ctx.stroke();

        if (isSymmetry) {
          layer.ctx.beginPath();
          layer.ctx.moveTo(docWidth - shapeStartX, shapeStartY);
          layer.ctx.lineTo(docWidth - x, y);
          layer.ctx.stroke();
        }
      } else if (activeTool === 'rect') {
        const rx = Math.min(shapeStartX, x);
        const ry = Math.min(shapeStartY, y);
        const rw = Math.abs(x - shapeStartX);
        const rh = Math.abs(y - shapeStartY);
        layer.ctx.strokeRect(rx, ry, rw, rh);

        if (isSymmetry) {
          layer.ctx.strokeRect(docWidth - rx - rw, ry, rw, rh);
        }
      } else if (activeTool === 'ellipse') {
        const rx = Math.abs(x - shapeStartX) / 2;
        const ry = Math.abs(y - shapeStartY) / 2;
        const cx = Math.min(shapeStartX, x) + rx;
        const cy = Math.min(shapeStartY, y) + ry;
        layer.ctx.beginPath();
        layer.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        layer.ctx.stroke();

        if (isSymmetry) {
          layer.ctx.beginPath();
          layer.ctx.ellipse(docWidth - cx, cy, rx, ry, 0, 0, Math.PI * 2);
          layer.ctx.stroke();
        }
      }
      layer.ctx.restore();
    }
    updateStatus(true);
  });

  function drawStroke(ctx, x1, y1, x2, y2, pressure = 0.5) {
    ctx.save();
    ctx.globalAlpha = activeOpacity;

    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = activeBrushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (isSymmetry) {
        ctx.beginPath();
        ctx.moveTo(docWidth - x1, y1);
        ctx.lineTo(docWidth - x2, y2);
        ctx.stroke();
      }
    } else if (activeTool === 'pencil') {
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = 1;
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (isSymmetry) {
        ctx.beginPath();
        ctx.moveTo(docWidth - x1, y1);
        ctx.lineTo(docWidth - x2, y2);
        ctx.stroke();
      }
    } else if (activeTool === 'softBrush') {
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(dist / 2));
      for (let s = 0; s <= steps; s++) {
        const cx = x1 + ((x2 - x1) * s) / steps;
        const cy = y1 + ((y2 - y1) * s) / steps;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, activeBrushSize / 2);
        grad.addColorStop(0, activeColor);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.globalAlpha = activeOpacity * 0.15;
        ctx.beginPath();
        ctx.arc(cx, cy, activeBrushSize / 2, 0, Math.PI * 2);
        ctx.fill();

        if (isSymmetry) {
          const symX = docWidth - cx;
          const sgrad = ctx.createRadialGradient(symX, cy, 0, symX, cy, activeBrushSize / 2);
          sgrad.addColorStop(0, activeColor);
          sgrad.addColorStop(1, 'transparent');
          ctx.fillStyle = sgrad;
          ctx.beginPath();
          ctx.arc(symX, cy, activeBrushSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (activeTool === 'spray') {
      ctx.fillStyle = activeColor;
      ctx.globalAlpha = activeOpacity * 0.4;
      const density = Math.round(activeBrushSize * 1.5);
      for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const rad = Math.random() * (activeBrushSize / 2);
        const px = x2 + Math.cos(angle) * rad;
        const py = y2 + Math.sin(angle) * rad;
        ctx.fillRect(px, py, 1.5, 1.5);

        if (isSymmetry) {
          ctx.fillRect(docWidth - px, py, 1.5, 1.5);
        }
      }
    } else {
      // Standard Round Brush with pressure
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = Math.max(1, activeBrushSize * (0.5 + pressure * 0.7));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (isSymmetry) {
        ctx.beginPath();
        ctx.moveTo(docWidth - x1, y1);
        ctx.lineTo(docWidth - x2, y2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function pickColor(x, y) {
    // Composite visible layers onto temp canvas to sample true color
    const compCanvas = document.createElement('canvas');
    compCanvas.width = 1;
    compCanvas.height = 1;
    const compCtx = compCanvas.getContext('2d');
    if (!compCtx) return;

    layers.forEach((l) => {
      if (l.visible) {
        compCtx.save();
        compCtx.globalAlpha = l.opacity;
        compCtx.globalCompositeOperation = l.blendMode;
        compCtx.drawImage(l.canvas, x, y, 1, 1, 0, 0, 1, 1);
        compCtx.restore();
      }
    });

    const p = compCtx.getImageData(0, 0, 1, 1).data;
    const hex = `#${((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1)}`;
    activeColor = hex;
    colorInput.value = hex;
    setTool('brush');
  }

  async function promptInsertText(x, y) {
    const input = h('input', { type: 'text', placeholder: 'Enter text here', class: 'nx-input' });
    const ok = await openModal({
      title: t('tools.text', 'Insert Text'),
      body: input,
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: 'Place', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok && input.value.trim()) {
      const layer = getActiveLayer();
      if (!layer) return;
      saveHistory();
      layer.ctx.save();
      layer.ctx.fillStyle = activeColor;
      layer.ctx.font = `${activeBrushSize * 2}px sans-serif`;
      layer.ctx.fillText(input.value.trim(), x, y);
      layer.ctx.restore();
      updateStatus(true);
    }
  }

  // ─── History Stack ───────────────────────────────────────────────────────
  function saveHistory() {
    const layerSnapshots = layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
      dataUrl: l.canvas.toDataURL(),
    }));
    undoStack.push(
      JSON.stringify({
        width: docWidth,
        height: docHeight,
        layers: layerSnapshots,
      }),
    );
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
  }

  function undoAction() {
    if (undoStack.length === 0) return;
    saveCurrentStateToRedo();
    const prev = undoStack.pop();
    if (prev) restoreState(prev);
  }

  function redoAction() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop();
    if (next) restoreState(next);
  }

  function saveCurrentStateToRedo() {
    const layerSnapshots = layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode,
      dataUrl: l.canvas.toDataURL(),
    }));
    redoStack.push(
      JSON.stringify({
        width: docWidth,
        height: docHeight,
        layers: layerSnapshots,
      }),
    );
  }

  function restoreState(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      docWidth = data.width;
      docHeight = data.height;
      stage.style.width = `${docWidth}px`;
      stage.style.height = `${docHeight}px`;
      previewCanvas.width = docWidth;
      previewCanvas.height = docHeight;
      dimsLabel.textContent = `${docWidth} × ${docHeight} px`;

      layers = data.layers.map((lData) => {
        const l = createLayer(lData.name);
        l.id = lData.id;
        l.visible = lData.visible;
        l.opacity = lData.opacity;
        l.blendMode = lData.blendMode;
        const img = new Image();
        img.onload = () => l.ctx.drawImage(img, 0, 0);
        img.src = lData.dataUrl;
        return l;
      });
      activeLayerId = layers[0].id;
      renderLayersUi();
    } catch (e) {
      console.warn('Failed to restore history state:', e);
    }
  }

  // ─── Adjustments / Filters ───────────────────────────────────────────────
  function showAdjustmentsMenu(anchor) {
    openMenu(
      [
        {
          label: t('adjustments.brightnessContrast', 'Brightness / Contrast...'),
          run: () => promptBrightnessContrast(),
        },
        {
          label: t('adjustments.hueSat', 'Hue / Saturation...'),
          run: () => promptHueSaturation(),
        },
        {
          label: t('adjustments.grayscale', 'Grayscale'),
          run: () => applyFilterToActiveLayer((imgData) => applyGrayscale(imgData)),
        },
        {
          label: t('adjustments.invert', 'Invert Colors'),
          run: () => applyFilterToActiveLayer((imgData) => applyInvert(imgData)),
        },
        {
          label: t('adjustments.blur', 'Box Blur...'),
          run: () => promptBlur(),
        },
      ],
      { anchor },
    );
  }

  function applyFilterToActiveLayer(filterFn) {
    const layer = getActiveLayer();
    if (!layer) return;
    saveHistory();
    const imgData = layer.ctx.getImageData(0, 0, docWidth, docHeight);
    filterFn(imgData);
    layer.ctx.putImageData(imgData, 0, 0);
    updateStatus(true);
  }

  async function promptBrightnessContrast() {
    const bSlider = h('input', { type: 'range', min: '-100', max: '100', value: '0', class: 'nx-paint-range' });
    const cSlider = h('input', { type: 'range', min: '-100', max: '100', value: '0', class: 'nx-paint-range' });

    const ok = await openModal({
      title: t('adjustments.brightnessContrast', 'Brightness / Contrast'),
      body: h(
        'div',
        { style: 'display: flex; flex-direction: column; gap: 12px;' },
        h('label', {}, t('adjustments.brightness', 'Brightness:'), bSlider),
        h('label', {}, t('adjustments.contrast', 'Contrast:'), cSlider),
      ),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: t('adjustments.apply', 'Apply'), value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok) {
      const b = parseInt(bSlider.value, 10);
      const c = parseInt(cSlider.value, 10);
      applyFilterToActiveLayer((imgData) => applyBrightnessContrast(imgData, b, c));
    }
  }

  async function promptHueSaturation() {
    const hSlider = h('input', { type: 'range', min: '-180', max: '180', value: '0', class: 'nx-paint-range' });
    const sSlider = h('input', { type: 'range', min: '-100', max: '100', value: '0', class: 'nx-paint-range' });

    const ok = await openModal({
      title: t('adjustments.hueSat', 'Hue / Saturation'),
      body: h(
        'div',
        { style: 'display: flex; flex-direction: column; gap: 12px;' },
        h('label', {}, t('adjustments.hue', 'Hue Shift:'), hSlider),
        h('label', {}, t('adjustments.saturation', 'Saturation:'), sSlider),
      ),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: t('adjustments.apply', 'Apply'), value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok) {
      const hue = parseInt(hSlider.value, 10);
      const sat = parseInt(sSlider.value, 10);
      applyFilterToActiveLayer((imgData) => applyHueSaturation(imgData, hue, sat));
    }
  }

  async function promptBlur() {
    const rSlider = h('input', { type: 'range', min: '1', max: '10', value: '2', class: 'nx-paint-range' });
    const ok = await openModal({
      title: t('adjustments.blur', 'Box Blur'),
      body: h('div', {}, h('label', {}, t('adjustments.radius', 'Radius:'), rSlider)),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: t('adjustments.apply', 'Apply'), value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok) {
      const rad = parseInt(rSlider.value, 10);
      applyFilterToActiveLayer((imgData) => applyBlur(imgData, rad));
    }
  }

  async function promptResizeCanvas() {
    const wInput = h('input', { type: 'number', value: String(docWidth), min: '64', max: '4096', class: 'nx-input' });
    const hInput = h('input', { type: 'number', value: String(docHeight), min: '64', max: '4096', class: 'nx-input' });

    const ok = await openModal({
      title: t('file.resizeCanvas', 'Resize Canvas Dimensions'),
      body: h(
        'div',
        { style: 'display: flex; flex-direction: column; gap: 12px;' },
        h('label', {}, t('dialog.width', 'Width (px):'), wInput),
        h('label', {}, t('dialog.height', 'Height (px):'), hInput),
      ),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: 'Resize', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok) {
      const newW = parseInt(wInput.value, 10) || docWidth;
      const newH = parseInt(hInput.value, 10) || docHeight;
      saveHistory();

      docWidth = newW;
      docHeight = newH;
      stage.style.width = `${docWidth}px`;
      stage.style.height = `${docHeight}px`;
      previewCanvas.width = docWidth;
      previewCanvas.height = docHeight;
      dimsLabel.textContent = `${docWidth} × ${docHeight} px`;

      layers.forEach((l) => {
        const oldData = l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height);
        l.canvas.width = docWidth;
        l.canvas.height = docHeight;
        l.canvas.style.width = `${docWidth}px`;
        l.canvas.style.height = `${docHeight}px`;
        l.ctx.putImageData(oldData, 0, 0);
      });
      renderLayersUi();
    }
  }

  // ─── File Operations & Exports ──────────────────────────────────────────
  function getCompositeCanvas() {
    const compCanvas = document.createElement('canvas');
    compCanvas.width = docWidth;
    compCanvas.height = docHeight;
    const compCtx = compCanvas.getContext('2d');
    if (!compCtx) return compCanvas;

    layers.forEach((l) => {
      if (l.visible) {
        compCtx.save();
        compCtx.globalAlpha = l.opacity;
        compCtx.globalCompositeOperation = l.blendMode;
        compCtx.drawImage(l.canvas, 0, 0);
        compCtx.restore();
      }
    });
    return compCanvas;
  }

  async function savePainting() {
    if (!currentPath) {
      await saveAsPainting();
      return;
    }
    if (fs) {
      if (currentPath.endsWith('.npaint')) {
        const docObj = {
          version: 1,
          title: docTitle,
          width: docWidth,
          height: docHeight,
          layers: layers.map((l) => ({
            id: l.id,
            name: l.name,
            visible: l.visible,
            opacity: l.opacity,
            blendMode: l.blendMode,
            dataUrl: l.canvas.toDataURL(),
          })),
          metadata: { created: Date.now(), modified: Date.now() },
        };
        await fs.writeFile(currentPath, serializePaintDoc(docObj));
      } else {
        const comp = getCompositeCanvas();
        const dataUrl = comp.toDataURL('image/png');
        await fs.writeFile(currentPath, dataUrl);
      }
      updateStatus(false);
    }
  }

  async function saveAsPainting() {
    const defaultName = `${docTitle.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'painting'}.npaint`;
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
      await savePainting();
    }
  }

  function showFileMenu(anchor) {
    openMenu(
      [
        {
          label: t('file.new', 'New Painting'),
          icon: 'file-plus',
          run: () => {
            docTitle = t('app.untitled', 'Untitled Painting');
            titleInput.value = docTitle;
            currentPath = null;
            layers = [createLayer('Background', true)];
            activeLayerId = layers[0].id;
            renderLayersUi();
            updateStatus(false);
          },
        },
        {
          label: t('file.open', 'Open...'),
          icon: 'folder-open',
          run: () => promptOpenFile(),
        },
        'separator',
        {
          label: t('file.save', 'Save'),
          icon: 'download',
          shortcut: 'Mod+S',
          run: () => savePainting(),
        },
        {
          label: t('file.saveAs', 'Save As...'),
          icon: 'download',
          run: () => saveAsPainting(),
        },
        'separator',
        {
          label: t('file.resizeCanvas', 'Resize Canvas...'),
          icon: 'maximize',
          run: () => promptResizeCanvas(),
        },
        {
          label: t('file.export', 'Export'),
          icon: 'share',
          submenu: [
            {
              label: t('file.exportPng', 'Export as PNG (.png)'),
              run: () => exportImage('image/png', `${docTitle}.png`),
            },
            {
              label: t('file.exportJpg', 'Export as JPEG (.jpg)'),
              run: () => exportImage('image/jpeg', `${docTitle}.jpg`),
            },
            {
              label: t('file.exportWebp', 'Export as WebP (.webp)'),
              run: () => exportImage('image/webp', `${docTitle}.webp`),
            },
            {
              label: t('file.exportNpaint', 'Export as Layered Paint (.npaint)'),
              run: () => exportNpaintFile(),
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
          label: t('file.exportPng', 'Export as PNG (.png)'),
          icon: 'image',
          run: () => exportImage('image/png', `${docTitle}.png`),
        },
        {
          label: t('file.exportJpg', 'Export as JPEG (.jpg)'),
          icon: 'image',
          run: () => exportImage('image/jpeg', `${docTitle}.jpg`),
        },
        {
          label: t('file.exportWebp', 'Export as WebP (.webp)'),
          icon: 'image',
          run: () => exportImage('image/webp', `${docTitle}.webp`),
        },
        {
          label: t('file.exportNpaint', 'Export as Layered Paint (.npaint)'),
          icon: 'download',
          run: () => exportNpaintFile(),
        },
      ],
      { anchor },
    );
  }

  async function promptOpenFile() {
    const input = h('input', { type: 'text', placeholder: '/home/documents/art.npaint', class: 'nx-input' });
    const ok = await openModal({
      title: t('file.open', 'Open Painting'),
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
      if (currentPath.endsWith('.npaint')) {
        const parsed = parsePaintDoc(data);
        restoreState(JSON.stringify(parsed));
      } else {
        // Load image onto single layer
        const img = new Image();
        img.onload = () => {
          docWidth = img.width;
          docHeight = img.height;
          stage.style.width = `${docWidth}px`;
          stage.style.height = `${docHeight}px`;
          previewCanvas.width = docWidth;
          previewCanvas.height = docHeight;
          const l = createLayer('Image');
          l.ctx.drawImage(img, 0, 0);
          layers = [l];
          activeLayerId = l.id;
          renderLayersUi();
        };
        img.src = data;
      }
      docTitle =
        currentPath
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '') || docTitle;
      titleInput.value = docTitle;
      updateStatus(false);
    }
  }

  function exportImage(mimeType, filename) {
    const comp = getCompositeCanvas();
    comp.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, mimeType);
  }

  function exportNpaintFile() {
    const docObj = {
      version: 1,
      title: docTitle,
      width: docWidth,
      height: docHeight,
      layers: layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode,
        dataUrl: l.canvas.toDataURL(),
      })),
      metadata: { created: Date.now(), modified: Date.now() },
    };
    const json = serializePaintDoc(docObj);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docTitle}.npaint`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    saveState: () => ({
      path: currentPath,
      paintDoc: serializePaintDoc({
        version: 1,
        title: docTitle,
        width: docWidth,
        height: docHeight,
        layers: layers.map((l) => ({
          id: l.id,
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          blendMode: l.blendMode,
          dataUrl: l.canvas.toDataURL(),
        })),
        metadata: { created: Date.now(), modified: Date.now() },
      }),
    }),
  };
}
