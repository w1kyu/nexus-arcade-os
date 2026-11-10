// @ts-check
import { h, icon } from '../../ui/dom.js';
import { openMenu } from '../../ui/menu.js';
import { openModal } from '../../ui/overlay.js';
import {
  computeStats,
  createDocument,
  extractOutline,
  generateTocHtml,
  htmlToMarkdown,
  htmlToPlainText,
  markdownToHtml,
  parseDocument,
  serializeDocument,
  TEMPLATES,
} from './model.js';
import './styles.css';

/**
 * Commands exported by nexus.write.
 * @type {import('../../kernel/types').AppModule['commands']}
 */
export const commands = {
  'write.new': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.write', args: { newFile: true } }),
};

/**
 * Main application entry point for Nexus Write.
 * @type {import('../../kernel/types').AppModule['mount']}
 */
export async function mount(container, ctx, args) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>=} */ vars) => ctx.i18n.t(key, vars);
  const fs = /** @type {any} */ (ctx.fs);

  let currentPath = /** @type {string | null} */ (args.path ?? null);
  let isDirty = false;
  let isSpellcheck = true;
  let isOutlineOpen = true;
  let isFindOpen = false;
  let currentZoom = 1;
  let currentFindIndex = -1;
  /** @type {{ node: Node, offset: number, length: number }[]} */
  let currentMatches = [];

  // Undo / Redo history
  /** @type {string[]} */
  const undoStack = [];
  /** @type {string[]} */
  const redoStack = [];
  const MAX_HISTORY = 100;

  // Initialize document
  let doc = createDocument(t('app.untitled', 'Untitled Document'));

  // Load existing file or restored state
  if (currentPath && fs) {
    try {
      const data = await fs.readFile(currentPath);
      if (currentPath.endsWith('.ndoc')) {
        doc = parseDocument(data);
      } else if (currentPath.endsWith('.md')) {
        doc = createDocument(
          currentPath.split('/').pop()?.replace('.md', '') || 'Markdown Document',
          markdownToHtml(data),
        );
      } else if (currentPath.endsWith('.html') || currentPath.endsWith('.htm')) {
        doc = createDocument(
          currentPath
            .split('/')
            .pop()
            ?.replace(/\.html?$/, '') || 'HTML Document',
          data,
        );
      } else {
        doc = createDocument(currentPath.split('/').pop() || 'Text Document', `<p>${data.replace(/\n/g, '<br>')}</p>`);
      }
    } catch (e) {
      console.warn('Failed to load file:', e);
    }
  } else if (args.restoredState) {
    try {
      doc = parseDocument(args.restoredState.doc);
      currentPath = args.restoredState.path ?? null;
    } catch {
      doc = createDocument();
    }
  }

  // Root container
  const root = h('div', { class: 'nx-write' });
  container.appendChild(root);

  // ─── Header ─────────────────────────────────────────────────────────────
  const titleInput = h('input', {
    class: 'nx-write-title-input',
    type: 'text',
    value: doc.title,
    title: t('app.title', 'Nexus Write'),
  });

  const statusLabel = h('span', { class: 'nx-write-status' }, '');

  function updateStatus(dirty) {
    isDirty = dirty;
    statusLabel.textContent = dirty ? '●' : '';
    statusLabel.title = dirty ? 'Unsaved changes' : 'All changes saved';
  }

  titleInput.oninput = () => {
    doc.title = titleInput.value.trim() || t('app.untitled', 'Untitled Document');
    updateStatus(true);
  };

  const fileMenuBtn = h('button', { class: 'nx-write-btn', title: t('file.menu', 'File') }, icon('menu'), ' File');
  fileMenuBtn.onclick = () => showFileMenu(fileMenuBtn);

  const templatesBtn = h(
    'button',
    { class: 'nx-write-btn', title: t('file.templates', 'Document Templates') },
    icon('cards'),
    ' Templates',
  );
  templatesBtn.onclick = () => showTemplatesDialog();

  const printBtn = h(
    'button',
    { class: 'nx-write-btn', title: t('file.print', 'Print / PDF') },
    icon('download'),
    ' Print',
  );
  printBtn.onclick = () => window.print();

  const header = h(
    'div',
    { class: 'nx-write-header' },
    h(
      'div',
      { class: 'nx-write-title-area' },
      h('div', { class: 'nx-write-icon' }, icon('file-text')),
      titleInput,
      statusLabel,
    ),
    h('div', { class: 'nx-write-actions' }, fileMenuBtn, templatesBtn, printBtn),
  );

  // ─── Toolbar Elements ──────────────────────────────────────────────────
  const styleSelect = h(
    'select',
    { class: 'nx-write-select', title: t('toolbar.heading', 'Heading') },
    h('option', { value: 'p' }, t('toolbar.paragraph', 'Normal Text')),
    h('option', { value: 'h1' }, t('toolbar.h1', 'Heading 1')),
    h('option', { value: 'h2' }, t('toolbar.h2', 'Heading 2')),
    h('option', { value: 'h3' }, t('toolbar.h3', 'Heading 3')),
  );

  styleSelect.onchange = () => {
    const val = styleSelect.value;
    saveHistoryState();
    if (val === 'p') {
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, `<${val}>`);
    }
    pageEl.focus();
    onContentChange();
  };

  const textColorInput = h('input', {
    type: 'color',
    style: 'opacity: 0; width: 0; height: 0; position: absolute;',
  });
  textColorInput.oninput = () => {
    saveHistoryState();
    document.execCommand('foreColor', false, textColorInput.value);
    pageEl.focus();
    onContentChange();
  };

  const highlightColorInput = h('input', {
    type: 'color',
    value: '#fef08a',
    style: 'opacity: 0; width: 0; height: 0; position: absolute;',
  });
  highlightColorInput.oninput = () => {
    saveHistoryState();
    document.execCommand('hiliteColor', false, highlightColorInput.value);
    pageEl.focus();
    onContentChange();
  };

  // Zoom control
  const zoomSelect = h(
    'select',
    { class: 'nx-write-select', title: t('toolbar.zoom', 'Zoom') },
    h('option', { value: '0.75' }, '75%'),
    h('option', { value: '1', selected: true }, '100%'),
    h('option', { value: '1.25' }, '125%'),
    h('option', { value: '1.5' }, '150%'),
  );
  zoomSelect.onchange = () => {
    currentZoom = parseFloat(zoomSelect.value);
    pageEl.style.transform = `scale(${currentZoom})`;
  };

  // Page setup controls
  const pageSizeSelect = h(
    'select',
    { class: 'nx-write-select', title: t('page.size', 'Page Size') },
    h('option', { value: 'A4' }, 'A4'),
    h('option', { value: 'Letter' }, 'Letter'),
  );
  pageSizeSelect.value = doc.settings.pageSize;
  pageSizeSelect.onchange = () => {
    doc.settings.pageSize = pageSizeSelect.value === 'Letter' ? 'Letter' : 'A4';
    applyPageSettings();
    updateStatus(true);
  };

  const orientationSelect = h(
    'select',
    { class: 'nx-write-select', title: t('page.orientation', 'Orientation') },
    h('option', { value: 'portrait' }, t('page.portrait', 'Portrait')),
    h('option', { value: 'landscape' }, t('page.landscape', 'Landscape')),
  );
  orientationSelect.value = doc.settings.orientation;
  orientationSelect.onchange = () => {
    doc.settings.orientation = orientationSelect.value === 'landscape' ? 'landscape' : 'portrait';
    applyPageSettings();
    updateStatus(true);
  };

  const marginsSelect = h(
    'select',
    { class: 'nx-write-select', title: t('page.margins', 'Margins') },
    h('option', { value: 'normal' }, t('page.normal', 'Normal (25 mm)')),
    h('option', { value: 'narrow' }, t('page.narrow', 'Narrow (12.7 mm)')),
    h('option', { value: 'wide' }, t('page.wide', 'Wide (38 mm)')),
  );
  marginsSelect.value = doc.settings.margins;
  marginsSelect.onchange = () => {
    const val = marginsSelect.value;
    doc.settings.margins = val === 'narrow' || val === 'wide' ? val : 'normal';
    applyPageSettings();
    updateStatus(true);
  };

  // Font family selector
  const fontSelect = h(
    'select',
    { class: 'nx-write-select', title: 'Font' },
    h('option', { value: 'sans' }, 'Sans-Serif'),
    h('option', { value: 'serif' }, 'Serif'),
    h('option', { value: 'mono' }, 'Monospace'),
  );
  fontSelect.value = doc.settings.fontFamily || 'sans';
  fontSelect.onchange = () => {
    doc.settings.fontFamily = fontSelect.value;
    applyPageSettings();
    updateStatus(true);
  };

  const outlineBtn = h(
    'button',
    { class: `nx-write-btn ${isOutlineOpen ? 'active' : ''}`, title: t('toolbar.outline', 'Document Outline') },
    icon('sidebar'),
  );
  outlineBtn.onclick = () => {
    isOutlineOpen = !isOutlineOpen;
    outlineBtn.classList.toggle('active', isOutlineOpen);
    sidebar.classList.toggle('collapsed', !isOutlineOpen);
  };

  const findBtn = h(
    'button',
    { class: 'nx-write-btn', title: t('toolbar.findReplace', 'Find & Replace') },
    icon('search'),
  );
  findBtn.onclick = () => {
    isFindOpen = !isFindOpen;
    findBtn.classList.toggle('active', isFindOpen);
    findBar.style.display = isFindOpen ? 'flex' : 'none';
    if (isFindOpen) {
      findInput.focus();
    }
  };

  const spellcheckBtn = h(
    'button',
    { class: `nx-write-btn ${isSpellcheck ? 'active' : ''}`, title: t('toolbar.spellcheck', 'Toggle Spell Check') },
    icon('check'),
  );
  spellcheckBtn.onclick = () => {
    isSpellcheck = !isSpellcheck;
    spellcheckBtn.classList.toggle('active', isSpellcheck);
    pageEl.setAttribute('spellcheck', String(isSpellcheck));
  };

  const toolbar = h(
    'div',
    { class: 'nx-write-toolbar' },
    textColorInput,
    highlightColorInput,
    h(
      'div',
      { class: 'nx-write-toolbar-group' },
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.undo', 'Undo'),
          onclick: () => undoAction(),
        },
        icon('undo'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.redo', 'Redo'),
          onclick: () => redoAction(),
        },
        icon('redo'),
      ),
    ),
    h('div', { class: 'nx-write-separator' }),
    h('div', { class: 'nx-write-toolbar-group' }, styleSelect, fontSelect),
    h('div', { class: 'nx-write-separator' }),
    h(
      'div',
      { class: 'nx-write-toolbar-group' },
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.bold', 'Bold'),
          onclick: () => exec('bold'),
        },
        h('strong', {}, 'B'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.italic', 'Italic'),
          onclick: () => exec('italic'),
        },
        h('em', {}, 'I'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.underline', 'Underline'),
          onclick: () => exec('underline'),
        },
        h('u', {}, 'U'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.strike', 'Strikethrough'),
          onclick: () => exec('strikeThrough'),
        },
        h('s', {}, 'S'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.textColor', 'Text Color'),
          onclick: () => textColorInput.click(),
        },
        h('span', { style: 'font-weight: bold; border-bottom: 3px solid var(--accent);' }, 'A'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.highlight', 'Highlight Color'),
          onclick: () => highlightColorInput.click(),
        },
        h('span', { style: 'background: #fef08a; color: #000; padding: 0 3px; border-radius: 2px;' }, 'H'),
      ),
    ),
    h('div', { class: 'nx-write-separator' }),
    h(
      'div',
      { class: 'nx-write-toolbar-group' },
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.alignLeft', 'Align Left'),
          onclick: () => exec('justifyLeft'),
        },
        icon('view-list'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.alignCenter', 'Align Center'),
          onclick: () => exec('justifyCenter'),
        },
        icon('menu'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.alignRight', 'Align Right'),
          onclick: () => exec('justifyRight'),
        },
        icon('view-details'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.alignJustify', 'Justify'),
          onclick: () => exec('justifyFull'),
        },
        icon('layout-split'),
      ),
    ),
    h('div', { class: 'nx-write-separator' }),
    h(
      'div',
      { class: 'nx-write-toolbar-group' },
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.bulletList', 'Bullet List'),
          onclick: () => exec('insertUnorderedList'),
        },
        icon('view-list'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.numberList', 'Numbered List'),
          onclick: () => exec('insertOrderedList'),
        },
        icon('view-columns'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.checklist', 'Checklist'),
          onclick: () => insertChecklist(),
        },
        icon('checklist'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.blockquote', 'Quote'),
          onclick: () => exec('formatBlock', '<blockquote>'),
        },
        icon('quote'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.code', 'Code Block'),
          onclick: () => insertCodeBlock(),
        },
        icon('code'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.table', 'Insert Table'),
          onclick: () => promptInsertTable(),
        },
        icon('table'),
      ),
    ),
    h('div', { class: 'nx-write-separator' }),
    h(
      'div',
      { class: 'nx-write-toolbar-group' },
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.link', 'Link'),
          onclick: () => promptInsertLink(),
        },
        icon('link'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.image', 'Insert Image'),
          onclick: () => promptInsertImage(),
        },
        icon('image'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.hr', 'Horizontal Rule'),
          onclick: () => exec('insertHorizontalRule'),
        },
        icon('minus'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.toc', 'Table of Contents'),
          onclick: () => insertTableOfContents(),
        },
        icon('book'),
      ),
      h(
        'button',
        {
          class: 'nx-write-btn',
          title: t('toolbar.clearFormat', 'Clear Formatting'),
          onclick: () => exec('removeFormat'),
        },
        icon('trash'),
      ),
    ),
    h('div', { class: 'nx-write-separator' }),
    h(
      'div',
      { class: 'nx-write-toolbar-group' },
      pageSizeSelect,
      orientationSelect,
      marginsSelect,
      zoomSelect,
      spellcheckBtn,
      findBtn,
      outlineBtn,
    ),
  );

  // ─── Find & Replace Bar ─────────────────────────────────────────────────
  const findInput = h('input', {
    class: 'nx-write-find-input',
    type: 'text',
    placeholder: t('find.find', 'Find'),
  });

  const replaceInput = h('input', {
    class: 'nx-write-find-input',
    type: 'text',
    placeholder: t('find.replace', 'Replace'),
  });

  const matchLabel = h('span', { style: 'font-size: 11px; color: var(--text-3); min-width: 60px;' }, '');

  const findNextBtn = h('button', { class: 'nx-write-btn', title: t('find.next', 'Next') }, icon('chevron-down'));
  findNextBtn.onclick = () => navigateFind(1);

  const findPrevBtn = h('button', { class: 'nx-write-btn', title: t('find.prev', 'Previous') }, icon('chevron-up'));
  findPrevBtn.onclick = () => navigateFind(-1);

  const replaceBtn = h('button', { class: 'nx-write-btn', title: t('find.replaceOne', 'Replace') }, 'Replace');
  replaceBtn.onclick = () => replaceCurrentMatch();

  const replaceAllBtn = h('button', { class: 'nx-write-btn', title: t('find.replaceAll', 'Replace All') }, 'All');
  replaceAllBtn.onclick = () => replaceAllMatches();

  const closeFindBtn = h('button', { class: 'nx-write-btn', title: 'Close' }, icon('close'));
  closeFindBtn.onclick = () => {
    isFindOpen = false;
    findBtn.classList.remove('active');
    findBar.style.display = 'none';
    clearFindHighlights();
  };

  findInput.oninput = () => updateFindMatches();
  findInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      navigateFind(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      closeFindBtn.click();
    }
  };

  const findBar = h(
    'div',
    { class: 'nx-write-find-bar', style: 'display: none;' },
    findInput,
    replaceInput,
    findPrevBtn,
    findNextBtn,
    matchLabel,
    replaceBtn,
    replaceAllBtn,
    closeFindBtn,
  );

  // ─── Sidebar / Outline ──────────────────────────────────────────────────
  const outlineList = h('ul', { class: 'nx-write-outline-list' });
  const sidebar = h(
    'div',
    { class: 'nx-write-sidebar' },
    h(
      'div',
      { class: 'nx-write-sidebar-header' },
      h('span', {}, t('outline.title', 'Outline')),
      h(
        'button',
        {
          class: 'nx-write-btn',
          style: 'min-width: 20px; height: 20px; padding: 0;',
          onclick: () => outlineBtn.click(),
        },
        icon('close'),
      ),
    ),
    outlineList,
  );

  // ─── Page Viewport & Sheet ──────────────────────────────────────────────
  const pageEl = h('div', {
    class: 'nx-write-page size-a4 portrait margins-normal font-sans',
    contenteditable: 'true',
    spellcheck: 'true',
  });
  pageEl.innerHTML = doc.content;

  const viewport = h('div', { class: 'nx-write-viewport' }, pageEl);

  function applyPageSettings() {
    pageEl.className = `nx-write-page size-${doc.settings.pageSize.toLowerCase()} ${doc.settings.orientation} margins-${doc.settings.margins} font-${doc.settings.fontFamily || 'sans'}`;
  }
  applyPageSettings();

  // ─── Footer / Status Bar ────────────────────────────────────────────────
  const wordsStat = h('span', { class: 'nx-write-stat-item' });
  const charsStat = h('span', { class: 'nx-write-stat-item' });
  const readingStat = h('span', { class: 'nx-write-stat-item' });

  function updateFooterStats() {
    const stats = computeStats(pageEl);
    wordsStat.textContent = `${stats.words} ${t('stats.words', 'Words')}`;
    charsStat.textContent = `${stats.characters} ${t('stats.characters', 'Characters')}`;
    readingStat.textContent = `${stats.readingTimeMinutes} min read`;
  }

  const footer = h(
    'div',
    { class: 'nx-write-footer' },
    h('div', { class: 'nx-write-stats-bar' }, wordsStat, charsStat, readingStat),
    h('div', { style: 'cursor: pointer;', onclick: () => showStatsModal() }, icon('info'), ' Details'),
  );

  // Assemble Main Workspace
  const workspace = h('div', { class: 'nx-write-workspace' }, sidebar, viewport);
  root.appendChild(header);
  root.appendChild(toolbar);
  root.appendChild(findBar);
  root.appendChild(workspace);
  root.appendChild(footer);

  // ─── History & Content Management ───────────────────────────────────────
  function saveHistoryState() {
    undoStack.push(pageEl.innerHTML);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0; // Clear redo on new action
  }

  function undoAction() {
    if (undoStack.length === 0) return;
    redoStack.push(pageEl.innerHTML);
    const prev = undoStack.pop();
    if (prev !== undefined) {
      pageEl.innerHTML = prev;
      onContentChange(false);
    }
  }

  function redoAction() {
    if (redoStack.length === 0) return;
    undoStack.push(pageEl.innerHTML);
    const next = redoStack.pop();
    if (next !== undefined) {
      pageEl.innerHTML = next;
      onContentChange(false);
    }
  }

  let outlineDebounce = 0;
  function onContentChange(recordHistory = true) {
    if (recordHistory) {
      updateStatus(true);
    }
    doc.content = pageEl.innerHTML;
    updateFooterStats();

    clearTimeout(outlineDebounce);
    outlineDebounce = window.setTimeout(updateOutline, 300);
  }

  pageEl.addEventListener('input', () => {
    onContentChange();
  });

  pageEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redoAction();
      else undoAction();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      redoAction();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveFile();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      findBtn.click();
    }
  });

  // Handle interactive checkboxes
  pageEl.addEventListener('change', (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    if (target && target.type === 'checkbox') {
      if (target.checked) target.setAttribute('checked', 'checked');
      else target.removeAttribute('checked');
      onContentChange();
    }
  });

  // Helper command runner
  function exec(command, value = null) {
    saveHistoryState();
    document.execCommand(command, false, value);
    pageEl.focus();
    onContentChange();
  }

  // ─── Outline Implementation ─────────────────────────────────────────────
  function updateOutline() {
    outlineList.innerHTML = '';
    const outline = extractOutline(pageEl);

    if (outline.length === 0) {
      outlineList.appendChild(
        h(
          'div',
          { class: 'nx-write-outline-empty' },
          t('outline.empty', 'No headings yet. Use Heading 1–3 to build an outline.'),
        ),
      );
      return;
    }

    outline.forEach((item) => {
      const li = h(
        'li',
        {
          class: `nx-write-outline-item level-${item.level}`,
          title: item.text,
          onclick: () => {
            const el = pageEl.querySelector(`#${item.id}`) || findHeadingByText(item.text);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          },
        },
        item.text || 'Untitled Heading',
      );
      outlineList.appendChild(li);
    });
  }

  function findHeadingByText(text) {
    const headings = pageEl.querySelectorAll('h1, h2, h3');
    for (const hEl of headings) {
      if ((hEl.textContent || '').trim() === text) return hEl;
    }
    return null;
  }

  // ─── Formatting Enhancements ────────────────────────────────────────────
  function insertChecklist() {
    saveHistoryState();
    const checklistHtml = `<ul class="checklist"><li><input type="checkbox"> New checklist item</li></ul><p><br></p>`;
    document.execCommand('insertHTML', false, checklistHtml);
    pageEl.focus();
    onContentChange();
  }

  function insertCodeBlock() {
    saveHistoryState();
    const codeHtml = `<pre><code>// Write your code here\n</code></pre><p><br></p>`;
    document.execCommand('insertHTML', false, codeHtml);
    pageEl.focus();
    onContentChange();
  }

  async function promptInsertTable() {
    const rowsInput = h('input', { type: 'number', value: '3', min: '1', max: '20', class: 'nx-input' });
    const colsInput = h('input', { type: 'number', value: '3', min: '1', max: '10', class: 'nx-input' });

    const ok = await openModal({
      title: t('table.insert', 'Insert Table'),
      body: h(
        'div',
        { style: 'display: flex; flex-direction: column; gap: 12px;' },
        h('label', {}, t('table.rows', 'Rows'), rowsInput),
        h('label', {}, t('table.cols', 'Columns'), colsInput),
      ),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: 'Insert', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (!ok) return;
    const rows = parseInt(rowsInput.value, 10) || 3;
    const cols = parseInt(colsInput.value, 10) || 3;

    let tableHtml = '<table><thead><tr>';
    for (let c = 0; c < cols; c++) tableHtml += `<th>Header ${c + 1}</th>`;
    tableHtml += '</tr></thead><tbody>';
    for (let r = 0; r < rows - 1; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) tableHtml += `<td>Cell</td>`;
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br></p>';

    saveHistoryState();
    document.execCommand('insertHTML', false, tableHtml);
    pageEl.focus();
    onContentChange();
  }

  async function promptInsertLink() {
    const urlInput = h('input', { type: 'text', placeholder: 'https://example.com', class: 'nx-input' });
    const ok = await openModal({
      title: t('dialog.insertLink', 'Insert Link'),
      body: h('div', {}, h('label', {}, t('dialog.linkUrl', 'Link URL'), urlInput)),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: 'Insert', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok && urlInput.value.trim()) {
      saveHistoryState();
      document.execCommand('createLink', false, urlInput.value.trim());
      pageEl.focus();
      onContentChange();
    }
  }

  async function promptInsertImage() {
    const urlInput = h('input', {
      type: 'text',
      placeholder: 'https://example.com/image.png or data:image/...',
      class: 'nx-input',
    });
    const ok = await openModal({
      title: t('dialog.insertImage', 'Insert Image'),
      body: h('div', {}, h('label', {}, t('dialog.imageUrl', 'Image URL or Data URI'), urlInput)),
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: 'Insert', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok && urlInput.value.trim()) {
      saveHistoryState();
      document.execCommand('insertImage', false, urlInput.value.trim());
      pageEl.focus();
      onContentChange();
    }
  }

  function insertTableOfContents() {
    const outline = extractOutline(pageEl);
    const tocHtml = generateTocHtml(outline, t('toolbar.toc', 'Table of Contents'));
    saveHistoryState();
    document.execCommand('insertHTML', false, tocHtml);
    pageEl.focus();
    onContentChange();
  }

  // ─── Find & Replace Logic ───────────────────────────────────────────────
  function updateFindMatches() {
    const query = findInput.value.trim();
    currentMatches = [];
    currentFindIndex = -1;

    if (!query) {
      matchLabel.textContent = '';
      return;
    }

    const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent || '';
      let idx = text.toLowerCase().indexOf(query.toLowerCase());
      while (idx !== -1) {
        currentMatches.push({ node, offset: idx, length: query.length });
        idx = text.toLowerCase().indexOf(query.toLowerCase(), idx + 1);
      }
    }

    if (currentMatches.length > 0) {
      currentFindIndex = 0;
      highlightMatch(currentMatches[0]);
      matchLabel.textContent = `1 of ${currentMatches.length}`;
    } else {
      matchLabel.textContent = t('find.noMatch', 'No matches');
    }
  }

  function navigateFind(dir) {
    if (currentMatches.length === 0) return;
    currentFindIndex = (currentFindIndex + dir + currentMatches.length) % currentMatches.length;
    highlightMatch(currentMatches[currentFindIndex]);
    matchLabel.textContent = `${currentFindIndex + 1} of ${currentMatches.length}`;
  }

  function highlightMatch(match) {
    const sel = window.getSelection();
    if (!sel) return;
    try {
      const range = document.createRange();
      range.setStart(match.node, match.offset);
      range.setEnd(match.node, match.offset + match.length);
      sel.removeAllRanges();
      sel.addRange(range);
      const parent = match.node.parentElement;
      parent?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      // range could be invalid if content changed
    }
  }

  function replaceCurrentMatch() {
    if (currentMatches.length === 0 || currentFindIndex < 0) return;
    const match = currentMatches[currentFindIndex];
    const rep = replaceInput.value;
    saveHistoryState();

    const text = match.node.textContent || '';
    const before = text.substring(0, match.offset);
    const after = text.substring(match.offset + match.length);
    match.node.textContent = before + rep + after;

    onContentChange();
    updateFindMatches();
  }

  function replaceAllMatches() {
    const query = findInput.value.trim();
    if (!query) return;
    const rep = replaceInput.value;
    saveHistoryState();

    let count = 0;
    const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
    let node;
    const nodes = [];
    while ((node = walker.nextNode())) nodes.push(node);

    nodes.forEach((n) => {
      const text = n.textContent || '';
      if (text.toLowerCase().includes(query.toLowerCase())) {
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        n.textContent = text.replace(regex, rep);
        count++;
      }
    });

    onContentChange();
    updateFindMatches();
    matchLabel.textContent = `${count} replaced`;
  }

  function clearFindHighlights() {
    const sel = window.getSelection();
    sel?.removeAllRanges();
  }

  // ─── File Operations ────────────────────────────────────────────────────
  async function saveFile() {
    if (!currentPath) {
      await saveAsFile();
      return;
    }

    if (fs) {
      try {
        let serialized = '';
        if (currentPath.endsWith('.md')) {
          serialized = htmlToMarkdown(pageEl);
        } else if (currentPath.endsWith('.html') || currentPath.endsWith('.htm')) {
          serialized = pageEl.innerHTML;
        } else if (currentPath.endsWith('.txt')) {
          serialized = htmlToPlainText(pageEl);
        } else {
          doc.content = pageEl.innerHTML;
          doc.metadata.modified = Date.now();
          serialized = serializeDocument(doc);
        }

        await fs.writeFile(currentPath, serialized);
        updateStatus(false);
      } catch (e) {
        console.error('Save failed:', e);
      }
    }
  }

  async function saveAsFile() {
    const defaultName = `${doc.title.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'document'}.ndoc`;
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
      await saveFile();
    }
  }

  function showFileMenu(anchor) {
    openMenu(
      [
        {
          label: t('file.new', 'New Document'),
          icon: 'file-plus',
          run: () => {
            doc = createDocument(t('app.untitled', 'Untitled Document'));
            titleInput.value = doc.title;
            pageEl.innerHTML = doc.content;
            currentPath = null;
            applyPageSettings();
            updateStatus(false);
            onContentChange(false);
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
          run: () => saveFile(),
        },
        {
          label: t('file.saveAs', 'Save As...'),
          icon: 'download',
          run: () => saveAsFile(),
        },
        'separator',
        {
          label: t('file.export', 'Export'),
          icon: 'share',
          submenu: [
            {
              label: t('file.exportNdoc', 'Export as Nexus Document (.ndoc)'),
              run: () => downloadFile(`${doc.title}.ndoc`, serializeDocument(doc), 'application/json'),
            },
            {
              label: t('file.exportMd', 'Export as Markdown (.md)'),
              run: () => downloadFile(`${doc.title}.md`, htmlToMarkdown(pageEl), 'text/markdown'),
            },
            {
              label: t('file.exportHtml', 'Export as HTML (.html)'),
              run: () => downloadFile(`${doc.title}.html`, pageEl.innerHTML, 'text/html'),
            },
            {
              label: t('file.exportTxt', 'Export as Plain Text (.txt)'),
              run: () => downloadFile(`${doc.title}.txt`, htmlToPlainText(pageEl), 'text/plain'),
            },
          ],
        },
        {
          label: t('file.import', 'Import'),
          icon: 'upload',
          submenu: [
            {
              label: t('file.importMd', 'Import Markdown'),
              run: () => promptImport('markdown'),
            },
            {
              label: t('file.importHtml', 'Import HTML'),
              run: () => promptImport('html'),
            },
          ],
        },
        'separator',
        {
          label: t('file.templates', 'Document Templates'),
          icon: 'cards',
          run: () => showTemplatesDialog(),
        },
        {
          label: t('file.print', 'Print / PDF'),
          icon: 'download',
          shortcut: 'Mod+P',
          run: () => window.print(),
        },
        'separator',
        {
          label: t('file.stats', 'Document Statistics'),
          icon: 'info',
          run: () => showStatsModal(),
        },
      ],
      { anchor },
    );
  }

  async function promptOpenFile() {
    const input = h('input', { type: 'text', placeholder: '/home/documents/doc.ndoc', class: 'nx-input' });
    const ok = await openModal({
      title: t('file.open', 'Open Document'),
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
      if (currentPath.endsWith('.ndoc')) {
        doc = parseDocument(data);
      } else if (currentPath.endsWith('.md')) {
        doc = createDocument(currentPath.split('/').pop()?.replace('.md', '') || 'Document', markdownToHtml(data));
      } else if (currentPath.endsWith('.html') || currentPath.endsWith('.htm')) {
        doc = createDocument(
          currentPath
            .split('/')
            .pop()
            ?.replace(/\.html?$/, '') || 'Document',
          data,
        );
      } else {
        doc = createDocument(currentPath.split('/').pop() || 'Document', `<p>${data.replace(/\n/g, '<br>')}</p>`);
      }
      titleInput.value = doc.title;
      pageEl.innerHTML = doc.content;
      applyPageSettings();
      updateStatus(false);
      onContentChange(false);
    }
  }

  async function promptImport(type) {
    const textarea = h('textarea', {
      rows: 10,
      style: 'width: 100%; font-family: var(--font-mono); font-size: 13px;',
      placeholder: type === 'markdown' ? '# Paste Markdown here' : '<h1>Paste HTML here</h1>',
    });

    const ok = await openModal({
      title: type === 'markdown' ? t('file.importMd', 'Import Markdown') : t('file.importHtml', 'Import HTML'),
      body: textarea,
      actions: [
        { label: 'Cancel', value: false, variant: 'ghost' },
        { label: 'Import', value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });

    if (ok && textarea.value.trim()) {
      saveHistoryState();
      const content = type === 'markdown' ? markdownToHtml(textarea.value) : textarea.value;
      pageEl.innerHTML = content;
      onContentChange();
    }
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

  async function showTemplatesDialog() {
    const templateOptions = Object.values(TEMPLATES);
    const list = h('div', { style: 'display: flex; flex-direction: column; gap: 8px;' });

    let chosen = templateOptions[0];

    const modal = openModal({
      title: t('templates.choose', 'Choose a Template'),
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
            doc = chosen.create();
            titleInput.value = doc.title;
            pageEl.innerHTML = doc.content;
            currentPath = null;
            applyPageSettings();
            updateStatus(false);
            onContentChange(false);
            return true;
          },
        },
      ],
      dismissValue: false,
    });

    templateOptions.forEach((tmpl, i) => {
      const radio = h('input', { type: 'radio', name: 'template', checked: i === 0 });
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

  function showStatsModal() {
    const stats = computeStats(pageEl);
    openModal({
      title: t('stats.title', 'Document Statistics'),
      body: h(
        'table',
        { style: 'width: 100%; border-collapse: collapse; font-size: 14px;' },
        h(
          'tbody',
          {},
          h(
            'tr',
            {},
            h('td', { style: 'padding: 6px 0; font-weight: bold;' }, t('stats.words', 'Words')),
            h('td', {}, String(stats.words)),
          ),
          h(
            'tr',
            {},
            h('td', { style: 'padding: 6px 0; font-weight: bold;' }, t('stats.characters', 'Characters')),
            h('td', {}, String(stats.characters)),
          ),
          h(
            'tr',
            {},
            h(
              'td',
              { style: 'padding: 6px 0; font-weight: bold;' },
              t('stats.charsNoSpaces', 'Characters (no spaces)'),
            ),
            h('td', {}, String(stats.charactersWithoutSpaces)),
          ),
          h(
            'tr',
            {},
            h('td', { style: 'padding: 6px 0; font-weight: bold;' }, t('stats.paragraphs', 'Paragraphs')),
            h('td', {}, String(stats.paragraphs)),
          ),
          h(
            'tr',
            {},
            h('td', { style: 'padding: 6px 0; font-weight: bold;' }, t('stats.readingTime', 'Reading time')),
            h('td', {}, `${stats.readingTimeMinutes} min`),
          ),
        ),
      ),
      actions: [{ label: 'Close', value: true, variant: 'primary' }],
      dismissValue: true,
    });
  }

  // Initial stats and outline render
  updateFooterStats();
  updateOutline();

  // Return state snapshot for session restore
  return {
    saveState: () => ({
      doc: serializeDocument(doc),
      path: currentPath,
    }),
  };
}
