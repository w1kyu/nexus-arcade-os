// @ts-check
// Nexus Bookmarks & Reading List: collections, tags, offline letter avatars,
// read/unread states, and standard Netscape Bookmarks HTML import/export.
import { button, h, icon, replace } from '../../ui/dom.js';
import { openModal } from '../../ui/overlay.js';
import { exportNetscapeBookmarksHtml, getLetterAvatar, parseNetscapeBookmarksHtml } from './model.js';
import './styles.css';

/** @typedef {import('./model.js').BookmarkItem} BookmarkItem */

/**
 * Terminal command handler: `bookmarks [list | reading | add <url> <title>]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async bookmarks(ctx, io) {
    const col = /** @type {import('../../kernel/types').Collection<BookmarkItem>} */ (
      ctx.storage.collection('bookmarks')
    );
    const bookmarks = await col.all();
    const sub = io.args[0] ?? 'list';

    if (sub === 'list') {
      io.out(`--- Bookmarks (${bookmarks.length}) ---\n`);
      for (const b of bookmarks) {
        io.out(`• ${b.title || b.url} — ${b.url} [${b.collection || 'Default'}]\n`);
      }
      return 0;
    }

    if (sub === 'reading') {
      const reading = bookmarks.filter((b) => b.isReadingList);
      io.out(`--- Reading List (${reading.length}) ---\n`);
      for (const b of reading) {
        const status = b.isRead ? '[READ]' : '[UNREAD]';
        io.out(`• ${status} ${b.title || b.url} — ${b.url}\n`);
      }
      return 0;
    }

    if (sub === 'add') {
      const url = io.args[1];
      const title = io.args.slice(2).join(' ') || url;
      if (!url) {
        io.err('Usage: bookmarks add <url> [title]\n');
        return 1;
      }
      await col.put({
        id: crypto.randomUUID(),
        url,
        title,
        collection: 'Default',
        tags: [],
        isReadingList: false,
        isRead: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      io.out(`Saved bookmark: "${title}" (${url})\n`);
      return 0;
    }

    io.err(`Unknown subcommand "${sub}". Try: bookmarks [list | reading | add <url> <title>]\n`);
    return 1;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'bookmarks.new': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.bookmarks', args: { action: 'new' } }),
};

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(root, ctx) {
  const col = /** @type {import('../../kernel/types').Collection<BookmarkItem>} */ (
    ctx.storage.collection('bookmarks')
  );

  /** @type {'all' | 'reading' | string} */
  let activeFilter = 'all';
  let searchQuery = '';

  const container = h('div', { class: 'nx-bookmarks' });
  replace(root, container);

  async function render() {
    const all = await col.all();

    // Unique collections
    const collections = Array.from(new Set(all.map((b) => b.collection || 'Default')));
    const unreadCount = all.filter((b) => b.isReadingList && !b.isRead).length;

    // Toolbar
    const toolbar = h(
      'header',
      { class: 'nx-bm-toolbar' },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' } },
        icon('bookmark', { size: 18 }),
        h('span', { text: ctx.i18n.t('appTitle') }),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        button({
          label: ctx.i18n.t('newBookmark'),
          icon: 'plus',
          variant: 'primary',
          onClick: () => showBookmarkModal(),
        }),
        button({
          label: ctx.i18n.t('htmlImport'),
          icon: 'download',
          onClick: () => showHtmlImportModal(),
        }),
        button({
          label: ctx.i18n.t('htmlExport'),
          icon: 'upload',
          onClick: () => {
            const html = exportNetscapeBookmarksHtml(all);
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bookmarks.html';
            a.click();
            URL.revokeObjectURL(url);
          },
        }),
      ),
    );

    // Sidebar
    const navItems = [
      h(
        'div',
        {
          class: `nx-bm-nav-item${activeFilter === 'all' ? ' is-selected' : ''}`,
          onClick: () => {
            activeFilter = 'all';
            render();
          },
        },
        h('span', { text: ctx.i18n.t('allBookmarks') }),
        h('span', { style: { fontSize: '11px', opacity: '0.7' }, text: String(all.length) }),
      ),
      h(
        'div',
        {
          class: `nx-bm-nav-item${activeFilter === 'reading' ? ' is-selected' : ''}`,
          onClick: () => {
            activeFilter = 'reading';
            render();
          },
        },
        h('span', { text: ctx.i18n.t('readingList') }),
        unreadCount > 0 ? h('span', { class: 'nx-tt-badge', text: String(unreadCount) }) : h('span'),
      ),
      h('div', {
        style: {
          fontSize: '11px',
          fontWeight: '600',
          textTransform: 'uppercase',
          color: 'var(--nx-text-muted, #7d8590)',
          padding: '10px 4px 4px 4px',
        },
        text: ctx.i18n.t('collections'),
      }),
      ...collections.map((c) =>
        h(
          'div',
          {
            class: `nx-bm-nav-item${activeFilter === c ? ' is-selected' : ''}`,
            onClick: () => {
              activeFilter = c;
              render();
            },
          },
          h('span', { text: c }),
          h('span', {
            style: { fontSize: '11px', opacity: '0.7' },
            text: String(all.filter((b) => (b.collection || 'Default') === c).length),
          }),
        ),
      ),
    ];

    const sidebar = h('aside', { class: 'nx-bm-sidebar' }, ...navItems);

    // Main Area
    let filtered = all;
    if (activeFilter === 'reading') {
      filtered = all.filter((b) => b.isReadingList);
    } else if (activeFilter !== 'all') {
      filtered = all.filter((b) => (b.collection || 'Default') === activeFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (b) =>
          b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (b.tags && b.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))),
      );
    }

    filtered.sort((a, b) => b.createdAt - a.createdAt);

    const searchIn = h('input', {
      type: 'text',
      class: 'nx-input',
      value: searchQuery,
      placeholder: ctx.i18n.t('search'),
      style: { width: '100%' },
    });
    searchIn.addEventListener('input', (e) => {
      searchQuery = /** @type {HTMLInputElement} */ (e.target).value;
      render();
    });

    const cards = filtered.map((b) => {
      const avatar = getLetterAvatar(b.url, b.title);
      const isRead = Boolean(b.isRead);

      return h(
        'div',
        { class: `nx-bm-card${isRead ? ' is-read' : ''}` },
        h('div', { class: 'nx-bm-avatar', style: { background: avatar.color }, text: avatar.char }),
        h(
          'div',
          { class: 'nx-bm-info' },
          h('a', {
            href: b.url,
            target: '_blank',
            rel: 'noopener',
            class: 'nx-bm-title',
            text: b.title || b.url,
          }),
          h('span', { class: 'nx-bm-url', text: b.url }),
        ),
        h(
          'div',
          { class: 'nx-bm-actions' },
          b.isReadingList
            ? button({
                label: isRead ? ctx.i18n.t('markUnread') : ctx.i18n.t('markRead'),
                size: 'small',
                variant: isRead ? 'secondary' : 'primary',
                onClick: async () => {
                  await col.put({ ...b, isRead: !isRead, updatedAt: Date.now() });
                },
              })
            : null,
          button({
            icon: 'edit',
            size: 'small',
            onClick: () => showBookmarkModal(b),
          }),
          button({
            icon: 'trash',
            size: 'small',
            onClick: async () => {
              if (confirm(ctx.i18n.t('confirmDelete'))) {
                await col.delete(b.id);
              }
            },
          }),
        ),
      );
    });

    const listContainer = h('div', { class: 'nx-bm-list' });
    if (cards.length === 0) {
      listContainer.appendChild(
        h(
          'div',
          { style: { padding: '40px', textAlign: 'center', color: 'var(--nx-text-muted, #7d8590)' } },
          h('p', { text: ctx.i18n.t('noBookmarksYet') }),
        ),
      );
    } else {
      for (const card of cards) listContainer.appendChild(card);
    }

    const mainPane = h('main', { class: 'nx-bm-main' }, searchIn, listContainer);
    const body = h('div', { class: 'nx-bm-body' }, sidebar, mainPane);

    replace(container, toolbar, body);
  }

  /**
   * Modal for adding or editing a bookmark.
   * @param {BookmarkItem} [existing]
   */
  function showBookmarkModal(existing) {
    let urlVal = existing?.url ?? '';
    let titleVal = existing?.title ?? '';
    let colVal = existing?.collection ?? 'Default';
    let tagsVal = existing?.tags ? existing.tags.join(', ') : '';
    let readingVal = existing?.isReadingList ?? activeFilter === 'reading';

    const uIn = h('input', { type: 'url', class: 'nx-input', value: urlVal, placeholder: 'https://...' });
    uIn.addEventListener('input', (e) => {
      urlVal = /** @type {HTMLInputElement} */ (e.target).value;
      if (!titleVal) {
        try {
          const u = new URL(urlVal);
          titleVal = u.hostname.replace(/^www\./, '');
          tIn.value = titleVal;
        } catch {
          // Ignore invalid URL while typing
        }
      }
    });

    const tIn = h('input', { type: 'text', class: 'nx-input', value: titleVal, placeholder: 'Page title' });
    tIn.addEventListener('input', (e) => {
      titleVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const cIn = h('input', { type: 'text', class: 'nx-input', value: colVal, placeholder: 'e.g. Study, Dev, Reading' });
    cIn.addEventListener('input', (e) => {
      colVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const tagIn = h('input', { type: 'text', class: 'nx-input', value: tagsVal, placeholder: 'tag1, tag2' });
    tagIn.addEventListener('input', (e) => {
      tagsVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const readCheck = h('input', { type: 'checkbox', checked: readingVal });
    readCheck.addEventListener('change', (e) => {
      readingVal = /** @type {HTMLInputElement} */ (e.target).checked;
    });

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '320px' } },
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('url'), uIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('title'), tIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('collection'), cIn),
      h('label', { style: { fontSize: '12px' } }, ctx.i18n.t('tags'), tagIn),
      h(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' } },
        readCheck,
        ctx.i18n.t('addToReadingList'),
      ),
    );

    const modal = openModal({
      title: existing ? ctx.i18n.t('editBookmark') : ctx.i18n.t('newBookmark'),
      content: form,
      actions: [
        { label: ctx.i18n.t('cancel'), variant: 'secondary', onClick: () => modal.close() },
        {
          label: ctx.i18n.t('save'),
          variant: 'primary',
          onClick: async () => {
            if (!urlVal.trim()) return;
            const id = existing?.id ?? crypto.randomUUID();
            await col.put({
              id,
              url: urlVal.trim(),
              title: titleVal.trim() || urlVal.trim(),
              collection: colVal.trim() || 'Default',
              tags: tagsVal
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
              isReadingList: readingVal,
              isRead: existing?.isRead ?? false,
              createdAt: existing?.createdAt ?? Date.now(),
              updatedAt: Date.now(),
            });
            modal.close();
          },
        },
      ],
    });
  }

  function showHtmlImportModal() {
    let htmlText = '';
    const ta = h('textarea', {
      class: 'nx-textarea',
      placeholder: 'Paste Netscape Bookmark HTML here...',
      style: { width: '100%', height: '140px', fontFamily: 'monospace', fontSize: '11px' },
    });
    ta.addEventListener('input', (e) => {
      htmlText = /** @type {HTMLTextAreaElement} */ (e.target).value;
    });

    const modal = openModal({
      title: ctx.i18n.t('htmlImport'),
      content: h('div', { style: { minWidth: '340px' } }, ta),
      actions: [
        { label: ctx.i18n.t('cancel'), variant: 'secondary', onClick: () => modal.close() },
        {
          label: ctx.i18n.t('htmlImport'),
          variant: 'primary',
          onClick: async () => {
            if (!htmlText.trim()) return;
            const imported = parseNetscapeBookmarksHtml(htmlText);
            for (const b of imported) {
              await col.put(b);
            }
            modal.close();
          },
        },
      ],
    });
  }

  col.onChange(() => void render());
  await render();
}
