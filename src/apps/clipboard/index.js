// @ts-check
// Nexus Clipboard Manager: history of copied text, pinned clips, and snippets with dynamic templates.
import { h, icon, replace } from '../../ui/dom.js';
import { expandSnippet, filterEntries, formatClipPreview, formatRelativeTime } from './model.js';
import './styles.css';

const btn = (
  /** @type {{ class?: string, title?: string, onClick?: (e: any) => void }} */ { class: cls, title, onClick, ...rest },
  /** @type {any[]} */ ...children
) => h('button', { type: 'button', class: cls, title, onclick: onClick, ...rest }, ...children);

/**
 * @typedef {object} PinnedClip
 * @property {string} id
 * @property {string} text
 * @property {'text' | 'image'} [kind]
 * @property {string} [app]
 * @property {number} at
 * @property {number} pinnedAt
 */

/**
 * @typedef {object} SnippetItem
 * @property {string} id
 * @property {string} title
 * @property {string} body
 * @property {string} [shortcut]
 * @property {number} createdAt
 */

/**
 * Terminal command handler: `clipboard [list | clear | copy <id|index> | snippet <title>]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async clipboard(ctx, io) {
    const sub = io.args[0] ?? 'list';
    const snippetsCol = /** @type {import('../../kernel/types').Collection<SnippetItem>} */ (
      ctx.storage.collection('snippets')
    );

    if (sub === 'list') {
      const history = ctx.clipboard?.history?.() ?? [];
      if (!history.length) {
        io.out(`${ctx.i18n.t('terminal.empty')}\n`);
        return 0;
      }
      io.out(`--- Clipboard History (${history.length}) ---\n`);
      history.slice(0, 20).forEach((entry, i) => {
        const preview = formatClipPreview(entry.text, 60);
        io.out(`[${i + 1}] (${entry.app || 'system'}) ${preview}\n`);
      });
      return 0;
    }

    if (sub === 'clear') {
      await ctx.clipboard?.clearHistory?.();
      io.out(`${ctx.i18n.t('terminal.cleared')}\n`);
      return 0;
    }

    if (sub === 'copy') {
      const target = io.args[1];
      if (!target) {
        io.err('Usage: clipboard copy <index|id>\n');
        return 1;
      }
      const history = ctx.clipboard?.history?.() ?? [];
      const idx = parseInt(target, 10);
      const entry =
        !isNaN(idx) && idx >= 1 && idx <= history.length ? history[idx - 1] : history.find((h) => h.id === target);
      if (!entry?.text) {
        io.err(`${ctx.i18n.t('terminal.notFound')}\n`);
        return 1;
      }
      await ctx.clipboard.writeText(entry.text);
      io.out(`${ctx.i18n.t('terminal.copied')}\n`);
      return 0;
    }

    if (sub === 'snippet') {
      const title = io.args.slice(1).join(' ').trim();
      if (!title) {
        io.err('Usage: clipboard snippet <title>\n');
        return 1;
      }
      const snippets = await snippetsCol.all();
      const snip = snippets.find((s) => s.title.toLowerCase() === title.toLowerCase());
      if (!snip) {
        io.err(`${ctx.i18n.t('terminal.notFound')}\n`);
        return 1;
      }
      const history = ctx.clipboard?.history?.() ?? [];
      const current = history.length ? history[0].text : '';
      const expanded = expandSnippet(snip.body, { clipboard: current, now: new Date() });
      await ctx.clipboard.writeText(expanded);
      io.out(`${ctx.i18n.t('terminal.snippetCopied', { title: snip.title })}\n`);
      return 0;
    }

    io.out('Usage: clipboard [list | clear | copy <id|index> | snippet <title>]\n');
    return 0;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'clipboard.clear': async (ctx) => {
    await ctx.clipboard.clearHistory();
  },
  'clipboard.copyLatest': async (ctx) => {
    const history = ctx.clipboard.history();
    if (history.length && history[0].text) {
      await ctx.clipboard.writeText(history[0].text);
    }
  },
};

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(root, ctx) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ vars) => ctx.i18n.t(key, vars);
  const pinnedCol = /** @type {import('../../kernel/types').Collection<PinnedClip>} */ (
    ctx.storage.collection('pinned')
  );
  const snippetsCol = /** @type {import('../../kernel/types').Collection<SnippetItem>} */ (
    ctx.storage.collection('snippets')
  );

  /** @type {'history' | 'pinned' | 'snippets'} */
  let activeTab = 'history';
  let searchQuery = '';
  /** @type {SnippetItem | null} */
  let editingSnippet = null;
  let isEditingNew = false;

  const container = h('div', { class: 'nx-clipboard' });
  replace(root, container);

  async function render() {
    replace(container);

    const historyItems = ctx.clipboard.history();
    const pinnedItems = await pinnedCol.all();
    const snippetItems = await snippetsCol.all();

    const pinnedMap = new Map(pinnedItems.map((p) => [p.id, p]));

    // --- Header ---
    const header = h('div', { class: 'nx-cb-header' });

    const tabsRow = h(
      'div',
      { class: 'nx-cb-tabs' },
      btn(
        {
          class: `nx-cb-tab ${activeTab === 'history' ? 'is-active' : ''}`,
          onClick: () => {
            activeTab = 'history';
            render();
          },
        },
        icon('clipboard', 14),
        h('span', {}, `${t('tabs.history')} (${historyItems.length})`),
      ),
      btn(
        {
          class: `nx-cb-tab ${activeTab === 'pinned' ? 'is-active' : ''}`,
          onClick: () => {
            activeTab = 'pinned';
            render();
          },
        },
        icon('bookmark', 14),
        h('span', {}, `${t('tabs.pinned')} (${pinnedItems.length})`),
      ),
      btn(
        {
          class: `nx-cb-tab ${activeTab === 'snippets' ? 'is-active' : ''}`,
          onClick: () => {
            activeTab = 'snippets';
            render();
          },
        },
        icon('sparkles', 14),
        h('span', {}, `${t('tabs.snippets')} (${snippetItems.length})`),
      ),
    );

    const searchBar = h(
      'div',
      { class: 'nx-cb-search-bar' },
      h('span', { class: 'nx-cb-search-icon' }, icon('search', 14)),
      h('input', {
        type: 'search',
        class: 'nx-cb-search-input',
        placeholder: t('search.placeholder'),
        value: searchQuery,
        onInput: (/** @type {InputEvent} */ e) => {
          searchQuery = /** @type {HTMLInputElement} */ (e.target).value;
          renderList();
        },
      }),
    );

    header.append(tabsRow, searchBar);

    // --- Subbar ---
    const subbar = h('div', { class: 'nx-cb-subbar' });
    const countSpan = h('span', { class: 'nx-cb-count' });
    const subbarActions = h('div', { class: 'nx-cb-subbar-actions' });

    if (activeTab === 'history' && historyItems.length > 0) {
      subbarActions.append(
        btn(
          {
            class: 'nx-cb-btn nx-cb-btn-danger',
            onClick: async () => {
              const ok = await ctx.dialog.confirm(t('actions.clearConfirm'));
              if (ok) {
                await ctx.clipboard.clearHistory();
                render();
              }
            },
          },
          icon('trash', 13),
          t('actions.clear'),
        ),
      );
    } else if (activeTab === 'snippets') {
      subbarActions.append(
        btn(
          {
            class: 'nx-cb-btn nx-cb-btn-accent',
            onClick: () => {
              editingSnippet = {
                id: crypto.randomUUID(),
                title: '',
                body: '',
                shortcut: '',
                createdAt: Date.now(),
              };
              isEditingNew = true;
              renderModal();
            },
          },
          icon('plus', 13),
          t('actions.newSnippet'),
        ),
      );
    }

    subbar.append(countSpan, subbarActions);

    // --- Body ---
    const listContainer = h('div', { class: 'nx-cb-body' });

    function renderList() {
      replace(listContainer);

      if (activeTab === 'history') {
        const filtered = filterEntries(historyItems, searchQuery);
        countSpan.textContent = `${filtered.length} / ${historyItems.length}`;

        if (!filtered.length) {
          listContainer.append(
            h(
              'div',
              { class: 'nx-cb-empty' },
              h('div', { class: 'nx-cb-empty-icon' }, icon('clipboard', 40)),
              h('div', { class: 'nx-cb-empty-title' }, t('empty.history')),
              h('div', { class: 'nx-cb-empty-sub' }, t('empty.historySub')),
            ),
          );
          return;
        }

        for (const item of filtered) {
          const isPinned = pinnedMap.has(item.id);
          const card = h('div', { class: `nx-cb-card ${isPinned ? 'is-pinned' : ''}` });

          const cardHeader = h(
            'div',
            { class: 'nx-cb-card-header' },
            h(
              'div',
              { class: 'nx-cb-badge-group' },
              h('span', { class: 'nx-cb-badge' }, item.app || 'system'),
              isPinned
                ? h('span', { class: 'nx-cb-badge nx-cb-badge-pinned' }, icon('bookmark', 11), t('tabs.pinned'))
                : null,
            ),
            h('span', { class: 'nx-cb-time' }, formatRelativeTime(item.at)),
          );

          const content = h('div', { class: 'nx-cb-card-content' }, item.text || '');

          const cardFooter = h(
            'div',
            { class: 'nx-cb-card-footer' },
            h('span', { class: 'nx-cb-char-count' }, t('chars', { count: item.text?.length ?? 0 })),
            h(
              'div',
              { class: 'nx-cb-card-actions' },
              btn(
                {
                  class: 'nx-cb-btn nx-cb-btn-icon',
                  title: isPinned ? t('actions.unpin') : t('actions.pin'),
                  onClick: async () => {
                    if (isPinned) {
                      await pinnedCol.delete(item.id);
                    } else if (item.text) {
                      await pinnedCol.put({
                        id: item.id,
                        text: item.text,
                        kind: item.kind,
                        app: item.app,
                        at: item.at,
                        pinnedAt: Date.now(),
                      });
                    }
                    render();
                  },
                },
                icon('bookmark', 13),
              ),
              btn(
                {
                  class: 'nx-cb-btn nx-cb-btn-icon nx-cb-btn-danger',
                  title: t('actions.delete'),
                  onClick: async () => {
                    await ctx.clipboard.remove(item.id);
                    render();
                  },
                },
                icon('trash', 13),
              ),
              btn(
                {
                  class: 'nx-cb-btn nx-cb-btn-accent',
                  onClick: async (/** @type {MouseEvent} */ e) => {
                    if (item.text) {
                      await ctx.clipboard.writeText(item.text);
                      const btn = /** @type {HTMLButtonElement} */ (e.currentTarget);
                      const orig = btn.textContent;
                      btn.textContent = t('actions.copied');
                      setTimeout(() => {
                        btn.textContent = orig;
                      }, 1200);
                    }
                  },
                },
                icon('copy', 13),
                t('actions.copy'),
              ),
            ),
          );

          card.append(cardHeader, content, cardFooter);
          listContainer.append(card);
        }
      } else if (activeTab === 'pinned') {
        const filtered = filterEntries(pinnedItems, searchQuery);
        countSpan.textContent = `${filtered.length} / ${pinnedItems.length}`;

        if (!filtered.length) {
          listContainer.append(
            h(
              'div',
              { class: 'nx-cb-empty' },
              h('div', { class: 'nx-cb-empty-icon' }, icon('bookmark', 40)),
              h('div', { class: 'nx-cb-empty-title' }, t('empty.pinned')),
              h('div', { class: 'nx-cb-empty-sub' }, t('empty.pinnedSub')),
            ),
          );
          return;
        }

        for (const item of filtered) {
          const card = h('div', { class: 'nx-cb-card is-pinned' });

          const cardHeader = h(
            'div',
            { class: 'nx-cb-card-header' },
            h(
              'div',
              { class: 'nx-cb-badge-group' },
              h('span', { class: 'nx-cb-badge' }, item.app || 'system'),
              h('span', { class: 'nx-cb-badge nx-cb-badge-pinned' }, icon('bookmark', 11), t('tabs.pinned')),
            ),
            h('span', { class: 'nx-cb-time' }, formatRelativeTime(item.pinnedAt || item.at)),
          );

          const content = h('div', { class: 'nx-cb-card-content' }, item.text || '');

          const cardFooter = h(
            'div',
            { class: 'nx-cb-card-footer' },
            h('span', { class: 'nx-cb-char-count' }, t('chars', { count: item.text?.length ?? 0 })),
            h(
              'div',
              { class: 'nx-cb-card-actions' },
              btn(
                {
                  class: 'nx-cb-btn nx-cb-btn-icon',
                  title: t('actions.unpin'),
                  onClick: async () => {
                    await pinnedCol.delete(item.id);
                    render();
                  },
                },
                icon('bookmark', 13),
              ),
              btn(
                {
                  class: 'nx-cb-btn nx-cb-btn-accent',
                  onClick: async (/** @type {MouseEvent} */ e) => {
                    if (item.text) {
                      await ctx.clipboard.writeText(item.text);
                      const btn = /** @type {HTMLButtonElement} */ (e.currentTarget);
                      const orig = btn.textContent;
                      btn.textContent = t('actions.copied');
                      setTimeout(() => {
                        btn.textContent = orig;
                      }, 1200);
                    }
                  },
                },
                icon('copy', 13),
                t('actions.copy'),
              ),
            ),
          );

          card.append(cardHeader, content, cardFooter);
          listContainer.append(card);
        }
      } else if (activeTab === 'snippets') {
        const filtered = filterEntries(snippetItems, searchQuery);
        countSpan.textContent = `${filtered.length} / ${snippetItems.length}`;

        if (!filtered.length) {
          listContainer.append(
            h(
              'div',
              { class: 'nx-cb-empty' },
              h('div', { class: 'nx-cb-empty-icon' }, icon('sparkles', 40)),
              h('div', { class: 'nx-cb-empty-title' }, t('empty.snippets')),
              h('div', { class: 'nx-cb-empty-sub' }, t('empty.snippetsSub')),
            ),
          );
          return;
        }

        const currentClipText = historyItems.length ? historyItems[0].text : '';

        for (const item of filtered) {
          const card = h('div', { class: 'nx-cb-card' });

          const cardHeader = h(
            'div',
            { class: 'nx-cb-card-header' },
            h(
              'div',
              { class: 'nx-cb-badge-group' },
              h('strong', {}, item.title),
              item.shortcut ? h('span', { class: 'nx-cb-badge' }, item.shortcut) : null,
            ),
            h('span', { class: 'nx-cb-time' }, formatRelativeTime(item.createdAt)),
          );

          const expandedPreview = expandSnippet(item.body, { clipboard: currentClipText, now: new Date() });
          const content = h('div', { class: 'nx-cb-card-content' }, expandedPreview);

          const cardFooter = h(
            'div',
            { class: 'nx-cb-card-footer' },
            h('span', { class: 'nx-cb-char-count' }, t('chars', { count: item.body?.length ?? 0 })),
            h(
              'div',
              { class: 'nx-cb-card-actions' },
              btn(
                {
                  class: 'nx-cb-btn nx-cb-btn-icon',
                  title: t('actions.editSnippet'),
                  onClick: () => {
                    editingSnippet = { ...item };
                    isEditingNew = false;
                    renderModal();
                  },
                },
                icon('edit', 13),
              ),
              btn(
                {
                  class: 'nx-cb-btn nx-cb-btn-icon nx-cb-btn-danger',
                  title: t('actions.delete'),
                  onClick: async () => {
                    await snippetsCol.delete(item.id);
                    render();
                  },
                },
                icon('trash', 13),
              ),
              btn(
                {
                  class: 'nx-cb-btn nx-cb-btn-accent',
                  onClick: async (/** @type {MouseEvent} */ e) => {
                    const expanded = expandSnippet(item.body, {
                      clipboard: historyItems.length ? historyItems[0].text : '',
                      now: new Date(),
                    });
                    await ctx.clipboard.writeText(expanded);
                    const btn = /** @type {HTMLButtonElement} */ (e.currentTarget);
                    const orig = btn.textContent;
                    btn.textContent = t('actions.copied');
                    setTimeout(() => {
                      btn.textContent = orig;
                    }, 1200);
                  },
                },
                icon('copy', 13),
                t('actions.copy'),
              ),
            ),
          );

          card.append(cardHeader, content, cardFooter);
          listContainer.append(card);
        }
      }
    }

    renderList();
    container.append(header, subbar, listContainer);
  }

  function renderModal() {
    if (!editingSnippet) return;
    const existing = container.querySelector('.nx-cb-modal');
    if (existing) existing.remove();

    const titleInput = /** @type {HTMLInputElement} */ (
      h('input', {
        type: 'text',
        class: 'nx-cb-input',
        value: editingSnippet.title,
        placeholder: 'e.g. Email Signature',
      })
    );

    const shortcutInput = /** @type {HTMLInputElement} */ (
      h('input', {
        type: 'text',
        class: 'nx-cb-input',
        value: editingSnippet.shortcut || '',
        placeholder: 'e.g. ;sig',
      })
    );

    const bodyTextarea = /** @type {HTMLTextAreaElement} */ (
      h('textarea', {
        class: 'nx-cb-input nx-cb-textarea',
        placeholder: 'Template with {{date}}, {{time}}, or {{clipboard}}',
      })
    );
    bodyTextarea.value = editingSnippet.body;

    const modal = h(
      'div',
      { class: 'nx-cb-modal' },
      h(
        'div',
        { class: 'nx-cb-modal-box' },
        h(
          'div',
          { class: 'nx-cb-modal-header' },
          h('span', {}, isEditingNew ? t('actions.newSnippet') : t('actions.editSnippet')),
          btn(
            {
              class: 'nx-cb-btn nx-cb-btn-icon',
              onClick: () => {
                editingSnippet = null;
                modal.remove();
              },
            },
            icon('x', 14),
          ),
        ),
        h(
          'div',
          { class: 'nx-cb-modal-body' },
          h('div', { class: 'nx-cb-form-group' }, h('label', { class: 'nx-cb-label' }, t('snippet.title')), titleInput),
          h(
            'div',
            { class: 'nx-cb-form-group' },
            h('label', { class: 'nx-cb-label' }, t('snippet.shortcut')),
            shortcutInput,
          ),
          h(
            'div',
            { class: 'nx-cb-form-group' },
            h('label', { class: 'nx-cb-label' }, t('snippet.body')),
            bodyTextarea,
            h('span', { class: 'nx-cb-help-vars' }, t('snippet.helpVars')),
          ),
        ),
        h(
          'div',
          { class: 'nx-cb-modal-footer' },
          btn(
            {
              class: 'nx-cb-btn',
              onClick: () => {
                editingSnippet = null;
                modal.remove();
              },
            },
            t('actions.cancel'),
          ),
          btn(
            {
              class: 'nx-cb-btn nx-cb-btn-accent',
              onClick: async () => {
                const title = titleInput.value.trim() || 'Untitled';
                const body = bodyTextarea.value;
                const shortcut = shortcutInput.value.trim();
                if (!editingSnippet) return;
                await snippetsCol.put({
                  id: editingSnippet.id,
                  title,
                  body,
                  shortcut,
                  createdAt: editingSnippet.createdAt || Date.now(),
                });
                editingSnippet = null;
                modal.remove();
                render();
              },
            },
            t('actions.save'),
          ),
        ),
      ),
    );

    container.append(modal);
    titleInput.focus();
  }

  // Subscribe to real-time clipboard updates
  ctx.clipboard.onChange(() => {
    render();
  });

  await render();
}
