// @ts-check
import { marked } from 'marked';

/**
 * @typedef {object} PageSettings
 * @property {'A4' | 'Letter'} pageSize
 * @property {'portrait' | 'landscape'} orientation
 * @property {'normal' | 'narrow' | 'wide'} margins
 * @property {string} fontFamily
 * @property {number} fontSize
 * @property {number} lineHeight
 */

/**
 * @typedef {object} DocumentMetadata
 * @property {number} created
 * @property {number} modified
 * @property {string} [author]
 */

/**
 * @typedef {object} DocumentData
 * @property {number} version
 * @property {string} title
 * @property {PageSettings} settings
 * @property {string} content
 * @property {DocumentMetadata} metadata
 */

/**
 * @typedef {object} OutlineItem
 * @property {string} id
 * @property {number} level
 * @property {string} text
 */

/**
 * @typedef {object} DocumentStats
 * @property {number} words
 * @property {number} characters
 * @property {number} charactersWithoutSpaces
 * @property {number} paragraphs
 * @property {number} readingTimeMinutes
 */

/** @type {PageSettings} */
export const DEFAULT_PAGE_SETTINGS = {
  pageSize: 'A4',
  orientation: 'portrait',
  margins: 'normal',
  fontFamily: 'sans',
  fontSize: 12,
  lineHeight: 1.6,
};

/**
 * Create a new DocumentData structure.
 * @param {string} [title]
 * @param {string} [content]
 * @param {Partial<PageSettings>} [settings]
 * @returns {DocumentData}
 */
export function createDocument(title = 'Untitled Document', content = '<p><br></p>', settings = {}) {
  const now = Date.now();
  return {
    version: 1,
    title,
    settings: { ...DEFAULT_PAGE_SETTINGS, ...settings },
    content,
    metadata: {
      created: now,
      modified: now,
      author: 'User',
    },
  };
}

/**
 * Serialize document to JSON string.
 * @param {DocumentData} doc
 * @returns {string}
 */
export function serializeDocument(doc) {
  return JSON.stringify(doc, null, 2);
}

/**
 * Parse document from JSON string with fallback defaults.
 * @param {string} jsonStr
 * @returns {DocumentData}
 */
export function parseDocument(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      return createDocument();
    }
    return {
      version: typeof data.version === 'number' ? data.version : 1,
      title: typeof data.title === 'string' ? data.title : 'Untitled Document',
      settings: {
        pageSize: data.settings?.pageSize === 'Letter' ? 'Letter' : 'A4',
        orientation: data.settings?.orientation === 'landscape' ? 'landscape' : 'portrait',
        margins: ['normal', 'narrow', 'wide'].includes(data.settings?.margins) ? data.settings.margins : 'normal',
        fontFamily: typeof data.settings?.fontFamily === 'string' ? data.settings.fontFamily : 'sans',
        fontSize: typeof data.settings?.fontSize === 'number' ? data.settings.fontSize : 12,
        lineHeight: typeof data.settings?.lineHeight === 'number' ? data.settings.lineHeight : 1.6,
      },
      content: typeof data.content === 'string' ? data.content : '<p><br></p>',
      metadata: {
        created: typeof data.metadata?.created === 'number' ? data.metadata.created : Date.now(),
        modified: typeof data.metadata?.modified === 'number' ? data.metadata.modified : Date.now(),
        author: typeof data.metadata?.author === 'string' ? data.metadata.author : 'User',
      },
    };
  } catch {
    return createDocument();
  }
}

/**
 * Extract plain text from an HTML string or element.
 * @param {string | Element} input
 * @returns {string}
 */
export function htmlToPlainText(input) {
  if (typeof input === 'string') {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(input, 'text/html');
      return doc.body.textContent || '';
    }
    // Fallback regex strip
    return input
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return input.textContent || '';
}

/**
 * Compute document statistics (words, characters, paragraphs, reading time).
 * @param {string | Element} input
 * @returns {DocumentStats}
 */
export function computeStats(input) {
  const plainText = htmlToPlainText(input).trim();
  const characters = plainText.length;
  const charactersWithoutSpaces = plainText.replace(/\s/g, '').length;

  const words = plainText.length === 0 ? 0 : plainText.split(/\s+/).filter(Boolean).length;

  let paragraphs = 0;
  if (typeof input === 'string' && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(input, 'text/html');
    const blocks = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre');
    paragraphs = Array.from(blocks).filter((b) => (b.textContent || '').trim().length > 0).length;
  } else if (typeof input !== 'string') {
    const blocks = input.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre');
    paragraphs = Array.from(blocks).filter((b) => (b.textContent || '').trim().length > 0).length;
  }

  if (paragraphs === 0 && words > 0) {
    paragraphs = plainText.split(/\n+/).filter((line) => line.trim().length > 0).length || 1;
  }

  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return {
    words,
    characters,
    charactersWithoutSpaces,
    paragraphs,
    readingTimeMinutes,
  };
}

/**
 * Extract headings outline from HTML string or DOM container.
 * @param {string | Element} input
 * @returns {OutlineItem[]}
 */
export function extractOutline(input) {
  /** @type {Element[]} */
  let headings = [];
  if (typeof input === 'string') {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(input, 'text/html');
      headings = Array.from(doc.querySelectorAll('h1, h2, h3'));
    }
  } else {
    headings = Array.from(input.querySelectorAll('h1, h2, h3'));
  }

  return headings.map((hEl, idx) => {
    const tag = hEl.tagName.toLowerCase();
    const level = parseInt(tag.substring(1), 10);
    const text = (hEl.textContent || '').trim();
    const id = hEl.getAttribute('id') || `heading-${idx + 1}`;
    return { id, level, text };
  });
}

/**
 * Generate a Table of Contents HTML block from an outline.
 * @param {OutlineItem[]} outline
 * @param {string} [title='Table of Contents']
 * @returns {string}
 */
export function generateTocHtml(outline, title = 'Table of Contents') {
  if (!outline || outline.length === 0) {
    return `<div class="nx-write-toc" contenteditable="false"><div class="nx-write-toc-title">${title}</div><p><em>(No headings found in document)</em></p></div>`;
  }

  const items = outline
    .map(
      (item) =>
        `<li class="nx-write-toc-item nx-write-toc-h${item.level}"><a href="#${item.id}" data-target-id="${item.id}">${item.text || 'Untitled Section'}</a></li>`,
    )
    .join('\n');

  return `<div class="nx-write-toc" contenteditable="false"><div class="nx-write-toc-title">${title}</div><ul class="nx-write-toc-list">\n${items}\n</ul></div><p><br></p>`;
}

/**
 * Convert Markdown text to HTML.
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToHtml(markdown) {
  if (!markdown) return '<p><br></p>';
  try {
    const html = marked.parse(markdown, { gfm: true, breaks: true });
    return typeof html === 'string' ? html : String(html);
  } catch {
    return `<p>${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
  }
}

/**
 * Convert HTML or a DOM Element to clean Markdown.
 * @param {string | Element} input
 * @returns {string}
 */
export function htmlToMarkdown(input) {
  /** @type {Element} */
  let container;
  if (typeof input === 'string') {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(input, 'text/html');
      container = doc.body;
    } else {
      return input.replace(/<[^>]+>/g, '');
    }
  } else {
    container = input;
  }

  /**
   * Helper to serialize child nodes to Markdown text.
   * @param {Node} node
   * @returns {string}
   */
  function serializeNode(node) {
    if (node.nodeType === 3) {
      // Text node
      return node.textContent || '';
    }

    if (node.nodeType !== 1) {
      return '';
    }

    const el = /** @type {HTMLElement} */ (node);
    const tag = el.tagName.toLowerCase();

    // Ignore TOC block in markdown export
    if (el.classList.contains('nx-write-toc')) {
      return '';
    }

    const childMarkdown = Array.from(el.childNodes).map(serializeNode).join('');

    switch (tag) {
      case 'h1':
        return `# ${childMarkdown.trim()}\n\n`;
      case 'h2':
        return `## ${childMarkdown.trim()}\n\n`;
      case 'h3':
        return `### ${childMarkdown.trim()}\n\n`;
      case 'h4':
        return `#### ${childMarkdown.trim()}\n\n`;
      case 'h5':
        return `##### ${childMarkdown.trim()}\n\n`;
      case 'h6':
        return `###### ${childMarkdown.trim()}\n\n`;
      case 'p':
        return `${childMarkdown.trim()}\n\n`;
      case 'blockquote':
        return (
          childMarkdown
            .trim()
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n') + '\n\n'
        );
      case 'pre': {
        const codeText = el.textContent || '';
        return `\`\`\`\n${codeText.trim()}\n\`\`\`\n\n`;
      }
      case 'code':
        return `\`${childMarkdown}\``;
      case 'strong':
      case 'b':
        return `**${childMarkdown}**`;
      case 'em':
      case 'i':
        return `*${childMarkdown}*`;
      case 'u':
        return `<u>${childMarkdown}</u>`;
      case 's':
      case 'del':
      case 'strike':
        return `~~${childMarkdown}~~`;
      case 'a': {
        const href = el.getAttribute('href') || '';
        return `[${childMarkdown}](${href})`;
      }
      case 'img': {
        const src = el.getAttribute('src') || '';
        const alt = el.getAttribute('alt') || 'image';
        return `![${alt}](${src})`;
      }
      case 'hr':
        return `---\n\n`;
      case 'br':
        return '\n';
      case 'ul': {
        const items = Array.from(el.children)
          .map((li) => {
            const checkbox = li.querySelector('input[type="checkbox"]');
            if (checkbox) {
              const checked = /** @type {HTMLInputElement} */ (checkbox).checked ? '[x]' : '[ ]';
              const text = Array.from(li.childNodes)
                .filter((n) => n !== checkbox)
                .map(serializeNode)
                .join('')
                .trim();
              return `- ${checked} ${text}`;
            }
            return `- ${Array.from(li.childNodes).map(serializeNode).join('').trim()}`;
          })
          .join('\n');
        return `${items}\n\n`;
      }
      case 'ol': {
        const items = Array.from(el.children)
          .map((li, idx) => `${idx + 1}. ${Array.from(li.childNodes).map(serializeNode).join('').trim()}`)
          .join('\n');
        return `${items}\n\n`;
      }
      case 'table': {
        const rows = Array.from(el.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        const matrix = rows.map((tr) =>
          Array.from(tr.querySelectorAll('th, td')).map((c) =>
            Array.from(c.childNodes).map(serializeNode).join('').replace(/\|/g, '\\|').trim(),
          ),
        );
        const colCount = Math.max(...matrix.map((r) => r.length));
        if (colCount === 0) return '';

        const paddedMatrix = matrix.map((row) => {
          while (row.length < colCount) row.push('');
          return row;
        });

        const headerRow = paddedMatrix[0];
        const headerMd = `| ${headerRow.join(' | ')} |`;
        const dividerMd = `| ${headerRow.map(() => '---').join(' | ')} |`;
        const bodyRows = paddedMatrix
          .slice(1)
          .map((row) => `| ${row.join(' | ')} |`)
          .join('\n');

        return `${headerMd}\n${dividerMd}${bodyRows ? '\n' + bodyRows : ''}\n\n`;
      }
      default:
        return childMarkdown;
    }
  }

  return Array.from(container.childNodes)
    .map(serializeNode)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Built-in professional templates.
 */
export const TEMPLATES = {
  blank: {
    id: 'blank',
    name: { en: 'Blank Document', de: 'Leeres Dokument' },
    description: { en: 'Start with an empty document', de: 'Mit einem leeren Dokument starten' },
    create: () => createDocument('Untitled Document', '<p><br></p>'),
  },

  letter: {
    id: 'letter',
    name: { en: 'Business Letter (DIN 5008)', de: 'Geschäftsbrief (DIN 5008)' },
    description: {
      en: 'Standard DIN 5008 letter format with sender, address field and date',
      de: 'Standard DIN 5008 Briefformat mit Absenderzeile, Anschriftfeld und Datum',
    },
    create: () => {
      const content = `
<div class="nx-write-letter-sender">Max Mustermann • Musterstraße 1 • 12345 Musterstadt</div>
<div class="nx-write-letter-recipient">
  <p><strong>Musterfirma GmbH</strong><br>
  Personalabteilung<br>
  Herrn Dr. Beispiel<br>
  Hauptstraße 42<br>
  10115 Berlin</p>
</div>
<div class="nx-write-letter-meta">
  <p style="text-align: right;">Musterstadt, 10. November 2026</p>
</div>
<p><br></p>
<h3 style="font-weight: bold; margin-bottom: 1rem;">Bewerbung als Lead Systems Engineer — Kennziffer 2026-NEXUS</h3>
<p>Sehr geehrte Damen und Herren,</p>
<p>mit großem Interesse habe ich Ihre Stellenausschreibung für die Position als Lead Systems Engineer im Bereich moderner Web- und Cloud-Architekturen gelesen. Durch meine mehrjährige Erfahrung in der Entwicklung hochperformanter, sicherer Desktop- und Web-Applikationen möchte ich Ihr Team maßgeblich verstärken.</p>
<p>In meiner bisherigen Tätigkeit konnte ich komplexe Systeme von Grund auf konzipieren, virtualisierte Arbeitsumgebungen realisieren und maßgeschneiderte Softwarelösungen für anspruchsvolle Nutzer bereitstellen. Dabei lege ich besonderen Wert auf Barrierefreiheit, saubere Softwarearchitektur und modernste Standards.</p>
<p>Über die Gelegenheit, mich Ihnen in einem persönlichen Gespräch vorzustellen, freue ich mich sehr.</p>
<p><br></p>
<p>Mit freundlichen Grüßen,</p>
<p><br></p>
<p><strong>Max Mustermann</strong></p>
<p><br></p>
<p><em>Anlagen</em></p>
      `.trim();
      return createDocument('Geschäftsbrief', content, { pageSize: 'A4', margins: 'normal' });
    },
  },

  cv: {
    id: 'cv',
    name: { en: 'Curriculum Vitae', de: 'Lebenslauf' },
    description: {
      en: 'Modern resume layout with profile, experience timeline and skills',
      de: 'Moderner Lebenslauf mit Profil, Berufsstationen und Fähigkeiten',
    },
    create: () => {
      const content = `
<h1 style="margin-bottom: 0.2rem;">Jane Doe</h1>
<h3 style="color: var(--accent); margin-top: 0;">Senior Software Architect & Systems Designer</h3>
<p><em>Email: jane.doe@example.com • Phone: +49 170 1234567 • Portfolio: nexus.arcade/janedoe</em></p>
<hr>
<h2>Profile</h2>
<p>Innovative software architect with 8+ years of engineering robust, scalable distributed applications. Deep expertise in browser operating systems, offline-first architectures, low-latency rendering engines, and team leadership.</p>
<h2>Professional Experience</h2>
<h3>Principal Engineer — Nexus Innovations (2022 – Present)</h3>
<ul>
  <li>Designed and shipped high-performance browser desktop environments serving thousands of active users.</li>
  <li>Implemented virtualized spreadsheet, mindmap and rich text engines with zero framework dependencies.</li>
  <li>Mentored engineering teams and elevated test coverage from 65% to 98%.</li>
</ul>
<h3>Senior Full-Stack Developer — CloudScale Systems (2018 – 2022)</h3>
<ul>
  <li>Led development of real-time collaborative document processing platforms.</li>
  <li>Architected end-to-end encrypted storage pipelines and local-first synchronization protocols.</li>
</ul>
<h2>Education</h2>
<h3>Master of Science in Computer Science — Technical University (2016 – 2018)</h3>
<p>Specialization: Distributed Systems & Human-Computer Interaction. Graduated with Honors.</p>
<h2>Technical Skills</h2>
<table>
  <tr><th>Domain</th><th>Technologies</th></tr>
  <tr><td>Languages</td><td>JavaScript (ES2022+), TypeScript, Rust, Python, C/C++</td></tr>
  <tr><td>Web & Architecture</td><td>Web Standards, Canvas API, IndexedDB, Service Workers, WebSockets</td></tr>
  <tr><td>Tools & DevOps</td><td>Git, Linux, Docker, CI/CD Pipelines, Vitest, Playwright</td></tr>
</table>
      `.trim();
      return createDocument('Curriculum Vitae', content, { pageSize: 'A4', margins: 'normal' });
    },
  },

  report: {
    id: 'report',
    name: { en: 'Formal Report', de: 'Formeller Bericht' },
    description: {
      en: 'Executive report layout with title, executive summary, tables and recommendations',
      de: 'Berichtslayout mit Titel, Zusammenfassung, Tabellen und Handlungsempfehlungen',
    },
    create: () => {
      const content = `
<h1 style="text-align: center; margin-top: 2rem;">Technical Evaluation & Performance Report</h1>
<p style="text-align: center; color: var(--text-2);"><em>Nexus Arcade OS Architecture Review • Q4 2026</em></p>
<p style="text-align: center;"><strong>Prepared by: Architecture Working Group</strong></p>
<hr>
<h2>Executive Summary</h2>
<p>This report presents an in-depth evaluation of the modern office suite components within Nexus Arcade OS. Performance metrics indicate instant load times (&lt;100ms), zero external telemetry, and strict adherence to open document standards.</p>
<h2>1. Objectives and Methodology</h2>
<p>The primary objective is providing fully featured, lightweight office applications that save directly to the Virtual File System (VFS) in open JSON and standard formats without relying on remote servers or subscription services.</p>
<h2>2. Benchmark Findings</h2>
<table>
  <tr><th>Application</th><th>Initial Render</th><th>Memory Footprint</th><th>Compliance</th></tr>
  <tr><td>Nexus Sheets</td><td>16 ms</td><td>4.2 MB</td><td>100% Passing</td></tr>
  <tr><td>Nexus Write</td><td>12 ms</td><td>3.8 MB</td><td>100% Passing</td></tr>
  <tr><td>Nexus Whiteboard</td><td>24 ms</td><td>5.1 MB</td><td>100% Passing</td></tr>
</table>
<h2>3. Recommendations</h2>
<ol>
  <li>Continue maintaining strict zero-UI-framework policy for minimal bundle weight.</li>
  <li>Ensure bidirectional compatibility between .ndoc, Markdown and sanitized HTML.</li>
  <li>Retain comprehensive unit test coverage and offline reliability.</li>
</ol>
<h2>Conclusion</h2>
<p>Nexus Write and associated office tools demonstrate enterprise-grade reliability and seamless desktop ergonomics within the browser environment.</p>
      `.trim();
      return createDocument('Formal Report', content, { pageSize: 'A4', margins: 'normal' });
    },
  },

  labReport: {
    id: 'labReport',
    name: { en: 'Scientific Lab Report', de: 'Wissenschaftlicher Laborbericht' },
    description: {
      en: 'Scientific experiment report with hypothesis, methodology, results and discussion',
      de: 'Wissenschaftlicher Versuchsbericht mit Hypothese, Methodik, Messdaten und Diskussion',
    },
    create: () => {
      const content = `
<h1>Laboratory Experiment: Frequency Response and Transient Analysis</h1>
<p><strong>Course:</strong> Advanced Electronics & Systems Lab (PHY-402)<br>
<strong>Date:</strong> November 10, 2026<br>
<strong>Investigators:</strong> Alex Rivera, Morgan Smith</p>
<hr>
<h2>Abstract</h2>
<p>In this investigation, we analyzed the frequency response and transient behavior of first- and second-order passive filter circuits. Experimental cutoff frequencies aligned with theoretical predictions within an error margin of 2.4%.</p>
<h2>1. Theoretical Hypothesis</h2>
<p>The cutoff frequency for an RC low-pass filter is governed by the relation <code>f_c = 1 / (2 * pi * R * C)</code>. It is hypothesized that signal attenuation above this threshold will exhibit a consistent -20 dB/decade roll-off rate.</p>
<h2>2. Materials & Equipment</h2>
<ul>
  <li>Precision Resistors: 1.0 kΩ (±1%) and 10.0 kΩ (±1%)</li>
  <li>Ceramic Capacitors: 100 nF and 10 nF</li>
  <li>Digital Storage Oscilloscope & Arbitrary Function Generator</li>
</ul>
<h2>3. Experimental Data</h2>
<table>
  <tr><th>Frequency (Hz)</th><th>Input Voltage (V_pp)</th><th>Output Voltage (V_pp)</th><th>Gain (dB)</th></tr>
  <tr><td>100</td><td>5.00</td><td>4.98</td><td>-0.03</td></tr>
  <tr><td>500</td><td>5.00</td><td>4.82</td><td>-0.32</td></tr>
  <tr><td>1,000</td><td>5.00</td><td>4.31</td><td>-1.29</td></tr>
  <tr><td>1,592 (Cutoff)</td><td>5.00</td><td>3.54</td><td>-3.00</td></tr>
  <tr><td>5,000</td><td>5.00</td><td>1.52</td><td>-10.34</td></tr>
</table>
<h2>4. Discussion & Conclusion</h2>
<p>The observed experimental cutoff at 1.59 kHz confirms the theoretical model. Slight discrepancies are attributable to probe capacitance and component tolerance.</p>
      `.trim();
      return createDocument('Lab Report', content, { pageSize: 'A4', margins: 'normal' });
    },
  },
};
