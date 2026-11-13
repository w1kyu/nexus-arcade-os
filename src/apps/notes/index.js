// @ts-check
// Nexus Notes (4.1): Markdown knowledge base with CodeMirror 6 editor, live/split preview,
// KaTeX math, GFM tables/tasklists/footnotes, wiki links + backlinks, image paste/drop,
// per-note AES-GCM encryption + auto-lock, nested folders, search/filter/sort, and import/export.
import { button, h, icon, iconButton, replace } from '../../ui/dom.js';
import { renderMarkdown, renderMarkdownInto } from '../../ui/markdown.js';
import { attachContextMenu, openMenu } from '../../ui/menu.js';
import { baseName, joinPath, parentOf } from '../../ui/paths.js';
import { createNoteEditor } from './editor.js';
import {
  analyzeNote,
  computeBacklinks,
  extractWikiLinks,
  filterNotes,
  NOTE_TEMPLATES,
  parseFrontMatter,
  serializeFrontMatter,
  toggleMarkdownTask,
} from './model.js';
import './styles.css';

/** @typedef {import('./model.js').NoteEntry} NoteEntry */

const NOTES_REL_DIR = 'Documents/Notes';

/**
 * Ensures the Notes root folder exists and returns its absolute VFS path.
 * @param {import('../../kernel/types').VFS} fs
 */
async function ensureNotesRoot(fs) {
  const root = joinPath(String(fs.home), NOTES_REL_DIR);
  if (!(await fs.exists(root))) {
    await fs.mkdir(root, { recursive: true });
  }
  return root;
}

/**
 * Sanitizes a user-typed note title into a valid VFS file name (without `.md`).
 * @param {string} title
 */
function sanitizeTitle(title) {
  return (
    String(title ?? '')
      .replace(/[\\/:*?"<>|]/g, '-')
      .trim() || 'Untitled'
  );
}

/**
 * Terminal command handler: `notes [list | new <title> | search <query>]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async notes(ctx, io) {
    const root = await ensureNotesRoot(ctx.fs);
    const sub = io.args[0] ?? 'list';
    if (sub === 'new') {
      const title = sanitizeTitle(io.args.slice(1).join(' ') || 'Untitled');
      const path = await ctx.fs.uniquePath(joinPath(root, `${title}.md`));
      const now = new Date().toISOString();
      await ctx.fs.writeFile(
        path,
        serializeFrontMatter({ tags: [], favorite: false, created: now, updated: now }, `# ${title}\n\n`),
      );
      io.out(`${path}\n`);
      return 0;
    }
    const nodes = /** @type {any[]} */ (await ctx.fs.walk(root));
    const files = nodes.filter((n) => n.type === 'file' && n.name.endsWith('.md'));
    if (sub === 'search') {
      const q = io.args.slice(1).join(' ').toLowerCase();
      for (const f of files) {
        const raw = /** @type {string} */ (await ctx.fs.readFile(f.path, { as: 'text' }));
        if (f.name.toLowerCase().includes(q) || raw.toLowerCase().includes(q)) {
          io.out(`${f.path.slice(root.length + 1)}\n`);
        }
      }
      return 0;
    }
    for (const f of files) {
      io.out(`${f.path.slice(root.length + 1)}\n`);
    }
    return 0;
  },
};

/**
 * Command palette handlers when Notes is not yet open.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, args?: any) => Promise<void>>}
 */
export const commands = {
  async 'notes.new'(ctx) {
    const root = await ensureNotesRoot(ctx.fs);
    const title = ctx.i18n.t('untitled');
    const path = await ctx.fs.uniquePath(joinPath(root, `${title}.md`));
    const now = new Date().toISOString();
    await ctx.fs.writeFile(
      path,
      serializeFrontMatter({ tags: [], favorite: false, created: now, updated: now }, `# ${title}\n\n`),
    );
    await ctx.intents.open(path, { with: 'nexus.notes' });
  },
  async 'notes.daily'(ctx) {
    const root = await ensureNotesRoot(ctx.fs);
    const today = new Date().toISOString().slice(0, 10);
    const path = joinPath(root, `${today}.md`);
    if (!(await ctx.fs.exists(path))) {
      const tpl = NOTE_TEMPLATES[0];
      const now = new Date().toISOString();
      await ctx.fs.writeFile(
        path,
        serializeFrontMatter(
          { tags: [...tpl.tags], favorite: false, created: now, updated: now },
          tpl.body(today, ctx.i18n.locale),
        ),
      );
    }
    await ctx.intents.open(path, { with: 'nexus.notes' });
  },
};

/**
 * Mounts a Nexus Notes window.
 * @param {HTMLElement} container
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {import('../../kernel/types').LaunchArgs} args
 */
export async function mount(container, ctx, args = {}) {
  const fs = /** @type {any} */ (ctx.fs);
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ vars) => ctx.i18n.t(k, vars);
  const notesRoot = await ensureNotesRoot(fs);

  /** @type {Map<string, NoteEntry>} path -> NoteEntry */
  const notesMap = new Map();
  /** @type {Set<string>} relative folder paths ('', 'Uni', 'Uni/CS') */
  const foldersSet = new Set(['']);
  /** @type {Map<string, { password: string, body: string, timer: any }>} path -> unlocked session */
  const unlockedSessions = new Map();
  /** @type {Map<string, string>} VFS image path -> blob URL */
  const imageBlobUrls = new Map();
  /** @type {any[]} */
  let trashItems = [];

  const restored = /** @type {any} */ (args.restoredState ?? {});
  const state = {
    view: /** @type {'all' | 'favorites' | 'recent' | 'trash' | 'folder' | 'tag'} */ (restored.view ?? 'all'),
    selectedFolder: /** @type {string} */ (restored.selectedFolder ?? ''),
    selectedTag: /** @type {string | null} */ (restored.selectedTag ?? null),
    activePath: /** @type {string | null} */ (restored.activePath ?? null),
    query: /** @type {string} */ (restored.query ?? ''),
    dateFrom: /** @type {string} */ (restored.dateFrom ?? ''),
    dateTo: /** @type {string} */ (restored.dateTo ?? ''),
    sortBy: /** @type {'updated' | 'created' | 'title'} */ (restored.sortBy ?? 'updated'),
    mode: /** @type {'edit' | 'split' | 'preview'} */ (restored.mode ?? ctx.settings.get('defaultMode') ?? 'split'),
    showInspector: Boolean(restored.showInspector ?? true),
    showGraph: false,
    saveStatus: /** @type {'saved' | 'saving' | 'unsaved' | 'conflict'} */ ('saved'),
  };

  let saveTimer = /** @type {any} */ (null);
  let previewTimer = /** @type {any} */ (null);
  let selfWritingPaths = new Set();
  let syncScrolling = false;

  // ─── Seed a welcome note on first launch if Notes folder is empty ─────
  async function loadAllNotes() {
    const nodes = /** @type {any[]} */ (await fs.walk(notesRoot));
    if (nodes.length <= 1) {
      const welcomeTitle = ctx.i18n.locale === 'de' ? 'Willkommen bei Nexus Notizen' : 'Welcome to Nexus Notes';
      const welcomePath = joinPath(notesRoot, `${welcomeTitle}.md`);
      const now = new Date().toISOString();
      const sampleBody =
        ctx.i18n.locale === 'de'
          ? `# ${welcomeTitle}\n\nWillkommen in deiner persönlichen Wissensdatenbank!\n\n## Funktionen\n- [x] **Markdown & Live-Vorschau** (Bearbeiten, Geteilt, Vorschau)\n- [ ] **Wiki-Links** wie [[Projektideen]] mit automatischen Rückverweisen\n- [ ] **Mathematik mit KaTeX**: Inline $E = mc^2$ oder als Block:\n\n$$\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$$\n\n\`\`\`js\nconst nexus = { notes: true, offline: true };\n\`\`\`\n`
          : `# ${welcomeTitle}\n\nWelcome to your personal knowledge base!\n\n## Features\n- [x] **Markdown & Live Preview** (Edit, Split, Preview)\n- [ ] **Wiki links** like [[Project Ideas]] with automatic backlinks\n- [ ] **Math via KaTeX**: inline $E = mc^2$ or display block:\n\n$$\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$$\n\n\`\`\`js\nconst nexus = { notes: true, offline: true };\n\`\`\`\n`;
      await fs.writeFile(
        welcomePath,
        serializeFrontMatter(
          { tags: ['welcome', 'guide'], favorite: true, pinned: true, created: now, updated: now },
          sampleBody,
        ),
      );
      return loadAllNotes();
    }

    notesMap.clear();
    foldersSet.clear();
    foldersSet.add('');

    for (const node of nodes.slice(1)) {
      const rel = node.path.slice(notesRoot.length + 1);
      if (node.type === 'folder') {
        foldersSet.add(rel);
        continue;
      }
      if (node.type === 'file' && node.name.endsWith('.md')) {
        const dirRel = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
        if (dirRel) foldersSet.add(dirRel);
        await readNoteEntry(node.path, node.modified);
      } else if (node.type === 'file' && node.mime?.startsWith('image/') && !imageBlobUrls.has(node.path)) {
        try {
          const blob = /** @type {Blob} */ (await fs.readFile(node.path, { as: 'blob' }));
          imageBlobUrls.set(node.path, URL.createObjectURL(blob));
        } catch {
          // Ignore unreadable image.
        }
      }
    }

    const allTrash = /** @type {any[]} */ (await fs.listTrash());
    trashItems = allTrash.filter((item) => item.originalPath?.startsWith(`${notesRoot}/`));
  }

  /**
   * Reads or refreshes a single `.md` file from VFS into `notesMap`.
   * @param {string} path
   * @param {number} [modified]
   */
  async function readNoteEntry(path, modified) {
    const raw = /** @type {string} */ (await fs.readFile(path, { as: 'text' }));
    const stat = modified ? { modified } : await fs.stat(path);
    const { meta, body: diskBody } = parseFrontMatter(raw, stat?.modified ?? Date.now());
    const rel = path.slice(notesRoot.length + 1);
    const folder = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    const title = baseName(path).replace(/\.md$/i, '');
    const unlocked = unlockedSessions.get(path);
    const isEncrypted = Boolean(meta.encrypted);
    /** @type {NoteEntry} */
    const entry = {
      path,
      folder,
      title,
      meta,
      body: isEncrypted ? (unlocked ? unlocked.body : '') : diskBody,
      locked: isEncrypted && !unlocked,
      modified: stat?.modified ?? Date.now(),
    };
    notesMap.set(path, entry);
    return entry;
  }

  /** Resets the auto-lock timer for an unlocked encrypted note. @param {string} path */
  function touchUnlockedSession(path) {
    const session = unlockedSessions.get(path);
    if (!session) return;
    if (session.timer) clearTimeout(session.timer);
    const minutes = Math.max(1, Number(ctx.settings.get('autoLockMinutes')) || 5);
    session.timer = ctx.timers.setTimeout(() => {
      lockNoteInMemory(path);
    }, minutes * 60_000);
  }

  /** Locks an encrypted note in memory. @param {string} path */
  function lockNoteInMemory(path) {
    const session = unlockedSessions.get(path);
    if (session?.timer) session.timer();
    unlockedSessions.delete(path);
    const entry = notesMap.get(path);
    if (entry && entry.meta.encrypted) {
      entry.locked = true;
      entry.body = '';
      if (state.activePath === path) renderMain();
      renderList();
    }
  }

  // ─── DOM Structure ────────────────────────────────────────────────────
  const sidebarEl = h('aside', { class: 'nx-notes-sidebar', 'aria-label': t('folders') });
  const listPaneEl = h('section', { class: 'nx-notes-list-pane' });
  const mainEl = h('main', { class: 'nx-notes-main' });
  const inspectorEl = h('aside', { class: 'nx-notes-inspector' });
  const rootEl = h(
    'div',
    { class: `nx-notes${state.showInspector ? ' has-inspector' : ''}` },
    sidebarEl,
    listPaneEl,
    mainEl,
    inspectorEl,
  );
  inspectorEl.hidden = !state.showInspector;
  container.replaceChildren(rootEl);

  // List header controls (created once so search input never loses focus while typing)
  const searchInput = h('input', {
    class: 'nx-input',
    type: 'search',
    placeholder: t('searchPlaceholder'),
    value: state.query,
    'aria-label': t('searchPlaceholder'),
    oninput: () => {
      state.query = searchInput.value;
      renderList();
      ctx.window?.stateChanged();
    },
  });
  const sortSelect = h(
    'select',
    {
      class: 'nx-select',
      'aria-label': t('sortBy'),
      onchange: () => {
        state.sortBy = /** @type {any} */ (sortSelect.value);
        renderList();
        ctx.window?.stateChanged();
      },
    },
    h('option', { value: 'updated', text: t('sortUpdated') }),
    h('option', { value: 'created', text: t('sortCreated') }),
    h('option', { value: 'title', text: t('sortTitle') }),
  );
  sortSelect.value = state.sortBy;

  const dateFromInput = h('input', {
    class: 'nx-input',
    type: 'date',
    value: state.dateFrom,
    title: t('filterDateFrom'),
    'aria-label': t('filterDateFrom'),
    onchange: () => {
      state.dateFrom = dateFromInput.value;
      renderList();
    },
  });
  const dateToInput = h('input', {
    class: 'nx-input',
    type: 'date',
    value: state.dateTo,
    title: t('filterDateTo'),
    'aria-label': t('filterDateTo'),
    onchange: () => {
      state.dateTo = dateToInput.value;
    },
  });
  dateToInput.addEventListener('change', () => renderList());

  const listItemsEl = h('div', { class: 'nx-notes-list', role: 'listbox', 'aria-label': t('allNotes') });
  listPaneEl.replaceChildren(
    h(
      'div',
      { class: 'nx-notes-list-header' },
      h('div', { class: 'nx-notes-search-row' }, searchInput),
      h('div', { class: 'nx-notes-filter-row' }, sortSelect, dateFromInput, dateToInput),
    ),
    listItemsEl,
  );

  // Create shared CodeMirror note editor instance
  const previewPaneEl = h('div', { class: 'nx-notes-preview-pane nx-markdown' });
  const editorPaneEl = h('div', { class: 'nx-notes-editor-pane' });
  const workspaceEl = h('div', { class: `nx-notes-workspace mode-${state.mode}` }, editorPaneEl, previewPaneEl);
  const cmEditor = createNoteEditor({
    text: '',
    locale: ctx.i18n.locale,
    getNoteTitles: () => [...notesMap.values()].map((n) => n.title),
    onChange: (newText) => {
      const active = getActiveNote();
      if (!active || active.locked) return;
      active.body = newText;
      const session = unlockedSessions.get(active.path);
      if (session) {
        session.body = newText;
        touchUnlockedSession(active.path);
      }
      schedulePreview();
      scheduleAutosave(active);
      renderStatus();
    },
    onPasteImages: (files) => void handlePasteOrDropImages(files),
    onScroll: (ratio) => {
      if (syncScrolling || state.mode !== 'split') return;
      syncScrolling = true;
      const max = previewPaneEl.scrollHeight - previewPaneEl.clientHeight;
      if (max > 0) previewPaneEl.scrollTop = ratio * max;
      setTimeout(() => {
        syncScrolling = false;
      }, 40);
    },
  });
  editorPaneEl.append(cmEditor.dom);

  previewPaneEl.addEventListener('scroll', () => {
    if (syncScrolling || state.mode !== 'split') return;
    syncScrolling = true;
    const max = previewPaneEl.scrollHeight - previewPaneEl.clientHeight;
    if (max > 0) cmEditor.setScrollRatio(previewPaneEl.scrollTop / max);
    setTimeout(() => {
      syncScrolling = false;
    }, 40);
  });

  // Handle clicks inside preview (wiki links, interactive checkboxes, footnotes)
  previewPaneEl.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox' && target.dataset.taskIndex) {
      const active = getActiveNote();
      if (!active || active.locked) return;
      const idx = Number(target.dataset.taskIndex);
      const checked = /** @type {HTMLInputElement} */ (target).checked;
      const updated = toggleMarkdownTask(active.body, idx, checked);
      active.body = updated;
      cmEditor.setText(updated);
      void renderPreview();
      scheduleAutosave(active);
      return;
    }
    const link = /** @type {HTMLAnchorElement | null} */ (target.closest('a[data-wiki]'));
    if (link) {
      e.preventDefault();
      const wikiTitle = link.dataset.wiki ?? '';
      if (wikiTitle) void openOrCreateWikiTarget(wikiTitle);
    }
  });

  /** @returns {NoteEntry | null} */
  function getActiveNote() {
    return state.activePath ? (notesMap.get(state.activePath) ?? null) : null;
  }

  /** Resolves relative image URLs inside the active note's folder to blob: URLs. @param {string} src */
  function resolveNoteImage(src) {
    if (!src || /^(data|blob|https?):/i.test(src)) return src;
    const active = getActiveNote();
    const baseDir = active ? parentOf(active.path) : notesRoot;
    const full = src.startsWith('/') ? src : joinPath(baseDir, src.replace(/^\.\//, ''));
    return imageBlobUrls.get(full) ?? src;
  }

  /**
   * Pastes or drops image files into the VFS folder next to the active note and inserts `![](...)`.
   * @param {File[]} files
   */
  async function handlePasteOrDropImages(files) {
    const active = getActiveNote();
    if (!active || active.locked) return;
    const dir = parentOf(active.path);
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const base = `image-${Date.now()}.${ext}`;
      const imgPath = await fs.uniquePath(joinPath(dir, base));
      await fs.writeFile(imgPath, file, { mime: file.type || 'image/png' });
      const blobUrl = URL.createObjectURL(file);
      imageBlobUrls.set(imgPath, blobUrl);
      const fileName = baseName(imgPath);
      cmEditor.insertText(`![${fileName}](${fileName})\n`);
    }
  }

  /** Opens a wiki-linked note by title, or creates it if missing. @param {string} targetTitle */
  async function openOrCreateWikiTarget(targetTitle) {
    const clean = targetTitle.trim();
    const existing = [...notesMap.values()].find((n) => n.title.toLowerCase() === clean.toLowerCase());
    if (existing) {
      selectNote(existing.path);
      return;
    }
    const active = getActiveNote();
    const folder = active?.folder ?? (state.view === 'folder' ? state.selectedFolder : '');
    await createNewNote({ title: clean, folder, body: `# ${clean}\n\n` });
  }

  /**
   * Creates a new note in `folder` and selects it.
   * @param {{ title?: string, folder?: string, body?: string, tags?: string[] }} [init]
   */
  async function createNewNote(init = {}) {
    const folder = init.folder ?? (state.view === 'folder' ? state.selectedFolder : '');
    const targetDir = folder ? joinPath(notesRoot, folder) : notesRoot;
    if (!(await fs.exists(targetDir))) await fs.mkdir(targetDir, { recursive: true });
    const rawTitle = sanitizeTitle(init.title || t('untitled'));
    const path = await fs.uniquePath(joinPath(targetDir, `${rawTitle}.md`));
    const finalTitle = baseName(path).replace(/\.md$/i, '');
    const now = new Date().toISOString();
    const body = init.body ?? `# ${finalTitle}\n\n`;
    const meta = {
      tags: init.tags ?? (state.view === 'tag' && state.selectedTag ? [state.selectedTag] : []),
      favorite: state.view === 'favorites',
      pinned: false,
      created: now,
      updated: now,
      encrypted: null,
    };
    selfWritingPaths.add(path);
    await fs.writeFile(path, serializeFrontMatter(meta, body), { createParents: true });
    selfWritingPaths.delete(path);
    await readNoteEntry(path);
    if (state.view === 'trash') state.view = 'all';
    selectNote(path);
  }

  /** Saves `note` immediately to VFS. @param {NoteEntry} note */
  async function saveNoteNow(note) {
    if (note.locked) return;
    clearTimeout(saveTimer);
    state.saveStatus = 'saving';
    renderStatus();
    note.meta.updated = new Date().toISOString();
    const session = unlockedSessions.get(note.path);
    if (session) {
      note.meta.encrypted = await ctx.crypto.encrypt(note.body, session.password);
    }
    const serialized = serializeFrontMatter(note.meta, note.body);
    selfWritingPaths.add(note.path);
    try {
      await fs.writeFile(note.path, serialized, { createParents: true });
      await fs.setTags(note.path, note.meta.tags).catch(() => {});
      state.saveStatus = 'saved';
      ctx.events.emit('notes:saved', { path: note.path, title: note.title });
    } finally {
      setTimeout(() => selfWritingPaths.delete(note.path), 150);
    }
    renderStatus();
    renderList();
    renderInspector();
  }

  /** Schedules an autosave for `note` after `autosaveMs`. @param {NoteEntry} note */
  function scheduleAutosave(note) {
    state.saveStatus = 'unsaved';
    clearTimeout(saveTimer);
    const delay = Math.max(200, Number(ctx.settings.get('autosaveMs')) || 800);
    saveTimer = ctx.timers.setTimeout(() => {
      void saveNoteNow(note);
    }, delay);
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = ctx.timers.setTimeout(() => {
      void renderPreview();
      renderInspector();
    }, 80);
  }

  async function renderPreview() {
    const active = getActiveNote();
    if (!active || active.locked || state.mode === 'edit') return;
    const titlesLower = new Set([...notesMap.values()].map((n) => n.title.toLowerCase()));
    await renderMarkdownInto(previewPaneEl, active.body, {
      math: true,
      footnotes: true,
      wikiLinks: true,
      wikiExists: (target) => titlesLower.has(target.trim().toLowerCase()),
      resolveImage: resolveNoteImage,
      interactiveTasks: true,
    });
  }

  /** Selects a note by VFS path. @param {string | null} path */
  function selectNote(path) {
    if (saveTimer && state.activePath && notesMap.has(state.activePath)) {
      void saveNoteNow(/** @type {NoteEntry} */ (notesMap.get(state.activePath)));
    }
    state.activePath = path;
    state.saveStatus = 'saved';
    const active = getActiveNote();
    if (active) {
      ctx.window?.setTitle(`${active.title} — ${t('appTitle')}`);
      if (!active.locked) touchUnlockedSession(active.path);
    } else {
      ctx.window?.setTitle(t('appTitle'));
    }
    ctx.window?.stateChanged();
    renderSidebar();
    renderList();
    renderMain();
    renderInspector();
  }

  // ─── Sidebar Rendering ─────────────────────────────────────────────────
  function renderSidebar() {
    const allNotes = [...notesMap.values()];
    const favCount = allNotes.filter((n) => n.meta.favorite).length;
    /** @type {Map<string, number>} */
    const tagCounts = new Map();
    for (const n of allNotes) {
      for (const tag of n.meta.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }

    const navItem = (
      /** @type {string} */ label,
      /** @type {string} */ iconName,
      /** @type {boolean} */ active,
      /** @type {number | undefined} */ count,
      /** @type {() => void} */ onClick,
      /** @type {string | undefined} */ dropFolder,
    ) => {
      const btn = h(
        'button',
        {
          class: `nx-notes-nav-item${active ? ' is-active' : ''}`,
          type: 'button',
          onclick: onClick,
        },
        icon(iconName, { size: 16 }),
        h('span', { text: label }),
        count !== undefined ? h('span', { class: 'nx-notes-nav-count', text: String(count) }) : null,
      );
      if (dropFolder !== undefined) {
        btn.dataset.folder = dropFolder;
        btn.addEventListener('dragover', (e) => {
          if (e.dataTransfer?.types.includes('text/x-nexus-note-path')) {
            e.preventDefault();
            btn.classList.add('is-drop-target');
          }
        });
        btn.addEventListener('dragleave', () => btn.classList.remove('is-drop-target'));
        btn.addEventListener('drop', (e) => {
          btn.classList.remove('is-drop-target');
          const notePath = e.dataTransfer?.getData('text/x-nexus-note-path');
          if (notePath) void moveNoteToFolder(notePath, dropFolder);
        });
      }
      return btn;
    };

    const sortedFolders = [...foldersSet].filter(Boolean).sort((a, b) => a.localeCompare(b));
    const sortedTags = [...tagCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    replace(
      sidebarEl,
      h(
        'div',
        { class: 'nx-notes-side-actions' },
        button({
          label: t('newNote'),
          icon: 'plus',
          variant: 'primary',
          onClick: () => void createNewNote(),
        }),
        iconButton({
          icon: 'calendar',
          label: t('dailyNote'),
          onClick: () => void openDailyNote(),
        }),
        iconButton({
          icon: 'sparkles',
          label: t('templates'),
          onClick: (e) => openTemplatesMenu(/** @type {HTMLElement} */ (e.currentTarget)),
        }),
        iconButton({
          icon: 'share',
          label: t('graphView'),
          pressed: state.showGraph,
          onClick: () => {
            state.showGraph = !state.showGraph;
            renderMain();
          },
        }),
      ),
      h(
        'div',
        { class: 'nx-notes-nav-group' },
        navItem(t('allNotes'), 'note', state.view === 'all', allNotes.length, () => {
          state.view = 'all';
          state.selectedTag = null;
          renderSidebar();
          renderList();
        }),
        navItem(t('favorites'), 'star', state.view === 'favorites', favCount, () => {
          state.view = 'favorites';
          state.selectedTag = null;
          renderSidebar();
          renderList();
        }),
        navItem(t('recent'), 'clock', state.view === 'recent', Math.min(25, allNotes.length), () => {
          state.view = 'recent';
          state.selectedTag = null;
          renderSidebar();
          renderList();
        }),
        navItem(t('trash'), 'trash', state.view === 'trash', trashItems.length, () => {
          state.view = 'trash';
          state.selectedTag = null;
          renderSidebar();
          renderList();
          renderMain();
        }),
      ),
      h(
        'div',
        { class: 'nx-notes-nav-heading' },
        h('span', { text: t('folders') }),
        iconButton({
          icon: 'folder-plus',
          label: t('newFolder'),
          onClick: () => void promptNewFolder(),
        }),
      ),
      h(
        'div',
        { class: 'nx-notes-nav-group' },
        navItem(
          t('rootFolder'),
          'folder',
          state.view === 'folder' && state.selectedFolder === '',
          allNotes.filter((n) => n.folder === '').length,
          () => {
            state.view = 'folder';
            state.selectedFolder = '';
            renderSidebar();
            renderList();
          },
          '',
        ),
        ...sortedFolders.map((folder) => {
          const depth = folder.split('/').length - 1;
          const count = allNotes.filter((n) => n.folder === folder || n.folder.startsWith(`${folder}/`)).length;
          const item = navItem(
            folder.split('/').pop() ?? folder,
            'folder',
            state.view === 'folder' && state.selectedFolder === folder,
            count,
            () => {
              state.view = 'folder';
              state.selectedFolder = folder;
              renderSidebar();
              renderList();
            },
            folder,
          );
          if (depth > 0) item.classList.add(`nx-notes-depth-${Math.min(3, depth)}`);
          return item;
        }),
      ),
      sortedTags.length
        ? h(
            'div',
            { class: 'nx-notes-nav-group' },
            h('div', { class: 'nx-notes-nav-heading' }, h('span', { text: t('tags') })),
            ...sortedTags.map(([tag, count]) =>
              navItem(`#${tag}`, 'tag', state.view === 'tag' && state.selectedTag === tag, count, () => {
                state.view = 'tag';
                state.selectedTag = tag;
                renderSidebar();
                renderList();
              }),
            ),
          )
        : null,
      h(
        'div',
        { class: 'nx-notes-side-actions nx-notes-side-bottom' },
        button({
          label: t('import'),
          icon: 'upload',
          onClick: (e) => openImportMenu(/** @type {HTMLElement} */ (e.currentTarget)),
        }),
        button({
          label: t('export'),
          icon: 'download',
          onClick: (e) => openExportMenu(/** @type {HTMLElement} */ (e.currentTarget)),
        }),
      ),
    );
  }

  // ─── Note List Rendering ───────────────────────────────────────────────
  function renderList() {
    if (state.view === 'trash') {
      if (!trashItems.length) {
        replace(listItemsEl, h('div', { class: 'nx-empty', text: t('emptyList') }));
        return;
      }
      replace(
        listItemsEl,
        button({
          label: t('emptyTrash'),
          icon: 'trash',
          variant: 'danger',
          onClick: async () => {
            for (const item of trashItems) await fs.deletePermanently(item.trashPath);
            await loadAllNotes();
            renderSidebar();
            renderList();
          },
        }),
        ...trashItems.map((item) =>
          h(
            'div',
            { class: 'nx-notes-card' },
            h(
              'div',
              { class: 'nx-notes-card-top' },
              icon('file-text', { size: 15 }),
              h('span', { class: 'nx-notes-card-title', text: item.name.replace(/\.md$/i, '') }),
            ),
            h(
              'div',
              { class: 'nx-notes-card-meta' },
              h('span', { text: item.originalPath.slice(notesRoot.length + 1) }),
            ),
            h(
              'div',
              { class: 'nx-notes-side-actions' },
              button({
                label: t('restoreNote'),
                icon: 'undo',
                onClick: async () => {
                  const restoredPath = await fs.restore(item.trashPath);
                  await loadAllNotes();
                  state.view = 'all';
                  selectNote(restoredPath);
                },
              }),
              button({
                label: t('deleteForever'),
                icon: 'x',
                variant: 'danger',
                onClick: async () => {
                  await fs.deletePermanently(item.trashPath);
                  await loadAllNotes();
                  renderSidebar();
                  renderList();
                },
              }),
            ),
          ),
        ),
      );
      return;
    }

    const filtered = filterNotes([...notesMap.values()], {
      query: state.query,
      folder: state.view === 'folder' ? state.selectedFolder : null,
      tag: state.view === 'tag' ? state.selectedTag : null,
      favoritesOnly: state.view === 'favorites',
      recentOnly: state.view === 'recent',
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      sortBy: state.sortBy,
    });

    if (!filtered.length) {
      replace(listItemsEl, h('div', { class: 'nx-empty', text: t('emptyList') }));
      return;
    }

    replace(
      listItemsEl,
      ...filtered.map(({ note, snippet, matchRanges }) => {
        const snippetEl = h('div', { class: 'nx-notes-card-snippet' });
        if (note.locked) {
          snippetEl.textContent = `🔒 ${t('lockedTitle')}`;
        } else if (matchRanges.length && snippet) {
          const [start, end] = matchRanges[0];
          snippetEl.append(snippet.slice(0, start), h('mark', { text: snippet.slice(start, end) }), snippet.slice(end));
        } else {
          snippetEl.textContent = snippet;
        }

        const card = h(
          'div',
          {
            class: `nx-notes-card${state.activePath === note.path ? ' is-active' : ''}`,
            role: 'option',
            'aria-selected': String(state.activePath === note.path),
            draggable: 'true',
            dataset: { path: note.path },
            onclick: () => selectNote(note.path),
          },
          h(
            'div',
            { class: 'nx-notes-card-top' },
            note.meta.pinned ? icon('pin', { size: 14 }) : null,
            note.meta.favorite ? icon('star', { size: 14 }) : null,
            note.meta.encrypted ? icon(note.locked ? 'lock' : 'unlock', { size: 14 }) : null,
            h('span', { class: 'nx-notes-card-title', text: note.title }),
          ),
          snippetEl,
          h(
            'div',
            { class: 'nx-notes-card-meta' },
            note.folder ? h('span', { text: `📁 ${note.folder}` }) : null,
            ...note.meta.tags.slice(0, 3).map((tag) => h('span', { class: 'nx-notes-tag-pill', text: `#${tag}` })),
          ),
        );

        card.addEventListener('dragstart', (e) => {
          e.dataTransfer?.setData('text/x-nexus-note-path', note.path);
        });

        attachContextMenu(card, () => [
          {
            label: t(note.meta.pinned ? 'unpin' : 'pin'),
            icon: note.meta.pinned ? 'pin-off' : 'pin',
            run: () => void togglePin(note),
          },
          {
            label: t(note.meta.favorite ? 'unfavorite' : 'favorite'),
            icon: 'star',
            run: () => void toggleFavorite(note),
          },
          {
            label: t('moveToFolder'),
            icon: 'folder',
            run: () => void promptMoveNote(note),
          },
          'separator',
          {
            label: t('deleteNote'),
            icon: 'trash',
            danger: true,
            run: () => void trashNote(note),
          },
        ]);

        return card;
      }),
    );
  }

  // ─── Main Pane (Editor / Preview / Lock Screen / Graph) ────────────────
  const statusEl = h('footer', { class: 'nx-notes-statusbar' });

  function renderStatus() {
    const active = getActiveNote();
    if (!active || active.locked) {
      replace(statusEl);
      return;
    }
    const stats = analyzeNote(active.body);
    const statusText =
      state.saveStatus === 'saving'
        ? t('saving')
        : state.saveStatus === 'unsaved'
          ? t('unsaved')
          : state.saveStatus === 'conflict'
            ? t('conflictReloaded')
            : t('saved');
    replace(
      statusEl,
      h('span', { dataset: { status: state.saveStatus }, text: statusText }),
      h('span', {
        text: `${t('words', { count: stats.words })} · ${t('chars', { count: stats.chars })} · ${t('readingTime', { minutes: stats.readingMinutes })}`,
      }),
    );
  }

  function renderMain() {
    if (state.showGraph) {
      renderGraphView();
      return;
    }
    const active = getActiveNote();
    if (!active) {
      replace(
        mainEl,
        h(
          'div',
          { class: 'nx-empty nx-notes-empty-center' },
          icon('note', { size: 32 }),
          h('p', { text: t('selectOrCreate') }),
          button({ label: t('newNote'), icon: 'plus', variant: 'primary', onClick: () => void createNewNote() }),
        ),
      );
      return;
    }

    const titleInput = h('input', {
      class: 'nx-notes-title-input',
      type: 'text',
      value: active.title,
      placeholder: t('titlePlaceholder'),
      'aria-label': t('titlePlaceholder'),
      onchange: () => void renameActiveNote(titleInput.value),
      onkeydown: (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void renameActiveNote(titleInput.value);
        }
      },
    });

    const topbar = h(
      'header',
      { class: 'nx-notes-topbar' },
      titleInput,
      iconButton({
        icon: active.meta.pinned ? 'pin-off' : 'pin',
        label: t(active.meta.pinned ? 'unpin' : 'pin'),
        pressed: active.meta.pinned,
        onClick: () => void togglePin(active),
      }),
      iconButton({
        icon: 'star',
        label: t(active.meta.favorite ? 'unfavorite' : 'favorite'),
        pressed: active.meta.favorite,
        onClick: () => void toggleFavorite(active),
      }),
      iconButton({
        icon: active.meta.encrypted ? (active.locked ? 'lock' : 'unlock') : 'key',
        label: t(active.meta.encrypted ? 'decryptNote' : 'encryptNote'),
        pressed: Boolean(active.meta.encrypted),
        onClick: () => void toggleEncryption(active),
      }),
      active.meta.encrypted && !active.locked
        ? iconButton({
            icon: 'lock',
            label: t('lockNow'),
            onClick: () => lockNoteInMemory(active.path),
          })
        : null,
      h(
        'div',
        { class: 'nx-btn-group', role: 'group' },
        .../** @type {const} */ (['edit', 'split', 'preview']).map((m) =>
          h('button', {
            class: `nx-btn${state.mode === m ? ' is-primary' : ''}`,
            type: 'button',
            text: t(m === 'edit' ? 'modeEdit' : m === 'split' ? 'modeSplit' : 'modePreview'),
            onclick: () => {
              state.mode = m;
              renderMain();
              ctx.window?.stateChanged();
            },
          }),
        ),
      ),
      iconButton({
        icon: 'sidebar',
        label: t('outline'),
        pressed: state.showInspector,
        onClick: () => {
          state.showInspector = !state.showInspector;
          inspectorEl.hidden = !state.showInspector;
          rootEl.classList.toggle('has-inspector', state.showInspector);
          renderInspector();
        },
      }),
      iconButton({
        icon: 'trash',
        label: t('deleteNote'),
        onClick: () => void trashNote(active),
      }),
    );

    if (active.locked) {
      const pwInput = h('input', {
        class: 'nx-input',
        type: 'password',
        placeholder: t('passwordPrompt'),
        'aria-label': t('passwordPrompt'),
      });
      const errEl = h('p', { class: 'nx-notes-err' });
      const unlockNow = async () => {
        if (!active.meta.encrypted) return;
        try {
          const decrypted = await ctx.crypto.decryptText(active.meta.encrypted, pwInput.value);
          unlockedSessions.set(active.path, { password: pwInput.value, body: decrypted, timer: null });
          active.locked = false;
          active.body = decrypted;
          touchUnlockedSession(active.path);
          renderMain();
          renderList();
          renderInspector();
        } catch {
          errEl.textContent = t('wrongPassword');
        }
      };
      pwInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') void unlockNow();
      });
      replace(
        mainEl,
        topbar,
        h(
          'div',
          { class: 'nx-notes-lock-screen' },
          icon('lock', { size: 40 }),
          h('h3', { text: t('lockedTitle') }),
          h('p', { text: t('lockedHint') }),
          h(
            'div',
            { class: 'nx-notes-lock-form' },
            pwInput,
            button({ label: t('unlock'), icon: 'unlock', variant: 'primary', onClick: unlockNow }),
          ),
          errEl,
        ),
      );
      return;
    }

    const tagsInput = h('input', {
      class: 'nx-notes-tags-input',
      type: 'text',
      value: active.meta.tags.join(', '),
      placeholder: t('tagsPlaceholder'),
      'aria-label': t('tagsPlaceholder'),
      onchange: () => {
        active.meta.tags = tagsInput.value
          .split(',')
          .map((s) => s.trim().replace(/^#/, ''))
          .filter(Boolean);
        scheduleAutosave(active);
        renderSidebar();
      },
    });

    const metaBar = h(
      'div',
      { class: 'nx-notes-meta-bar' },
      icon('tag', { size: 14 }),
      tagsInput,
      active.folder ? h('span', { text: `📁 ${active.folder}` }) : null,
    );

    const fmtBtn = (
      /** @type {Parameters<typeof cmEditor.format>[0]} */ action,
      /** @type {string} */ labelKey,
      /** @type {string} */ textLabel,
    ) =>
      h('button', {
        class: 'nx-btn is-ghost',
        type: 'button',
        title: t(labelKey),
        'aria-label': t(labelKey),
        dataset: { fmt: action },
        text: textLabel,
        onclick: () => cmEditor.format(action),
      });

    const fmtToolbar = h(
      'div',
      { class: 'nx-notes-toolbar', role: 'toolbar', 'aria-label': 'Formatting' },
      fmtBtn('bold', 'fmtBold', 'B'),
      fmtBtn('italic', 'fmtItalic', 'I'),
      fmtBtn('h1', 'fmtH1', 'H1'),
      fmtBtn('h2', 'fmtH2', 'H2'),
      fmtBtn('h3', 'fmtH3', 'H3'),
      h('span', { class: 'nx-sep' }),
      fmtBtn('ul', 'fmtUl', '• List'),
      fmtBtn('ol', 'fmtOl', '1. List'),
      fmtBtn('task', 'fmtTask', '☑ Task'),
      h('span', { class: 'nx-sep' }),
      fmtBtn('code', 'fmtCode', '</>'),
      fmtBtn('codeblock', 'fmtCodeBlock', '```'),
      fmtBtn('quote', 'fmtQuote', '❝'),
      fmtBtn('link', 'fmtLink', '🔗'),
      fmtBtn('wikilink', 'fmtWiki', '[[Wiki]]'),
      fmtBtn('table', 'fmtTable', '⊞ Table'),
      fmtBtn('math', 'fmtMath', '∑ Math'),
      fmtBtn('hr', 'fmtHr', '―'),
      iconButton({
        icon: 'image',
        label: t('addImage'),
        onClick: () => pickImageFile(),
      }),
      ...(ctx.ai?.isAvailable()
        ? [
            h('span', { class: 'nx-sep' }),
            iconButton({
              icon: 'sparkles',
              label: 'AI Assistant',
              onClick: (e) => showAiNotesMenu(/** @type {HTMLElement} */ (e.currentTarget)),
            }),
          ]
        : []),
    );

    cmEditor.setText(active.body);
    workspaceEl.className = `nx-notes-workspace mode-${state.mode}`;
    editorPaneEl.hidden = state.mode === 'preview';
    previewPaneEl.hidden = state.mode === 'edit';

    replace(mainEl, topbar, metaBar, fmtToolbar, workspaceEl, statusEl);
    renderStatus();
    void renderPreview();
  }

  function showAiNotesMenu(triggerEl) {
    const rect = triggerEl.getBoundingClientRect();
    const menu = h('div', {
      class: 'nx-notes-ai-menu',
      style: `position: fixed; top: ${rect.bottom + 4}px; left: ${rect.left}px; background: var(--bg-surface, #24242e); border: 1px solid var(--border-subtle, rgba(255,255,255,0.15)); border-radius: 6px; padding: 4px; z-index: 1000; box-shadow: 0 8px 24px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 2px;`,
    });

    const items = [
      {
        label: 'Summarize Note',
        run: async () => {
          ctx.notify({ title: 'AI: Summarizing note...', duration: 2000 });
          const res = await ctx.ai.complete(`Summarize the following note in 3-5 bullet points:\n\n${cmEditor.text}`);
          cmEditor.insertText(`\n\n## Summary\n${res}\n`);
        },
      },
      {
        label: 'Continue Writing',
        run: async () => {
          ctx.notify({ title: 'AI: Continuing note...', duration: 2000 });
          const res = await ctx.ai.complete(
            `Continue writing the following note smoothly and cohesively:\n\n${cmEditor.text}`,
          );
          cmEditor.insertText(`\n\n${res}\n`);
        },
      },
      {
        label: 'Fix Grammar (EN/DE)',
        run: async () => {
          ctx.notify({ title: 'AI: Checking grammar...', duration: 2000 });
          const res = await ctx.ai.complete(
            `Fix any grammar, spelling, or punctuation errors in this text without changing meaning. Output only the corrected text:\n\n${cmEditor.text}`,
          );
          cmEditor.setText(res);
        },
      },
      {
        label: 'Generate Outline',
        run: async () => {
          ctx.notify({ title: 'AI: Generating outline...', duration: 2000 });
          const res = await ctx.ai.complete(
            `Generate a structured Markdown outline for this note:\n\n${cmEditor.text}`,
          );
          cmEditor.insertText(`\n\n## Outline\n${res}\n`);
        },
      },
      {
        label: 'Ask AI Assistant...',
        run: () => {
          ctx.commands.execute('shell.launchApp', {
            appId: 'nexus.assistant',
            args: { text: cmEditor.text },
          });
        },
      },
    ];

    for (const it of items) {
      const btn = h(
        'button',
        {
          class: 'nx-notes-menu-item',
          style:
            'text-align: left; padding: 6px 12px; background: transparent; border: none; color: #fff; font-size: 12px; cursor: pointer; border-radius: 4px;',
          onmouseenter: (e) => /** @type {HTMLElement} */ (e.target.style.background = 'rgba(255,255,255,0.08)'),
          onmouseleave: (e) => /** @type {HTMLElement} */ (e.target.style.background = 'transparent'),
          onclick: () => {
            menu.remove();
            void it.run();
          },
        },
        it.label,
      );
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    const closeListener = (/** @type {PointerEvent} */ e) => {
      if (!menu.contains(/** @type {Node} */ (e.target))) {
        menu.remove();
        window.removeEventListener('pointerdown', closeListener);
      }
    };
    setTimeout(() => window.addEventListener('pointerdown', closeListener), 10);
  }

  // ─── Inspector (Outline, Backlinks, Checklist -> Tasks) ────────────────
  function renderInspector() {
    if (!state.showInspector) return;
    const active = getActiveNote();
    if (!active || active.locked) {
      replace(inspectorEl);
      return;
    }
    const { outline, checklist } = analyzeNote(active.body);
    const backlinks = computeBacklinks([...notesMap.values()], active.title);
    const openChecklist = checklist.filter((c) => !c.done);

    replace(
      inspectorEl,
      h(
        'section',
        {},
        h('h4', { text: t('outline') }),
        outline.length
          ? h(
              'div',
              {},
              ...outline.map((item) =>
                h('button', {
                  class: `nx-notes-outline-item nx-notes-outline-${Math.min(4, item.level)}`,
                  type: 'button',
                  text: item.text,
                  onclick: () => cmEditor.scrollToLine(item.line),
                }),
              ),
            )
          : h('small', { class: 'nx-notes-muted', text: t('noOutline') }),
      ),
      h(
        'section',
        {},
        h('h4', { text: `${t('backlinks')} (${backlinks.length})` }),
        backlinks.length
          ? h(
              'div',
              {},
              ...backlinks.map(({ note, snippet }) =>
                h(
                  'button',
                  {
                    class: 'nx-notes-backlink-item',
                    type: 'button',
                    onclick: () => selectNote(note.path),
                  },
                  h('strong', { text: note.title }),
                  h('small', { text: snippet }),
                ),
              ),
            )
          : h('small', { class: 'nx-notes-muted', text: t('noBacklinks') }),
      ),
      openChecklist.length
        ? h(
            'section',
            {},
            h('h4', { text: t('checklistToTask') }),
            ...openChecklist.slice(0, 10).map((item) =>
              h('button', {
                class: 'nx-notes-outline-item',
                type: 'button',
                title: t('createTask'),
                text: `+ ${item.text}`,
                onclick: () => void sendChecklistItemToTasks(active, item.text),
              }),
            ),
          )
        : null,
    );
  }

  /** Sends a checklist item to Nexus Tasks via event bus + intent. @param {NoteEntry} note @param {string} title */
  async function sendChecklistItemToTasks(note, title) {
    ctx.events.emit('tasks:create-from-note', { title, notePath: note.path, noteTitle: note.title });
    await ctx.intents
      .share({ title, notePath: note.path, noteTitle: note.title }, 'application/vnd.nexus.task')
      .catch(() => {});
    ctx.notify({ title: t('taskSent', { title }) });
  }

  // ─── Graph View (Canvas force-directed wiki-link graph) ────────────────
  function renderGraphView() {
    const all = [...notesMap.values()];
    const canvas = h('canvas', { class: 'nx-notes-graph-canvas' });
    const overlay = h(
      'div',
      { class: 'nx-notes-graph-overlay' },
      h(
        'header',
        { class: 'nx-notes-topbar' },
        icon('share', { size: 18 }),
        h('strong', { text: t('graphView') }),
        h('div', { class: 'nx-notes-spacer' }),
        button({
          label: t('closeGraph'),
          icon: 'x',
          onClick: () => {
            state.showGraph = false;
            renderMain();
          },
        }),
      ),
      canvas,
    );
    replace(mainEl, overlay);

    requestAnimationFrame(() => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(400, rect.width || 600);
      const hPx = Math.max(300, rect.height || 400);
      canvas.width = w;
      canvas.height = hPx;
      const g = canvas.getContext('2d');
      if (!g) return;

      const nodes = all.map((n, i) => {
        const angle = (2 * Math.PI * i) / Math.max(1, all.length);
        const r = Math.min(w, hPx) * 0.32;
        return {
          note: n,
          x: w / 2 + Math.cos(angle) * r,
          y: hPx / 2 + Math.sin(angle) * r,
        };
      });
      const byTitle = new Map(nodes.map((nd) => [nd.note.title.toLowerCase(), nd]));
      /** @type {{ from: typeof nodes[0], to: typeof nodes[0] }[]} */
      const edges = [];
      for (const nd of nodes) {
        if (nd.note.locked) continue;
        for (const target of extractWikiLinks(nd.note.body)) {
          const dest = byTitle.get(target.toLowerCase());
          if (dest && dest !== nd) edges.push({ from: nd, to: dest });
        }
      }

      const accent = ctx.theme.token('--accent') || '#6ee7b7';
      const textCol = ctx.theme.token('--text-1') || '#f3f4f6';
      const lineCol = ctx.theme.token('--border') || '#374151';

      g.clearRect(0, 0, w, hPx);
      g.strokeStyle = lineCol;
      g.lineWidth = 1.5;
      for (const edge of edges) {
        g.beginPath();
        g.moveTo(edge.from.x, edge.from.y);
        g.lineTo(edge.to.x, edge.to.y);
        g.stroke();
      }
      g.font = '12px sans-serif';
      g.textAlign = 'center';
      for (const nd of nodes) {
        g.fillStyle = nd.note.path === state.activePath ? accent : textCol;
        g.beginPath();
        g.arc(nd.x, nd.y, 8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = textCol;
        g.fillText(nd.note.title, nd.x, nd.y + 22);
      }

      canvas.addEventListener('click', (e) => {
        const r = canvas.getBoundingClientRect();
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        const hit = nodes.find((nd) => Math.hypot(nd.x - cx, nd.y - cy) < 18);
        if (hit) {
          state.showGraph = false;
          selectNote(hit.note.path);
        }
      });
    });
  }

  // ─── Actions: Rename, Pin, Favorite, Move, Trash, Encrypt ──────────────
  /** @param {string} rawNewTitle */
  async function renameActiveNote(rawNewTitle) {
    const active = getActiveNote();
    if (!active) return;
    const newTitle = sanitizeTitle(rawNewTitle);
    if (newTitle === active.title) return;
    const oldTitle = active.title;
    const oldPath = active.path;
    if (active.body.startsWith(`# ${oldTitle}\n`)) {
      active.body = `# ${newTitle}\n` + active.body.slice(`# ${oldTitle}\n`.length);
    }
    const newPath = await fs.uniquePath(joinPath(parentOf(active.path), `${newTitle}.md`));
    selfWritingPaths.add(oldPath);
    selfWritingPaths.add(newPath);
    await fs.move(oldPath, newPath);
    selfWritingPaths.delete(oldPath);
    selfWritingPaths.delete(newPath);
    const session = unlockedSessions.get(oldPath);
    if (session) {
      unlockedSessions.delete(oldPath);
      unlockedSessions.set(newPath, session);
    }
    notesMap.delete(oldPath);
    const renamedEntry = await readNoteEntry(newPath);
    renamedEntry.body = active.body;
    await saveNoteNow(renamedEntry);
    selectNote(newPath);
  }

  /** @param {NoteEntry} note */
  async function togglePin(note) {
    note.meta.pinned = !note.meta.pinned;
    await saveNoteNow(note);
    renderMain();
  }

  /** @param {NoteEntry} note */
  async function toggleFavorite(note) {
    note.meta.favorite = !note.meta.favorite;
    await saveNoteNow(note);
    renderSidebar();
    renderMain();
  }

  /** @param {NoteEntry} note */
  async function toggleEncryption(note) {
    if (note.meta.encrypted) {
      if (note.locked) {
        const pw = await /** @type {any} */ (ctx.dialog).prompt(t('passwordPrompt'), '', { title: t('decryptNote') });
        if (!pw) return;
        try {
          note.body = await ctx.crypto.decryptText(note.meta.encrypted, pw);
          note.locked = false;
        } catch {
          await /** @type {any} */ (ctx.dialog).alert(t('wrongPassword'));
          return;
        }
      }
      note.meta.encrypted = null;
      const session = unlockedSessions.get(note.path);
      if (session?.timer) session.timer();
      unlockedSessions.delete(note.path);
      await saveNoteNow(note);
      renderMain();
      return;
    }

    const pw = await /** @type {any} */ (ctx.dialog).prompt(
      `${t('passwordPrompt')}\n\n⚠️ ${t('passwordWarning')}`,
      '',
      {
        title: t('encryptNote'),
      },
    );
    if (!pw) return;
    note.meta.encrypted = await ctx.crypto.encrypt(note.body, pw);
    unlockedSessions.set(note.path, { password: pw, body: note.body, timer: null });
    touchUnlockedSession(note.path);
    await saveNoteNow(note);
    renderMain();
  }

  /** @param {NoteEntry} note */
  async function trashNote(note) {
    const oldPath = note.path;
    const session = unlockedSessions.get(oldPath);
    if (session?.timer) session.timer();
    unlockedSessions.delete(oldPath);
    selfWritingPaths.add(oldPath);
    await fs.trash(oldPath);
    selfWritingPaths.delete(oldPath);
    await loadAllNotes();
    if (state.activePath === oldPath) {
      const next = [...notesMap.keys()][0] ?? null;
      selectNote(next);
    } else {
      renderSidebar();
      renderList();
    }
  }

  async function promptNewFolder() {
    const name = await /** @type {any} */ (ctx.dialog).prompt(t('folderPrompt'), '', { title: t('newFolder') });
    if (!name || !name.trim()) return;
    const rel = name
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .map(sanitizeTitle)
      .join('/');
    await fs.mkdir(joinPath(notesRoot, rel), { recursive: true });
    foldersSet.add(rel);
    state.view = 'folder';
    state.selectedFolder = rel;
    renderSidebar();
    renderList();
  }

  /** @param {NoteEntry} note */
  async function promptMoveNote(note) {
    const folder = await /** @type {any} */ (ctx.dialog).prompt(t('movePrompt'), note.folder, {
      title: t('moveToFolder'),
    });
    if (folder === null || folder === undefined) return;
    await moveNoteToFolder(note.path, folder.trim().replace(/^\/+|\/+$/g, ''));
  }

  /**
   * Moves `notePath` into `targetRelFolder` inside Notes root.
   * @param {string} notePath
   * @param {string} targetRelFolder
   */
  async function moveNoteToFolder(notePath, targetRelFolder) {
    const note = notesMap.get(notePath);
    if (!note || note.folder === targetRelFolder) return;
    const destDir = targetRelFolder ? joinPath(notesRoot, targetRelFolder) : notesRoot;
    if (!(await fs.exists(destDir))) await fs.mkdir(destDir, { recursive: true });
    const destPath = await fs.uniquePath(joinPath(destDir, `${note.title}.md`));
    selfWritingPaths.add(notePath);
    selfWritingPaths.add(destPath);
    await fs.move(notePath, destPath);
    selfWritingPaths.delete(notePath);
    selfWritingPaths.delete(destPath);
    const session = unlockedSessions.get(notePath);
    if (session) {
      unlockedSessions.delete(notePath);
      unlockedSessions.set(destPath, session);
    }
    await loadAllNotes();
    if (state.activePath === notePath) selectNote(destPath);
    else {
      renderSidebar();
      renderList();
    }
  }

  async function openDailyNote() {
    const today = new Date().toISOString().slice(0, 10);
    const existing = [...notesMap.values()].find((n) => n.title === today);
    if (existing) {
      selectNote(existing.path);
      return;
    }
    const tpl = NOTE_TEMPLATES[0];
    await createNewNote({
      title: today,
      tags: [...tpl.tags],
      body: tpl.body(today, ctx.i18n.locale),
    });
  }

  /** @param {HTMLElement} anchor */
  function openTemplatesMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    const today = new Date().toISOString().slice(0, 10);
    openMenu(r.left, r.bottom + 4, [
      {
        label: t('templateDaily'),
        icon: 'calendar',
        run: () => void openDailyNote(),
      },
      {
        label: t('templateMeeting'),
        icon: 'users',
        run: () =>
          void createNewNote({
            title: NOTE_TEMPLATES[1].title(today),
            tags: [...NOTE_TEMPLATES[1].tags],
            body: NOTE_TEMPLATES[1].body(today, ctx.i18n.locale),
          }),
      },
      {
        label: t('templateLecture'),
        icon: 'book',
        run: () =>
          void createNewNote({
            title: NOTE_TEMPLATES[2].title(today),
            tags: [...NOTE_TEMPLATES[2].tags],
            body: NOTE_TEMPLATES[2].body(today, ctx.i18n.locale),
          }),
      },
    ]);
  }

  // ─── Import / Export ───────────────────────────────────────────────────
  function pickImageFile() {
    const input = h('input', { type: 'file', accept: 'image/*', multiple: true });
    input.addEventListener('change', () => {
      if (input.files?.length) void handlePasteOrDropImages([...input.files]);
    });
    input.click();
  }

  /** @param {boolean} directory */
  function triggerFileImport(directory) {
    const input = h('input', { type: 'file', multiple: true, accept: '.md,.markdown,.txt' });
    if (directory) input.setAttribute('webkitdirectory', '');
    input.addEventListener('change', async () => {
      if (!input.files?.length) return;
      const targetDir =
        state.view === 'folder' && state.selectedFolder ? joinPath(notesRoot, state.selectedFolder) : notesRoot;
      const files = [...input.files].filter((f) => /\.(md|markdown|txt)$/i.test(f.name));
      let lastPath = null;
      for (const file of files) {
        const text = await file.text();
        const rel = file.webkitRelativePath || file.name;
        const mdRel = rel.replace(/\.txt$/i, '.md');
        const dest = await fs.uniquePath(joinPath(targetDir, mdRel));
        const { meta, body } = parseFrontMatter(text);
        await fs.writeFile(dest, serializeFrontMatter(meta, body), { createParents: true });
        lastPath = dest;
      }
      await loadAllNotes();
      if (lastPath) selectNote(lastPath);
      else {
        renderSidebar();
        renderList();
      }
    });
    input.click();
  }

  /** @param {HTMLElement} anchor */
  function openImportMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    openMenu(r.left, r.top - 8, [
      { label: t('importFiles'), icon: 'file-plus', run: () => triggerFileImport(false) },
      { label: t('importFolder'), icon: 'folder-plus', run: () => triggerFileImport(true) },
    ]);
  }

  /** @param {HTMLElement} anchor */
  function openExportMenu(anchor) {
    const r = anchor.getBoundingClientRect();
    const active = getActiveNote();
    openMenu(r.left, r.top - 8, [
      {
        label: t('exportMd'),
        icon: 'file-text',
        disabled: !active || active.locked,
        run: () => {
          if (!active) return;
          const md = serializeFrontMatter({ ...active.meta, encrypted: null }, active.body);
          fs.downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${active.title}.md`);
        },
      },
      {
        label: t('exportHtml'),
        icon: 'file-code',
        disabled: !active || active.locked,
        run: async () => {
          if (!active) return;
          const bodyHtml = await renderMarkdown(active.body, { math: true, footnotes: true, wikiLinks: true });
          const doc = `<!doctype html>\n<html lang="${ctx.i18n.locale}"><head><meta charset="utf-8"><title>${active.title}</title></head><body>${bodyHtml}</body></html>`;
          fs.downloadBlob(new Blob([doc], { type: 'text/html;charset=utf-8' }), `${active.title}.html`);
        },
      },
      {
        label: t('exportPrint'),
        icon: 'file',
        disabled: !active || active.locked,
        run: () => window.print(),
      },
      'separator',
      {
        label: t('exportZip'),
        icon: 'file-zip',
        run: () => void fs.download(notesRoot),
      },
      {
        label: t('exportJson'),
        icon: 'archive',
        run: () => {
          const bundle = {
            exportedAt: new Date().toISOString(),
            notes: [...notesMap.values()].map((n) => ({
              path: n.path.slice(notesRoot.length + 1),
              title: n.title,
              folder: n.folder,
              meta: n.meta,
              body: n.locked ? null : n.body,
            })),
          };
          fs.downloadBlob(
            new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }),
            'nexus-notes-export.json',
          );
        },
      },
    ]);
  }

  // ─── Keyboard Shortcuts & Commands ─────────────────────────────────────
  const scOpts = { allowInInputs: true };
  ctx.shortcuts.register('Mod+N', () => void createNewNote(), scOpts);
  ctx.shortcuts.register(
    'Mod+S',
    () => {
      const active = getActiveNote();
      if (active) void saveNoteNow(active);
    },
    scOpts,
  );
  ctx.shortcuts.register('Mod+B', () => cmEditor.format('bold'), scOpts);
  ctx.shortcuts.register('Mod+I', () => cmEditor.format('italic'), scOpts);
  ctx.shortcuts.register('Mod+K', () => cmEditor.format('link'), scOpts);
  ctx.shortcuts.register('Mod+F', () => cmEditor.find(), scOpts);

  // Watch Notes root for external edits or second open window (conflict-safe)
  fs.watch(
    notesRoot,
    async (/** @type {any} */ event) => {
      if (!event?.path || selfWritingPaths.has(event.path)) return;
      if (event.type === 'deleted' || event.type === 'trashed') {
        notesMap.delete(event.path);
        const allTrash = /** @type {any[]} */ (await fs.listTrash());
        trashItems = allTrash.filter((item) => item.originalPath?.startsWith(`${notesRoot}/`));
        renderSidebar();
        renderList();
        if (state.activePath === event.path) selectNote([...notesMap.keys()][0] ?? null);
        return;
      }
      if (event.path.endsWith('.md') && (await fs.exists(event.path))) {
        const entry = await readNoteEntry(event.path);
        if (state.activePath === event.path && !entry.locked) {
          if (cmEditor.text !== entry.body) {
            cmEditor.setText(entry.body);
            state.saveStatus = 'conflict';
            renderStatus();
            void renderPreview();
          }
        }
        renderSidebar();
        renderList();
        renderInspector();
      }
    },
    { recursive: true },
  );

  ctx.i18n.onChange(() => {
    searchInput.placeholder = t('searchPlaceholder');
    cmEditor.setLocale(ctx.i18n.locale);
    renderSidebar();
    renderList();
    renderMain();
    renderInspector();
  });

  // ─── Initial Load & Intent Handling ────────────────────────────────────
  await loadAllNotes();
  const launchPath = /** @type {string | undefined} */ (args.intent?.path ?? args.path);
  if (launchPath && (await fs.exists(launchPath))) {
    if (!notesMap.has(launchPath)) await readNoteEntry(launchPath);
    selectNote(launchPath);
  } else if (state.activePath && notesMap.has(state.activePath)) {
    selectNote(state.activePath);
  } else {
    const first = filterNotes([...notesMap.values()], { sortBy: state.sortBy })[0]?.note.path ?? null;
    selectNote(first);
  }

  return {
    async canClose() {
      const active = getActiveNote();
      if (saveTimer && active && !active.locked) {
        await saveNoteNow(active);
      }
      return true;
    },
    saveState: () => ({
      view: state.view,
      selectedFolder: state.selectedFolder,
      selectedTag: state.selectedTag,
      activePath: state.activePath,
      query: state.query,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      sortBy: state.sortBy,
      mode: state.mode,
      showInspector: state.showInspector,
    }),
    onIntent(intent) {
      if (intent.path) {
        void readNoteEntry(intent.path).then(() => selectNote(intent.path ?? null));
      } else if (intent.action === 'share' && typeof intent.data === 'string') {
        void createNewNote({ body: intent.data });
      }
    },
    unmount() {
      clearTimeout(saveTimer);
      clearTimeout(previewTimer);
      for (const session of unlockedSessions.values()) if (session.timer) session.timer();
      for (const url of imageBlobUrls.values()) URL.revokeObjectURL(url);
      cmEditor.destroy();
    },
  };
}
