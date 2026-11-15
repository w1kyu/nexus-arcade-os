import { describe, expect, it } from 'vitest';
import { ICON_NAMES, ICONS, iconSvg } from '../../src/ui/icons/icons.js';

describe('icon set', () => {
  it('has at least 120 icons (master brief §6)', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(120);
  });

  it.each(ICON_NAMES)('%s uses only basic shapes inside the 24×24 box', (name) => {
    const body = ICONS[name];
    const tags = [...body.matchAll(/<(\w+)/g)].map((m) => m[1]);
    expect(tags.every((t) => ['path', 'circle', 'rect'].includes(t))).toBe(true);
    // Absolute coordinates (rect/circle attributes) stay within the box.
    for (const [, attr, value] of body.matchAll(/\b(x|y|cx|cy|width|height)="(-?[\d.]+)"/g)) {
      expect(Number(value), `${name} ${attr}`).toBeGreaterThanOrEqual(0);
      expect(Number(value), `${name} ${attr}`).toBeLessThanOrEqual(24);
    }
    expect(body).not.toMatch(/script|on\w+=/i);
  });

  it('renders decorative or labelled SVG and tolerates unknown names', () => {
    expect(iconSvg('close')).toContain('aria-hidden="true"');
    expect(iconSvg('close', { label: 'Close "now"' })).toContain('aria-label="Close &#34;now&#34;"');
    expect(iconSvg('does-not-exist')).toContain('<rect');
  });
});

describe('icon names used in the code', () => {
  // Regression (14.5): 29 names (chevronLeft, mic, save, printer, …) rendered as blank squares.
  it('every literal icon name in apps, shell and games exists', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (/** @type {string} */ d) =>
      readdirSync(d).flatMap((n) => {
        const p = join(d, n);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
      });
    const root = join(import.meta.dirname, '../../src');
    const missing = [];
    for (const file of ['apps', 'shell', 'games', 'ui'].flatMap((d) => walk(join(root, d)))) {
      const code = readFileSync(file, 'utf8');
      for (const m of code.matchAll(/(?:icon\(\s*|icon:\s*|iconName:\s*|iconSvg\(\s*)'([A-Za-z0-9-]+)'/g))
        if (!ICONS[m[1]]) missing.push(`${m[1]} (${file.slice(root.length + 1)})`);
    }
    expect(missing).toEqual([]);
  });
});
