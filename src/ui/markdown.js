// @ts-check
// Markdown → sanitized HTML (GitHub-flavoured, via marked + DOMPurify, both loaded on first use).
// Supports GFM (tables, task lists, strikethrough), footnotes (`[^1]`), math (`$…$`, `$$…$$` via
// KaTeX MathML so no inline style attributes or extra font files are needed), wiki links
// (`[[Note title]]` or `[[Note title|Alias]]`), and syntax-highlighted fenced code blocks.
// Use this for every piece of user or app Markdown: the output is safe to put into innerHTML.
// Links to other sites open in a new tab; nothing is fetched while rendering.
import './content.css';
import { highlight } from './highlight.js';

/**
 * @typedef {object} RenderMarkdownOptions
 * @property {boolean} [math]                        render `$…$` and `$$…$$` with KaTeX MathML (default true)
 * @property {boolean} [footnotes]                   render `[^id]` footnotes (default true)
 * @property {boolean} [wikiLinks]                   render `[[Target]]` / `[[Target|Label]]` links (default false)
 * @property {(title: string) => boolean} [wikiExists] returns false to style missing wiki links
 * @property {(src: string) => string | null | undefined} [resolveImage] maps relative image paths to blob:/data: URLs
 * @property {boolean} [interactiveTasks]            keep checkboxes enabled with data-task-index (default false)
 */

/** @type {Promise<{ Marked: typeof import('marked').Marked, purify: import('dompurify').DOMPurify }> | null} */
let baseDeps = null;
/** @type {Promise<typeof import('katex').default> | null} */
let katexDep = null;

function loadBase() {
  baseDeps ??= Promise.all([import('marked'), import('dompurify')]).then(([{ Marked }, { default: DOMPurify }]) => {
    const purify = DOMPurify(window);
    purify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') ?? '';
        if (/^https?:/i.test(href)) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      }
      // Remote images would be a network request (privacy): only data:/blob: URLs load.
      if (
        node.tagName === 'INPUT' &&
        (node.getAttribute('type') !== 'checkbox' || !node.hasAttribute('data-task-index'))
      ) {
        node.remove();
        return;
      }
      if (node.tagName === 'IMG') {
        const src = node.getAttribute('src') ?? '';
        if (!/^(data|blob):/i.test(src)) {
          node.setAttribute('data-blocked-src', src);
          node.removeAttribute('src');
        }
      }
    });
    return { Marked, purify };
  });
  return baseDeps;
}

function loadKatex() {
  katexDep ??= import('katex').then((m) => m.default ?? m);
  return katexDep;
}

/** @param {string} s */
const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/**
 * Extracts fenced/indented/inline code spans so math, footnote and wiki-link preprocessors
 * never touch code content.
 * @param {string} src
 */
function maskCode(src) {
  /** @type {string[]} */
  const stash = [];
  const put = (/** @type {string} */ match) => {
    const idx = stash.length;
    stash.push(match);
    return `@@NXCODE_${idx}_END@@`;
  };
  // Fenced code blocks (``` or ~~~) and inline code (`...`).
  const masked = src
    .replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g, (m, lead) => `${lead}${put(m.slice(lead.length))}`)
    .replace(/(`+)(?:(?!\1)[\s\S])+?\1/g, (m) => put(m));
  return {
    masked,
    unmask: (/** @type {string} */ text) => text.replace(/@@NXCODE_(\d+)_END@@/g, (_, i) => stash[Number(i)] ?? ''),
  };
}

/**
 * Extracts footnote definitions `[^id]: text` and replaces references `[^id]`.
 * @param {string} text
 */
function extractFootnotes(text) {
  /** @type {Map<string, string>} */
  const defs = new Map();
  const body = text.replace(/^\[\^([^\]]+)\]:[ \t]*(.+)$/gm, (_, id, content) => {
    defs.set(String(id).trim(), content.trim());
    return '';
  });
  if (!defs.size) return { body: text, defs, order: /** @type {string[]} */ ([]) };
  /** @type {string[]} */
  const order = [];
  const withRefs = body.replace(/\[\^([^\]]+)\]/g, (m, rawId) => {
    const id = String(rawId).trim();
    if (!defs.has(id)) return m;
    let idx = order.indexOf(id);
    if (idx === -1) {
      idx = order.length;
      order.push(id);
    }
    const n = idx + 1;
    const safeId = escapeHtml(id);
    return `<sup class="nx-fn-ref"><a href="#fn-${safeId}" id="fnref-${safeId}" data-footnote="${safeId}">[${n}]</a></sup>`;
  });
  return { body: withRefs, defs, order };
}

/**
 * Renders math (`$$...$$` display and `$...$` inline) into placeholders, returning a restore fn.
 * @param {string} text
 */
async function renderMathPlaceholders(text) {
  if (!text.includes('$')) return { text, restore: (/** @type {string} */ html) => html };
  /** @type {{ tex: string, display: boolean }[]} */
  const expressions = [];
  const add = (/** @type {string} */ tex, /** @type {boolean} */ display) => {
    const idx = expressions.length;
    expressions.push({ tex, display });
    return `@@NXMATH_${idx}_END@@`;
  };
  // Display math: $$...$$ (can span lines).
  let out = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => add(tex.trim(), true));
  // Inline math: $...$ on a single line, not preceded/followed by $ or space, and not a currency like "$10 and $20".
  out = out.replace(/(^|[^\\$])\$(?!\s)((?:\\.|[^$\n\\])+?)(?<!\s)\$(?!\d)/g, (m, lead, tex) => {
    return `${lead}${add(tex.trim(), false)}`;
  });
  if (!expressions.length) return { text, restore: (/** @type {string} */ html) => html };
  const katex = await loadKatex();
  const rendered = expressions.map(({ tex, display }) => {
    try {
      const mathml = katex
        .renderToString(tex, {
          output: 'mathml',
          displayMode: display,
          throwOnError: false,
        })
        .replace(/\s+style="[^"]*"/gi, '');
      return display
        ? `<div class="nx-math-block" data-tex="${escapeHtml(tex)}">${mathml}</div>`
        : `<span class="nx-math-inline" data-tex="${escapeHtml(tex)}">${mathml}</span>`;
    } catch {
      return `<code>${escapeHtml(tex)}</code>`;
    }
  });
  return {
    text: out,
    restore: (/** @type {string} */ html) => html.replace(/@@NXMATH_(\d+)_END@@/g, (_, i) => rendered[Number(i)] ?? ''),
  };
}

/**
 * Replaces `[[Note title]]` or `[[Note title|Label]]` with `<a href="wiki:..." data-wiki="...">`.
 * @param {string} text
 * @param {(title: string) => boolean} [wikiExists]
 */
function replaceWikiLinks(text, wikiExists) {
  return text.replace(/\[\[([^\]|#]+?)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (_, rawTarget, heading, rawLabel) => {
    const target = String(rawTarget).trim();
    const label = String(rawLabel ?? (heading ? `${target} › ${heading}` : target)).trim();
    const exists = wikiExists ? wikiExists(target) : true;
    const cls = exists ? 'nx-wiki-link' : 'nx-wiki-link is-missing';
    const safeTarget = escapeHtml(target);
    const safeHeading = heading ? escapeHtml(String(heading).trim()) : '';
    return `<a href="wiki:${encodeURIComponent(target)}" class="${cls}" data-wiki="${safeTarget}"${safeHeading ? ` data-wiki-heading="${safeHeading}"` : ''}>${escapeHtml(label)}</a>`;
  });
}

/**
 * Renders Markdown to sanitized HTML.
 * @param {string} markdown
 * @param {RenderMarkdownOptions} [options]
 * @returns {Promise<string>}
 */
export async function renderMarkdown(markdown, options = {}) {
  const {
    math = true,
    footnotes = true,
    wikiLinks = false,
    wikiExists,
    resolveImage,
    interactiveTasks = false,
  } = options;
  const { Marked, purify } = await loadBase();

  const { masked, unmask } = maskCode(String(markdown ?? ''));
  let working = masked;

  const fnData = footnotes ? extractFootnotes(working) : { body: working, defs: new Map(), order: [] };
  working = fnData.body;

  if (wikiLinks) working = replaceWikiLinks(working, wikiExists);

  const mathResult = math
    ? await renderMathPlaceholders(working)
    : { text: working, restore: (/** @type {string} */ h) => h };
  working = unmask(mathResult.text);

  let taskIndex = 0;
  const marked = new Marked({
    gfm: true,
    breaks: false,
    async: false,
    renderer: {
      image({ href, title, text }) {
        const resolved = resolveImage && href ? (resolveImage(href) ?? href) : href;
        const safeSrc = escapeHtml(resolved ?? '');
        const safeAlt = escapeHtml(text ?? '');
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${safeSrc}" alt="${safeAlt}"${titleAttr}>`;
      },
      listitem(item) {
        const body = this.parser.parse(item.tokens, !!item.loose);
        if (item.task) {
          const idx = taskIndex++;
          const checked = item.checked ? ' checked' : '';
          const disabled = interactiveTasks ? '' : ' disabled';
          const stripped = body.replace(/^<input[^>]*>\s*/i, '');
          const labelText =
            (item.text ?? '')
              .split('\n')[0]
              .replace(/^\[[ xX]\]\s*/, '')
              .replace(/<[^>]+>/g, '')
              .trim() || `Task ${idx + 1}`;
          return `<li class="nx-task-item${item.checked ? ' is-done' : ''}" data-task-index="${idx}"><input type="checkbox"${checked}${disabled} data-task-index="${idx}" aria-label="${escapeHtml(labelText)}"> ${stripped}</li>\n`;
        }
        return `<li>${body}</li>\n`;
      },
    },
  });

  let rawHtml = /** @type {string} */ (marked.parse(working));
  rawHtml = mathResult.restore(rawHtml);

  if (fnData.order.length) {
    const items = fnData.order
      .map((id) => {
        const safeId = escapeHtml(id);
        const defHtml = /** @type {string} */ (marked.parseInline(unmask(fnData.defs.get(id) ?? '')));
        return `<li id="fn-${safeId}">${defHtml} <a href="#fnref-${safeId}" class="nx-fn-back" aria-label="Back">↩</a></li>`;
      })
      .join('');
    rawHtml += `\n<section class="nx-footnotes"><hr><ol>${items}</ol></section>`;
  }

  const forbidTags = ['style', 'form', 'button', 'textarea', 'select'];

  return purify.sanitize(rawHtml, {
    USE_PROFILES: { html: true, mathMl: true },
    FORBID_TAGS: forbidTags,
    FORBID_ATTR: ['style'],
    ADD_ATTR: ['data-wiki', 'data-wiki-heading', 'data-footnote', 'data-task-index', 'data-tex', 'data-blocked-src'],
    // DOMPurify's default list plus `help:` (Help pages) and `wiki:` (Notes wiki links).
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|help|wiki):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * Highlights fenced `<pre><code class="language-...">` blocks inside a rendered Markdown container.
 * @param {HTMLElement} el
 */
export async function highlightCodeBlocks(el) {
  const blocks = el.querySelectorAll('pre > code[class*="language-"]');
  for (const codeEl of blocks) {
    const match = /language-([\w+-]+)/.exec(codeEl.className);
    if (!match) continue;
    const lang = match[1].toLowerCase();
    const extMap = /** @type {Record<string, string>} */ ({
      js: 'file.js',
      javascript: 'file.js',
      ts: 'file.ts',
      typescript: 'file.ts',
      jsx: 'file.jsx',
      tsx: 'file.tsx',
      json: 'file.json',
      html: 'file.html',
      xml: 'file.xml',
      css: 'file.css',
      md: 'file.md',
      markdown: 'file.md',
      py: 'file.py',
      python: 'file.py',
      sh: 'file.sh',
      bash: 'file.sh',
      shell: 'file.sh',
      sql: 'file.sql',
      yaml: 'file.yaml',
      yml: 'file.yaml',
      rust: 'file.rs',
      rs: 'file.rs',
      go: 'file.go',
      c: 'file.c',
      cpp: 'file.cpp',
      java: 'file.java',
    });
    const filename = extMap[lang] ?? `file.${lang}`;
    const raw = codeEl.textContent ?? '';
    try {
      const { fragment } = await highlight(raw, filename);
      codeEl.replaceChildren(fragment);
    } catch {
      // Keep plain text if language parser fails.
    }
  }
}

/**
 * Renders Markdown into an element (adds the `nx-markdown` content styles and highlights code blocks).
 * @param {HTMLElement} el
 * @param {string} markdown
 * @param {RenderMarkdownOptions & { highlightCode?: boolean }} [options]
 */
export async function renderMarkdownInto(el, markdown, options = {}) {
  el.classList.add('nx-markdown');
  el.innerHTML = await renderMarkdown(markdown, options);
  for (const pre of el.querySelectorAll('pre')) pre.setAttribute('tabindex', '0');
  if (options.highlightCode !== false) {
    await highlightCodeBlocks(el);
  }
  return el;
}
