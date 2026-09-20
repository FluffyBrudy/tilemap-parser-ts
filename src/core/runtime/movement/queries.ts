import {
  CollisionPolygon,
  TileCollisionData,
  TilesetCollision,
} from "../../parser/collision.js";
import type { Vec2 } from "../../vec.js";
import { tileKey } from "../../vec.js";
import { shouldCollide } from "../collision/hit.js";
import { checkSpritePolygonOffset, getSpriteBounds } from "../polygon_query.js";
import type { ICollidable, ICollidableSprite } from "../protocols.js";
import {
  flippedData,
  iterCellEntries,
  type PhysicsWorld,
  type TileMap,
} from "../world.js";
import type { CollisionRunner } from "./runner.js";
import type { GroundInfo } from "./types.js";

export function resolveTileData(
  world: PhysicsWorld | null,
  tilesetCollision: TilesetCollision | null,
  tileId: number | null | undefined,
): TileCollisionData | null {
  if (tileId === null || tileId === undefined) return null;
  if (typeof tileId === "boolean") return null;
  if (world !== null) return world.resolveCollision(tileId);
  if (tilesetCollision === null) return null;
  return tilesetCollision.tiles.get(tileId) ?? null;
}

function literalEntryData(
  tilesetCollision: TilesetCollision,
  entry: readonly [number, number],
): TileCollisionData | null {
  const [gid, flags] = entry;
  const base = tilesetCollision.tiles.get(gid);
  if (base === undefined) return null;
  if (flags === 0) return base;
  return flippedData(base, flags, tilesetCollision.tileSize);
}

export function* iterTileDatas(
  world: PhysicsWorld | null,
  tilesetCollision: TilesetCollision | null,
  cell: unknown,
  sprite: ICollidable | null = null,
): Generator<TileCollisionData> {
  if (world !== null) {
    for (const entry of iterCellEntries(cell)) {
      const data = world.resolveStackEntry(entry);
      if (data === null) continue;
      if (sprite !== null && !shouldCollide(sprite, data)) continue;
      yield data;
    }
    return;
  }
  if (tilesetCollision === null) return;
  for (const entry of iterCellEntries(cell)) {
    const data = literalEntryData(tilesetCollision, entry);
    if (data === null) continue;
    if (sprite !== null && !shouldCollide(sprite, data)) continue;
    yield data;
  }
}

export function collidesAt(
  runner: CollisionRunner,
  sprite: ICollidable,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  margin = 1,
  world: PhysicsWorld | null = null,
): boolean {
  const [left, top, right, bottom] = getSpriteBounds(sprite);
  const tw = runner.effTw;
  const th = runner.effTh;
  const minTileX = Math.floor(left / tw) - margin;
  const maxTileX = Math.floor(right / tw) + margin;
  const minTileY = Math.floor(top / th) - margin;
  const maxTileY = Math.floor(bottom / th) + margin;
  if (tileMap !== null) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const cell = tileMap.get(tileKey(tileX, tileY));
        if (cell === undefined) continue;
        for (const tileData of iterTileDatas(
          world,
          tilesetCollision,
          cell,
          sprite,
        )) {
          const ox = tileX * tw;
          const oy = tileY * th;
          for (const poly of tileData.shapes) {
            if (
              poly.isValid() &&
              checkSpritePolygonOffset(sprite, poly, ox, oy, runner.renderScale)
            ) {
              return true;
            }
          }
        }
      }
    }
  }
  const effective = world ?? runner.world;
  return effective !== null && effective.collidesWithBody(sprite) !== null;
}

export function firstCollidingShape(
  runner: CollisionRunner,
  sprite: ICollidable,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  margin = 1,
  world: PhysicsWorld | null = null,
): [CollisionPolygon, number, number] | null {
  const [left, top, right, bottom] = getSpriteBounds(sprite);
  const tw = runner.effTw;
  const th = runner.effTh;
  const minTileX = Math.floor(left / tw) - margin;
  const maxTileX = Math.floor(right / tw) + margin;
  const minTileY = Math.floor(top / th) - margin;
  const maxTileY = Math.floor(bottom / th) + margin;
  if (tileMap !== null) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const cell = tileMap.get(tileKey(tileX, tileY));
        if (cell === undefined) continue;
        for (const tileData of iterTileDatas(
          world,
          tilesetCollision,
          cell,
          sprite,
        )) {
          const ox = tileX * tw;
          const oy = tileY * th;
          for (const poly of tileData.shapes) {
            if (
              poly.isValid() &&
              checkSpritePolygonOffset(sprite, poly, ox, oy, runner.renderScale)
            ) {
              return [poly, ox, oy];
            }
          }
        }
      }
    }
  }
  const effective = world ?? runner.world;
  if (effective !== null) {
    const body = effective.collidesWithBody(sprite);
    if (body !== null) return [body.asPolygon(), 0.0, 0.0];
  }
  return null;
}

export function collidesAtPlatformer(
  runner: CollisionRunner,
  sprite: ICollidableSprite,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  includeOneWay = false,
  previousBottom: number | null = null,
  world: PhysicsWorld | null = null,
): boolean {
  const [left, top, right, bottom] = getSpriteBounds(sprite);
  const tw = runner.effTw;
  const th = runner.effTh;
  const minTileX = Math.floor(left / tw) - 1;
  const maxTileX = Math.floor(right / tw) + 1;
  const minTileY = Math.floor(top / th) - 1;
  const maxTileY = Math.floor(bottom / th) + 1;
  if (tileMap !== null) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const cell = tileMap.get(tileKey(tileX, tileY));
        if (cell === undefined) continue;
        for (const tileData of iterTileDatas(
          world,
          tilesetCollision,
          cell,
          sprite,
        )) {
          const ox = tileX * tw;
          const oy = tileY * th;
          for (const poly of tileData.shapes) {
            if (!poly.isValid()) continue;
            if (poly.oneWay) {
              if (!includeOneWay) continue;
              let platformY = -Infinity;
              for (const v of poly.vertices) {
                const wy = v[1] * runner.renderScale + oy;
                if (wy < platformY || platformY === -Infinity) platformY = wy;
              }
              if (previousBottom !== null && previousBottom > platformY + 0.5)
                continue;
            }
            if (
              checkSpritePolygonOffset(sprite, poly, ox, oy, runner.renderScale)
            ) {
              return true;
            }
          }
        }
      }
    }
  }
  const effective = world ?? runner.world;
  return effective !== null && effective.collidesWithBody(sprite) !== null;
}

export function angleFromNormal(normalX: number, normalY: number): number {
  const angle = (Math.atan2(-normalX, -normalY) * 180) / Math.PI;
  return angle === 0 ? 0 : angle;
}

export interface WalkableEdgeOptions {
  centroid?: Vec2;
  worldVerts?: Vec2[];
}

export function walkableEdgeInfoAtX(
  runner: CollisionRunner,
  poly: CollisionPolygon,
  ox: number,
  oy: number,
  worldX: number,
  edgeIndex: number,
  minUpness: number,
  options: WalkableEdgeOptions = {},
): [number, number, number] | null {
  const verts = poly.vertices;
  const n = verts.length;
  let v1x: number;
  let v1y: number;
  let v2x: number;
  let v2y: number;
  if (options.worldVerts === undefined) {
    const a = verts[edgeIndex];
    const b = verts[(edgeIndex + 1) % n];
    if (a === undefined || b === undefined) return null;
    v1x = a[0] * runner.renderScale + ox;
    v1y = a[1] * runner.renderScale + oy;
    v2x = b[0] * runner.renderScale + ox;
    v2y = b[1] * runner.renderScale + oy;
  } else {
    const a = options.worldVerts[edgeIndex];
    const b = options.worldVerts[(edgeIndex + 1) % n];
    if (a === undefined || b === undefined) return null;
    v1x = a[0];
    v1y = a[1];
    v2x = b[0];
    v2y = b[1];
  }

  const minX = Math.min(v1x, v2x);
  const maxX = Math.max(v1x, v2x);
  if (worldX < minX - 0.01 || worldX > maxX + 0.01) return null;

  const edgeX = v2x - v1x;
  const edgeY = v2y - v1y;
  const edgeLen = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
  if (edgeLen < 0.01) return null;
  if (Math.abs(edgeX) < 0.01) return null; // vertical faces are walls

  let normalX = -edgeY / edgeLen;
  let normalY = edgeX / edgeLen;

  let cx: number;
  let cy: number;
  if (options.centroid === undefined) {
    let sx = 0;
    let sy = 0;
    for (const v of verts) {
      sx += v[0];
      sy += v[1];
    }
    cx = (sx / n) * runner.renderScale + ox;
    cy = (sy / n) * runner.renderScale + oy;
  } else {
    cx = options.centroid[0];
    cy = options.centroid[1];
  }
  const midX = (v1x + v2x) * 0.5;
  const midY = (v1y + v2y) * 0.5;
  if (normalX * (cx - midX) + normalY * (cy - midY) > 0) {
    normalX = -normalX;
    normalY = -normalY;
  }

  if (-normalY < minUpness) return null;
  const t = (worldX - v1x) / edgeX;
  return [v1y + (v2y - v1y) * t, normalX, normalY];
}

export function walkableEdgeYAtX(
  runner: CollisionRunner,
  poly: CollisionPolygon,
  ox: number,
  oy: number,
  worldX: number,
  edgeIndex: number,
  minUpness: number,
): number | null {
  const info = walkableEdgeInfoAtX(
    runner,
    poly,
    ox,
    oy,
    worldX,
    edgeIndex,
    minUpness,
  );
  return info === null ? null : info[0];
}

export function findWalkableGroundInfo(
  runner: CollisionRunner,
  sprite: ICollidableSprite,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  maxUp: number,
  maxDown: number,
  includeOneWay = true,
  previousBottom: number | null = null,
  world: PhysicsWorld | null = null,
): GroundInfo | null {
  const [left, , right, bottom] = getSpriteBounds(sprite);
  const sampleXs = [left, (left + right) * 0.5, right];
  const tw = runner.effTw;
  const th = runner.effTh;
  const minTileX = Math.floor((left - 1.0) / tw) - 1;
  const maxTileX = Math.floor((right + 1.0) / tw) + 1;
  const minTileY = Math.floor((bottom - maxUp - th) / th) - 1;
  const maxTileY = Math.floor((bottom + maxDown + th) / th) + 1;
  const minUpness = Math.cos((runner.maxWalkAngle * Math.PI) / 180);

  let best: GroundInfo | null = null;
  if (tileMap !== null) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const cell = tileMap.get(tileKey(tileX, tileY));
        if (cell === undefined) continue;
        for (const tileData of iterTileDatas(
          world,
          tilesetCollision,
          cell,
          sprite,
        )) {
          const ox = tileX * tw;
          const oy = tileY * th;
          for (const poly of tileData.shapes) {
            if (!poly.isValid()) continue;
            if (poly.oneWay && !includeOneWay) continue;
            const verts = poly.vertices;
            const nVerts = verts.length;
            let csx = 0;
            let csy = 0;
            for (const v of verts) {
              csx += v[0];
              csy += v[1];
            }
            const cx = (csx / nVerts) * runner.renderScale + ox;
            const cy = (csy / nVerts) * runner.renderScale + oy;
            const worldVerts: Vec2[] = verts.map(
              (v) =>
                [
                  v[0] * runner.renderScale + ox,
                  v[1] * runner.renderScale + oy,
                ] as Vec2,
            );
            for (const sampleX of sampleXs) {
              for (let i = 0; i < verts.length; i += 1) {
                const edge = walkableEdgeInfoAtX(
                  runner,
                  poly,
                  ox,
                  oy,
                  sampleX,
                  i,
                  minUpness,
                  {
                    centroid: [cx, cy],
                    worldVerts,
                  },
                );
                if (edge === null) continue;
                const [groundY, nx, ny] = edge;
                if (
                  poly.oneWay &&
                  previousBottom !== null &&
                  previousBottom > groundY + 0.5
                ) {
                  continue;
                }
                if (
                  bottom - maxUp <= groundY &&
                  groundY <= bottom + maxDown &&
                  (best === null || groundY < best.y)
                ) {
                  best = {
                    y: groundY,
                    normal: [nx, ny],
                    angle: angleFromNormal(nx, ny),
                  };
                }
              }
            }
          }
        }
      }
    }
  }
  const effective = world ?? runner.world;
  if (effective !== null) {
    for (const body of effective.bodies) {
      if ((body as unknown) === (sprite as unknown)) continue;
      if (!shouldCollide(sprite, body)) continue;
      for (const sampleX of sampleXs) {
        const groundY = body.topYAt(sampleX);
        if (groundY === null) continue;
        if (!(bottom - maxUp <= groundY && groundY <= bottom + maxDown))
          continue;
        if (best === null || groundY < best.y) {
          best = { y: groundY, normal: [0.0, -1.0], angle: 0.0 };
        }
      }
    }
  }
  return best;
}

export function findWalkableGroundY(
  runner: CollisionRunner,
  sprite: ICollidableSprite,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  maxUp: number,
  maxDown: number,
  includeOneWay = true,
  previousBottom: number | null = null,
  world: PhysicsWorld | null = null,
): number | null {
  const info = findWalkableGroundInfo(
    runner,
    sprite,
    tilesetCollision,
    tileMap,
    maxUp,
    maxDown,
    includeOneWay,
    previousBottom,
    world,
  );
  return info === null ? null : info.y;
}
