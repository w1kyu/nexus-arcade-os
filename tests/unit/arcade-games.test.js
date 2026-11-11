import { describe, expect, it } from 'vitest';
import { COLS, ROWS, createBreakoutLevels } from '../../src/apps/breakout/levels.js';
import { GRID_CONFIGS } from '../../src/apps/memory/game.js';
import { MEMORY_THEMES } from '../../src/apps/memory/themes.js';
import { getBenchmarkPercentile } from '../../src/apps/reaction/benchmarks.js';
import { SNAKE_MAPS } from '../../src/apps/snake/maps.js';

describe('Phase 9 — Arcade Games Unit Tests', () => {
  describe('Snake Evolution Maps', () => {
    it('provides at least 6 distinct maps with valid geometries', () => {
      const mapKeys = Object.keys(SNAKE_MAPS);
      expect(mapKeys.length).toBeGreaterThanOrEqual(6);

      for (const key of mapKeys) {
        const map = SNAKE_MAPS[key];
        expect(map.id).toBe(key);
        expect(map.name).toBeDefined();
        expect(Array.isArray(map.walls)).toBe(true);

        // Verify wall coordinates stay within 20x20 grid
        for (const w of map.walls) {
          expect(w.x).toBeGreaterThanOrEqual(0);
          expect(w.x).toBeLessThan(20);
          expect(w.y).toBeGreaterThanOrEqual(0);
          expect(w.y).toBeLessThan(20);
        }
      }
    });

    it('validates portal definitions in portal map', () => {
      const portalMap = SNAKE_MAPS.portals;
      expect(portalMap.portals).toBeDefined();
      expect(portalMap.portals.length).toBeGreaterThanOrEqual(2);
      for (const p of portalMap.portals) {
        expect(p.in).toBeDefined();
        expect(p.out).toBeDefined();
        expect(p.color).toBeDefined();
      }
    });

    it('validates moving obstacles patrol ranges', () => {
      const movingMap = SNAKE_MAPS.moving;
      expect(movingMap.movingObstacles).toBeDefined();
      for (const obs of movingMap.movingObstacles) {
        expect(obs.min).toBeLessThan(obs.max);
        expect(Math.abs(obs.vx) + Math.abs(obs.vy)).toBe(1);
      }
    });
  });

  describe('Breakout Levels', () => {
    it('creates at least 30 handcrafted levels with 10x12 layouts', () => {
      const levels = createBreakoutLevels();
      expect(levels.length).toBeGreaterThanOrEqual(30);

      for (const lvl of levels) {
        expect(lvl.id).toBeGreaterThanOrEqual(1);
        expect(lvl.name).toBeDefined();
        expect(lvl.layout).toHaveLength(ROWS);
        for (const row of lvl.layout) {
          expect(row).toHaveLength(COLS);
          for (const cell of row) {
            expect(cell).toBeGreaterThanOrEqual(0);
            expect(cell).toBeLessThanOrEqual(6);
          }
        }
      }
    });
  });

  describe('Memory Master Themes & Grids', () => {
    it('provides 4 grid configurations with target moves and times', () => {
      expect(GRID_CONFIGS['4x4'].pairs).toBe(8);
      expect(GRID_CONFIGS['4x5'].pairs).toBe(10);
      expect(GRID_CONFIGS['6x6'].pairs).toBe(18);
      expect(GRID_CONFIGS['8x8'].pairs).toBe(32);
    });

    it('has at least 32 unique items in each card theme', () => {
      for (const [key, theme] of Object.entries(MEMORY_THEMES)) {
        expect(theme.items.length, `theme ${key}`).toBeGreaterThanOrEqual(32);
        const ids = new Set(theme.items.map((i) => i.id));
        expect(ids.size).toBe(theme.items.length);
      }
    });
  });

  describe('Reaction Trainer Percentiles', () => {
    it('calculates human reaction time percentiles realistically', () => {
      // Sub-200ms is godlike
      const fast = getBenchmarkPercentile('classic', 180);
      expect(fast.percentile).toBeGreaterThanOrEqual(90);

      // 250ms is around the median (50th percentile)
      const avg = getBenchmarkPercentile('classic', 250);
      expect(avg.percentile).toBeCloseTo(50, -1);

      // 400ms is slower
      const slow = getBenchmarkPercentile('classic', 400);
      expect(slow.percentile).toBeLessThan(15);
    });

    it('evaluates sequence and number memory spans', () => {
      const seq = getBenchmarkPercentile('sequence', 12);
      expect(seq.percentile).toBeGreaterThan(80);

      const num = getBenchmarkPercentile('number', 10);
      expect(num.percentile).toBeGreaterThan(80);
    });
  });

  describe('Manifest validation', () => {
    it('validates all phase 9 and phase 10 app manifests', async () => {
      const manifests = [
        (await import('../../src/apps/arcade/manifest.js')).default,
        (await import('../../src/apps/snake/manifest.js')).default,
        (await import('../../src/apps/breakout/manifest.js')).default,
        (await import('../../src/apps/memory/manifest.js')).default,
        (await import('../../src/apps/2048/manifest.js')).default,
        (await import('../../src/apps/reaction/manifest.js')).default,
        (await import('../../src/apps/blockfall/manifest.js')).default,
        (await import('../../src/apps/minesweeper/manifest.js')).default,
        (await import('../../src/apps/drifter/manifest.js')).default,
        (await import('../../src/apps/sudoku/manifest.js')).default,
        (await import('../../src/apps/typing/manifest.js')).default,
        (await import('../../src/apps/pong/manifest.js')).default,
      ];
      const { validateManifest } = await import('../../src/kernel/manifest.js');
      for (const m of manifests) {
        const problems = validateManifest(m);
        expect(problems, `Manifest problems for ${m.id}`).toEqual([]);
      }
    });
  });
});
