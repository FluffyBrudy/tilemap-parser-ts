import {
  CapsuleShape,
  CircleShape,
  CollisionPolygon,
  RectangleShape,
  TilesetCollision,
  type TileCollisionData,
} from "../parser/collision.js";
import type { Vec2 } from "../vec.js";
import { tileKey } from "../vec.js";
import type { ICollidable } from "./protocols.js";
import { flippedData, iterCellEntries, type TileMap } from "./world.js";

export function pointInPolygon(
  point: Vec2,
  vertices: readonly Vec2[],
): boolean {
  if (vertices.length === 0) return false;
  const [x, y] = point;
  const n = vertices.length;
  let inside = false;
  let p1 = vertices[0];
  if (p1 === undefined) return false;
  let [p1x, p1y] = p1;
  for (let i = 1; i <= n; i += 1) {
    const p2 = vertices[i % n];
    if (p2 === undefined) continue;
    const [p2x, p2y] = p2;
    if (y > Math.min(p1y, p2y)) {
      if (y <= Math.max(p1y, p2y)) {
        if (x <= Math.max(p1x, p2x)) {
          if (p1y !== p2y) {
            const xinters = ((y - p1y) * (p2x - p1x)) / (p2y - p1y) + p1x;
            if (p1x === p2x || x <= xinters) inside = !inside;
          }
        }
      }
    }
    p1x = p2x;
    p1y = p2y;
  }
  return inside;
}

function pointInPolygonOffset(
  px: number,
  py: number,
  vertices: readonly Vec2[],
  ox: number,
  oy: number,
  scale = 1.0,
): boolean {
  if (vertices.length === 0) return false;
  const n = vertices.length;
  let inside = false;
  const v0 = vertices[0];
  if (v0 === undefined) return false;
  let p1x = v0[0] * scale + ox;
  let p1y = v0[1] * scale + oy;
  for (let i = 1; i <= n; i += 1) {
    const v = vertices[i % n];
    if (v === undefined) continue;
    const p2x = v[0] * scale + ox;
    const p2y = v[1] * scale + oy;
    if (py > Math.min(p1y, p2y)) {
      if (py <= Math.max(p1y, p2y)) {
        if (px <= Math.max(p1x, p2x)) {
          if (p1y !== p2y) {
            const xinters = ((py - p1y) * (p2x - p1x)) / (p2y - p1y) + p1x;
            if (p1x === p2x || px <= xinters) inside = !inside;
          }
        }
      }
    }
    p1x = p2x;
    p1y = p2y;
  }
  return inside;
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  if ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) {
    if ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0)) return true;
  }
  return false;
}

export function rectPolygonCollision(
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
  vertices: readonly Vec2[],
): boolean {
  if (vertices.length === 0) return false;
  const n = vertices.length;
  const v0 = vertices[0];
  if (v0 === undefined) return false;
  let minVx = v0[0];
  let maxVx = v0[0];
  let minVy = v0[1];
  let maxVy = v0[1];
  for (let i = 1; i < n; i += 1) {
    const v = vertices[i];
    if (v === undefined) continue;
    if (v[0] < minVx) minVx = v[0];
    else if (v[0] > maxVx) maxVx = v[0];
    if (v[1] < minVy) minVy = v[1];
    else if (v[1] > maxVy) maxVy = v[1];
  }
  const rx2 = rectX + rectW;
  const ry2 = rectY + rectH;
  if (rectX > maxVx || rx2 < minVx || rectY > maxVy || ry2 < minVy)
    return false;

  if (pointInPolygon([rectX, rectY], vertices)) return true;
  if (pointInPolygon([rx2, rectY], vertices)) return true;
  if (pointInPolygon([rectX, ry2], vertices)) return true;
  if (pointInPolygon([rx2, ry2], vertices)) return true;

  for (const v of vertices) {
    if (rectX <= v[0] && v[0] < rx2 && rectY <= v[1] && v[1] < ry2) return true;
  }

  const rectEdges: Array<readonly [number, number, number, number]> = [
    [rectX, rectY, rx2, rectY],
    [rx2, rectY, rx2, ry2],
    [rx2, ry2, rectX, ry2],
    [rectX, ry2, rectX, rectY],
  ];
  for (const [rax, ray, rbx, rby] of rectEdges) {
    for (let i = 0; i < n; i += 1) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % n];
      if (p1 === undefined || p2 === undefined) continue;
      if (segmentsIntersect(rax, ray, rbx, rby, p1[0], p1[1], p2[0], p2[1]))
        return true;
    }
  }
  return false;
}

function rectPolygonCollisionOffset(
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
  vertices: readonly Vec2[],
  ox: number,
  oy: number,
  scale = 1.0,
): boolean {
  if (vertices.length === 0) return false;
  const n = vertices.length;
  const w0 = vertices[0];
  if (w0 === undefined) return false;
  let minVx = w0[0] * scale + ox;
  let maxVx = minVx;
  let minVy = w0[1] * scale + oy;
  let maxVy = minVy;
  for (let i = 1; i < n; i += 1) {
    const v = vertices[i];
    if (v === undefined) continue;
    const wx = v[0] * scale + ox;
    const wy = v[1] * scale + oy;
    if (wx < minVx) minVx = wx;
    else if (wx > maxVx) maxVx = wx;
    if (wy < minVy) minVy = wy;
    else if (wy > maxVy) maxVy = wy;
  }
  if (
    rectX > maxVx ||
    rectX + rectW < minVx ||
    rectY > maxVy ||
    rectY + rectH < minVy
  ) {
    return false;
  }

  const rx2 = rectX + rectW;
  const ry2 = rectY + rectH;
  if (pointInPolygonOffset(rectX, rectY, vertices, ox, oy, scale)) return true;
  if (pointInPolygonOffset(rx2, rectY, vertices, ox, oy, scale)) return true;
  if (pointInPolygonOffset(rectX, ry2, vertices, ox, oy, scale)) return true;
  if (pointInPolygonOffset(rx2, ry2, vertices, ox, oy, scale)) return true;

  for (const v of vertices) {
    const wx = v[0] * scale + ox;
    const wy = v[1] * scale + oy;
    if (rectX <= wx && wx < rx2 && rectY <= wy && wy < ry2) return true;
  }

  for (let i = 0; i < n; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    if (a === undefined || b === undefined) continue;
    const p1x = a[0] * scale + ox;
    const p1y = a[1] * scale + oy;
    const p2x = b[0] * scale + ox;
    const p2y = b[1] * scale + oy;
    if (segmentsIntersect(rectX, rectY, rx2, rectY, p1x, p1y, p2x, p2y))
      return true;
    if (segmentsIntersect(rx2, rectY, rx2, ry2, p1x, p1y, p2x, p2y))
      return true;
    if (segmentsIntersect(rx2, ry2, rectX, ry2, p1x, p1y, p2x, p2y))
      return true;
    if (segmentsIntersect(rectX, ry2, rectX, rectY, p1x, p1y, p2x, p2y))
      return true;
  }
  return false;
}

export function circlePolygonCollision(
  center: Vec2,
  radius: number,
  vertices: readonly Vec2[],
): boolean {
  if (pointInPolygon(center, vertices)) return true;
  const [cx, cy] = center;
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];
    if (v1 === undefined || v2 === undefined) continue;
    const [x1, y1] = v1;
    const [x2, y2] = v2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = cx - x1;
    const fy = cy - y1;
    let dist: number;
    if (dx === 0 && dy === 0) {
      dist = Math.sqrt((cx - x1) * (cx - x1) + (cy - y1) * (cy - y1));
    } else {
      const t = Math.max(
        0.0,
        Math.min(1.0, (fx * dx + fy * dy) / (dx * dx + dy * dy)),
      );
      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;
      dist = Math.sqrt(
        (cx - closestX) * (cx - closestX) + (cy - closestY) * (cy - closestY),
      );
    }
    if (dist <= radius) return true;
  }
  return false;
}

function circlePolygonCollisionOffset(
  cx: number,
  cy: number,
  radius: number,
  vertices: readonly Vec2[],
  ox: number,
  oy: number,
  scale = 1.0,
): boolean {
  if (pointInPolygonOffset(cx, cy, vertices, ox, oy, scale)) return true;
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];
    if (v1 === undefined || v2 === undefined) continue;
    const x1 = v1[0] * scale + ox;
    const y1 = v1[1] * scale + oy;
    const x2 = v2[0] * scale + ox;
    const y2 = v2[1] * scale + oy;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = cx - x1;
    const fy = cy - y1;
    let dist: number;
    if (dx === 0 && dy === 0) {
      dist = Math.sqrt((cx - x1) * (cx - x1) + (cy - y1) * (cy - y1));
    } else {
      const t = Math.max(
        0.0,
        Math.min(1.0, (fx * dx + fy * dy) / (dx * dx + dy * dy)),
      );
      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;
      dist = Math.sqrt(
        (cx - closestX) * (cx - closestX) + (cy - closestY) * (cy - closestY),
      );
    }
    if (dist <= radius) return true;
  }
  return false;
}

export function getSpriteBounds(
  sprite: ICollidable,
): [number, number, number, number] {
  const shape = sprite.collisionShape;
  if (shape instanceof RectangleShape) {
    const left = sprite.x + shape.offset[0];
    const top = sprite.y + shape.offset[1];
    return [left, top, left + shape.width, top + shape.height];
  }
  if (shape instanceof CircleShape) {
    const [cx, cy] = shape.getCenter(sprite.x, sprite.y);
    const r = shape.radius;
    return [cx - r, cy - r, cx + r, cy + r];
  }
  if (shape instanceof CapsuleShape) {
    const [tx, ty] = shape.getTopCenter(sprite.x, sprite.y);
    const r = shape.radius;
    const h = shape.height;
    return [tx - r, ty - r, tx + r, ty + h + r];
  }
  if (shape instanceof CollisionPolygon) {
    const verts = shape.vertices;
    if (verts.length === 0) return [sprite.x, sprite.y, sprite.x, sprite.y];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const v of verts) {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
    }
    return [sprite.x + minX, sprite.y + minY, sprite.x + maxX, sprite.y + maxY];
  }
  return [sprite.x, sprite.y, sprite.x + 32, sprite.y + 32];
}

export function checkSpritePolygonCollision(
  sprite: ICollidable,
  polygon: CollisionPolygon,
): boolean {
  const shape = sprite.collisionShape;
  if (shape instanceof RectangleShape) {
    const [left, top, right, bottom] = getSpriteBounds(sprite);
    return rectPolygonCollision(
      left,
      top,
      right - left,
      bottom - top,
      polygon.vertices,
    );
  }
  if (shape instanceof CircleShape) {
    const center = shape.getCenter(sprite.x, sprite.y);
    return circlePolygonCollision(center, shape.radius, polygon.vertices);
  }
  if (shape instanceof CapsuleShape) {
    const [left, top, right, bottom] = getSpriteBounds(sprite);
    return rectPolygonCollision(
      left,
      top,
      right - left,
      bottom - top,
      polygon.vertices,
    );
  }
  return false;
}

export function checkSpritePolygonOffset(
  sprite: ICollidable,
  polygon: CollisionPolygon,
  ox: number,
  oy: number,
  scale = 1.0,
): boolean {
  const shape = sprite.collisionShape;
  if (shape instanceof RectangleShape) {
    const left = sprite.x + shape.offset[0];
    const top = sprite.y + shape.offset[1];
    return rectPolygonCollisionOffset(
      left,
      top,
      shape.width,
      shape.height,
      polygon.vertices,
      ox,
      oy,
      scale,
    );
  }
  if (shape instanceof CircleShape) {
    const cx = sprite.x + shape.offset[0];
    const cy = sprite.y + shape.offset[1];
    return circlePolygonCollisionOffset(
      cx,
      cy,
      shape.radius,
      polygon.vertices,
      ox,
      oy,
      scale,
    );
  }
  if (shape instanceof CapsuleShape) {
    const left = sprite.x + shape.offset[0] - shape.radius;
    const top = sprite.y + shape.offset[1] - shape.radius;
    const w = shape.radius * 2;
    const h = shape.height + shape.radius * 2;
    return rectPolygonCollisionOffset(
      left,
      top,
      w,
      h,
      polygon.vertices,
      ox,
      oy,
      scale,
    );
  }
  if (shape instanceof CollisionPolygon) {
    return polygonPolygonCollisionOffset(
      shape.vertices,
      polygon.vertices,
      sprite.x,
      sprite.y,
      ox,
      oy,
      scale,
    );
  }
  return false;
}

function polygonPolygonCollisionOffset(
  vertsA: readonly Vec2[],
  vertsB: readonly Vec2[],
  ax: number,
  ay: number,
  ox: number,
  oy: number,
  scale = 1.0,
): boolean {
  if (vertsA.length === 0 || vertsB.length === 0) return false;

  let aMinX = Infinity;
  let aMaxX = -Infinity;
  let aMinY = Infinity;
  let aMaxY = -Infinity;
  for (const v of vertsA) {
    const wx = ax + v[0];
    const wy = ay + v[1];
    if (wx < aMinX) aMinX = wx;
    else if (wx > aMaxX) aMaxX = wx;
    if (wy < aMinY) aMinY = wy;
    else if (wy > aMaxY) aMaxY = wy;
  }
  let bMinX = Infinity;
  let bMaxX = -Infinity;
  let bMinY = Infinity;
  let bMaxY = -Infinity;
  for (const v of vertsB) {
    const wx = ox + v[0] * scale;
    const wy = oy + v[1] * scale;
    if (wx < bMinX) bMinX = wx;
    else if (wx > bMaxX) bMaxX = wx;
    if (wy < bMinY) bMinY = wy;
    else if (wy > bMaxY) bMaxY = wy;
  }
  if (aMinX > bMaxX || aMaxX < bMinX || aMinY > bMaxY || aMaxY < bMinY)
    return false;

  for (const v of vertsA) {
    if (pointInPolygonOffset(ax + v[0], ay + v[1], vertsB, ox, oy, scale))
      return true;
  }
  for (const v of vertsB) {
    if (
      pointInPolygonOffset(
        ox + v[0] * scale,
        oy + v[1] * scale,
        vertsA,
        ax,
        ay,
        1.0,
      )
    ) {
      return true;
    }
  }

  const nA = vertsA.length;
  const nB = vertsB.length;
  for (let i = 0; i < nA; i += 1) {
    const a1 = vertsA[i];
    const a2 = vertsA[(i + 1) % nA];
    if (a1 === undefined || a2 === undefined) continue;
    const a1x = ax + a1[0];
    const a1y = ay + a1[1];
    const a2x = ax + a2[0];
    const a2y = ay + a2[1];
    for (let j = 0; j < nB; j += 1) {
      const b1 = vertsB[j];
      const b2 = vertsB[(j + 1) % nB];
      if (b1 === undefined || b2 === undefined) continue;
      const b1x = ox + b1[0] * scale;
      const b1y = oy + b1[1] * scale;
      const b2x = ox + b2[0] * scale;
      const b2y = oy + b2[1] * scale;
      if (segmentsIntersect(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y))
        return true;
    }
  }
  return false;
}

export function rectVsTilemap(
  left: number,
  top: number,
  right: number,
  bottom: number,
  tileMap: TileMap,
  tilesetCollision: TilesetCollision,
  tileSize: Vec2,
  renderScale = 1.0,
  collisionMask: number | null = null,
): boolean {
  const tw = tileSize[0] * renderScale;
  const th = tileSize[1] * renderScale;
  const tx0 = Math.floor(left / tw);
  const tx1 = Math.floor((right - 1e-9) / tw);
  const ty0 = Math.floor(top / th);
  const ty1 = Math.floor((bottom - 1e-9) / th);
  const rw = right - left;
  const rh = bottom - top;

  for (let ty = ty0; ty <= ty1; ty += 1) {
    for (let tx = tx0; tx <= tx1; tx += 1) {
      const cell = tileMap.get(tileKey(tx, ty));
      if (cell === undefined) continue;
      for (const tileData of iterCellDatas(tilesetCollision, cell)) {
        if (
          collisionMask !== null &&
          (collisionMask & tileData.collisionLayer) === 0
        ) {
          continue;
        }
        const ox = tx * tw;
        const oy = ty * th;
        for (const poly of tileData.shapes) {
          if (!poly.isValid()) continue;
          if (
            rectPolygonCollisionOffset(
              left,
              top,
              rw,
              rh,
              poly.vertices,
              ox,
              oy,
              renderScale,
            )
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function iterCellDatas(
  tilesetCollision: TilesetCollision,
  cell: unknown,
): TileCollisionData[] {
  const out: TileCollisionData[] = [];
  for (const [gid, flags] of iterCellEntries(cell)) {
    const base = tilesetCollision.tiles.get(gid);
    if (base === undefined) continue;
    out.push(
      flags === 0 ? base : flippedData(base, flags, tilesetCollision.tileSize),
    );
  }
  return out;
}
