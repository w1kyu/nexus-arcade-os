// @ts-check
import { h, icon } from '../../ui/dom.js';
import {
  applyAdjustments,
  DEFAULT_ADJUSTMENTS,
  drawArrow,
  drawTextAnnotation,
  exportPhoto,
  flipCanvas,
  PHOTO_PRESETS,
  pixelateArea,
  rotateCanvas,
} from './editor.js';
import { parseExif } from './exif.js';
import './styles.css';

/**
 * @typedef {object} PhotoItem
 * @property {string} id
 * @property {string} name
 * @property {string} url
 * @property {string} [path]
 * @property {Blob} [blob]
 * @property {number} size
 * @property {number} width
 * @property {number} height
 * @property {number} date
 * @property {boolean} isFavorite
 * @property {import('./exif').ExifData | null} [exif]
 */

/**
 * Nexus Photos main application.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(container, ctx) {
  const t = (key, fallback) => ctx.i18n.t(key, fallback);

  /** @type {PhotoItem[]} */
  let photos = [];
  /** @type {'all' | 'favorites'} */
  let activeFilter = 'all';
  /** @type {'date' | 'name' | 'size'} */
  let sortBy = 'date';
  let sortAsc = false;
  let activeViewerIndex = -1;
  let isSlideshow = false;
  /** @type {ReturnType<typeof setInterval> | null} */
  let slideshowInterval = null;

  // Viewer zoom & pan
  let zoomLevel = 1.0;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startPanX = 0;
  let startPanY = 0;
  let showMetaPanel = false;

  // Editor state
  /** @type {HTMLCanvasElement | null} */
  let editorCanvas = null;
  /** @type {HTMLCanvasElement | null} */
  let originalCanvas = null;
  let currentAdjustments = { ...DEFAULT_ADJUSTMENTS };
  let currentPreset = 'original';
  /** @type {'adjust' | 'crop' | 'annotate' | 'pixelate' | 'arrow' | 'text'} */
  let editorMode = 'adjust';
  let stripExifOnSave = false;

  // Load favorites
  /** @type {string[]} */
  let favoriteIds = [];
  try {
    const favs = await ctx.storage.get('photos', 'favorites');
    if (Array.isArray(favs)) favoriteIds = favs;
  } catch {
    /* storage optional */
  }

  const root = h('div', { class: 'nx-photos' });

  // Gallery Header
  const header = h('header', { class: 'nx-photos-header' });
  const title = h('h2', { class: 'nx-photos-title', text: t('photos.title', 'Nexus Photos') });

  const filterSelect = h(
    'select',
    {
      class: 'nx-select',
      onchange: (e) => {
        activeFilter = /** @type {'all' | 'favorites'} */ (/** @type {HTMLSelectElement} */ (e.target).value);
        renderGallery();
      },
    },
    h('option', { value: 'all', text: t('photos.all', 'All Photos') }),
    h('option', { value: 'favorites', text: t('photos.favorites', 'Favorites') }),
  );

  const sortSelect = h(
    'select',
    {
      class: 'nx-select',
      onchange: (e) => {
        sortBy = /** @type {'date' | 'name' | 'size'} */ (/** @type {HTMLSelectElement} */ (e.target).value);
        renderGallery();
      },
    },
    h('option', { value: 'date', text: t('photos.sortDate', 'Sort by Date') }),
    h('option', { value: 'name', text: t('photos.sortName', 'Sort by Name') }),
    h('option', { value: 'size', text: t('photos.sortSize', 'Sort by Size') }),
  );

  const importBtn = h(
    'button',
    {
      class: 'nx-btn is-primary',
      type: 'button',
      onclick: () => importPhotos(),
    },
    icon('plus', { size: 16 }),
    h('span', { text: t('photos.import', 'Import Photos') }),
  );

  const scanBtn = h(
    'button',
    {
      class: 'nx-btn is-ghost',
      type: 'button',
      title: 'Scan /Pictures',
      onclick: () => scanVfsPictures(),
    },
    icon('refresh', { size: 16 }),
  );

  header.append(
    h('div', { class: 'nx-photos-title-group' }, title, filterSelect, sortSelect),
    h('div', { class: 'nx-photos-toolbar' }, scanBtn, importBtn),
  );

  // Gallery Grid
  const gallery = h('main', { class: 'nx-photos-gallery' });
  root.append(header, gallery);

  // Lightbox Viewer Elements
  const viewer = h('div', { class: 'nx-photos-viewer', style: 'display: none;' });
  const viewerTopbar = h('div', { class: 'nx-photos-viewer-topbar' });
  const viewerBody = h('div', { class: 'nx-photos-viewer-body' });
  const viewport = h('div', { class: 'nx-photos-viewport' });
  const mainImg = /** @type {HTMLImageElement} */ (h('img', { class: 'nx-photos-main-img' }));
  const metaPanel = h('aside', { class: 'nx-photos-meta-panel', style: 'display: none;' });

  const btnPrev = h(
    'button',
    { class: 'nx-photos-nav-btn nx-photos-nav-prev', type: 'button' },
    icon('chevron-left', { size: 24 }),
  );
  const btnNext = h(
    'button',
    { class: 'nx-photos-nav-btn nx-photos-nav-next', type: 'button' },
    icon('chevron-right', { size: 24 }),
  );

  viewport.append(mainImg, btnPrev, btnNext);
  viewerBody.append(viewport, metaPanel);
  viewer.append(viewerTopbar, viewerBody);
  root.append(viewer);

  // Viewer topbar controls
  const viewerTitle = h('span', { style: 'font-weight: 600; font-size: 14px;' });
  const btnCloseViewer = h('button', { class: 'nx-btn is-ghost', type: 'button' }, icon('close', { size: 18 }));
  const btnZoomIn = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Zoom in' },
    icon('zoom-in', { size: 18 }),
  );
  const btnZoomOut = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Zoom out' },
    icon('zoom-out', { size: 18 }),
  );
  const btnZoomFit = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: '1:1 / Fit' },
    icon('maximize', { size: 18 }),
  );
  const btnSlideshow = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Slideshow' },
    icon('play', { size: 18 }),
  );
  const btnEdit = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Edit Photo' },
    icon('edit', { size: 18 }),
  );
  const btnInfo = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'EXIF Metadata' },
    icon('info', { size: 18 }),
  );
  const btnWallpaper = h(
    'button',
    { class: 'nx-btn is-ghost', type: 'button', title: 'Set as Wallpaper' },
    icon('wallpaper', { size: 18 }),
  );

  viewerTopbar.append(
    viewerTitle,
    h(
      'div',
      { style: 'display: flex; gap: 8px; align-items: center;' },
      btnZoomOut,
      btnZoomIn,
      btnZoomFit,
      btnSlideshow,
      btnEdit,
      btnWallpaper,
      btnInfo,
      btnCloseViewer,
    ),
  );

  // Editor View Elements
  const editor = h('div', { class: 'nx-photos-editor', style: 'display: none;' });
  const editorTopbar = h('div', { class: 'nx-photos-editor-topbar' });
  const editorWorkspace = h('div', { class: 'nx-photos-editor-workspace' });
  const canvasWrap = h('div', { class: 'nx-photos-editor-canvas-wrap' });
  const editorSidebar = h('aside', { class: 'nx-photos-editor-sidebar' });

  editorWorkspace.append(canvasWrap, editorSidebar);
  editor.append(editorTopbar, editorWorkspace);
  root.append(editor);

  // Editor controls topbar
  const btnCancelEdit = h('button', { class: 'nx-btn is-ghost', type: 'button', text: 'Cancel' });
  const btnSaveCopy = h('button', { class: 'nx-btn is-primary', type: 'button', text: 'Save Copy' });
  const btnOverwrite = h('button', { class: 'nx-btn is-ghost', type: 'button', text: 'Overwrite' });
  editorTopbar.append(
    h('span', { style: 'font-weight: 700; font-size: 15px;', text: 'Photo Editor' }),
    h('div', { style: 'display: flex; gap: 8px;' }, btnCancelEdit, btnOverwrite, btnSaveCopy),
  );

  // Scan /Pictures in VFS
  async function scanVfsPictures() {
    try {
      const entries = await ctx.vfs.list('/Pictures');
      let added = 0;
      for (const entry of entries) {
        if (entry.type === 'file' && /\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(entry.name)) {
          const path = `/Pictures/${entry.name}`;
          if (!photos.some((p) => p.path === path)) {
            const blob = await ctx.vfs.read(path);
            const item = await createPhotoItem(blob, entry.name, path);
            photos.push(item);
            added++;
          }
        }
      }
      renderGallery();
      if (added > 0) {
        ctx.notifications.show({ title: 'Nexus Photos', body: `Found ${added} new images in /Pictures` });
      }
    } catch {
      /* /Pictures empty */
    }
  }

  /**
   * Creates a photo item with dimensions, thumbnail and EXIF.
   * @param {Blob} blob
   * @param {string} name
   * @param {string} [path]
   * @returns {Promise<PhotoItem>}
   */
  async function createPhotoItem(blob, name, path) {
    const url = URL.createObjectURL(blob);
    let exif = null;
    if (/\.(jpg|jpeg)$/i.test(name)) {
      try {
        const buffer = await blob.arrayBuffer();
        exif = parseExif(buffer);
      } catch {
        /* ignore exif error */
      }
    }

    // Read dimensions via image element
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 800, h: 600 });
      img.src = url;
    });

    return {
      id: path || `photo-${Date.now()}-${Math.random()}`,
      name,
      url,
      path,
      blob,
      size: blob.size,
      width: dims.w,
      height: dims.h,
      date: Date.now(),
      isFavorite: favoriteIds.includes(path || name),
      exif,
    };
  }

  // Import files
  function importPhotos() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.jpg,.jpeg,.png,.webp,.gif';
    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) return;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const item = await createPhotoItem(file, file.name);
        photos.push(item);
        // Also copy to VFS /Pictures
        try {
          await ctx.vfs.write(`/Pictures/${file.name}`, file);
          item.path = `/Pictures/${file.name}`;
        } catch {
          /* ignore */
        }
      }
      renderGallery();
    };
    input.click();
  }

  // Render gallery grid
  function renderGallery() {
    let list = photos.filter((p) => {
      if (activeFilter === 'favorites') return p.isFavorite;
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'name') return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      if (sortBy === 'size') return sortAsc ? a.size - b.size : b.size - a.size;
      return sortAsc ? a.date - b.date : b.date - a.date;
    });

    if (list.length === 0) {
      gallery.replaceChildren(
        h(
          'div',
          { style: 'grid-column: 1 / -1; padding: 60px; text-align: center; color: var(--nx-text-muted);' },
          icon('image', { size: 48 }),
          h('p', {
            style: 'margin-top: 12px; font-size: 15px;',
            text: 'No photos in library. Import or scan /Pictures.',
          }),
        ),
      );
      return;
    }

    gallery.replaceChildren(
      ...list.map((photo) => {
        const card = h(
          'div',
          {
            class: 'nx-photos-thumb-card',
            onclick: () => openViewer(photos.indexOf(photo)),
          },
          h('img', { class: 'nx-photos-thumb-img', src: photo.url, alt: photo.name, loading: 'lazy' }),
          h(
            'div',
            { class: 'nx-photos-thumb-meta' },
            h('span', { class: 'nx-photos-thumb-name', text: photo.name }),
            h(
              'button',
              {
                class: 'nx-photos-fav-btn',
                type: 'button',
                onclick: (e) => {
                  e.stopPropagation();
                  photo.isFavorite = !photo.isFavorite;
                  if (photo.isFavorite) {
                    if (!favoriteIds.includes(photo.id)) favoriteIds.push(photo.id);
                  } else {
                    favoriteIds = favoriteIds.filter((id) => id !== photo.id);
                  }
                  saveFavorites();
                  renderGallery();
                },
              },
              icon('star', {
                size: 16,
                style: photo.isFavorite ? 'color: #eab308;' : 'opacity: 0.35;',
              }),
            ),
          ),
        );
        return card;
      }),
    );
  }

  async function saveFavorites() {
    try {
      await ctx.storage.set('photos', 'favorites', favoriteIds);
    } catch {
      /* ignore */
    }
  }

  // Open Lightbox Viewer
  function openViewer(index) {
    if (index < 0 || index >= photos.length) return;
    activeViewerIndex = index;
    const photo = photos[index];
    mainImg.src = photo.url;
    viewerTitle.textContent = photo.name;
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    applyViewerTransform();
    viewer.style.display = 'flex';
    renderMetadataPanel(photo);
  }

  function closeViewer() {
    viewer.style.display = 'none';
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      slideshowInterval = null;
      isSlideshow = false;
      btnSlideshow.replaceChildren(icon('play', { size: 18 }));
    }
  }

  function applyViewerTransform() {
    mainImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  }

  function renderMetadataPanel(photo) {
    metaPanel.replaceChildren(
      h('div', { class: 'nx-photos-meta-heading', text: 'File Details' }),
      h(
        'div',
        { class: 'nx-photos-meta-row' },
        h('span', { class: 'nx-photos-meta-label', text: 'Name:' }),
        h('span', { class: 'nx-photos-meta-value', text: photo.name }),
      ),
      h(
        'div',
        { class: 'nx-photos-meta-row' },
        h('span', { class: 'nx-photos-meta-label', text: 'Dimensions:' }),
        h('span', { class: 'nx-photos-meta-value', text: `${photo.width} × ${photo.height}` }),
      ),
      h(
        'div',
        { class: 'nx-photos-meta-row' },
        h('span', { class: 'nx-photos-meta-label', text: 'Size:' }),
        h('span', { class: 'nx-photos-meta-value', text: `${(photo.size / 1024).toFixed(1)} KB` }),
      ),
    );

    if (photo.exif) {
      const ex = photo.exif;
      metaPanel.append(
        h('div', { class: 'nx-photos-meta-heading', text: 'Camera & EXIF' }),
        ex.make
          ? h(
              'div',
              { class: 'nx-photos-meta-row' },
              h('span', { class: 'nx-photos-meta-label', text: 'Make:' }),
              h('span', { class: 'nx-photos-meta-value', text: ex.make }),
            )
          : null,
        ex.model
          ? h(
              'div',
              { class: 'nx-photos-meta-row' },
              h('span', { class: 'nx-photos-meta-label', text: 'Model:' }),
              h('span', { class: 'nx-photos-meta-value', text: ex.model }),
            )
          : null,
        ex.lensModel
          ? h(
              'div',
              { class: 'nx-photos-meta-row' },
              h('span', { class: 'nx-photos-meta-label', text: 'Lens:' }),
              h('span', { class: 'nx-photos-meta-value', text: ex.lensModel }),
            )
          : null,
        ex.exposureTime
          ? h(
              'div',
              { class: 'nx-photos-meta-row' },
              h('span', { class: 'nx-photos-meta-label', text: 'Exposure:' }),
              h('span', { class: 'nx-photos-meta-value', text: ex.exposureTime }),
            )
          : null,
        ex.fNumber
          ? h(
              'div',
              { class: 'nx-photos-meta-row' },
              h('span', { class: 'nx-photos-meta-label', text: 'Aperture:' }),
              h('span', { class: 'nx-photos-meta-value', text: `f/${ex.fNumber}` }),
            )
          : null,
        ex.iso
          ? h(
              'div',
              { class: 'nx-photos-meta-row' },
              h('span', { class: 'nx-photos-meta-label', text: 'ISO:' }),
              h('span', { class: 'nx-photos-meta-value', text: String(ex.iso) }),
            )
          : null,
        ex.focalLength
          ? h(
              'div',
              { class: 'nx-photos-meta-row' },
              h('span', { class: 'nx-photos-meta-label', text: 'Focal Length:' }),
              h('span', { class: 'nx-photos-meta-value', text: `${ex.focalLength} mm` }),
            )
          : null,
        ex.dateTime
          ? h(
              'div',
              { class: 'nx-photos-meta-row' },
              h('span', { class: 'nx-photos-meta-label', text: 'Date Taken:' }),
              h('span', { class: 'nx-photos-meta-value', text: ex.dateTime }),
            )
          : null,
      );

      if (ex.latitude !== undefined && ex.longitude !== undefined) {
        metaPanel.append(
          h('div', { class: 'nx-photos-meta-heading', text: 'GPS Location' }),
          h(
            'div',
            { class: 'nx-photos-meta-row' },
            h('span', { class: 'nx-photos-meta-label', text: 'Coordinates:' }),
            h('span', { class: 'nx-photos-meta-value', text: `${ex.latitude.toFixed(5)}, ${ex.longitude.toFixed(5)}` }),
          ),
        );
      }
    }
  }

  // Pan & Zoom events
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    zoomLevel = Math.max(0.2, Math.min(6.0, zoomLevel * zoomFactor));
    applyViewerTransform();
  });

  viewport.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
      viewport.classList.add('is-dragging');
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      panX = e.clientX - startPanX;
      panY = e.clientY - startPanY;
      applyViewerTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      viewport.classList.remove('is-dragging');
    }
  });

  btnZoomIn.onclick = () => {
    zoomLevel = Math.min(6.0, zoomLevel * 1.25);
    applyViewerTransform();
  };
  btnZoomOut.onclick = () => {
    zoomLevel = Math.max(0.2, zoomLevel / 1.25);
    applyViewerTransform();
  };
  btnZoomFit.onclick = () => {
    zoomLevel = zoomLevel === 1.0 ? 2.0 : 1.0;
    panX = 0;
    panY = 0;
    applyViewerTransform();
  };

  btnPrev.onclick = () => {
    if (activeViewerIndex > 0) openViewer(activeViewerIndex - 1);
  };
  btnNext.onclick = () => {
    if (activeViewerIndex + 1 < photos.length) openViewer(activeViewerIndex + 1);
  };
  btnCloseViewer.onclick = () => closeViewer();

  btnInfo.onclick = () => {
    showMetaPanel = !showMetaPanel;
    metaPanel.style.display = showMetaPanel ? 'flex' : 'none';
  };

  btnSlideshow.onclick = () => {
    isSlideshow = !isSlideshow;
    if (isSlideshow) {
      btnSlideshow.replaceChildren(icon('pause', { size: 18 }));
      slideshowInterval = setInterval(() => {
        let nextIdx = activeViewerIndex + 1;
        if (nextIdx >= photos.length) nextIdx = 0;
        openViewer(nextIdx);
      }, 4000);
    } else {
      btnSlideshow.replaceChildren(icon('play', { size: 18 }));
      if (slideshowInterval) clearInterval(slideshowInterval);
      slideshowInterval = null;
    }
  };

  // Set as wallpaper intent
  btnWallpaper.onclick = async () => {
    const photo = photos[activeViewerIndex];
    if (photo && ctx.system?.settings) {
      ctx.system.settings.set('system', 'wallpaper', photo.url);
      ctx.notifications.show({ title: 'Wallpaper Updated', body: `Set "${photo.name}" as desktop wallpaper` });
    }
  };

  // Open Photo Editor
  btnEdit.onclick = () => {
    if (activeViewerIndex < 0) return;
    openEditor(photos[activeViewerIndex]);
  };

  async function openEditor(photo) {
    editor.style.display = 'flex';
    currentAdjustments = { ...DEFAULT_ADJUSTMENTS };
    currentPreset = 'original';

    // Load original image into canvas
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = photo.url;
    await img.decode();

    originalCanvas = document.createElement('canvas');
    originalCanvas.width = img.naturalWidth;
    originalCanvas.height = img.naturalHeight;
    const octx = originalCanvas.getContext('2d');
    if (octx) octx.drawImage(img, 0, 0);

    editorCanvas = document.createElement('canvas');
    editorCanvas.className = 'nx-photos-canvas';
    editorCanvas.width = originalCanvas.width;
    editorCanvas.height = originalCanvas.height;
    const ectx = editorCanvas.getContext('2d');
    if (ectx) ectx.drawImage(originalCanvas, 0, 0);

    canvasWrap.replaceChildren(editorCanvas);
    renderEditorSidebar();
    bindEditorDrawing();
  }

  function closeEditor() {
    editor.style.display = 'none';
  }

  btnCancelEdit.onclick = () => closeEditor();

  btnSaveCopy.onclick = async () => {
    if (!editorCanvas || activeViewerIndex < 0) return;
    const photo = photos[activeViewerIndex];
    const blob = await exportPhoto(editorCanvas, 'image/jpeg', 0.92, stripExifOnSave);
    const newName = `Edited_${photo.name}`;
    const newPath = `/Pictures/${newName}`;
    try {
      await ctx.vfs.write(newPath, blob);
      const newItem = await createPhotoItem(blob, newName, newPath);
      photos.push(newItem);
      renderGallery();
      closeEditor();
      ctx.notifications.show({ title: 'Photo Saved', body: `Saved copy to ${newPath}` });
    } catch (err) {
      console.warn('Save error:', err);
    }
  };

  btnOverwrite.onclick = async () => {
    if (!editorCanvas || activeViewerIndex < 0) return;
    const photo = photos[activeViewerIndex];
    const blob = await exportPhoto(editorCanvas, 'image/jpeg', 0.92, stripExifOnSave);
    if (photo.path) {
      try {
        await ctx.vfs.write(photo.path, blob);
        photo.blob = blob;
        photo.url = URL.createObjectURL(blob);
        mainImg.src = photo.url;
        renderGallery();
        closeEditor();
        ctx.notifications.show({ title: 'Photo Updated', body: `Overwrote ${photo.path}` });
      } catch (err) {
        console.warn('Overwrite error:', err);
      }
    }
  };

  function updateEditorCanvas() {
    if (!originalCanvas || !editorCanvas) return;
    const adjusted = applyAdjustments(originalCanvas, currentAdjustments);
    editorCanvas.width = adjusted.width;
    editorCanvas.height = adjusted.height;
    const ctx = editorCanvas.getContext('2d');
    if (ctx) ctx.drawImage(adjusted, 0, 0);
  }

  function renderEditorSidebar() {
    const rotateRow = h(
      'div',
      { style: 'display: flex; gap: 8px;' },
      h('button', {
        class: 'nx-btn',
        type: 'button',
        text: 'Rotate 90°',
        onclick: () => {
          if (originalCanvas) {
            originalCanvas = rotateCanvas(originalCanvas);
            updateEditorCanvas();
          }
        },
      }),
      h('button', {
        class: 'nx-btn',
        type: 'button',
        text: 'Flip H',
        onclick: () => {
          if (originalCanvas) {
            originalCanvas = flipCanvas(originalCanvas, 'h');
            updateEditorCanvas();
          }
        },
      }),
      h('button', {
        class: 'nx-btn',
        type: 'button',
        text: 'Flip V',
        onclick: () => {
          if (originalCanvas) {
            originalCanvas = flipCanvas(originalCanvas, 'v');
            updateEditorCanvas();
          }
        },
      }),
    );

    // Presets
    const presetSelect = h(
      'select',
      {
        class: 'nx-select',
        onchange: (e) => {
          currentPreset = /** @type {HTMLSelectElement} */ (e.target).value;
          currentAdjustments = { ...PHOTO_PRESETS[currentPreset] };
          updateEditorCanvas();
          renderEditorSidebar();
        },
      },
      ...Object.keys(PHOTO_PRESETS).map((p) =>
        h('option', { value: p, text: p.charAt(0).toUpperCase() + p.slice(1), selected: p === currentPreset }),
      ),
    );

    // Sliders
    const makeSlider = (key, label, min, max) => {
      const valLabel = h('span', { text: String(currentAdjustments[key]) });
      const slider = h('input', {
        class: 'nx-slider',
        type: 'range',
        min: String(min),
        max: String(max),
        value: String(currentAdjustments[key]),
        oninput: (e) => {
          currentAdjustments[key] = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
          valLabel.textContent = String(currentAdjustments[key]);
          updateEditorCanvas();
        },
      });
      return h(
        'div',
        { class: 'nx-photos-slider-group' },
        h('div', { class: 'nx-photos-slider-header' }, h('span', { text: label }), valLabel),
        slider,
      );
    };

    // Annotate tools
    const toolSelect = h(
      'select',
      {
        class: 'nx-select',
        onchange: (e) => {
          editorMode = /** @type {any} */ (/** @type {HTMLSelectElement} */ (e.target).value);
        },
      },
      h('option', { value: 'adjust', text: 'Tool: Adjustments' }),
      h('option', { value: 'arrow', text: 'Tool: Draw Arrow' }),
      h('option', { value: 'text', text: 'Tool: Add Text Label' }),
      h('option', { value: 'pixelate', text: 'Tool: Privacy Pixelate' }),
    );

    // Privacy EXIF Toggle
    const exifCheckbox = h('input', {
      type: 'checkbox',
      checked: stripExifOnSave,
      onchange: (e) => {
        stripExifOnSave = /** @type {HTMLInputElement} */ (e.target).checked;
      },
    });

    const exifToggle = h(
      'label',
      { style: 'display: flex; gap: 8px; align-items: center; font-size: 13px; cursor: pointer;' },
      exifCheckbox,
      h('span', { text: 'Remove EXIF metadata on export' }),
    );

    editorSidebar.replaceChildren(
      h('div', { style: 'font-weight: 700; font-size: 13px; color: #818cf8;', text: 'Geometry' }),
      rotateRow,
      h('div', { style: 'font-weight: 700; font-size: 13px; color: #818cf8;', text: 'Filters & Presets' }),
      presetSelect,
      h('div', { style: 'font-weight: 700; font-size: 13px; color: #818cf8;', text: 'Adjustments' }),
      makeSlider('brightness', 'Brightness', -100, 100),
      makeSlider('contrast', 'Contrast', -100, 100),
      makeSlider('saturation', 'Saturation', -100, 100),
      makeSlider('warmth', 'Temperature', -100, 100),
      makeSlider('vignette', 'Vignette', 0, 100),
      makeSlider('blur', 'Blur', 0, 20),
      h('div', { style: 'font-weight: 700; font-size: 13px; color: #818cf8;', text: 'Tools & Annotate' }),
      toolSelect,
      exifToggle,
    );
  }

  // Bind drawing on editor canvas for annotations & pixelation
  let isDrawing = false;
  let startX = 0;
  let startY = 0;

  function bindEditorDrawing() {
    if (!editorCanvas) return;
    editorCanvas.onmousedown = (e) => {
      if (editorMode === 'adjust') return;
      const rect = editorCanvas?.getBoundingClientRect();
      if (!rect || !editorCanvas) return;
      isDrawing = true;
      const scaleX = editorCanvas.width / rect.width;
      const scaleY = editorCanvas.height / rect.height;
      startX = (e.clientX - rect.left) * scaleX;
      startY = (e.clientY - rect.top) * scaleY;
    };

    editorCanvas.onmouseup = async (e) => {
      if (!isDrawing || !editorCanvas) return;
      isDrawing = false;
      const rect = editorCanvas.getBoundingClientRect();
      const scaleX = editorCanvas.width / rect.width;
      const scaleY = editorCanvas.height / rect.height;
      const endX = (e.clientX - rect.left) * scaleX;
      const endY = (e.clientY - rect.top) * scaleY;

      if (editorMode === 'arrow') {
        drawArrow(editorCanvas, startX, startY, endX, endY);
        if (originalCanvas) {
          const octx = originalCanvas.getContext('2d');
          if (octx) octx.drawImage(editorCanvas, 0, 0);
        }
      } else if (editorMode === 'pixelate') {
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(endX - startX);
        const h = Math.abs(endY - startY);
        pixelateArea(editorCanvas, x, y, w, h);
        if (originalCanvas) {
          pixelateArea(originalCanvas, x, y, w, h);
        }
      } else if (editorMode === 'text') {
        const text = await ctx.dialog.prompt('Annotation text:', 'Important');
        if (text) {
          drawTextAnnotation(editorCanvas, text, startX, startY);
          if (originalCanvas) drawTextAnnotation(originalCanvas, text, startX, startY);
        }
      }
    };
  }

  // Check params on boot (e.g. opened from Files or Wallpaper)
  if (ctx.params?.file) {
    createPhotoItem(ctx.params.file, ctx.params.file.name).then((item) => {
      photos.push(item);
      renderGallery();
      openViewer(0);
    });
  } else if (ctx.params?.path) {
    ctx.vfs
      .read(ctx.params.path)
      .then(async (blob) => {
        const item = await createPhotoItem(blob, ctx.params.path.split('/').pop() || 'Photo', ctx.params.path);
        photos.push(item);
        renderGallery();
        openViewer(0);
      })
      .catch(() => {});
  }

  // Scan initial pictures
  scanVfsPictures();

  container.append(root);

  return {
    unmount() {
      closeViewer();
    },
  };
}
