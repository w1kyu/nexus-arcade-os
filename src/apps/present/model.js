// @ts-check

/**
 * Supported slide themes.
 */
export const PRESENT_THEMES = {
  dark: {
    id: 'dark',
    name: 'Nexus Dark',
    bg: '#0f172a',
    text: '#f8fafc',
    accent: '#6366f1',
    font: 'system-ui, -apple-system, sans-serif',
  },
  light: {
    id: 'light',
    name: 'Clean Light',
    bg: '#ffffff',
    text: '#0f172a',
    accent: '#2563eb',
    font: 'system-ui, -apple-system, sans-serif',
  },
  retro: {
    id: 'retro',
    name: 'Terminal Retro',
    bg: '#0d1117',
    text: '#00ff66',
    accent: '#00cc55',
    font: 'ui-monospace, monospace',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    bg: '#090014',
    text: '#fdf4ff',
    accent: '#ec4899',
    font: 'system-ui, sans-serif',
  },
  paper: {
    id: 'paper',
    name: 'Warm Paper',
    bg: '#fbf7ee',
    text: '#292524',
    accent: '#c2410c',
    font: 'Charter, Georgia, serif',
  },
};

export const PRESENT_TEMPLATES = {
  pitch: {
    id: 'pitch',
    title: 'Project Pitch Deck',
    markdown: `# Nexus Arcade
### The Next-Generation Web Operating System
*Presented by the Core Team*

<!-- note: Welcome everyone. Today we are excited to unveil Nexus Arcade OS. -->

---

# The Problem
- Modern web apps are isolated and disconnected
- Desktop software requires heavy installs and platform-specific builds
- Context switching across tabs kills focus and productivity

<!-- note: Emphasize the loss of focus and fragmentation in modern workflows. -->

---

# The Solution: Nexus Arcade
- **Pure Web Architecture:** Zero-install, instant startup, sandboxed VFS
- **Unified Window Manager:** Tiling, overlapping, virtual desktops
- **Rich Native App Suite:** Documents, spreadsheets, whiteboards, pixel art

<!-- note: Highlight how fast it loads and the complete desktop experience. -->

---

# Architecture Overview
\`\`\`
+---------------------------------------------+
|           Nexus Arcade Window Manager       |
+----------------------+----------------------+
|   Office & Creative  |   Developer Suite    |
|   - Sheets           |   - Code Editor      |
|   - Write            |   - Terminal & Shell |
|   - Present          |   - CS Lab           |
+----------------------+----------------------+
|             Sandboxed Virtual FS            |
+---------------------------------------------+
\`\`\`

<!-- note: Point out the clean modular architecture and security boundaries. -->

---

# Roadmap & Impact
1. **Phase 1-5:** Kernel, Window Manager, Productivity, Study Suite (Complete)
2. **Phase 6:** Office & Creative Suite (In Flight)
3. **Phase 7:** CS Lab, Micro-tools, Games & Final Polish

### Thank You!
*Questions & Discussion*
`,
  },
  lecture: {
    id: 'lecture',
    title: 'Computer Science Lecture',
    markdown: `# CS 101: Data Structures
## Lecture 4: Trees & Graphs
*Department of Computer Science*

<!-- note: Good morning class. Today we will study hierarchical data structures. -->

---

# Binary Search Trees (BST)
A binary tree where for each node:
- All values in the **left subtree** are smaller
- All values in the **right subtree** are larger

$$h \\le \\log_2(n)$$

*Search complexity: $O(\\log n)$ balanced, $O(n)$ worst-case.*

<!-- note: Review why unbalanced trees degrade into linked lists. -->

---

# Tree Traversal in Code
\`\`\`javascript
function inorder(node) {
  if (!node) return;
  inorder(node.left);
  console.log(node.value);
  inorder(node.right);
}
\`\`\`

- **In-order:** Left, Root, Right (Yields sorted order)
- **Pre-order:** Root, Left, Right
- **Post-order:** Left, Right, Root

<!-- note: Walk through recursion call stack. -->

---

# Next Week
- Balancing trees: **AVL** & **Red-Black Trees**
- Graph representations: Adjacency Matrix vs List
- **Assignment 2** due this Friday at 23:59!
`,
  },
};

/**
 * @typedef {object} ParsedSlide
 * @property {number} index
 * @property {string} title
 * @property {string} content
 * @property {string} notes
 * @property {string} raw
 */

/**
 * @typedef {object} PresentDoc
 * @property {number} version
 * @property {string} title
 * @property {string} theme
 * @property {string} aspectRatio
 * @property {string} source
 * @property {{ created: number, modified: number }} metadata
 */

/**
 * Create a new presentation document.
 * @param {string} [title='Untitled Presentation']
 * @param {string} [template='pitch']
 * @returns {PresentDoc}
 */
export function createPresentDoc(title = 'Untitled Presentation', template = 'pitch') {
  const tpl = PRESENT_TEMPLATES[template] || PRESENT_TEMPLATES.pitch;
  const now = Date.now();
  return {
    version: 1,
    title,
    theme: 'dark',
    aspectRatio: '16:9',
    source: tpl.markdown,
    metadata: {
      created: now,
      modified: now,
    },
  };
}

/**
 * Parse markdown into an array of slide objects.
 * Splits on `^---$` or `\n---\n`.
 * @param {string} source
 * @returns {ParsedSlide[]}
 */
export function parseSlides(source) {
  if (!source || !source.trim()) {
    return [
      {
        index: 0,
        title: 'Empty Slide',
        content: '# Empty Presentation',
        notes: '',
        raw: '# Empty Presentation',
      },
    ];
  }

  // Split on `---` horizontal rules alone on a line
  const rawSlides = source.split(/(?:^|\n)---\s*(?:\n|$)/);

  return rawSlides.map((raw, idx) => {
    let clean = raw.trim();
    let notes = '';

    // Extract HTML comment notes: <!-- note: ... --> or <!-- Notes: ... -->
    clean = clean.replace(/<!--\s*notes?:\s*([\s\S]*?)\s*-->/gi, (_, n) => {
      notes += (notes ? '\n\n' : '') + n.trim();
      return '';
    });

    // Extract trailing `Note: ...` or `Notes: ...` lines
    clean = clean.replace(/(?:^|\n)notes?:\s*([^\n]+(?:\n(?!\n|#)[^\n]+)*)/gi, (match, n) => {
      notes += (notes ? '\n\n' : '') + n.trim();
      return '';
    });

    clean = clean.trim();

    // Determine slide title from first heading
    let title = `Slide ${idx + 1}`;
    const headingMatch = clean.match(/^#{1,3}\s+([^\n]+)/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    }

    return {
      index: idx,
      title,
      content: clean,
      notes: notes.trim(),
      raw,
    };
  });
}

/**
 * Serialize document to JSON string.
 * @param {PresentDoc} doc
 * @returns {string}
 */
export function serializePresentDoc(doc) {
  return JSON.stringify(doc, null, 2);
}

/**
 * Parse document from JSON or raw Markdown string.
 * @param {string} str
 * @returns {PresentDoc}
 */
export function parsePresentDoc(str) {
  try {
    const data = JSON.parse(str);
    if (data && typeof data === 'object' && typeof data.source === 'string') {
      return {
        version: typeof data.version === 'number' ? data.version : 1,
        title: typeof data.title === 'string' ? data.title : 'Untitled Presentation',
        theme: data.theme && data.theme in PRESENT_THEMES ? data.theme : 'dark',
        aspectRatio: data.aspectRatio === '4:3' ? '4:3' : '16:9',
        source: data.source,
        metadata: {
          created: typeof data.metadata?.created === 'number' ? data.metadata.created : Date.now(),
          modified: typeof data.metadata?.modified === 'number' ? data.metadata.modified : Date.now(),
        },
      };
    }
  } catch {
    // If not JSON, treat raw string as pure Markdown file!
  }

  // Treat as markdown source file
  const firstHeading = str.match(/^#\s+([^\n]+)/m);
  const title = firstHeading ? firstHeading[1].trim() : 'Presentation';
  return {
    version: 1,
    title,
    theme: 'dark',
    aspectRatio: '16:9',
    source: str,
    metadata: {
      created: Date.now(),
      modified: Date.now(),
    },
  };
}

/**
 * Generate a standalone offline HTML presentation file.
 * @param {PresentDoc} doc
 * @param {string[]} renderedSlidesHtml
 * @returns {string}
 */
export function generateStandaloneHtml(doc, renderedSlidesHtml) {
  const theme = PRESENT_THEMES[doc.theme] || PRESENT_THEMES.dark;
  const is43 = doc.aspectRatio === '4:3';
  const width = is43 ? 1024 : 1280;
  const height = is43 ? 768 : 720;

  const slidesHtml = renderedSlidesHtml
    .map(
      (html, idx) => `
    <section class="slide ${idx === 0 ? 'active' : ''}" data-index="${idx}">
      <div class="slide-content">
        ${html}
      </div>
      <div class="slide-footer">
        <span class="slide-title">${escapeHtml(doc.title)}</span>
        <span class="slide-counter">${idx + 1} / ${renderedSlidesHtml.length}</span>
      </div>
    </section>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(doc.title)}</title>
  <style>
    :root {
      --bg: ${theme.bg};
      --text: ${theme.text};
      --accent: ${theme.accent};
      --font: ${theme.font};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #000000;
      color: var(--text);
      font-family: var(--font);
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }
    .deck-container {
      width: ${width}px;
      height: ${height}px;
      background: var(--bg);
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
    }
    .slide {
      position: absolute;
      inset: 0;
      display: none;
      flex-direction: column;
      padding: 60px 80px 40px 80px;
      background: var(--bg);
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
    }
    .slide.active {
      display: flex;
      opacity: 1;
    }
    .slide-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
      line-height: 1.6;
    }
    .slide-content h1 { font-size: 2.8rem; margin-bottom: 24px; color: var(--text); border-bottom: 3px solid var(--accent); padding-bottom: 12px; }
    .slide-content h2 { font-size: 2.2rem; margin-bottom: 16px; color: var(--accent); }
    .slide-content h3 { font-size: 1.6rem; margin-bottom: 12px; opacity: 0.9; }
    .slide-content p { font-size: 1.3rem; margin-bottom: 16px; }
    .slide-content ul, .slide-content ol { font-size: 1.3rem; margin-left: 36px; margin-bottom: 20px; }
    .slide-content li { margin-bottom: 10px; }
    .slide-content pre {
      background: rgba(0,0,0,0.3);
      padding: 16px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      font-family: ui-monospace, monospace;
      font-size: 1.1rem;
      overflow-x: auto;
      margin-bottom: 16px;
    }
    .slide-content code {
      font-family: ui-monospace, monospace;
      background: rgba(255,255,255,0.1);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .slide-content blockquote {
      border-left: 4px solid var(--accent);
      padding-left: 16px;
      font-style: italic;
      opacity: 0.85;
      margin-bottom: 16px;
    }
    .slide-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 0.9rem;
      opacity: 0.6;
    }
    /* Controls hint */
    .nav-hint {
      position: fixed;
      bottom: 12px;
      right: 12px;
      background: rgba(0,0,0,0.6);
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 11px;
      color: #888;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div class="deck-container" id="deck">
    ${slidesHtml}
  </div>
  <div class="nav-hint">Arrows / Space: Navigate • F: Fullscreen</div>

  <script>
    (function() {
      const slides = Array.from(document.querySelectorAll('.slide'));
      let current = 0;

      function showSlide(idx) {
        if (idx < 0 || idx >= slides.length) return;
        slides[current].classList.remove('active');
        current = idx;
        slides[current].classList.add('active');
      }

      function next() { showSlide(current + 1); }
      function prev() { showSlide(current - 1); }

      window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
          e.preventDefault();
          next();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Backspace') {
          e.preventDefault();
          prev();
        } else if (e.key === 'Home') {
          e.preventDefault();
          showSlide(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          showSlide(slides.length - 1);
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
        }
      });

      // Fit deck container to screen on resize
      function fitDeck() {
        const deck = document.getElementById('deck');
        const scaleX = window.innerWidth / ${width};
        const scaleY = window.innerHeight / ${height};
        const scale = Math.min(scaleX, scaleY, 1);
        deck.style.transform = 'scale(' + scale + ')';
      }
      window.addEventListener('resize', fitDeck);
      fitDeck();
    })();
  </script>
</body>
</html>`;
}

/** @param {string} s */
function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
