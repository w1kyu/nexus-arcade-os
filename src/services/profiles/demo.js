// @ts-check
// Demo Profile helper: creates rich sample VFS content so evaluators and new users
// can explore Files, Markdown Notes, Spreadsheets, Presentations, Code Playground, and Plugins.

/**
 * Populates sample files in `vfs.home` for a newly created demo profile.
 * @param {import('../vfs/vfs.js').Vfs} vfs
 * @param {{ kv?: { set(k: string, v: unknown): Promise<unknown> } }} [options]
 */
export async function populateDemoWorkspace(vfs, options = {}) {
  const home = vfs.home;
  const docs = `${home}/Documents`;
  const notes = `${home}/Documents/Notes`;
  const code = `${home}/Code`;

  await vfs.mkdir(notes, { recursive: true }).catch(() => {});
  await vfs.mkdir(code, { recursive: true }).catch(() => {});

  /** @type {[string, string][]} */
  const files = [
    [
      `${docs}/Welcome Demo.md`,
      `# Nexus Demo Workspace\n\nThis is a removable **Demo Profile** loaded with sample files.\n\n- Open \`Documents/Notes/Project Roadmap.md\` in **Markdown Notes**\n- Inspect \`Documents/Budget 2026.csv\` in **Spreadsheets**\n- Run \`Code/fibonacci.js\` in **Code Playground** or **Terminal**\n`,
    ],
    [
      `${notes}/Project Roadmap.md`,
      `# Project Roadmap — Q4 Release\n\n- [x] Offline PWA & Service Worker precaching\n- [x] Sandboxed Plugin SDK (\`allow-scripts\` iframe + RPC)\n- [x] Live Theme Editor with WCAG contrast audit\n- [ ] Publish v1.0.0 release artifact\n`,
    ],
    [
      `${notes}/Study Notes - Algorithms.md`,
      `# Graph Traversal\n\n## Breadth-First Search (BFS)\nExplores nodes layer by layer using a FIFO queue in $O(V + E)$ time.\n\n## Dijkstra's Algorithm\nComputes shortest paths on non-negative edge weights using a min-priority queue.\n`,
    ],
    [
      `${docs}/Budget 2026.csv`,
      `Category,Planned,Actual,Status\nHosting (Static),0,0,Free Offline\nHardware,850,790,Under Budget\nPeripherals,220,210,On Track\nCoffee,180,195,Over\n`,
    ],
    [
      `${code}/fibonacci.js`,
      `// Sample script for Code Playground / Terminal\nfunction fib(n) {\n  let [a, b] = [0, 1];\n  for (let i = 0; i < n; i++) [a, b] = [b, a + b];\n  return a;\n}\nconsole.log('fib(12) =', fib(12));\n`,
    ],
  ];

  for (const [path, content] of files) {
    if (!(await vfs.exists(path))) {
      await vfs.writeFile(path, content);
    }
  }

  if (options.kv) {
    await options.kv.set('isDemo', true);
    await options.kv.set('createdAt', Date.now());
  }
  return files.length;
}
