// Design-token ratchet (phase 14.2), part of `npm run lint`. For each app's CSS it counts
//   colors    hard-coded colors (#hex, rgb(), hsl()), including var() fallbacks
//   controls  app-local control classes (.nx-write-btn …; role classes like .nx-calc-key are fine) where src/ui has a shared one
//   fontSizes literal font sizes (px/rem/em) instead of the --text-* tokens
// and compares them with scripts/token-baseline.json. A count may go down, never up, so new
// debt fails the build while old debt is paid off app by app (phase 14.5).
// `node scripts/check-tokens.js --update` writes lowered counts into the baseline (never raises).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.env.TOKENS_ROOT ?? resolve(import.meta.dirname, '..'));
const baselinePath = join(root, 'scripts/token-baseline.json');
const update = process.argv.includes('--update');

const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;
/** Shared primitives in src/ui/controls.css: defining these in an app is fine (overrides). */
const SHARED = new Set(['nx-btn', 'nx-icon-btn', 'nx-input', 'nx-select', 'nx-textarea', 'nx-toggle', 'nx-slider']);
const CONTROL_CLASS = /\.(nx-[\w-]*?(?:btn|button|input|select|textarea|toggle|slider))(?![\w-])/g;
const FONT_SIZE = /font-size\s*:\s*[^;}]*?\d*\.?\d+(?:px|rem|em)\b/g;

/** @param {string} dir @returns {string[]} */
function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') ? [path] : [];
  });
}

/** @param {string} css */
function measure(css) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const controls = new Set([...code.matchAll(CONTROL_CLASS)].map((m) => m[1]).filter((c) => !SHARED.has(c)));
  return {
    colors: code.match(RAW_COLOR)?.length ?? 0,
    controls: controls.size,
    fontSizes: code.match(FONT_SIZE)?.length ?? 0,
  };
}

/** @type {Record<string, { colors: number, controls: number, fontSizes: number }>} */
const current = {};
const appsDir = join(root, 'src/apps');
for (const app of readdirSync(appsDir).sort()) {
  const dir = join(appsDir, app);
  if (!statSync(dir).isDirectory()) continue;
  current[app] = measure(
    cssFiles(dir)
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n'),
  );
}

const METRICS = /** @type {const} */ (['colors', 'controls', 'fontSizes']);
const total = (/** @type {typeof current} */ set, /** @type {(typeof METRICS)[number]} */ m) =>
  Object.values(set).reduce((n, c) => n + c[m], 0);
const summary = METRICS.map((m) => `${total(current, m)} ${m}`).join(', ');
/** @param {typeof current} counts */
function writeBaseline(counts) {
  const apps = Object.fromEntries(Object.entries(counts).filter(([, c]) => c.colors || c.controls || c.fontSizes));
  writeFileSync(baselinePath, `${JSON.stringify({ apps }, null, 2)}\n`);
}

if (!existsSync(baselinePath)) {
  writeBaseline(current);
  console.log(`tokens: baseline created (${summary}).`);
  process.exit(0);
}

/** @type {{ apps: typeof current }} */
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
let errors = 0;
let lowerable = 0;
for (const [app, counts] of Object.entries(current)) {
  const base = baseline.apps[app] ?? { colors: 0, controls: 0, fontSizes: 0 };
  for (const metric of METRICS) {
    if (counts[metric] > base[metric]) {
      console.error(
        `✖ ${app}: ${counts[metric]} ${metric} (baseline ${base[metric]}). Use tokens / shared controls (skill nexus-ui).`,
      );
      errors++;
    } else if (counts[metric] < base[metric]) lowerable++;
  }
}

if (update) {
  if (errors) {
    console.error('Baseline not updated: counts may only go down.');
    process.exit(1);
  }
  writeBaseline(current);
  console.log(`tokens: baseline lowered (${summary}).`);
  process.exit(0);
}
const hint = lowerable ? ` ${lowerable} count(s) went down: run \`node scripts/check-tokens.js --update\`.` : '';
console.log(`tokens: ${Object.keys(current).length} apps, ${summary}; ${errors} over baseline.${hint}`);
process.exit(errors ? 1 : 0);
