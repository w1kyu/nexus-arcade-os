// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { highlight } from '../../src/ui/highlight.js';
import { renderMarkdown, renderMarkdownInto } from '../../src/ui/markdown.js';

describe('renderMarkdown', () => {
  it('renders GitHub-flavoured Markdown', async () => {
    const html = await renderMarkdown('# Title\n\n- [x] done\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n`code`');
    expect(html).toContain('<h1');
    expect(html).toContain('<table>');
    expect(html).toContain('<code>code</code>');
  });

  it('strips scripts, event handlers, styles and javascript: links', async () => {
    const html = await renderMarkdown(
      '<script>alert(1)</script><img src=x onerror="alert(1)"><p style="color:red" onclick="x()">hi</p>\n\n[a](javascript:alert(1))',
    );
    expect(html).not.toMatch(/<script|onerror|onclick|style=|href="javascript:/i);
    expect(html).toContain('hi');
  });

  it('opens web links in a new tab and blocks remote images', async () => {
    const html = await renderMarkdown('[site](https://example.com) ![pic](https://example.com/a.png)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toMatch(/ src="https:/);
    expect(html).toContain('data-blocked-src="https://example.com/a.png"');
  });

  it('renders inline and display math via KaTeX MathML without inline styles', async () => {
    const html = await renderMarkdown(
      'Inline $E = mc^2$ and block:\n\n$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$\n\n`$not math$`',
    );
    expect(html).toContain('<math');
    expect(html).toContain('nx-math-inline');
    expect(html).toContain('nx-math-block');
    expect(html).toContain('<code>$not math$</code>');
    expect(html).not.toMatch(/style=/i);
  });

  it('renders footnotes and wiki links when enabled', async () => {
    const html = await renderMarkdown(
      'See [[Roadmap]] and [[Missing Note|Alias]] plus note[^1].\n\n[^1]: Footnote body.',
      { wikiLinks: true, wikiExists: (title) => title === 'Roadmap' },
    );
    expect(html).toContain('data-wiki="Roadmap"');
    expect(html).toContain('class="nx-wiki-link"');
    expect(html).toContain('data-wiki="Missing Note"');
    expect(html).toContain('class="nx-wiki-link is-missing"');
    expect(html).toContain('>Alias</a>');
    expect(html).toContain('class="nx-footnotes"');
    expect(html).toContain('Footnote body.');
  });

  it('highlights fenced code blocks in renderMarkdownInto', async () => {
    const el = document.createElement('div');
    await renderMarkdownInto(el, '```js\nconst answer = 42;\n```');
    expect(el.querySelector('.tok-keyword')?.textContent).toBe('const');
  });
});

describe('highlight', () => {
  it('marks up tokens for a known language', async () => {
    const { fragment, language } = await highlight('const x = 42; // hi', 'main.js');
    expect(language).toBe('JavaScript');
    const div = document.createElement('div');
    div.append(fragment);
    expect(div.textContent).toBe('const x = 42; // hi');
    expect(div.querySelector('.tok-keyword')?.textContent).toBe('const');
    expect(div.querySelector('.tok-comment')?.textContent).toBe('// hi');
  });

  it('falls back to plain text', async () => {
    const { fragment, language } = await highlight('<b>not html</b>', 'notes.unknownext');
    expect(language).toBeNull();
    const div = document.createElement('div');
    div.append(fragment);
    expect(div.innerHTML).toBe('&lt;b&gt;not html&lt;/b&gt;');
  });
});
