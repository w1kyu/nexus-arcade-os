// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  computeStats,
  createDocument,
  DEFAULT_PAGE_SETTINGS,
  extractOutline,
  generateTocHtml,
  htmlToMarkdown,
  htmlToPlainText,
  markdownToHtml,
  parseDocument,
  serializeDocument,
  TEMPLATES,
} from '../../src/apps/write/model.js';

describe('Nexus Write Model', () => {
  describe('Document Creation & Serialization', () => {
    it('creates a new document with default settings', () => {
      const doc = createDocument('My Document', '<p>Hello world</p>');
      expect(doc.version).toBe(1);
      expect(doc.title).toBe('My Document');
      expect(doc.content).toBe('<p>Hello world</p>');
      expect(doc.settings).toEqual(DEFAULT_PAGE_SETTINGS);
      expect(doc.metadata.created).toBeGreaterThan(0);
      expect(doc.metadata.modified).toBeGreaterThan(0);
    });

    it('serializes and parses .ndoc JSON document', () => {
      const doc = createDocument('Test Doc', '<h1>Title</h1><p>Body</p>', {
        pageSize: 'Letter',
        orientation: 'landscape',
        margins: 'narrow',
      });
      const json = serializeDocument(doc);
      expect(typeof json).toBe('string');

      const parsed = parseDocument(json);
      expect(parsed.title).toBe('Test Doc');
      expect(parsed.content).toBe('<h1>Title</h1><p>Body</p>');
      expect(parsed.settings.pageSize).toBe('Letter');
      expect(parsed.settings.orientation).toBe('landscape');
      expect(parsed.settings.margins).toBe('narrow');
    });

    it('recovers gracefully from invalid or corrupted JSON', () => {
      const parsed = parseDocument('invalid json');
      expect(parsed.title).toBe('Untitled Document');
      expect(parsed.content).toBe('<p><br></p>');
      expect(parsed.settings).toEqual(DEFAULT_PAGE_SETTINGS);
    });
  });

  describe('Document Statistics', () => {
    it('computes word count, character count and reading time', () => {
      const html = '<p>The quick brown fox jumps over the lazy dog.</p>';
      const stats = computeStats(html);

      expect(stats.words).toBe(9);
      expect(stats.characters).toBe(44);
      expect(stats.charactersWithoutSpaces).toBe(36);
      expect(stats.readingTimeMinutes).toBe(1);
    });

    it('handles empty document stats', () => {
      const stats = computeStats('<p><br></p>');
      expect(stats.words).toBe(0);
      expect(stats.characters).toBe(0);
      expect(stats.readingTimeMinutes).toBe(1);
    });

    it('computes realistic reading time for longer text', () => {
      // 500 words should be ~3 minutes (at 200 wpm)
      const words = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
      const stats = computeStats(`<p>${words}</p>`);
      expect(stats.words).toBe(500);
      expect(stats.readingTimeMinutes).toBe(3);
    });
  });

  describe('Outline Extraction & TOC Generation', () => {
    it('extracts outline hierarchy from headings', () => {
      const html = `
        <h1 id="intro">Introduction</h1>
        <p>Some text</p>
        <h2 id="method">Methodology</h2>
        <p>Details</p>
        <h3 id="step-1">Step 1</h3>
        <p>Step text</p>
        <h2 id="results">Results</h2>
      `;
      const outline = extractOutline(html);

      expect(outline.length).toBe(4);
      expect(outline[0]).toEqual({ id: 'intro', level: 1, text: 'Introduction' });
      expect(outline[1]).toEqual({ id: 'method', level: 2, text: 'Methodology' });
      expect(outline[2]).toEqual({ id: 'step-1', level: 3, text: 'Step 1' });
      expect(outline[3]).toEqual({ id: 'results', level: 2, text: 'Results' });
    });

    it('generates TOC HTML with anchor links', () => {
      const outline = [
        { id: 'sec-1', level: 1, text: 'First Section' },
        { id: 'sec-2', level: 2, text: 'Subsection' },
      ];
      const toc = generateTocHtml(outline, 'Contents');
      expect(toc).toContain('class="nx-write-toc"');
      expect(toc).toContain('Contents');
      expect(toc).toContain('href="#sec-1"');
      expect(toc).toContain('First Section');
      expect(toc).toContain('nx-write-toc-h2');
    });
  });

  describe('Markdown & HTML Conversion', () => {
    it('converts markdown to sanitized HTML', () => {
      const md = '# Header 1\n\n**Bold text** and *italic text* with [link](https://nexus.os)';
      const html = markdownToHtml(md);

      expect(html).toContain('<h1>Header 1</h1>');
      expect(html).toContain('<strong>Bold text</strong>');
      expect(html).toContain('<em>italic text</em>');
      expect(html).toContain('href="https://nexus.os"');
    });

    it('converts HTML elements back to Markdown', () => {
      const html = `
        <h1>Title</h1>
        <p>A paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
        <blockquote>Quoted block</blockquote>
        <pre><code>const a = 1;</code></pre>
        <ul>
          <li>First item</li>
          <li>Second item</li>
        </ul>
        <hr>
      `;
      const md = htmlToMarkdown(html);

      expect(md).toContain('# Title');
      expect(md).toContain('**bold**');
      expect(md).toContain('*italic*');
      expect(md).toContain('> Quoted block');
      expect(md).toContain('```\nconst a = 1;\n```');
      expect(md).toContain('- First item');
      expect(md).toContain('- Second item');
      expect(md).toContain('---');
    });

    it('converts checklists and tables to Markdown', () => {
      const html = `
        <ul class="checklist">
          <li><input type="checkbox" checked> Done item</li>
          <li><input type="checkbox"> Pending item</li>
        </ul>
        <table>
          <tr><th>Col A</th><th>Col B</th></tr>
          <tr><td>Val 1</td><td>Val 2</td></tr>
        </table>
      `;
      const md = htmlToMarkdown(html);

      expect(md).toContain('- [x] Done item');
      expect(md).toContain('- [ ] Pending item');
      expect(md).toContain('| Col A | Col B |');
      expect(md).toContain('| --- | --- |');
      expect(md).toContain('| Val 1 | Val 2 |');
    });

    it('extracts plain text cleanly', () => {
      const html = '<h1>Heading</h1><p>Text with <strong>bold</strong> words.</p>';
      const plain = htmlToPlainText(html);
      expect(plain).toBe('HeadingText with bold words.');
    });
  });

  describe('Document Templates', () => {
    it('provides all 5 required templates with valid document structure', () => {
      const templateKeys = ['blank', 'letter', 'cv', 'report', 'labReport'];
      expect(Object.keys(TEMPLATES)).toEqual(templateKeys);

      templateKeys.forEach((key) => {
        const tmpl = TEMPLATES[key];
        expect(tmpl.name.en).toBeDefined();
        expect(tmpl.name.de).toBeDefined();
        const doc = tmpl.create();
        expect(doc.title).toBeDefined();
        expect(doc.content).toBeDefined();
        expect(doc.content.length).toBeGreaterThan(10);
        expect(doc.settings).toBeDefined();
      });
    });

    it('creates DIN 5008 letter template with sender and recipient blocks', () => {
      const letter = TEMPLATES.letter.create();
      expect(letter.content).toContain('nx-write-letter-sender');
      expect(letter.content).toContain('nx-write-letter-recipient');
      expect(TEMPLATES.letter.name.en).toContain('DIN 5008');
      expect(letter.title).toBe('Geschäftsbrief');
    });

    it('creates CV template with profile and skills table', () => {
      const cv = TEMPLATES.cv.create();
      expect(cv.content).toContain('Jane Doe');
      expect(cv.content).toContain('Professional Experience');
      expect(cv.content).toContain('Technical Skills');
    });
  });
});
