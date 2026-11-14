// @ts-check
// Parses and validates Nexus plugin packages from:
//   - .nexus-plugin / .zip archives (manifest.json + main.js + optional assets)
//   - .nexus-plugin JSON bundles
//   - VFS folders containing manifest.json + main.js
//   - Single .js files containing an @nexus-plugin { ... } metadata header
import { strFromU8, unzipSync } from 'fflate';
import { validateManifest } from '../../kernel/manifest.js';

/** @typedef {import('../../kernel/types').L10n} L10n */
/** @typedef {import('../../kernel/types').AppManifest} AppManifest */

export class PluginPackageError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'PluginPackageError';
  }
}

/**
 * Normalizes a string or { en, de } object into L10n.
 * @param {unknown} v
 * @returns {L10n | undefined}
 */
function toL10n(v) {
  if (typeof v === 'string' && v.trim()) return { en: v, de: v };
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const rec = /** @type {Record<string, unknown>} */ (v);
    const en = typeof rec.en === 'string' ? rec.en : typeof rec.de === 'string' ? rec.de : '';
    const de = typeof rec.de === 'string' ? rec.de : en;
    if (en.trim()) return { en, de };
  }
  return undefined;
}

/**
 * Strips any JS functions and normalizes metadata into structured-cloneable manifest data.
 * Rejects privileged `system` permission.
 * @param {unknown} raw
 */
export function normalizePluginManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new PluginPackageError('Plugin manifest must be a JSON object.');
  }
  const m = structuredClone(/** @type {Record<string, any>} */ (raw));
  if (Array.isArray(m.permissions) && m.permissions.includes('system')) {
    throw new PluginPackageError('Plugins cannot request the "system" permission.');
  }

  m.name = toL10n(m.name);
  m.description = toL10n(m.description) ?? (m.name ? { ...m.name } : undefined);
  m.version = typeof m.version === 'string' ? m.version : '1.0.0';
  m.icon = typeof m.icon === 'string' && m.icon ? m.icon : 'puzzle';
  m.category = typeof m.category === 'string' ? m.category : 'productivity';

  if (Array.isArray(m.commands)) {
    m.commands = m.commands.map((c) => (c && typeof c === 'object' ? { ...c, title: toL10n(c.title) } : c));
  }
  if (Array.isArray(m.terminal)) {
    m.terminal = m.terminal.map((c) => (c && typeof c === 'object' ? { ...c, description: toL10n(c.description) } : c));
  }
  if (Array.isArray(m.settings)) {
    m.settings = m.settings.map((s) =>
      s && typeof s === 'object'
        ? {
            ...s,
            label: toL10n(s.label),
            description: s.description ? toL10n(s.description) : undefined,
            options: Array.isArray(s.options)
              ? s.options.map((/** @type {any} */ o) =>
                  o && typeof o === 'object' ? { ...o, label: toL10n(o.label) } : o,
                )
              : undefined,
          }
        : s,
    );
  }
  if (Array.isArray(m.widgets)) {
    m.widgets = m.widgets.map((w) =>
      w && typeof w === 'object'
        ? {
            ...w,
            title: toL10n(w.title),
            size: Array.isArray(w.size) ? w.size : [2, 2],
          }
        : w,
    );
  }
  if (Array.isArray(m.achievements)) {
    m.achievements = m.achievements.map((a) =>
      a && typeof a === 'object' ? { ...a, title: toL10n(a.title), description: toL10n(a.description) } : a,
    );
  }

  // Validate against kernel manifest validator using dummy async loaders.
  /** @type {Record<string, any>} */
  const stub = {
    ...m,
    load: async () => ({ mount() {} }),
    widgets: Array.isArray(m.widgets)
      ? m.widgets.map((w) => ({ ...w, load: async () => ({ mount() {} }) }))
      : undefined,
  };
  delete stub.main;
  delete stub.styles;
  delete stub.themes;
  delete stub.author;
  delete stub.homepage;

  const problems = validateManifest(/** @type {any} */ (stub));
  if (problems.length) {
    throw new PluginPackageError(`Invalid plugin manifest:\n- ${problems.join('\n- ')}`);
  }

  return m;
}

/**
 * Validates optional theme objects shipped with a plugin.
 * @param {unknown} raw
 * @param {string} pluginId
 */
export function normalizePluginThemes(raw, pluginId) {
  if (!Array.isArray(raw)) return [];
  const COLOR_KEYS = [
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
  /** @type {any[]} */
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = /** @type {Record<string, any>} */ (item);
    if (typeof t.id !== 'string' || !/^[a-z0-9-]+$/.test(t.id)) continue;
    const name = toL10n(t.name);
    if (!name) continue;
    const scheme = t.scheme === 'light' ? 'light' : 'dark';
    const colors = t.colors;
    if (!colors || typeof colors !== 'object') continue;
    if (!COLOR_KEYS.every((k) => typeof colors[k] === 'string' && /^#[0-9a-f]{6}$/i.test(colors[k]))) continue;
    out.push({
      id: `plugin:${pluginId}:${t.id}`,
      rawId: t.id,
      pluginId,
      name,
      scheme,
      glow: typeof t.glow === 'number' ? Math.max(0, Math.min(1, t.glow)) : 0.6,
      colors: Object.fromEntries(COLOR_KEYS.map((k) => [k, colors[k].toLowerCase()])),
    });
  }
  return out;
}

/**
 * Extracts `@nexus-plugin { ... }` metadata JSON from a single-file `.js` plugin.
 * @param {string} source
 * @param {string} [filename]
 */
export function parseSingleFilePlugin(source, filename = 'plugin.js') {
  const blockMatch = source.match(/\/\*[\s\S]*?@nexus-plugin\s*(\{[\s\S]*?\})\s*\*\//);
  const lineMatch = !blockMatch ? source.match(/\/\/\s*@nexus-plugin\s*(\{[^\n]*\})/) : null;
  const rawJson = blockMatch?.[1] ?? lineMatch?.[1];
  if (!rawJson) {
    throw new PluginPackageError(
      `Missing "@nexus-plugin { ... }" metadata block in "${filename}". See docs/plugin-sdk.md.`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new PluginPackageError(`Invalid JSON in @nexus-plugin header: ${/** @type {Error} */ (err).message}`);
  }
  const manifestData = normalizePluginManifest(parsed);
  const themes = normalizePluginThemes(parsed.themes, manifestData.id);
  return {
    manifestData,
    code: source,
    css: typeof parsed.css === 'string' ? parsed.css : '',
    widgetCodes: /** @type {Record<string, string>} */ ({}),
    themes,
    help: typeof parsed.help === 'string' ? parsed.help : null,
    changelog: typeof parsed.changelog === 'string' ? parsed.changelog : null,
    messages: parsed.messages && typeof parsed.messages === 'object' ? parsed.messages : null,
  };
}

/**
 * Parses a JSON `.nexus-plugin` bundle `{ manifest, code, ... }`.
 * @param {string} text
 */
export function parseJsonPlugin(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (err) {
    throw new PluginPackageError(`Invalid JSON plugin bundle: ${/** @type {Error} */ (err).message}`);
  }
  if (!obj || typeof obj !== 'object') throw new PluginPackageError('Plugin bundle must be a JSON object.');
  const manifestRaw = obj.manifest ?? obj;
  const manifestData = normalizePluginManifest(manifestRaw);
  const code = typeof obj.code === 'string' ? obj.code : '';
  const hasWidgets = Array.isArray(manifestData.widgets) && manifestData.widgets.length > 0;
  if (!code.trim() && !hasWidgets && !(Array.isArray(obj.themes) && obj.themes.length)) {
    throw new PluginPackageError('Plugin bundle has no executable code.');
  }
  const widgetCodes = /** @type {Record<string, string>} */ ({});
  if (obj.widgetCodes && typeof obj.widgetCodes === 'object') {
    for (const [k, v] of Object.entries(obj.widgetCodes)) {
      if (typeof v === 'string') widgetCodes[k] = v;
    }
  }
  return {
    manifestData,
    code,
    css: typeof obj.css === 'string' ? obj.css : '',
    widgetCodes,
    themes: normalizePluginThemes(obj.themes ?? manifestRaw.themes, manifestData.id),
    help: typeof obj.help === 'string' ? obj.help : null,
    changelog: typeof obj.changelog === 'string' ? obj.changelog : null,
    messages: obj.messages && typeof obj.messages === 'object' ? obj.messages : null,
  };
}

/**
 * Parses a map of relative paths -> file text from a zip or VFS folder.
 * @param {Map<string, string>} files
 */
export function parseFilesMap(files) {
  // Detect optional shared root wrapper directory (e.g. "my-plugin/manifest.json")
  let prefix = '';
  if (!files.has('manifest.json')) {
    const candidate = [...files.keys()].find((k) => k.endsWith('/manifest.json') && k.split('/').length === 2);
    if (candidate) prefix = candidate.slice(0, candidate.length - 'manifest.json'.length);
  }
  const read = (/** @type {string} */ rel) => files.get(prefix + rel.replace(/^\.\//, '')) ?? null;

  const manifestText = read('manifest.json');
  if (!manifestText) throw new PluginPackageError('Plugin package is missing manifest.json.');
  let manifestRaw;
  try {
    manifestRaw = JSON.parse(manifestText);
  } catch (err) {
    throw new PluginPackageError(`Invalid manifest.json: ${/** @type {Error} */ (err).message}`);
  }
  const manifestData = normalizePluginManifest(manifestRaw);

  const mainRel = typeof manifestRaw.main === 'string' ? manifestRaw.main : 'main.js';
  const code = read(mainRel) ?? read('index.js') ?? '';
  const cssRel = typeof manifestRaw.styles === 'string' ? manifestRaw.styles : 'styles.css';
  const css = read(cssRel) ?? '';

  /** @type {Record<string, string>} */
  const widgetCodes = {};
  for (const w of manifestData.widgets ?? []) {
    const wRaw = Array.isArray(manifestRaw.widgets)
      ? manifestRaw.widgets.find((/** @type {any} */ x) => x?.id === w.id)
      : null;
    const wRel =
      typeof wRaw?.entry === 'string' ? wRaw.entry : typeof wRaw?.main === 'string' ? wRaw.main : `widget-${w.id}.js`;
    const wCode = read(wRel) ?? read(`widgets/${w.id}.js`) ?? code;
    if (wCode) widgetCodes[w.id] = wCode;
  }

  let themesRaw = manifestRaw.themes;
  const themesFile = read('themes.json');
  if (!themesRaw && themesFile) {
    try {
      themesRaw = JSON.parse(themesFile);
    } catch {
      themesRaw = [];
    }
  }

  let messages = null;
  const enMsg = read('i18n/en.json');
  const deMsg = read('i18n/de.json');
  if (enMsg || deMsg) {
    try {
      const en = enMsg ? JSON.parse(enMsg) : {};
      const de = deMsg ? JSON.parse(deMsg) : en;
      messages = { en, de };
    } catch {
      messages = null;
    }
  }

  return {
    manifestData,
    code,
    css,
    widgetCodes,
    themes: normalizePluginThemes(themesRaw, manifestData.id),
    help: read('help.md'),
    changelog: read('changelog.md'),
    messages,
  };
}

/**
 * Parses a zip archive (`Uint8Array`) containing a plugin.
 * @param {Uint8Array} bytes
 */
export function parseZipPlugin(bytes) {
  let unzipped;
  try {
    unzipped = unzipSync(bytes);
  } catch (err) {
    throw new PluginPackageError(`Could not unpack zip plugin: ${/** @type {Error} */ (err).message}`);
  }
  /** @type {Map<string, string>} */
  const files = new Map();
  for (const [name, data] of Object.entries(unzipped)) {
    const clean = name.replace(/\\/g, '/');
    if (clean.startsWith('/') || clean.split('/').includes('..') || clean.includes('\0')) {
      throw new PluginPackageError(`Unsafe path in plugin archive: "${name}"`);
    }
    if (!clean.endsWith('/')) files.set(clean, strFromU8(data));
  }
  return parseFilesMap(files);
}

/**
 * Parses a Blob or File (.nexus-plugin, .zip, or .js).
 * @param {Blob} blob
 * @param {string} [filename]
 */
export async function parsePluginBlob(blob, filename = /** @type {File} */ (blob).name ?? 'plugin.nexus-plugin') {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // ZIP magic bytes: PK\x03\x04
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return parseZipPlugin(bytes);
  }
  const text = new TextDecoder().decode(bytes);
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{') && !filename.endsWith('.js')) {
    return parseJsonPlugin(text);
  }
  if (filename.endsWith('.js') || text.includes('@nexus-plugin')) {
    return parseSingleFilePlugin(text, filename);
  }
  if (trimmed.startsWith('{')) {
    return parseJsonPlugin(text);
  }
  throw new PluginPackageError(`Unsupported plugin file "${filename}". Expected .nexus-plugin, .zip, or .js.`);
}

/**
 * Parses a plugin from a VFS file or folder path.
 * @param {import('../vfs/vfs.js').Vfs} vfs
 * @param {string} path
 */
export async function parsePluginFromVfs(vfs, path) {
  const node = await vfs.stat(path);
  if (!node) throw new PluginPackageError(`No such file or folder: ${path}`);
  if (node.type === 'file') {
    const blob = /** @type {Blob} */ (await vfs.readFile(path, { as: 'blob' }));
    return parsePluginBlob(blob, node.name);
  }
  const nodes = await vfs.walk(path);
  /** @type {Map<string, string>} */
  const files = new Map();
  const basePrefix = path.endsWith('/') ? path : `${path}/`;
  for (const n of nodes) {
    if (n.type !== 'file') continue;
    const rel = n.path.startsWith(basePrefix) ? n.path.slice(basePrefix.length) : n.name;
    files.set(rel, await vfs.readText(n.path));
  }
  return parseFilesMap(files);
}
