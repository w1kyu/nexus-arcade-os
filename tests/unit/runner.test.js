import { describe, it, expect } from 'vitest';
import {
  BUILTIN_LEVELS,
  TILE,
  TILE_SIZE,
  createRunnerState,
  stepRunner,
  respawnPlayer,
} from '../../src/apps/runner/logic.js';

describe('Pixel Runner Logic & Physics', () => {
  it('provides 20 playable handcrafted levels with start and exit', () => {
    expect(BUILTIN_LEVELS.length).toBeGreaterThanOrEqual(20);
    for (const lvl of BUILTIN_LEVELS) {
      expect(lvl.id).toBeGreaterThan(0);
      expect(lvl.name).toBeDefined();
      expect(lvl.spawn).toBeDefined();
      expect(lvl.spawn.x).toBeGreaterThanOrEqual(0);
      expect(lvl.spawn.y).toBeGreaterThanOrEqual(0);
      // Must contain portal
      expect(lvl.data.includes(TILE.PORTAL)).toBe(true);
    }
  });

  it('handles movement and collision with solid ground', () => {
    const state = createRunnerState(0);
    expect(state.player.grounded).toBe(false);

    // Step simulation to fall to ground
    for (let i = 0; i < 20; i++) {
      stepRunner(state, 0.05, { left: false, right: false, jump: false, jumpPressed: false });
    }
    expect(state.player.grounded).toBe(true);
    expect(state.player.vy).toBe(0);
  });

  it('implements coyote time allowing jumps after leaving ledge', () => {
    const state = createRunnerState(0);
    // Land player
    for (let i = 0; i < 20; i++) {
      stepRunner(state, 0.05, { left: false, right: false, jump: false, jumpPressed: false });
    }
    expect(state.player.grounded).toBe(true);

    // Walk off platform into air for 0.04s (less than coyote time 0.12s)
    stepRunner(state, 0.04, { left: true, right: false, jump: false, jumpPressed: false });
    expect(state.player.coyoteTimer).toBeGreaterThan(0);

    // Jump should trigger despite being airborne!
    stepRunner(state, 0.02, { left: false, right: false, jump: true, jumpPressed: true });
    expect(state.player.vy).toBeLessThan(0);
  });

  it('implements jump buffering when pressed shortly before landing', () => {
    const state = createRunnerState(0);
    // Put player slightly above ground
    state.player.y = 11 * TILE_SIZE - 12;
    state.player.vy = 200;
    state.player.grounded = false;

    // Press jump in mid-air
    stepRunner(state, 0.02, { left: false, right: false, jump: true, jumpPressed: true });
    expect(state.player.jumpBufferTimer).toBeGreaterThan(0);

    // Step until landing
    stepRunner(state, 0.05, { left: false, right: false, jump: true, jumpPressed: false });
    // Should immediately consume buffer and jump
    expect(state.player.vy).toBeLessThan(0);
  });

  it('bounces player when landing on spring bouncer', () => {
    const state = createRunnerState(2); // Spring Fling level
    state.player.x = 6 * TILE_SIZE;
    state.player.y = 10 * TILE_SIZE;
    state.player.vy = 250;

    stepRunner(state, 0.05, { left: false, right: false, jump: false, jumpPressed: false });
    expect(state.player.vy).toBeLessThan(-400); // Super spring bounce
  });

  it('collects keys and unlocks doors', () => {
    const state = createRunnerState(4); // Lock and Key level
    expect(state.player.hasKey).toBe(false);

    // Move to key position (x=4, y=5)
    state.player.x = 4 * TILE_SIZE;
    state.player.y = 5 * TILE_SIZE;
    stepRunner(state, 0.02, { left: false, right: false, jump: false, jumpPressed: false });
    expect(state.player.hasKey).toBe(true);

    // Now touch door (x=12, y=10)
    state.player.x = 12 * TILE_SIZE - 2;
    state.player.y = 10 * TILE_SIZE;
    stepRunner(state, 0.02, { left: false, right: true, jump: false, jumpPressed: false });
    // Door should unlock (turn to AIR)
    expect(state.grid[10 * 20 + 12]).toBe(TILE.AIR);
  });

  it('kills player on spikes and respawns at checkpoint', () => {
    const state = createRunnerState(1); // Leap of faith
    state.player.x = 8 * TILE_SIZE;
    state.player.y = 13 * TILE_SIZE;

    stepRunner(state, 0.02, { left: false, right: false, jump: false, jumpPressed: false });
    expect(state.player.dead).toBe(true);
    expect(state.deaths).toBe(1);

    respawnPlayer(state);
    expect(state.player.dead).toBe(false);
    expect(state.player.x).toBe(state.player.checkpoint.x);
  });
});
