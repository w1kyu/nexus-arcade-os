import { describe, expect, it } from 'vitest';
import { BunkerShield, InvaderAlien, InvaderBoss, InvaderPlayer } from '../../src/apps/invaders/entities.js';

describe('Grid Invaders Entities and Invariants', () => {
  it('constrains player movement within arena boundaries', () => {
    const player = new InvaderPlayer(100, 500);
    // Move left beyond edge
    player.update(1.0, -1, 800);
    expect(player.x).toBeGreaterThanOrEqual(player.width / 2);

    // Move right beyond right edge
    for (let i = 0; i < 10; i++) player.update(1.0, 1, 800);
    expect(player.x).toBeLessThanOrEqual(800 - player.width / 2);
  });

  it('manages firing cooldown and rapid-fire power-ups', () => {
    const player = new InvaderPlayer(400, 500);
    expect(player.canFire()).toBe(true);
    player.resetCooldown();
    expect(player.canFire()).toBe(false);

    // After cooldown time passes
    player.update(0.3, 0, 800);
    expect(player.canFire()).toBe(true);

    // Rapid power-up decreases cooldown
    player.powerUpType = 'rapid';
    player.resetCooldown();
    expect(player.fireCooldown).toBeLessThan(0.2);
  });

  it('destructs bunker shield sub-blocks upon projectile impact', () => {
    const bunker = new BunkerShield(100, 400);
    expect(bunker.isIntact).toBe(true);

    // Top-left cell is at (105, 405)
    expect(bunker.blocks[0][0]).toBe(3);
    const hit = bunker.hitTest(105, 405);
    expect(hit).toBe(true);
    expect(bunker.blocks[0][0]).toBe(2);

    // Hit outside bunker area returns false
    expect(bunker.hitTest(50, 50)).toBe(false);
  });

  it('correctly calculates alien score points by tier', () => {
    const topAlien = new InvaderAlien(100, 100, 0);
    const midAlien = new InvaderAlien(100, 100, 1);
    const botAlien = new InvaderAlien(100, 100, 2);

    expect(topAlien.score).toBe(30);
    expect(midAlien.score).toBe(20);
    expect(botAlien.score).toBe(10);
  });

  it('scales boss health with wave progression', () => {
    const boss5 = new InvaderBoss(400, 100, 5);
    const boss10 = new InvaderBoss(400, 100, 10);
    expect(boss10.maxHealth).toBeGreaterThan(boss5.maxHealth);
    expect(boss5.health).toBe(boss5.maxHealth);
  });
});
