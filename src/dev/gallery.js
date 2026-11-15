// Component gallery for the debug screen (#debug, dev builds only): every design system v2
// component in the current theme. Developer tool: English only, never shipped.
import {
  badge,
  emptyState,
  field,
  listRow,
  panel,
  rangeField,
  segmented,
  skeleton,
  statusBar,
  tabs,
  toolbar,
} from '../ui/components.js';
import { button, h, iconButton, toggle } from '../ui/dom.js';
import { createAppFrame } from '../ui/frame/app-frame.js';

export function componentGallery() {
  const row = (...children) => h('div', { class: 'nx-gallery-row' }, ...children);
  const select = h(
    'select',
    { class: 'nx-select' },
    h('option', { text: 'Nexus HUD' }),
    h('option', { text: 'Arctic Light' }),
  );
  let selected = 'inbox';
  const list = h('div', { class: 'nx-list', role: 'listbox', 'aria-label': 'Folders' });
  const renderList = () =>
    list.replaceChildren(
      ...[
        ['inbox', 'Inbox', 'folder', '12'],
        ['drafts', 'Drafts', 'file-text', '3'],
        ['archive', 'Archive with a long name that has to be cut off', 'archive', '1,204'],
      ].map(([id, title, iconName, meta]) =>
        listRow({
          title,
          subtitle: id === 'inbox' ? 'Updated just now' : undefined,
          icon: iconName,
          meta,
          selected: selected === id,
          attrs: { role: 'option' },
          onClick: () => {
            selected = id;
            renderList();
          },
        }),
      ),
    );
  renderList();

  const frame = createAppFrame({
    label: 'Frame demo',
    toolbar: toolbar(
      { label: 'Demo toolbar', title: 'Documents' },
      button({ label: 'New', icon: 'plus', variant: 'primary', size: 'sm' }),
      button({ label: 'Import…', size: 'sm' }),
      '|',
      iconButton({ icon: 'view-list', label: 'List view', pressed: true }),
      iconButton({ icon: 'view-details', label: 'Details view', pressed: false }),
      null,
      button({ label: 'Share…', icon: 'share', variant: 'ghost', size: 'sm' }),
    ),
    sidebar: h('div', {}, h('p', { class: 'nx-gallery-label', text: 'Sidebar' }), list.cloneNode(true)),
    content: h('div', { style: 'padding: 16px' }, skeleton({ lines: 4, label: 'Loading' })),
    status: statusBar('3 items', null, 'Saved'),
  });
  frame.root.style.height = '260px';
  frame.root.style.border = '1px solid var(--border)';
  frame.root.style.borderRadius = 'var(--radius-md)';

  return h(
    'div',
    { class: 'nx-gallery' },
    h('p', { class: 'nx-gallery-label', text: 'Buttons' }),
    row(
      button({ label: 'Primary', variant: 'primary' }),
      button({ label: 'Secondary' }),
      button({ label: 'Ghost', variant: 'ghost' }),
      button({ label: 'Delete…', icon: 'trash', variant: 'danger' }),
      button({ icon: 'settings', title: 'Settings' }),
      button({ label: 'Small', size: 'sm' }),
      button({ label: 'Large', size: 'lg' }),
    ),
    h('p', { class: 'nx-gallery-label', text: 'Segmented, tabs, toggle, slider' }),
    row(
      segmented({
        label: 'View',
        value: 'week',
        options: [
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ],
        onChange: () => {},
      }),
      toggle({ label: 'Notifications', checked: true, onChange: () => {} }),
      h(
        'div',
        { style: 'width: 220px' },
        rangeField({
          label: 'Volume',
          min: 0,
          max: 100,
          value: 60,
          format: (v) => `${v} %`,
          onInput: () => {},
        }),
      ),
    ),
    tabs({
      label: 'Sections',
      value: 'general',
      tabs: [
        { value: 'general', label: 'General' },
        { value: 'sharing', label: 'Sharing' },
        { value: 'advanced', label: 'Advanced' },
      ],
      onChange: () => {},
    }),
    h('p', { class: 'nx-gallery-label', text: 'Fields' }),
    row(
      field({ label: 'Name', hint: 'Shown on your profile' }, h('input', { class: 'nx-input', value: 'Ada' })),
      field({ label: 'Email', error: 'Enter an address like name@example.com' }, h('input', { class: 'nx-input' })),
      field({ label: 'Theme' }, select),
    ),
    h('p', { class: 'nx-gallery-label', text: 'Badges, kbd' }),
    row(
      ...['neutral', 'accent', 'success', 'warning', 'danger', 'info'].map((tone) =>
        badge(tone[0].toUpperCase() + tone.slice(1), /** @type {any} */ (tone)),
      ),
      h('span', { class: 'nx-badge', text: '3' }),
      h('kbd', { class: 'nx-kbd', text: 'Ctrl' }),
      h('kbd', { class: 'nx-kbd', text: 'K' }),
    ),
    h('p', { class: 'nx-gallery-label', text: 'List rows, panels, empty state' }),
    h(
      'div',
      { class: 'nx-gallery-grid' },
      panel({ title: 'Folders' }, list),
      panel(
        { title: 'Empty', sunken: true },
        emptyState({
          icon: 'note',
          title: 'No notes yet',
          text: 'Notes you write show up here.',
          action: button({ label: 'New note', icon: 'plus', variant: 'primary' }),
        }),
      ),
    ),
    h('p', { class: 'nx-gallery-label', text: 'App frame (toolbar overflows into More when narrow)' }),
    frame.root,
  );
}
