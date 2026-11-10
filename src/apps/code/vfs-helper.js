// @ts-check
// Helpers for Nexus Code: project folder tree, cross-file search, and web preview bundling.

/**
 * @typedef {object} TreeNode
 * @property {string} path
 * @property {string} name
 * @property {'file' | 'folder'} type
 * @property {number} [size]
 * @property {TreeNode[]} [children]
 */

/**
 * Recursively builds a folder tree for the given VFS path.
 * @param {any} fs
 * @param {string} rootPath
 * @returns {Promise<TreeNode>}
 */
export async function buildTree(fs, rootPath) {
  const stat = await fs.stat(rootPath);
  const name = rootPath.split('/').filter(Boolean).pop() || rootPath;
  if (!stat || stat.type !== 'folder') {
    return { path: rootPath, name, type: 'file', size: stat?.size ?? 0 };
  }

  const entries = await fs.list(rootPath).catch(() => []);
  const children = [];

  for (const entry of entries) {
    if (entry.type === 'folder') {
      children.push(await buildTree(fs, entry.path));
    } else {
      children.push({
        path: entry.path,
        name: entry.name,
        type: 'file',
        size: entry.size ?? 0,
      });
    }
  }

  // Sort folders first, then files alphabetically
  children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return {
    path: rootPath,
    name,
    type: 'folder',
    children,
  };
}

/**
 * Flattens tree into list of all file paths.
 * @param {TreeNode} node
 * @returns {string[]}
 */
export function flattenFilePaths(node) {
  if (node.type === 'file') return [node.path];
  const list = [];
  if (node.children) {
    for (const child of node.children) {
      list.push(...flattenFilePaths(child));
    }
  }
  return list;
}

/**
 * @typedef {object} SearchResultItem
 * @property {string} filePath
 * @property {string} fileName
 * @property {number} line
 * @property {number} column
 * @property {string} lineText
 * @property {string} matchText
 */

/**
 * Searches across text files in a project.
 * @param {any} fs
 * @param {string} rootPath
 * @param {string} query
 * @param {{ matchCase?: boolean, matchWholeWord?: boolean, useRegex?: boolean }} [options]
 * @returns {Promise<SearchResultItem[]>}
 */
export async function searchFiles(fs, rootPath, query, options = {}) {
  if (!query || !query.trim()) return [];

  const tree = await buildTree(fs, rootPath);
  const files = flattenFilePaths(tree);
  const results = [];

  let regex;
  try {
    let pattern = options.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (options.matchWholeWord) {
      pattern = `\\b${pattern}\\b`;
    }
    const flags = options.matchCase ? 'g' : 'gi';
    regex = new RegExp(pattern, flags);
  } catch {
    return [];
  }

  for (const file of files) {
    // Only search files with likely text extensions
    if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|zip|wasm|bin)$/i.test(file)) continue;

    try {
      const content = await fs.readFile(file, { as: 'text' });
      if (typeof content !== 'string') continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(line)) !== null) {
          results.push({
            filePath: file,
            fileName: file.split('/').pop() || file,
            line: i + 1,
            column: match.index + 1,
            lineText: line.trim(),
            matchText: match[0],
          });
          if (!regex.global) break;
        }
      }
    } catch {
      // Skip files that cannot be read
    }
  }

  return results;
}

/**
 * Bundles a web project from VFS into an executable HTML document with Blob URLs.
 * @param {any} fs
 * @param {string} rootPath
 * @returns {Promise<{ html: string, blobUrls: string[] }>}
 */
export async function bundleWebProject(fs, rootPath) {
  const blobUrls = [];
  const tree = await buildTree(fs, rootPath);
  const files = flattenFilePaths(tree);

  const indexPath = files.find((f) => f.endsWith('/index.html') || f === `${rootPath}/index.html`);
  if (!indexPath) {
    throw new Error('No index.html found in project folder');
  }

  let indexContent = await fs.readFile(indexPath, { as: 'text' });
  if (typeof indexContent !== 'string') {
    indexContent = '';
  }

  // Create mapping from relative path to Blob URL
  /** @type {Record<string, string>} */
  const assetMap = {};

  for (const file of files) {
    if (file === indexPath) continue;
    const rel = file.startsWith(rootPath) ? file.slice(rootPath.length).replace(/^\/+/, '') : file;

    try {
      let blob;
      if (/\.(html|css|js|json|svg|txt|md)$/i.test(file)) {
        const text = await fs.readFile(file, { as: 'text' });
        let type = 'text/plain';
        if (file.endsWith('.css')) type = 'text/css';
        else if (file.endsWith('.js')) type = 'application/javascript';
        else if (file.endsWith('.json')) type = 'application/json';
        else if (file.endsWith('.html')) type = 'text/html';
        else if (file.endsWith('.svg')) type = 'image/svg+xml';
        blob = new Blob([text], { type });
      } else {
        const bin = await fs.readFile(file, { as: 'binary' });
        let type = 'application/octet-stream';
        if (/\.png$/i.test(file)) type = 'image/png';
        else if (/\.jpe?g$/i.test(file)) type = 'image/jpeg';
        else if (/\.gif$/i.test(file)) type = 'image/gif';
        blob = new Blob([bin], { type });
      }
      const url = URL.createObjectURL(blob);
      blobUrls.push(url);
      assetMap[rel] = url;
      assetMap[`./${rel}`] = url;
    } catch {
      // Ignore unreadable assets
    }
  }

  // Replace links, scripts and img sources with blob URLs
  for (const [rel, url] of Object.entries(assetMap)) {
    const escapedRel = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    indexContent = indexContent.replace(new RegExp(`(src|href)=["']${escapedRel}["']`, 'g'), `$1="${url}"`);
  }

  // Inject console interceptor
  const interceptor =
    `
  <script>
    (function() {
      function send(type, args) {
        window.parent.postMessage({
          source: 'nexus-preview',
          type: type,
          args: args.map(a => {
            try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
            catch(e) { return String(a); }
          })
        }, '*');
      }
      var log = console.log, warn = console.warn, err = console.error;
      console.log = function() { send('log', Array.from(arguments)); log.apply(console, arguments); };
      console.warn = function() { send('warn', Array.from(arguments)); warn.apply(console, arguments); };
      console.error = function() { send('error', Array.from(arguments)); err.apply(console, arguments); };
      window.onerror = function(msg, url, line) {
        send('error', [msg + (line ? ' (line ' + line + ')' : '')]);
      };
    })();
  <` + `/script>`;

  if (indexContent.includes('<head>')) {
    indexContent = indexContent.replace('<head>', `<head>${interceptor}`);
  } else {
    indexContent = `${interceptor}\n${indexContent}`;
  }

  return { html: indexContent, blobUrls };
}
