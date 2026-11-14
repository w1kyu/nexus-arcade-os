// @ts-check
// Interactive, skippable 5-step first-run tour (non-modal corner coachmark).
// Steps: open app -> snap windows -> Ctrl+K command palette -> workspaces -> backup.
import { h, icon } from '../../ui/dom.js';
import { registerCommand } from '../util.js';
import './tour.css';

const STEPS = [
  { key: 'app', cmd: 'shell.launcher', icon: 'apps' },
  { key: 'snap', cmd: 'wm.snap.left', icon: 'window' },
  { key: 'palette', cmd: 'shell.palette', icon: 'search' },
  { key: 'workspaces', cmd: 'shell.overview', icon: 'layers' },
  { key: 'backup', cmd: 'settings.open', args: { page: 'backup' }, icon: 'archive' },
];

/** @param {import('../shell.js').ShellContext} shell */
export function createTour(shell) {
  const sys = shell.system();
  const { t } = shell;
  /** @type {HTMLElement | null} */
  let card = null;
  let step = 0;

  async function finish(completed = true) {
    if (card) {
      card.remove();
      card = null;
    }
    if (completed) {
      await sys.settings.set('system', 'tourCompleted', true).catch(() => {});
    }
  }

  function render() {
    if (!card) return;
    const def = STEPS[step];
    const isFirst = step === 0;
    const isLast = step === STEPS.length - 1;

    const tryBtn = h(
      'button',
      {
        type: 'button',
        class: 'nx-btn',
        dataset: { testid: 'tour-try' },
        onclick: () => void sys.commands.execute(def.cmd, def.args).catch(() => {}),
      },
      icon(def.icon, { size: 15 }),
      t(`tour.steps.${def.key}.action`),
    );

    const nextBtn = h('button', {
      type: 'button',
      class: 'nx-btn is-primary',
      dataset: { testid: isLast ? 'tour-finish' : 'tour-next' },
      text: isLast ? t('tour.finish') : t('tour.next'),
      onclick: () => {
        if (isLast) void finish(true);
        else {
          step++;
          render();
        }
      },
    });

    card.replaceChildren(
      h(
        'div',
        { class: 'nx-tour-head' },
        icon('sparkles', { size: 15 }),
        h('span', { text: t('tour.badge', { step: step + 1, total: STEPS.length }) }),
        h(
          'div',
          { class: 'nx-tour-dots', 'aria-hidden': 'true' },
          ...STEPS.map((_, idx) => h('span', { class: `nx-tour-dot${idx === step ? ' is-active' : ''}` })),
        ),
      ),
      h('h3', { class: 'nx-tour-title', text: t(`tour.steps.${def.key}.title`) }),
      h('p', { class: 'nx-tour-body', text: t(`tour.steps.${def.key}.body`) }),
      h(
        'div',
        { class: 'nx-tour-actions' },
        tryBtn,
        h('span', { class: 'nx-tour-spacer' }),
        !isFirst
          ? h('button', {
              type: 'button',
              class: 'nx-btn is-ghost',
              text: t('tour.back'),
              onclick: () => {
                step--;
                render();
              },
            })
          : null,
        h('button', {
          type: 'button',
          class: 'nx-btn is-ghost',
          dataset: { testid: 'tour-skip' },
          text: t('tour.skip'),
          onclick: () => void finish(true),
        }),
        nextBtn,
      ),
    );
  }

  function start(startStep = 0) {
    step = Math.max(0, Math.min(STEPS.length - 1, startStep));
    if (!card) {
      card = h('aside', {
        class: 'nx-tour',
        role: 'region',
        'aria-label': t('tour.title'),
        dataset: { testid: 'interactive-tour' },
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          void finish(true);
        }
      });
      shell.layers.chrome.append(card);
    }
    render();
  }

  registerCommand(sys, {
    id: 'shell.tour',
    title: 'tour.command',
    icon: 'sparkles',
    category: 'shell',
    run: () => start(0),
  });

  return { start, finish };
}
