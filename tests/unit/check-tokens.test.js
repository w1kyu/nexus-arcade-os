// scripts/check-tokens.js against a fixture project: the ratchet fails when an app's CSS gains
// hard-coded colors, app-local control classes or literal font sizes, and only ever lowers the
// baseline. (Regression it guards: Arcade Hub's 109 hard-coded colors kept it dark in light themes.)
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '../../scripts/check-tokens.js');
let root = '';

/** @param {Record<string, string>} css app → styles.css @param {object} [baseline] */
function setup(css, baseline) {
  root = mkdtempSync(join(tmpdir(), 'nx-tokens-'));
  mkdirSync(join(root, 'scripts'));
  for (const [app, content] of Object.entries(css)) {
    mkdirSync(join(root, 'src/apps', app), { recursive: true });
    writeFileSync(join(root, 'src/apps', app, 'styles.css'), content);
  }
  if (baseline) writeFileSync(join(root, 'scripts/token-baseline.json'), JSON.stringify(baseline));
}
const run = (/** @type {string[]} */ args = []) => {
  const r = spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, TOKENS_ROOT: root },
    encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout + r.stderr };
};
const baselineFile = () => JSON.parse(readFileSync(join(root, 'scripts/token-baseline.json'), 'utf8'));

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('check-tokens', () => {
  it('counts colors, app-local controls and literal font sizes, ignoring comments and shared classes', () => {
    setup({
      demo: `/* #ffffff in a comment */
        .a { color: #fff; background: rgb(0 0 0 / 0.5); border-color: var(--x, #123456); }
        .nx-demo-btn, .nx-demo-btn:hover { font-size: 13px; }
        .nx-demo-search-input { font-size: var(--text-sm); }
        .nx-btn.primary, .nx-input { color: var(--text-1); }`,
      clean: '.b { color: var(--text-1); font-size: var(--text-md); }',
    });
    expect(run().code).toBe(0); // first run creates the baseline
    expect(baselineFile()).toEqual({ apps: { demo: { colors: 3, controls: 2, fontSizes: 1 } } });
  });

  it('fails when a count goes up, also for an app missing from the baseline', () => {
    setup(
      { demo: '.a { color: #fff; color: #000; }', fresh: '.b { color: red; background: #abc; }' },
      { apps: { demo: { colors: 1, controls: 0, fontSizes: 0 } } },
    );
    const { code, out } = run();
    expect(code).toBe(1);
    expect(out).toContain('demo: 2 colors (baseline 1)');
    expect(out).toContain('fresh: 1 colors (baseline 0)');
    expect(run(['--update']).code).toBe(1); // never raises the baseline
  });

  it('passes when counts go down and --update lowers the baseline', () => {
    setup({ demo: '.a { color: var(--text-1); }' }, { apps: { demo: { colors: 4, controls: 1, fontSizes: 2 } } });
    const first = run();
    expect(first.code).toBe(0);
    expect(first.out).toContain('went down');
    expect(run(['--update']).code).toBe(0);
    expect(baselineFile()).toEqual({ apps: {} });
  });
});
