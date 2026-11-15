// First-boot setup (phase 14.4): name, picture, language, theme and accent on one screen, about
// 20 seconds. Shown as the Welcome window's first step on a new profile; every choice applies
// live and can be changed later in Settings.
import { field, segmented } from '../../ui/components.js';
import { button, h, icon } from '../../ui/dom.js';

const THEMES = ['nexus-hud', 'neon-night', 'arctic-light', 'paper', 'high-contrast'];
const ACCENTS = ['', '#ffb040', '#5ce1ff', '#ff5fa2', '#8b7bff', '#3ddc97', '#ff7a59'];

/**
 * @param {import('../../kernel/types').AppContext} ctx
 * @param {{ name?: string, picture?: Blob | null }} draft  survives re-renders (language switch)
 * @param {() => void} onDone  called after "Start" or "Skip"
 */
export async function renderSetup(ctx, draft, onDone) {
  const { t } = ctx.i18n;
  const system = /** @type {any} */ (ctx.system);
  const profile = await system.profiles.current();
  const settings = system.settings;
  let picture = draft.picture ?? null;

  const name = h('input', {
    class: 'nx-input',
    value: draft.name ?? profile?.name ?? '',
    maxlength: '40',
    autocomplete: 'name',
  });
  name.addEventListener('input', () => (draft.name = name.value));
  const avatar = h('span', { class: 'nx-setup-avatar', 'aria-hidden': 'true' });
  const paintAvatar = () => {
    avatar.replaceChildren();
    if (picture) {
      const img = h('img', { alt: '' });
      img.src = URL.createObjectURL(picture);
      img.onload = () => URL.revokeObjectURL(img.src);
      avatar.append(img);
    } else avatar.textContent = (name.value.trim()[0] ?? '?').toUpperCase();
  };
  name.addEventListener('input', paintAvatar);
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  file.addEventListener('change', () => {
    picture = file.files?.[0] ?? null;
    draft.picture = picture;
    paintAvatar();
  });
  paintAvatar();

  const themeName = (/** @type {string} */ id) => {
    const found = system.theme.list().find((/** @type {any} */ th) => th.id === id);
    return found ? (found.name[ctx.i18n.locale] ?? found.name.en) : id;
  };
  /** A preview strip in the theme's own colors: background, accent, card. @param {string} id */
  const swatch = (id) => {
    const c = system.theme.all().find((/** @type {any} */ th) => th.id === id)?.colors;
    return c
      ? { background: `linear-gradient(90deg, ${c.bg} 0 68%, ${c.accent} 68% 78%, ${c.surface2} 78%)` }
      : undefined;
  };
  const themes = h(
    'div',
    { class: 'nx-setup-themes', role: 'radiogroup', 'aria-label': t('setup.theme') },
    ...THEMES.map((id) =>
      h(
        'button',
        {
          class: 'nx-setup-theme',
          type: 'button',
          role: 'radio',
          'data-theme-id': id,
          'aria-checked': String(settings.get('theme') === id),
          onclick: (/** @type {MouseEvent} */ e) => {
            void settings.set('theme', id);
            for (const b of themes.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
          },
        },
        h('span', { class: 'nx-setup-theme-swatch', style: swatch(id) }),
        themeName(id),
      ),
    ),
  );

  const accents = h(
    'div',
    { class: 'nx-setup-accents', role: 'radiogroup', 'aria-label': t('setup.accent') },
    ...ACCENTS.map((color) =>
      h('button', {
        class: 'nx-setup-accent',
        type: 'button',
        role: 'radio',
        'aria-label': color ? color : t('setup.themeAccent'),
        'data-tooltip': color ? undefined : t('setup.themeAccent'),
        'aria-checked': String((settings.get('accent') ?? '') === color),
        style: color ? { background: color } : undefined,
        onclick: (/** @type {MouseEvent} */ e) => {
          void settings.set('accent', color);
          for (const b of accents.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
        },
      }),
    ),
  );

  const language = segmented({
    label: t('setup.language'),
    value: String(settings.get('language') ?? 'auto'),
    options: [
      { value: 'auto', label: t('setup.languageAuto') },
      { value: 'en', label: 'English' },
      { value: 'de', label: 'Deutsch' },
    ],
    onChange: (value) => void settings.set('language', value),
  });

  async function finish(/** @type {boolean} */ save) {
    if (save) {
      const patch = /** @type {Record<string, unknown>} */ ({});
      if (name.value.trim() && name.value.trim() !== profile?.name) patch.name = name.value.trim();
      const accent = settings.get('accent');
      if (accent) patch.accent = accent;
      if (picture) patch.image = picture;
      if (Object.keys(patch).length) await system.profiles.update(patch).catch(() => {});
    }
    await ctx.storage.kv.set('setupDone', true);
    onDone();
  }

  const group = (/** @type {string} */ label, /** @type {Node} */ control) =>
    h('div', { class: 'nx-setup-row' }, h('span', { class: 'nx-setup-label', text: label }), control);

  return h(
    'form',
    {
      class: 'nx-welcome nx-setup',
      'aria-labelledby': 'nx-setup-title',
      onsubmit: (/** @type {SubmitEvent} */ e) => {
        e.preventDefault();
        void ctx.guard(() => finish(true))();
      },
    },
    h(
      'div',
      { class: 'nx-welcome-head' },
      h('h1', { id: 'nx-setup-title', text: t('setup.title') }),
      h('p', { text: t('setup.lead') }),
    ),
    h(
      'div',
      { class: 'nx-setup-identity' },
      avatar,
      h(
        'div',
        { class: 'nx-setup-identity-fields' },
        field({ label: t('setup.name') }, name),
        button({ label: t('setup.picture'), icon: 'image', size: 'sm', variant: 'ghost', onClick: () => file.click() }),
        file,
      ),
    ),
    group(t('setup.language'), language),
    group(t('setup.theme'), themes),
    group(t('setup.accent'), accents),
    h(
      'div',
      { class: 'nx-setup-actions' },
      h('button', { class: 'nx-btn is-primary is-lg', type: 'submit' }, icon('check', { size: 16 }), t('setup.start')),
      button({ label: t('setup.skip'), variant: 'ghost', onClick: ctx.guard(() => finish(false)) }),
    ),
  );
}
