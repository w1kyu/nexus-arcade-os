// @ts-check
// Design system v2 components (phase 14.3): small DOM helpers over the classes in controls.css.
// Each returns a plain element; state lives in the caller. Catalogue: docs/design-system.md.
import { h, icon } from './dom.js';

/**
 * Segmented control: a radio group of 2–5 short options.
 * @template {string} V
 * @param {{ label: string, options: { value: V, label: string, icon?: string }[], value: V, onChange: (value: V) => void }} options
 */
export function segmented({ label, options, value, onChange }) {
  const group = h('div', { class: 'nx-segmented', role: 'radiogroup', 'aria-label': label });
  const buttons = options.map((opt) =>
    h(
      'button',
      {
        type: 'button',
        role: 'radio',
        'data-value': opt.value,
        onclick: () => {
          select(opt.value);
          onChange(opt.value);
        },
      },
      opt.icon ? icon(opt.icon, { size: 14 }) : null,
      opt.label,
    ),
  );
  /** @param {V} next */
  function select(next) {
    for (const btn of buttons) {
      const on = btn.dataset.value === next;
      btn.setAttribute('aria-checked', String(on));
      btn.tabIndex = on ? 0 : -1;
    }
  }
  group.addEventListener('keydown', (e) => {
    const i = buttons.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = buttons[(i + step + buttons.length) % buttons.length];
    next.focus();
    next.click();
  });
  group.append(...buttons);
  select(value);
  return Object.assign(group, { select });
}

/**
 * Tabs with roving focus. Panels are the caller's: `onChange` shows the right one.
 * @template {string} V
 * @param {{ label: string, tabs: { value: V, label: string, controls?: string }[], value: V, onChange: (value: V) => void }} options
 */
export function tabs({ label, tabs: items, value, onChange }) {
  const list = h('div', { class: 'nx-tabs', role: 'tablist', 'aria-label': label });
  const buttons = items.map((tab) =>
    h('button', {
      type: 'button',
      role: 'tab',
      text: tab.label,
      'data-value': tab.value,
      'aria-controls': tab.controls,
      onclick: () => {
        select(tab.value);
        onChange(tab.value);
      },
    }),
  );
  /** @param {V} next */
  function select(next) {
    for (const btn of buttons) {
      const on = btn.dataset.value === next;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
    }
  }
  list.addEventListener('keydown', (e) => {
    const i = buttons.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: buttons.length - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const next = buttons[(keys[/** @type {keyof typeof keys} */ (e.key)] + buttons.length) % buttons.length];
    next.focus();
    next.click();
  });
  list.append(...buttons);
  select(value);
  return Object.assign(list, { select });
}

/**
 * A list row: icon, title, optional subtitle and trailing meta. Renders a <button> when clickable.
 * @param {{ title: string, subtitle?: string, meta?: string | Node, icon?: string | Node, selected?: boolean, onClick?: (e: MouseEvent) => void, attrs?: Record<string, any> }} options
 */
export function listRow({ title, subtitle, meta, icon: lead, selected, onClick, attrs = {} }) {
  return h(
    onClick ? 'button' : 'div',
    {
      class: 'nx-list-row',
      type: onClick ? 'button' : undefined,
      onclick: onClick,
      'aria-selected': selected === undefined ? undefined : String(selected),
      ...attrs,
    },
    typeof lead === 'string' ? icon(lead, { size: 18 }) : (lead ?? null),
    h(
      'span',
      { class: 'nx-list-row-text' },
      h('span', { text: title }),
      subtitle ? h('span', { class: 'nx-list-row-sub', text: subtitle }) : null,
    ),
    meta === undefined ? null : h('span', { class: 'nx-list-row-meta' }, meta),
  );
}

/**
 * A card: optional title, then content.
 * @param {{ title?: string, sunken?: boolean, attrs?: Record<string, any> }} options
 * @param {...(Node | string | null | undefined | false)} children
 */
export function panel({ title, sunken, attrs = {} }, ...children) {
  return h(
    'section',
    { class: `nx-panel${sunken ? ' is-sunken' : ''}`, ...attrs },
    title ? h('h3', { class: 'nx-panel-title', text: title }) : null,
    ...children,
  );
}

/**
 * Status label. `tone` picks the soft background with its readable text color.
 * @param {string} text
 * @param {'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'} [tone]
 */
export function badge(text, tone = 'neutral') {
  return h('span', { class: `nx-badge is-${tone}`, text });
}

/**
 * Empty state: what is missing and one next action.
 * @param {{ icon?: string, title: string, text?: string, action?: HTMLElement }} options
 */
export function emptyState({ icon: iconName = 'info', title, text, action }) {
  return h(
    'div',
    { class: 'nx-empty', role: 'status' },
    h('span', { class: 'nx-empty-icon', 'aria-hidden': 'true' }, icon(iconName, { size: 24 })),
    h('p', { class: 'nx-empty-title', text: title }),
    text ? h('p', { text }) : null,
    action ?? null,
  );
}

/**
 * Loading placeholder lines. Show after 150–300 ms, keep ≥ 300 ms (rule 11).
 * @param {{ lines?: number, label: string }} options
 */
export function skeleton({ lines = 3, label }) {
  return h(
    'div',
    { role: 'status', 'aria-label': label, 'aria-busy': 'true' },
    ...Array.from({ length: lines }, (_, i) =>
      h('span', { class: 'nx-skeleton is-text', style: { width: `${i === lines - 1 ? 60 : 100}%` } }),
    ),
  );
}

/**
 * Slider with its formatted value next to it.
 * @param {{ label: string, min: number, max: number, step?: number, value: number, format?: (v: number) => string, onInput: (v: number) => void }} options
 */
export function rangeField({ label, min, max, step = 1, value, format = String, onInput }) {
  const input = h('input', {
    class: 'nx-slider',
    type: 'range',
    min,
    max,
    step,
    'aria-label': label,
  });
  input.value = String(value);
  const out = h('output', { text: format(value) });
  input.addEventListener('input', () => {
    out.textContent = format(Number(input.value));
    input.setAttribute('aria-valuetext', out.textContent);
    onInput(Number(input.value));
  });
  input.setAttribute('aria-valuetext', format(value));
  return h('div', { class: 'nx-range' }, input, out);
}

/**
 * Labelled form field around a control.
 * @param {{ label: string, hint?: string, error?: string }} options
 * @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} control
 */
export function field({ label, hint, error }, control) {
  const id = control.id || `nx-f-${Math.random().toString(36).slice(2, 9)}`;
  control.id = id;
  const hintId = hint || error ? `${id}-d` : undefined;
  if (hintId) control.setAttribute('aria-describedby', hintId);
  if (error) control.setAttribute('aria-invalid', 'true');
  return h(
    'div',
    { class: 'nx-field' },
    h('label', { for: id, text: label }),
    control,
    hintId ? h('span', { id: hintId, class: error ? 'nx-field-error' : 'nx-field-hint', text: error ?? hint }) : null,
  );
}

/**
 * Toolbar row. Pass `null` for a flexible spacer and `'|'` for a separator.
 * @param {{ label: string, title?: string }} options
 * @param {...(Node | null | '|')} items
 */
export function toolbar({ label, title }, ...items) {
  return h(
    'div',
    { class: 'nx-toolbar', role: 'toolbar', 'aria-label': label },
    title ? h('h2', { class: 'nx-toolbar-title', text: title }) : null,
    ...items.map((item) =>
      item === null
        ? h('span', { class: 'nx-toolbar-spacer' })
        : item === '|'
          ? h('span', { class: 'nx-toolbar-sep', role: 'separator' })
          : item,
    ),
  );
}

/**
 * Status bar at the bottom of a view. `null` is a flexible spacer.
 * @param {...(Node | string | null)} items
 */
export function statusBar(...items) {
  return h(
    'div',
    { class: 'nx-statusbar', role: 'status' },
    ...items.map((item) =>
      item === null
        ? h('span', { class: 'nx-statusbar-spacer' })
        : typeof item === 'string'
          ? h('span', { text: item })
          : item,
    ),
  );
}
