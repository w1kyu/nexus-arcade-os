import { describe, expect, it } from 'vitest';
import { FLAP_IMPULSE, GhostRecorder, Glider, checkGateCollision, createGate } from '../../src/apps/glide/physics.js';

describe('Neon Glide Physics and Ghost Recorder', () => {
  it('applies gravity and flap impulse to glider', () => {
    const glider = new Glider(180, 300);
    expect(glider.vy).toBe(0);

    // Flap impulse sets negative upward velocity
    glider.flap();
    expect(glider.vy).toBe(FLAP_IMPULSE);

    // Gravity accelerates downward
    glider.update(0.1);
    expect(glider.vy).toBeGreaterThan(FLAP_IMPULSE);
  });

  it('generates obstacle gates with consistent gap metrics', () => {
    const gate = createGate(500, 140, () => 0.5);
    expect(gate.x).toBe(500);
    expect(gate.gap).toBe(140);
    expect(gate.botY - gate.topH).toBe(140);
    expect(gate.passed).toBe(false);
  });

  it('detects collisions with barriers and safe passage through the gap', () => {
    const gate = {
      x: 200,
      width: 60,
      topH: 150,
      botY: 350,
      gap: 200,
      passed: false,
    };

    // Glider safely in middle of gap (x = 220, y = 250)
    const safeGlider = new Glider(220, 250);
    expect(checkGateCollision(safeGlider, gate)).toBe(false);

    // Glider colliding with top barrier (y = 120 < 150)
    const hitTopGlider = new Glider(220, 120);
    expect(checkGateCollision(hitTopGlider, gate)).toBe(true);

    // Glider colliding with bottom barrier (y = 380 > 350)
    const hitBotGlider = new Glider(220, 380);
    expect(checkGateCollision(hitBotGlider, gate)).toBe(true);
  });

  it('records and samples ghost trajectory frames', () => {
    const ghost = new GhostRecorder();
    ghost.record(0.0, 300, 0);
    ghost.record(0.5, 250, -0.2);
    ghost.record(1.0, 220, 0.1);
    ghost.saveBest();

    expect(ghost.bestTrack.length).toBe(3);
    const sampled = ghost.sample(0.5);
    expect(sampled).not.toBeNull();
    expect(sampled?.y).toBe(250);
  });
});
