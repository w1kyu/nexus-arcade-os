// @ts-check
// Nexus Code: multi-file workspace and code editor.
import { createDiffViewer } from '../../ui/diff.js';
import { h, icon } from '../../ui/dom.js';
import { createCodeEditor, languageFor } from './editor.js';
import { loadSnapshots, takeSnapshot } from './history.js';
import './styles.css';
import { buildTree, bundleWebProject, flattenFilePaths, searchFiles } from './vfs-helper.js';

/**
 * @typedef {object} OpenTab
 * @property {string} path
 * @property {string} name
 * @property {string} content
 * @property {boolean} isDirty
 * @property {any} [editor]
 */

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'code.open': (ctx, args) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.code', args }),
  'code.newProject': async (ctx) => {
    const fs = /** @type {any} */ (ctx.fs);
    const home = fs?.home || '/home';
    const projectDir = `${home}/Projects/web-project`;
    await fs.mkdir(projectDir).catch(() => {});
    await fs.writeFile(
      `${projectDir}/index.html`,
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Nexus Web Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Welcome to Nexus Code</h1>
  <p id="msg">Loading dynamic script...</p>
  <script src="app.js"><` +
        `/script>
</body>
</html>`,
    );
    await fs.writeFile(
      `${projectDir}/style.css`,
      `body {
  font-family: system-ui, sans-serif;
  padding: 24px;
  background: #0f172a;
  color: #f8fafc;
}
h1 { color: #38bdf8; }`,
    );
    await fs.writeFile(
      `${projectDir}/app.js`,
      `console.log('Project started!');
document.getElementById('msg').textContent = 'Live scripts running smoothly!';`,
    );
    return ctx.commands.execute('shell.launchApp', { appId: 'nexus.code', args: { path: projectDir } });
  },
};

/** @type {import('../../kernel/types').AppModule['terminal']} */
export const terminal = {
  code: async (ctx, io) => {
    const targetPath = io.args[0] || (ctx.fs ? `${/** @type {any} */ (ctx.fs).home}/Projects` : '/');
    await ctx.commands.execute('shell.launchApp', { appId: 'nexus.code', args: { path: targetPath } });
    io.stdout(`Opened ${targetPath} in Nexus Code\n`);
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx, args = {}) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);
  const notify = (/** @type {any} */ n) => (ctx.notify || ctx.notifications?.notify)?.(n);
  const fs = /** @type {any} */ (ctx.fs);
  const home = fs?.home || '/home';
  let projectPath = args.path || `${home}/Projects`;

  // Ensure project path exists
  await fs.mkdir(projectPath).catch(() => {});

  const root = h('div', { class: 'nx-code-app' });

  // State
  let activeActivity = 'explorer'; // 'explorer' | 'search' | 'history' | 'preview' | 'runner'
  /** @type {OpenTab[]} */
  const tabs = [];
  /** @type {OpenTab | null} */
  let activeTab = null;
  /** @type {string[]} */
  let activeBlobUrls = [];
  let isSplit = false;
  let cursorInfo = { line: 1, col: 1 };

  // Main UI Containers
  const main = h('div', { class: 'nx-code-main' });
  const activityBar = h('div', { class: 'nx-code-activity-bar' });
  const sidebar = h('div', { class: 'nx-code-sidebar' });
  const sidebarHeader = h('div', { class: 'nx-code-sidebar-header' });
  const sidebarTitle = h('span', { text: t('explorer.title') });
  const sidebarActions = h('div', { class: 'nx-code-sidebar-actions' });
  sidebarHeader.append(sidebarTitle, sidebarActions);
  const sidebarContent = h('div', { class: 'nx-code-sidebar-content' });
  sidebar.append(sidebarHeader, sidebarContent);

  const editorArea = h('div', { class: 'nx-code-editor-area' });
  const tabsBar = h('div', { class: 'nx-code-tabs-bar' });
  const editorPanes = h('div', { class: 'nx-code-editor-panes' });
  const primaryPane = h('div', { class: 'nx-code-editor-pane' });
  const splitPane = h('div', { class: 'nx-code-editor-pane split', hidden: true });
  editorPanes.append(primaryPane, splitPane);

  // Status Bar
  const statusBar = h('div', { class: 'nx-code-status-bar' });
  const statusLeft = h('div', { class: 'nx-code-status-group' });
  const statusRight = h('div', { class: 'nx-code-status-group' });
  statusBar.append(statusLeft, statusRight);

  main.append(activityBar, sidebar, editorArea);
  editorArea.append(tabsBar, editorPanes);
  root.append(main, statusBar);
  container.append(root);

  // ─── Status Bar Updating ───────────────────────────────────────────
  function updateStatusBar() {
    statusLeft.replaceChildren(
      h('span', icon('folder', { size: 12 }), ` ${projectPath.split('/').pop() || projectPath}`),
      h('span', t('status.lineCol', { line: cursorInfo.line, col: cursorInfo.col })),
    );
    const langDesc = activeTab ? languageFor(activeTab.name) : null;
    statusRight.replaceChildren(
      h('span', t('status.spaces', { count: 2 })),
      h('span', t('status.encoding')),
      h('span', langDesc ? langDesc.name : t('status.plainText')),
    );
  }

  // ─── Tabs & Editor Management ──────────────────────────────────────
  /** @param {string} filePath */
  async function openFile(filePath) {
    const existing = tabs.find((t) => t.path === filePath);
    if (existing) {
      selectTab(existing);
      return;
    }

    try {
      const content = await fs.readFile(filePath, { as: 'text' });
      if (typeof content !== 'string') {
        notify({ title: t('messages.cannotReadBinary'), level: 'warning' });
        return;
      }
      const name = filePath.split('/').pop() || filePath;
      /** @type {OpenTab} */
      const tab = {
        path: filePath,
        name,
        content,
        isDirty: false,
      };

      tab.editor = createCodeEditor({
        text: content,
        name,
        onUpdate: (u) => {
          if (u.docChanged) {
            tab.isDirty = true;
            renderTabs();
          }
          cursorInfo = { line: u.line, col: u.column };
          updateStatusBar();
        },
        onSave: () => saveActiveFile(),
      });

      tabs.push(tab);
      renderTabs();
      selectTab(tab);
    } catch (err) {
      notify({ title: String(err), level: 'error' });
    }
  }

  /** @param {OpenTab} tab */
  function selectTab(tab) {
    activeTab = tab;
    primaryPane.replaceChildren(tab.editor.host);
    tab.editor.focus();
    renderTabs();
    updateStatusBar();
  }

  /** @param {OpenTab} tab */
  function closeTab(tab) {
    const idx = tabs.indexOf(tab);
    if (idx === -1) return;
    tab.editor?.destroy?.();
    tabs.splice(idx, 1);
    if (activeTab === tab) {
      activeTab = tabs[Math.max(0, idx - 1)] || null;
      if (activeTab) {
        selectTab(activeTab);
      } else {
        primaryPane.replaceChildren();
      }
    }
    renderTabs();
    updateStatusBar();
  }

  function renderTabs() {
    tabsBar.replaceChildren();
    for (const tab of tabs) {
      const tabEl = h(
        'div',
        {
          class: `nx-code-tab ${tab === activeTab ? 'active' : ''}`,
          title: tab.path,
          onclick: () => selectTab(tab),
        },
        h('span', tab.name),
        tab.isDirty ? h('span', { class: 'nx-code-tab-dirty' }) : null,
        h(
          'button',
          {
            class: 'nx-code-tab-close',
            title: t('tabs.close'),
            onclick: (/** @type {MouseEvent} */ e) => {
              e.stopPropagation();
              closeTab(tab);
            },
          },
          icon('x', { size: 12 }),
        ),
      );
      tabsBar.append(tabEl);
    }

    // Split Editor Toggle button
    const splitBtn = h(
      'button',
      {
        class: 'nx-button ghost small',
        style: 'margin-left: auto; margin-right: 8px;',
        title: isSplit ? t('tabs.unsplit') : t('tabs.split'),
        onclick: () => toggleSplit(),
      },
      icon('layout-split', { size: 14 }),
    );
    tabsBar.append(splitBtn);
  }

  function toggleSplit() {
    isSplit = !isSplit;
    splitPane.hidden = !isSplit;
    if (isSplit && activeTab) {
      const splitViewer = createDiffViewer({
        oldText: activeTab.content,
        newText: activeTab.editor.text,
        mode: 'inline',
      });
      splitPane.replaceChildren(splitViewer.root);
    } else {
      splitPane.replaceChildren();
    }
  }

  async function saveActiveFile() {
    if (!activeTab) return;
    const currentText = activeTab.editor.text;
    await fs.writeFile(activeTab.path, currentText);
    activeTab.content = currentText;
    activeTab.isDirty = false;
    renderTabs();

    // Auto-take snapshot
    const openFiles = tabs.map((t) => ({ path: t.path, content: t.editor.text }));
    await takeSnapshot(ctx.storage, projectPath, openFiles);

    notify({
      title: t('messages.saved', { name: activeTab.name }),
      level: 'success',
    });
  }

  // ─── Activity Bar & Sidebar Views ──────────────────────────────────
  const activities = [
    { id: 'explorer', icon: 'folder', title: t('activity.explorer') },
    { id: 'search', icon: 'search', title: t('activity.search') },
    { id: 'history', icon: 'clock', title: t('activity.history') },
    { id: 'preview', icon: 'globe', title: t('activity.preview') },
    { id: 'runner', icon: 'play', title: t('activity.runner') },
  ];

  for (const act of activities) {
    const btn = h(
      'button',
      {
        class: `nx-code-activity-btn ${act.id === activeActivity ? 'active' : ''}`,
        title: act.title,
        onclick: () => switchActivity(act.id),
      },
      icon(act.icon, { size: 18 }),
    );
    activityBar.append(btn);
  }

  function switchActivity(/** @type {string} */ id) {
    activeActivity = id;
    const buttons = activityBar.querySelectorAll('.nx-code-activity-btn');
    activities.forEach((act, idx) => {
      buttons[idx].classList.toggle('active', act.id === id);
    });

    sidebarActions.replaceChildren();
    if (id === 'explorer') renderExplorerView();
    else if (id === 'search') renderSearchView();
    else if (id === 'history') renderHistoryView();
    else if (id === 'preview') renderPreviewView();
    else if (id === 'runner') renderRunnerView();
  }

  // ─── 1. Explorer View ──────────────────────────────────────────────
  async function renderExplorerView() {
    sidebarTitle.textContent = t('explorer.title');
    sidebarActions.replaceChildren(
      h(
        'button',
        {
          class: 'nx-button ghost small icon-only',
          title: t('explorer.newFile'),
          onclick: () => promptNewFile(),
        },
        icon('file-plus', { size: 14 }),
      ),
      h(
        'button',
        {
          class: 'nx-button ghost small icon-only',
          title: t('explorer.newFolder'),
          onclick: () => promptNewFolder(),
        },
        icon('folder-plus', { size: 14 }),
      ),
      h(
        'button',
        {
          class: 'nx-button ghost small icon-only',
          title: t('explorer.refresh'),
          onclick: () => renderExplorerView(),
        },
        icon('refresh', { size: 14 }),
      ),
    );

    sidebarContent.replaceChildren(h('div', { style: 'padding: 12px; color: var(--text-2);' }, 'Loading files...'));
    const tree = await buildTree(fs, projectPath);

    sidebarContent.replaceChildren();
    if (!tree.children || tree.children.length === 0) {
      sidebarContent.append(
        h(
          'div',
          { style: 'padding: 12px; color: var(--text-2); font-size: 12px;' },
          t('explorer.noFiles'),
          h('div', { style: 'margin-top: 8px;' }, [
            h(
              'button',
              {
                class: 'nx-button primary small',
                onclick: async () => {
                  await commands['code.newProject'](ctx);
                  await renderExplorerView();
                },
              },
              t('preview.createTemplate'),
            ),
          ]),
        ),
      );
      return;
    }

    /**
     * @param {import('./vfs-helper.js').TreeNode} node
     * @param {number} depth
     */
    function renderTreeNode(node, depth = 0) {
      let isExpanded = true;
      const itemEl = h(
        'div',
        {
          class: `nx-code-tree-item ${activeTab?.path === node.path ? 'selected' : ''}`,
          onclick: (/** @type {MouseEvent} */ e) => {
            e.stopPropagation();
            if (node.type === 'folder') {
              isExpanded = !isExpanded;
              if (childContainer) childContainer.hidden = !isExpanded;
              arrowIcon.replaceWith(
                (arrowIcon = icon(isExpanded ? 'chevron-down' : 'chevron-right', {
                  size: 12,
                })),
              );
            } else {
              openFile(node.path);
            }
          },
        },
        Array.from({ length: depth }).map(() => h('span', { class: 'nx-code-tree-indent' })),
      );

      let arrowIcon =
        node.type === 'folder'
          ? icon(isExpanded ? 'chevron-down' : 'chevron-right', { size: 12 })
          : h('span', { style: 'width: 12px; display: inline-block;' });

      const nodeIcon = icon(node.type === 'folder' ? 'folder' : 'file-code', { size: 14 });
      itemEl.append(arrowIcon, nodeIcon, h('span', node.name));

      // Right action buttons (delete)
      const delBtn = h(
        'button',
        {
          class: 'nx-button ghost small icon-only',
          style: 'margin-left: auto; opacity: 0.6;',
          title: t('explorer.delete'),
          onclick: async (/** @type {MouseEvent} */ e) => {
            e.stopPropagation();
            if (confirm(t('explorer.confirmDelete', { name: node.name }))) {
              await fs.delete(node.path).catch(() => {});
              renderExplorerView();
            }
          },
        },
        icon('trash', { size: 12 }),
      );
      itemEl.append(delBtn);

      sidebarContent.append(itemEl);

      let childContainer = /** @type {HTMLElement | null} */ (null);
      if (node.type === 'folder' && node.children) {
        childContainer = h('div');
        for (const child of node.children) {
          childContainer.append(renderTreeNode(child, depth + 1));
        }
        sidebarContent.append(childContainer);
      }

      return itemEl;
    }

    for (const child of tree.children) {
      renderTreeNode(child, 0);
    }
  }

  async function promptNewFile() {
    const name = prompt(t('explorer.newFilePrompt'), 'index.js');
    if (!name) return;
    const newPath = `${projectPath}/${name.replace(/^\/+/, '')}`;
    await fs.writeFile(newPath, '');
    await renderExplorerView();
    await openFile(newPath);
  }

  async function promptNewFolder() {
    const name = prompt(t('explorer.newFolderPrompt'), 'src');
    if (!name) return;
    const newPath = `${projectPath}/${name.replace(/^\/+/, '')}`;
    await fs.mkdir(newPath);
    await renderExplorerView();
  }

  // ─── 2. Search View ────────────────────────────────────────────────
  function renderSearchView() {
    sidebarTitle.textContent = t('search.title');
    const container = h('div', { class: 'nx-code-search-pane' });
    const input = h('input', {
      class: 'nx-input',
      placeholder: t('search.placeholder'),
      autofocus: true,
    });
    const optionsRow = h('div', { class: 'nx-code-search-options' });
    const matchCaseBtn = h('button', { class: 'nx-button ghost small' }, 'Aa');
    const matchWordBtn = h('button', { class: 'nx-button ghost small' }, '\\b');
    const regexBtn = h('button', { class: 'nx-button ghost small' }, '.*');
    optionsRow.append(matchCaseBtn, matchWordBtn, regexBtn);

    let matchCase = false;
    let matchWord = false;
    let useRegex = false;

    matchCaseBtn.onclick = () => {
      matchCase = !matchCase;
      matchCaseBtn.classList.toggle('primary', matchCase);
      doSearch();
    };
    matchWordBtn.onclick = () => {
      matchWord = !matchWord;
      matchWordBtn.classList.toggle('primary', matchWord);
      doSearch();
    };
    regexBtn.onclick = () => {
      useRegex = !useRegex;
      regexBtn.classList.toggle('primary', useRegex);
      doSearch();
    };

    const resultsContainer = h('div', { class: 'nx-code-search-results' });
    container.append(input, optionsRow, resultsContainer);
    sidebarContent.replaceChildren(container);

    let searchTimer = /** @type {ReturnType<typeof setTimeout> | null} */ (null);
    input.addEventListener('input', () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(doSearch, 300);
    });

    async function doSearch() {
      const q = input.value.trim();
      if (!q) {
        resultsContainer.replaceChildren();
        return;
      }
      resultsContainer.replaceChildren(
        h('div', { style: 'color: var(--text-2); font-size: 12px;' }, t('search.searching')),
      );
      const results = await searchFiles(fs, projectPath, q, {
        matchCase,
        matchWholeWord: matchWord,
        useRegex,
      });

      resultsContainer.replaceChildren();
      if (results.length === 0) {
        resultsContainer.append(h('div', { style: 'color: var(--text-2); font-size: 12px;' }, t('search.noResults')));
        return;
      }

      const filesCount = new Set(results.map((r) => r.filePath)).size;
      resultsContainer.append(
        h(
          'div',
          { style: 'color: var(--text-2); font-size: 11px; margin-bottom: 6px;' },
          t('search.resultsFound', { count: results.length, files: filesCount }),
        ),
      );

      for (const res of results) {
        const item = h(
          'div',
          {
            class: 'nx-code-search-item',
            onclick: async () => {
              await openFile(res.filePath);
              activeTab?.editor?.goToLine?.(res.line);
            },
          },
          h('div', { class: 'nx-code-search-item-header' }, `${res.fileName}:${res.line}`),
          h('div', { class: 'nx-code-search-item-line' }, res.lineText),
        );
        resultsContainer.append(item);
      }
    }
  }

  // ─── 3. Local History View ─────────────────────────────────────────
  async function renderHistoryView() {
    sidebarTitle.textContent = t('history.title');
    sidebarContent.replaceChildren(h('div', { style: 'padding: 12px; color: var(--text-2);' }, 'Loading history...'));

    const snapshots = await loadSnapshots(ctx.storage, projectPath);
    sidebarContent.replaceChildren();

    if (snapshots.length === 0) {
      sidebarContent.append(
        h('div', { style: 'padding: 12px; color: var(--text-2); font-size: 12px;' }, t('history.noSnapshots')),
      );
      return;
    }

    for (const snap of snapshots) {
      const dateStr = new Date(snap.timestamp).toLocaleTimeString();
      const snapItem = h(
        'div',
        {
          class: 'nx-code-search-item',
          style: 'margin: 6px 12px;',
          onclick: () => {
            // View diff with active file if present in snapshot
            if (!activeTab) return;
            const snapFile = snap.files.find((f) => f.path === activeTab?.path);
            if (snapFile) {
              const diffViewer = createDiffViewer({
                oldText: snapFile.content,
                newText: activeTab.editor.text,
                mode: 'split',
              });
              primaryPane.replaceChildren(diffViewer.root);
            }
          },
        },
        h('div', { class: 'nx-code-search-item-header' }, t('history.snapshotAt', { time: dateStr })),
        h('div', { style: 'font-size: 11px; color: var(--text-2);' }, `${snap.files.length} file(s) recorded`),
      );
      sidebarContent.append(snapItem);
    }
  }

  // ─── 4. Web Preview View ───────────────────────────────────────────
  function renderPreviewView() {
    sidebarTitle.textContent = t('preview.title');
    const container = h('div', { style: 'padding: 12px; display: flex; flex-direction: column; gap: 8px;' });

    const runBtn = h(
      'button',
      { class: 'nx-button primary small', onclick: () => triggerWebPreview() },
      icon('play', { size: 14 }),
      t('preview.run'),
    );

    const refreshBtn = h(
      'button',
      { class: 'nx-button ghost small', onclick: () => triggerWebPreview() },
      icon('refresh', { size: 14 }),
      t('preview.refresh'),
    );

    container.append(runBtn, refreshBtn);
    sidebarContent.replaceChildren(container);

    triggerWebPreview();
  }

  async function triggerWebPreview() {
    for (const url of activeBlobUrls) {
      URL.revokeObjectURL(url);
    }
    activeBlobUrls = [];

    try {
      const bundle = await bundleWebProject(fs, projectPath);
      activeBlobUrls = bundle.blobUrls;

      const previewPane = h('div', { class: 'nx-code-preview-pane' });
      const iframe = h('iframe', {
        class: 'nx-code-preview-iframe',
        sandbox: 'allow-scripts',
        title: 'Nexus Code Live Preview',
      });

      // Console
      const consolePane = h('div', { class: 'nx-code-console-pane' });
      const consoleHeader = h(
        'div',
        { class: 'nx-code-console-header' },
        h('span', 'Preview Console'),
        h('button', { class: 'nx-button ghost small', onclick: () => consoleLogs.replaceChildren() }, 'Clear'),
      );
      const consoleLogs = h('div', { class: 'nx-code-console-logs' });
      consolePane.append(consoleHeader, consoleLogs);

      previewPane.append(iframe, consolePane);
      primaryPane.replaceChildren(previewPane);

      // Listen for console messages from iframe
      const msgHandler = (/** @type {MessageEvent} */ e) => {
        if (e.data && e.data.source === 'nexus-preview') {
          const logEl = h(
            'div',
            { class: `nx-code-log-entry ${e.data.type}` },
            h('span', `[${e.data.type.toUpperCase()}]`),
            h('span', (e.data.args || []).join(' ')),
          );
          consoleLogs.append(logEl);
          consoleLogs.scrollTop = consoleLogs.scrollHeight;
        }
      };
      window.addEventListener('message', msgHandler);
      iframe.src = `data:text/html;charset=utf-8,${encodeURIComponent(bundle.html)}`;
    } catch (err) {
      primaryPane.replaceChildren(
        h(
          'div',
          { style: 'padding: 24px; color: var(--danger);' },
          String(err.message || err),
          h('div', { style: 'margin-top: 12px;' }, [
            h(
              'button',
              {
                class: 'nx-button primary small',
                onclick: async () => {
                  await commands['code.newProject'](ctx);
                  await triggerWebPreview();
                },
              },
              t('preview.createTemplate'),
            ),
          ]),
        ),
      );
    }
  }

  // ─── 5. Node-Lite JavaScript Runner View ────────────────────────────
  function renderRunnerView() {
    sidebarTitle.textContent = t('runner.title');
    const container = h('div', { style: 'padding: 12px; display: flex; flex-direction: column; gap: 8px;' });

    const runBtn = h(
      'button',
      { class: 'nx-button primary small', onclick: () => runActiveJsInWorker() },
      icon('play', { size: 14 }),
      t('runner.run'),
    );

    container.append(runBtn);
    sidebarContent.replaceChildren(container);
  }

  function runActiveJsInWorker() {
    if (!activeTab || !activeTab.name.endsWith('.js')) {
      notify({ title: t('runner.noJsActive'), level: 'warning' });
      return;
    }

    const code = activeTab.editor.text;
    const runnerPane = h('div', { class: 'nx-code-preview-pane' });
    const consoleLogs = h('div', { class: 'nx-code-console-logs', style: 'height: 100%;' });
    runnerPane.append(consoleLogs);
    primaryPane.replaceChildren(runnerPane);

    consoleLogs.append(h('div', { style: 'color: var(--accent);' }, t('runner.running')));

    const worker = new Worker(new URL('./runner.worker.js', import.meta.url), { type: 'module' });
    worker.postMessage({ id: 'run_1', code });

    worker.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'done') {
        consoleLogs.replaceChildren();
        for (const log of data.logs || []) {
          consoleLogs.append(
            h(
              'div',
              { class: `nx-code-log-entry ${log.level}` },
              h('span', `[${log.level.toUpperCase()}]`),
              h('span', log.message),
            ),
          );
        }
        if (data.error) {
          consoleLogs.append(h('div', { class: 'nx-code-log-entry error' }, `Error: ${data.error.message}`));
        } else if (data.result !== null) {
          consoleLogs.append(h('div', { style: 'color: var(--success);' }, `Return => ${data.result}`));
        }
        consoleLogs.append(
          h('div', { style: 'color: var(--text-3); margin-top: 8px;' }, t('runner.finished', { ms: data.duration })),
        );
      }
      worker.terminate();
    };
  }

  // ─── Quick Open Modal (`Mod+P`) ─────────────────────────────────────
  async function showQuickOpen() {
    const tree = await buildTree(fs, projectPath);
    const files = flattenFilePaths(tree);

    const backdrop = h('div', { class: 'nx-code-modal-backdrop' });
    const modal = h('div', { class: 'nx-code-modal' });
    const input = h('input', {
      class: 'nx-code-modal-input',
      placeholder: t('quickOpen.placeholder'),
      autofocus: true,
    });
    const list = h('div', { class: 'nx-code-modal-list' });
    modal.append(input, list);
    backdrop.append(modal);
    root.append(backdrop);

    let activeIdx = 0;
    /** @type {string[]} */
    let filtered = [...files];

    function renderList() {
      list.replaceChildren();
      filtered.forEach((file, idx) => {
        const item = h(
          'div',
          {
            class: `nx-code-modal-item ${idx === activeIdx ? 'active' : ''}`,
            onclick: () => {
              backdrop.remove();
              openFile(file);
            },
          },
          h('span', file.split('/').pop() || file),
          h('span', { style: 'font-size: 11px; color: var(--text-3);' }, file.replace(projectPath, '')),
        );
        list.append(item);
      });
    }

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      filtered = files.filter((f) => f.toLowerCase().includes(q));
      activeIdx = 0;
      renderList();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        backdrop.remove();
      } else if (e.key === 'ArrowDown') {
        activeIdx = Math.min(filtered.length - 1, activeIdx + 1);
        renderList();
      } else if (e.key === 'ArrowUp') {
        activeIdx = Math.max(0, activeIdx - 1);
        renderList();
      } else if (e.key === 'Enter') {
        if (filtered[activeIdx]) {
          backdrop.remove();
          openFile(filtered[activeIdx]);
        }
      }
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    renderList();
  }

  // ─── Go to Line Modal (`Mod+G`) ─────────────────────────────────────
  function showGoToLine() {
    if (!activeTab) return;
    const lineStr = prompt(t('goToLine.title'), '1');
    if (lineStr) {
      const lineNum = parseInt(lineStr, 10);
      if (!isNaN(lineNum)) {
        activeTab.editor.goToLine(lineNum);
      }
    }
  }

  // ─── Global Keydown Shortcuts ───────────────────────────────────────
  const keyHandler = (/** @type {KeyboardEvent} */ e) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 's') {
        e.preventDefault();
        saveActiveFile();
      } else if (e.key === 'p') {
        e.preventDefault();
        showQuickOpen();
      } else if (e.key === 'g') {
        e.preventDefault();
        showGoToLine();
      }
    }
  };
  root.addEventListener('keydown', keyHandler);

  // Initialize
  await renderExplorerView();
  updateStatusBar();

  // Try opening index.html or first file automatically
  const tree = await buildTree(fs, projectPath);
  const allFiles = flattenFilePaths(tree);
  const firstIndex = allFiles.find((f) => f.endsWith('index.html')) || allFiles[0];
  if (firstIndex) {
    await openFile(firstIndex);
  }

  return {
    destroy() {
      root.removeEventListener('keydown', keyHandler);
      for (const url of activeBlobUrls) {
        URL.revokeObjectURL(url);
      }
      for (const tab of tabs) {
        tab.editor?.destroy?.();
      }
      root.remove();
    },
  };
}
