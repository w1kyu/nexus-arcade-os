import { describe, it, expect } from 'vitest';
import {
  MAPS,
  TOWER_TYPES,
  CREEP_TYPES,
  createGameState,
  canPlaceTower,
  placeTower,
  upgradeTower,
  sellTower,
  startNextWave,
  stepSimulation,
  isRoadTile,
  isObstacleTile,
  generateWaves,
  getUpgradeCost,
} from '../../src/apps/griddefense/logic.js';

describe('Grid Defense Logic', () => {
  it('defines 10+ distinct playable maps with valid paths', () => {
    expect(MAPS.length).toBeGreaterThanOrEqual(10);
    for (const map of MAPS) {
      expect(map.id).toBeDefined();
      expect(map.name).toBeDefined();
      expect(map.paths.length).toBeGreaterThanOrEqual(1);
      for (const path of map.paths) {
        expect(path.length).toBeGreaterThanOrEqual(2);
        for (const wp of path) {
          expect(wp.x).toBeGreaterThanOrEqual(0);
          expect(wp.x).toBeLessThan(16);
          expect(wp.y).toBeGreaterThanOrEqual(0);
          expect(wp.y).toBeLessThan(12);
        }
      }
    }
  });

  it('defines 6 tower types with distinct characteristics', () => {
    const keys = Object.keys(TOWER_TYPES);
    expect(keys.length).toBe(6);
    expect(keys).toContain('pulse');
    expect(keys).toContain('plasma');
    expect(keys).toContain('frost');
    expect(keys).toContain('tesla');
    expect(keys).toContain('railgun');
    expect(keys).toContain('disruptor');

    for (const key of keys) {
      const t = TOWER_TYPES[key];
      expect(t.cost).toBeGreaterThan(0);
      expect(t.range).toBeGreaterThan(50);
      expect(t.damage).toBeGreaterThan(0);
      expect(t.fireRate).toBeGreaterThan(0);
    }
  });

  it('defines creep varieties including boss and armored creeps', () => {
    expect(CREEP_TYPES.scout).toBeDefined();
    expect(CREEP_TYPES.runner).toBeDefined();
    expect(CREEP_TYPES.tank).toBeDefined();
    expect(CREEP_TYPES.regen).toBeDefined();
    expect(CREEP_TYPES.shielded).toBeDefined();
    expect(CREEP_TYPES.boss).toBeDefined();

    expect(CREEP_TYPES.tank.armor).toBeGreaterThan(0);
    expect(CREEP_TYPES.boss.isBoss).toBe(true);
    expect(CREEP_TYPES.boss.baseHp).toBeGreaterThan(CREEP_TYPES.scout.baseHp);
  });

  it('generates scaled waves with boss encounters every 5 waves', () => {
    const waves = generateWaves(20);
    expect(waves.length).toBe(20);
    expect(waves[4].groups.some((g) => g.type === 'boss')).toBe(true);
    expect(waves[9].groups.some((g) => g.type === 'boss')).toBe(true);
    expect(waves[14].groups.some((g) => g.type === 'boss')).toBe(true);
    expect(waves[19].groups.some((g) => g.type === 'boss')).toBe(true);
  });

  it('enforces road and obstacle placement constraints', () => {
    const state = createGameState(0, 500, 20);
    // On Map 0, path has (0, 3) to (5, 3)
    expect(isRoadTile(state.mapDef, 2, 3)).toBe(true);
    expect(canPlaceTower(state, 2, 3, 'pulse')).toBe(false);

    // Obstacle check
    if (state.mapDef.obstacles?.length) {
      const [ox, oy] = state.mapDef.obstacles[0];
      expect(isObstacleTile(state.mapDef, ox, oy)).toBe(true);
      expect(canPlaceTower(state, ox, oy, 'pulse')).toBe(false);
    }

    // Buildable tile check
    const emptyGx = 1;
    const emptyGy = 1;
    expect(isRoadTile(state.mapDef, emptyGx, emptyGy)).toBe(false);
    expect(canPlaceTower(state, emptyGx, emptyGy, 'pulse')).toBe(true);
  });

  it('handles tower purchasing, upgrading and selling properly', () => {
    const state = createGameState(0, 500, 20);
    const initialCredits = state.credits;
    const tower = placeTower(state, 1, 1, 'pulse');
    expect(tower).not.toBeNull();
    expect(state.towers.length).toBe(1);
    expect(state.credits).toBe(initialCredits - TOWER_TYPES.pulse.cost);

    // Tower stats at level 1
    expect(tower.level).toBe(1);
    const costLvl2 = getUpgradeCost(tower);
    expect(costLvl2).toBeGreaterThan(0);

    // Upgrade to level 2
    const upgraded = upgradeTower(state, 0);
    expect(upgraded).toBe(true);
    expect(tower.level).toBe(2);
    expect(tower.damage).toBeGreaterThan(TOWER_TYPES.pulse.damage);

    // Sell tower
    const refund = sellTower(state, 0);
    expect(refund).toBeGreaterThan(0);
    expect(state.towers.length).toBe(0);
  });

  it('progresses wave spawning and simulation steps', () => {
    const state = createGameState(0, 1000, 20);
    placeTower(state, 1, 4, 'pulse'); // placed right next to road y=3

    const started = startNextWave(state);
    expect(started).toBe(true);
    expect(state.waveInProgress).toBe(true);
    expect(state.spawnQueue.length).toBeGreaterThan(0);

    // Step simulation 2.0 seconds
    for (let i = 0; i < 20; i++) {
      stepSimulation(state, 0.1);
    }
    // Should have spawned creeps and they should have moved
    expect(state.creeps.length).toBeGreaterThan(0);
    expect(state.creeps[0].x).toBeGreaterThan(0);
  });
});
