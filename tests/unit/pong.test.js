import { describe, expect, it } from 'vitest';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  PADDLE_BASE_HEIGHT,
  PADDLE_WIDTH,
  WINNING_SCORE,
  calculatePaddleBounce,
} from '../../src/apps/pong/physics.js';

describe('Neon Pong bounce physics & spin dynamics', () => {
  it('reverses ball horizontal direction on paddle impact', () => {
    const ball = { x: 50, y: 250, vx: -300, vy: 0, radius: 7 };
    const paddle = { x: 35, y: 210, w: PADDLE_WIDTH, h: PADDLE_BASE_HEIGHT, vy: 0 };

    const res = calculatePaddleBounce(ball, paddle);
    expect(res).not.toBeNull();
    // Ball moving left hits left paddle -> moves right (+vx)
    expect(res?.vx).toBeGreaterThan(0);
  });

  it('alters reflection angle based on hit offset from paddle center', () => {
    const ballCenter = { x: 50, y: 250, vx: -300, vy: 0, radius: 7 };
    const ballTop = { x: 50, y: 220, vx: -300, vy: 0, radius: 7 };
    const ballBottom = { x: 50, y: 280, vx: -300, vy: 0, radius: 7 };

    const paddle = { x: 35, y: 210, w: PADDLE_WIDTH, h: PADDLE_BASE_HEIGHT, vy: 0 };

    const resCenter = calculatePaddleBounce(ballCenter, paddle);
    const resTop = calculatePaddleBounce(ballTop, paddle);
    const resBottom = calculatePaddleBounce(ballBottom, paddle);

    expect(Math.abs(resCenter?.vy || 0)).toBeCloseTo(0, 1);
    // Hitting top half bounces upward (-vy)
    expect(resTop?.vy).toBeLessThan(0);
    // Hitting bottom half bounces downward (+vy)
    expect(resBottom?.vy).toBeGreaterThan(0);
  });

  it('imparts paddle vertical velocity as spin momentum', () => {
    const ball = { x: 50, y: 250, vx: -300, vy: 0, radius: 7 };
    // Paddle moving downward rapidly at +300 px/s
    const paddleMovingDown = { x: 35, y: 210, w: PADDLE_WIDTH, h: PADDLE_BASE_HEIGHT, vy: 300 };

    const res = calculatePaddleBounce(ball, paddleMovingDown);
    expect(res?.vy).toBeGreaterThan(50);
  });

  it('adheres to first-to-11 match standard and arena geometry', () => {
    expect(WINNING_SCORE).toBe(11);
    expect(ARENA_WIDTH).toBe(800);
    expect(ARENA_HEIGHT).toBe(500);
  });
});
