// @ts-check
import { describe, expect, it } from 'vitest';
import { loadSnapshots, takeSnapshot } from '../../src/apps/code/history.js';
import { buildTree, bundleWebProject, flattenFilePaths, searchFiles } from '../../src/apps/code/vfs-helper.js';

describe('Nexus Code - vfs-helper and history', () => {
  const fakeFs = {
    home: '/home/ada',
    files: {
      '/home/ada/Projects/my-app/index.html': `<!DOCTYPE html><html><head><link rel="stylesheet" href="style.css"></head><body><h1>Hello</h1><script src="app.js"></script></body></html>`,
      '/home/ada/Projects/my-app/style.css': `body { color: red; }`,
      '/home/ada/Projects/my-app/app.js': `console.log('App running');`,
      '/home/ada/Projects/my-app/src/utils.js': `export function add(a, b) { return a + b; }`,
    },
    async stat(path) {
      if (this.files[path]) {
        return { type: 'file', size: this.files[path].length, name: path.split('/').pop() };
      }
      const isDir = Object.keys(this.files).some((f) => f.startsWith(path + '/'));
      if (isDir || path === '/home/ada/Projects/my-app') {
        return { type: 'folder', name: path.split('/').pop() };
      }
      return null;
    },
    async list(path) {
      const prefix = path.endsWith('/') ? path : path + '/';
      const entries = new Map();
      for (const f of Object.keys(this.files)) {
        if (f.startsWith(prefix)) {
          const rest = f.slice(prefix.length);
          const parts = rest.split('/');
          const name = parts[0];
          if (parts.length > 1) {
            entries.set(name, { name, type: 'folder', path: `${prefix}${name}` });
          } else {
            entries.set(name, { name, type: 'file', path: `${prefix}${name}`, size: this.files[f].length });
          }
        }
      }
      return Array.from(entries.values());
    },
    async readFile(path, { as } = {}) {
      if (this.files[path] !== undefined) {
        if (as === 'binary') {
          return new TextEncoder().encode(this.files[path]);
        }
        return this.files[path];
      }
      throw new Error(`File not found: ${path}`);
    },
    async writeFile(path, content) {
      this.files[path] = content;
    },
  };

  it('buildTree and flattenFilePaths properly traverses project directory', async () => {
    const tree = await buildTree(fakeFs, '/home/ada/Projects/my-app');
    expect(tree.type).toBe('folder');
    expect(tree.children?.length).toBeGreaterThan(0);

    const paths = flattenFilePaths(tree);
    expect(paths).toContain('/home/ada/Projects/my-app/index.html');
    expect(paths).toContain('/home/ada/Projects/my-app/style.css');
    expect(paths).toContain('/home/ada/Projects/my-app/app.js');
    expect(paths).toContain('/home/ada/Projects/my-app/src/utils.js');
  });

  it('searchFiles searches text across files with options', async () => {
    const results = await searchFiles(fakeFs, '/home/ada/Projects/my-app', 'Hello', { matchCase: true });
    expect(results.length).toBe(1);
    expect(results[0].fileName).toBe('index.html');
    expect(results[0].line).toBe(1);

    const caseInsensitive = await searchFiles(fakeFs, '/home/ada/Projects/my-app', 'hello', { matchCase: false });
    expect(caseInsensitive.length).toBe(1);

    const regexResults = await searchFiles(fakeFs, '/home/ada/Projects/my-app', 'add\\(a,\\s*b\\)', { useRegex: true });
    expect(regexResults.length).toBe(1);
    expect(regexResults[0].fileName).toBe('utils.js');
  });

  it('bundleWebProject builds HTML document with blob asset replacements and console interceptor', async () => {
    const originalCreate = URL.createObjectURL;
    let urlCounter = 0;
    URL.createObjectURL = (_blob) => `blob:fake-url-${++urlCounter}`;

    try {
      const bundle = await bundleWebProject(fakeFs, '/home/ada/Projects/my-app');
      expect(bundle.html).toContain('nexus-preview');
      expect(bundle.html).toContain('blob:fake-url-');
      expect(bundle.blobUrls.length).toBeGreaterThan(0);
    } finally {
      URL.createObjectURL = originalCreate;
    }
  });

  it('local history manages snapshots', async () => {
    const memory = new Map();
    const fakeStorage = {
      kv: {
        async get(k) {
          return memory.get(k) || null;
        },
        async set(k, v) {
          memory.set(k, v);
        },
      },
    };

    const snap1 = await takeSnapshot(fakeStorage, '/home/ada/Projects/my-app', [
      { path: '/home/ada/Projects/my-app/app.js', content: 'console.log("v1");' },
    ]);
    expect(snap1.id).toBeDefined();

    const snapshots = await loadSnapshots(fakeStorage, '/home/ada/Projects/my-app');
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].files[0].content).toBe('console.log("v1");');
  });
});
