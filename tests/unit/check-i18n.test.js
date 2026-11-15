// scripts/check-i18n.js against a small fixture project: it must fail on keys that code uses but
// no message file defines (regression: raw keys like `engine.play` once shipped unnoticed).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '../../scripts/check-i18n.js');
let root = '';

/** @param {Record<string, string>} files relative path → content */
function fixture(files) {
  root = mkdtempSync(join(tmpdir(), 'nx-i18n-'));
  for (const dir of ['src/apps', 'src/games', 'src/dev', 'src/ui']) mkdirSync(join(root, dir), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const run = spawnSync(process.execPath, [script], { env: { ...process.env, I18N_ROOT: root }, encoding: 'utf8' });
  return { code: run.status, out: run.stdout + run.stderr };
}

const messages = (obj) => JSON.stringify(obj);

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('check-i18n', () => {
  it('passes when every used key exists in EN and DE', () => {
    const { code, out } = fixture({
      'src/i18n/en.json': messages({ shell: { title: 'Nexus' } }),
      'src/i18n/de.json': messages({ shell: { title: 'Nexus' } }),
      'src/shell/x.js': "t('shell.title');",
      'src/apps/demo/i18n/en.json': messages({ hud: { score: 'Score', group: { one: 'a', other: 'b' } } }),
      'src/apps/demo/i18n/de.json': messages({ hud: { score: 'Punkte', group: { one: 'a', other: 'b' } } }),
      'src/apps/demo/index.js': "ctx.i18n.t('hud.score'); t('hud.group', { count: 2 }); t(`hud.${x}`);",
    });
    expect(out).not.toContain('✖');
    expect(code).toBe(0);
  });

  it('fails on a key used in code but missing from the message files', () => {
    const { code, out } = fixture({
      'src/i18n/en.json': messages({}),
      'src/i18n/de.json': messages({}),
      'src/ui/visualizer/i18n/en.json': messages({ engine: { play: 'Play' } }),
      'src/ui/visualizer/i18n/de.json': messages({ engine: { play: 'Abspielen' } }),
      'src/ui/visualizer/engine.js': "t('engine.play'); t('engine.speed');",
    });
    expect(out).toContain('src/ui/visualizer: "engine.speed" is used in code but missing');
    expect(out).not.toContain('"engine.play"');
    expect(code).toBe(1);
  });

  it('does not read the namespace argument of system.i18n.t(ns, key) as a key', () => {
    const { code } = fixture({
      'src/i18n/en.json': messages({ crash: { close: 'Close' } }),
      'src/i18n/de.json': messages({ crash: { close: 'Schließen' } }),
      'src/shell/x.js': "sys.i18n.t('system', 'crash.close'); shell.t('anything');",
    });
    expect(code).toBe(0);
  });
});
