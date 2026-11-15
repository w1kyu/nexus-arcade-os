// Welcome: first-boot setup (new profiles), then a short tour of the shell with one primary
// action. Nothing runs at import time.
import { button, h, icon } from '../../ui/dom.js';
import { renderSetup } from './setup.js';
import './styles.css';

const TOUR = [
  ['windows', 'window'],
  ['workspaces', 'layers'],
  ['search', 'search'],
  ['personalize', 'palette'],
];

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx, args) {
  const apple = /mac|iphone|ipad/i.test(navigator.platform);
  const mod = apple ? '⌘' : 'Ctrl';
  const keys = [
    ['palette', [mod, 'K']],
    ['launcher', [mod, 'Space']],
    ['snap', [mod, '←↑→↓']],
    ['overview', [mod, '⇧', 'Space']],
    ['switcher', ['Alt', '`']],
    ['lock', [mod, 'L']],
    ['help', [mod, '/']],
  ];
  // The boot opens Welcome with `setup: true` on a brand-new profile.
  let setup = !!args?.setup && !(await ctx.storage.kv.get('setupDone'));
  /** @type {{ name?: string, picture?: Blob | null }} */
  const draft = {};

  const run = (/** @type {string} */ id) => ctx.guard(() => ctx.commands.execute(id));

  const welcome = () => {
    const { t } = ctx.i18n;
    return h(
      'div',
      { class: 'nx-welcome' },
      h('div', { class: 'nx-welcome-head' }, h('h1', { text: t('title') }), h('p', { text: t('lead') })),
      h(
        'div',
        { class: 'nx-welcome-actions' },
        button({
          label: t('actions.tour'),
          icon: 'sparkles',
          variant: 'primary',
          size: 'lg',
          onClick: run('shell.tour'),
        }),
        h(
          'div',
          { class: 'nx-welcome-links' },
          button({
            label: t('actions.palette'),
            icon: 'search',
            variant: 'ghost',
            size: 'sm',
            onClick: run('shell.palette'),
          }),
          button({
            label: t('actions.personalize'),
            icon: 'palette',
            variant: 'ghost',
            size: 'sm',
            onClick: run('shell.personalize'),
          }),
          button({
            label: t('actions.whatsNew'),
            icon: 'star',
            variant: 'ghost',
            size: 'sm',
            onClick: run('shell.whatsNew'),
          }),
          button({
            label: t('actions.demo'),
            icon: 'users',
            variant: 'ghost',
            size: 'sm',
            onClick: run('shell.demoProfile'),
          }),
          button({
            label: t('actions.another'),
            icon: 'plus',
            variant: 'ghost',
            size: 'sm',
            onClick: ctx.guard(() => ctx.commands.execute('shell.launchApp', { appId: ctx.app.id })),
          }),
        ),
      ),
      h(
        'ul',
        { class: 'nx-welcome-tour' },
        ...TOUR.map(([key, iconName]) =>
          h(
            'li',
            {},
            icon(iconName, { size: 20 }),
            h('div', {}, h('strong', { text: t(`tour.${key}.title`) }), h('p', { text: t(`tour.${key}.body`) })),
          ),
        ),
      ),
      h('h2', { text: t('shortcuts') }),
      h(
        'dl',
        { class: 'nx-welcome-keys' },
        ...keys.flatMap(([key, combo]) => [
          h('dt', {}, ...combo.map((k) => h('kbd', { class: 'nx-kbd', text: k }))),
          h('dd', { text: t(`keys.${key}`) }),
        ]),
      ),
    );
  };

  const render = async () => {
    const { t } = ctx.i18n;
    if (setup) {
      const form = await renderSetup(ctx, draft, () => {
        setup = false;
        void render();
      });
      container.replaceChildren(form);
      ctx.window?.setTitle(`${t('setup.windowTitle')} — ${t('appName')}`);
      return;
    }
    container.replaceChildren(welcome());
    container.scrollTop = 0;
    if (container.parentElement) container.parentElement.scrollTop = 0;
    const n = Number(ctx.app.instanceId.split('#')[1] ?? 1);
    ctx.window?.setTitle(n > 1 ? `${t('opened', { n })} — ${t('appName')}` : t('appName'));
  };
  ctx.i18n.onChange(() => void render());
  await render();
  return {};
}
