import { describe, expect, it } from 'vitest';
import {
  createBoard,
  exportToSvg,
  generateElementId,
  getBoardBounds,
  getElementAnchors,
  getElementBounds,
  hitTestElement,
  parseBoard,
  serializeBoard,
  WHITEBOARD_TEMPLATES,
} from '../../src/apps/whiteboard/model.js';

describe('Nexus Whiteboard Model', () => {
  describe('Board Data & Serialization', () => {
    it('creates a new board with default viewport and metadata', () => {
      const board = createBoard('Test Board');
      expect(board.title).toBe('Test Board');
      expect(board.version).toBe(1);
      expect(board.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
      expect(board.elements).toEqual([]);
      expect(board.metadata.created).toBeGreaterThan(0);
    });

    it('serializes and parses board JSON correctly', () => {
      const el = {
        id: generateElementId(),
        type: /** @type {const} */ ('rect'),
        x: 100,
        y: 150,
        width: 200,
        height: 120,
        stroke: '#2563eb',
        fill: '#dbeafe',
      };
      const board = createBoard('My Board', [el], { x: 50, y: 50, zoom: 1.5 });
      const json = serializeBoard(board);
      const parsed = parseBoard(json);

      expect(parsed.title).toBe('My Board');
      expect(parsed.viewport).toEqual({ x: 50, y: 50, zoom: 1.5 });
      expect(parsed.elements.length).toBe(1);
      expect(parsed.elements[0].type).toBe('rect');
      expect(parsed.elements[0].x).toBe(100);
    });

    it('recovers cleanly from invalid JSON', () => {
      const parsed = parseBoard('invalid json');
      expect(parsed.title).toBe('Untitled Whiteboard');
      expect(parsed.elements).toEqual([]);
    });
  });

  describe('Geometry & Bounding Boxes', () => {
    it('computes accurate bounds for shapes', () => {
      const rect = {
        id: 'r1',
        type: /** @type {const} */ ('rect'),
        x: 50,
        y: 60,
        width: 140,
        height: 80,
      };
      const bounds = getElementBounds(rect);
      expect(bounds.minX).toBe(50);
      expect(bounds.minY).toBe(60);
      expect(bounds.maxX).toBe(190);
      expect(bounds.maxY).toBe(140);
      expect(bounds.width).toBe(140);
      expect(bounds.height).toBe(80);
    });

    it('computes bounds for pen strokes', () => {
      const stroke = {
        id: 'p1',
        type: /** @type {const} */ ('pen'),
        x: 10,
        y: 10,
        strokeWidth: 4,
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 80 },
          { x: 100, y: 40 },
        ],
      };
      const bounds = getElementBounds(stroke);
      expect(bounds.minX).toBeLessThanOrEqual(10);
      expect(bounds.maxX).toBeGreaterThanOrEqual(100);
      expect(bounds.minY).toBeLessThanOrEqual(10);
      expect(bounds.maxY).toBeGreaterThanOrEqual(80);
    });

    it('computes board bounds encompassing all elements with padding', () => {
      const el1 = { id: '1', type: /** @type {const} */ ('rect'), x: 0, y: 0, width: 100, height: 100 };
      const el2 = { id: '2', type: /** @type {const} */ ('rect'), x: 200, y: 300, width: 100, height: 100 };
      const bounds = getBoardBounds([el1, el2]);

      expect(bounds.minX).toBe(-40);
      expect(bounds.minY).toBe(-40);
      expect(bounds.maxX).toBe(340);
      expect(bounds.maxY).toBe(440);
    });

    it('calculates anchor points for shape connectors', () => {
      const rect = { id: 'r1', type: /** @type {const} */ ('rect'), x: 100, y: 100, width: 200, height: 100 };
      const anchors = getElementAnchors(rect);

      expect(anchors.top).toEqual({ x: 200, y: 100 });
      expect(anchors.bottom).toEqual({ x: 200, y: 200 });
      expect(anchors.left).toEqual({ x: 100, y: 150 });
      expect(anchors.right).toEqual({ x: 300, y: 150 });
    });
  });

  describe('Hit Testing', () => {
    it('detects point hits on rectangles and stickies', () => {
      const sticky = {
        id: 's1',
        type: /** @type {const} */ ('sticky'),
        x: 100,
        y: 100,
        width: 140,
        height: 140,
      };
      expect(hitTestElement(sticky, 150, 150)).toBe(true);
      expect(hitTestElement(sticky, 50, 50)).toBe(false);
      expect(hitTestElement(sticky, 250, 250)).toBe(false);
    });

    it('detects point hits along line and arrow segments', () => {
      const line = {
        id: 'l1',
        type: /** @type {const} */ ('line'),
        x: 0,
        y: 0,
        x2: 100,
        y2: 100,
        strokeWidth: 4,
      };
      expect(hitTestElement(line, 50, 50)).toBe(true);
      expect(hitTestElement(line, 50, 52)).toBe(true); // Within tolerance
      expect(hitTestElement(line, 50, 80)).toBe(false);
    });
  });

  describe('SVG Export', () => {
    it('exports all elements to standalone valid SVG string', () => {
      const elements = [
        { id: '1', type: /** @type {const} */ ('rect'), x: 50, y: 50, width: 100, height: 50, fill: '#bfdbfe' },
        { id: '2', type: /** @type {const} */ ('sticky'), x: 200, y: 50, width: 140, height: 140, text: 'Hello SVG' },
      ];
      const svg = exportToSvg(elements);

      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('<rect');
      expect(svg).toContain('#bfdbfe');
      expect(svg).toContain('Hello SVG');
      expect(svg).toContain('</svg>');
    });
  });

  describe('Whiteboard Templates', () => {
    it('provides Flowchart, Kanban and SWOT templates', () => {
      const keys = ['flowchart', 'kanban', 'swot'];
      expect(Object.keys(WHITEBOARD_TEMPLATES)).toEqual(keys);

      keys.forEach((key) => {
        const tmpl = WHITEBOARD_TEMPLATES[key];
        expect(tmpl.name.en).toBeDefined();
        expect(tmpl.name.de).toBeDefined();
        const b = tmpl.create();
        expect(b.title).toBeDefined();
        expect(b.elements.length).toBeGreaterThan(2);
      });
    });

    it('creates Kanban template with 3 columns and sticky cards', () => {
      const kanban = WHITEBOARD_TEMPLATES.kanban.create();
      const frames = kanban.elements.filter((e) => e.type === 'frame');
      expect(frames.length).toBe(3);
      expect(frames.map((f) => f.title)).toEqual(['To Do', 'In Progress', 'Done']);
      const stickies = kanban.elements.filter((e) => e.type === 'sticky');
      expect(stickies.length).toBeGreaterThan(0);
    });
  });
});
