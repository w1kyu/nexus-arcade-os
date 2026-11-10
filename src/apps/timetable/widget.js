// @ts-check
// Timetable "Now & Next" desktop widget
import { button, h, replace } from '../../ui/dom.js';
import { computeNowAndNext, getBiweeklyWeekType } from './model.js';

/** @typedef {import('./model.js').Course} Course */

/**
 * @param {HTMLElement} root
 * @param {import('../../kernel/types').WidgetContext} ctx
 */
export async function mount(root, ctx) {
  const coursesCol = /** @type {import('../../kernel/types').Collection<Course>} */ (ctx.storage.collection('courses'));

  async function render() {
    const courses = await coursesCol.all();
    const currentWeekType = getBiweeklyWeekType(new Date(), '2026-10-01', 'A');
    const { current, next, minutesToNext } = computeNowAndNext(courses, new Date(), currentWeekType);

    const titleText = current
      ? `${current.name} (${current.room || 'TBD'})`
      : next
        ? `${next.name} (${next.room || 'TBD'})`
        : ctx.i18n.t('noUpcomingCourse');

    const subText = current
      ? `${ctx.i18n.t('now')} · ${current.startTime} - ${current.endTime}`
      : next
        ? `${ctx.i18n.t('next')} · ${next.startTime} - ${next.endTime}${minutesToNext ? ` (${ctx.i18n.t('inMinutes', { min: minutesToNext })})` : ''}`
        : `Woche ${currentWeekType}`;

    replace(
      root,
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', padding: '6px' } },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('strong', { style: { fontSize: '13px' }, text: ctx.i18n.t('appTitle') }),
          h('span', { class: 'nx-tt-badge', text: current ? ctx.i18n.t('now') : ctx.i18n.t('next') }),
        ),
        h(
          'div',
          {
            style: {
              fontSize: '15px',
              fontWeight: '700',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
          },
          titleText,
        ),
        h('div', { style: { fontSize: '12px', opacity: '0.75' } }, subText),
        button({
          label: ctx.i18n.t('appTitle'),
          icon: 'table',
          onClick: () => void ctx.commands.execute('shell.launchApp', { appId: 'nexus.timetable' }),
        }),
      ),
    );
  }

  coursesCol.onChange(() => void render());
  await render();
}
