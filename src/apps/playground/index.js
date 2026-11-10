// @ts-check
import { h, icon } from '../../ui/dom.js';
import { buildPreviewDocument, TEMPLATES } from './templates.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v) => ctx.i18n.t(k, v);
  const root = h('div', { class: 'nx-playground-app' });

  let currentTemplate = TEMPLATES.blank;
  let htmlCode = currentTemplate.html;
  let cssCode = currentTemplate.css;
  let jsCode = currentTemplate.js;
  let layoutMode = 'side-by-side'; // 'side-by-side' | 'stacked' | 'preview-only' | 'editor-only'
  /** @type {ReturnType<typeof setTimeout> | null} */
  let debounceTimer = null;

  // Toolbar
  const toolbar = h('div', { class: 'nx-playground-toolbar' });
  const runBtn = h('button', { class: 'nx-button primary small' }, icon('play', { size: 14 }), t('toolbar.run'));

  // Templates select
  const templateSelect = h('select', { class: 'nx-select' });
  for (const [key, item] of Object.entries(TEMPLATES)) {
    templateSelect.append(h('option', { value: key }, item.name));
  }

  // Layout select
  const layoutSelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'side-by-side' }, t('toolbar.sideBySide')),
    h('option', { value: 'stacked' }, t('toolbar.stacked')),
    h('option', { value: 'preview-only' }, t('toolbar.previewOnly')),
    h('option', { value: 'editor-only' }, t('toolbar.editorOnly')),
  );

  const exportBtn = h(
    'button',
    { class: 'nx-button ghost small' },
    icon('download', { size: 14 }),
    t('toolbar.exportHtml'),
  );
  const importBtn = h(
    'button',
    { class: 'nx-button ghost small' },
    icon('upload', { size: 14 }),
    t('toolbar.importHtml'),
  );
  const saveBtn = h('button', { class: 'nx-button ghost small' }, icon('check', { size: 14 }), t('toolbar.save'));
  const shareBtn = h('button', { class: 'nx-button ghost small' }, icon('share', { size: 14 }), t('toolbar.share'));

  const leftToolbar = h(
    'div',
    { style: 'display: flex; gap: 6px; align-items: center;' },
    runBtn,
    templateSelect,
    layoutSelect,
  );
  const rightToolbar = h(
    'div',
    { style: 'display: flex; gap: 6px; align-items: center;' },
    exportBtn,
    importBtn,
    saveBtn,
    shareBtn,
  );
  toolbar.append(leftToolbar, rightToolbar);

  // Body
  const body = h('div', { class: `nx-playground-body ${layoutMode}` });

  // Editors Pane
  const editorsPane = h('div', { class: 'nx-playground-editors' });
  const editorTabs = h('div', { class: 'nx-playground-editor-tabs' });

  const htmlTab = h('button', { class: 'nx-playground-editor-tab active' }, 'HTML');
  const cssTab = h('button', { class: 'nx-playground-editor-tab' }, 'CSS');
  const jsTab = h('button', { class: 'nx-playground-editor-tab' }, 'JavaScript');
  editorTabs.append(htmlTab, cssTab, jsTab);

  // Editors content
  const htmlPanel = h('div', { class: 'nx-playground-editor-panel' });
  const htmlTextarea = h('textarea', { class: 'nx-playground-textarea', value: htmlCode, spellcheck: 'false' });
  htmlPanel.append(htmlTextarea);

  const cssPanel = h('div', { class: 'nx-playground-editor-panel', hidden: true });
  const cssTextarea = h('textarea', { class: 'nx-playground-textarea', value: cssCode, spellcheck: 'false' });
  cssPanel.append(cssTextarea);

  const jsPanel = h('div', { class: 'nx-playground-editor-panel', hidden: true });
  const jsTextarea = h('textarea', { class: 'nx-playground-textarea', value: jsCode, spellcheck: 'false' });
  jsPanel.append(jsTextarea);

  editorsPane.append(editorTabs, htmlPanel, cssPanel, jsPanel);

  function switchEditorTab(/** @type {string} */ lang) {
    htmlTab.classList.toggle('active', lang === 'html');
    cssTab.classList.toggle('active', lang === 'css');
    jsTab.classList.toggle('active', lang === 'js');

    htmlPanel.hidden = lang !== 'html';
    cssPanel.hidden = lang !== 'css';
    jsPanel.hidden = lang !== 'js';
  }

  htmlTab.addEventListener('click', () => switchEditorTab('html'));
  cssTab.addEventListener('click', () => switchEditorTab('css'));
  jsTab.addEventListener('click', () => switchEditorTab('js'));

  // Preview Pane
  const previewPane = h('div', { class: 'nx-playground-preview-container' });
  const iframe = h('iframe', {
    class: 'nx-playground-iframe',
    sandbox: 'allow-scripts',
    title: 'Playground Preview',
  });

  // Console Panel
  const consolePanel = h('div', { class: 'nx-playground-console' });
  const consoleHeader = h(
    'div',
    { class: 'nx-playground-console-header' },
    h('span', {}, t('console.title')),
    h('button', { class: 'nx-button ghost small', style: 'padding: 2px 6px; font-size: 10px;' }, t('console.clear')),
  );
  const consoleLogs = h('div', { class: 'nx-playground-console-logs' });
  const consoleInputBar = h('div', { class: 'nx-playground-console-input-bar' });
  const promptSym = h('span', { class: 'nx-playground-console-prompt' }, '>');
  const consoleInput = h('input', {
    type: 'text',
    class: 'nx-playground-console-input',
    placeholder: t('console.placeholder'),
    spellcheck: 'false',
  });
  consoleInputBar.append(promptSym, consoleInput);
  consolePanel.append(consoleHeader, consoleLogs, consoleInputBar);

  consoleHeader.querySelector('button')?.addEventListener('click', () => {
    consoleLogs.replaceChildren();
  });

  consoleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && consoleInput.value.trim()) {
      const expr = consoleInput.value.trim();
      addConsoleLine('log', `> ${expr}`);
      iframe.contentWindow?.postMessage({ type: 'EVAL_EXPR', code: expr }, '*');
      consoleInput.value = '';
    }
  });

  previewPane.append(iframe, consolePanel);
  body.append(editorsPane, previewPane);
  root.append(toolbar, body);
  container.append(root);

  function addConsoleLine(/** @type {string} */ level, /** @type {string} */ text) {
    const line = h('div', { class: `nx-console-line ${level}` }, text);
    consoleLogs.append(line);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  // Listen to console messages from sandboxed iframe
  const messageHandler = (/** @type {MessageEvent} */ e) => {
    if (e.data && e.data.type === 'CONSOLE_LOG') {
      const text = Array.isArray(e.data.args) ? e.data.args.join(' ') : String(e.data.args);
      addConsoleLine(e.data.level || 'log', text);
    }
  };
  window.addEventListener('message', messageHandler);

  function triggerPreview() {
    htmlCode = htmlTextarea.value;
    cssCode = cssTextarea.value;
    jsCode = jsTextarea.value;

    consoleLogs.replaceChildren();
    const doc = buildPreviewDocument(htmlCode, cssCode, jsCode);
    iframe.src = `data:text/html;charset=utf-8,${encodeURIComponent(doc)}`;
  }

  function scheduleDebouncedPreview() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      triggerPreview();
    }, 500);
  }

  htmlTextarea.addEventListener('input', scheduleDebouncedPreview);
  cssTextarea.addEventListener('input', scheduleDebouncedPreview);
  jsTextarea.addEventListener('input', scheduleDebouncedPreview);

  runBtn.addEventListener('click', triggerPreview);

  // Template selection
  templateSelect.addEventListener('change', () => {
    // @ts-ignore
    const tKey = templateSelect.value;
    // @ts-ignore
    const chosen = TEMPLATES[tKey];
    if (chosen) {
      currentTemplate = chosen;
      htmlTextarea.value = chosen.html;
      cssTextarea.value = chosen.css;
      jsTextarea.value = chosen.js;
      triggerPreview();
    }
  });

  // Layout selection
  layoutSelect.addEventListener('change', () => {
    // @ts-ignore
    layoutMode = layoutSelect.value;
    body.className = `nx-playground-body ${layoutMode}`;
  });

  // Mod+Enter shortcut to run
  const keyHandler = (/** @type {KeyboardEvent} */ e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      triggerPreview();
    }
  };
  root.addEventListener('keydown', keyHandler);

  // Export single HTML
  exportBtn.addEventListener('click', () => {
    const doc =
      `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>Nexus Playground Export</title>\n  <style>\n${cssTextarea.value}\n  </style>\n</head>\n<body>\n${htmlTextarea.value}\n  <script>\n${jsTextarea.value}\n  <` +
      `/script>\n</body>\n</html>`;
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playground-export.html';
    a.click();
    (ctx.notify || ctx.notifications?.notify)?.({ title: t('messages.exported'), level: 'success' });
  });

  // Import HTML
  importBtn.addEventListener('click', async () => {
    try {
      const file = await ctx.dialog?.openFile?.({ filter: '.html' });
      if (file?.path) {
        const content = await ctx.vfs?.readText?.(file.path);
        if (content) {
          // Extract style
          const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
          const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
          let bodyContent = content
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
          const bodyTagMatch = bodyContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          if (bodyTagMatch) bodyContent = bodyTagMatch[1];

          htmlTextarea.value = bodyContent.trim();
          cssTextarea.value = (styleMatch ? styleMatch[1] : '').trim();
          jsTextarea.value = (scriptMatch ? scriptMatch[1] : '').trim();
          triggerPreview();
        }
      }
    } catch {
      // cancelled
    }
  });

  // Save project in VFS
  saveBtn.addEventListener('click', async () => {
    try {
      const name = prompt('Project name:', 'MyPlayground') || 'MyPlayground';
      const dir = `/User/Projects/${name}`;
      await ctx.vfs?.writeText?.(`${dir}/index.html`, htmlTextarea.value);
      await ctx.vfs?.writeText?.(`${dir}/style.css`, cssTextarea.value);
      await ctx.vfs?.writeText?.(`${dir}/script.js`, jsTextarea.value);
      ctx.notifications?.notify?.({ title: t('messages.saved', { name }), level: 'success' });
    } catch {
      // ignore
    }
  });

  // Share URL
  shareBtn.addEventListener('click', async () => {
    const payload = JSON.stringify({ h: htmlTextarea.value, c: cssTextarea.value, j: jsTextarea.value });
    const hash = encodeURIComponent(btoa(unescape(encodeURIComponent(payload))));
    const shareUrl = `${window.location.origin}${window.location.pathname}#playground=${hash}`;
    await navigator.clipboard.writeText(shareUrl);
    ctx.notifications?.notify?.({ title: t('messages.copiedUrl'), level: 'info' });
  });

  // Initial run
  triggerPreview();

  return () => {
    window.removeEventListener('message', messageHandler);
    root.removeEventListener('keydown', keyHandler);
    root.remove();
  };
}

export const commands = {
  'playground.open': (ctx, args) => ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.playground', args }),
  'playground.new': (ctx) => ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.playground' }),
};

export const terminal = {
  playground: async (ctx, io) => {
    const template = io?.args?.[0];
    await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.playground', args: { template } });
    return 0;
  },
};
