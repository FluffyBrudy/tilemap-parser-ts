import {
  CapsuleShape,
  CircleShape,
  CollisionPolygon,
  RectangleShape,
  type CharacterShape,
} from "../parser/collision.js";
import type { Vec2 } from "../vec.js";

export interface CollisionInfo {
  readonly normal: Vec2;
  readonly depth: number;
}

export type AABB = readonly [
  left: number,
  top: number,
  right: number,
  bottom: number,
];

const EPS = 0.0001;

export function aabbOverlap(a: AABB, b: AABB): boolean {
  const [l1, t1, r1, b1] = a;
  const [l2, t2, r2, b2] = b;
  return !(r1 < l2 || r2 < l1 || b1 < t2 || b2 < t1);
}

export function getShapeAabb(
  x: number,
  y: number,
  shape: CharacterShape,
): AABB {
  if (shape instanceof RectangleShape) {
    const left = x + shape.offset[0];
    const top = y + shape.offset[1];
    return [left, top, left + shape.width, top + shape.height];
  }
  if (shape instanceof CircleShape) {
    const cx = x + shape.offset[0];
    const cy = y + shape.offset[1];
    const r = shape.radius;
    return [cx - r, cy - r, cx + r, cy + r];
  }
  if (shape instanceof CapsuleShape) {
    const ox = x + shape.offset[0];
    const oy = y + shape.offset[1];
    const r = shape.radius;
    return [ox - r, oy - r, ox + r, oy + shape.height + r];
  }
  if (shape instanceof CollisionPolygon) {
    const verts = shape.vertices;
    const first = verts[0];
    if (first === undefined) {
      throw new TypeError("Cannot compute AABB of an empty polygon");
    }
    let minX = first[0] + x;
    let maxX = minX;
    let minY = first[1] + y;
    let maxY = minY;
    for (let i = 1; i < verts.length; i += 1) {
      const v = verts[i];
      if (v === undefined) continue;
      const wx = v[0] + x;
      const wy = v[1] + y;
      if (wx < minX) minX = wx;
      else if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy;
      else if (wy > maxY) maxY = wy;
    }
    return [minX, minY, maxX, maxY];
  }
  throw new TypeError(
    `Unsupported shape type: ${(shape as { kind?: unknown }).kind ?? typeof shape}`,
  );
}

export function circleVsCircle(
  c1Center: Vec2,
  c1Radius: number,
  c2Center: Vec2,
  c2Radius: number,
): CollisionInfo | null {
  const dx = c2Center[0] - c1Center[0];
  const dy = c2Center[1] - c1Center[1];
  const distSq = dx * dx + dy * dy;
  const radiusSum = c1Radius + c2Radius;
  if (distSq > radiusSum * radiusSum) return null;
  const dist = Math.sqrt(distSq);
  if (dist < EPS) {
    return { normal: [1.0, 0.0], depth: radiusSum };
  }
  return { normal: [dx / dist, dy / dist], depth: radiusSum - dist };
}

export function rectVsRect(
  r1Bounds: AABB,
  r2Bounds: AABB,
): CollisionInfo | null {
  if (!aabbOverlap(r1Bounds, r2Bounds)) return null;
  const [l1, t1, r1, b1] = r1Bounds;
  const [l2, t2, r2, b2] = r2Bounds;
  const overlapX = Math.min(r1, r2) - Math.max(l1, l2);
  const overlapY = Math.min(b1, b2) - Math.max(t1, t2);
  if (overlapX < overlapY) {
    return {
      normal: l1 + r1 < l2 + r2 ? [1.0, 0.0] : [-1.0, 0.0],
      depth: overlapX,
    };
  }
  return {
    normal: t1 + b1 < t2 + b2 ? [0.0, 1.0] : [0.0, -1.0],
    depth: overlapY,
  };
}

export function rectVsCircle(
  rectBounds: AABB,
  circleCenter: Vec2,
  circleRadius: number,
): CollisionInfo | null {
  const [l, t, r, b] = rectBounds;
  const [cx, cy] = circleCenter;
  const closestX = Math.max(l, Math.min(cx, r));
  const closestY = Math.max(t, Math.min(cy, b));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq > circleRadius * circleRadius) return null;
  const dist = Math.sqrt(distSq);
  if (dist < EPS) {
    const distLeft = cx - l;
    const distRight = r - cx;
    const distTop = cy - t;
    const distBottom = b - cy;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist === distLeft) {
      return { normal: [-1.0, 0.0], depth: circleRadius + distLeft };
    }
    if (minDist === distRight) {
      return { normal: [1.0, 0.0], depth: circleRadius + distRight };
    }
    if (minDist === distTop) {
      return { normal: [0.0, -1.0], depth: circleRadius + distTop };
    }
    return { normal: [0.0, 1.0], depth: circleRadius + distBottom };
  }
  return { normal: [dx / dist, dy / dist], depth: circleRadius - dist };
}

function projectPolygon(
  vertices: readonly Vec2[],
  axis: Vec2,
): [number, number] {
  const [ax, ay] = axis;
  const v0 = vertices[0];
  if (v0 === undefined) return [0, 0];
  let projMin = v0[0] * ax + v0[1] * ay;
  let projMax = projMin;
  for (let i = 1; i < vertices.length; i += 1) {
    const v = vertices[i];
    if (v === undefined) continue;
    const dot = v[0] * ax + v[1] * ay;
    if (dot < projMin) projMin = dot;
    else if (dot > projMax) projMax = dot;
  }
  return [projMin, projMax];
}

export function polygonVsPolygon(
  p1Vertices: readonly Vec2[],
  p2Vertices: readonly Vec2[],
): CollisionInfo | null {
  const n1 = p1Vertices.length;
  const n2 = p2Vertices.length;
  let c1x = 0;
  let c1y = 0;
  for (const v of p1Vertices) {
    c1x += v[0];
    c1y += v[1];
  }
  let c2x = 0;
  let c2y = 0;
  for (const v of p2Vertices) {
    c2x += v[0];
    c2y += v[1];
  }
  c1x /= n1;
  c1y /= n1;
  c2x /= n2;
  c2y /= n2;
  const toC2X = c2x - c1x;
  const toC2Y = c2y - c1y;

  let minOverlap = Infinity;
  let bestAxis: Vec2 | null = null;

  const testEdges = (verts: readonly Vec2[]): boolean => {
    const n = verts.length;
    for (let i = 0; i < n; i += 1) {
      const a = verts[i];
      const b = verts[(i + 1) % n];
      if (a === undefined || b === undefined) continue;
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const edgeLen = Math.sqrt(ex * ex + ey * ey);
      if (edgeLen < EPS) continue;
      const axis: Vec2 = [-ey / edgeLen, ex / edgeLen];
      const [min1, max1] = projectPolygon(p1Vertices, axis);
      const [min2, max2] = projectPolygon(p2Vertices, axis);
      if (max1 < min2 || max2 < min1) return false;
      const overlap = Math.min(max1, max2) - Math.max(min1, min2);
      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestAxis = axis;
      }
    }
    return true;
  };

  if (!testEdges(p1Vertices)) return null;
  if (!testEdges(p2Vertices)) return null;

  const axis = bestAxis;
  if (axis === null) {
    return { normal: [1.0, 0.0], depth: 0.0 };
  }
  let ax: number = axis[0] ?? 0;
  let ay: number = axis[1] ?? 0;
  if (ax * toC2X + ay * toC2Y < 0) {
    ax = -ax;
    ay = -ay;
  }
  return { normal: [ax, ay], depth: minOverlap };
}

function pointInPolygon(
  px: number,
  py: number,
  vertices: readonly Vec2[],
): boolean {
  const n = vertices.length;
  let inside = false;
  let j = n - 1;
  for (let i = 0; i < n; i += 1) {
    const vi = vertices[i];
    const vj = vertices[j];
    if (vi === undefined || vj === undefined) {
      j = i;
      continue;
    }
    if (
      vi[1] > py !== vj[1] > py &&
      px < ((vj[0] - vi[0]) * (py - vi[1])) / (vj[1] - vi[1]) + vi[0]
    ) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Vec2 {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq < EPS) return [ax, ay];
  const t = Math.max(
    0.0,
    Math.min(1.0, ((px - ax) * abx + (py - ay) * aby) / abLenSq),
  );
  return [ax + t * abx, ay + t * aby];
}

export function polygonVsCircle(
  polyVertices: readonly Vec2[],
  circleCenter: Vec2,
  circleRadius: number,
): CollisionInfo | null {
  const [cx, cy] = circleCenter;
  const r = circleRadius;
  const inside = pointInPolygon(cx, cy, polyVertices);

  let minDistSq = Infinity;
  let bestNormalX = 0.0;
  let bestNormalY = 0.0;

  const n = polyVertices.length;
  for (let i = 0; i < n; i += 1) {
    const a = polyVertices[i];
    const b = polyVertices[(i + 1) % n];
    if (a === undefined || b === undefined) continue;
    const [ax, ay] = a;
    const [bx, by] = b;
    const [closestX, closestY] = closestPointOnSegment(cx, cy, ax, ay, bx, by);
    const dx = cx - closestX;
    const dy = cy - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      const dist = distSq > 0.0 ? Math.sqrt(distSq) : 0.0;
      if (dist > EPS) {
        bestNormalX = dx / dist;
        bestNormalY = dy / dist;
      } else {
        const ex = bx - ax;
        const ey = by - ay;
        const edgeLen = Math.sqrt(ex * ex + ey * ey);
        if (edgeLen > EPS) {
          bestNormalX = -ey / edgeLen;
          bestNormalY = ex / edgeLen;
        } else {
          bestNormalX = 1.0;
          bestNormalY = 0.0;
        }
      }
    }
  }

  if (inside) {
    return {
      normal: [bestNormalX, bestNormalY],
      depth: r + Math.sqrt(minDistSq),
    };
  }
  if (minDistSq > r * r) return null;
  return {
    normal: [bestNormalX, bestNormalY],
    depth: r - Math.sqrt(minDistSq),
  };
}

export function polygonVsRect(
  polyVertices: readonly Vec2[],
  rectBounds: AABB,
): CollisionInfo | null {
  const [l, t, r, b] = rectBounds;
  const rectVerts: Vec2[] = [
    [l, t],
    [r, t],
    [r, b],
    [l, b],
  ];
  return polygonVsPolygon(polyVertices, rectVerts);
}

function segmentClosestPointToPoint(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): Vec2 {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq < EPS) return [ax, ay];
  const t = Math.max(
    0.0,
    Math.min(1.0, ((px - ax) * abx + (py - ay) * aby) / abLenSq),
  );
  return [ax + t * abx, ay + t * aby];
}

function segmentClosestPointToAabb(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  l: number,
  top: number,
  r: number,
  b: number,
): [number, number, number] {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;

  let bestDsq = Infinity;
  let bestX = ax;
  let bestY = ay;
  const attempt = (px: number, py: number): void => {
    const cpx = Math.max(l, Math.min(px, r));
    const cpy = Math.max(top, Math.min(py, b));
    const dx = px - cpx;
    const dy = py - cpy;
    const dsq = dx * dx + dy * dy;
    if (dsq < bestDsq) {
      bestDsq = dsq;
      bestX = px;
      bestY = py;
    }
  };

  attempt(ax, ay);
  attempt(bx, by);
  if (abLenSq > EPS) {
    for (const [cornerX, cornerY] of [
      [l, top],
      [r, top],
      [r, b],
      [l, b],
    ] as const) {
      const tProj = ((cornerX - ax) * abx + (cornerY - ay) * aby) / abLenSq;
      const tClamped = Math.max(0.0, Math.min(1.0, tProj));
      attempt(ax + tClamped * abx, ay + tClamped * aby);
    }
  }
  return [bestX, bestY, bestDsq];
}

function segmentsClosestPoints(
  a1x: number,
  a1y: number,
  a2x: number,
  a2y: number,
  b1x: number,
  b1y: number,
  b2x: number,
  b2y: number,
): [Vec2, Vec2, number] {
  const d1x = a2x - a1x;
  const d1y = a2y - a1y;
  const d2x = b2x - b1x;
  const d2y = b2y - b1y;
  const d1LenSq = d1x * d1x + d1y * d1y;
  const d2LenSq = d2x * d2x + d2y * d2y;

  if (d1LenSq < EPS && d2LenSq < EPS) {
    const dx = b1x - a1x;
    const dy = b1y - a1y;
    return [[a1x, a1y], [b1x, b1y], dx * dx + dy * dy];
  }
  if (d1LenSq < EPS) {
    const [px, py] = segmentClosestPointToPoint(b1x, b1y, b2x, b2y, a1x, a1y);
    const dx = px - a1x;
    const dy = py - a1y;
    return [[a1x, a1y], [px, py], dx * dx + dy * dy];
  }
  if (d2LenSq < EPS) {
    const [px, py] = segmentClosestPointToPoint(a1x, a1y, a2x, a2y, b1x, b1y);
    const dx = px - b1x;
    const dy = py - b1y;
    return [[px, py], [b1x, b1y], dx * dx + dy * dy];
  }

  const rx = a1x - b1x;
  const ry = a1y - b1y;
  const a = d1LenSq;
  const bb = d1x * d2x + d1y * d2y;
  const c = d2LenSq;
  const d = d1x * rx + d1y * ry;
  const e = d2x * rx + d2y * ry;

  const det = a * c - bb * bb;
  if (det < EPS) {
    let bestDsq = Infinity;
    let bestP: Vec2 = [a1x, a1y];
    let bestQ: Vec2 = [b1x, b1y];
    const pairs: Array<[Vec2, Vec2]> = [
      [[a1x, a1y], segmentClosestPointToPoint(b1x, b1y, b2x, b2y, a1x, a1y)],
      [[a2x, a2y], segmentClosestPointToPoint(b1x, b1y, b2x, b2y, a2x, a2y)],
      [[b1x, b1y], segmentClosestPointToPoint(a1x, a1y, a2x, a2y, b1x, b1y)],
      [[b2x, b2y], segmentClosestPointToPoint(a1x, a1y, a2x, a2y, b2x, b2y)],
    ];
    for (const [pa, pb] of pairs) {
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      const dsq = dx * dx + dy * dy;
      if (dsq < bestDsq) {
        bestDsq = dsq;
        bestP = pa;
        bestQ = pb;
      }
    }
    return [bestP, bestQ, bestDsq];
  }

  const s = Math.max(0.0, Math.min(1.0, (bb * e - c * d) / det));
  const t = Math.max(0.0, Math.min(1.0, (a * e - bb * d) / det));
  const paX = a1x + s * d1x;
  const paY = a1y + s * d1y;
  const pbX = b1x + t * d2x;
  const pbY = b1y + t * d2y;
  const dx = pbX - paX;
  const dy = pbY - paY;
  return [[paX, paY], [pbX, pbY], dx * dx + dy * dy];
}

export function capsuleVsCircle(
  capP1: Vec2,
  capP2: Vec2,
  capRadius: number,
  circleCenter: Vec2,
  circleRadius: number,
): CollisionInfo | null {
  const [px, py] = segmentClosestPointToPoint(
    capP1[0],
    capP1[1],
    capP2[0],
    capP2[1],
    circleCenter[0],
    circleCenter[1],
  );
  return circleVsCircle([px, py], capRadius, circleCenter, circleRadius);
}

export function capsuleVsCapsule(
  p1: Vec2,
  p2: Vec2,
  r1: number,
  q1: Vec2,
  q2: Vec2,
  r2: number,
): CollisionInfo | null {
  const [[paX, paY], [pbX, pbY]] = segmentsClosestPoints(
    p1[0],
    p1[1],
    p2[0],
    p2[1],
    q1[0],
    q1[1],
    q2[0],
    q2[1],
  );
  return circleVsCircle([paX, paY], r1, [pbX, pbY], r2);
}

export function capsuleVsRect(
  capP1: Vec2,
  capP2: Vec2,
  capRadius: number,
  rectBounds: AABB,
): CollisionInfo | null {
  const [px, py] = segmentClosestPointToAabb(
    capP1[0],
    capP1[1],
    capP2[0],
    capP2[1],
    rectBounds[0],
    rectBounds[1],
    rectBounds[2],
    rectBounds[3],
  );
  const result = rectVsCircle(rectBounds, [px, py], capRadius);
  if (result === null) return null;
  return {
    normal: [-result.normal[0], -result.normal[1]],
    depth: result.depth,
  };
}

function segmentClosestPointToPolygon(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  vertices: readonly Vec2[],
): [number, number, number] {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  const n = vertices.length;

  let bestDsq = Infinity;
  let bestX = ax;
  let bestY = ay;

  const distToPolySq = (px: number, py: number): number => {
    let inside = true;
    let minDsq = Infinity;
    for (let i = 0; i < n; i += 1) {
      const va = vertices[i];
      const vb = vertices[(i + 1) % n];
      if (va === undefined || vb === undefined) continue;
      const [vax, vay] = va;
      const [vbx, vby] = vb;
      const ex = vbx - vax;
      const ey = vby - vay;
      const nx = -ey;
      const ny = ex;
      if (nx * (px - vax) + ny * (py - vay) < 0) inside = false;
      const [cx, cy] = closestPointOnSegment(px, py, vax, vay, vbx, vby);
      const dsq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (dsq < minDsq) minDsq = dsq;
    }
    return inside ? 0.0 : minDsq;
  };

  const attempt = (px: number, py: number): void => {
    const dsq = distToPolySq(px, py);
    if (dsq < bestDsq) {
      bestDsq = dsq;
      bestX = px;
      bestY = py;
    }
  };

  attempt(ax, ay);
  attempt(bx, by);
  if (abLenSq > EPS) {
    for (const v of vertices) {
      const tProj = ((v[0] - ax) * abx + (v[1] - ay) * aby) / abLenSq;
      const tClamped = Math.max(0.0, Math.min(1.0, tProj));
      attempt(ax + tClamped * abx, ay + tClamped * aby);
    }
  }
  for (let i = 0; i < n; i += 1) {
    const va = vertices[i];
    const vb = vertices[(i + 1) % n];
    if (va === undefined || vb === undefined) continue;
    const [[paX, paY]] = segmentsClosestPoints(
      ax,
      ay,
      bx,
      by,
      va[0],
      va[1],
      vb[0],
      vb[1],
    );
    attempt(paX, paY);
  }
  return [bestX, bestY, bestDsq];
}

export function capsuleVsPolygon(
  capP1: Vec2,
  capP2: Vec2,
  capRadius: number,
  polyVertices: readonly Vec2[],
): CollisionInfo | null {
  const [px, py] = segmentClosestPointToPolygon(
    capP1[0],
    capP1[1],
    capP2[0],
    capP2[1],
    polyVertices,
  );
  const result = polygonVsCircle(polyVertices, [px, py], capRadius);
  if (result === null) return null;
  return {
    normal: [-result.normal[0], -result.normal[1]],
    depth: result.depth,
  };
}
