// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildPreviewDocument, TEMPLATES } from '../../src/apps/playground/templates.js';

describe('playground templates and document builder', () => {
  it('contains expected templates', () => {
    expect(TEMPLATES.blank).toBeDefined();
    expect(TEMPLATES.canvas).toBeDefined();
    expect(TEMPLATES.animation).toBeDefined();
    expect(TEMPLATES.fetchJson).toBeDefined();
    expect(TEMPLATES.webComponent).toBeDefined();
    expect(TEMPLATES.p5Helper).toBeDefined();
  });

  it('builds preview document with console interceptor', () => {
    const doc = buildPreviewDocument('<h1>Hi</h1>', 'body { color: red; }', 'console.log("test");');
    expect(doc).toContain('<h1>Hi</h1>');
    expect(doc).toContain('body { color: red; }');
    expect(doc).toContain('console.log("test");');
    expect(doc).toContain('CONSOLE_LOG');
    expect(doc).toContain('EVAL_EXPR');
  });
});
