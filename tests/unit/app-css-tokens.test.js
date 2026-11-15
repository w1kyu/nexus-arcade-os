// Apps listed here style themselves with tokens only, so every theme (light, Paper, High
// Contrast) reaches their UI. Regression: Arcade Hub stayed dark navy in Arctic Light.
// Phase 14.2 replaces this list with a ratchet over every app (scripts/check-tokens.js).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const TOKEN_ONLY_APPS = ['arcade'];
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g;

describe('app CSS uses theme tokens', () => {
  for (const app of TOKEN_ONLY_APPS) {
    it(`${app}/styles.css has no hard-coded colors`, () => {
      const css = readFileSync(resolve(import.meta.dirname, `../../src/apps/${app}/styles.css`), 'utf8');
      const hits = css.split('\n').flatMap((line, i) => (line.match(RAW_COLOR) ? [`${i + 1}: ${line.trim()}`] : []));
      expect(hits).toEqual([]);
    });
  }
});
