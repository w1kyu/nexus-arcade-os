// @ts-check
// Personas and prompt templates library with variable interpolation.

/**
 * @typedef {object} Persona
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} systemPrompt
 * @property {number} [temperature]
 * @property {string} [defaultModel]
 * @property {string} [description]
 */

/**
 * @typedef {object} PromptTemplate
 * @property {string} id
 * @property {string} title
 * @property {string} category
 * @property {string} template
 * @property {string[]} variables
 * @property {string} [description]
 */

/** @type {Persona[]} */
export const DEFAULT_PERSONAS = [
  {
    id: 'nexus',
    name: 'Nexus Assistant',
    icon: 'sparkles',
    systemPrompt:
      'You are Nexus Assistant, the built-in intelligent assistant of Nexus Arcade OS. You are knowledgeable, direct, helpful, and concise. You format code with markdown blocks, support LaTeX math with $ or $$, and write clean answers.',
    temperature: 0.7,
    description: 'General-purpose friendly AI assistant',
  },
  {
    id: 'cs_tutor',
    name: 'CS Tutor',
    icon: 'code',
    systemPrompt:
      'You are an expert Computer Science professor and tutor. You explain algorithms, data structures, complexity (Big O), systems concepts, and logic with intuition, analogies, diagrams, and step-by-step code examples. Always test edge cases.',
    temperature: 0.5,
    description: 'Explains algorithms, data structures, and computer science concepts',
  },
  {
    id: 'translator',
    name: 'German ↔ English Translator',
    icon: 'globe',
    systemPrompt:
      'You are a professional German-English translator and linguist. When given text in German, translate to natural English. When given English, translate to idiomatic German. Explain subtle nuances, formal (Sie) vs informal (Du) distinctions, and false friends if relevant.',
    temperature: 0.3,
    description: 'Fluent translations between German and English',
  },
  {
    id: 'code_reviewer',
    name: 'Code Reviewer',
    icon: 'check',
    systemPrompt:
      'You are a senior software architect and code reviewer. Carefully review the supplied code for bugs, edge cases, security vulnerabilities, performance bottlenecks, readability, and modern idiomatic patterns. Provide clear suggestions with diffs or code snippets.',
    temperature: 0.2,
    description: 'Audits code for bugs, security, and best practices',
  },
  {
    id: 'exam_coach',
    name: 'Exam Coach',
    icon: 'file-text',
    systemPrompt:
      'You are a rigorous exam preparation tutor. You quiz the user, generate sample exam questions with multiple choice or open prompts, grade answers constructively, and highlight areas for improvement.',
    temperature: 0.6,
    description: 'Quizzes you, generates sample exam questions, and provides feedback',
  },
];

/** @type {PromptTemplate[]} */
export const DEFAULT_TEMPLATES = [
  {
    id: 'explain',
    title: 'Explain Concept',
    category: 'Learning',
    template: 'Explain {{topic}} in simple terms suitable for a {{level}} student, using analogies and examples.',
    variables: ['topic', 'level'],
    description: 'Explains a complex topic tailored to an audience level',
  },
  {
    id: 'translate',
    title: 'Translate Text',
    category: 'Writing',
    template: 'Translate the following text into {{language}}, preserving style and tone:\n\n{{text}}',
    variables: ['language', 'text'],
    description: 'Translates text into any target language',
  },
  {
    id: 'review',
    title: 'Code Review',
    category: 'Coding',
    template:
      'Review the following {{language}} code for performance, security, and edge cases:\n\n```{{language}}\n{{code}}\n```',
    variables: ['language', 'code'],
    description: 'Comprehensive code review with suggestions',
  },
  {
    id: 'tests',
    title: 'Write Unit Tests',
    category: 'Coding',
    template: 'Write comprehensive unit tests in {{framework}} for this function:\n\n{{code}}',
    variables: ['framework', 'code'],
    description: 'Generates thorough unit test suites',
  },
  {
    id: 'summarize',
    title: 'Summarize Document',
    category: 'Writing',
    template: 'Provide a concise bulleted summary and 3 key takeaways from the following text:\n\n{{text}}',
    variables: ['text'],
    description: 'Extracts summary and key takeaways',
  },
  {
    id: 'optimize',
    title: 'Optimize Code',
    category: 'Coding',
    template:
      'Optimize the following code for better time/space complexity and explain your changes:\n\n```\n{{code}}\n```',
    variables: ['code'],
    description: 'Optimizes runtime and memory performance',
  },
];

/**
 * Extracts variable names from a template string: `{{variable}}`.
 * @param {string} template
 * @returns {string[]}
 */
export function extractVariables(template) {
  if (!template) return [];
  const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
  /** @type {Set<string>} */
  const vars = new Set();
  let match;
  while ((match = regex.exec(template)) !== null) {
    vars.add(match[1]);
  }
  return Array.from(vars);
}

/**
 * Interpolates variables into a template.
 * @param {string} template
 * @param {Record<string, string>} values
 * @returns {string}
 */
export function interpolateTemplate(template, values) {
  if (!template) return '';
  return template.replace(/\{\{([a-zA-Z0-9_-]+)\}\}/g, (_, key) => {
    return values[key] !== undefined ? values[key] : `{{${key}}}`;
  });
}
