import { describe, expect, it } from 'vitest';
import {
  addChildNode,
  addSiblingNode,
  computeLayout,
  createMindmap,
  deleteNode,
  exportMindmapToSvg,
  exportToMarkdown,
  findNode,
  findParent,
  importFromMarkdown,
  parseMindmap,
  serializeMindmap,
} from '../../src/apps/mindmap/model.js';

describe('Nexus Mind Map Model', () => {
  describe('Data & Serialization', () => {
    it('creates a mindmap with root and default child ideas', () => {
      const map = createMindmap('Project Roadmap');
      expect(map.title).toBe('Project Roadmap');
      expect(map.layout).toBe('right');
      expect(map.root.id).toBe('root');
      expect(map.root.text).toBe('Project Roadmap');
      expect(map.root.children.length).toBe(3);
    });

    it('serializes and parses .nmap JSON document', () => {
      const map = createMindmap('Research Project', 'radial');
      const json = serializeMindmap(map);
      const parsed = parseMindmap(json);

      expect(parsed.title).toBe('Research Project');
      expect(parsed.layout).toBe('radial');
      expect(parsed.root.children.length).toBe(3);
    });

    it('recovers cleanly from corrupted JSON', () => {
      const parsed = parseMindmap('not a json');
      expect(parsed.title).toBe('Central Topic');
      expect(parsed.root.id).toBe('root');
    });
  });

  describe('Tree Node Operations', () => {
    it('finds nodes and their parents', () => {
      const map = createMindmap('Root Topic');
      const child = map.root.children[0];

      expect(findNode(map.root, child.id)).toBe(child);
      expect(findParent(map.root, child.id)).toBe(map.root);
      expect(findParent(map.root, 'root')).toBe(null);
    });

    it('adds child and sibling nodes dynamically', () => {
      const map = createMindmap('Work');
      const initialCount = map.root.children.length;

      const newChild = addChildNode(map.root, 'root', 'Marketing');
      expect(newChild).not.toBeNull();
      expect(map.root.children.length).toBe(initialCount + 1);
      expect(newChild?.text).toBe('Marketing');

      if (newChild) {
        const subChild = addChildNode(map.root, newChild.id, 'Campaign 1');
        expect(subChild?.text).toBe('Campaign 1');
        expect(newChild.children.length).toBe(1);

        const sibling = addSiblingNode(map.root, subChild.id, 'Campaign 2');
        expect(sibling?.text).toBe('Campaign 2');
        expect(newChild.children.length).toBe(2);
      }
    });

    it('deletes child nodes and forbids deleting root', () => {
      const map = createMindmap('Goal');
      const targetId = map.root.children[0].id;

      expect(deleteNode(map.root, targetId)).toBe(true);
      expect(findNode(map.root, targetId)).toBe(null);

      // Root cannot be deleted
      expect(deleteNode(map.root, 'root')).toBe(false);
      expect(map.root.id).toBe('root');
    });
  });

  describe('Layout Computation', () => {
    it('computes Right Tree layout with non-overlapping coordinates', () => {
      const map = createMindmap('Central System', 'right');
      const layout = computeLayout(map.root, 'right');

      expect(layout.x).toBe(80);
      expect(layout.children.length).toBe(3);
      layout.children.forEach((c) => {
        expect(c.x).toBeGreaterThan(layout.x);
        expect(typeof c.y).toBe('number');
      });
    });

    it('computes Org Chart layout with child nodes below parent', () => {
      const map = createMindmap('CEO', 'org');
      const layout = computeLayout(map.root, 'org');

      expect(layout.children.length).toBe(3);
      layout.children.forEach((c) => {
        expect(c.y).toBeGreaterThan(layout.y);
      });
    });

    it('computes Radial layout arranging children in circular radius', () => {
      const map = createMindmap('Core', 'radial');
      const layout = computeLayout(map.root, 'radial');

      expect(layout.x).toBe(0);
      expect(layout.y).toBe(0);
      expect(layout.children.length).toBe(3);
    });
  });

  describe('Markdown Import & Export', () => {
    it('exports mindmap tree to Markdown bullet outline', () => {
      const map = createMindmap('Project Alpha');
      const md = exportToMarkdown(map.root);

      expect(md).toContain('# Project Alpha');
      expect(md).toContain('- Idea 1');
      expect(md).toContain('- Idea 2');
      expect(md).toContain('- Idea 3');
    });

    it('imports Markdown outline into a mindmap hierarchy', () => {
      const md = `
# System Architecture
- Frontend
  - Desktop Shell
  - Virtual Window Manager
- Backend Services
  - Virtual File System
  - IndexedDB Persistence
      `.trim();

      const root = importFromMarkdown(md);
      expect(root.text).toBe('System Architecture');
      expect(root.children.length).toBe(2);
      expect(root.children[0].text).toBe('Frontend');
      expect(root.children[0].children.length).toBe(2);
      expect(root.children[0].children[0].text).toBe('Desktop Shell');
      expect(root.children[1].text).toBe('Backend Services');
      expect(root.children[1].children[1].text).toBe('IndexedDB Persistence');
    });
  });

  describe('SVG Export', () => {
    it('generates valid SVG graphic with connection paths and node rects', () => {
      const map = createMindmap('Brainstorming');
      const layout = computeLayout(map.root, 'right');
      const svg = exportMindmapToSvg(layout);

      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('<path d="M');
      expect(svg).toContain('Brainstorming');
      expect(svg).toContain('</svg>');
    });
  });
});
