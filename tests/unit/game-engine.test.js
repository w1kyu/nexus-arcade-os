import { describe, expect, it } from 'vitest';
import {
  Easing,
  GameLoop,
  GameScoreService,
  ObjectPool,
  ParticleSystem,
  SeededRng,
  TimerManager,
  TweenManager,
  Vec2,
  aabbIntersects,
  aabbOverlap,
  circleAabbIntersects,
  circleIntersects,
  rayAabb,
  satPolygon,
} from '../../src/games/engine/index.js';

describe('Game Engine — Math & Collisions', () => {
  it('handles Vec2 arithmetic, normalization, and lerp', () => {
    const v1 = new Vec2(3, 4);
    expect(v1.mag()).toBe(5);
    expect(v1.magSq()).toBe(25);

    const v2 = new Vec2(1, 2);
    v1.add(v2);
    expect(v1.x).toBe(4);
    expect(v1.y).toBe(6);

    v1.scale(0.5);
    expect(v1.x).toBe(2);
    expect(v1.y).toBe(3);

    const norm = new Vec2(0, 10).norm();
    expect(norm.x).toBe(0);
    expect(norm.y).toBe(1);

    const a = new Vec2(0, 0);
    const b = new Vec2(10, 20);
    a.lerp(b, 0.5);
    expect(a.x).toBe(5);
    expect(a.y).toBe(10);
  });

  it('detects AABB collisions and overlap depths', () => {
    const boxA = { x: 0, y: 0, width: 20, height: 20 };
    const boxB = { x: 10, y: 10, width: 20, height: 20 };
    const boxC = { x: 30, y: 30, width: 10, height: 10 };

    expect(aabbIntersects(boxA, boxB)).toBe(true);
    expect(aabbIntersects(boxA, boxC)).toBe(false);

    const overlap = aabbOverlap(boxA, boxB);
    expect(overlap).not.toBeNull();
    expect(Math.abs(overlap.dx)).toBe(10);
    expect(Math.abs(overlap.dy)).toBe(10);
  });

  it('detects circle-circle and circle-AABB collisions', () => {
    const c1 = { x: 10, y: 10, radius: 5 };
    const c2 = { x: 16, y: 10, radius: 5 };
    const c3 = { x: 30, y: 10, radius: 5 };

    expect(circleIntersects(c1, c2)).toBe(true);
    expect(circleIntersects(c1, c3)).toBe(false);

    const box = { x: 20, y: 0, width: 20, height: 20 };
    expect(circleAabbIntersects(c1, box)).toBe(false);
    expect(circleAabbIntersects({ x: 18, y: 10, radius: 5 }, box)).toBe(true);
  });

  it('calculates ray-AABB intersections', () => {
    const box = { x: 10, y: 0, width: 20, height: 20 };
    const origin = { x: 0, y: 10 };
    const dir = { x: 1, y: 0 };

    const hit = rayAabb(origin, dir, box);
    expect(hit).not.toBeNull();
    expect(hit.t).toBe(10);
    expect(hit.normal.x).toBe(-1);
    expect(hit.normal.y).toBe(0);
  });

  it('detects polygon collisions using SAT (Separating Axis Theorem)', () => {
    // Two overlapping squares
    const polyA = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    const polyB = [
      { x: 15, y: 15 },
      { x: 35, y: 15 },
      { x: 35, y: 35 },
      { x: 15, y: 35 },
    ];
    const polyC = [
      { x: 50, y: 50 },
      { x: 60, y: 50 },
      { x: 60, y: 60 },
      { x: 50, y: 60 },
    ];

    const hitAB = satPolygon(polyA, polyB);
    expect(hitAB).not.toBeNull();
    expect(hitAB.overlap).toBeGreaterThan(0);

    const hitAC = satPolygon(polyA, polyC);
    expect(hitAC).toBeNull();
  });
});

describe('Game Engine — Seeded PRNG', () => {
  it('produces deterministic sequences from the same seed', () => {
    const rng1 = new SeededRng(12345);
    const rng2 = new SeededRng(12345);

    for (let i = 0; i < 10; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }

    const rngStr1 = new SeededRng('daily-2026-11-11');
    const rngStr2 = new SeededRng('daily-2026-11-11');
    expect(rngStr1.int(1, 100)).toBe(rngStr2.int(1, 100));
  });

  it('shuffles arrays deterministically', () => {
    const rng = new SeededRng(999);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle([...arr]);
    expect(shuffled).toHaveLength(arr.length);
    expect(shuffled.sort()).toEqual(arr);
  });
});

describe('Game Engine — Tweens & Timers', () => {
  it('updates tweens and invokes onComplete', () => {
    const tm = new TweenManager();
    const obj = { x: 0, alpha: 1 };
    let completed = false;

    tm.to(obj, { x: 100, alpha: 0 }, 1.0, {
      easing: Easing.linear,
      onComplete: () => {
        completed = true;
      },
    });

    tm.update(0.5);
    expect(obj.x).toBeCloseTo(50, 1);
    expect(obj.alpha).toBeCloseTo(0.5, 1);
    expect(completed).toBe(false);

    tm.update(0.5);
    expect(obj.x).toBeCloseTo(100, 1);
    expect(obj.alpha).toBeCloseTo(0, 1);
    expect(completed).toBe(true);
  });

  it('runs timer delays and intervals', () => {
    const timers = new TimerManager();
    let count = 0;

    timers.after(0.5, () => {
      count += 10;
    });

    const rep = timers.every(0.2, () => {
      count += 1;
    });

    timers.update(0.25);
    expect(count).toBe(1);

    timers.update(0.3);
    // 0.25 + 0.3 = 0.55s, so one-shot fired (+10) and interval fired second time (+1)
    expect(count).toBe(12);

    timers.cancel(rep);
    timers.update(0.5);
    expect(count).toBe(12);
  });
});

describe('Game Engine — Object Pool & Particles', () => {
  it('acquires, reuses, and releases objects', () => {
    let created = 0;
    const pool = new ObjectPool(
      () => ({ id: ++created, active: true }),
      (item) => {
        item.active = true;
      },
      2,
    );

    expect(pool.availableCount).toBe(2);
    const item1 = pool.acquire();
    const item2 = pool.acquire();
    expect(item2).toBeDefined();
    expect(pool.activeCount).toBe(2);
    expect(pool.availableCount).toBe(0);

    pool.release(item1);
    expect(pool.availableCount).toBe(1);

    const item3 = pool.acquire();
    expect(item3).toBe(item1); // Reused
  });

  it('emits and updates particles in particle system', () => {
    const ps = new ParticleSystem(50);
    ps.emit({ x: 10, y: 20, count: 5, life: 0.1 });
    expect(ps.particles.length).toBe(5);

    ps.update(0.2); // Exceeds particle life
    expect(ps.particles.length).toBe(0);
  });
});

describe('Game Engine — Game Loop', () => {
  it('manages pause/resume and time scaling', () => {
    let updates = 0;
    let renders = 0;

    const loop = new GameLoop({
      update: () => {
        updates++;
      },
      render: () => {
        renders++;
      },
      autoPauseOnBlur: false,
    });

    expect(updates).toBe(0);
    expect(renders).toBe(0);
    expect(loop.isPaused()).toBe(false);
    loop.pause();
    expect(loop.isPaused()).toBe(true);
    loop.resume();
    expect(loop.isPaused()).toBe(false);

    loop.timeScale = 0.5;
    expect(loop.timeScale).toBe(0.5);

    loop.dispose();
  });
});

describe('Game Engine — Score & Achievement Services', () => {
  it('tracks leaderboards and awards XP', async () => {
    const store = new Map();
    let awardedXp = 0;
    let stats = {};

    const ctx = {
      storage: {
        kv: {
          get: async (k) => store.get(k),
          set: async (k, v) => store.set(k, v),
        },
      },
      achievements: {
        award: async (amt) => {
          awardedXp += amt;
        },
        stat: async (k, d) => {
          stats[k] = (stats[k] || 0) + d;
        },
        unlock: async () => {},
        progress: async () => {},
      },
    };

    const scores = new GameScoreService('nexus.snake', ctx);
    const res1 = await scores.submitScore(500, 'classic', { name: 'Alice' });
    expect(res1.isNewHigh).toBe(true);
    expect(res1.rank).toBe(1);
    expect(awardedXp).toBe(10);
    expect(stats.gamesPlayed).toBe(1);

    const res2 = await scores.submitScore(300, 'classic', { name: 'Bob' });
    expect(res2.isNewHigh).toBe(false);
    expect(res2.rank).toBe(2);

    const lb = await scores.getLeaderboard('classic');
    expect(lb).toHaveLength(2);
    expect(lb[0].score).toBe(500);
    expect(lb[1].score).toBe(300);
  });
});
