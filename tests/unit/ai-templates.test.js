// @ts-check
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PERSONAS,
  DEFAULT_TEMPLATES,
  extractVariables,
  interpolateTemplate,
} from '../../src/apps/chat/templates.js';

describe('AI Personas and Prompt Templates', () => {
  it('provides default personas including CS Tutor, Translator, and Code Reviewer', () => {
    expect(DEFAULT_PERSONAS.length).toBeGreaterThanOrEqual(4);
    const csTutor = DEFAULT_PERSONAS.find((p) => p.id === 'cs_tutor');
    expect(csTutor).toBeDefined();
    expect(csTutor?.systemPrompt).toContain('Computer Science');

    const translator = DEFAULT_PERSONAS.find((p) => p.id === 'translator');
    expect(translator).toBeDefined();
    expect(translator?.systemPrompt).toContain('German');
  });

  it('provides pre-bundled prompt templates across categories', () => {
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    const explain = DEFAULT_TEMPLATES.find((t) => t.id === 'explain');
    expect(explain).toBeDefined();
    expect(explain?.variables).toEqual(['topic', 'level']);
  });

  it('extracts variable names from dynamic template syntax', () => {
    const template = 'Translate this {{text}} into {{language}} with {{tone}} style.';
    const vars = extractVariables(template);
    expect(vars).toEqual(['text', 'language', 'tone']);
  });

  it('interpolates variables into prompt templates accurately', () => {
    const template = 'Explain {{topic}} in simple terms suitable for a {{level}} student.';
    const result = interpolateTemplate(template, {
      topic: 'Dynamic Programming',
      level: 'high school',
    });
    expect(result).toBe('Explain Dynamic Programming in simple terms suitable for a high school student.');
  });

  it('preserves unset variable placeholders if not provided', () => {
    const template = 'Hello {{name}}, welcome to {{place}}!';
    const result = interpolateTemplate(template, { name: 'Alice' });
    expect(result).toBe('Hello Alice, welcome to {{place}}!');
  });
});
