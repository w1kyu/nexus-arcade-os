// @ts-check
import { h, icon } from '../../ui/dom.js';
import { renderMarkdown } from '../../ui/markdown.js';
import { openModal } from '../../ui/overlay.js';
import {
  createPresentDoc,
  generateStandaloneHtml,
  parsePresentDoc,
  parseSlides,
  PRESENT_TEMPLATES,
  PRESENT_THEMES,
  serializePresentDoc,
} from './model.js';
import './styles.css';

/**
 * Commands exported by nexus.present.
 * @type {import('../../kernel/types').AppModule['commands']}
 */
export const commands = {
  'present.new': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.present', args: { newFile: true } }),
};

/**
 * Main application mount for Nexus Present.
 * @type {import('../../kernel/types').AppModule['mount']}
 */
export async function mount(container, ctx, args) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>=} */ vars) => ctx.i18n.t(key, vars);
  const fs = /** @type {any} */ (ctx.fs);

  let currentPath = /** @type {string | null} */ (args.path ?? null);
  let isDirty = false;

  /** @type {import('./model.js').PresentDoc} */
  let doc = createPresentDoc(t('app.untitled', 'Untitled Presentation'));
  let currentSlideIndex = 0;
  let parsedSlides = parseSlides(doc.source);
  /** @type {string[]} */
  let renderedSlidesHtml = [];

  // Presenter mode state
  let isPresenterOpen = false;
  let timerSeconds = 0;
  let timerRunning = false;
  /** @type {number | null} */
  let timerInterval = null;

  // ─── Status indicator ────────────────────────────────────────────────────
  const statusLabel = h('span', { class: 'nx-present-status' }, '');
  function updateStatus(dirty = false) {
    isDirty = dirty;
    statusLabel.textContent = isDirty ? '●' : '';
    statusLabel.title = isDirty ? 'Unsaved changes' : 'All changes saved';
  }

  // ─── Slide Rendering ─────────────────────────────────────────────────────
  async function refreshRenderedSlides() {
    parsedSlides = parseSlides(doc.source);
    if (currentSlideIndex >= parsedSlides.length) {
      currentSlideIndex = Math.max(0, parsedSlides.length - 1);
    }

    // Render markdown for all slides
    const renders = await Promise.all(
      parsedSlides.map((slide) => renderMarkdown(slide.content, { math: true, footnotes: true })),
    );
    renderedSlidesHtml = renders;
    renderCurrentSlide();
    updateSlideCounter();
    if (isPresenterOpen) {
      renderPresenterContent();
    }
  }

  const slideFrame = h('div', { class: 'nx-present-slide-frame' });
  const slideBody = h('div', { class: 'nx-present-slide-body' });
  const slideFooter = h('div', { class: 'nx-present-slide-footer' });
  const slideFooterTitle = h('span', {}, doc.title);
  const slideFooterCounter = h('span', {}, '');
  slideFooter.append(slideFooterTitle, slideFooterCounter);
  slideFrame.append(slideBody, slideFooter);

  function applySlideTheme(frameEl) {
    const theme = PRESENT_THEMES[doc.theme] || PRESENT_THEMES.dark;
    frameEl.style.backgroundColor = theme.bg;
    frameEl.style.color = theme.text;
    frameEl.style.fontFamily = theme.font;
    frameEl.style.setProperty('--color-accent', theme.accent);
    frameEl.classList.toggle('ratio-4-3', doc.aspectRatio === '4:3');
  }

  function renderCurrentSlide() {
    applySlideTheme(slideFrame);
    slideFooterTitle.textContent = doc.title;
    slideFooterCounter.textContent = `${currentSlideIndex + 1} / ${parsedSlides.length}`;

    const currentHtml = renderedSlidesHtml[currentSlideIndex] ?? '';
    slideBody.innerHTML = currentHtml;
  }

  function updateSlideCounter() {
    slideCounterText.textContent = t('nav.slideOf', {
      current: currentSlideIndex + 1,
      total: parsedSlides.length,
    });
    slideFooterCounter.textContent = `${currentSlideIndex + 1} / ${parsedSlides.length}`;
  }

  function goToSlide(idx) {
    if (idx < 0 || idx >= parsedSlides.length) return;
    currentSlideIndex = idx;
    renderCurrentSlide();
    updateSlideCounter();
    if (isPresenterOpen) renderPresenterContent();
  }

  function nextSlide() {
    if (currentSlideIndex < parsedSlides.length - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  }

  function prevSlide() {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }

  // ─── Left Panel: Markdown Editor ─────────────────────────────────────────
  const editorPanel = h('div', { class: 'nx-present-editor-panel' });
  const editorHeader = h('div', { class: 'nx-present-editor-header' }, [
    h('span', {}, 'Markdown Slides (use --- for new slide)'),
    h('span', {}, `${parsedSlides.length} slides`),
  ]);

  const textarea = /** @type {HTMLTextAreaElement} */ (
    h('textarea', { class: 'nx-present-textarea', spellcheck: 'false' }, doc.source)
  );

  let debounceTimer = null;
  textarea.addEventListener('input', () => {
    doc.source = textarea.value;
    updateStatus(true);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      refreshRenderedSlides();
      editorHeader.lastChild.textContent = `${parsedSlides.length} slides`;
    }, 250);
  });

  editorPanel.append(editorHeader, textarea);

  // ─── Right Panel: Preview & Navigation ───────────────────────────────────
  const previewPanel = h('div', { class: 'nx-present-preview-panel' });
  const stage = h('div', { class: 'nx-present-stage' }, [slideFrame]);

  const navBar = h('div', { class: 'nx-present-nav-bar' });
  const prevBtn = h('button', { class: 'nx-present-btn', title: t('nav.prev', 'Previous slide') }, [
    icon('chevron-left'),
    h('span', {}, 'Prev'),
  ]);
  prevBtn.addEventListener('click', prevSlide);

  const nextBtn = h('button', { class: 'nx-present-btn', title: t('nav.next', 'Next slide') }, [
    h('span', {}, 'Next'),
    icon('chevron-right'),
  ]);
  nextBtn.addEventListener('click', nextSlide);

  const slideCounterText = h('span', { class: 'nx-present-slide-counter' }, '');
  updateSlideCounter();

  navBar.append(prevBtn, slideCounterText, nextBtn);

  previewPanel.append(stage, navBar);

  // ─── Fullscreen Slide Show Mode ──────────────────────────────────────────
  function launchFullscreenSlideShow() {
    const overlay = h('div', { class: 'nx-present-fullscreen-overlay' });
    const fullFrame = h('div', { class: 'nx-present-slide-frame' });
    const fullBody = h('div', { class: 'nx-present-slide-body' });
    const fullFooter = h('div', { class: 'nx-present-slide-footer' });
    const fullTitle = h('span', {}, doc.title);
    const fullCounter = h('span', {}, '');
    fullFooter.append(fullTitle, fullCounter);
    fullFrame.append(fullBody, fullFooter);

    const exitBtn = h('button', { class: 'nx-present-fullscreen-exit-btn' }, 'Exit Fullscreen (Esc)');
    exitBtn.addEventListener('click', closeFullscreen);

    overlay.append(fullFrame, exitBtn);
    document.body.appendChild(overlay);

    function updateFullscreenSlide() {
      applySlideTheme(fullFrame);
      fullBody.innerHTML = renderedSlidesHtml[currentSlideIndex] ?? '';
      fullCounter.textContent = `${currentSlideIndex + 1} / ${parsedSlides.length}`;

      // Scale to fit window
      const is43 = doc.aspectRatio === '4:3';
      const baseW = is43 ? 720 : 800;
      const baseH = is43 ? 540 : 450;
      const scaleX = (window.innerWidth * 0.95) / baseW;
      const scaleY = (window.innerHeight * 0.95) / baseH;
      const scale = Math.min(scaleX, scaleY);
      fullFrame.style.transform = `scale(${scale})`;
    }

    function handleFullscreenKeys(e) {
      if (e.key === 'Escape') {
        closeFullscreen();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        if (currentSlideIndex < parsedSlides.length - 1) {
          goToSlide(currentSlideIndex + 1);
          updateFullscreenSlide();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault();
        if (currentSlideIndex > 0) {
          goToSlide(currentSlideIndex - 1);
          updateFullscreenSlide();
        }
      }
    }

    function closeFullscreen() {
      window.removeEventListener('keydown', handleFullscreenKeys);
      window.removeEventListener('resize', updateFullscreenSlide);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      overlay.remove();
    }

    window.addEventListener('keydown', handleFullscreenKeys);
    window.addEventListener('resize', updateFullscreenSlide);
    updateFullscreenSlide();

    if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {});
    }
  }

  // ─── Presenter Mode View ─────────────────────────────────────────────────
  let presenterModalInstance = null;
  const currentPreviewEl = h('div', { class: 'nx-presenter-current-preview' });
  const nextPreviewEl = h('div', { class: 'nx-presenter-next-preview' });
  const notesBodyEl = h('div', { class: 'nx-presenter-notes-body' });
  const timerDisplayEl = h('span', {}, '00:00');

  function renderPresenterContent() {
    // Current slide mini preview
    const curHtml = renderedSlidesHtml[currentSlideIndex] ?? '';
    currentPreviewEl.innerHTML = `<div style="transform: scale(0.35); transform-origin: top left; width: 800px; height: 450px; padding: 20px; background: ${PRESENT_THEMES[doc.theme]?.bg || '#0f172a'}; color: ${PRESENT_THEMES[doc.theme]?.text || '#f8fafc'};">${curHtml}</div>`;

    // Next slide mini preview
    const nextHtml = renderedSlidesHtml[currentSlideIndex + 1];
    if (nextHtml) {
      nextPreviewEl.innerHTML = `<div style="transform: scale(0.25); transform-origin: top left; width: 800px; height: 450px; padding: 20px; background: ${PRESENT_THEMES[doc.theme]?.bg || '#0f172a'}; color: ${PRESENT_THEMES[doc.theme]?.text || '#f8fafc'};">${nextHtml}</div>`;
    } else {
      nextPreviewEl.innerHTML = '<div style="color: #64748b; font-size: 12px;">End of Presentation</div>';
    }

    // Notes
    const curSlide = parsedSlides[currentSlideIndex];
    notesBodyEl.textContent = curSlide?.notes || t('presenter.noNotes', 'No notes for this slide.');
  }

  function startTimer() {
    timerRunning = true;
    timerInterval = /** @type {any} */ (
      setInterval(() => {
        timerSeconds += 1;
        const mins = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
        const secs = String(timerSeconds % 60).padStart(2, '0');
        timerDisplayEl.textContent = `${mins}:${secs}`;
      }, 1000)
    );
  }

  function stopTimer() {
    timerRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function resetTimer() {
    stopTimer();
    timerSeconds = 0;
    timerDisplayEl.textContent = '00:00';
    startTimer();
  }

  function openPresenterMode() {
    isPresenterOpen = true;
    if (!timerRunning) startTimer();

    const presenterRoot = h('div', { class: 'nx-presenter-modal' });

    // Header with timer and controls
    const timerHeader = h('div', { class: 'nx-presenter-header' }, [
      h('div', { class: 'nx-present-group' }, [
        icon('clock'),
        h('span', { class: 'nx-presenter-timer' }, [timerDisplayEl]),
        h('button', { class: 'nx-present-btn', onclick: resetTimer }, t('presenter.resetTimer', 'Reset timer')),
      ]),
      h('div', { class: 'nx-present-group' }, [
        h('button', { class: 'nx-present-btn', onclick: prevSlide }, 'Previous'),
        h('button', { class: 'nx-present-btn primary', onclick: nextSlide }, 'Next Slide'),
      ]),
    ]);

    // Slides & Notes body
    const bodyEl = h('div', { class: 'nx-presenter-body' }, [
      h('div', { class: 'nx-presenter-slides-col' }, [
        h('div', { class: 'nx-presenter-card' }, [
          h('span', { class: 'nx-presenter-card-title' }, t('presenter.currentSlide', 'Current Slide')),
          currentPreviewEl,
        ]),
        h('div', { class: 'nx-presenter-card' }, [
          h('span', { class: 'nx-presenter-card-title' }, t('presenter.nextSlide', 'Next Slide')),
          nextPreviewEl,
        ]),
      ]),
      h('div', { class: 'nx-presenter-notes-col' }, [
        h(
          'span',
          { class: 'nx-presenter-card-title', style: 'margin-bottom: 8px;' },
          t('presenter.notes', 'Speaker Notes'),
        ),
        notesBodyEl,
      ]),
    ]);

    presenterRoot.append(timerHeader, bodyEl);

    presenterModalInstance = openModal({
      title: `${t('presenter.title', 'Presenter View')} — ${doc.title}`,
      content: presenterRoot,
      buttons: [
        {
          label: 'Close',
          primary: false,
          onClick: () => {
            isPresenterOpen = false;
            stopTimer();
            presenterModalInstance.close();
          },
        },
      ],
    });

    renderPresenterContent();
  }

  // ─── Toolbar ─────────────────────────────────────────────────────────────
  const toolbar = h('div', { class: 'nx-present-toolbar' });

  // File buttons
  const newBtn = h('button', { class: 'nx-present-btn' }, [icon('plus'), h('span', {}, t('toolbar.new', 'New'))]);
  newBtn.addEventListener('click', async () => {
    if (isDirty) {
      const ok = await ctx.dialog.confirm(
        t('dialog.confirmNew', 'Create new presentation? Any unsaved edits will be lost.'),
      );
      if (!ok) return;
    }
    doc = createPresentDoc(t('app.untitled', 'Untitled Presentation'));
    currentPath = null;
    textarea.value = doc.source;
    themeSelect.value = doc.theme;
    ratioSelect.value = doc.aspectRatio;
    updateStatus(false);
    await refreshRenderedSlides();
  });

  const openBtn = h('button', { class: 'nx-present-btn' }, [icon('folder'), h('span', {}, t('toolbar.open', 'Open'))]);
  openBtn.addEventListener('click', async () => {
    const res = await ctx.dialog.showOpenDialog({
      filters: [{ name: 'Presentation / Markdown (*.npresent, *.md)', extensions: ['npresent', 'md', 'markdown'] }],
    });
    if (res && res.filePath) {
      loadFile(res.filePath);
    }
  });

  const saveBtn = h('button', { class: 'nx-present-btn' }, [icon('save'), h('span', {}, t('toolbar.save', 'Save'))]);
  saveBtn.addEventListener('click', saveFile);

  const exportHtmlBtn = h('button', { class: 'nx-present-btn' }, [
    icon('download'),
    h('span', {}, t('toolbar.export', 'Export HTML')),
  ]);
  exportHtmlBtn.addEventListener('click', exportStandaloneHtml);

  const printBtn = h('button', { class: 'nx-present-btn' }, [
    icon('printer'),
    h('span', {}, t('toolbar.print', 'Print / PDF')),
  ]);
  printBtn.addEventListener('click', () => window.print());

  // Present & Presenter mode buttons
  const presentBtn = h('button', { class: 'nx-present-btn primary' }, [
    icon('play'),
    h('span', {}, t('toolbar.present', 'Present')),
  ]);
  presentBtn.addEventListener('click', launchFullscreenSlideShow);

  const presenterModeBtn = h('button', { class: 'nx-present-btn' }, [
    icon('tv'),
    h('span', {}, t('toolbar.presenterMode', 'Presenter Mode')),
  ]);
  presenterModeBtn.addEventListener('click', openPresenterMode);

  // Theme selector
  const themeContainer = h('div', { class: 'nx-present-group' }, [
    h('span', { style: 'font-size: 11px;' }, t('toolbar.theme', 'Theme')),
  ]);
  const themeSelect = /** @type {HTMLSelectElement} */ (
    h('select', { class: 'nx-present-select' }, [
      ...Object.values(PRESENT_THEMES).map((th) => h('option', { value: th.id }, th.name)),
    ])
  );
  themeSelect.value = doc.theme;
  themeSelect.addEventListener('change', () => {
    doc.theme = themeSelect.value;
    updateStatus(true);
    renderCurrentSlide();
  });
  themeContainer.appendChild(themeSelect);

  // Aspect ratio selector
  const ratioContainer = h('div', { class: 'nx-present-group' }, [
    h('span', { style: 'font-size: 11px;' }, t('toolbar.ratio', 'Ratio')),
  ]);
  const ratioSelect = /** @type {HTMLSelectElement} */ (
    h('select', { class: 'nx-present-select' }, [
      h('option', { value: '16:9' }, '16:9'),
      h('option', { value: '4:3' }, '4:3'),
    ])
  );
  ratioSelect.value = doc.aspectRatio;
  ratioSelect.addEventListener('change', () => {
    doc.aspectRatio = ratioSelect.value;
    updateStatus(true);
    renderCurrentSlide();
  });
  ratioContainer.appendChild(ratioSelect);

  // Template selector
  const templateContainer = h('div', { class: 'nx-present-group' }, [
    h('span', { style: 'font-size: 11px;' }, t('toolbar.template', 'Template')),
  ]);
  const templateSelect = /** @type {HTMLSelectElement} */ (
    h('select', { class: 'nx-present-select' }, [
      h('option', { value: '' }, 'Load template...'),
      ...Object.values(PRESENT_TEMPLATES).map((tpl) => h('option', { value: tpl.id }, tpl.title)),
    ])
  );
  templateSelect.addEventListener('change', async () => {
    const chosen = templateSelect.value;
    if (!chosen || !(chosen in PRESENT_TEMPLATES)) return;
    templateSelect.value = '';
    const ok = await ctx.dialog.confirm('Load template? Current markdown will be replaced.');
    if (!ok) return;
    doc.source = PRESENT_TEMPLATES[chosen].markdown;
    textarea.value = doc.source;
    updateStatus(true);
    await refreshRenderedSlides();
  });
  templateContainer.appendChild(templateSelect);

  toolbar.append(
    h('div', { class: 'nx-present-group' }, [newBtn, openBtn, saveBtn, exportHtmlBtn, printBtn, statusLabel]),
    h('div', { class: 'nx-present-group' }, [presentBtn, presenterModeBtn]),
    h('div', { class: 'nx-present-group' }, [themeContainer, ratioContainer, templateContainer]),
  );

  // ─── File Persistence & Standalone HTML ──────────────────────────────────
  async function saveFile() {
    if (!currentPath) {
      const res = await ctx.dialog.showSaveDialog({
        defaultPath: `/home/user/${doc.title || 'presentation'}.npresent`,
        filters: [{ name: 'Presentation (*.npresent)', extensions: ['npresent'] }],
      });
      if (!res || !res.filePath) return;
      currentPath = res.filePath;
    }
    const jsonStr = serializePresentDoc(doc);
    await fs.writeFile(currentPath, jsonStr);
    updateStatus(false);
    ctx.notify.success(t('export.saved', 'Presentation saved successfully'));
  }

  async function loadFile(filePath) {
    try {
      const content = await fs.readFile(filePath, { encoding: 'utf8' });
      doc = parsePresentDoc(content);
      currentPath = filePath;
      textarea.value = doc.source;
      themeSelect.value = doc.theme;
      ratioSelect.value = doc.aspectRatio;
      currentSlideIndex = 0;
      updateStatus(false);
      await refreshRenderedSlides();
    } catch {
      ctx.dialog.alert('Failed to open presentation file');
    }
  }

  async function exportStandaloneHtml() {
    try {
      const htmlContent = generateStandaloneHtml(doc, renderedSlidesHtml);
      const res = await ctx.dialog.showSaveDialog({
        defaultPath: `/home/user/${doc.title || 'presentation'}.html`,
        filters: [{ name: 'HTML Document (*.html)', extensions: ['html'] }],
      });
      if (res && res.filePath) {
        await fs.writeFile(res.filePath, htmlContent);
        ctx.notify.success(t('export.htmlSaved', 'Standalone HTML presentation exported'));
      }
    } catch (err) {
      ctx.dialog.alert(`HTML Export failed: ${err.message}`);
    }
  }

  function handleKeyDown(e) {
    // If typing in any input or textarea, don't capture navigation keys
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveFile();
      }
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveFile();
      return;
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Backspace') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'Home') {
      e.preventDefault();
      goToSlide(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goToSlide(parsedSlides.length - 1);
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      launchFullscreenSlideShow();
    } else if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      openPresenterMode();
    }
  }

  window.addEventListener('keydown', handleKeyDown);

  // ─── Assembly & Initial Refresh ──────────────────────────────────────────
  const root = h('div', { class: 'nx-present' }, [
    toolbar,
    h('div', { class: 'nx-present-workspace' }, [editorPanel, previewPanel]),
  ]);
  container.appendChild(root);

  await refreshRenderedSlides();

  if (currentPath) {
    loadFile(currentPath);
  }

  // Teardown
  return () => {
    stopTimer();
    window.removeEventListener('keydown', handleKeyDown);
  };
}
