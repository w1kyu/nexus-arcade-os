// @ts-check

/**
 * @typedef {object} MindmapNode
 * @property {string} id
 * @property {string} text
 * @property {string} [color]
 * @property {string} [note]
 * @property {boolean} [collapsed]
 * @property {MindmapNode[]} children
 */

/**
 * @typedef {'radial' | 'right' | 'org'} LayoutMode
 */

/**
 * @typedef {object} LayoutNode
 * @property {string} id
 * @property {string} text
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {string} color
 * @property {string} [note]
 * @property {boolean} collapsed
 * @property {boolean} hasChildren
 * @property {LayoutNode | null} parent
 * @property {LayoutNode[]} children
 * @property {number} [parentAnchorX]
 * @property {number} [parentAnchorY]
 */

/**
 * @typedef {object} MindmapData
 * @property {number} version
 * @property {string} title
 * @property {LayoutMode} layout
 * @property {MindmapNode} root
 * @property {{ created: number, modified: number }} metadata
 */

export const NODE_COLORS = [
  '#3b82f6', // Blue (primary)
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Slate
];

let nextId = 1;
export function generateNodeId(prefix = 'node') {
  return `${prefix}_${Date.now()}_${nextId++}`;
}

/**
 * Create default empty mindmap.
 * @param {string} [title='Central Topic']
 * @param {LayoutMode} [layout='right']
 * @returns {MindmapData}
 */
export function createMindmap(title = 'Central Topic', layout = 'right') {
  const now = Date.now();
  return {
    version: 1,
    title,
    layout,
    root: {
      id: 'root',
      text: title,
      color: NODE_COLORS[0],
      children: [
        { id: generateNodeId(), text: 'Idea 1', color: NODE_COLORS[1], children: [] },
        { id: generateNodeId(), text: 'Idea 2', color: NODE_COLORS[2], children: [] },
        { id: generateNodeId(), text: 'Idea 3', color: NODE_COLORS[3], children: [] },
      ],
    },
    metadata: {
      created: now,
      modified: now,
    },
  };
}

/**
 * Serialize mindmap to JSON string.
 * @param {MindmapData} data
 * @returns {string}
 */
export function serializeMindmap(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * Parse mindmap from JSON string.
 * @param {string} jsonStr
 * @returns {MindmapData}
 */
export function parseMindmap(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object' || !data.root) return createMindmap();
    return {
      version: typeof data.version === 'number' ? data.version : 1,
      title: typeof data.title === 'string' ? data.title : data.root.text || 'Central Topic',
      layout: ['radial', 'right', 'org'].includes(data.layout) ? data.layout : 'right',
      root: sanitizeNode(data.root),
      metadata: {
        created: typeof data.metadata?.created === 'number' ? data.metadata.created : Date.now(),
        modified: typeof data.metadata?.modified === 'number' ? data.metadata.modified : Date.now(),
      },
    };
  } catch {
    return createMindmap();
  }
}

function sanitizeNode(node) {
  return {
    id: typeof node.id === 'string' ? node.id : generateNodeId(),
    text: typeof node.text === 'string' ? node.text : 'Untitled',
    color: typeof node.color === 'string' ? node.color : NODE_COLORS[0],
    note: typeof node.note === 'string' ? node.note : '',
    collapsed: Boolean(node.collapsed),
    children: Array.isArray(node.children) ? node.children.map(sanitizeNode) : [],
  };
}

/**
 * Find node by ID in tree.
 * @param {MindmapNode} root
 * @param {string} id
 * @returns {MindmapNode | null}
 */
export function findNode(root, id) {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Find parent of a node.
 * @param {MindmapNode} root
 * @param {string} id
 * @returns {MindmapNode | null}
 */
export function findParent(root, id) {
  for (const child of root.children) {
    if (child.id === id) return root;
    const p = findParent(child, id);
    if (p) return p;
  }
  return null;
}

/**
 * Add child to target node.
 * @param {MindmapNode} root
 * @param {string} targetId
 * @param {string} [text='New Subtopic']
 * @returns {MindmapNode | null}
 */
export function addChildNode(root, targetId, text = 'New Subtopic') {
  const target = findNode(root, targetId);
  if (!target) return null;
  const parentIdx = root.children.indexOf(target);
  const color =
    target.id === root.id
      ? NODE_COLORS[(target.children.length + 1) % NODE_COLORS.length]
      : target.color || NODE_COLORS[parentIdx % NODE_COLORS.length] || NODE_COLORS[1];

  const newNode = {
    id: generateNodeId(),
    text,
    color,
    children: [],
  };
  target.children.push(newNode);
  target.collapsed = false;
  return newNode;
}

/**
 * Add sibling node.
 * @param {MindmapNode} root
 * @param {string} targetId
 * @param {string} [text='New Topic']
 * @returns {MindmapNode | null}
 */
export function addSiblingNode(root, targetId, text = 'New Topic') {
  if (targetId === root.id) {
    return addChildNode(root, root.id, text);
  }
  const parent = findParent(root, targetId);
  if (!parent) return null;
  const idx = parent.children.findIndex((c) => c.id === targetId);
  const siblingColor = parent.children[idx]?.color || parent.color || NODE_COLORS[1];

  const newNode = {
    id: generateNodeId(),
    text,
    color: siblingColor,
    children: [],
  };
  parent.children.splice(idx + 1, 0, newNode);
  return newNode;
}

/**
 * Delete node (cannot delete root).
 * @param {MindmapNode} root
 * @param {string} targetId
 * @returns {boolean}
 */
export function deleteNode(root, targetId) {
  if (targetId === root.id) return false;
  const parent = findParent(root, targetId);
  if (!parent) return false;
  const idx = parent.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    parent.children.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * Layout engine: computes coordinate positions for all nodes.
 * @param {MindmapNode} root
 * @param {LayoutMode} mode
 * @returns {LayoutNode}
 */
export function computeLayout(root, mode = 'right') {
  function measure(text, isRoot = false) {
    const len = (text || '').length;
    const baseW = isRoot ? 160 : 120;
    const w = Math.max(baseW, Math.min(260, len * 9 + 36));
    const h = isRoot ? 50 : 38;
    return { w, h };
  }

  if (mode === 'org') {
    return computeOrgLayout(root, measure);
  } else if (mode === 'radial') {
    return computeRadialLayout(root, measure);
  }
  return computeRightTreeLayout(root, measure);
}

function computeRightTreeLayout(rootNode, measure) {
  /**
   * @param {MindmapNode} node
   * @param {LayoutNode | null} parent
   * @returns {LayoutNode}
   */
  function buildTree(node, parent) {
    const m = measure(node.text, node.id === 'root');
    const lNode = {
      id: node.id,
      text: node.text,
      x: 0,
      y: 0,
      width: m.w,
      height: m.h,
      color: node.color || NODE_COLORS[0],
      note: node.note,
      collapsed: Boolean(node.collapsed),
      hasChildren: node.children.length > 0,
      parent,
      children: [],
    };

    if (!node.collapsed) {
      lNode.children = node.children.map((c) => buildTree(c, lNode));
    }
    return lNode;
  }

  const root = buildTree(rootNode, null);
  root.x = 80;

  function calculateSubtreeHeight(n) {
    if (n.children.length === 0) return n.height + 24;
    return n.children.reduce((acc, c) => acc + calculateSubtreeHeight(c), 0);
  }

  function layoutSubtree(n, x, startY) {
    n.x = x;
    const subH = calculateSubtreeHeight(n);
    n.y = startY + subH / 2 - n.height / 2;

    let curY = startY;
    const childX = x + n.width + 60;
    n.children.forEach((c) => {
      const cH = calculateSubtreeHeight(c);
      layoutSubtree(c, childX, curY);
      curY += cH;
    });
  }

  const totalH = calculateSubtreeHeight(root);
  layoutSubtree(root, 80, -totalH / 2);
  return root;
}

function computeOrgLayout(rootNode, measure) {
  function buildTree(node, parent) {
    const m = measure(node.text, node.id === 'root');
    const lNode = {
      id: node.id,
      text: node.text,
      x: 0,
      y: 0,
      width: m.w,
      height: m.h,
      color: node.color || NODE_COLORS[0],
      note: node.note,
      collapsed: Boolean(node.collapsed),
      hasChildren: node.children.length > 0,
      parent,
      children: [],
    };
    if (!node.collapsed) {
      lNode.children = node.children.map((c) => buildTree(c, lNode));
    }
    return lNode;
  }

  const root = buildTree(rootNode, null);

  function calculateSubtreeWidth(n) {
    if (n.children.length === 0) return n.width + 30;
    return Math.max(
      n.width + 30,
      n.children.reduce((acc, c) => acc + calculateSubtreeWidth(c), 0),
    );
  }

  function layoutSubtree(n, startX, y) {
    n.y = y;
    const subW = calculateSubtreeWidth(n);
    n.x = startX + subW / 2 - n.width / 2;

    let curX = startX;
    const childY = y + n.height + 60;
    n.children.forEach((c) => {
      const cW = calculateSubtreeWidth(c);
      layoutSubtree(c, curX, childY);
      curX += cW;
    });
  }

  const totalW = calculateSubtreeWidth(root);
  layoutSubtree(root, -totalW / 2, 80);
  return root;
}

function computeRadialLayout(rootNode, measure) {
  const rootM = measure(rootNode.text, true);
  const root = {
    id: rootNode.id,
    text: rootNode.text,
    x: 0,
    y: 0,
    width: rootM.w,
    height: rootM.h,
    color: rootNode.color || NODE_COLORS[0],
    note: rootNode.note,
    collapsed: Boolean(rootNode.collapsed),
    hasChildren: rootNode.children.length > 0,
    parent: null,
    children: /** @type {LayoutNode[]} */ ([]),
  };

  if (!rootNode.collapsed && rootNode.children.length > 0) {
    const total = rootNode.children.length;
    rootNode.children.forEach((c, idx) => {
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      const radius = 240;
      const cm = measure(c.text);
      const cx = Math.cos(angle) * radius - cm.w / 2;
      const cy = Math.sin(angle) * radius - cm.h / 2;

      const cNode = {
        id: c.id,
        text: c.text,
        x: Math.round(cx),
        y: Math.round(cy),
        width: cm.w,
        height: cm.h,
        color: c.color || NODE_COLORS[1],
        note: c.note,
        collapsed: Boolean(c.collapsed),
        hasChildren: c.children.length > 0,
        parent: root,
        children: /** @type {LayoutNode[]} */ ([]),
      };

      if (!c.collapsed && c.children.length > 0) {
        c.children.forEach((gc, gIdx) => {
          const gAngle = angle + (gIdx - (c.children.length - 1) / 2) * 0.35;
          const gRadius = 420;
          const gm = measure(gc.text);
          const gx = Math.cos(gAngle) * gRadius - gm.w / 2;
          const gy = Math.sin(gAngle) * gRadius - gm.h / 2;

          cNode.children.push({
            id: gc.id,
            text: gc.text,
            x: Math.round(gx),
            y: Math.round(gy),
            width: gm.w,
            height: gm.h,
            color: gc.color || cNode.color,
            note: gc.note,
            collapsed: false,
            hasChildren: false,
            parent: cNode,
            children: [],
          });
        });
      }

      root.children.push(cNode);
    });
  }

  return root;
}

/**
 * Convert Mindmap tree to Markdown bullet outline.
 * @param {MindmapNode} root
 * @returns {string}
 */
export function exportToMarkdown(root) {
  let md = `# ${root.text}\n\n`;

  function serializeNode(node, depth = 0) {
    const indent = '  '.repeat(depth);
    md += `${indent}- ${node.text}\n`;
    if (node.note) {
      md += `${indent}  > ${node.note}\n`;
    }
    node.children.forEach((c) => serializeNode(c, depth + 1));
  }

  root.children.forEach((c) => serializeNode(c, 0));
  return md;
}

/**
 * Import Markdown outline into Mindmap tree.
 * @param {string} markdown
 * @returns {MindmapNode}
 */
export function importFromMarkdown(markdown) {
  const lines = markdown.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return createMindmap().root;

  let rootTitle = 'Central Topic';
  let startIndex = 0;

  if (lines[0].startsWith('# ')) {
    rootTitle = lines[0].replace(/^#\s+/, '').trim();
    startIndex = 1;
  }

  const root = {
    id: 'root',
    text: rootTitle,
    color: NODE_COLORS[0],
    children: [],
  };

  /** @type {{ node: MindmapNode, depth: number }[]} */
  const stack = [{ node: root, depth: -1 }];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('>')) {
      // Note for previous node
      const active = stack[stack.length - 1];
      if (active)
        active.node.note = (active.node.note ? active.node.note + '\n' : '') + line.replace(/^>\s*/, '').trim();
      continue;
    }

    const match = line.match(/^(\s*)(?:[-*+]|\d+\.)\s+(.+)$/);
    if (!match) continue;

    const indentSpaces = match[1].length;
    const depth = Math.floor(indentSpaces / 2);
    const text = match[2].trim();

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].node;
    const newNode = {
      id: generateNodeId(),
      text,
      color: parent.id === 'root' ? NODE_COLORS[(parent.children.length + 1) % NODE_COLORS.length] : parent.color,
      children: [],
    };
    parent.children.push(newNode);
    stack.push({ node: newNode, depth });
  }

  return root;
}

/**
 * Export layout tree to SVG.
 * @param {LayoutNode} rootLayout
 * @returns {string}
 */
export function exportMindmapToSvg(rootLayout) {
  /** @type {LayoutNode[]} */
  const allNodes = [];
  function collect(n) {
    allNodes.push(n);
    n.children.forEach(collect);
  }
  collect(rootLayout);

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  allNodes.forEach((n) => {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  });

  const pad = 60;
  const width = Math.max(400, maxX - minX + pad * 2);
  const height = Math.max(300, maxY - minY + pad * 2);
  const vx = minX - pad;
  const vy = minY - pad;

  let curvesSvg = '';
  let nodesSvg = '';

  allNodes.forEach((n) => {
    if (n.parent) {
      const p = n.parent;
      const x1 = p.x + p.width;
      const y1 = p.y + p.height / 2;
      const x2 = n.x;
      const y2 = n.y + n.height / 2;
      const midX = (x1 + x2) / 2;
      curvesSvg += `<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" fill="none" stroke="${n.color}" stroke-width="2.5" />\n`;
    }

    nodesSvg += `<g>
      <rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="12" fill="${n.color}" />
      <text x="${n.x + n.width / 2}" y="${n.y + n.height / 2 + 5}" text-anchor="middle" font-family="sans-serif" font-size="${n.id === 'root' ? 16 : 13}" font-weight="bold" fill="#ffffff">${escapeXml(n.text)}</text>
    </g>\n`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${width} ${height}" width="${width}" height="${height}">
  <rect x="${vx}" y="${vy}" width="${width}" height="${height}" fill="#f8fafc" />
  ${curvesSvg}
  ${nodesSvg}
</svg>`;
}

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
