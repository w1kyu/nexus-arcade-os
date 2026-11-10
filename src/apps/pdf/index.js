// @ts-check
import { h, icon } from '../../ui/dom.js';
import { addPage, createPdfDoc, generatePdfBinary, movePage, removePage, rotatePage } from './model.js';
import './styles.css';

/**
 * Commands exported by nexus.pdf.
 * @type {import('../../kernel/types').AppModule['commands']}
 */
export const commands = {
  'pdf.open': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.pdf' }),
};

/**
 * Main application mount for PDF Tools.
 * @type {import('../../kernel/types').AppModule['mount']}
 */
export async function mount(container, ctx, args) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ [vars]) => ctx.i18n.t(key, vars);
  const fs = /** @type {any} */ (ctx.fs);

  let currentPath = /** @type {string | null} */ (args.path ?? null);

  let doc = createPdfDoc(t('app.untitled', 'Untitled Document'));

  // ─── DOM Elements ────────────────────────────────────────────────────────
  const root = h('div', { class: 'nx-pdf' });

  // Main Workspace
  const workspace = h('div', { class: 'nx-pdf-workspace' });

  // Viewer elements
  const viewerContainer = h('div', { class: 'nx-pdf-viewer-container', style: 'display: none;' });
  const pdfFrame = /** @type {HTMLIFrameElement} */ (
    h('iframe', { class: 'nx-pdf-frame', title: 'PDF Document Viewer' })
  );
  viewerContainer.appendChild(pdfFrame);

  // Combiner elements
  const combinerContainer = h('div', { class: 'nx-pdf-combiner-view' });

  workspace.append(viewerContainer, combinerContainer);

  // ─── Render Combiner Grid ────────────────────────────────────────────────
  function renderCombinerGrid() {
    combinerContainer.innerHTML = '';

    if (doc.pages.length === 0) {
      const dropzone = h('div', { class: 'nx-pdf-empty-dropzone' }, [
        icon('file-text', { size: 48 }),
        h(
          'span',
          { style: 'font-size: 14px; font-weight: 500;' },
          t('combiner.emptyPrompt', 'Drop images here or click Add Images'),
        ),
      ]);
      dropzone.addEventListener('click', promptAddImages);
      combinerContainer.appendChild(dropzone);
      return;
    }

    const grid = h('div', { class: 'nx-pdf-pages-grid' });

    doc.pages.forEach((page, idx) => {
      const card = h('div', { class: 'nx-pdf-page-card' });

      // Thumbnail
      const thumbWrapper = h('div', { class: 'nx-pdf-page-thumb-wrapper' });
      const badge = h('span', { class: 'nx-pdf-page-badge' }, `${idx + 1}`);
      const img = /** @type {HTMLImageElement} */ (
        h('img', {
          class: 'nx-pdf-page-thumb',
          src: page.dataUrl,
          style: `transform: rotate(${page.rotation}deg);`,
          alt: page.name,
        })
      );
      thumbWrapper.append(img, badge);

      // Actions bar
      const actions = h('div', { class: 'nx-pdf-page-actions' });

      const rotateBtn = h('button', { class: 'nx-pdf-page-action-btn', title: t('combiner.rotate', 'Rotate 90°') }, [
        icon('rotate-cw', { size: 14 }),
      ]);
      rotateBtn.addEventListener('click', () => {
        rotatePage(doc, idx);
        img.style.transform = `rotate(${page.rotation}deg)`;
      });

      const moveUpBtn = h(
        'button',
        {
          class: 'nx-pdf-page-action-btn',
          title: t('combiner.moveUp', 'Move up'),
          disabled: idx === 0,
        },
        [icon('chevron-left', { size: 14 })],
      );
      moveUpBtn.addEventListener('click', () => {
        movePage(doc, idx, idx - 1);
        renderCombinerGrid();
      });

      const moveDownBtn = h(
        'button',
        {
          class: 'nx-pdf-page-action-btn',
          title: t('combiner.moveDown', 'Move down'),
          disabled: idx === doc.pages.length - 1,
        },
        [icon('chevron-right', { size: 14 })],
      );
      moveDownBtn.addEventListener('click', () => {
        movePage(doc, idx, idx + 1);
        renderCombinerGrid();
      });

      const deleteBtn = h('button', { class: 'nx-pdf-page-action-btn', title: t('combiner.delete', 'Remove') }, [
        icon('trash', { size: 14 }),
      ]);
      deleteBtn.addEventListener('click', () => {
        removePage(doc, idx);
        renderCombinerGrid();
      });

      actions.append(rotateBtn, moveUpBtn, moveDownBtn, deleteBtn);
      card.append(thumbWrapper, actions);
      grid.appendChild(card);
    });

    combinerContainer.appendChild(grid);
  }

  function setViewMode(mode) {
    if (mode === 'viewer') {
      viewerContainer.style.display = 'flex';
      combinerContainer.style.display = 'none';
      viewerModeBtn.classList.add('active');
      combinerModeBtn.classList.remove('active');
    } else {
      viewerContainer.style.display = 'none';
      combinerContainer.style.display = 'flex';
      viewerModeBtn.classList.remove('active');
      combinerModeBtn.classList.add('active');
      renderCombinerGrid();
    }
  }

  // ─── Actions ─────────────────────────────────────────────────────────────
  async function promptAddImages() {
    const res = await ctx.dialog.showOpenDialog({
      filters: [{ name: 'Images (*.png, *.jpg, *.jpeg, *.webp)', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (res && res.filePath) {
      await importImageFile(res.filePath);
    }
  }

  async function importImageFile(filePath) {
    try {
      const data = await fs.readFile(filePath);
      let dataUrl = '';
      if (typeof data === 'string' && data.startsWith('data:')) {
        dataUrl = data;
      } else {
        const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
        const blob = new Blob([data], { type: mime });
        dataUrl = await blobToDataUrl(blob);
      }

      const img = new Image();
      img.onload = () => {
        addPage(doc, filePath.split('/').pop() || 'Page', dataUrl, img.naturalWidth, img.naturalHeight);
        setViewMode('combiner');
      };
      img.src = dataUrl;
    } catch {
      ctx.dialog.alert('Failed to read image file');
    }
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(/** @type {string} */ (reader.result));
      reader.readAsDataURL(blob);
    });
  }

  async function openPdfFile() {
    const res = await ctx.dialog.showOpenDialog({
      filters: [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }],
    });
    if (res && res.filePath) {
      await loadPdf(res.filePath);
    }
  }

  async function loadPdf(filePath) {
    try {
      const bytes = await fs.readFile(filePath);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      if (doc.pdfBlobUrl) {
        URL.revokeObjectURL(doc.pdfBlobUrl);
      }
      doc.pdfBlobUrl = URL.createObjectURL(blob);
      doc.pdfBytes = bytes;
      doc.title =
        filePath
          .split('/')
          .pop()
          ?.replace(/\.pdf$/i, '') || 'Document';
      pdfFrame.src = doc.pdfBlobUrl;
      currentPath = filePath;
      setViewMode('viewer');
    } catch {
      ctx.dialog.alert(t('dialog.errorLoading', 'Could not read PDF file'));
    }
  }

  async function compileAndPreviewPdf() {
    if (doc.pages.length === 0) {
      ctx.dialog.alert('Please add at least one page image before generating a PDF.');
      return;
    }
    try {
      const pdfBytes = await generatePdfBinary(doc);
      doc.pdfBytes = pdfBytes;
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      if (doc.pdfBlobUrl) {
        URL.revokeObjectURL(doc.pdfBlobUrl);
      }
      doc.pdfBlobUrl = URL.createObjectURL(blob);
      pdfFrame.src = doc.pdfBlobUrl;
      setViewMode('viewer');
      ctx.notify.success(t('dialog.generatedSuccess', 'PDF document generated successfully'));
    } catch (err) {
      ctx.dialog.alert(`PDF generation failed: ${err.message}`);
    }
  }

  async function savePdfToVfs() {
    if (!doc.pdfBytes) {
      if (doc.pages.length > 0) {
        await compileAndPreviewPdf();
      } else {
        ctx.dialog.alert('No PDF generated yet.');
        return;
      }
    }
    const res = await ctx.dialog.showSaveDialog({
      defaultPath: `/home/user/${doc.title || 'document'}.pdf`,
      filters: [{ name: 'PDF Document (*.pdf)', extensions: ['pdf'] }],
    });
    if (res && res.filePath) {
      await fs.writeFile(res.filePath, doc.pdfBytes);
      ctx.notify.success('PDF saved successfully');
    }
  }

  // ─── Toolbar ─────────────────────────────────────────────────────────────
  const toolbar = h('div', { class: 'nx-pdf-toolbar' });

  // View switch buttons
  const combinerModeBtn = h('button', { class: 'nx-pdf-btn active' }, [icon('copy'), h('span', {}, 'Combiner')]);
  combinerModeBtn.addEventListener('click', () => setViewMode('combiner'));

  const viewerModeBtn = h('button', { class: 'nx-pdf-btn' }, [icon('eye'), h('span', {}, 'Viewer')]);
  viewerModeBtn.addEventListener('click', () => setViewMode('viewer'));

  // Main actions
  const openBtn = h('button', { class: 'nx-pdf-btn' }, [icon('folder'), h('span', {}, t('toolbar.open', 'Open PDF'))]);
  openBtn.addEventListener('click', openPdfFile);

  const addImgBtn = h('button', { class: 'nx-pdf-btn' }, [
    icon('plus'),
    h('span', {}, t('toolbar.addImages', 'Add Images')),
  ]);
  addImgBtn.addEventListener('click', promptAddImages);

  const generateBtn = h('button', { class: 'nx-pdf-btn primary' }, [
    icon('file-text'),
    h('span', {}, t('toolbar.generatePdf', 'Create PDF')),
  ]);
  generateBtn.addEventListener('click', compileAndPreviewPdf);

  const saveBtn = h('button', { class: 'nx-pdf-btn' }, [
    icon('download'),
    h('span', {}, t('toolbar.download', 'Save PDF')),
  ]);
  saveBtn.addEventListener('click', savePdfToVfs);

  const printBtn = h('button', { class: 'nx-pdf-btn' }, [icon('printer'), h('span', {}, t('toolbar.print', 'Print'))]);
  printBtn.addEventListener('click', () => {
    if (pdfFrame.contentWindow) {
      pdfFrame.contentWindow.print();
    } else {
      window.print();
    }
  });

  const clearBtn = h('button', { class: 'nx-pdf-btn' }, [
    icon('trash'),
    h('span', {}, t('toolbar.clear', 'Clear All')),
  ]);
  clearBtn.addEventListener('click', async () => {
    if (doc.pages.length > 0) {
      const ok = await ctx.dialog.confirm(t('dialog.confirmClear', 'Clear all loaded pages?'));
      if (!ok) return;
    }
    doc.pages = [];
    renderCombinerGrid();
  });

  // Page Size & Orientation selectors
  const sizeSelect = /** @type {HTMLSelectElement} */ (
    h('select', { class: 'nx-pdf-select' }, [
      h('option', { value: 'a4' }, 'A4'),
      h('option', { value: 'letter' }, 'US Letter'),
      h('option', { value: 'auto' }, 'Fit Image'),
    ])
  );
  sizeSelect.value = doc.pageSize;
  sizeSelect.addEventListener('change', () => {
    doc.pageSize = /** @type {any} */ (sizeSelect.value);
  });

  const orientSelect = /** @type {HTMLSelectElement} */ (
    h('select', { class: 'nx-pdf-select' }, [
      h('option', { value: 'portrait' }, t('toolbar.portrait', 'Portrait')),
      h('option', { value: 'landscape' }, t('toolbar.landscape', 'Landscape')),
    ])
  );
  orientSelect.value = doc.orientation;
  orientSelect.addEventListener('change', () => {
    doc.orientation = /** @type {any} */ (orientSelect.value);
  });

  toolbar.append(
    h('div', { class: 'nx-pdf-group' }, [
      combinerModeBtn,
      viewerModeBtn,
      openBtn,
      addImgBtn,
      generateBtn,
      saveBtn,
      printBtn,
      clearBtn,
    ]),
    h('div', { class: 'nx-pdf-group' }, [
      h('span', { style: 'font-size: 11px;' }, t('toolbar.pageSize', 'Page size')),
      sizeSelect,
      h('span', { style: 'font-size: 11px;' }, t('toolbar.orientation', 'Orientation')),
      orientSelect,
    ]),
  );

  // ─── Assembly & Mount ────────────────────────────────────────────────────
  root.append(toolbar, workspace);
  container.appendChild(root);

  renderCombinerGrid();

  if (currentPath) {
    if (currentPath.toLowerCase().endsWith('.pdf')) {
      loadPdf(currentPath);
    } else {
      importImageFile(currentPath);
    }
  }

  // Teardown
  return () => {
    if (doc.pdfBlobUrl) {
      URL.revokeObjectURL(doc.pdfBlobUrl);
    }
  };
}
