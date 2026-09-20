import type { TilesetCollision } from "../../parser/collision.js";
import type { Vec2 } from "../../vec.js";
import type { ICollidableSprite } from "../protocols.js";
import type { PhysicsWorld, TileMap } from "../world.js";
import { collidesAt } from "./queries.js";
import type { CollisionRunner } from "./runner.js";
import { createCollisionResult, type CollisionResult } from "./types.js";

export interface GroundedOptions {
  readonly velocity?: Vec2 | null;
  readonly world?: PhysicsWorld | null;
}

export function moveGrounded(
  runner: CollisionRunner,
  sprite: ICollidableSprite,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  dt: number,
  options: GroundedOptions = {},
): CollisionResult {
  const world = runner.resolveWorld(options.world ?? null);
  if (world !== null) {
    tilesetCollision = world.tilesetCollision;
    tileMap = world.tileMap;
  }
  const result = createCollisionResult(sprite.x, sprite.y);

  const oldX = sprite.x;
  const oldY = sprite.y;
  const wasOnGround = sprite.onGround ?? false;
  const velocity = options.velocity ?? null;

  if (velocity !== null) {
    sprite.vx = velocity[0];
    sprite.vy = velocity[1];
  } else if (!wasOnGround) {
    sprite.vy += runner.gravity * dt;
    sprite.vy = Math.min(sprite.vy, runner.maxFallSpeed);
  }

  const deltaX = sprite.vx * dt;
  let deltaY = sprite.vy * dt;

  if (deltaX !== 0.0) {
    sprite.x = oldX + deltaX;
    sprite.y = oldY;
    if (collidesAt(runner, sprite, tilesetCollision, tileMap, 1, world)) {
      sprite.x = oldX;
      sprite.vx = 0.0;
      result.hitWallX = true;
      result.collided = true;
    }
  }

  if (velocity === null && wasOnGround && deltaY === 0.0) {
    const savedY = sprite.y;
    sprite.y += 1.0;
    const groundBelow = collidesAt(
      runner,
      sprite,
      tilesetCollision,
      tileMap,
      1,
      world,
    );
    sprite.y = savedY;
    if (!groundBelow) {
      sprite.onGround = false;
      sprite.vy += runner.gravity * dt;
      sprite.vy = Math.min(sprite.vy, runner.maxFallSpeed);
      deltaY = sprite.vy * dt;
    }
  }

  sprite.y = sprite.y + deltaY;
  const collidedY = collidesAt(
    runner,
    sprite,
    tilesetCollision,
    tileMap,
    1,
    world,
  );

  if (collidedY) {
    result.collided = true;
    if (deltaY >= 0.0) {
      sprite.y = oldY;
      let lo = oldY;
      let hi = oldY + deltaY;
      for (let i = 0; i < 8; i += 1) {
        const mid = (lo + hi) * 0.5;
        sprite.y = mid;
        if (collidesAt(runner, sprite, tilesetCollision, tileMap, 1, world)) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      sprite.y = lo;
      sprite.vy = 0.0;
      sprite.onGround = true;
      result.hitWallY = true;
      result.onGround = true;
    } else {
      sprite.y = oldY;
      let lo = oldY + deltaY;
      let hi = oldY;
      for (let i = 0; i < 8; i += 1) {
        const mid = (lo + hi) * 0.5;
        sprite.y = mid;
        if (collidesAt(runner, sprite, tilesetCollision, tileMap, 1, world)) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      sprite.y = hi;
      sprite.vy = 0.0;
      result.hitCeiling = true;
    }
  } else if (deltaY > 0.0) {
    sprite.onGround = false;
  }

  result.finalX = sprite.x;
  result.finalY = sprite.y;
  result.onGround = sprite.onGround ?? false;
  return result;
}
