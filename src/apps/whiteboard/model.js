// @ts-check

/**
 * @typedef {object} Point
 * @property {number} x
 * @property {number} y
 * @property {number} [pressure]
 */

/**
 * @typedef {object} BoardElement
 * @property {string} id
 * @property {'pen' | 'highlighter' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text' | 'sticky' | 'frame'} type
 * @property {number} x
 * @property {number} y
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [x2]
 * @property {number} [y2]
 * @property {Point[]} [points]
 * @property {string} [stroke]
 * @property {number} [strokeWidth]
 * @property {string} [fill]
 * @property {number} [opacity]
 * @property {string} [text]
 * @property {number} [fontSize]
 * @property {string} [fontFamily]
 * @property {string} [color]
 * @property {string} [title]
 * @property {string} [groupId]
 * @property {{ targetId: string, anchor: 'top' | 'right' | 'bottom' | 'left' }} [startConnector]
 * @property {{ targetId: string, anchor: 'top' | 'right' | 'bottom' | 'left' }} [endConnector]
 */

/**
 * @typedef {object} BoardViewport
 * @property {number} x
 * @property {number} y
 * @property {number} zoom
 */

/**
 * @typedef {object} BoardData
 * @property {number} version
 * @property {string} title
 * @property {BoardViewport} viewport
 * @property {BoardElement[]} elements
 * @property {{ created: number, modified: number }} metadata
 */

export const STICKY_COLORS = {
  yellow: '#fef08a',
  blue: '#bfdbfe',
  green: '#bbf7d0',
  pink: '#fbcfe8',
  purple: '#e9d5ff',
  orange: '#fed7aa',
};

/**
 * Create a new board data structure.
 * @param {string} [title='Untitled Whiteboard']
 * @param {BoardElement[]} [elements=[]]
 * @param {BoardViewport} [viewport={ x: 0, y: 0, zoom: 1 }]
 * @returns {BoardData}
 */
export function createBoard(title = 'Untitled Whiteboard', elements = [], viewport = { x: 0, y: 0, zoom: 1 }) {
  const now = Date.now();
  return {
    version: 1,
    title,
    viewport: { ...viewport },
    elements: [...elements],
    metadata: {
      created: now,
      modified: now,
    },
  };
}

/**
 * Serialize board to JSON string.
 * @param {BoardData} board
 * @returns {string}
 */
export function serializeBoard(board) {
  return JSON.stringify(board, null, 2);
}

/**
 * Parse board from JSON string.
 * @param {string} jsonStr
 * @returns {BoardData}
 */
export function parseBoard(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return createBoard();
    return {
      version: typeof data.version === 'number' ? data.version : 1,
      title: typeof data.title === 'string' ? data.title : 'Untitled Whiteboard',
      viewport: {
        x: typeof data.viewport?.x === 'number' ? data.viewport.x : 0,
        y: typeof data.viewport?.y === 'number' ? data.viewport.y : 0,
        zoom: typeof data.viewport?.zoom === 'number' ? data.viewport.zoom : 1,
      },
      elements: Array.isArray(data.elements) ? data.elements : [],
      metadata: {
        created: typeof data.metadata?.created === 'number' ? data.metadata.created : Date.now(),
        modified: typeof data.metadata?.modified === 'number' ? data.metadata.modified : Date.now(),
      },
    };
  } catch {
    return createBoard();
  }
}

let nextElemId = 1;
export function generateElementId(prefix = 'elem') {
  return `${prefix}_${Date.now()}_${nextElemId++}`;
}

/**
 * Get bounding box of an element.
 * @param {BoardElement} el
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
 */
export function getElementBounds(el) {
  if (el.type === 'pen' || el.type === 'highlighter') {
    if (!el.points || el.points.length === 0) {
      return { minX: el.x, minY: el.y, maxX: el.x, maxY: el.y, width: 0, height: 0 };
    }
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of el.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = (el.strokeWidth || 4) / 2;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }

  if (el.type === 'line' || el.type === 'arrow') {
    const x1 = el.x;
    const y1 = el.y;
    const x2 = el.x2 ?? el.x;
    const y2 = el.y2 ?? el.y;
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);
    const pad = (el.strokeWidth || 2) / 2;
    return {
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }

  const w = el.width || 100;
  const h = el.height || 100;
  return {
    minX: el.x,
    minY: el.y,
    maxX: el.x + w,
    maxY: el.y + h,
    width: w,
    height: h,
  };
}

/**
 * Get bounding box of all elements (or a subset).
 * @param {BoardElement[]} elements
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
 */
export function getBoardBounds(elements) {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const el of elements) {
    const b = getElementBounds(el);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  const pad = 40;
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}

/**
 * Get anchor points for a shape element (top, right, bottom, left).
 * @param {BoardElement} el
 * @returns {Record<'top' | 'right' | 'bottom' | 'left', { x: number, y: number }>}
 */
export function getElementAnchors(el) {
  const b = getElementBounds(el);
  const midX = (b.minX + b.maxX) / 2;
  const midY = (b.minY + b.maxY) / 2;
  return {
    top: { x: midX, y: b.minY },
    right: { x: b.maxX, y: midY },
    bottom: { x: midX, y: b.maxY },
    left: { x: b.minX, y: midY },
  };
}

/**
 * Check if a point hits an element.
 * @param {BoardElement} el
 * @param {number} px
 * @param {number} py
 * @param {number} [tolerance=6]
 * @returns {boolean}
 */
export function hitTestElement(el, px, py, tolerance = 6) {
  const b = getElementBounds(el);
  if (px < b.minX - tolerance || px > b.maxX + tolerance || py < b.minY - tolerance || py > b.maxY + tolerance) {
    return false;
  }

  if (el.type === 'pen' || el.type === 'highlighter') {
    if (!el.points || el.points.length === 0) return false;
    for (let i = 0; i < el.points.length - 1; i++) {
      const p1 = el.points[i];
      const p2 = el.points[i + 1];
      const dist = distanceToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
      if (dist <= (el.strokeWidth || 4) / 2 + tolerance) return true;
    }
    return false;
  }

  if (el.type === 'line' || el.type === 'arrow') {
    const dist = distanceToSegment(px, py, el.x, el.y, el.x2 ?? el.x, el.y2 ?? el.y);
    return dist <= (el.strokeWidth || 2) / 2 + tolerance;
  }

  // Rect, sticky, ellipse, text, frame hit test by bounds
  return true;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

/**
 * Render elements to standalone SVG string.
 * @param {BoardElement[]} elements
 * @param {{ minX?: number, minY?: number, width?: number, height?: number }} [viewBox]
 * @returns {string}
 */
export function exportToSvg(elements, viewBox) {
  const bounds = viewBox?.width && viewBox?.height ? viewBox : getBoardBounds(elements);
  const minX = bounds.minX ?? 0;
  const minY = bounds.minY ?? 0;
  const width = bounds.width ?? 800;
  const height = bounds.height ?? 600;

  const svgItems = elements.map((el) => renderElementToSvg(el)).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
    </marker>
  </defs>
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#ffffff" />
  ${svgItems}
</svg>`;
}

function renderElementToSvg(el) {
  const opacity = typeof el.opacity === 'number' ? `opacity="${el.opacity}"` : '';
  const stroke = el.stroke || '#000000';
  const strokeWidth = el.strokeWidth || 2;
  const fill = el.fill || 'none';

  switch (el.type) {
    case 'pen':
    case 'highlighter': {
      if (!el.points || el.points.length === 0) return '';
      const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${opacity} />`;
    }
    case 'rect': {
      return `<rect x="${el.x}" y="${el.y}" width="${el.width || 100}" height="${el.height || 60}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${opacity} />`;
    }
    case 'ellipse': {
      const rx = (el.width || 100) / 2;
      const ry = (el.height || 60) / 2;
      const cx = el.x + rx;
      const cy = el.y + ry;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${opacity} />`;
    }
    case 'line': {
      return `<line x1="${el.x}" y1="${el.y}" x2="${el.x2 ?? el.x}" y2="${el.y2 ?? el.y}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" ${opacity} />`;
    }
    case 'arrow': {
      return `<line x1="${el.x}" y1="${el.y}" x2="${el.x2 ?? el.x}" y2="${el.y2 ?? el.y}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" marker-end="url(#arrowhead)" ${opacity} />`;
    }
    case 'sticky': {
      const color = STICKY_COLORS[el.color || 'yellow'] || STICKY_COLORS.yellow;
      const w = el.width || 140;
      const h = el.height || 140;
      const textLines = (el.text || '').split('\n');
      const textElements = textLines
        .map((l, i) => `<tspan x="${el.x + 12}" y="${el.y + 26 + i * 18}">${escapeXml(l)}</tspan>`)
        .join('');
      return `<g ${opacity}>
        <rect x="${el.x}" y="${el.y}" width="${w}" height="${h}" rx="2" fill="${color}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
        <text font-family="sans-serif" font-size="14" fill="#1f2937">${textElements}</text>
      </g>`;
    }
    case 'text': {
      const lines = (el.text || '').split('\n');
      const fs = el.fontSize || 16;
      const textElements = lines
        .map((l, i) => `<tspan x="${el.x}" y="${el.y + fs + i * (fs * 1.3)}">${escapeXml(l)}</tspan>`)
        .join('');
      return `<text font-family="${el.fontFamily || 'sans-serif'}" font-size="${fs}" fill="${el.color || '#000000'}" ${opacity}>${textElements}</text>`;
    }
    case 'frame': {
      const w = el.width || 400;
      const h = el.height || 300;
      return `<g ${opacity}>
        <rect x="${el.x}" y="${el.y}" width="${w}" height="${h}" fill="none" stroke="#94a3b8" stroke-dasharray="4 4" stroke-width="2" rx="4" />
        <text x="${el.x + 8}" y="${el.y - 8}" font-family="sans-serif" font-size="14" font-weight="bold" fill="#64748b">${escapeXml(el.title || 'Frame')}</text>
      </g>`;
    }
    default:
      return '';
  }
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

/**
 * Built-in templates for Whiteboard.
 */
export const WHITEBOARD_TEMPLATES = {
  flowchart: {
    id: 'flowchart',
    name: { en: 'Flowchart Diagram', de: 'Flussdiagramm' },
    description: { en: 'Start, process and decision flow layout', de: 'Start-, Prozess- und Entscheidungsablauf' },
    create: () => {
      const elements = [
        {
          id: generateElementId('fc'),
          type: /** @type {const} */ ('ellipse'),
          x: 350,
          y: 60,
          width: 140,
          height: 60,
          fill: '#e0f2fe',
          stroke: '#0284c7',
          strokeWidth: 2,
        },
        {
          id: generateElementId('fc'),
          type: /** @type {const} */ ('text'),
          x: 395,
          y: 85,
          text: 'Start',
          fontSize: 16,
          color: '#0369a1',
        },
        {
          id: generateElementId('fc'),
          type: /** @type {const} */ ('arrow'),
          x: 420,
          y: 120,
          x2: 420,
          y2: 170,
          stroke: '#0284c7',
          strokeWidth: 2,
        },
        {
          id: generateElementId('fc'),
          type: /** @type {const} */ ('rect'),
          x: 340,
          y: 170,
          width: 160,
          height: 70,
          fill: '#f0fdf4',
          stroke: '#16a34a',
          strokeWidth: 2,
        },
        {
          id: generateElementId('fc'),
          type: /** @type {const} */ ('text'),
          x: 375,
          y: 200,
          text: 'Process Step',
          fontSize: 15,
          color: '#15803d',
        },
        {
          id: generateElementId('fc'),
          type: /** @type {const} */ ('arrow'),
          x: 420,
          y: 240,
          x2: 420,
          y2: 290,
          stroke: '#16a34a',
          strokeWidth: 2,
        },
        {
          id: generateElementId('fc'),
          type: /** @type {const} */ ('rect'),
          x: 350,
          y: 290,
          width: 140,
          height: 70,
          fill: '#fef3c7',
          stroke: '#d97706',
          strokeWidth: 2,
        },
        {
          id: generateElementId('fc'),
          type: /** @type {const} */ ('text'),
          x: 380,
          y: 320,
          text: 'Is Valid?',
          fontSize: 15,
          color: '#b45309',
        },
      ];
      return createBoard('Flowchart Diagram', elements);
    },
  },

  kanban: {
    id: 'kanban',
    name: { en: 'Kanban Board', de: 'Kanban-Board' },
    description: {
      en: 'Three columns: To Do, In Progress and Done with sticky cards',
      de: 'Drei Spalten: To Do, In Arbeit und Fertig',
    },
    create: () => {
      const elements = [
        // Column 1
        {
          id: generateElementId('kb'),
          type: /** @type {const} */ ('frame'),
          x: 50,
          y: 50,
          width: 260,
          height: 480,
          title: 'To Do',
        },
        {
          id: generateElementId('kb'),
          type: /** @type {const} */ ('sticky'),
          x: 70,
          y: 90,
          width: 220,
          height: 90,
          color: 'yellow',
          text: 'Research user requirements\nand draft specification',
        },
        {
          id: generateElementId('kb'),
          type: /** @type {const} */ ('sticky'),
          x: 70,
          y: 200,
          width: 220,
          height: 90,
          color: 'orange',
          text: 'Define VFS schemas\nfor open document formats',
        },

        // Column 2
        {
          id: generateElementId('kb'),
          type: /** @type {const} */ ('frame'),
          x: 340,
          y: 50,
          width: 260,
          height: 480,
          title: 'In Progress',
        },
        {
          id: generateElementId('kb'),
          type: /** @type {const} */ ('sticky'),
          x: 360,
          y: 90,
          width: 220,
          height: 90,
          color: 'blue',
          text: 'Implement canvas pan/zoom\nand shape drawing tools',
        },

        // Column 3
        {
          id: generateElementId('kb'),
          type: /** @type {const} */ ('frame'),
          x: 630,
          y: 50,
          width: 260,
          height: 480,
          title: 'Done',
        },
        {
          id: generateElementId('kb'),
          type: /** @type {const} */ ('sticky'),
          x: 650,
          y: 90,
          width: 220,
          height: 90,
          color: 'green',
          text: 'Phase 6.1 Nexus Sheets\nFormula engine & charts',
        },
      ];
      return createBoard('Kanban Board', elements);
    },
  },

  swot: {
    id: 'swot',
    name: { en: 'SWOT Analysis', de: 'SWOT-Analyse' },
    description: {
      en: 'Four quadrants: Strengths, Weaknesses, Opportunities, Threats',
      de: 'Vier Quadranten: Stärken, Schwächen, Chancen, Risiken',
    },
    create: () => {
      const elements = [
        // Strengths
        {
          id: generateElementId('swot'),
          type: /** @type {const} */ ('frame'),
          x: 50,
          y: 50,
          width: 320,
          height: 240,
          title: 'Strengths (Internal)',
        },
        {
          id: generateElementId('swot'),
          type: /** @type {const} */ ('sticky'),
          x: 70,
          y: 90,
          width: 280,
          height: 100,
          color: 'green',
          text: '• Offline-first architecture\n• Zero UI framework overhead\n• 100% strict test coverage',
        },

        // Weaknesses
        {
          id: generateElementId('swot'),
          type: /** @type {const} */ ('frame'),
          x: 400,
          y: 50,
          width: 320,
          height: 240,
          title: 'Weaknesses (Internal)',
        },
        {
          id: generateElementId('swot'),
          type: /** @type {const} */ ('sticky'),
          x: 420,
          y: 90,
          width: 280,
          height: 100,
          color: 'pink',
          text: '• Native mobile gestures need tuning\n• Single-developer build discipline',
        },

        // Opportunities
        {
          id: generateElementId('swot'),
          type: /** @type {const} */ ('frame'),
          x: 50,
          y: 320,
          width: 320,
          height: 240,
          title: 'Opportunities (External)',
        },
        {
          id: generateElementId('swot'),
          type: /** @type {const} */ ('sticky'),
          x: 70,
          y: 360,
          width: 280,
          height: 100,
          color: 'blue',
          text: '• Open standard interoperability\n• Educational and enterprise labs',
        },

        // Threats
        {
          id: generateElementId('swot'),
          type: /** @type {const} */ ('frame'),
          x: 400,
          y: 320,
          width: 320,
          height: 240,
          title: 'Threats (External)',
        },
        {
          id: generateElementId('swot'),
          type: /** @type {const} */ ('sticky'),
          x: 420,
          y: 360,
          width: 280,
          height: 100,
          color: 'orange',
          text: '• Browser storage quota limits\n• Aggressive third-party tracking blocks',
        },
      ];
      return createBoard('SWOT Analysis', elements);
    },
  },
};
