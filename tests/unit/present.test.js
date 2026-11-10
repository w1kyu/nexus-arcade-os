import { describe, expect, it } from 'vitest';
import {
  createPresentDoc,
  generateStandaloneHtml,
  parsePresentDoc,
  parseSlides,
  PRESENT_THEMES,
  serializePresentDoc,
} from '../../src/apps/present/model.js';

describe('Nexus Present Model & Slide Parser', () => {
  describe('Slide Splitting & Extraction', () => {
    it('splits markdown text into slides by horizontal rule delimiters', () => {
      const src = '# Slide 1\nContent 1\n---\n# Slide 2\nContent 2\n---\n# Slide 3\nContent 3';
      const slides = parseSlides(src);
      expect(slides.length).toBe(3);
      expect(slides[0].title).toBe('Slide 1');
      expect(slides[1].title).toBe('Slide 2');
      expect(slides[2].title).toBe('Slide 3');
      expect(slides[0].content).toContain('Content 1');
    });

    it('handles empty or whitespace-only source gracefully', () => {
      const slides = parseSlides('');
      expect(slides.length).toBe(1);
      expect(slides[0].title).toBe('Empty Slide');
    });

    it('extracts HTML comment speaker notes and cleans content', () => {
      const src = `# Introduction
Welcome to the talk.

<!-- note: Remember to introduce the team and background. -->
`;
      const slides = parseSlides(src);
      expect(slides.length).toBe(1);
      expect(slides[0].title).toBe('Introduction');
      expect(slides[0].notes).toBe('Remember to introduce the team and background.');
      expect(slides[0].content).not.toContain('<!-- note:');
      expect(slides[0].content).toContain('Welcome to the talk.');
    });

    it('extracts trailing Note: lines as speaker notes', () => {
      const src = `# Architecture
System overview diagram here.

Note: Mention high availability and replication.
`;
      const slides = parseSlides(src);
      expect(slides.length).toBe(1);
      expect(slides[0].notes).toBe('Mention high availability and replication.');
      expect(slides[0].content).not.toContain('Note:');
    });

    it('generates fallback title when slide has no headings', () => {
      const src = 'Just some text without heading';
      const slides = parseSlides(src);
      expect(slides[0].title).toBe('Slide 1');
    });
  });

  describe('Document Creation & Serialization', () => {
    it('creates default presentation document with pitch template', () => {
      const doc = createPresentDoc('Launch Pitch');
      expect(doc.title).toBe('Launch Pitch');
      expect(doc.theme).toBe('dark');
      expect(doc.aspectRatio).toBe('16:9');
      expect(doc.source).toContain('Nexus Arcade');
      expect(doc.metadata.created).toBeGreaterThan(0);
    });

    it('serializes and parses .npresent JSON document', () => {
      const doc = createPresentDoc('Custom Deck');
      doc.theme = 'retro';
      doc.aspectRatio = '4:3';
      doc.source = '# Retro\nTerminal style slides';

      const json = serializePresentDoc(doc);
      const parsed = parsePresentDoc(json);

      expect(parsed.title).toBe('Custom Deck');
      expect(parsed.theme).toBe('retro');
      expect(parsed.aspectRatio).toBe('4:3');
      expect(parsed.source).toContain('# Retro');
    });

    it('parses raw Markdown files into PresentDoc seamlessly', () => {
      const rawMd = '# My Markdown Deck\nSlide 1\n---\nSlide 2';
      const parsed = parsePresentDoc(rawMd);

      expect(parsed.title).toBe('My Markdown Deck');
      expect(parsed.theme).toBe('dark');
      expect(parsed.source).toBe(rawMd);
    });
  });

  describe('Standalone HTML Export', () => {
    it('generates self-contained HTML presentation with embedded navigation script', () => {
      const doc = createPresentDoc('Web Presentation');
      doc.theme = 'cyberpunk';
      const slidesHtml = ['<h1>Slide 1</h1><p>Welcome</p>', '<h1>Slide 2</h1><p>Demo</p>'];

      const html = generateStandaloneHtml(doc, slidesHtml);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Web Presentation</title>');
      expect(html).toContain(PRESENT_THEMES.cyberpunk.accent);
      expect(html).toContain('data-index="0"');
      expect(html).toContain('data-index="1"');
      expect(html).toContain('requestFullscreen');
      expect(html).toContain('ArrowRight');
      expect(html).toContain('1 / 2');
    });
  });
});
