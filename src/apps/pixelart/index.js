// @ts-check
import { h, icon } from '../../ui/dom.js';
import { openModal } from '../../ui/overlay.js';
import {
  bresenhamCircle,
  bresenhamLine,
  cloneFrame,
  createBlankFrame,
  createPixelDoc,
  floodFillGrid,
  generateAnimatedGif,
  GRID_SIZES,
  parsePixelDoc,
  RETRO_PALETTES,
  serializePixelDoc,
} from './model.js';
import './styles.css';

/**
 * Commands exported by nexus.pixelart.
 * @type {import('../../kernel/types').AppModule['commands']}
 */
export const commands = {
  'pixelart.new': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.pixelart', args: { newFile: true } }),
};

/**
 * Main application mount for Pixel Art Studio.
 * @type {import('../../kernel/types').AppModule['mount']}
 */
export async function mount(container, ctx, args) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>=} */ vars) => ctx.i18n.t(key, vars);
  const fs = /** @type {any} */ (ctx.fs);

  let currentPath = /** @type {string | null} */ (args.path ?? null);
  let isDirty = false;

  // Active state
  /** @type {'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle' | 'picker'} */
  let activeTool = 'pencil';
  let activePaletteKey = 'pico8';
  let activeColorIndex = 0; // index into doc.palette, or -1 for eraser
  let showGrid = true;
  let onionSkin = false;
  let mirrorMode = false;
  let zoomLevel = 16; // pixels per grid cell

  // Animation state
  let currentFrameIndex = 0;
  let isPlaying = false;
  /** @type {number | null} */
  let playTimer = null;

  // Document state
  /** @type {import('./model.js').PixelDoc} */
  let doc = createPixelDoc(t('app.untitled', 'Untitled Sprite'), 16, 16);

  // Undo/Redo stack (stores serialized frames arrays)
  /** @type {string[]} */
  const undoStack = [];
  /** @type {string[]} */
  const redoStack = [];

  function pushHistory() {
    undoStack.push(JSON.stringify(doc.frames));
    if (undoStack.length > 30) undoStack.shift();
    redoStack.length = 0;
    isDirty = true;
    updateStatus();
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(JSON.stringify(doc.frames));
    const previous = undoStack.pop();
    if (previous) {
      doc.frames = JSON.parse(previous);
      if (currentFrameIndex >= doc.frames.length) {
        currentFrameIndex = doc.frames.length - 1;
      }
      renderCanvas();
      renderTimeline();
    }
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.stringify(doc.frames));
    const next = redoStack.pop();
    if (next) {
      doc.frames = JSON.parse(next);
      if (currentFrameIndex >= doc.frames.length) {
        currentFrameIndex = doc.frames.length - 1;
      }
      renderCanvas();
      renderTimeline();
    }
  }

  // ─── DOM Structure ───────────────────────────────────────────────────────
  const root = h('div', { class: 'nx-pixelart' });

  // Status label
  const statusLabel = h('span', { class: 'nx-pixelart-status' }, '');
  function updateStatus() {
    statusLabel.textContent = isDirty ? '●' : '';
    statusLabel.title = isDirty ? 'Unsaved changes' : 'All changes saved';
  }

  // Viewport & Canvases
  const viewport = h('div', { class: 'nx-pixelart-viewport' });
  const canvasContainer = h('div', { class: 'nx-pixelart-canvas-container' });
  const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-pixelart-canvas' }));
  const ctx2d = canvas.getContext('2d');
  canvasContainer.appendChild(canvas);
  viewport.appendChild(canvasContainer);

  // Left Sidebar
  const sidebar = h('aside', { class: 'nx-pixelart-sidebar' });

  // Tool buttons
  const toolButtons = {
    pencil: h('button', { class: 'nx-pixelart-tool-btn active', title: t('tools.pencil', 'Pencil (B)') }, [
      icon('edit'),
      h('span', {}, 'Pencil'),
    ]),
    eraser: h('button', { class: 'nx-pixelart-tool-btn', title: t('tools.eraser', 'Eraser (E)') }, [
      icon('trash'),
      h('span', {}, 'Eraser'),
    ]),
    fill: h('button', { class: 'nx-pixelart-tool-btn', title: t('tools.fill', 'Bucket fill (G)') }, [
      icon('refresh'),
      h('span', {}, 'Fill'),
    ]),
    line: h('button', { class: 'nx-pixelart-tool-btn', title: t('tools.line', 'Line (L)') }, [
      icon('minus'),
      h('span', {}, 'Line'),
    ]),
    rect: h('button', { class: 'nx-pixelart-tool-btn', title: t('tools.rect', 'Rectangle (U)') }, [
      icon('square'),
      h('span', {}, 'Rect'),
    ]),
    circle: h('button', { class: 'nx-pixelart-tool-btn', title: t('tools.circle', 'Circle (C)') }, [
      icon('circle'),
      h('span', {}, 'Circle'),
    ]),
    picker: h('button', { class: 'nx-pixelart-tool-btn', title: t('tools.picker', 'Color picker (I)') }, [
      icon('search'),
      h('span', {}, 'Picker'),
    ]),
  };

  const toolsSection = h('div', { class: 'nx-pixelart-tools' }, Object.values(toolButtons));

  Object.entries(toolButtons).forEach(([key, btn]) => {
    btn.addEventListener('click', () => {
      selectTool(/** @type {any} */ (key));
    });
  });

  function selectTool(tool) {
    activeTool = tool;
    Object.entries(toolButtons).forEach(([k, b]) => {
      b.classList.toggle('active', k === tool);
    });
  }

  // Palette Section
  const paletteSection = h('div', { class: 'nx-pixelart-palette-section' });
  const paletteHeader = h('div', { class: 'nx-pixelart-palette-header' }, [
    h('span', {}, t('palette.title', 'Palette')),
  ]);

  const paletteSelect = /** @type {HTMLSelectElement} */ (
    h('select', { class: 'nx-pixelart-select' }, [
      h('option', { value: 'pico8' }, 'PICO-8'),
      h('option', { value: 'gameboy' }, 'Game Boy'),
      h('option', { value: 'c64' }, 'Commodore 64'),
      h('option', { value: 'nes' }, 'NES Classic'),
      h('option', { value: 'custom' }, t('palette.custom', 'Custom')),
    ])
  );

  paletteSelect.value = activePaletteKey;
  paletteSelect.addEventListener('change', () => {
    activePaletteKey = paletteSelect.value;
    if (activePaletteKey in RETRO_PALETTES) {
      doc.palette = [...RETRO_PALETTES[activePaletteKey].colors];
      activeColorIndex = 0;
      renderPaletteSwatches();
      renderCanvas();
      renderTimeline();
    }
  });

  const activeColorDisplay = h('div', { class: 'nx-pixelart-active-color' });
  const activeColorChip = h('div', { class: 'nx-pixelart-color-chip' });
  const activeColorHex = h('span', { class: 'nx-pixelart-color-text' }, doc.palette[activeColorIndex] || '#000000');
  activeColorDisplay.append(activeColorChip, activeColorHex);

  const swatchesContainer = h('div', { class: 'nx-pixelart-swatches' });

  function renderPaletteSwatches() {
    swatchesContainer.innerHTML = '';
    const currentColor = doc.palette[activeColorIndex] || '#000000';
    activeColorChip.style.backgroundColor = currentColor;
    activeColorHex.textContent = currentColor;

    doc.palette.forEach((hex, idx) => {
      const swatch = h('div', {
        class: `nx-pixelart-swatch ${idx === activeColorIndex ? 'active' : ''}`,
        style: `background-color: ${hex};`,
        title: hex,
      });
      swatch.addEventListener('click', () => {
        activeColorIndex = idx;
        if (activeTool === 'eraser') selectTool('pencil');
        renderPaletteSwatches();
      });
      swatchesContainer.appendChild(swatch);
    });
  }

  // Custom color adder
  const addColorInput = /** @type {HTMLInputElement} */ (
    h('input', { type: 'color', value: '#ff0055', style: 'opacity: 0; width: 0; height: 0; position: absolute;' })
  );
  const addColorBtn = h(
    'button',
    { class: 'nx-pixelart-btn', style: 'margin-top: 6px; width: 100%; justify-content: center;' },
    [icon('plus'), h('span', {}, t('palette.addColor', 'Add color'))],
  );
  addColorBtn.addEventListener('click', () => addColorInput.click());
  addColorInput.addEventListener('change', () => {
    doc.palette.push(addColorInput.value);
    activeColorIndex = doc.palette.length - 1;
    paletteSelect.value = 'custom';
    renderPaletteSwatches();
  });

  paletteSection.append(
    paletteHeader,
    paletteSelect,
    activeColorDisplay,
    swatchesContainer,
    addColorBtn,
    addColorInput,
  );
  sidebar.append(toolsSection, paletteSection);

  // ─── Animation Timeline Tray ─────────────────────────────────────────────
  const timeline = h('div', { class: 'nx-pixelart-timeline' });
  const timelineControls = h('div', { class: 'nx-pixelart-timeline-controls' });

  const playBtn = h('button', { class: 'nx-pixelart-btn' }, [icon('play'), h('span', {}, t('timeline.play', 'Play'))]);

  playBtn.addEventListener('click', togglePlayback);

  const fpsContainer = h('div', { class: 'nx-pixelart-group' }, [
    h('span', { style: 'font-size: 11px;' }, t('timeline.fps', 'FPS')),
  ]);
  const fpsSelect = /** @type {HTMLSelectElement} */ (
    h('select', { class: 'nx-pixelart-select' }, [
      h('option', { value: '2' }, '2'),
      h('option', { value: '4' }, '4'),
      h('option', { value: '8' }, '8'),
      h('option', { value: '12' }, '12'),
      h('option', { value: '16' }, '16'),
      h('option', { value: '24' }, '24'),
    ])
  );
  fpsSelect.value = String(doc.fps);
  fpsSelect.addEventListener('change', () => {
    doc.fps = parseInt(fpsSelect.value, 10);
    const delay = Math.round(1000 / doc.fps);
    doc.frames.forEach((f) => {
      f.durationMs = delay;
    });
    if (isPlaying) {
      stopPlayback();
      startPlayback();
    }
  });
  fpsContainer.appendChild(fpsSelect);

  const frameActions = h('div', { class: 'nx-pixelart-group' });
  const addFrameBtn = h('button', { class: 'nx-pixelart-btn' }, [
    icon('plus'),
    h('span', {}, t('timeline.addFrame', 'Add frame')),
  ]);
  addFrameBtn.addEventListener('click', () => {
    pushHistory();
    const newFrame = createBlankFrame(doc.width, doc.height, Math.round(1000 / doc.fps));
    doc.frames.splice(currentFrameIndex + 1, 0, newFrame);
    currentFrameIndex += 1;
    renderCanvas();
    renderTimeline();
  });

  const duplicateFrameBtn = h('button', { class: 'nx-pixelart-btn' }, [
    icon('copy'),
    h('span', {}, t('timeline.duplicateFrame', 'Duplicate')),
  ]);
  duplicateFrameBtn.addEventListener('click', () => {
    pushHistory();
    const cloned = cloneFrame(doc.frames[currentFrameIndex]);
    doc.frames.splice(currentFrameIndex + 1, 0, cloned);
    currentFrameIndex += 1;
    renderCanvas();
    renderTimeline();
  });

  const deleteFrameBtn = h('button', { class: 'nx-pixelart-btn' }, [
    icon('trash'),
    h('span', {}, t('timeline.deleteFrame', 'Delete frame')),
  ]);
  deleteFrameBtn.addEventListener('click', () => {
    if (doc.frames.length <= 1) {
      ctx.dialog.alert(t('dialog.cannotDeleteLastFrame', 'You cannot delete the only frame in the animation.'));
      return;
    }
    pushHistory();
    doc.frames.splice(currentFrameIndex, 1);
    if (currentFrameIndex >= doc.frames.length) {
      currentFrameIndex = doc.frames.length - 1;
    }
    renderCanvas();
    renderTimeline();
  });

  frameActions.append(addFrameBtn, duplicateFrameBtn, deleteFrameBtn);
  timelineControls.append(h('div', { class: 'nx-pixelart-group' }, [playBtn, fpsContainer]), frameActions);

  const framesTray = h('div', { class: 'nx-pixelart-frames-tray' });
  timeline.append(timelineControls, framesTray);

  function renderTimeline() {
    framesTray.innerHTML = '';
    doc.frames.forEach((frame, idx) => {
      const card = h('div', {
        class: `nx-pixelart-frame-card ${idx === currentFrameIndex ? 'active' : ''}`,
      });

      const frameNumber = h('span', { class: 'nx-pixelart-frame-number' }, String(idx + 1));

      // Mini preview canvas
      const miniCanvas = /** @type {HTMLCanvasElement} */ (h('canvas', { class: 'nx-pixelart-frame-preview' }));
      miniCanvas.width = doc.width;
      miniCanvas.height = doc.height;
      const miniCtx = miniCanvas.getContext('2d');
      if (miniCtx) {
        miniCtx.clearRect(0, 0, doc.width, doc.height);
        for (let y = 0; y < doc.height; y++) {
          for (let x = 0; x < doc.width; x++) {
            const colIdx = frame.pixels[y * doc.width + x];
            if (colIdx >= 0 && colIdx < doc.palette.length) {
              miniCtx.fillStyle = doc.palette[colIdx];
              miniCtx.fillRect(x, y, 1, 1);
            }
          }
        }
      }

      card.append(frameNumber, miniCanvas);
      card.addEventListener('click', () => {
        if (isPlaying) stopPlayback();
        currentFrameIndex = idx;
        renderCanvas();
        renderTimeline();
      });

      framesTray.appendChild(card);
    });
  }

  function startPlayback() {
    isPlaying = true;
    playBtn.innerHTML = '';
    playBtn.append(icon('pause'), h('span', {}, t('timeline.pause', 'Pause')));
    const delay = Math.round(1000 / doc.fps);
    playTimer = /** @type {any} */ (
      setInterval(() => {
        currentFrameIndex = (currentFrameIndex + 1) % doc.frames.length;
        renderCanvas();
        renderTimeline();
      }, delay)
    );
  }

  function stopPlayback() {
    isPlaying = false;
    playBtn.innerHTML = '';
    playBtn.append(icon('play'), h('span', {}, t('timeline.play', 'Play')));
    if (playTimer !== null) {
      clearInterval(playTimer);
      playTimer = null;
    }
  }

  function togglePlayback() {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  // ─── Canvas Rendering ───────────────────────────────────────────────────
  function updateCanvasDimensions() {
    canvas.width = doc.width * zoomLevel;
    canvas.height = doc.height * zoomLevel;
    renderCanvas();
  }

  function renderCanvas() {
    if (!ctx2d) return;
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Onion skinning (draw previous frame with low alpha)
    if (onionSkin && doc.frames.length > 1 && !isPlaying) {
      const prevIdx = (currentFrameIndex - 1 + doc.frames.length) % doc.frames.length;
      const prevFrame = doc.frames[prevIdx];
      ctx2d.save();
      ctx2d.globalAlpha = 0.25;
      for (let y = 0; y < doc.height; y++) {
        for (let x = 0; x < doc.width; x++) {
          const colIdx = prevFrame.pixels[y * doc.width + x];
          if (colIdx >= 0 && colIdx < doc.palette.length) {
            ctx2d.fillStyle = doc.palette[colIdx];
            ctx2d.fillRect(x * zoomLevel, y * zoomLevel, zoomLevel, zoomLevel);
          }
        }
      }
      ctx2d.restore();
    }

    // 2. Active frame pixels
    const frame = doc.frames[currentFrameIndex];
    if (frame) {
      for (let y = 0; y < doc.height; y++) {
        for (let x = 0; x < doc.width; x++) {
          const colIdx = frame.pixels[y * doc.width + x];
          if (colIdx >= 0 && colIdx < doc.palette.length) {
            ctx2d.fillStyle = doc.palette[colIdx];
            ctx2d.fillRect(x * zoomLevel, y * zoomLevel, zoomLevel, zoomLevel);
          }
        }
      }
    }

    // 3. Grid lines
    if (showGrid && zoomLevel >= 4) {
      ctx2d.save();
      ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      for (let x = 0; x <= doc.width; x++) {
        ctx2d.moveTo(x * zoomLevel, 0);
        ctx2d.lineTo(x * zoomLevel, doc.height * zoomLevel);
      }
      for (let y = 0; y <= doc.height; y++) {
        ctx2d.moveTo(0, y * zoomLevel);
        ctx2d.lineTo(doc.width * zoomLevel, y * zoomLevel);
      }
      ctx2d.stroke();
      ctx2d.restore();
    }

    // 4. Center mirror line indicator
    if (mirrorMode) {
      ctx2d.save();
      ctx2d.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      ctx2d.lineWidth = 1.5;
      ctx2d.setLineDash([4, 4]);
      const midX = (doc.width / 2) * zoomLevel;
      ctx2d.beginPath();
      ctx2d.moveTo(midX, 0);
      ctx2d.lineTo(midX, doc.height * zoomLevel);
      ctx2d.stroke();
      ctx2d.restore();
    }
  }

  // ─── Drawing Interactions ────────────────────────────────────────────────
  let isPointerDown = false;
  let startGridX = 0;
  let startGridY = 0;
  let lastGridX = -1;
  let lastGridY = -1;

  function getGridCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const gx = Math.floor(px / zoomLevel);
    const gy = Math.floor(py / zoomLevel);
    return {
      x: Math.max(0, Math.min(doc.width - 1, gx)),
      y: Math.max(0, Math.min(doc.height - 1, gy)),
    };
  }

  function setPixel(frame, x, y, colIdx) {
    if (x < 0 || x >= doc.width || y < 0 || y >= doc.height) return;
    frame.pixels[y * doc.width + x] = colIdx;
    if (mirrorMode) {
      const mx = doc.width - 1 - x;
      frame.pixels[y * doc.width + mx] = colIdx;
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (isPlaying) stopPlayback();
    isPointerDown = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getGridCoords(e);
    startGridX = x;
    startGridY = y;
    lastGridX = x;
    lastGridY = y;

    const frame = doc.frames[currentFrameIndex];
    if (!frame) return;

    if (activeTool === 'picker') {
      const idx = frame.pixels[y * doc.width + x];
      if (idx >= 0 && idx < doc.palette.length) {
        activeColorIndex = idx;
        selectTool('pencil');
        renderPaletteSwatches();
      }
      isPointerDown = false;
      return;
    }

    if (activeTool === 'fill') {
      pushHistory();
      const col = activeTool === 'eraser' ? -1 : activeColorIndex;
      floodFillGrid(frame.pixels, doc.width, doc.height, x, y, col);
      renderCanvas();
      renderTimeline();
      return;
    }

    pushHistory();
    const col = activeTool === 'eraser' ? -1 : activeColorIndex;
    if (activeTool === 'pencil' || activeTool === 'eraser') {
      setPixel(frame, x, y, col);
      renderCanvas();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    const { x, y } = getGridCoords(e);
    const frame = doc.frames[currentFrameIndex];
    if (!frame) return;

    const col = activeTool === 'eraser' ? -1 : activeColorIndex;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      if (x !== lastGridX || y !== lastGridY) {
        const line = bresenhamLine(lastGridX, lastGridY, x, y);
        line.forEach((p) => setPixel(frame, p.x, p.y, col));
        lastGridX = x;
        lastGridY = y;
        renderCanvas();
      }
    } else if (activeTool === 'line' || activeTool === 'rect' || activeTool === 'circle') {
      // Live preview during shape drawing
      renderCanvas();
      if (!ctx2d) return;
      ctx2d.save();
      ctx2d.fillStyle = col >= 0 ? doc.palette[col] : '#ffffff';
      ctx2d.globalAlpha = 0.7;

      if (activeTool === 'line') {
        const pts = bresenhamLine(startGridX, startGridY, x, y);
        pts.forEach((p) => {
          ctx2d?.fillRect(p.x * zoomLevel, p.y * zoomLevel, zoomLevel, zoomLevel);
          if (mirrorMode) {
            ctx2d?.fillRect((doc.width - 1 - p.x) * zoomLevel, p.y * zoomLevel, zoomLevel, zoomLevel);
          }
        });
      } else if (activeTool === 'rect') {
        const minX = Math.min(startGridX, x);
        const maxX = Math.max(startGridX, x);
        const minY = Math.min(startGridY, y);
        const maxY = Math.max(startGridY, y);
        for (let rx = minX; rx <= maxX; rx++) {
          for (let ry = minY; ry <= maxY; ry++) {
            if (rx === minX || rx === maxX || ry === minY || ry === maxY) {
              ctx2d.fillRect(rx * zoomLevel, ry * zoomLevel, zoomLevel, zoomLevel);
              if (mirrorMode) {
                ctx2d.fillRect((doc.width - 1 - rx) * zoomLevel, ry * zoomLevel, zoomLevel, zoomLevel);
              }
            }
          }
        }
      } else if (activeTool === 'circle') {
        const radius = Math.round(Math.hypot(x - startGridX, y - startGridY));
        const pts = bresenhamCircle(startGridX, startGridY, radius);
        pts.forEach((p) => {
          if (p.x >= 0 && p.x < doc.width && p.y >= 0 && p.y < doc.height) {
            ctx2d?.fillRect(p.x * zoomLevel, p.y * zoomLevel, zoomLevel, zoomLevel);
            if (mirrorMode) {
              ctx2d?.fillRect((doc.width - 1 - p.x) * zoomLevel, p.y * zoomLevel, zoomLevel, zoomLevel);
            }
          }
        });
      }
      ctx2d.restore();
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    const { x, y } = getGridCoords(e);
    const frame = doc.frames[currentFrameIndex];
    if (!frame) return;

    const col = activeTool === 'eraser' ? -1 : activeColorIndex;

    if (activeTool === 'line') {
      const pts = bresenhamLine(startGridX, startGridY, x, y);
      pts.forEach((p) => setPixel(frame, p.x, p.y, col));
    } else if (activeTool === 'rect') {
      const minX = Math.min(startGridX, x);
      const maxX = Math.max(startGridX, x);
      const minY = Math.min(startGridY, y);
      const maxY = Math.max(startGridY, y);
      for (let rx = minX; rx <= maxX; rx++) {
        for (let ry = minY; ry <= maxY; ry++) {
          if (rx === minX || rx === maxX || ry === minY || ry === maxY) {
            setPixel(frame, rx, ry, col);
          }
        }
      }
    } else if (activeTool === 'circle') {
      const radius = Math.round(Math.hypot(x - startGridX, y - startGridY));
      const pts = bresenhamCircle(startGridX, startGridY, radius);
      pts.forEach((p) => {
        if (p.x >= 0 && p.x < doc.width && p.y >= 0 && p.y < doc.height) {
          setPixel(frame, p.x, p.y, col);
        }
      });
    }

    renderCanvas();
    renderTimeline();
  });

  // ─── Toolbar ─────────────────────────────────────────────────────────────
  const toolbar = h('div', { class: 'nx-pixelart-toolbar' });

  // File menu
  const newBtn = h('button', { class: 'nx-pixelart-btn' }, [icon('plus'), h('span', {}, t('toolbar.new', 'New'))]);
  newBtn.addEventListener('click', async () => {
    if (isDirty) {
      const ok = await ctx.dialog.confirm(
        t('dialog.confirmNew', 'Create new sprite? Any unsaved changes will be lost.'),
      );
      if (!ok) return;
    }
    doc = createPixelDoc(t('app.untitled', 'Untitled Sprite'), doc.width, doc.height, doc.palette);
    currentPath = null;
    isDirty = false;
    updateStatus();
    renderPaletteSwatches();
    updateCanvasDimensions();
    renderTimeline();
  });

  const openBtn = h('button', { class: 'nx-pixelart-btn' }, [icon('folder'), h('span', {}, t('toolbar.open', 'Open'))]);
  openBtn.addEventListener('click', async () => {
    const res = await ctx.dialog.showOpenDialog({
      filters: [{ name: 'Pixel Art (*.npixel)', extensions: ['npixel', 'json'] }],
    });
    if (res && res.filePath) {
      loadFile(res.filePath);
    }
  });

  const saveBtn = h('button', { class: 'nx-pixelart-btn' }, [icon('save'), h('span', {}, t('toolbar.save', 'Save'))]);
  saveBtn.addEventListener('click', saveFile);

  const exportBtn = h('button', { class: 'nx-pixelart-btn' }, [
    icon('download'),
    h('span', {}, t('toolbar.export', 'Export')),
  ]);
  exportBtn.addEventListener('click', openExportModal);

  // Undo / Redo
  const undoBtn = h('button', { class: 'nx-pixelart-btn', title: 'Undo (Mod+Z)' }, [icon('rotate-ccw')]);
  undoBtn.addEventListener('click', undo);
  const redoBtn = h('button', { class: 'nx-pixelart-btn', title: 'Redo (Mod+Y)' }, [icon('rotate-cw')]);
  redoBtn.addEventListener('click', redo);

  // View toggles
  const gridToggle = h('button', { class: `nx-pixelart-btn ${showGrid ? 'active' : ''}` }, [
    icon('grid'),
    h('span', {}, t('toolbar.grid', 'Grid')),
  ]);
  gridToggle.addEventListener('click', () => {
    showGrid = !showGrid;
    gridToggle.classList.toggle('active', showGrid);
    renderCanvas();
  });

  const onionSkinToggle = h('button', { class: `nx-pixelart-btn ${onionSkin ? 'active' : ''}` }, [
    icon('eye'),
    h('span', {}, t('toolbar.onionSkin', 'Onion skin')),
  ]);
  onionSkinToggle.addEventListener('click', () => {
    onionSkin = !onionSkin;
    onionSkinToggle.classList.toggle('active', onionSkin);
    renderCanvas();
  });

  const mirrorToggle = h('button', { class: `nx-pixelart-btn ${mirrorMode ? 'active' : ''}` }, [
    icon('columns'),
    h('span', {}, t('toolbar.mirror', 'Mirror')),
  ]);
  mirrorToggle.addEventListener('click', () => {
    mirrorMode = !mirrorMode;
    mirrorToggle.classList.toggle('active', mirrorMode);
    renderCanvas();
  });

  // Zoom controls
  const zoomInBtn = h('button', { class: 'nx-pixelart-btn', title: t('toolbar.zoomIn', 'Zoom in') }, [icon('zoom-in')]);
  zoomInBtn.addEventListener('click', () => {
    if (zoomLevel < 48) {
      zoomLevel = Math.min(48, zoomLevel + 4);
      updateCanvasDimensions();
    }
  });

  const zoomOutBtn = h('button', { class: 'nx-pixelart-btn', title: t('toolbar.zoomOut', 'Zoom out') }, [
    icon('zoom-out'),
  ]);
  zoomOutBtn.addEventListener('click', () => {
    if (zoomLevel > 4) {
      zoomLevel = Math.max(4, zoomLevel - 4);
      updateCanvasDimensions();
    }
  });

  // Grid size selector
  const sizeContainer = h('div', { class: 'nx-pixelart-group' }, [
    h('span', { style: 'font-size: 11px;' }, t('toolbar.gridSize', 'Grid size')),
  ]);
  const sizeSelect = /** @type {HTMLSelectElement} */ (
    h('select', { class: 'nx-pixelart-select' }, [
      ...GRID_SIZES.map((sz) => h('option', { value: String(sz) }, `${sz}x${sz}`)),
    ])
  );
  sizeSelect.value = String(doc.width);
  sizeSelect.addEventListener('change', () => {
    const newSize = parseInt(sizeSelect.value, 10);
    resizeGrid(newSize, newSize);
  });
  sizeContainer.appendChild(sizeSelect);

  toolbar.append(
    h('div', { class: 'nx-pixelart-group' }, [newBtn, openBtn, saveBtn, exportBtn, statusLabel]),
    h('div', { class: 'nx-pixelart-group' }, [undoBtn, redoBtn, gridToggle, onionSkinToggle, mirrorToggle]),
    h('div', { class: 'nx-pixelart-group' }, [zoomOutBtn, zoomInBtn, sizeContainer]),
  );

  function resizeGrid(newW, newH) {
    pushHistory();
    doc.frames.forEach((frame) => {
      const oldPixels = frame.pixels;
      const oldW = doc.width;
      const oldH = doc.height;
      const newPixels = new Array(newW * newH).fill(-1);
      for (let y = 0; y < Math.min(oldH, newH); y++) {
        for (let x = 0; x < Math.min(oldW, newW); x++) {
          newPixels[y * newW + x] = oldPixels[y * oldW + x];
        }
      }
      frame.pixels = newPixels;
    });
    doc.width = newW;
    doc.height = newH;
    updateCanvasDimensions();
    renderTimeline();
  }

  // ─── Export Modal ────────────────────────────────────────────────────────
  function openExportModal() {
    let selectedScale = 8;
    const body = h('div', { style: 'display: flex; flex-direction: column; gap: 12px; min-width: 300px;' }, [
      h('label', { style: 'font-size: 12px; display: flex; flex-direction: column; gap: 4px;' }, [
        h('span', {}, t('export.scale', 'Scale factor')),
        h(
          'select',
          {
            class: 'nx-pixelart-select',
            onchange: (e) => {
              selectedScale = parseInt(e.target.value, 10);
            },
          },
          [
            h('option', { value: '1' }, '1x (Original)'),
            h('option', { value: '2' }, '2x'),
            h('option', { value: '4' }, '4x'),
            h('option', { value: '8', selected: 'true' }, '8x'),
            h('option', { value: '16' }, '16x'),
            h('option', { value: '32' }, '32x'),
          ],
        ),
      ]),
      h('button', { class: 'nx-pixelart-btn', style: 'padding: 8px;' }, [
        icon('image'),
        h('span', {}, t('export.pngScaled', 'PNG (Current frame)')),
      ]),
      h('button', { class: 'nx-pixelart-btn', style: 'padding: 8px;' }, [
        icon('columns'),
        h('span', {}, t('export.spriteSheet', 'Sprite Sheet (PNG)')),
      ]),
      h('button', { class: 'nx-pixelart-btn', style: 'padding: 8px;' }, [
        icon('video'),
        h('span', {}, t('export.gif', 'Animated GIF')),
      ]),
    ]);

    const modal = openModal({
      title: t('export.title', 'Export Sprite'),
      content: body,
      buttons: [{ label: 'Close', primary: false, onClick: () => modal.close() }],
    });

    const [pngBtn, sheetBtn, gifBtn] = body.querySelectorAll('button');

    pngBtn.addEventListener('click', async () => {
      modal.close();
      await exportCurrentFramePng(selectedScale);
    });

    sheetBtn.addEventListener('click', async () => {
      modal.close();
      await exportSpriteSheetPng(selectedScale);
    });

    gifBtn.addEventListener('click', async () => {
      modal.close();
      await exportAnimatedGif();
    });
  }

  async function exportCurrentFramePng(scale) {
    const frame = doc.frames[currentFrameIndex];
    if (!frame) return;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = doc.width * scale;
    offCanvas.height = doc.height * scale;
    const octx = offCanvas.getContext('2d');
    if (!octx) return;
    octx.imageSmoothingEnabled = false;

    for (let y = 0; y < doc.height; y++) {
      for (let x = 0; x < doc.width; x++) {
        const colIdx = frame.pixels[y * doc.width + x];
        if (colIdx >= 0 && colIdx < doc.palette.length) {
          octx.fillStyle = doc.palette[colIdx];
          octx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    const dataUrl = offCanvas.toDataURL('image/png');
    await saveExportedBuffer(`${doc.title || 'sprite'}.png`, dataUrlToUint8Array(dataUrl));
  }

  async function exportSpriteSheetPng(scale) {
    const count = doc.frames.length;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = doc.width * scale * count;
    offCanvas.height = doc.height * scale;
    const octx = offCanvas.getContext('2d');
    if (!octx) return;
    octx.imageSmoothingEnabled = false;

    doc.frames.forEach((frame, fIdx) => {
      const offsetX = fIdx * doc.width * scale;
      for (let y = 0; y < doc.height; y++) {
        for (let x = 0; x < doc.width; x++) {
          const colIdx = frame.pixels[y * doc.width + x];
          if (colIdx >= 0 && colIdx < doc.palette.length) {
            octx.fillStyle = doc.palette[colIdx];
            octx.fillRect(offsetX + x * scale, y * scale, scale, scale);
          }
        }
      }
    });

    const dataUrl = offCanvas.toDataURL('image/png');
    await saveExportedBuffer(`${doc.title || 'sprite'}-sheet.png`, dataUrlToUint8Array(dataUrl));
  }

  async function exportAnimatedGif() {
    try {
      const gifBytes = generateAnimatedGif(doc);
      await saveExportedBuffer(`${doc.title || 'animation'}.gif`, gifBytes);
    } catch (err) {
      ctx.dialog.alert(`GIF export failed: ${err.message}`);
    }
  }

  function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function saveExportedBuffer(defaultFilename, uint8Array) {
    const res = await ctx.dialog.showSaveDialog({
      defaultPath: `/home/user/${defaultFilename}`,
    });
    if (res && res.filePath) {
      await fs.writeFile(res.filePath, uint8Array);
      ctx.notify.success(t('export.saved', 'Exported successfully'));
    }
  }

  // ─── File Persistence ────────────────────────────────────────────────────
  async function saveFile() {
    if (!currentPath) {
      const res = await ctx.dialog.showSaveDialog({
        defaultPath: `/home/user/${doc.title || 'untitled'}.npixel`,
        filters: [{ name: 'Pixel Art (*.npixel)', extensions: ['npixel'] }],
      });
      if (!res || !res.filePath) return;
      currentPath = res.filePath;
    }
    const jsonStr = serializePixelDoc(doc);
    await fs.writeFile(currentPath, jsonStr);
    isDirty = false;
    updateStatus();
    ctx.notify.success('Saved');
  }

  async function loadFile(filePath) {
    try {
      const content = await fs.readFile(filePath, { encoding: 'utf8' });
      doc = parsePixelDoc(content);
      currentPath = filePath;
      isDirty = false;
      currentFrameIndex = 0;
      updateStatus();
      renderPaletteSwatches();
      sizeSelect.value = String(doc.width);
      fpsSelect.value = String(doc.fps);
      updateCanvasDimensions();
      renderTimeline();
    } catch {
      ctx.dialog.alert('Failed to open pixel art file');
    }
  }

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────────
  function handleKeyDown(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveFile();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayback();
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'b':
        selectTool('pencil');
        break;
      case 'e':
        selectTool('eraser');
        break;
      case 'g':
        selectTool('fill');
        break;
      case 'l':
        selectTool('line');
        break;
      case 'u':
        selectTool('rect');
        break;
      case 'c':
        selectTool('circle');
        break;
      case 'i':
        selectTool('picker');
        break;
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  // ─── Assembly & Initial Render ───────────────────────────────────────────
  const workspace = h('div', { class: 'nx-pixelart-workspace' }, [sidebar, viewport]);
  root.append(toolbar, workspace, timeline);
  container.appendChild(root);

  renderPaletteSwatches();
  updateCanvasDimensions();
  renderTimeline();

  // If opened with path
  if (currentPath) {
    loadFile(currentPath);
  }

  // Teardown
  return () => {
    stopPlayback();
    window.removeEventListener('keydown', handleKeyDown);
  };
}
