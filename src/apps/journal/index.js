// @ts-check
// Nexus Journal: daily Markdown entries, 5-point mood tracking,
// "On this day" historical recall, VFS photos, writing prompts, and AES-GCM password encryption.
import { button, h, icon, replace } from '../../ui/dom.js';
import { openModal } from '../../ui/overlay.js';
import { renderMarkdown } from '../../ui/markdown.js';
import { computeMoodStats, countWords, findOnThisDay, MOOD_META, WRITING_PROMPTS } from './model.js';
import './styles.css';

/** @typedef {import('./model.js').JournalEntry} JournalEntry */
/** @typedef {import('./model.js').MoodLevel} MoodLevel */

/**
 * Terminal command handler: `journal [today | list | mood <1-5> | onthisday]`.
 * @type {Record<string, (ctx: import('../../kernel/types').HeadlessContext, io: import('../../kernel/types').TerminalIo) => Promise<number>>}
 */
export const terminal = {
  async journal(ctx, io) {
    const entriesCol = /** @type {import('../../kernel/types').Collection<JournalEntry>} */ (
      ctx.storage.collection('entries')
    );
    const entries = await entriesCol.all();
    const today = new Date().toISOString().split('T')[0];
    const sub = io.args[0] ?? 'today';

    if (sub === 'today') {
      const todayEntry = entries.find((e) => e.date === today);
      if (!todayEntry) {
        io.out(`No journal entry for today (${today}). Use 'journal mood <1-5>' or open the Journal app.\n`);
        return 0;
      }
      const m = MOOD_META[todayEntry.mood];
      io.out(`--- Journal: ${today} ${m.emoji} (${m.label.en}) ---\n`);
      if (todayEntry.title) io.out(`Title: ${todayEntry.title}\n`);
      io.out(`\n${todayEntry.content || '[Encrypted]'}\n`);
      return 0;
    }

    if (sub === 'list') {
      io.out(`--- Journal Entries (${entries.length}) ---\n`);
      const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
      for (const e of sorted.slice(0, 15)) {
        const m = MOOD_META[e.mood] || MOOD_META[3];
        io.out(`• ${e.date} ${m.emoji} — ${e.title || 'Untitled'} (${countWords(e.content)} words)\n`);
      }
      return 0;
    }

    if (sub === 'mood') {
      const val = parseInt(io.args[1], 10);
      if (!val || val < 1 || val > 5) {
        io.err('Usage: journal mood <1-5> (1 = awful, 5 = great)\n');
        return 1;
      }
      const lvl = /** @type {MoodLevel} */ (val);
      const existing = entries.find((e) => e.date === today);
      if (existing) {
        await entriesCol.put({ ...existing, mood: lvl, updatedAt: Date.now() });
      } else {
        await entriesCol.put({
          id: today,
          date: today,
          title: '',
          content: '',
          mood: lvl,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      const m = MOOD_META[lvl];
      io.out(`Recorded today's mood as ${m.emoji} ${m.label.en}!\n`);
      return 0;
    }

    if (sub === 'onthisday') {
      const past = findOnThisDay(entries);
      if (past.length === 0) {
        io.out('No entries found from previous years on this day.\n');
        return 0;
      }
      io.out(`--- On This Day (${past.length} entries) ---\n`);
      for (const e of past) {
        const m = MOOD_META[e.mood];
        io.out(`• [${e.date}] ${m.emoji} ${e.title || 'Untitled'}\n`);
      }
      return 0;
    }

    io.err(`Unknown subcommand "${sub}". Try: journal [today | list | mood <1-5> | onthisday]\n`);
    return 1;
  },
};

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'journal.new': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.journal', args: { action: 'new' } }),
  'journal.lock': (ctx) =>
    ctx.commands.execute('shell.launchApp', { appId: 'nexus.journal', args: { action: 'lock' } }),
};

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').AppContext} ctx
 */
export async function mount(root, ctx) {
  const entriesCol = /** @type {import('../../kernel/types').Collection<JournalEntry>} */ (
    ctx.storage.collection('entries')
  );
  const configCol = ctx.storage.collection('config');

  /** @type {string | null} */
  let activePassword = null;
  /** @type {string | null} */
  let selectedEntryId = null;
  let isEditing = false;
  let searchQuery = '';

  const container = h('div', { class: 'nx-journal' });
  replace(root, container);

  async function render() {
    /** @type {{ id: string, hasPassword?: boolean, passwordHash?: import('../../services/crypto.js').SecretHash } | null} */
    const secConfig = (await configCol.get('security')) ?? null;
    const isEncrypted = Boolean(secConfig?.hasPassword && secConfig?.passwordHash);

    // If encrypted and locked, show lock screen
    if (isEncrypted && !activePassword) {
      renderLockScreen(secConfig);
      return;
    }

    const rawEntries = await entriesCol.all();
    /** @type {JournalEntry[]} */
    const entries = [];

    // Decrypt if needed
    for (const raw of rawEntries) {
      if (raw.isEncrypted && raw.encryptedPayload && activePassword) {
        try {
          const plain = await ctx.crypto.decryptText(raw.encryptedPayload, activePassword);
          entries.push({ ...raw, content: plain });
        } catch {
          entries.push(raw);
        }
      } else {
        entries.push(raw);
      }
    }

    entries.sort((a, b) => b.date.localeCompare(a.date));

    if (!selectedEntryId && entries.length > 0) {
      selectedEntryId = entries[0].id;
    }

    const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? entries[0] ?? null;

    // Toolbar
    const toolbar = h(
      'header',
      { class: 'nx-journal-toolbar' },
      h(
        'div',
        { class: 'nx-journal-toolbar-title' },
        icon('book', { size: 18 }),
        h('span', { text: ctx.i18n.t('journal') }),
      ),
      h(
        'div',
        { class: 'nx-journal-toolbar-actions' },
        button({
          label: ctx.i18n.t('newEntry'),
          icon: 'plus',
          variant: 'primary',
          onClick: () => {
            selectedEntryId = null;
            isEditing = true;
            render();
          },
        }),
        button({
          label: ctx.i18n.t('moodStats'),
          icon: 'activity',
          onClick: () => showMoodStatsModal(entries),
        }),
        isEncrypted
          ? button({
              label: ctx.i18n.t('lockNow'),
              icon: 'lock',
              onClick: () => {
                activePassword = null;
                render();
              },
            })
          : button({
              label: ctx.i18n.t('enableEncryption'),
              icon: 'lock',
              onClick: () => showEncryptionSetupModal(),
            }),
      ),
    );

    // Sidebar entries list
    const filteredEntries = searchQuery
      ? entries.filter(
          (e) =>
            e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.date.includes(searchQuery),
        )
      : entries;

    const entryItems = filteredEntries.map((e) => {
      const m = MOOD_META[e.mood] || MOOD_META[3];
      const isSelected = selectedEntry?.id === e.id && !isEditing;
      return h(
        'div',
        {
          class: `nx-journal-entry-item${isSelected ? ' is-selected' : ''}`,
          onClick: () => {
            selectedEntryId = e.id;
            isEditing = false;
            render();
          },
        },
        h('div', { class: 'nx-journal-entry-meta' }, h('span', { text: e.date }), h('span', { text: m.emoji })),
        h('div', { class: 'nx-journal-entry-title', text: e.title || ctx.i18n.t('newEntry') }),
        h('div', { class: 'nx-journal-entry-snippet', text: e.content ? e.content.slice(0, 60) : '...' }),
      );
    });

    const searchInput = h('input', {
      type: 'text',
      class: 'nx-input',
      value: searchQuery,
      placeholder: ctx.i18n.t('searchPlaceholder'),
      style: { width: '100%' },
    });
    searchInput.addEventListener('input', (ev) => {
      searchQuery = /** @type {HTMLInputElement} */ (ev.target).value;
      render();
    });

    const sidebar = h(
      'aside',
      { class: 'nx-journal-sidebar' },
      h('div', { class: 'nx-journal-sidebar-search' }, searchInput),
      h('div', { class: 'nx-journal-entries-list' }, ...entryItems),
    );

    // Main Pane
    const mainPane = h('main', { class: 'nx-journal-main' });

    if (isEditing || !selectedEntry) {
      renderEditor(mainPane, selectedEntry, isEncrypted);
    } else {
      renderViewer(mainPane, selectedEntry, entries);
    }

    const body = h('div', { class: 'nx-journal-body' }, sidebar, mainPane);
    replace(container, toolbar, body);
  }

  /**
   * Render lock screen.
   * @param {any} secConfig
   */
  function renderLockScreen(secConfig) {
    let enteredPass = '';
    const passInput = h('input', {
      type: 'password',
      class: 'nx-input',
      placeholder: ctx.i18n.t('password'),
      style: { width: '240px' },
    });
    passInput.addEventListener('input', (e) => {
      enteredPass = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const errorMsg = h('div', { style: { color: 'var(--nx-danger, #f87171)', fontSize: '13px', display: 'none' } });

    async function tryUnlock() {
      if (!enteredPass) return;
      const ok = await ctx.crypto.verifySecret(enteredPass, secConfig.passwordHash);
      if (ok) {
        activePassword = enteredPass;
        render();
      } else {
        errorMsg.textContent = ctx.i18n.t('wrongPassword');
        errorMsg.style.display = 'block';
      }
    }

    passInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void tryUnlock();
    });

    const screen = h(
      'div',
      { class: 'nx-journal-lock-screen' },
      icon('lock', { size: 48 }),
      h('h2', { text: ctx.i18n.t('lockedTitle') }),
      h('p', { style: { color: 'var(--nx-text-muted, #7d8590)', maxWidth: '400px' }, text: ctx.i18n.t('lockedDesc') }),
      h(
        'div',
        { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        passInput,
        button({
          label: ctx.i18n.t('unlock'),
          variant: 'primary',
          onClick: () => void tryUnlock(),
        }),
      ),
      errorMsg,
    );

    replace(container, screen);
  }

  /**
   * Viewer for a journal entry.
   * @param {HTMLElement} host
   * @param {JournalEntry} entry
   * @param {JournalEntry[]} allEntries
   */
  function renderViewer(host, entry, allEntries) {
    const m = MOOD_META[entry.mood] || MOOD_META[3];
    const words = countWords(entry.content);

    const onThisDayMatches = findOnThisDay(allEntries, new Date(`${entry.date}T12:00:00`));

    const header = h(
      'div',
      { class: 'nx-journal-view-header' },
      h(
        'div',
        { class: 'nx-journal-view-title' },
        h('span', { text: m.emoji }),
        h('span', { text: entry.title || entry.date }),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        h('span', {
          style: { fontSize: '12px', color: 'var(--nx-text-muted, #7d8590)' },
          text: ctx.i18n.t('wordCount', { count: words }),
        }),
        button({
          label: ctx.i18n.t('editEntry'),
          icon: 'edit',
          onClick: () => {
            isEditing = true;
            render();
          },
        }),
        button({
          icon: 'trash',
          onClick: async () => {
            if (confirm(ctx.i18n.t('confirmDelete'))) {
              await entriesCol.delete(entry.id);
              selectedEntryId = null;
              render();
            }
          },
        }),
      ),
    );

    const meta = h(
      'div',
      { style: { display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--nx-text-secondary, #94a3b8)' } },
      h('span', { text: `📅 ${entry.date}` }),
      h('span', { text: `${ctx.i18n.t('mood')}: ${m.emoji} ${m.label[ctx.i18n.lang] ?? m.label.en}` }),
    );

    // Markdown rendered content
    const rendered = renderMarkdown(entry.content || '_No content_');
    const contentEl = h('div', { class: 'nx-journal-markdown' });
    contentEl.appendChild(rendered);

    // Photos
    const photosEl = h('div', { class: 'nx-journal-photos' });
    if (entry.photos && entry.photos.length > 0) {
      for (const p of entry.photos) {
        photosEl.appendChild(h('img', { src: p, class: 'nx-journal-photo-thumb' }));
      }
    }

    // On This Day banner
    const onThisDaySection = h('div');
    if (onThisDayMatches.length > 0) {
      const items = onThisDayMatches.map((past) => {
        const pm = MOOD_META[past.mood] || MOOD_META[3];
        return h(
          'div',
          {
            style: { fontSize: '13px', cursor: 'pointer', color: 'var(--nx-accent, #ff8a3d)' },
            onClick: () => {
              selectedEntryId = past.id;
              render();
            },
          },
          `• ${past.date} (${pm.emoji}): ${past.title || 'Untitled'}`,
        );
      });

      onThisDaySection.appendChild(
        h(
          'div',
          { class: 'nx-journal-on-this-day' },
          h(
            'div',
            { class: 'nx-journal-on-this-day-title' },
            icon('calendar', { size: 14 }),
            h('span', { text: ctx.i18n.t('onThisDay') }),
          ),
          ...items,
        ),
      );
    }

    replace(host, header, meta, onThisDaySection, contentEl, photosEl);
  }

  /**
   * Editor for new or existing entry.
   * @param {HTMLElement} host
   * @param {JournalEntry | null} entry
   * @param {boolean} isEncrypted
   */
  function renderEditor(host, entry, isEncrypted) {
    let dateVal = entry?.date ?? new Date().toISOString().split('T')[0];
    let titleVal = entry?.title ?? '';
    let contentVal = entry?.content ?? '';
    let moodVal = /** @type {MoodLevel} */ (entry?.mood ?? 3);
    let tagsVal = entry?.tags ? entry.tags.join(', ') : '';

    const dateInput = h('input', {
      type: 'date',
      class: 'nx-input',
      value: dateVal,
      style: { width: '180px' },
    });
    dateInput.addEventListener('input', (e) => {
      dateVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const titleInput = h('input', {
      type: 'text',
      class: 'nx-input',
      value: titleVal,
      placeholder: ctx.i18n.t('titlePlaceholder'),
      style: { flex: '1' },
    });
    titleInput.addEventListener('input', (e) => {
      titleVal = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const moodButtons = [1, 2, 3, 4, 5].map((lvl) => {
      const m = MOOD_META[/** @type {MoodLevel} */ (lvl)];
      return button({
        label: `${m.emoji} ${m.label[ctx.i18n.lang] ?? m.label.en}`,
        size: 'small',
        variant: moodVal === lvl ? 'primary' : 'secondary',
        onClick: () => {
          moodVal = /** @type {MoodLevel} */ (lvl);
          renderEditor(
            host,
            {
              ...entry,
              date: dateVal,
              title: titleVal,
              content: contentVal,
              mood: moodVal,
              id: entry?.id || dateVal,
              createdAt: entry?.createdAt || Date.now(),
              updatedAt: Date.now(),
            },
            isEncrypted,
          );
        },
      });
    });

    const prompts = WRITING_PROMPTS[ctx.i18n.lang === 'de' ? 'de' : 'en'];
    const promptSelect = h(
      'select',
      { class: 'nx-select', style: { width: '100%' } },
      h('option', { value: '', text: ctx.i18n.t('writingPrompts') }),
      ...prompts.map((p) => h('option', { value: p, text: p })),
    );
    promptSelect.addEventListener('change', (e) => {
      const sel = /** @type {HTMLSelectElement} */ (e.target).value;
      if (sel) {
        contentVal = contentVal ? `${contentVal}\n\n**${sel}**\n` : `**${sel}**\n`;
        textarea.value = contentVal;
        updateWordCount();
      }
    });

    const textarea = h('textarea', {
      class: 'nx-textarea',
      placeholder: ctx.i18n.t('contentPlaceholder'),
      value: contentVal,
      style: { width: '100%', minHeight: '340px', fontFamily: 'monospace', fontSize: '13px' },
    });
    const wordCountSpan = h('span', { style: { fontSize: '12px', color: 'var(--nx-text-muted, #7d8590)' } });
    function updateWordCount() {
      wordCountSpan.textContent = ctx.i18n.t('wordCount', { count: countWords(textarea.value) });
    }
    textarea.addEventListener('input', (e) => {
      contentVal = /** @type {HTMLTextAreaElement} */ (e.target).value;
      updateWordCount();
    });
    updateWordCount();

    const saveBtn = button({
      label: ctx.i18n.t('save'),
      variant: 'primary',
      icon: 'check',
      onClick: async () => {
        const id = entry?.id ?? dateVal;
        const tagsArr = tagsVal
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        const wCount = countWords(contentVal);

        /** @type {JournalEntry} */
        const toSave = {
          id,
          date: dateVal,
          title: titleVal.trim(),
          content: contentVal,
          mood: moodVal,
          tags: tagsArr,
          photos: entry?.photos ?? [],
          wordCount: wCount,
          createdAt: entry?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        };

        if (isEncrypted && activePassword) {
          const encPayload = await ctx.crypto.encrypt(contentVal, activePassword);
          toSave.isEncrypted = true;
          toSave.encryptedPayload = encPayload;
          toSave.content = ''; // Clear plaintext on disk
        }

        await entriesCol.put(toSave);
        selectedEntryId = id;
        isEditing = false;
        render();
      },
    });

    const cancelBtn = button({
      label: ctx.i18n.t('cancel'),
      variant: 'secondary',
      onClick: () => {
        isEditing = false;
        render();
      },
    });

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' } },
      h(
        'div',
        { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        dateInput,
        titleInput,
        saveBtn,
        cancelBtn,
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
        h('span', { style: { fontSize: '12px', fontWeight: '600' } }, ctx.i18n.t('mood')),
        ...moodButtons,
      ),
      h('div', {}, promptSelect),
      textarea,
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, wordCountSpan),
    );

    replace(host, form);
  }

  /**
   * Modal to show mood statistics over the past 30 days.
   * @param {JournalEntry[]} entries
   */
  function showMoodStatsModal(entries) {
    const stats = computeMoodStats(entries);
    const content = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '320px' } },
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } },
        h(
          'div',
          {
            style: {
              padding: '12px',
              background: 'var(--nx-bg-surface, #1a1d26)',
              borderRadius: '8px',
              textAlign: 'center',
            },
          },
          h('div', {
            style: { fontSize: '24px', fontWeight: '700', color: '#ff8a3d' },
            text: String(stats.averageMood),
          }),
          h('div', {
            style: { fontSize: '12px', color: 'var(--nx-text-muted, #7d8590)' },
            text: ctx.i18n.t('avgMood'),
          }),
        ),
        h(
          'div',
          {
            style: {
              padding: '12px',
              background: 'var(--nx-bg-surface, #1a1d26)',
              borderRadius: '8px',
              textAlign: 'center',
            },
          },
          h('div', { style: { fontSize: '24px', fontWeight: '700' }, text: String(stats.totalEntries) }),
          h('div', {
            style: { fontSize: '12px', color: 'var(--nx-text-muted, #7d8590)' },
            text: ctx.i18n.t('totalEntries'),
          }),
        ),
      ),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        h('span', { style: { fontSize: '12px', fontWeight: '600' }, text: '30-Day Mood Timeline' }),
        h(
          'div',
          { style: { display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: '4px' } },
          ...stats.recentTimeline.map((item) => {
            const m = item.mood ? MOOD_META[item.mood] : null;
            return h('div', {
              style: {
                height: '18px',
                borderRadius: '3px',
                background: m ? m.color : 'var(--nx-bg-subtle, #212631)',
              },
              title: `${item.date}: ${m ? `${m.emoji} (${m.label.en})` : 'No entry'}`,
            });
          }),
        ),
      ),
    );

    openModal({
      title: ctx.i18n.t('moodStats'),
      content,
    });
  }

  /**
   * Modal to setup AES-GCM password encryption.
   */
  function showEncryptionSetupModal() {
    let p1 = '';
    let p2 = '';
    const errEl = h('div', { style: { color: 'var(--nx-danger, #f87171)', fontSize: '12px', display: 'none' } });

    const i1 = h('input', { type: 'password', class: 'nx-input', placeholder: ctx.i18n.t('setPassword') });
    i1.addEventListener('input', (e) => {
      p1 = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const i2 = h('input', { type: 'password', class: 'nx-input', placeholder: ctx.i18n.t('confirmPassword') });
    i2.addEventListener('input', (e) => {
      p2 = /** @type {HTMLInputElement} */ (e.target).value;
    });

    const form = h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '320px' } },
      h('p', {
        style: { fontSize: '12px', color: '#ff8a3d', lineHeight: '1.4' },
        text: ctx.i18n.t('encryptionNotice'),
      }),
      i1,
      i2,
      errEl,
    );

    const modal = openModal({
      title: ctx.i18n.t('enableEncryption'),
      content: form,
      actions: [
        {
          label: ctx.i18n.t('cancel'),
          variant: 'secondary',
          onClick: () => modal.close(),
        },
        {
          label: ctx.i18n.t('save'),
          variant: 'primary',
          onClick: async () => {
            if (!p1 || p1 !== p2) {
              errEl.textContent = ctx.i18n.t('passwordsDoNotMatch');
              errEl.style.display = 'block';
              return;
            }
            const hash = await ctx.crypto.hashSecret(p1);
            await configCol.put({
              id: 'security',
              hasPassword: true,
              passwordHash: hash,
            });
            activePassword = p1;
            modal.close();
            render();
          },
        },
      ],
    });
  }

  entriesCol.onChange(() => void render());
  await render();
}
