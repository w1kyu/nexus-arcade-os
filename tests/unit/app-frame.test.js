// @vitest-environment jsdom
// Design system v2 (phase 14.3): the component helpers keep ARIA state in sync, and the app frame
// collapses its sidebar into a sheet in narrow windows and moves toolbar items into "More".
import { describe, expect, it, vi } from 'vitest';
import { badge, emptyState, field, listRow, rangeField, segmented, tabs, toolbar } from '../../src/ui/components.js';
import { button } from '../../src/ui/dom.js';
import { createAppFrame } from '../../src/ui/frame/app-frame.js';

describe('components', () => {
  it('segmented control is a radio group with arrow-key selection', () => {
    const onChange = vi.fn();
    const el = segmented({
      label: 'View',
      value: 'b',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
      ],
      onChange,
    });
    document.body.append(el);
    const radios = [...el.querySelectorAll('[role="radio"]')];
    expect(el.getAttribute('role')).toBe('radiogroup');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    /** @type {HTMLElement} */ (radios[1]).focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('c');
    expect(radios[2].getAttribute('aria-checked')).toBe('true');
    expect(/** @type {HTMLElement} */ (radios[2]).tabIndex).toBe(0);
    el.remove();
  });

  it('tabs mark the selected tab and wrap with arrows', () => {
    const onChange = vi.fn();
    const el = tabs({
      label: 'Sections',
      value: 'x',
      tabs: [
        { value: 'x', label: 'X' },
        { value: 'y', label: 'Y' },
      ],
      onChange,
    });
    document.body.append(el);
    const [x] = el.querySelectorAll('[role="tab"]');
    /** @type {HTMLElement} */ (x).focus();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith('y');
    expect(x.getAttribute('aria-selected')).toBe('false');
    el.remove();
  });

  it('builds rows, badges, fields, empty states and icon-only buttons with accessible names', () => {
    const row = listRow({ title: 'Inbox', subtitle: 'Now', meta: '12', selected: true, onClick: () => {} });
    expect(row.tagName).toBe('BUTTON');
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.textContent).toBe('InboxNow12');
    expect(badge('Saved', 'success').className).toBe('nx-badge is-success');
    const f = field({ label: 'Email', error: 'Enter an address' }, document.createElement('input'));
    const input = /** @type {HTMLInputElement} */ (f.querySelector('input'));
    expect(f.querySelector('label')?.htmlFor).toBe(input.id);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(
      document
        .createElement('div')
        .appendChild(f)
        .querySelector(`#${input.getAttribute('aria-describedby')}`)?.textContent,
    ).toBe('Enter an address');
    expect(emptyState({ title: 'No notes yet', text: 'Write one.' }).getAttribute('role')).toBe('status');
    const iconOnly = button({ icon: 'settings', title: 'Settings' });
    expect(iconOnly.getAttribute('aria-label')).toBe('Settings');
    expect(iconOnly.className).toBe('nx-btn is-icon');
    expect(button({ label: 'Go', variant: 'primary', size: 'sm' }).className).toBe('nx-btn is-primary is-sm');
  });

  it('range field shows the formatted value', () => {
    const onInput = vi.fn();
    const el = rangeField({ label: 'Volume', min: 0, max: 10, value: 3, format: (v) => `${v} %`, onInput });
    const input = /** @type {HTMLInputElement} */ (el.querySelector('input'));
    input.value = '7';
    input.dispatchEvent(new Event('input'));
    expect(el.querySelector('output')?.textContent).toBe('7 %');
    expect(input.getAttribute('aria-valuetext')).toBe('7 %');
    expect(onInput).toHaveBeenCalledWith(7);
  });
});

/** Fakes layout: the root has `width`; the toolbar fits `fit` px and each visible item takes 100 px. */
function fakeLayout(frame, width, fit = 10_000) {
  Object.defineProperty(frame.root, 'clientWidth', { configurable: true, get: () => width });
  const bar = frame.toolbar;
  Object.defineProperty(bar, 'clientWidth', { configurable: true, get: () => fit });
  Object.defineProperty(bar, 'scrollWidth', {
    configurable: true,
    get: () => [...bar.children].filter((el) => !el.hidden && !el.classList.contains('is-overflowed')).length * 100,
  });
  frame.refresh();
}

describe('createAppFrame', () => {
  const make = (extra = {}) =>
    createAppFrame({
      label: 'Demo',
      locale: 'de',
      toolbar: toolbar(
        { label: 'Tools', title: 'Docs' },
        button({ label: 'One' }),
        button({ label: 'Two' }),
        button({ label: 'Three' }),
      ),
      sidebar: document.createElement('ul'),
      content: document.createElement('div'),
      ...extra,
    });

  it('has a sidebar toggle with a localized name and collapses the sidebar', () => {
    const frame = make();
    document.body.append(frame.root);
    const toggleBtn = /** @type {HTMLElement} */ (frame.root.querySelector('.nx-app-frame-side-toggle'));
    expect(toggleBtn.getAttribute('aria-label')).toBe('Seitenleiste ein- oder ausblenden');
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    toggleBtn.click();
    expect(frame.sidebarOpen).toBe(false);
    expect(frame.root.classList.contains('is-sidebar-collapsed')).toBe(true);
    expect(frame.sidebar?.inert).toBe(true);
    frame.root.remove();
  });

  it('turns the sidebar into a closed sheet in narrow windows; Esc closes it', () => {
    const frame = make();
    document.body.append(frame.root);
    fakeLayout(frame, 500);
    expect(frame.root.classList.contains('is-narrow')).toBe(true);
    expect(frame.sidebarOpen).toBe(false);
    frame.setSidebarOpen(true);
    expect(/** @type {HTMLElement} */ (frame.root.querySelector('.nx-app-frame-scrim')).hidden).toBe(false);
    frame.sidebar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(frame.sidebarOpen).toBe(false);
    fakeLayout(frame, 900);
    expect(frame.sidebarOpen).toBe(true); // back to the wide state the user had
    frame.root.remove();
  });

  it('moves toolbar items that do not fit into the More menu, last first', () => {
    const frame = make();
    document.body.append(frame.root);
    // toggle + title + 3 buttons + More = 600 px when all are visible.
    fakeLayout(frame, 900, 450);
    const more = /** @type {HTMLElement} */ (frame.root.querySelector('.nx-app-frame-more'));
    expect(more.hidden).toBe(false);
    const hidden = [...frame.root.querySelectorAll('.is-overflowed')].map((el) => el.textContent);
    expect(hidden).toEqual(['Two', 'Three']);
    fakeLayout(frame, 900, 10_000);
    expect(more.hidden).toBe(true);
    expect(frame.root.querySelectorAll('.is-overflowed')).toHaveLength(0);
    frame.root.remove();
  });

  it('drops the sidebar column when there is no sidebar', () => {
    const frame = createAppFrame({ label: 'Tool', content: document.createElement('div') });
    expect(frame.root.classList.contains('has-no-sidebar')).toBe(true);
    expect(frame.toolbar).toBeNull();
  });
});
