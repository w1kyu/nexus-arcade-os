// @ts-check
// Neon Pong ball physics, paddle spin dynamics, and collision routines

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 500;
export const PADDLE_WIDTH = 14;
export const PADDLE_BASE_HEIGHT = 80;
export const BALL_RADIUS = 7;
export const WINNING_SCORE = 11;

/**
 * Calculates ball reflection off paddle with spin and impact offset.
 * @param {object} ball
 * @param {number} ball.x
 * @param {number} ball.y
 * @param {number} ball.vx
 * @param {number} ball.vy
 * @param {number} ball.radius
 * @param {object} paddle
 * @param {number} paddle.x
 * @param {number} paddle.y
 * @param {number} paddle.w
 * @param {number} paddle.h
 * @param {number} paddle.vy Paddle vertical velocity at impact
 * @param {number} [speedIncrement]
 * @returns {{ vx: number, vy: number, smash: boolean } | null}
 */
export function calculatePaddleBounce(ball, paddle, speedIncrement = 25) {
  // Check AABB collision
  const halfH = paddle.h / 2;
  const paddleCenterY = paddle.y + halfH;

  // Normalized hit offset from paddle center (-1 to 1)
  const offset = Math.max(-1, Math.min(1, (ball.y - paddleCenterY) / halfH));

  // Max reflection angle = 55 degrees (~0.96 rad)
  const maxAngle = (55 * Math.PI) / 180;
  const angle = offset * maxAngle;

  const currentSpeed = Math.hypot(ball.vx, ball.vy);
  const newSpeed = Math.min(850, currentSpeed + speedIncrement);

  // Direction: if hitting left paddle (ball moving left), bounce right (+1); else bounce left (-1)
  const dirX = ball.vx < 0 ? 1 : -1;

  let vx = Math.cos(angle) * newSpeed * dirX;
  let vy = Math.sin(angle) * newSpeed;

  // Apply paddle spin: paddle movement adds vertical momentum
  const spinFactor = 0.25;
  vy += paddle.vy * spinFactor;

  // Clamp vy to prevent near-vertical infinite bounces
  const maxVy = newSpeed * 0.85;
  vy = Math.max(-maxVy, Math.min(maxVy, vy));

  const smash = Math.abs(paddle.vy) > 250 || Math.abs(offset) > 0.75;
  return { vx, vy, smash };
}
