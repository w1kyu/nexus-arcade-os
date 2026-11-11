// @ts-check
// 2D Vector math & geometric collision detection routines

/**
 * 2D Vector class with chaining and utility methods.
 */
export class Vec2 {
  /**
   * @param {number} [x]
   * @param {number} [y]
   */
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /** @param {Vec2 | { x: number, y: number }} v */
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  clone() {
    return new Vec2(this.x, this.y);
  }

  /** @param {Vec2 | { x: number, y: number }} v */
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  /** @param {Vec2 | { x: number, y: number }} v */
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  /** @param {number} s */
  scale(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }

  /** @param {Vec2 | { x: number, y: number }} v */
  mul(v) {
    this.x *= v.x;
    this.y *= v.y;
    return this;
  }

  /** @param {Vec2 | { x: number, y: number }} v */
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  /** @param {Vec2 | { x: number, y: number }} v */
  cross(v) {
    return this.x * v.y - this.y * v.x;
  }

  magSq() {
    return this.x * this.x + this.y * this.y;
  }

  mag() {
    return Math.hypot(this.x, this.y);
  }

  norm() {
    const m = this.mag();
    if (m > 1e-6) {
      this.x /= m;
      this.y /= m;
    } else {
      this.x = 0;
      this.y = 0;
    }
    return this;
  }

  /** @param {Vec2 | { x: number, y: number }} v */
  distSq(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  /** @param {Vec2 | { x: number, y: number }} v */
  dist(v) {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  angle() {
    return Math.atan2(this.y, this.x);
  }

  /**
   * @param {Vec2 | { x: number, y: number }} v
   * @param {number} t
   */
  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    return this;
  }

  /** @param {number} angle */
  static fromAngle(angle) {
    return new Vec2(Math.cos(angle), Math.sin(angle));
  }
}

/**
 * @typedef {{ x: number, y: number, width: number, height: number }} AABB
 * @typedef {{ x: number, y: number, radius: number }} Circle
 */

/**
 * Axis-Aligned Bounding Box (AABB) intersection check.
 * @param {AABB} a
 * @param {AABB} b
 * @returns {boolean}
 */
export function aabbIntersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Returns overlap depth along x and y if overlapping, or null.
 * @param {AABB} a
 * @param {AABB} b
 * @returns {{ dx: number, dy: number } | null}
 */
export function aabbOverlap(a, b) {
  if (!aabbIntersects(a, b)) return null;
  const cxA = a.x + a.width / 2;
  const cyA = a.y + a.height / 2;
  const cxB = b.x + b.width / 2;
  const cyB = b.y + b.height / 2;

  const overlapX = a.width / 2 + b.width / 2 - Math.abs(cxA - cxB);
  const overlapY = a.height / 2 + b.height / 2 - Math.abs(cyA - cyB);

  const signX = cxA < cxB ? -1 : 1;
  const signY = cyA < cyB ? -1 : 1;

  return { dx: overlapX * signX, dy: overlapY * signY };
}

/**
 * Circle-to-Circle collision check.
 * @param {Circle} a
 * @param {Circle} b
 * @returns {boolean}
 */
export function circleIntersects(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy < r * r;
}

/**
 * Circle-to-AABB collision check.
 * @param {Circle} c
 * @param {AABB} b
 * @returns {boolean}
 */
export function circleAabbIntersects(c, b) {
  const closestX = Math.max(b.x, Math.min(c.x, b.x + b.width));
  const closestY = Math.max(b.y, Math.min(c.y, b.y + b.height));
  const dx = c.x - closestX;
  const dy = c.y - closestY;
  return dx * dx + dy * dy < c.radius * c.radius;
}

/**
 * Ray-AABB intersection check.
 * @param {{ x: number, y: number }} origin
 * @param {{ x: number, y: number }} dir Normalized ray direction
 * @param {AABB} box
 * @returns {{ t: number, normal: Vec2 } | null}
 */
export function rayAabb(origin, dir, box) {
  let tMin = -Infinity;
  let tMax = Infinity;
  let normal = new Vec2(0, 0);

  const axes = [
    {
      start: origin.x,
      d: dir.x,
      min: box.x,
      max: box.x + box.width,
      normNeg: new Vec2(-1, 0),
      normPos: new Vec2(1, 0),
    },
    {
      start: origin.y,
      d: dir.y,
      min: box.y,
      max: box.y + box.height,
      normNeg: new Vec2(0, -1),
      normPos: new Vec2(0, 1),
    },
  ];

  for (const axis of axes) {
    if (Math.abs(axis.d) < 1e-8) {
      if (axis.start < axis.min || axis.start > axis.max) return null;
    } else {
      let t1 = (axis.min - axis.start) / axis.d;
      let t2 = (axis.max - axis.start) / axis.d;
      let hitNormal = axis.normNeg;
      if (t1 > t2) {
        [t1, t2] = [t2, t1];
        hitNormal = axis.normPos;
      }
      if (t1 > tMin) {
        tMin = t1;
        normal = hitNormal;
      }
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }
  }

  if (tMax < 0) return null;
  const t = tMin < 0 ? tMax : tMin;
  return { t, normal };
}

/**
 * Separating Axis Theorem (SAT) collision detection for convex 2D polygons.
 * @param {{ x: number, y: number }[]} polyA List of vertices in order
 * @param {{ x: number, y: number }[]} polyB List of vertices in order
 * @returns {{ overlap: number, normal: Vec2 } | null} Returns penetration depth and normal, or null if separated.
 */
export function satPolygon(polyA, polyB) {
  let minOverlap = Infinity;
  let smallestAxis = new Vec2();

  const getAxes = (vertices) => {
    const axes = [];
    for (let i = 0; i < vertices.length; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % vertices.length];
      const edge = new Vec2(p2.x - p1.x, p2.y - p1.y);
      const normal = new Vec2(-edge.y, edge.x).norm();
      axes.push(normal);
    }
    return axes;
  };

  const project = (vertices, axis) => {
    let min = Infinity;
    let max = -Infinity;
    for (const v of vertices) {
      const p = v.x * axis.x + v.y * axis.y;
      if (p < min) min = p;
      if (p > max) max = p;
    }
    return { min, max };
  };

  const axes = [...getAxes(polyA), ...getAxes(polyB)];

  for (const axis of axes) {
    const projA = project(polyA, axis);
    const projB = project(polyB, axis);

    const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
    if (overlap <= 0) {
      return null; // Separating axis found!
    }

    if (overlap < minOverlap) {
      minOverlap = overlap;
      smallestAxis = axis;
    }
  }

  // Ensure normal points from polyA to polyB
  const centerA = polyA.reduce((acc, v) => ({ x: acc.x + v.x / polyA.length, y: acc.y + v.y / polyA.length }), {
    x: 0,
    y: 0,
  });
  const centerB = polyB.reduce((acc, v) => ({ x: acc.x + v.x / polyB.length, y: acc.y + v.y / polyB.length }), {
    x: 0,
    y: 0,
  });
  const dir = new Vec2(centerB.x - centerA.x, centerB.y - centerA.y);
  if (dir.dot(smallestAxis) < 0) {
    smallestAxis.scale(-1);
  }

  return { overlap: minOverlap, normal: smallestAxis };
}
