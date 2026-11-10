// @ts-check
import { h, icon } from '../../ui/dom.js';
import './styles.css';

/**
 * @typedef {object} SnippetItem
 * @property {string} id
 * @property {string} title
 * @property {string} language
 * @property {string} code
 * @property {string[]} tags
 * @property {string} [description]
 * @property {boolean} [favorite]
 * @property {number} updated
 */

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);
  const store = ctx.storage?.collection?.('snippets');

  const defaultSnippets = /** @type {SnippetItem[]} */ ([
    {
      id: '1',
      title: 'Fetch with Timeout',
      language: 'javascript',
      tags: ['fetch', 'network', 'async'],
      description: 'Fetch API wrapper with AbortController timeout',
      code: `async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {\n  const controller = new AbortController();\n  const id = setTimeout(() => controller.abort(), timeoutMs);\n  try {\n    const res = await fetch(url, { ...options, signal: controller.signal });\n    clearTimeout(id);\n    return res;\n  } catch (err) {\n    clearTimeout(id);\n    throw err;\n  }\n}`,
      favorite: true,
      updated: Date.now(),
    },
    {
      id: '2',
      title: 'Debounce Helper',
      language: 'javascript',
      tags: ['utils', 'perf'],
      description: 'Standard debounce implementation',
      code: `function debounce(fn, wait = 300) {\n  let timer;\n  return function (...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), wait);\n  };\n}`,
      favorite: false,
      updated: Date.now(),
    },
    {
      id: '3',
      title: 'CSS Glassmorphism Card',
      language: 'css',
      tags: ['css', 'ui', 'glass'],
      description: 'Frosted glass container with border shine',
      code: `.glass-card {\n  background: rgba(255, 255, 255, 0.08);\n  backdrop-filter: blur(16px);\n  -webkit-backdrop-filter: blur(16px);\n  border: 1px solid rgba(255, 255, 255, 0.15);\n  border-radius: 12px;\n  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);\n}`,
      favorite: true,
      updated: Date.now(),
    },
  ]);

  /** @type {SnippetItem[]} */
  let snippets = [];
  try {
    const saved = await store?.getAll?.();
    if (saved && saved.length > 0) {
      snippets = saved;
    } else {
      snippets = [...defaultSnippets];
      for (const s of defaultSnippets) void store?.insert?.(s);
    }
  } catch {
    snippets = [...defaultSnippets];
  }

  /** @type {SnippetItem | null} */
  let activeSnippet = snippets[0] || null;

  const root = h('div', { class: 'nx-snippets-app' });

  // Sidebar
  const sidebar = h('aside', { class: 'nx-snippets-sidebar' });
  const searchBox = h('div', { class: 'nx-snippets-search' });
  const searchInput = h('input', { type: 'text', placeholder: t('sidebar.search'), spellcheck: 'false' });
  searchBox.append(searchInput);

  const sidebarHeader = h(
    'div',
    {
      style:
        'display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid var(--border);',
    },
    h('span', { style: 'font-size: 12px; font-weight: 600;' }, t('sidebar.all')),
    h('button', { class: 'nx-button small ghost', title: t('sidebar.newSnippet') }, icon('file-plus', { size: 14 })),
  );

  const listEl = h('ul', { class: 'nx-snippets-list' });
  sidebar.append(searchBox, sidebarHeader, listEl);

  // Main detail
  const mainEl = h('main', { class: 'nx-snippets-main' });
  root.append(sidebar, mainEl);
  container.append(root);

  // Main Toolbar
  const toolbar = h('div', { class: 'nx-snippets-toolbar' });
  const copyBtn = h('button', { class: 'nx-button primary small' }, icon('copy', { size: 14 }), t('editor.copy'));
  const saveBtn = h('button', { class: 'nx-button ghost small' }, icon('check', { size: 14 }), t('editor.save'));
  const delBtn = h(
    'button',
    { class: 'nx-button ghost small', style: 'color: var(--danger);' },
    icon('trash', { size: 14 }),
    t('editor.delete'),
  );
  const exportBtn = h(
    'button',
    { class: 'nx-button ghost small' },
    icon('download', { size: 14 }),
    t('editor.exportJson'),
  );
  const importBtn = h(
    'button',
    { class: 'nx-button ghost small' },
    icon('upload', { size: 14 }),
    t('editor.importJson'),
  );

  const leftToolbar = h('div', { style: 'display: flex; gap: 6px; align-items: center;' }, copyBtn, saveBtn, delBtn);
  const rightToolbar = h('div', { style: 'display: flex; gap: 6px; align-items: center;' }, exportBtn, importBtn);
  toolbar.append(leftToolbar, rightToolbar);

  // Meta bar
  const metaBar = h('div', { class: 'nx-snippets-meta-bar' });
  const titleInput = h('input', {
    type: 'text',
    class: 'nx-snippets-title-input',
    placeholder: t('editor.titlePlaceholder'),
    spellcheck: 'false',
  });

  const langSelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'javascript' }, 'JavaScript'),
    h('option', { value: 'typescript' }, 'TypeScript'),
    h('option', { value: 'html' }, 'HTML'),
    h('option', { value: 'css' }, 'CSS'),
    h('option', { value: 'json' }, 'JSON'),
    h('option', { value: 'sql' }, 'SQL'),
    h('option', { value: 'shell' }, 'Shell / Bash'),
    h('option', { value: 'python' }, 'Python'),
  );

  const tagsInput = h('input', {
    type: 'text',
    placeholder: t('editor.tagsPlaceholder'),
    style:
      'background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; padding: 4px 8px; font-size: 12px; color: var(--text-1); width: 180px;',
  });

  metaBar.append(titleInput, langSelect, tagsInput);

  // Code area
  const codeArea = h('div', { class: 'nx-snippets-code-area' });
  const codeTextarea = h('textarea', {
    class: 'nx-snippets-textarea',
    placeholder: '// Paste or write code snippet here...',
    spellcheck: 'false',
  });
  codeArea.append(codeTextarea);

  mainEl.append(toolbar, metaBar, codeArea);

  function renderList() {
    listEl.replaceChildren();
    const q = searchInput.value.toLowerCase().trim();
    const filtered = snippets.filter((s) => {
      return (
        s.title.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });

    for (const item of filtered) {
      const li = h(
        'li',
        { class: `nx-snippet-item${activeSnippet?.id === item.id ? ' active' : ''}` },
        h(
          'div',
          { class: 'nx-snippet-header' },
          h('span', { class: 'nx-snippet-title' }, item.title || 'Untitled'),
          h('span', { class: 'nx-snippet-lang-tag' }, item.language),
        ),
        h(
          'div',
          { class: 'nx-snippet-tags' },
          ...item.tags.map((tag) => h('span', { class: 'nx-snippet-tag' }, `#${tag}`)),
        ),
      );
      li.addEventListener('click', () => {
        activeSnippet = item;
        loadActiveSnippet();
        renderList();
      });
      listEl.append(li);
    }
  }

  function loadActiveSnippet() {
    if (!activeSnippet) return;
    titleInput.value = activeSnippet.title;
    langSelect.value = activeSnippet.language;
    tagsInput.value = activeSnippet.tags.join(', ');
    codeTextarea.value = activeSnippet.code;
  }

  function saveCurrent() {
    if (!activeSnippet) return;
    activeSnippet.title = titleInput.value.trim() || 'Untitled';
    // @ts-ignore
    activeSnippet.language = langSelect.value;
    activeSnippet.tags = tagsInput.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    activeSnippet.code = codeTextarea.value;
    activeSnippet.updated = Date.now();

    void store?.update?.(activeSnippet.id, activeSnippet);
    renderList();
    ctx.notifications?.notify?.({ title: t('messages.saved'), level: 'success' });
  }

  saveBtn.addEventListener('click', saveCurrent);

  copyBtn.addEventListener('click', async () => {
    if (codeTextarea.value) {
      await navigator.clipboard.writeText(codeTextarea.value);
      ctx.notifications?.notify?.({ title: t('editor.copied'), level: 'info' });
    }
  });

  delBtn.addEventListener('click', () => {
    if (!activeSnippet) return;
    const idx = snippets.findIndex((s) => s.id === activeSnippet?.id);
    if (idx !== -1) {
      const id = activeSnippet.id;
      snippets.splice(idx, 1);
      void store?.delete?.(id);
      activeSnippet = snippets[0] || null;
      loadActiveSnippet();
      renderList();
      ctx.notifications?.notify?.({ title: t('messages.deleted'), level: 'info' });
    }
  });

  sidebarHeader.querySelector('button')?.addEventListener('click', () => {
    const newS = {
      id: String(Date.now()),
      title: 'New Snippet',
      language: 'javascript',
      tags: [],
      code: '',
      updated: Date.now(),
    };
    snippets.unshift(newS);
    activeSnippet = newS;
    void store?.insert?.(newS);
    loadActiveSnippet();
    renderList();
    titleInput.focus();
  });

  searchInput.addEventListener('input', renderList);

  exportBtn.addEventListener('click', () => {
    const json = JSON.stringify(snippets, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', async () => {
    try {
      const file = await ctx.dialog?.openFile?.({ filter: '.json' });
      if (file?.path) {
        const content = await ctx.vfs?.readText?.(file.path);
        if (content) {
          const imported = JSON.parse(content);
          if (Array.isArray(imported)) {
            for (const item of imported) {
              if (item.title && item.code) {
                item.id = String(Date.now() + Math.random());
                snippets.unshift(item);
                void store?.insert?.(item);
              }
            }
            activeSnippet = snippets[0] || null;
            loadActiveSnippet();
            renderList();
            ctx.notifications?.notify?.({ title: 'Snippets imported successfully', level: 'success' });
          }
        }
      }
    } catch {
      // cancelled
    }
  });

  // Initial render
  loadActiveSnippet();
  renderList();

  return () => {
    root.remove();
  };
}

export const commands = {
  'snippets.open': (ctx, args) => ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.snippets', args }),
  'snippets.new': (ctx) => ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.snippets' }),
};

export const terminal = {
  snippet: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.snippets' });
      return 0;
    }
    const query = args.join(' ').toLowerCase();
    const store = ctx.storage?.collection?.('snippets');
    const all = (await store?.getAll?.()) || [];
    const match = all.find(
      (s) => s.title?.toLowerCase().includes(query) || s.tags?.some((t) => t.toLowerCase().includes(query)),
    );
    if (match) {
      io.stdout?.(`// ${match.title} (${match.language})\n${match.code}\n`);
      return 0;
    }
    io.stderr?.(`snippet: no snippet matching "${query}"\n`);
    return 1;
  },
};
