import type { TilesetCollision } from "../../parser/collision.js";
import type { ICollidable } from "../protocols.js";
import type { PhysicsWorld, TileMap } from "../world.js";
import { collidesAt } from "./queries.js";
import type { CollisionRunner } from "./runner.js";
import { createCollisionResult, type CollisionResult } from "./types.js";

export interface RpgOptions {
  readonly world?: PhysicsWorld | null;
}

export function moveRpg(
  runner: CollisionRunner,
  sprite: ICollidable,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  deltaX: number,
  deltaY: number,
  options: RpgOptions = {},
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
  sprite.x = oldX + deltaX;
  sprite.y = oldY + deltaY;

  if (collidesAt(runner, sprite, tilesetCollision, tileMap, 1, world)) {
    sprite.x = oldX;
    sprite.y = oldY;
    result.collided = true;

    let xBlocked = false;
    let yBlocked = false;
    if (deltaX !== 0) {
      sprite.x = oldX + deltaX;
      sprite.y = oldY;
      xBlocked = collidesAt(
        runner,
        sprite,
        tilesetCollision,
        tileMap,
        1,
        world,
      );
    }
    if (deltaY !== 0) {
      sprite.x = oldX;
      sprite.y = oldY + deltaY;
      yBlocked = collidesAt(
        runner,
        sprite,
        tilesetCollision,
        tileMap,
        1,
        world,
      );
    }
    sprite.x = oldX;
    sprite.y = oldY;

    if (!xBlocked && !yBlocked) {
      xBlocked = deltaX !== 0;
      yBlocked = deltaY !== 0;
    }
    result.hitWallX = xBlocked;
    result.hitWallY = yBlocked;
  } else {
    result.finalX = sprite.x;
    result.finalY = sprite.y;
  }
  return result;
}
