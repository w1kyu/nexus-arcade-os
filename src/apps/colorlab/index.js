// @ts-check
import { h, icon } from '../../ui/dom.js';
import {
  apcaContrast,
  contrastRatio,
  extractKMeansColors,
  generatePalette,
  parseColor,
  relativeLuminance,
  rgbToCmyk,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  simulateColorBlindness,
} from './color-math.js';
import './styles.css';

/** @type {import('../../kernel/types').AppModule['mount']} */
export async function mount(container, ctx) {
  const t = (/** @type {string} */ k, /** @type {Record<string, unknown>} */ v = {}) => ctx.i18n.t(k, v);
  /** @type {[number, number, number]} */
  let currentRgb = [66, 133, 244]; // Google Blue default

  const root = h('div', { class: 'nx-colorlab-app' });

  // Tabs nav
  const nav = h('nav', { class: 'nx-colorlab-nav' });
  const tabKeys = ['converter', 'palette', 'contrast', 'blindness', 'gradient', 'image'];
  /** @type {Record<string, HTMLButtonElement>} */
  const tabBtns = {};
  /** @type {Record<string, HTMLElement>} */
  const tabPanes = {};

  const content = h('div', { class: 'nx-colorlab-content' });

  for (const key of tabKeys) {
    const btn = h(
      'button',
      { class: `nx-button ghost small${key === 'converter' ? ' primary' : ''}` },
      t(`tabs.${key}`),
    );
    tabBtns[key] = btn;
    btn.addEventListener('click', () => switchTab(key));
    nav.append(btn);

    const pane = h('div', { class: 'nx-colorlab-tab-pane' });
    if (key !== 'converter') pane.hidden = true;
    tabPanes[key] = pane;
    content.append(pane);
  }

  root.append(nav, content);
  container.append(root);

  function switchTab(/** @type {string} */ target) {
    for (const k of tabKeys) {
      tabBtns[k].classList.toggle('primary', k === target);
      tabPanes[k].hidden = k !== target;
    }
  }

  // ─── TAB 1: Converter & Picker ─────────────────────────────────────
  const convPane = tabPanes.converter;
  const convGrid = h('div', { class: 'nx-colorlab-grid-2' });

  // Picker card
  const pickerCard = h('div', { class: 'nx-colorlab-card' });
  const pickerTitle = h(
    'div',
    { class: 'nx-colorlab-card-title' },
    icon('palette', { size: 16 }),
    t('converter.pickerTitle'),
  );

  const previewBox = h('div', { class: 'nx-colorlab-preview-box' });
  const nativeColorInput = h('input', {
    type: 'color',
    value: '#4285f4',
    style: 'width: 100%; height: 38px; cursor: pointer;',
  });

  // Sliders
  const rSlider = h('input', { type: 'range', min: '0', max: '255', value: '66' });
  const gSlider = h('input', { type: 'range', min: '0', max: '255', value: '133' });
  const bSlider = h('input', { type: 'range', min: '0', max: '255', value: '244' });

  const rVal = h('span', { class: 'nx-colorlab-slider-val' }, '66');
  const gVal = h('span', { class: 'nx-colorlab-slider-val' }, '133');
  const bVal = h('span', { class: 'nx-colorlab-slider-val' }, '244');

  const sliderGroup = h(
    'div',
    { style: 'display: flex; flex-direction: column; gap: 8px;' },
    h('div', { class: 'nx-colorlab-slider-row' }, h('span', { class: 'nx-colorlab-slider-label' }, 'R'), rSlider, rVal),
    h('div', { class: 'nx-colorlab-slider-row' }, h('span', { class: 'nx-colorlab-slider-label' }, 'G'), gSlider, gVal),
    h('div', { class: 'nx-colorlab-slider-row' }, h('span', { class: 'nx-colorlab-slider-label' }, 'B'), bSlider, bVal),
  );

  const pickerActions = h('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap;' });
  const useAccentBtn = h(
    'button',
    { class: 'nx-button small primary' },
    icon('sparkles', { size: 14 }),
    t('converter.useAccent'),
  );
  pickerActions.append(useAccentBtn);

  // EyeDropper API where supported
  // @ts-ignore
  if (typeof window !== 'undefined' && 'EyeDropper' in window) {
    const eyeBtn = h(
      'button',
      { class: 'nx-button small ghost' },
      icon('eye', { size: 14 }),
      t('converter.eyedropper'),
    );
    eyeBtn.addEventListener('click', async () => {
      try {
        // @ts-ignore
        const dropper = new window.EyeDropper();
        const res = await dropper.open();
        if (res?.sRGBHex) {
          updateFromColorString(res.sRGBHex);
        }
      } catch {
        // cancelled
      }
    });
    pickerActions.append(eyeBtn);
  }

  pickerCard.append(pickerTitle, previewBox, nativeColorInput, sliderGroup, pickerActions);

  // Formats card
  const formatsCard = h('div', { class: 'nx-colorlab-card' });
  const formatsTitle = h(
    'div',
    { class: 'nx-colorlab-card-title' },
    icon('sliders', { size: 16 }),
    t('converter.valuesTitle'),
  );

  /** @type {Record<string, HTMLInputElement>} */
  const formatInputs = {};
  const formatNames = ['HEX', 'RGB', 'HSL', 'HSV', 'CMYK', 'OKLCH'];

  const formatList = h('div', { style: 'display: flex; flex-direction: column; gap: 8px;' });
  for (const f of formatNames) {
    const inp = h('input', { class: 'nx-colorlab-format-input', spellcheck: 'false' });
    formatInputs[f] = inp;

    const copyBtn = h('button', { class: 'nx-button ghost small', title: 'Copy' }, icon('copy', { size: 14 }));
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(inp.value);
      ctx.notifications?.notify?.({ title: t('converter.copied'), level: 'info' });
    });

    inp.addEventListener('change', () => {
      updateFromColorString(inp.value);
    });

    formatList.append(
      h('div', { class: 'nx-colorlab-format-row' }, h('span', { class: 'nx-colorlab-format-label' }, f), inp, copyBtn),
    );
  }

  formatsCard.append(formatsTitle, formatList);
  convGrid.append(pickerCard, formatsCard);
  convPane.append(convGrid);

  function updateColorUI() {
    const [r, g, b] = currentRgb;
    const hex = rgbToHex(r, g, b);
    const [hVal, sVal, lVal] = rgbToHsl(r, g, b);
    const [hsvH, hsvS, hsvV] = rgbToHsv(r, g, b);
    const [cVal, mVal, yVal, kVal] = rgbToCmyk(r, g, b);
    const [okL, okC, okH] = rgbToOklch(r, g, b);

    previewBox.style.backgroundColor = hex;
    previewBox.textContent = hex;
    // text color based on luminance
    const lum = relativeLuminance(r, g, b);
    previewBox.style.color = lum > 0.4 ? '#000000' : '#ffffff';

    nativeColorInput.value = hex;

    rSlider.value = String(r);
    gSlider.value = String(g);
    bSlider.value = String(b);

    rVal.textContent = String(r);
    gVal.textContent = String(g);
    bVal.textContent = String(b);

    formatInputs.HEX.value = hex;
    formatInputs.RGB.value = `rgb(${r}, ${g}, ${b})`;
    formatInputs.HSL.value = `hsl(${hVal}, ${sVal}%, ${lVal}%)`;
    formatInputs.HSV.value = `hsv(${hsvH}, ${hsvS}%, ${hsvV}%)`;
    formatInputs.CMYK.value = `cmyk(${cVal}%, ${mVal}%, ${yVal}%, ${kVal}%)`;
    formatInputs.OKLCH.value = `oklch(${okL} ${okC} ${okH})`;
  }

  function updateFromColorString(/** @type {string} */ str) {
    const parsed = parseColor(str);
    if (parsed) {
      currentRgb = [parsed[0], parsed[1], parsed[2]];
      updateColorUI();
      updateBlindnessTab();
    }
  }

  nativeColorInput.addEventListener('input', () => {
    updateFromColorString(nativeColorInput.value);
  });

  const onSliderChange = () => {
    currentRgb = [Number(rSlider.value), Number(gSlider.value), Number(bSlider.value)];
    updateColorUI();
    updateBlindnessTab();
  };
  rSlider.addEventListener('input', onSliderChange);
  gSlider.addEventListener('input', onSliderChange);
  bSlider.addEventListener('input', onSliderChange);

  useAccentBtn.addEventListener('click', async () => {
    const hex = rgbToHex(currentRgb[0], currentRgb[1], currentRgb[2]);
    try {
      if (ctx.system?.theme?.setTheme) {
        await ctx.system.theme.setTheme({ accent: hex });
      } else if (ctx.settings?.set) {
        await ctx.settings.set('system', 'accent', hex);
      }
      ctx.notifications?.notify?.({ title: t('converter.accentSet'), level: 'success' });
    } catch {
      // ignore
    }
  });

  // ─── TAB 2: Palette Generator ──────────────────────────────────────
  const palPane = tabPanes.palette;
  const palCard = h('div', { class: 'nx-colorlab-card' });
  const palBar = h('div', { style: 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap;' });

  const harmonySelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'complementary' }, 'Complementary'),
    h('option', { value: 'analogous' }, 'Analogous'),
    h('option', { value: 'triadic' }, 'Triadic'),
    h('option', { value: 'tetradic' }, 'Tetradic'),
    h('option', { value: 'monochromatic' }, 'Monochromatic'),
    h('option', { value: 'shades' }, 'Shades & Tints'),
  );

  const generateBtn = h('button', { class: 'nx-button primary' }, icon('refresh', { size: 14 }), t('palette.generate'));
  const exportCssBtn = h('button', { class: 'nx-button ghost small' }, t('palette.exportCss'));
  const exportJsonBtn = h('button', { class: 'nx-button ghost small' }, t('palette.exportJson'));
  const exportScssBtn = h('button', { class: 'nx-button ghost small' }, t('palette.exportScss'));
  const saveVfsBtn = h(
    'button',
    { class: 'nx-button ghost small' },
    icon('download', { size: 14 }),
    t('palette.saveVfs'),
  );
  const createThemeBtn = h(
    'button',
    { class: 'nx-button primary small' },
    icon('palette', { size: 14 }),
    t('palette.createTheme'),
  );

  palBar.append(
    h('label', { style: 'font-size: 12px; font-weight: 600;' }, t('palette.harmony')),
    harmonySelect,
    generateBtn,
    exportCssBtn,
    exportJsonBtn,
    exportScssBtn,
    saveVfsBtn,
    createThemeBtn,
  );

  const paletteRow = h('div', { class: 'nx-colorlab-palette-row' });
  palCard.append(palBar, paletteRow);
  palPane.append(palCard);

  /** @type {{ hex: string, locked: boolean }[]} */
  let currentPalette = [
    { hex: '#4285f4', locked: false },
    { hex: '#ea4335', locked: false },
    { hex: '#fbbc05', locked: false },
    { hex: '#34a853', locked: false },
    { hex: '#8ab4f8', locked: false },
  ];

  function renderPalette() {
    paletteRow.replaceChildren();
    for (let i = 0; i < currentPalette.length; i++) {
      const item = currentPalette[i];
      const cell = h('div', { class: 'nx-colorlab-palette-cell', style: `background-color: ${item.hex};` });
      const parsed = parseColor(item.hex) || [0, 0, 0, 1];
      const lum = relativeLuminance(parsed[0], parsed[1], parsed[2]);
      cell.style.color = lum > 0.4 ? '#000000' : '#ffffff';

      const label = h('span', {}, item.hex.toUpperCase());
      const lockBtn = h(
        'button',
        { class: 'nx-colorlab-palette-lock', title: item.locked ? t('palette.unlock') : t('palette.lock') },
        icon(item.locked ? 'lock' : 'unlock', { size: 12 }),
      );
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.locked = !item.locked;
        renderPalette();
      });

      cell.addEventListener('click', () => {
        updateFromColorString(item.hex);
        switchTab('converter');
      });

      cell.append(lockBtn, label);
      paletteRow.append(cell);
    }
  }

  generateBtn.addEventListener('click', () => {
    // @ts-ignore
    const harm = harmonySelect.value;
    const baseCol = currentPalette.find((p) => p.locked)?.hex || rgbToHex(currentRgb[0], currentRgb[1], currentRgb[2]);
    const pRgb = parseColor(baseCol) || [66, 133, 244];
    const newHexes = generatePalette([pRgb[0], pRgb[1], pRgb[2]], harm);

    for (let i = 0; i < currentPalette.length; i++) {
      if (!currentPalette[i].locked && newHexes[i]) {
        currentPalette[i].hex = newHexes[i];
      }
    }
    renderPalette();
  });

  exportCssBtn.addEventListener('click', async () => {
    const css = `:root {\n${currentPalette.map((p, i) => `  --color-${i + 1}: ${p.hex};`).join('\n')}\n}`;
    await navigator.clipboard.writeText(css);
    ctx.notifications?.notify?.({ title: t('converter.copied'), level: 'info' });
  });

  exportJsonBtn.addEventListener('click', async () => {
    const json = JSON.stringify({ palette: currentPalette.map((p) => p.hex) }, null, 2);
    await navigator.clipboard.writeText(json);
    ctx.notifications?.notify?.({ title: t('converter.copied'), level: 'info' });
  });

  exportScssBtn.addEventListener('click', async () => {
    const scss = currentPalette.map((p, i) => `$color-${i + 1}: ${p.hex};`).join('\n');
    await navigator.clipboard.writeText(scss);
    ctx.notifications?.notify?.({ title: t('converter.copied'), level: 'info' });
  });

  createThemeBtn.addEventListener('click', () => {
    void ctx.commands?.execute?.('settings.open', {
      page: 'themeEditor',
      seed: currentPalette[0]?.hex,
      secondary: currentPalette[1]?.hex,
    });
  });

  saveVfsBtn.addEventListener('click', async () => {
    try {
      const json = JSON.stringify(
        { palette: currentPalette.map((p) => p.hex), created: new Date().toISOString() },
        null,
        2,
      );
      const filename = `palette-${Date.now()}.json`;
      await ctx.vfs?.writeText?.(`/User/Palettes/${filename}`, json);
      ctx.notifications?.notify?.({ title: t('palette.saved'), level: 'success' });
    } catch {
      // fallback
    }
  });

  renderPalette();

  // ─── TAB 3: Contrast Checker ───────────────────────────────────────
  const contrastPane = tabPanes.contrast;
  const contrastCard = h('div', { class: 'nx-colorlab-card' });

  let txtHex = '#ffffff';
  let bgHex = '#1e293b';

  const contrastPickers = h(
    'div',
    { style: 'display: flex; gap: 16px; flex-wrap: wrap; align-items: center;' },
    h(
      'div',
      { style: 'display: flex; gap: 8px; align-items: center;' },
      h('label', { style: 'font-weight: 600;' }, t('contrast.textColor')),
      h('input', { type: 'color', value: txtHex, id: 'nx-contrast-txt' }),
    ),
    h(
      'div',
      { style: 'display: flex; gap: 8px; align-items: center;' },
      h('label', { style: 'font-weight: 600;' }, t('contrast.bgColor')),
      h('input', { type: 'color', value: bgHex, id: 'nx-contrast-bg' }),
    ),
  );

  const ratioDisplay = h('div', { class: 'nx-colorlab-contrast-score' }, '10.5 : 1');
  const badgeContainer = h('div', { class: 'nx-colorlab-badges' });

  const samplePreview = h(
    'div',
    {
      style: `padding: 24px; border-radius: var(--radius-md); background: ${bgHex}; color: ${txtHex}; display: flex; flex-direction: column; gap: 12px; border: 1px solid var(--border);`,
    },
    h('h3', { style: 'margin: 0; font-size: 20px; font-weight: bold;' }, t('contrast.sampleLarge')),
    h('p', { style: 'margin: 0; font-size: 14px; line-height: 1.5;' }, t('contrast.sampleNormal')),
  );

  contrastCard.append(contrastPickers, ratioDisplay, badgeContainer, samplePreview);
  contrastPane.append(contrastCard);

  function updateContrast() {
    const pTxt = parseColor(txtHex) || [255, 255, 255, 1];
    const pBg = parseColor(bgHex) || [0, 0, 0, 1];
    const ratio = contrastRatio([pTxt[0], pTxt[1], pTxt[2]], [pBg[0], pBg[1], pBg[2]]);
    const apca = apcaContrast([pTxt[0], pTxt[1], pTxt[2]], [pBg[0], pBg[1], pBg[2]]);

    ratioDisplay.textContent = `${ratio.toFixed(2)} : 1`;

    samplePreview.style.backgroundColor = bgHex;
    samplePreview.style.color = txtHex;

    badgeContainer.replaceChildren();

    const normalAA = ratio >= 4.5;
    const normalAAA = ratio >= 7.0;
    const largeAA = ratio >= 3.0;
    const largeAAA = ratio >= 4.5;

    const makeBadge = (/** @type {string} */ label, /** @type {boolean} */ pass) =>
      h('span', { class: `nx-colorlab-badge ${pass ? 'pass' : 'fail'}` }, `${label}: ${pass ? 'PASS' : 'FAIL'}`);

    badgeContainer.append(
      makeBadge('WCAG AA Normal', normalAA),
      makeBadge('WCAG AAA Normal', normalAAA),
      makeBadge('WCAG AA Large', largeAA),
      makeBadge('WCAG AAA Large', largeAAA),
      h('span', { class: 'nx-colorlab-badge pass' }, `${t('contrast.apcaScore')}: ${apca}`),
    );
  }

  contrastPickers.querySelector('#nx-contrast-txt')?.addEventListener('input', (e) => {
    // @ts-ignore
    txtHex = e.target.value;
    updateContrast();
  });
  contrastPickers.querySelector('#nx-contrast-bg')?.addEventListener('input', (e) => {
    // @ts-ignore
    bgHex = e.target.value;
    updateContrast();
  });
  updateContrast();

  // ─── TAB 4: Color Blindness ────────────────────────────────────────
  const blindPane = tabPanes.blindness;
  const blindCard = h('div', { class: 'nx-colorlab-card' });
  const blindList = h('div', { style: 'display: flex; flex-direction: column; gap: 12px;' });
  blindCard.append(blindList);
  blindPane.append(blindCard);

  const blindnessTypes = [
    { key: 'normal', name: t('blindness.normal'), fn: (/** @type {[number, number, number]} */ c) => c },
    {
      key: 'protanopia',
      name: t('blindness.protanopia'),
      fn: (/** @type {[number, number, number]} */ c) => simulateColorBlindness(c, 'protanopia'),
    },
    {
      key: 'deuteranopia',
      name: t('blindness.deuteranopia'),
      fn: (/** @type {[number, number, number]} */ c) => simulateColorBlindness(c, 'deuteranopia'),
    },
    {
      key: 'tritanopia',
      name: t('blindness.tritanopia'),
      fn: (/** @type {[number, number, number]} */ c) => simulateColorBlindness(c, 'tritanopia'),
    },
    {
      key: 'achromatopsia',
      name: t('blindness.achromatopsia'),
      fn: (/** @type {[number, number, number]} */ c) => simulateColorBlindness(c, 'achromatopsia'),
    },
  ];

  function updateBlindnessTab() {
    blindList.replaceChildren();
    for (const b of blindnessTypes) {
      const simulated = b.fn(currentRgb);
      const simHex = rgbToHex(simulated[0], simulated[1], simulated[2]);

      const row = h(
        'div',
        {
          style:
            'display: flex; align-items: center; gap: 16px; background: var(--surface-1); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border);',
        },
        h('div', {
          style: `width: 50px; height: 36px; border-radius: 4px; background: ${simHex}; border: 1px solid var(--border);`,
        }),
        h(
          'div',
          { style: 'flex: 1;' },
          h('div', { style: 'font-weight: 600; font-size: 13px;' }, b.name),
          h(
            'div',
            { style: 'font-size: 11px; font-family: var(--font-mono); color: var(--text-2);' },
            simHex.toUpperCase(),
          ),
        ),
      );
      blindList.append(row);
    }
  }
  updateBlindnessTab();

  // ─── TAB 5: Gradient Builder ───────────────────────────────────────
  const gradPane = tabPanes.gradient;
  const gradCard = h('div', { class: 'nx-colorlab-card' });

  let gradType = 'linear';
  let gradAngle = 90;
  let stop1 = '#4285f4';
  let stop2 = '#ea4335';

  const gradControls = h('div', { style: 'display: flex; gap: 12px; align-items: center; flex-wrap: wrap;' });
  const gradTypeSelect = h(
    'select',
    { class: 'nx-select' },
    h('option', { value: 'linear' }, t('gradient.linear')),
    h('option', { value: 'radial' }, t('gradient.radial')),
    h('option', { value: 'conic' }, t('gradient.conic')),
  );
  const angleSlider = h('input', { type: 'range', min: '0', max: '360', value: '90' });
  const angleLabel = h('span', { style: 'font-family: var(--font-mono); font-size: 12px; min-width: 36px;' }, '90°');

  const stop1Picker = h('input', { type: 'color', value: stop1 });
  const stop2Picker = h('input', { type: 'color', value: stop2 });

  gradControls.append(
    h('label', { style: 'font-size: 12px; font-weight: 600;' }, t('gradient.type')),
    gradTypeSelect,
    h('label', { style: 'font-size: 12px; font-weight: 600;' }, t('gradient.angle')),
    angleSlider,
    angleLabel,
    stop1Picker,
    stop2Picker,
  );

  const gradBox = h('div', { class: 'nx-colorlab-gradient-preview' });
  const cssCode = h('input', { class: 'nx-colorlab-format-input', readonly: 'true', style: 'width: 100%;' });
  const copyCssBtn = h(
    'button',
    { class: 'nx-button small primary' },
    icon('copy', { size: 14 }),
    t('gradient.copyCss'),
  );

  gradCard.append(gradControls, gradBox, h('div', { style: 'display: flex; gap: 8px;' }, cssCode, copyCssBtn));
  gradPane.append(gradCard);

  function updateGradient() {
    let cssVal = '';
    if (gradType === 'linear') {
      cssVal = `linear-gradient(${gradAngle}deg, ${stop1}, ${stop2})`;
    } else if (gradType === 'radial') {
      cssVal = `radial-gradient(circle, ${stop1}, ${stop2})`;
    } else if (gradType === 'conic') {
      cssVal = `conic-gradient(from ${gradAngle}deg, ${stop1}, ${stop2})`;
    }
    gradBox.style.background = cssVal;
    cssCode.value = `background: ${cssVal};`;
  }

  gradTypeSelect.addEventListener('change', () => {
    // @ts-ignore
    gradType = gradTypeSelect.value;
    updateGradient();
  });
  angleSlider.addEventListener('input', () => {
    gradAngle = Number(angleSlider.value);
    angleLabel.textContent = `${gradAngle}°`;
    updateGradient();
  });
  stop1Picker.addEventListener('input', () => {
    stop1 = stop1Picker.value;
    updateGradient();
  });
  stop2Picker.addEventListener('input', () => {
    stop2 = stop2Picker.value;
    updateGradient();
  });
  copyCssBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(cssCode.value);
    ctx.notifications?.notify?.({ title: t('converter.copied'), level: 'info' });
  });
  updateGradient();

  // ─── TAB 6: Extract from Image ─────────────────────────────────────
  const imgPane = tabPanes.image;
  const imgCard = h('div', { class: 'nx-colorlab-card' });

  const openImgBtn = h('button', { class: 'nx-button primary' }, icon('folder', { size: 14 }), t('image.openButton'));
  const imgPreviewCanvas = h('canvas', {
    width: 320,
    height: 200,
    style: 'max-width: 100%; border-radius: 4px; border: 1px solid var(--border); display: none;',
  });
  const extractedSwatches = h('div', { class: 'nx-colorlab-palette-row', style: 'margin-top: 12px; display: none;' });

  imgCard.append(
    h('div', { style: 'display: flex; gap: 12px; align-items: center;' }, openImgBtn),
    imgPreviewCanvas,
    extractedSwatches,
  );
  imgPane.append(imgCard);

  openImgBtn.addEventListener('click', async () => {
    try {
      const file = await ctx.dialog?.openFile?.({ filter: 'image/*' });
      if (file?.path) {
        const bytes = await ctx.vfs?.readBinary?.(file.path);
        if (bytes) {
          const blob = new Blob([bytes]);
          const img = new Image();
          img.src = URL.createObjectURL(blob);
          await img.decode();

          imgPreviewCanvas.style.display = 'block';
          const cCtx = imgPreviewCanvas.getContext('2d');
          if (cCtx) {
            cCtx.drawImage(img, 0, 0, imgPreviewCanvas.width, imgPreviewCanvas.height);
            const imgData = cCtx.getImageData(0, 0, imgPreviewCanvas.width, imgPreviewCanvas.height);
            const colors = extractKMeansColors(imgData.data, 5);

            extractedSwatches.style.display = 'flex';
            extractedSwatches.replaceChildren();
            for (const hex of colors) {
              const cell = h('div', { class: 'nx-colorlab-palette-cell', style: `background-color: ${hex};` });
              cell.append(h('span', {}, hex.toUpperCase()));
              cell.addEventListener('click', () => {
                updateFromColorString(hex);
                switchTab('converter');
              });
              extractedSwatches.append(cell);
            }
            ctx.notifications?.notify?.({ title: t('image.extracted', { count: colors.length }), level: 'success' });
          }
        }
      }
    } catch {
      // fallback
    }
  });

  // Initial render
  updateColorUI();

  return () => {
    root.remove();
  };
}

export const commands = {
  'colorlab.open': (ctx, args) => {
    return ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.colorlab', args });
  },
};

export const terminal = {
  color: async (ctx, io) => {
    const args = io.args || [];
    if (args.length === 0) {
      await ctx.commands?.execute?.('shell.launchApp', { appId: 'nexus.colorlab' });
      return 0;
    }
    const raw = args.join(' ');
    const parsed = parseColor(raw);
    if (!parsed) {
      io.stderr?.(`color: cannot parse color "${raw}"\n`);
      return 1;
    }
    const [r, g, b] = parsed;
    const hex = rgbToHex(r, g, b);
    const [h, s, l] = rgbToHsl(r, g, b);
    const [c, m, y, k] = rgbToCmyk(r, g, b);
    const [okL, okC, okH] = rgbToOklch(r, g, b);

    io.stdout?.(`HEX:   ${hex}\n`);
    io.stdout?.(`RGB:   rgb(${r}, ${g}, ${b})\n`);
    io.stdout?.(`HSL:   hsl(${h}, ${s}%, ${l}%)\n`);
    io.stdout?.(`CMYK:  cmyk(${c}%, ${m}%, ${y}%, ${k}%)\n`);
    io.stdout?.(`OKLCH: oklch(${okL} ${okC} ${okH})\n`);
    return 0;
  },
};
