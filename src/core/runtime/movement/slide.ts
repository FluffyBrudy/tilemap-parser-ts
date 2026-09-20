import type {
  CollisionPolygon,
  TilesetCollision,
} from "../../parser/collision.js";
import type { ICollidable } from "../protocols.js";
import type { PhysicsWorld, TileMap } from "../world.js";
import { collidesAt, firstCollidingShape } from "./queries.js";
import type { CollisionRunner } from "./runner.js";
import { createCollisionResult, type CollisionResult } from "./types.js";

export interface SlideOptions {
  readonly slopeSlide?: boolean;
  readonly world?: PhysicsWorld | null;
}

export function moveAndSlide(
  runner: CollisionRunner,
  sprite: ICollidable,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  deltaX: number,
  deltaY: number,
  options: SlideOptions = {},
): CollisionResult {
  const world = runner.resolveWorld(options.world ?? null);
  if (world !== null) {
    tilesetCollision = world.tilesetCollision;
    tileMap = world.tileMap;
  }
  const result = createCollisionResult(sprite.x, sprite.y);
  if (deltaX === 0 && deltaY === 0) return result;

  const oldX = sprite.x;
  const oldY = sprite.y;
  const slopeSlide = options.slopeSlide ?? false;

  if (slopeSlide) {
    const maxSlides = 4;
    let motionX = deltaX;
    let motionY = deltaY;
    for (let s = 0; s < maxSlides; s += 1) {
      if (Math.abs(motionX) < 0.01 && Math.abs(motionY) < 0.01) break;
      sprite.x = oldX + motionX;
      sprite.y = oldY + motionY;
      const hit = firstCollidingShape(
        runner,
        sprite,
        tilesetCollision,
        tileMap,
        1,
        world,
      );
      if (hit === null) {
        result.finalX = sprite.x;
        result.finalY = sprite.y;
        return result;
      }
      sprite.x = oldX;
      sprite.y = oldY;
      result.collided = true;
      const [poly, ox, oy] = hit;
      const normal = collisionNormalFromMotion(
        sprite,
        poly,
        ox,
        oy,
        motionX,
        motionY,
        runner.renderScale,
      );
      if (normal !== null) {
        const dot = motionX * normal[0] + motionY * normal[1];
        if (dot < 0) {
          motionX -= normal[0] * dot;
          motionY -= normal[1] * dot;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    result.finalX = sprite.x;
    result.finalY = sprite.y;
    return result;
  }

  sprite.x = oldX + deltaX;
  sprite.y = oldY + deltaY;
  if (!collidesAt(runner, sprite, tilesetCollision, tileMap, 1, world)) {
    result.finalX = sprite.x;
    result.finalY = sprite.y;
    return result;
  }
  result.collided = true;

  sprite.x = oldX + deltaX;
  sprite.y = oldY;
  const xCollided = collidesAt(
    runner,
    sprite,
    tilesetCollision,
    tileMap,
    1,
    world,
  );
  if (xCollided) {
    sprite.x = oldX;
    result.hitWallX = true;
  }

  sprite.y = oldY + deltaY;
  const yCollided = collidesAt(
    runner,
    sprite,
    tilesetCollision,
    tileMap,
    1,
    world,
  );
  if (yCollided) {
    sprite.y = oldY;
    result.hitWallY = true;
  }

  let xc = xCollided;
  let yc = yCollided;
  if (!xc && !yc) {
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      sprite.y = oldY;
      yc = true;
      result.hitWallY = true;
      result.slideVector = [deltaX, 0.0];
    } else {
      sprite.x = oldX;
      xc = true;
      result.hitWallX = true;
      result.slideVector = [0.0, deltaY];
    }
  }
  result.finalX = sprite.x;
  result.finalY = sprite.y;
  if (xc && !yc) result.slideVector = [0.0, deltaY];
  else if (yc && !xc) result.slideVector = [deltaX, 0.0];
  return result;
}

export function collisionNormalFromMotion(
  _sprite: ICollidable,
  polygon: CollisionPolygon,
  ox: number,
  oy: number,
  motionX: number,
  motionY: number,
  scale = 1.0,
): [number, number] | null {
  const vertices = polygon.vertices;
  const n = vertices.length;
  if (n < 2) return null;

  let polyCx = 0.0;
  let polyCy = 0.0;
  for (const v of vertices) {
    polyCx += v[0] * scale;
    polyCy += v[1] * scale;
  }
  polyCx = ox + polyCx / n;
  polyCy = oy + polyCy / n;

  let bestEdge: [number, number] | null = null;
  let bestAlignment = -1.0;
  for (let i = 0; i < n; i += 1) {
    const v1 = vertices[i];
    const v2 = vertices[(i + 1) % n];
    if (v1 === undefined || v2 === undefined) continue;
    const v1x = v1[0] * scale + ox;
    const v1y = v1[1] * scale + oy;
    const v2x = v2[0] * scale + ox;
    const v2y = v2[1] * scale + oy;
    const edgeX = v2x - v1x;
    const edgeY = v2y - v1y;
    const edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
    if (edgeLen < 0.01) continue;
    let normalX = -edgeY / edgeLen;
    let normalY = edgeX / edgeLen;
    const midX = (v1x + v2x) * 0.5;
    const midY = (v1y + v2y) * 0.5;
    const toOutsideX = midX - polyCx;
    const toOutsideY = midY - polyCy;
    if (normalX * toOutsideX + normalY * toOutsideY < 0) {
      normalX = -normalX;
      normalY = -normalY;
    }
    const alignment = -(motionX * normalX + motionY * normalY);
    if (alignment > bestAlignment && alignment > 0) {
      bestAlignment = alignment;
      bestEdge = [normalX, normalY];
    }
  }
  return bestEdge;
}
