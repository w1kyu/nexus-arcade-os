import { describe, expect, it } from 'vitest';
import { Asteroid, Ship, UFO, wrapCoords } from '../../src/apps/drifter/entities.js';

describe('Void Drifter entity physics & mechanics', () => {
  it('wraps coordinates across screen boundaries with margins', () => {
    // Exiting right boundary -> wraps to left margin
    const right = wrapCoords(830, 300, 800, 600, 20);
    expect(right.x).toBe(-20);

    // Exiting left boundary -> wraps to right margin
    const left = wrapCoords(-25, 300, 800, 600, 20);
    expect(left.x).toBe(820);

    // Exiting top boundary -> wraps to bottom
    const top = wrapCoords(400, -25, 800, 600, 20);
    expect(top.y).toBe(620);
  });

  it('accelerates ship with thrust in heading direction and applies drag', () => {
    const ship = new Ship(400, 300);
    ship.angle = 0; // Facing right (+x)
    expect(ship.vx).toBe(0);

    ship.thrust(0.1);
    expect(ship.vx).toBeGreaterThan(0);
    expect(ship.vy).toBeCloseTo(0, 5);

    const prevVx = ship.vx;
    ship.update(0.1, 800, 600);
    // Drag slows velocity slightly
    expect(ship.vx).toBeLessThan(prevVx);
    expect(ship.x).toBeGreaterThan(400);
  });

  it('splits asteroids recursively: large -> 2 medium -> 4 small -> 0', () => {
    const large = new Asteroid(200, 200, 'large');
    expect(large.radius).toBe(36);

    const medParts = large.split();
    expect(medParts).toHaveLength(2);
    expect(medParts[0].size).toBe('medium');
    expect(medParts[1].size).toBe('medium');
    expect(medParts[0].radius).toBe(22);

    const smallParts = medParts[0].split();
    expect(smallParts).toHaveLength(2);
    expect(smallParts[0].size).toBe('small');
    expect(smallParts[0].radius).toBe(12);

    const none = smallParts[0].split();
    expect(none).toHaveLength(0);
  });

  it('teleports ship via hyperspace within arena bounds', () => {
    const ship = new Ship(400, 300);
    const res = ship.hyperspace(800, 600);
    expect(res.x).toBeGreaterThanOrEqual(50);
    expect(res.x).toBeLessThanOrEqual(750);
    expect(res.y).toBeGreaterThanOrEqual(50);
    expect(res.y).toBeLessThanOrEqual(550);
    expect(typeof res.malfunction).toBe('boolean');
  });

  it('UFO targets player accurately when small type', () => {
    const ufo = new UFO(100, 100, 'small');
    ufo.shootTimer = 2.0; // Ready to shoot
    const bullet = ufo.update(0.1, 800, 600, { x: 300, y: 100 });
    expect(bullet).not.toBeNull();
    // Since player is directly to the right (+x), bullet vx should be strongly positive
    expect(bullet?.vx).toBeGreaterThan(150);
  });
});
