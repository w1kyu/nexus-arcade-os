// App Center: every built-in app by category, with size and permissions. "Uninstall" hides an
// app everywhere (launcher, dock, search, palette), optionally with its data; "Install" shows
// it again. Each app has a page with screenshots, changelog, settings and "Clear data".
// Nothing runs at import time.
import { h, icon } from '../../ui/dom.js';
import { renderMarkdownInto } from '../../ui/markdown.js';
import { openModal } from '../../ui/overlay.js';
import './styles.css';

const CATEGORIES = /** @type {const} */ ([
  'productivity',
  'study',
  'office',
  'dev',
  'cslab',
  'games',
  'media',
  'ai',
  'system',
]);
/** The App Center can't hide itself: nothing could bring it back. */
const PROTECTED = new Set(['nexus.appcenter']);

/** @type {import('../../kernel/types').AppModule['commands']} */
export const commands = {
  'appcenter.open': (ctx) => ctx.commands.execute('shell.launchApp', { appId: 'nexus.appcenter' }),
};

/** @type {import('../../kernel/types').AppModule['mount']} */
export function mount(container, ctx, args) {
  const t = (/** @type {string} */ key, /** @type {Record<string, unknown>} */ vars) => ctx.i18n.t(key, vars);
  const system = /** @type {NonNullable<typeof ctx.system>} */ (ctx.system);
  const local = (/** @type {import('../../kernel/types').L10n} */ text) => text[ctx.i18n.locale] ?? text.en;
  const saved = /** @type {{ category?: string, app?: string } | undefined} */ (args.restoredState);
  let category = saved?.category ?? 'all';
  /** @type {string | null} */
  let detail = saved?.app ?? null;
  /** @type {Record<string, number>} */
  let codeSizes = {};
  /** @type {Map<string, number>} */
  let dataSizes = new Map();
  let token = 0;

  const search = h('input', {
    class: 'nx-input',
    type: 'search',
    placeholder: t('search'),
    'aria-label': t('search'),
    dataset: { testid: 'appcenter-search' },
  });
  const nav = h('nav', { class: 'nx-ac-nav', 'aria-label': t('categories') });
  const main = h('main', { class: 'nx-ac-main', tabindex: '-1' });
  const root = h(
    'div',
    { class: 'nx-ac', dataset: { testid: 'appcenter' } },
    h('aside', { class: 'nx-ac-side' }, search, nav),
    main,
  );
  container.replaceChildren(root);

  const apps = () =>
    system.apps
      .list({ includeDisabled: true })
      .sort((a, b) => local(a.name).localeCompare(local(b.name), ctx.i18n.locale));
  const size = (/** @type {number} */ n) => ctx.i18n.bytes(n);

  async function loadSizes() {
    const [code, usage] = await Promise.all([
      system.apps.codeSizes().catch(() => ({})),
      system.storage.usage().catch(() => null),
    ]);
    codeSizes = code;
    dataSizes = new Map((usage?.apps ?? []).map((a) => [a.id, a.bytes]));
  }

  const pluginFileInput = h('input', {
    type: 'file',
    class: 'nx-visually-hidden',
    accept: '.nexus-plugin,.zip,.js',
    'aria-label': t('installPluginFile'),
    dataset: { testid: 'appcenter-plugin-input' },
  });

  async function installFromComputer(/** @type {File} */ file) {
    try {
      const info = await system.plugins.installFromFile(file, file.name);
      ctx.notify({ title: t('installed', { name: local(info.name) }), timeoutMs: 3000 });
      category = 'plugins';
      detail = info.id;
      render();
    } catch (err) {
      await /** @type {any} */ (ctx.dialog).alert(
        t('installFailed', { error: String(/** @type {Error} */ (err)?.message ?? err) }),
      );
    }
  }

  async function installFromVfs() {
    const devMode = h('input', { type: 'checkbox' });
    const picked = await /** @type {any} */ (ctx.dialog).openFile({
      title: t('installPluginVfs'),
      accept: ['.nexus-plugin', '.zip', '.js'],
      startIn: `${ctx.fs.home}`,
    });
    const path = Array.isArray(picked) ? picked[0] : picked;
    if (!path) return;
    const useDev = await openModal({
      title: t('installPluginVfs'),
      body: h(
        'div',
        { class: 'nx-ac-form' },
        h('p', { text: path }),
        h('label', { class: 'nx-ac-check' }, devMode, t('devModeLabel')),
      ),
      actions: [
        { label: t('cancel'), value: false },
        { label: t('install'), value: true, variant: 'primary' },
      ],
      dismissValue: false,
    });
    if (!useDev) return;
    try {
      const info = await system.plugins.installFromVfs(path, { devMode: devMode.checked });
      ctx.notify({ title: t('installed', { name: local(info.name) }), timeoutMs: 3000 });
      category = 'plugins';
      detail = info.id;
      render();
    } catch (err) {
      await /** @type {any} */ (ctx.dialog).alert(
        t('installFailed', { error: String(/** @type {Error} */ (err)?.message ?? err) }),
      );
    }
  }

  pluginFileInput.addEventListener('change', () => {
    const f = pluginFileInput.files?.[0];
    pluginFileInput.value = '';
    if (f) void installFromComputer(f);
  });

  function renderNav() {
    const list = apps();
    const counts = new Map(CATEGORIES.map((c) => [c, list.filter((a) => a.category === c).length]));
    const pluginCount = list.filter((a) => a.isPlugin).length;
    const item = (/** @type {string} */ id, /** @type {string} */ label, /** @type {number} */ count) =>
      h(
        'li',
        {},
        h(
          'button',
          {
            type: 'button',
            class: `nx-ac-cat${id === category && !detail ? ' is-current' : ''}`,
            'aria-current': id === category && !detail ? 'page' : undefined,
            dataset: { category: id },
            onclick: () => {
              category = id;
              detail = null;
              render();
            },
          },
          h('span', { text: label }),
          h('span', { class: 'nx-ac-count', text: String(count) }),
        ),
      );
    nav.replaceChildren(
      h(
        'ul',
        {},
        item('all', t('all'), list.length),
        item('plugins', t('pluginCategory'), pluginCount),
        ...CATEGORIES.filter((c) => counts.get(c)).map((c) => item(c, t(`category.${c}`), counts.get(c) ?? 0)),
        item('hidden', t('hiddenApps'), list.filter((a) => !a.enabled).length),
      ),
      h(
        'div',
        { class: 'nx-ac-plugin-box' },
        h('p', { class: 'nx-ac-plugins', text: t('plugins') }),
        pluginFileInput,
        h('button', {
          type: 'button',
          class: 'nx-btn',
          text: t('installPluginFile'),
          dataset: { testid: 'appcenter-install-plugin' },
          onclick: () => pluginFileInput.click(),
        }),
        h('button', {
          type: 'button',
          class: 'nx-btn is-ghost',
          text: t('installPluginVfs'),
          dataset: { testid: 'appcenter-install-vfs' },
          onclick: () => void installFromVfs(),
        }),
      ),
    );
  }

  function render() {
    renderNav();
    ctx.window?.stateChanged();
    if (detail) return void showDetail(detail);
    const q = search.value.trim().toLowerCase();
    const list = apps().filter(
      (a) =>
        (category === 'all' ||
          (category === 'plugins' ? a.isPlugin : category === 'hidden' ? !a.enabled : a.category === category)) &&
        (!q || `${local(a.name)} ${local(a.description)} ${a.keywords.join(' ')}`.toLowerCase().includes(q)),
    );
    const title =
      category === 'all'
        ? t('all')
        : category === 'plugins'
          ? t('pluginCategory')
          : category === 'hidden'
            ? t('hiddenApps')
            : t(`category.${category}`);
    ctx.window?.setTitle(`${title} — ${t('title')}`);
    main.replaceChildren(
      h('h2', { class: 'nx-ac-heading', text: title }),
      list.length
        ? h('ul', { class: 'nx-ac-grid', dataset: { testid: 'appcenter-grid' } }, ...list.map(card))
        : h('p', {
            class: 'nx-empty',
            text: category === 'hidden' ? t('noneHidden') : category === 'plugins' ? t('nonePlugins') : t('noMatch'),
          }),
    );
  }

  /** @param {ReturnType<typeof apps>[number]} a */
  function card(a) {
    return h(
      'li',
      { class: `nx-ac-card${a.enabled ? '' : ' is-hidden'}`, dataset: { app: a.id, testid: 'appcenter-card' } },
      h(
        'button',
        {
          type: 'button',
          class: 'nx-ac-card-main',
          onclick: () => open(a.id),
          'aria-label': t('details', { name: local(a.name) }),
        },
        h('span', { class: 'nx-ac-icon' }, icon(a.icon, { size: 28 })),
        h(
          'span',
          { class: 'nx-ac-card-text' },
          h('strong', { text: local(a.name) }),
          h('span', { class: 'nx-ac-desc', text: local(a.description) }),
          h('span', { class: 'nx-ac-meta', text: meta(a) }),
        ),
      ),
      !a.enabled
        ? h('span', { class: 'nx-badge', text: t('hidden') })
        : a.isPlugin
          ? h('span', { class: 'nx-badge', text: t('pluginBadge') })
          : null,
    );
  }

  /** "1.0.0 · 48 KB · 2 permissions". @param {ReturnType<typeof apps>[number]} a */
  function meta(a) {
    const parts = [a.version];
    if (codeSizes[a.id]) parts.push(t('codeSize', { size: size(codeSizes[a.id] ?? 0) }));
    if (a.permissions.length) parts.push(t('permissionCount', { count: a.permissions.length }));
    return parts.join(' · ');
  }

  /** @param {string} id */
  function open(id) {
    detail = id;
    render();
  }

  /** @param {string} id */
  async function showDetail(id) {
    const mine = ++token;
    const a = system.apps.get(id);
    if (!a) {
      detail = null;
      return render();
    }
    const pluginMeta = a.isPlugin ? system.plugins?.get(id) : null;
    ctx.window?.setTitle(`${local(a.name)} — ${t('title')}`);
    const [shots, changelog] = await Promise.all([
      system.apps.screenshots(id).catch(() => []),
      system.apps.changelog(id).catch(() => null),
    ]);
    if (mine !== token) return;
    const notes = h('div', { class: 'nx-ac-changelog' });
    if (changelog) void renderMarkdownInto(notes, changelog);
    const data = dataSizes.get(id) ?? 0;

    const actions = h(
      'div',
      { class: 'nx-ac-actions' },
      a.enabled
        ? h('button', {
            type: 'button',
            class: 'nx-btn is-primary',
            text: t('open'),
            onclick: () => void system.windows.launch(id),
          })
        : null,
      a.enabled
        ? PROTECTED.has(id)
          ? null
          : h('button', {
              type: 'button',
              class: 'nx-btn',
              text: t('uninstall'),
              dataset: { testid: 'uninstall' },
              onclick: () => void uninstall(id),
            })
        : h('button', {
            type: 'button',
            class: 'nx-btn is-primary',
            text: t('install'),
            dataset: { testid: 'install' },
            onclick: async () => {
              await system.apps.setEnabled(id, true);
              render();
            },
          }),
      pluginMeta && pluginMeta.source?.kind === 'vfs'
        ? h('button', {
            type: 'button',
            class: 'nx-btn',
            text: t('reloadPlugin'),
            dataset: { testid: 'reload-plugin' },
            onclick: async () => {
              await system.plugins.reload(id);
              ctx.notify({ title: t('reloaded', { name: local(a.name) }), timeoutMs: 2500 });
              render();
            },
          })
        : null,
      a.isPlugin
        ? h('button', {
            type: 'button',
            class: 'nx-btn is-danger',
            text: t('removePlugin'),
            dataset: { testid: 'remove-plugin' },
            onclick: () => void removePlugin(id),
          })
        : null,
      a.settings.length
        ? h('button', {
            type: 'button',
            class: 'nx-btn',
            text: t('settings'),
            onclick: () =>
              void ctx.commands.execute('settings.open', { scope: id, key: a.settings[0]?.key }).catch(() => {}),
          })
        : null,
      !a.isPlugin
        ? h('button', {
            type: 'button',
            class: 'nx-btn is-danger',
            text: t('clearData'),
            dataset: { testid: 'clear-data' },
            disabled: !a.collections.length && !a.settings.length && !data,
            onclick: () => void clearData(id),
          })
        : null,
    );

    const permStatuses = a.isPlugin
      ? new Map((system.permissions?.list(id) ?? []).map((x) => [x.permission, x.status]))
      : null;

    main.replaceChildren(
      h(
        'button',
        { type: 'button', class: 'nx-btn is-ghost nx-ac-back', onclick: () => ((detail = null), render()) },
        icon('arrow-left', { size: 16 }),
        t('back'),
      ),
      h(
        'header',
        { class: 'nx-ac-hero' },
        h('span', { class: 'nx-ac-icon is-large' }, icon(a.icon, { size: 44 })),
        h(
          'div',
          {},
          h('h2', { text: local(a.name), dataset: { testid: 'appcenter-name' } }),
          h('p', { text: local(a.description) }),
          h('p', {
            class: 'nx-ac-meta',
            text: `${t(`category.${a.category}`)} · ${t('version', { version: a.version })}${a.isPlugin ? ` · ${t('pluginBadge')}` : ''}${a.enabled ? '' : ` · ${t('hidden')}`}`,
          }),
        ),
      ),
      actions,
      pluginMeta && pluginMeta.source?.kind === 'vfs'
        ? h(
            'label',
            { class: 'nx-ac-check' },
            h('input', {
              type: 'checkbox',
              checked: pluginMeta.devMode,
              onchange: (/** @type {Event} */ e) =>
                void system.plugins.setDevMode(id, /** @type {HTMLInputElement} */ (e.target).checked),
            }),
            `${t('devModeLabel')} (${pluginMeta.source.path})`,
          )
        : null,
      shots.length
        ? h(
            'section',
            { class: 'nx-ac-section' },
            h('h3', { text: t('screenshots') }),
            h(
              'div',
              { class: 'nx-ac-shots' },
              ...shots.map((src, i) =>
                h('img', { src, alt: t('screenshotAlt', { name: local(a.name), n: i + 1 }), loading: 'lazy' }),
              ),
            ),
          )
        : null,
      h(
        'section',
        { class: 'nx-ac-section' },
        h('h3', { text: t('info') }),
        h(
          'dl',
          { class: 'nx-ac-facts' },
          h('dt', { text: t('codeLabel') }),
          h('dd', { text: codeSizes[id] ? size(codeSizes[id] ?? 0) : '—' }),
          h('dt', { text: t('dataLabel') }),
          h('dd', { text: data ? size(data) : t('noData') }),
          h('dt', { text: t('fileTypes') }),
          h('dd', {
            text:
              a.handles
                .filter((x) => x.action === 'open')
                .flatMap((x) => x.types)
                .join(', ') || '—',
          }),
          h('dt', { text: t('commandsLabel') }),
          h('dd', { text: a.commands.map((c) => local(c.title)).join(', ') || '—' }),
        ),
      ),
      h(
        'section',
        { class: 'nx-ac-section' },
        h('h3', { text: t('permissions') }),
        a.permissions.length
          ? h(
              'ul',
              { class: 'nx-ac-perms', dataset: { testid: 'permissions' } },
              ...a.permissions.map((p) => {
                const st = permStatuses?.get(p);
                return h(
                  'li',
                  {},
                  icon(PERM_ICONS[p] ?? 'shield', { size: 16 }),
                  h('strong', { text: t(`perm.${p}.title`) }),
                  h('span', { text: `${t(`perm.${p}.body`)}${st ? ` (${t(`permState.${st}`)})` : ''}` }),
                );
              }),
            )
          : h('p', { class: 'nx-ac-meta', text: t('noPermissions') }),
        h('p', { class: 'nx-ac-meta', text: a.isPlugin ? t('pluginNote') : t('builtIn') }),
        a.isPlugin && a.permissions.length
          ? h('button', {
              type: 'button',
              class: 'nx-btn is-ghost',
              text: t('managePermissions'),
              onclick: () => void ctx.commands.execute('settings.open', { page: 'apps' }).catch(() => {}),
            })
          : null,
      ),
      changelog ? h('section', { class: 'nx-ac-section' }, h('h3', { text: t('changelog') }), notes) : null,
    );
    main.focus({ preventScroll: true });
  }

  /** @param {string} id */
  async function removePlugin(id) {
    const a = /** @type {NonNullable<ReturnType<typeof system.apps.get>>} */ (system.apps.get(id));
    const wipe = h('input', { type: 'checkbox' });
    const ok = await openModal({
      title: t('removePluginTitle', { name: local(a.name) }),
      body: h(
        'div',
        { class: 'nx-ac-form' },
        h('p', { text: t('removePluginBody') }),
        h('label', { class: 'nx-ac-check' }, wipe, t('uninstallWipe')),
      ),
      actions: [
        { label: t('cancel'), value: false },
        { label: t('removePlugin'), value: true, variant: 'danger' },
      ],
      dismissValue: false,
    });
    if (!ok) return;
    await system.plugins.uninstall(id, { wipeData: wipe.checked });
    detail = null;
    ctx.notify({ title: t('removed', { name: local(a.name) }), timeoutMs: 3000 });
    render();
  }

  /** @param {string} id */
  async function uninstall(id) {
    const a = /** @type {NonNullable<ReturnType<typeof system.apps.get>>} */ (system.apps.get(id));
    const wipe = h('input', { type: 'checkbox', dataset: { testid: 'uninstall-wipe' } });
    const ok = await openModal({
      title: t('uninstallTitle', { name: local(a.name) }),
      body: h(
        'div',
        { class: 'nx-ac-form' },
        h('p', { text: t('uninstallBody') }),
        h('label', { class: 'nx-ac-check' }, wipe, t('uninstallWipe')),
      ),
      actions: [
        { label: t('cancel'), value: false },
        { label: t('uninstall'), value: true, variant: 'danger' },
      ],
      dismissValue: false,
    });
    if (!ok) return;
    if (wipe.checked) await system.apps.clearData(id).catch((e) => ctx.notify({ title: String(e.message) }));
    await system.apps.setEnabled(id, false);
    await loadSizes();
    ctx.notify({ title: t('uninstalled', { name: local(a.name) }), timeoutMs: 3000 });
    render();
  }

  /** @param {string} id */
  async function clearData(id) {
    const a = /** @type {NonNullable<ReturnType<typeof system.apps.get>>} */ (system.apps.get(id));
    const ok = await /** @type {any} */ (ctx.dialog).confirm(t('clearConfirm', { name: local(a.name) }), {
      title: t('clearData'),
      okLabel: t('clearData'),
      danger: true,
    });
    if (!ok) return;
    try {
      await system.apps.clearData(id);
      ctx.notify({ title: t('cleared', { name: local(a.name) }), timeoutMs: 3000 });
    } catch (e) {
      ctx.notify({ title: String(/** @type {Error} */ (e).message) });
    }
    await loadSizes();
    render();
  }

  search.addEventListener('input', () => {
    detail = null;
    render();
  });
  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = /** @type {HTMLElement[]} */ ([...nav.querySelectorAll('.nx-ac-cat')]);
    const i = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (i < 0) return;
    e.preventDefault();
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  });
  ctx.events.on('app:enabled-changed', () => render());
  ctx.events.on('app:registered', () => render());
  ctx.events.on('app:unregistered', () => render());
  ctx.events.on('permissions:changed', () => detail && render());
  ctx.i18n.onChange(() => {
    search.placeholder = t('search');
    render();
  });

  void loadSizes().then(render);
  render();
  return {
    saveState: () => ({ category, app: detail }),
    onIntent: (intent) => {
      const id = /** @type {any} */ (intent.data)?.app;
      if (typeof id === 'string') open(id);
    },
  };
}

/** @type {Record<string, string>} */
const PERM_ICONS = {
  vfs: 'folder',
  notifications: 'bell',
  clipboard: 'paste',
  network: 'globe',
  ai: 'sparkles',
  scheduler: 'alarm',
  intents: 'share',
  system: 'settings',
};
