// @ts-check
// Journal desktop widget: today's mood and quick journal entry status.
import { button, h, replace } from '../../ui/dom.js';
import { MOOD_META } from './model.js';

/** @typedef {import('./model.js').JournalEntry} JournalEntry */

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').WidgetContext} ctx
 */
export async function mount(root, ctx) {
  const entriesCol = /** @type {import('../../kernel/types').Collection<JournalEntry>} */ (
    ctx.storage.collection('entries')
  );

  async function render() {
    const today = new Date().toISOString().split('T')[0];
    const entries = await entriesCol.all();
    const todayEntry = entries.find((e) => e.date === today);

    const moodButtons = [1, 2, 3, 4, 5].map((lvl) => {
      const m = MOOD_META[/** @type {import('./model.js').MoodLevel} */ (lvl)];
      const isSelected = todayEntry?.mood === lvl;
      return button({
        label: m.emoji,
        size: 'small',
        variant: isSelected ? 'primary' : 'secondary',
        onClick: async () => {
          if (todayEntry) {
            await entriesCol.put({
              ...todayEntry,
              mood: /** @type {import('./model.js').MoodLevel} */ (lvl),
              updatedAt: Date.now(),
            });
          } else {
            await entriesCol.put({
              id: today,
              date: today,
              title: '',
              content: '',
              mood: /** @type {import('./model.js').MoodLevel} */ (lvl),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        },
      });
    });

    replace(
      root,
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            height: '100%',
            padding: '8px',
            boxSizing: 'border-box',
          },
        },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('strong', { style: { fontSize: '13px' }, text: ctx.i18n.t('appTitle') }),
          button({
            icon: 'book',
            size: 'small',
            onClick: () => void ctx.commands.execute('shell.launchApp', { appId: 'nexus.journal' }),
          }),
        ),
        h(
          'div',
          { style: { fontSize: '12px', color: 'var(--nx-text-muted, #7d8590)' } },
          todayEntry ? todayEntry.title || todayEntry.date : ctx.i18n.t('newEntry'),
        ),
        h('div', { style: { display: 'flex', gap: '4px', justifyContent: 'center' } }, ...moodButtons),
        button({
          label: todayEntry ? ctx.i18n.t('editEntry') : ctx.i18n.t('newEntry'),
          variant: 'secondary',
          size: 'small',
          onClick: () => void ctx.commands.execute('shell.launchApp', { appId: 'nexus.journal' }),
        }),
      ),
    );
  }

  entriesCol.onChange(() => void render());
  await render();
}
