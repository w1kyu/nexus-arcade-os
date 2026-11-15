// @ts-check
// App scaffold (phase 14.3): toolbar, sidebar, content, inspector and status bar with standard
// paddings. The toolbar sticks to the top and moves what doesn't fit into a "More" menu; the
// sidebar collapses, and in narrow windows (< 640 px wide) it becomes a sheet over the content.
// Layout rules: docs/design-system.md, skill nexus-ui.
import { h, icon } from '../dom.js';
import { openMenu } from '../menu.js';
import './app-frame.css';
import de from './i18n/de.json';
import en from './i18n/en.json';

/** @param {string | (() => string) | undefined} locale */
function texts(locale) {
  const value = typeof locale === 'function' ? locale() : locale;
  return (value === 'de' ? de : en).frame;
}

const NARROW = 640;

/**
 * @typedef {object} AppFrameOptions
 * @property {string} label                    accessible name of the app region
 * @property {string | (() => string)} [locale] 'en' | 'de' (pass `() => ctx.i18n.locale`)
 * @property {HTMLElement} [toolbar]           usually from components.toolbar(); items overflow into a menu
 * @property {HTMLElement} [sidebar]           navigation; collapsible
 * @property {string} [sidebarLabel]
 * @property {HTMLElement} [content]           the main view (scrolls)
 * @property {HTMLElement} [inspector]         details for the selection (hidden in narrow windows unless opened)
 * @property {HTMLElement} [status]            usually from components.statusBar()
 * @property {boolean} [sidebarOpen]           initial state on wide windows (default true)
 * @property {(open: boolean) => void} [onSidebarChange]
 */

/** @param {AppFrameOptions} options */
export function createAppFrame({
  label,
  locale,
  toolbar,
  sidebar,
  sidebarLabel,
  content,
  inspector,
  status,
  sidebarOpen = true,
  onSidebarChange,
}) {
  const s = () => texts(locale);
  const root = h('div', {
    class: `nx-app-frame${sidebar ? '' : ' has-no-sidebar'}`,
    role: 'region',
    'aria-label': label,
  });
  const main = h('div', { class: 'nx-app-frame-content' }, content ?? null);
  /** @type {HTMLElement | null} */
  let side = null;
  /** @type {HTMLButtonElement | null} */
  let sideToggle = null;
  const scrim = h('div', { class: 'nx-app-frame-scrim', hidden: true, onclick: () => setSidebarOpen(false) });
  let wideOpen = sidebarOpen;
  let narrow = false;
  let open = sidebarOpen;

  if (sidebar) {
    side = h('nav', { class: 'nx-app-frame-sidebar', 'aria-label': sidebarLabel ?? label }, sidebar);
    side.id = `nx-frame-side-${Math.random().toString(36).slice(2, 8)}`;
    sideToggle = h(
      'button',
      {
        class: 'nx-icon-btn nx-app-frame-side-toggle',
        type: 'button',
        'aria-controls': side.id,
        'aria-label': s().toggleSidebar,
        'data-tooltip': s().toggleSidebar,
        onclick: () => setSidebarOpen(!open),
      },
      icon('sidebar', { size: 18 }),
    );
    side.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && narrow && open) {
        e.stopPropagation();
        setSidebarOpen(false);
        sideToggle?.focus();
      }
    });
  }

  /** @type {HTMLElement | null} */
  let bar = null;
  /** @type {HTMLButtonElement | null} */
  let more = null;
  if (toolbar || sideToggle) {
    bar = toolbar ?? h('div', { class: 'nx-toolbar', role: 'toolbar', 'aria-label': label });
    bar.classList.add('nx-app-frame-toolbar');
    if (sideToggle) bar.prepend(sideToggle);
    more = h(
      'button',
      {
        class: 'nx-icon-btn nx-app-frame-more',
        type: 'button',
        hidden: true,
        'aria-haspopup': 'menu',
        'aria-label': s().more,
        'data-tooltip': s().more,
        onclick: () => openOverflow(),
      },
      icon('more-horizontal', { size: 18 }),
    );
    bar.append(more);
  }

  const aside = inspector ? h('aside', { class: 'nx-app-frame-inspector' }, inspector) : null;
  root.append(
    ...[bar, side, scrim, main, aside, status ?? null].filter((x) => !!x).map((x) => /** @type {Node} */ (x)),
  );

  /** @param {boolean} next */
  function setSidebarOpen(next) {
    if (!side) return;
    open = next;
    if (!narrow) wideOpen = next;
    root.classList.toggle('is-sidebar-open', open);
    root.classList.toggle('is-sidebar-collapsed', !open);
    sideToggle?.setAttribute('aria-expanded', String(open));
    scrim.hidden = !(narrow && open);
    side.inert = !open;
    if (narrow && open)
      /** @type {HTMLElement | null} */ (side.querySelector('button, [href], input, [tabindex]'))?.focus();
    onSidebarChange?.(open);
  }

  /** Items that can move into the More menu: everything except the sidebar toggle, titles and spacers. */
  const overflowable = () =>
    bar
      ? /** @type {HTMLElement[]} */ (
          [...bar.children].filter(
            (el) =>
              el !== more &&
              el !== sideToggle &&
              !el.matches('.nx-toolbar-title, .nx-toolbar-spacer, [data-overflow="never"]'),
          )
        )
      : [];

  function fitToolbar() {
    if (!bar || !more) return;
    const items = overflowable();
    for (const el of items) el.classList.remove('is-overflowed');
    more.hidden = true;
    if (bar.scrollWidth <= bar.clientWidth + 1) return;
    more.hidden = false;
    for (let i = items.length - 1; i >= 0 && bar.scrollWidth > bar.clientWidth + 1; i--) {
      items[i].classList.add('is-overflowed');
    }
    if (!items.some((el) => el.classList.contains('is-overflowed'))) more.hidden = true;
  }

  function openOverflow() {
    if (!more) return;
    /** @type {import('../menu.js').MenuEntry[]} */
    const entries = [];
    for (const el of overflowable().filter((x) => x.classList.contains('is-overflowed'))) {
      if (el.matches('.nx-toolbar-sep')) {
        if (entries.length && entries.at(-1) !== 'separator') entries.push('separator');
        continue;
      }
      const target = /** @type {HTMLElement} */ (el.matches('button') ? el : (el.querySelector('button') ?? el));
      const name = (target.getAttribute('aria-label') || target.textContent || '').trim();
      if (!name) continue;
      entries.push({
        label: name,
        disabled: /** @type {HTMLButtonElement} */ (target).disabled,
        checked:
          target.getAttribute('aria-pressed') === null ? undefined : target.getAttribute('aria-pressed') === 'true',
        run: () => target.click(),
      });
    }
    if (entries.at(-1) === 'separator') entries.pop();
    const r = more.getBoundingClientRect();
    openMenu(entries, { x: r.left, y: r.bottom + 4, anchor: more, label: s().more });
  }

  function measure() {
    const wasNarrow = narrow;
    narrow = root.clientWidth > 0 && root.clientWidth < NARROW;
    root.classList.toggle('is-narrow', narrow);
    if (narrow !== wasNarrow) setSidebarOpen(narrow ? false : wideOpen);
    fitToolbar();
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null;
  observer?.observe(root);
  setSidebarOpen(open);

  return {
    root,
    toolbar: bar,
    sidebar: side,
    content: main,
    inspector: aside,
    status: status ?? null,
    setSidebarOpen,
    toggleSidebar: () => setSidebarOpen(!open),
    get sidebarOpen() {
      return open;
    },
    /** Re-run the toolbar overflow check after changing toolbar items. */
    refresh: measure,
    destroy: () => observer?.disconnect(),
  };
}
