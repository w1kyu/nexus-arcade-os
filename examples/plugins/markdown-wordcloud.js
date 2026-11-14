/*
@nexus-plugin {
  "id": "plugin.markdown-wordcloud",
  "name": { "en": "Markdown Word Cloud", "de": "Markdown-Wortwolke" },
  "version": "1.0.0",
  "description": {
    "en": "Analyze Markdown files in your VFS or pasted text and render a weighted word cloud.",
    "de": "Analysiert Markdown-Dateien aus deinem VFS oder Text und erstellt eine Wortwolke."
  },
  "category": "productivity",
  "icon": "text",
  "permissions": ["vfs", "notifications"],
  "terminal": [
    {
      "name": "wordcloud",
      "description": {
        "en": "Print top words from a VFS Markdown file or folder",
        "de": "Top-Wörter einer Markdown-Datei oder eines Ordners ausgeben"
      },
      "usage": "wordcloud [path]"
    }
  ]
}
*/

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'with',
  'this',
  'from',
  'are',
  'was',
  'were',
  'have',
  'has',
  'not',
  'but',
  'you',
  'your',
  'can',
  'will',
  'all',
  'one',
  'two',
  'about',
  'into',
  'out',
  'der',
  'die',
  'das',
  'und',
  'für',
  'mit',
  'von',
  'ein',
  'eine',
  'ist',
  'sind',
  'auf',
]);

function countWords(text) {
  const counts = new Map();
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/[`*_#>[\]()~]/g, ' ')
    .match(/[a-zäöüß]{3,}/gi);
  for (const raw of tokens || []) {
    const word = raw.toLowerCase();
    if (STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 36);
}

async function gatherMarkdownText(ctx, startPath) {
  const home = await ctx.fs.home();
  const target = startPath || `${home}/Documents`;
  const stat = await ctx.fs.stat(target);
  if (!stat) return '';
  if (stat.type === 'file') return ctx.fs.readText(target);
  const nodes = await ctx.fs.walk(target);
  const mdFiles = nodes.filter((n) => n.type === 'file' && /\.(md|markdown|txt)$/i.test(n.name));
  const chunks = [];
  for (const file of mdFiles.slice(0, 30)) {
    chunks.push(await ctx.fs.readText(file.path));
  }
  return chunks.join('\n');
}

export async function mount(root, ctx) {
  let lastEntries = await ctx.storage.kv.get('lastWords', []);

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;gap:12px;';

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';

  const scanBtn = document.createElement('button');
  scanBtn.className = 'primary';
  scanBtn.textContent = ctx.i18n.locale === 'de' ? 'Dokumente scannen' : 'Scan Documents';

  const status = document.createElement('span');
  status.style.cssText = 'font-size:12px;color:var(--text-3);';

  const input = document.createElement('textarea');
  input.rows = 4;
  input.placeholder =
    ctx.i18n.locale === 'de' ? 'Oder Markdown-Text hier einfügen…' : 'Or paste Markdown text here to visualize…';
  input.style.cssText =
    'width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);resize:vertical;';

  const cloud = document.createElement('div');
  cloud.style.cssText =
    'display:flex;flex-wrap:wrap;gap:8px;padding:14px;border-radius:12px;background:var(--surface-1);border:1px solid var(--border);min-height:130px;align-items:center;align-content:center;';

  function renderCloud(entries) {
    cloud.innerHTML = '';
    if (!entries.length) {
      const empty = document.createElement('span');
      empty.style.cssText = 'color:var(--text-3);font-size:13px;';
      empty.textContent = ctx.i18n.locale === 'de' ? 'Noch keine Wörter analysiert.' : 'No words analyzed yet.';
      cloud.appendChild(empty);
      return;
    }
    const max = entries[0][1] || 1;
    const palette = ['var(--accent)', 'var(--accent-2)', 'var(--info)', 'var(--success)', 'var(--warning)'];
    entries.forEach(([word, count], idx) => {
      const pill = document.createElement('span');
      const scale = 12 + Math.round((count / max) * 16);
      pill.textContent = `${word} (${count})`;
      pill.style.cssText = `font-size:${scale}px;font-weight:${scale > 20 ? 700 : 500};color:${palette[idx % palette.length]};padding:2px 6px;border-radius:6px;background:var(--surface-2);`;
      cloud.appendChild(pill);
    });
  }

  scanBtn.addEventListener('click', async () => {
    status.textContent = ctx.i18n.locale === 'de' ? 'Scanne…' : 'Scanning…';
    try {
      const text = await gatherMarkdownText(ctx);
      lastEntries = countWords(text);
      await ctx.storage.kv.set('lastWords', lastEntries);
      renderCloud(lastEntries);
      status.textContent = `${lastEntries.length} keywords`;
      try {
        await ctx.notify({ title: 'Markdown Word Cloud', body: `Found ${lastEntries.length} top keywords.` });
      } catch {
        // Optional notification permission denied
      }
    } catch (err) {
      status.textContent = String(err?.message || err);
    }
  });

  input.addEventListener('input', async () => {
    lastEntries = countWords(input.value);
    renderCloud(lastEntries);
    status.textContent = `${lastEntries.length} keywords`;
  });

  bar.append(scanBtn, status);
  wrap.append(bar, input, cloud);
  root.appendChild(wrap);
  renderCloud(lastEntries);
}

export const terminal = {
  async wordcloud(ctx, io) {
    const path = io.args?.[0];
    const text = io.stdin ?? (await gatherMarkdownText(ctx, path));
    const entries = countWords(text).slice(0, 10);
    if (!entries.length) {
      io.out('No words found.\n');
      return 0;
    }
    for (const [word, count] of entries) {
      io.out(`${String(count).padStart(4, ' ')}  ${word}\n`);
    }
    return 0;
  },
};
