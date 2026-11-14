// @ts-check
// Settings → Theme Editor: live token editing across the OS, miniature UI preview,
// WCAG AA/AAA contrast audit, wallpaper dominant color & harmony extraction,
// .nexus-theme JSON export/import, window chrome / font / icon customization,
// advanced Custom CSS with safe mode toggle, and .nexus-card.json profile cards.
import { auditThemeContrast, buildThemeColors, extractDominantColors } from '../../../ui/color-extract.js';
import { h, icon } from '../../../ui/dom.js';
import { group, infoRow } from '../form.js';

const TOKEN_KEYS = [
  'bg',
  'surface1',
  'surface2',
  'surface3',
  'border',
  'text1',
  'text2',
  'text3',
  'accent',
  'accent2',
  'success',
  'warning',
  'danger',
  'info',
];

const GRADIENT_SEEDS = {
  aurora: ['#3ef0ff', '#b36bff'],
  sunset: ['#ff7b54', '#ffd166'],
  midnight: ['#4f46e5', '#06b6d4'],
  emerald: ['#10b981', '#0ea5e9'],
  crimson: ['#f43f5e', '#fb923c'],
};

/** @param {Blob} blob */
async function extractColorsFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(null);
      img.onerror = () => reject(new Error('Image load failed'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const c = canvas.getContext('2d');
    if (!c) return ['#3ef0ff', '#b36bff'];
    c.drawImage(img, 0, 0, 64, 64);
    const data = c.getImageData(0, 0, 64, 64).data;
    return extractDominantColors(data, 5);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Picks most vivid color first for primary seed and second for secondary.
 * @param {string[]} hexes
 */
function pickSeedAndSecondary(hexes) {
  const unique = [...new Set(hexes.map((x) => x.toLowerCase()))];
  const score = (/** @type {string} */ hex) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  unique.sort((a, b) => score(b) - score(a));
  return {
    seed: unique[0] ?? '#3ef0ff',
    secondary: unique[1] ?? undefined,
  };
}

/**
 * @param {string} tag
 * @param {Record<string, string>} attrs
 * @param {...SVGElement} children
 */
function svgEl(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

/** @param {string} filename @param {unknown} payload */
function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** @type {import('./types.js').Page} */
export const themeEditor = {
  id: 'themeEditor',
  icon: 'palette',
  keys: ['titlebarStyle', 'windowRadius', 'fontFamily', 'iconStyle', 'customCssSafeMode'],
  async render(pc) {
    const { t, system, ctx } = pc;
    const sysTheme = /** @type {any} */ (system.theme);

    // Handle optional deep link from Color Lab ({ seed, secondary })
    if (pc.link && typeof pc.link.seed === 'string' && /^#[0-9a-f]{6}$/i.test(pc.link.seed)) {
      const seed = pc.link.seed;
      const secondary = typeof pc.link.secondary === 'string' ? pc.link.secondary : undefined;
      delete pc.link.seed;
      delete pc.link.secondary;
      const scheme = sysTheme.currentTheme?.scheme === 'light' ? 'light' : 'dark';
      const colors = buildThemeColors({ seed, secondary, scheme, harmony: 'complementary' });
      await sysTheme.activateCustom({
        id: 'custom',
        name: { en: 'Color Lab Theme', de: 'Color-Lab-Design' },
        scheme,
        glow: 0.7,
        colors,
      });
    }

    const active = structuredClone(sysTheme.currentTheme);
    const hasCustom = Boolean(String(pc.value('customTheme') || '').trim());

    /** @type {{ id: string, name: { en: string, de: string }, scheme: 'dark' | 'light', glow: number, colors: Record<string, string> }} */
    const draft = {
      id: active.id || 'custom',
      name:
        typeof active.name === 'object'
          ? { en: String(active.name.en || 'Custom'), de: String(active.name.de || active.name.en || 'Eigenes') }
          : { en: String(active.name || 'Custom'), de: String(active.name || 'Eigenes') },
      scheme: active.scheme === 'light' ? 'light' : 'dark',
      glow: typeof active.glow === 'number' ? active.glow : 0.7,
      colors: { ...active.colors },
    };

    const previewBox = h('div', { class: 'nx-te-preview', dataset: { testid: 'theme-preview' } });
    const contrastBox = h('div', { class: 'nx-te-contrast', dataset: { testid: 'theme-contrast' } });
    const statusLine = h('p', {
      class: 'nx-set-desc',
      text: hasCustom
        ? t('themeEditor.customActive', { name: pc.local(draft.name) })
        : t('themeEditor.presetActive', { name: pc.local(draft.name) }),
    });

    /** @type {Record<string, { color: HTMLInputElement, text: HTMLInputElement }>} */
    const inputs = {};

    function renderMiniPreview() {
      const c = draft.colors;
      const radius = Number(pc.value('windowRadius') ?? 16);
      const macos = String(pc.value('titlebarStyle') ?? 'windows') === 'macos';
      const glowCss = draft.glow > 0 ? `0 0 20px ${c.accent}33` : 'none';

      const controls = macos
        ? [
            h('span', { class: 'nx-te-dot', style: { background: '#ff5f57' } }),
            h('span', { class: 'nx-te-dot', style: { background: '#febc2e' } }),
            h('span', { class: 'nx-te-dot', style: { background: '#28c840' } }),
          ]
        : [
            h('span', { class: 'nx-te-wbtn', text: '−', style: { color: c.text2 } }),
            h('span', { class: 'nx-te-wbtn', text: '□', style: { color: c.text2 } }),
            h('span', { class: 'nx-te-wbtn', text: '×', style: { color: c.danger } }),
          ];

      const sparkline = svgEl(
        'svg',
        { viewBox: '0 0 180 42', width: '180', height: '42', 'aria-hidden': 'true' },
        svgEl('polyline', {
          fill: 'none',
          stroke: c.accent,
          'stroke-width': '2.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          points: '4,34 28,24 52,29 76,14 102,19 128,8 154,15 176,5',
        }),
        svgEl('polyline', {
          fill: 'none',
          stroke: c.accent2,
          'stroke-width': '1.8',
          'stroke-dasharray': '4 3',
          points: '4,36 36,30 68,20 100,26 136,16 176,12',
        }),
      );

      const frame = h(
        'div',
        {
          class: 'nx-te-mini-win',
          style: {
            background: c.surface1,
            color: c.text1,
            borderColor: c.border,
            borderRadius: `${radius}px`,
            boxShadow: glowCss,
          },
        },
        h(
          'div',
          {
            class: `nx-te-mini-bar${macos ? ' is-macos' : ''}`,
            style: { background: c.surface2, borderBottomColor: c.border },
          },
          h('span', { class: 'nx-te-mini-title', text: pc.local(draft.name), style: { color: c.text1 } }),
          h('span', { class: 'nx-te-mini-controls' }, ...controls),
        ),
        h(
          'div',
          { class: 'nx-te-mini-body' },
          h(
            'div',
            { class: 'nx-te-mini-row' },
            h('span', {
              class: 'nx-te-mini-btn',
              text: t('themeEditor.previewPrimary'),
              style: { background: c.accent, color: draft.scheme === 'dark' ? '#070910' : '#ffffff' },
            }),
            h('span', {
              class: 'nx-te-mini-btn',
              text: t('themeEditor.previewSecondary'),
              style: { background: c.surface3, color: c.text1, borderColor: c.border },
            }),
            h('span', {
              class: 'nx-te-mini-input',
              text: t('themeEditor.previewInput'),
              style: { background: c.bg, color: c.text3, borderColor: c.border },
            }),
          ),
          h(
            'div',
            { class: 'nx-te-mini-row' },
            h(
              'div',
              { class: 'nx-te-mini-chart', style: { background: c.surface2, borderColor: c.border } },
              sparkline,
            ),
            h(
              'div',
              { class: 'nx-te-mini-badges' },
              h('span', { class: 'nx-te-badge', text: 'OK', style: { color: c.success, borderColor: c.success } }),
              h('span', { class: 'nx-te-badge', text: 'WARN', style: { color: c.warning, borderColor: c.warning } }),
              h('span', { class: 'nx-te-badge', text: 'ERR', style: { color: c.danger, borderColor: c.danger } }),
              h('span', { class: 'nx-te-badge', text: 'INFO', style: { color: c.info, borderColor: c.info } }),
            ),
          ),
        ),
      );
      previewBox.replaceChildren(
        h('div', { class: 'nx-te-mini-backdrop', style: { background: c.bg, borderColor: c.border } }, frame),
      );
    }

    function renderContrast() {
      const report = auditThemeContrast(/** @type {any} */ (draft.colors));
      const banner = report.allAA
        ? h(
            'p',
            { class: 'nx-set-success', role: 'status' },
            icon('success', { size: 16 }),
            report.allAAA ? t('themeEditor.contrastAAA') : t('themeEditor.contrastAA'),
          )
        : h(
            'p',
            { class: 'nx-set-warning', role: 'alert' },
            icon('warning', { size: 16 }),
            t('themeEditor.contrastWarn'),
          );

      const grid = h(
        'div',
        { class: 'nx-te-contrast-grid' },
        ...report.checks.map((ch) =>
          h(
            'div',
            { class: `nx-te-contrast-item${ch.passAA ? '' : ' is-fail'}` },
            h('span', { class: 'nx-set-swatch', style: { background: ch.fg } }),
            h('span', { text: t(`themeEditor.tokens.${ch.id}`) }),
            h('strong', { text: `${ch.ratio.toFixed(1)}:1` }),
            h('span', {
              class: 'nx-te-level',
              text: ch.passAAA ? 'AAA' : ch.passAA ? 'AA' : 'FAIL',
            }),
          ),
        ),
      );
      contrastBox.replaceChildren(banner, grid);
    }

    function syncTokenInputs() {
      for (const k of TOKEN_KEYS) {
        const pair = inputs[k];
        if (!pair) continue;
        const val = draft.colors[k] || '#000000';
        pair.color.value = /^#[0-9a-f]{6}$/i.test(val) ? val : '#000000';
        pair.text.value = val;
      }
      renderMiniPreview();
      renderContrast();
    }

    let pushTimer = 0;
    function applyLive(immediate = false) {
      renderMiniPreview();
      renderContrast();
      const push = () => {
        statusLine.textContent = t('themeEditor.customActive', { name: pc.local(draft.name) });
        void sysTheme.activateCustom({ ...draft, id: 'custom' });
      };
      clearTimeout(pushTimer);
      if (immediate) push();
      else pushTimer = window.setTimeout(push, 80);
    }

    // ─── Generator: Wallpaper & Harmony ────────────────────────────────
    const seedInput = h('input', {
      type: 'color',
      class: 'nx-set-color',
      value: draft.colors.accent || '#3ef0ff',
      'aria-label': t('themeEditor.seedColor'),
    });
    const harmonySelect = h(
      'select',
      { class: 'nx-select', 'aria-label': t('themeEditor.harmony') },
      ...['complementary', 'analogous', 'triadic', 'monochromatic'].map((m) =>
        h('option', { value: m, text: t(`themeEditor.harmonies.${m}`) }),
      ),
    );
    const schemeSelect = h(
      'select',
      { class: 'nx-select', 'aria-label': t('themeEditor.scheme') },
      h('option', { value: 'dark', text: t('themeEditor.dark'), selected: draft.scheme === 'dark' }),
      h('option', { value: 'light', text: t('themeEditor.light'), selected: draft.scheme === 'light' }),
    );
    schemeSelect.value = draft.scheme;
    schemeSelect.addEventListener('change', () => {
      draft.scheme = schemeSelect.value === 'light' ? 'light' : 'dark';
      applyLive(true);
    });

    function generateFromSeed(/** @type {string} */ seed, /** @type {string | undefined} */ secondary) {
      draft.colors = buildThemeColors({
        seed,
        secondary,
        scheme: draft.scheme,
        harmony: /** @type {any} */ (harmonySelect.value),
      });
      seedInput.value = seed;
      syncTokenInputs();
      applyLive(true);
    }

    const extractWallpaperBtn = h(
      'button',
      {
        type: 'button',
        class: 'nx-btn',
        dataset: { testid: 'theme-from-wallpaper' },
        onclick: async () => {
          const wp = String(pc.value('wallpaper') ?? '');
          try {
            if (wp.startsWith('image:')) {
              const path = wp.slice('image:'.length);
              const blob = /** @type {Blob} */ (await ctx.fs.readFile(path, { as: 'blob' }));
              const palette = await extractColorsFromBlob(blob);
              const picked = pickSeedAndSecondary(palette);
              generateFromSeed(picked.seed, picked.secondary);
              pc.toast(t('themeEditor.extractedWallpaper'));
              return;
            }
            if (wp.startsWith('gradient:')) {
              const gid = wp.slice('gradient:'.length);
              const pair = GRADIENT_SEEDS[/** @type {keyof typeof GRADIENT_SEEDS} */ (gid)] ?? ['#3ef0ff', '#b36bff'];
              generateFromSeed(pair[0], pair[1]);
              pc.toast(t('themeEditor.extractedWallpaper'));
              return;
            }
            // live:<id> or fallback: sample dominant tones or current accent/accent2
            const liveCanvas = document.querySelector('.nx-wallpaper canvas');
            if (liveCanvas instanceof HTMLCanvasElement && liveCanvas.width > 0 && liveCanvas.height > 0) {
              const sample = document.createElement('canvas');
              sample.width = 48;
              sample.height = 48;
              const sctx = sample.getContext('2d');
              if (sctx) {
                sctx.drawImage(liveCanvas, 0, 0, 48, 48);
                const palette = extractDominantColors(sctx.getImageData(0, 0, 48, 48).data, 5);
                const picked = pickSeedAndSecondary(palette);
                generateFromSeed(picked.seed, picked.secondary);
                pc.toast(t('themeEditor.extractedWallpaper'));
                return;
              }
            }
            generateFromSeed(draft.colors.accent, draft.colors.accent2);
            pc.toast(t('themeEditor.extractedWallpaper'));
          } catch (err) {
            pc.toast(String(/** @type {Error} */ (err).message));
          }
        },
      },
      icon('wallpaper', { size: 16 }),
      t('themeEditor.fromWallpaper'),
    );

    const imageUpload = h('input', { type: 'file', accept: 'image/*', class: 'nx-visually-hidden' });
    imageUpload.addEventListener('change', async () => {
      const f = imageUpload.files?.[0];
      imageUpload.value = '';
      if (!f) return;
      try {
        const palette = await extractColorsFromBlob(f);
        const picked = pickSeedAndSecondary(palette);
        generateFromSeed(picked.seed, picked.secondary);
        pc.toast(t('themeEditor.extractedImage'));
      } catch (err) {
        pc.toast(String(/** @type {Error} */ (err).message));
      }
    });

    // ─── Import / Export .nexus-theme ──────────────────────────────────
    const nameInput = h('input', {
      type: 'text',
      class: 'nx-input',
      value: pc.local(draft.name),
      'aria-label': t('themeEditor.themeName'),
    });
    nameInput.addEventListener('change', () => {
      const n = nameInput.value.trim() || 'Custom';
      draft.name = { en: n, de: n };
      applyLive(true);
    });

    const glowOut = h('output', { class: 'nx-set-value', text: `${Math.round(draft.glow * 100)}%` });
    const glowSlider = h('input', {
      type: 'range',
      class: 'nx-slider',
      min: '0',
      max: '1',
      step: '0.05',
      value: String(draft.glow),
      'aria-label': t('themeEditor.glow'),
    });
    glowSlider.addEventListener('input', () => {
      draft.glow = Number(glowSlider.value);
      glowOut.textContent = `${Math.round(draft.glow * 100)}%`;
      applyLive(false);
    });

    const themeImport = h('input', {
      type: 'file',
      accept: '.nexus-theme,.json,application/json',
      class: 'nx-visually-hidden',
      dataset: { testid: 'theme-import-input' },
    });
    themeImport.addEventListener('change', async () => {
      const file = themeImport.files?.[0];
      themeImport.value = '';
      if (!file) return;
      try {
        const raw = JSON.parse(await file.text());
        if (!raw || typeof raw !== 'object' || !raw.colors || typeof raw.colors !== 'object') {
          throw new Error(t('themeEditor.invalidFile'));
        }
        for (const k of TOKEN_KEYS) {
          if (typeof raw.colors[k] === 'string' && /^#[0-9a-f]{6}$/i.test(raw.colors[k])) {
            draft.colors[k] = raw.colors[k].toLowerCase();
          }
        }
        if (raw.scheme === 'light' || raw.scheme === 'dark') {
          draft.scheme = raw.scheme;
          schemeSelect.value = raw.scheme;
        }
        if (typeof raw.glow === 'number') {
          draft.glow = Math.max(0, Math.min(1, raw.glow));
          glowSlider.value = String(draft.glow);
          glowOut.textContent = `${Math.round(draft.glow * 100)}%`;
        }
        if (raw.name) {
          draft.name =
            typeof raw.name === 'object'
              ? { en: String(raw.name.en || 'Imported'), de: String(raw.name.de || raw.name.en || 'Importiert') }
              : { en: String(raw.name), de: String(raw.name) };
          nameInput.value = pc.local(draft.name);
        }
        syncTokenInputs();
        applyLive(true);
        pc.toast(t('themeEditor.imported'));
      } catch (err) {
        pc.toast(String(/** @type {Error} */ (err).message));
      }
    });

    // ─── Token rows ────────────────────────────────────────────────────
    const tokenGrid = h(
      'div',
      { class: 'nx-te-tokens' },
      ...TOKEN_KEYS.map((key) => {
        const currentHex = draft.colors[key] || '#000000';
        const color = h('input', {
          type: 'color',
          class: 'nx-set-color',
          value: /^#[0-9a-f]{6}$/i.test(currentHex) ? currentHex : '#000000',
          'aria-label': t(`themeEditor.tokens.${key}`),
        });
        const text = h('input', {
          type: 'text',
          class: 'nx-input nx-te-hex',
          value: currentHex,
          spellcheck: 'false',
          'aria-label': `${t(`themeEditor.tokens.${key}`)} hex`,
        });
        inputs[key] = { color, text };

        color.addEventListener('input', () => {
          draft.colors[key] = color.value.toLowerCase();
          text.value = draft.colors[key];
          applyLive(false);
        });
        text.addEventListener('change', () => {
          const v = text.value.trim().toLowerCase();
          if (/^#[0-9a-f]{6}$/.test(v)) {
            draft.colors[key] = v;
            color.value = v;
            applyLive(true);
          } else {
            text.value = draft.colors[key];
          }
        });

        return h(
          'div',
          { class: 'nx-te-token' },
          h('span', { class: 'nx-te-token-name', text: t(`themeEditor.tokens.${key}`) }),
          h('div', { class: 'nx-te-token-inputs' }, color, text),
        );
      }),
    );

    // ─── Custom CSS (Advanced) ─────────────────────────────────────────
    const cssInput = h('textarea', {
      class: 'nx-input nx-te-css',
      rows: '5',
      spellcheck: 'false',
      'aria-label': t('themeEditor.customCss'),
      placeholder: '/* .nx-win { backdrop-filter: blur(22px); } */',
    });
    cssInput.value = String(pc.value('customCss') ?? '');

    // ─── Profile Cards ─────────────────────────────────────────────────
    const cardPreview = h('div', { class: 'nx-set-preview' });
    const cardImportInput = h('input', {
      type: 'file',
      accept: '.nexus-card,.nexus-card.json,.json,application/json',
      class: 'nx-visually-hidden',
    });
    cardImportInput.addEventListener('change', async () => {
      const f = cardImportInput.files?.[0];
      cardImportInput.value = '';
      if (!f) return;
      try {
        const card = JSON.parse(await f.text());
        if (!card || card.format !== 'nexus-profile-card') throw new Error(t('themeEditor.cardInvalid'));
        const dockCount = Array.isArray(card.dock) ? card.dock.length : 0;
        const widgetCount = Array.isArray(card.widgets) ? card.widgets.length : 0;
        cardPreview.replaceChildren(
          h(
            'dl',
            { class: 'nx-set-keys' },
            h('dt', { text: t('themeEditor.cardName') }),
            h('dd', { text: String(card.name || 'Nexus') }),
            h('dt', { text: t('group.theme') }),
            h('dd', { text: String(card.settings?.theme || 'custom') }),
            h('dt', { text: t('themeEditor.cardLayout') }),
            h('dd', { text: t('themeEditor.cardLayoutValue', { dock: dockCount, widgets: widgetCount }) }),
          ),
          h('button', {
            type: 'button',
            class: 'nx-btn is-primary',
            text: t('themeEditor.cardApply'),
            onclick: async () => {
              const res = await system.profileCard.importCard(card);
              pc.toast(t('themeEditor.cardApplied'));
              if (res.layoutChanged) location.reload();
              else pc.refresh();
            },
          }),
        );
      } catch (err) {
        cardPreview.replaceChildren(
          h('p', { class: 'nx-set-error', role: 'alert', text: String(/** @type {Error} */ (err).message) }),
        );
      }
    });

    renderMiniPreview();
    renderContrast();

    return [
      group(
        t('themeEditor.groupActions'),
        infoRow(t('themeEditor.themeName'), statusLine, h('div', { class: 'nx-set-inline' }, nameInput)),
        h(
          'div',
          { class: 'nx-set-row is-stack' },
          h(
            'div',
            { class: 'nx-set-inline' },
            h('button', {
              type: 'button',
              class: 'nx-btn is-primary',
              text: t('themeEditor.exportTheme'),
              dataset: { testid: 'theme-export' },
              onclick: () => {
                const slug = (pc.local(draft.name) || 'custom').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
                downloadJson(`${slug}.nexus-theme`, {
                  id: slug,
                  name: draft.name,
                  scheme: draft.scheme,
                  glow: draft.glow,
                  colors: draft.colors,
                });
                pc.toast(t('themeEditor.exported'));
              },
            }),
            h('label', { class: 'nx-btn' }, themeImport, icon('upload', { size: 16 }), t('themeEditor.importTheme')),
            h('button', {
              type: 'button',
              class: 'nx-btn is-ghost',
              text: t('themeEditor.resetPreset'),
              dataset: { testid: 'theme-reset' },
              onclick: async () => {
                await sysTheme.activateCustom(null);
                pc.refresh();
              },
            }),
          ),
        ),
      ),
      group(
        t('themeEditor.groupGenerate'),
        h(
          'div',
          { class: 'nx-set-row is-stack' },
          h(
            'div',
            { class: 'nx-set-inline' },
            extractWallpaperBtn,
            h('label', { class: 'nx-btn' }, imageUpload, icon('image', { size: 16 }), t('themeEditor.fromImage')),
          ),
          h(
            'div',
            { class: 'nx-set-inline' },
            h('span', { text: t('themeEditor.seedColor') }),
            seedInput,
            harmonySelect,
            schemeSelect,
            h('button', {
              type: 'button',
              class: 'nx-btn',
              text: t('themeEditor.generate'),
              dataset: { testid: 'theme-generate' },
              onclick: () => generateFromSeed(seedInput.value, undefined),
            }),
          ),
        ),
        infoRow(t('themeEditor.glow'), null, h('div', { class: 'nx-set-range' }, glowSlider, glowOut)),
      ),
      group(t('themeEditor.groupPreview'), h('div', { class: 'nx-set-row is-stack' }, previewBox, contrastBox)),
      group(t('themeEditor.groupTokens'), h('div', { class: 'nx-set-row is-stack' }, tokenGrid)),
      group(
        t('themeEditor.groupChrome'),
        pc.row('titlebarStyle'),
        pc.row('windowRadius'),
        pc.row('fontFamily'),
        pc.row('iconStyle'),
      ),
      group(
        t('themeEditor.groupCss'),
        pc.row('customCssSafeMode'),
        h(
          'div',
          { class: 'nx-set-row is-stack' },
          h('p', { class: 'nx-set-warning' }, icon('warning', { size: 16 }), t('themeEditor.cssWarning')),
          cssInput,
          h(
            'div',
            { class: 'nx-set-inline' },
            h('button', {
              type: 'button',
              class: 'nx-btn is-primary',
              text: t('themeEditor.cssApply'),
              onclick: async () => {
                await pc.set('customCss', cssInput.value);
                pc.toast(t('done.saved'));
              },
            }),
            h('button', {
              type: 'button',
              class: 'nx-btn is-ghost',
              text: t('themeEditor.cssClear'),
              onclick: async () => {
                cssInput.value = '';
                await pc.set('customCss', '');
                pc.toast(t('done.cleared'));
              },
            }),
          ),
        ),
      ),
      group(
        t('themeEditor.groupProfileCard'),
        h(
          'div',
          { class: 'nx-set-row is-stack' },
          h('p', { class: 'nx-set-desc', text: t('themeEditor.cardHint') }),
          h(
            'div',
            { class: 'nx-set-inline' },
            h(
              'button',
              {
                type: 'button',
                class: 'nx-btn',
                dataset: { testid: 'card-export' },
                onclick: async () => {
                  const card = await system.profileCard.exportCard();
                  const slug = String(card.name || 'profile')
                    .toLowerCase()
                    .replace(/[^a-z0-9-]+/g, '-');
                  downloadJson(`${slug}.nexus-card.json`, card);
                  pc.toast(t('themeEditor.cardExported'));
                },
              },
              icon('download', { size: 16 }),
              t('themeEditor.cardExport'),
            ),
            h('label', { class: 'nx-btn' }, cardImportInput, icon('upload', { size: 16 }), t('themeEditor.cardImport')),
          ),
          cardPreview,
        ),
      ),
    ];
  },
};
