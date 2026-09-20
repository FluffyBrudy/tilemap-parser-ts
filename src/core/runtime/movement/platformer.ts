import type { TilesetCollision } from "../../parser/collision.js";
import type { Vec2 } from "../../vec.js";
import { getSpriteBounds, checkSpritePolygonOffset } from "../polygon_query.js";
import type { ICollidableSprite } from "../protocols.js";
import type { PhysicsWorld, TileMap } from "../world.js";
import {
  collidesAtPlatformer,
  findWalkableGroundInfo,
  iterTileDatas,
} from "./queries.js";
import { tileKey } from "../../vec.js";
import type { CollisionRunner } from "./runner.js";
import {
  createCollisionResult,
  type CollisionResult,
  type GroundInfo,
} from "./types.js";

export interface PlatformerOptions {
  readonly inputX?: number;
  readonly jumpPressed?: boolean;

  readonly velocity?: Vec2 | null;
  readonly world?: PhysicsWorld | null;
}

function resolveSpace(
  runner: CollisionRunner,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  world: PhysicsWorld | null,
): {
  tilesetCollision: TilesetCollision | null;
  tileMap: TileMap | null;
  world: PhysicsWorld | null;
} {
  const effective = runner.resolveWorld(world);
  if (effective !== null) {
    return {
      tilesetCollision: effective.tilesetCollision,
      tileMap: effective.tileMap,
      world: effective,
    };
  }
  return { tilesetCollision, tileMap, world: null };
}

export function movePlatformer(
  runner: CollisionRunner,
  sprite: ICollidableSprite,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  dt: number,
  options: PlatformerOptions = {},
): CollisionResult {
  const space = resolveSpace(
    runner,
    tilesetCollision,
    tileMap,
    options.world ?? null,
  );
  tilesetCollision = space.tilesetCollision;
  tileMap = space.tileMap;
  const world = space.world;
  const result = createCollisionResult(sprite.x, sprite.y);

  const inputX = options.inputX ?? 0.0;
  const jumpPressed = options.jumpPressed ?? false;
  const velocity = options.velocity ?? null;

  if (velocity !== null) {
    sprite.vx = velocity[0];
    sprite.vy = velocity[1];
  } else {
    if (!(sprite.onGround ?? false)) {
      sprite.vy += runner.gravity * dt;
      sprite.vy = Math.min(sprite.vy, runner.maxFallSpeed);
    }
    if (jumpPressed && (sprite.onGround ?? false)) {
      sprite.vy = runner.jumpStrength;
    }
    sprite.vx = inputX * runner.horizontalSpeed;
  }

  const deltaX = sprite.vx * dt;
  const deltaY = sprite.vy * dt;
  const oldX = sprite.x;
  const oldY = sprite.y;
  const [, , , oldBottom] = getSpriteBounds(sprite);

  sprite.x = oldX + deltaX;
  sprite.y = oldY - runner.groundSnapTolerance;
  let steppedUp = false;
  if (
    collidesAtPlatformer(
      runner,
      sprite,
      tilesetCollision,
      tileMap,
      false,
      null,
      world,
    )
  ) {
    if (deltaX !== 0) {
      sprite.y = oldY - runner.groundSnapTolerance - runner.stepHeight;
      if (
        !collidesAtPlatformer(
          runner,
          sprite,
          tilesetCollision,
          tileMap,
          false,
          null,
          world,
        )
      ) {
        sprite.y = oldY - runner.stepHeight;
        steppedUp = true;
      } else {
        sprite.x = oldX;
        sprite.vx = 0.0;
        result.hitWallX = true;
      }
    } else {
      sprite.x = oldX;
      sprite.vx = 0.0;
      result.hitWallX = true;
    }
  }

  if (steppedUp) {
    sprite.y = sprite.y + deltaY;
  } else {
    sprite.y = oldY + deltaY;
  }
  let collidedY = false;

  const [left, top, right, bottom] = getSpriteBounds(sprite);
  const tw = runner.effTw;
  const th = runner.effTh;
  const minTileX = Math.floor(left / tw) - 1;
  const maxTileX = Math.floor(right / tw) + 1;
  const minTileY = Math.floor(top / th) - 1;
  const maxTileY = Math.floor(bottom / th) + 1;

  if (tileMap !== null) {
    outer: for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
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
            if (
              !checkSpritePolygonOffset(
                sprite,
                poly,
                ox,
                oy,
                runner.renderScale,
              )
            )
              continue;
            if (poly.oneWay && sprite.vy > 0) {
              let minVy = Infinity;
              for (const v of poly.vertices) {
                const wy = v[1] * runner.renderScale + oy;
                if (wy < minVy) minVy = wy;
              }
              if (oldY + (bottom - sprite.y) <= minVy) {
                collidedY = true;
                break;
              }
            } else if (!poly.oneWay) {
              collidedY = true;
              break;
            }
          }
          if (collidedY) break;
        }
        if (collidedY) break;
      }
      if (collidedY) break;
    }
  }

  if (!collidedY && world !== null && world.collidesWithBody(sprite) !== null) {
    collidedY = true;
  }

  if (collidedY) {
    if (steppedUp) {
      const stepY = oldY - runner.stepHeight;
      let lo = stepY;
      let hi = oldY;
      for (let i = 0; i < 8; i += 1) {
        const mid = (lo + hi) * 0.5;
        sprite.y = mid;
        if (
          collidesAtPlatformer(
            runner,
            sprite,
            tilesetCollision,
            tileMap,
            false,
            null,
            world,
          )
        ) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      sprite.y = lo;
      sprite.onGround = true;
      result.onGround = true;
    } else {
      sprite.y = oldY;
    }
    if (sprite.vy > 0) {
      const fallY = sprite.vy * dt;
      sprite.vy = 0.0;
      sprite.onGround = true;
      result.onGround = true;
      let lo = oldY;
      let hi = oldY + fallY;
      for (let i = 0; i < 8; i += 1) {
        const mid = (lo + hi) * 0.5;
        sprite.y = mid;
        if (
          collidesAtPlatformer(
            runner,
            sprite,
            tilesetCollision,
            tileMap,
            true,
            oldBottom,
            world,
          )
        ) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      sprite.y = lo;
    } else if (sprite.vy < 0) {
      sprite.vy = 0.0;
      sprite.onGround = false;
      result.hitCeiling = true;
    } else {
      sprite.onGround = true;
      result.onGround = true;
    }
  } else {
    sprite.onGround = false;
  }

  const downwardTravel = Math.max(0.0, sprite.vy) * dt;
  if (
    !sprite.onGround &&
    downwardTravel >= 0 &&
    downwardTravel <= runner.groundSnapTolerance
  ) {
    if (
      collidesAtPlatformer(
        runner,
        sprite,
        tilesetCollision,
        tileMap,
        true,
        oldBottom,
        world,
      )
    ) {
      const savedY = sprite.y;
      sprite.y = savedY - runner.groundSnapTolerance;
      if (
        !collidesAtPlatformer(
          runner,
          sprite,
          tilesetCollision,
          tileMap,
          true,
          oldBottom,
          world,
        )
      ) {
        let lo = sprite.y;
        let hi = savedY;
        for (let i = 0; i < 8; i += 1) {
          const mid = (lo + hi) * 0.5;
          sprite.y = mid;
          if (
            collidesAtPlatformer(
              runner,
              sprite,
              tilesetCollision,
              tileMap,
              true,
              oldBottom,
              world,
            )
          ) {
            hi = mid;
          } else {
            lo = mid;
          }
        }
        sprite.y = lo;
      } else {
        sprite.y = savedY;
      }
      sprite.onGround = true;
      result.onGround = true;
      sprite.vy = 0.0;
    } else {
      const savedY = sprite.y;
      sprite.y += runner.groundSnapTolerance;
      if (
        collidesAtPlatformer(
          runner,
          sprite,
          tilesetCollision,
          tileMap,
          true,
          oldBottom,
          world,
        )
      ) {
        let lo = savedY;
        let hi = sprite.y;
        for (let i = 0; i < 8; i += 1) {
          const mid = (lo + hi) * 0.5;
          sprite.y = mid;
          if (
            collidesAtPlatformer(
              runner,
              sprite,
              tilesetCollision,
              tileMap,
              true,
              oldBottom,
              world,
            )
          ) {
            hi = mid;
          } else {
            lo = mid;
          }
        }
        sprite.y = lo;
        sprite.onGround = true;
        result.onGround = true;
        sprite.vy = 0.0;
      } else {
        sprite.y = savedY;
      }
    }
  }

  result.finalX = sprite.x;
  result.finalY = sprite.y;
  result.collided = result.hitWallX || collidedY;
  return result;
}

export function movePlatformerWithSlide(
  runner: CollisionRunner,
  sprite: ICollidableSprite,
  tilesetCollision: TilesetCollision | null,
  tileMap: TileMap | null,
  dt: number,
  options: PlatformerOptions = {},
): CollisionResult {
  const space = resolveSpace(
    runner,
    tilesetCollision,
    tileMap,
    options.world ?? null,
  );
  tilesetCollision = space.tilesetCollision;
  tileMap = space.tileMap;
  const world = space.world;
  const result = createCollisionResult(sprite.x, sprite.y);

  const inputX = options.inputX ?? 0.0;
  const jumpPressed = options.jumpPressed ?? false;
  const velocity = options.velocity ?? null;

  const skin = 0.01;
  let supportInfo: GroundInfo | null = null;
  const oldX = sprite.x;
  const oldY = sprite.y;
  const [, , , oldBottom] = getSpriteBounds(sprite);
  const wasOnGround = sprite.onGround ?? false;
  let jumped = false;

  if (velocity !== null) {
    sprite.vx = velocity[0];
    sprite.vy = velocity[1];
    if (sprite.vy < 0.0) {
      sprite.onGround = false;
      jumped = true;
    }
  } else {
    if (jumpPressed && wasOnGround) {
      sprite.vy = runner.jumpStrength;
      sprite.onGround = false;
      jumped = true;
    } else if (!wasOnGround) {
      sprite.vy += runner.gravity * dt;
      sprite.vy = Math.min(sprite.vy, runner.maxFallSpeed);
    } else {
      sprite.vy = Math.min(sprite.vy, 0.0);
    }
    sprite.vx = inputX * runner.horizontalSpeed;
  }
  const deltaX = sprite.vx * dt;
  const deltaY = sprite.vy * dt;
  const bottomOffset = oldBottom - oldY;

  const slopeFollow =
    Math.abs(deltaX) * Math.tan((runner.maxWalkAngle * Math.PI) / 180);
  const maxGroundUp = Math.max(runner.stepHeight, slopeFollow + skin);
  const maxGroundDown = Math.max(
    runner.groundSnapTolerance,
    slopeFollow + skin,
  );

  if (deltaX !== 0.0) {
    sprite.x = oldX + deltaX;
    sprite.y = oldY;

    let followedGround = false;
    if (wasOnGround && !jumped) {
      const groundInfo = findWalkableGroundInfo(
        runner,
        sprite,
        tilesetCollision,
        tileMap,
        maxGroundUp,
        maxGroundDown,
        true,
        oldBottom,
        world,
      );
      if (groundInfo !== null) {
        sprite.y = groundInfo.y - bottomOffset - skin;
        followedGround = true;
        supportInfo = groundInfo;
      }
    }

    if (
      collidesAtPlatformer(
        runner,
        sprite,
        tilesetCollision,
        tileMap,
        false,
        null,
        world,
      )
    ) {
      sprite.x = oldX + deltaX;
      sprite.y = oldY - runner.stepHeight;
      const stepInfo = findWalkableGroundInfo(
        runner,
        sprite,
        tilesetCollision,
        tileMap,
        runner.stepHeight + skin,
        runner.stepHeight + skin,
        false,
        oldBottom,
        world,
      );
      const stepGroundY = stepInfo === null ? null : stepInfo.y;
      if (stepGroundY !== null) {
        sprite.y = stepGroundY - bottomOffset - skin;
      }
      if (
        stepGroundY === null ||
        collidesAtPlatformer(
          runner,
          sprite,
          tilesetCollision,
          tileMap,
          false,
          null,
          world,
        )
      ) {
        sprite.x = oldX;
        sprite.y = oldY;
        sprite.vx = 0.0;
        result.collided = true;
        result.hitWallX = true;
        supportInfo = null;
      } else {
        followedGround = true;
        supportInfo = stepInfo;
      }
    }

    if (followedGround) {
      sprite.onGround = true;
      result.onGround = true;
    }
  } else {
    sprite.x = oldX;
    sprite.y = oldY;
  }

  const yBeforeVertical = sprite.y;
  const [, , , previousBottom] = getSpriteBounds(sprite);

  if (jumped || sprite.vy < 0.0) {
    sprite.y = yBeforeVertical + deltaY;
    supportInfo = null;
    if (
      collidesAtPlatformer(
        runner,
        sprite,
        tilesetCollision,
        tileMap,
        false,
        null,
        world,
      )
    ) {
      let lo = yBeforeVertical + deltaY;
      let hi = yBeforeVertical;
      for (let i = 0; i < 10; i += 1) {
        const mid = (lo + hi) * 0.5;
        sprite.y = mid;
        if (
          collidesAtPlatformer(
            runner,
            sprite,
            tilesetCollision,
            tileMap,
            false,
            null,
            world,
          )
        ) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      sprite.y = hi;
      sprite.vy = 0.0;
      sprite.onGround = false;
      result.collided = true;
      result.hitCeiling = true;
    } else {
      sprite.onGround = false;
    }
  } else if (sprite.vy > 0.0) {
    sprite.y = yBeforeVertical + deltaY;
    const fallInfo = findWalkableGroundInfo(
      runner,
      sprite,
      tilesetCollision,
      tileMap,
      Math.abs(deltaY) + maxGroundUp,
      skin,
      true,
      previousBottom,
      world,
    );
    if (fallInfo !== null) {
      sprite.y = fallInfo.y - bottomOffset - skin;
      sprite.vy = 0.0;
      sprite.onGround = true;
      result.onGround = true;
      result.collided = true;
      result.hitWallY = true;
      supportInfo = fallInfo;
    } else if (
      collidesAtPlatformer(
        runner,
        sprite,
        tilesetCollision,
        tileMap,
        true,
        previousBottom,
        world,
      )
    ) {
      let lo = yBeforeVertical;
      let hi = yBeforeVertical + deltaY;
      for (let i = 0; i < 10; i += 1) {
        const mid = (lo + hi) * 0.5;
        sprite.y = mid;
        if (
          collidesAtPlatformer(
            runner,
            sprite,
            tilesetCollision,
            tileMap,
            true,
            previousBottom,
            world,
          )
        ) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      sprite.y = lo;
      sprite.vy = 0.0;
      sprite.onGround = true;
      result.onGround = true;
      result.collided = true;
      result.hitWallY = true;
      supportInfo = null;
    } else {
      sprite.onGround = false;
      supportInfo = null;
    }
  } else if (!jumped) {
    const snapInfo = findWalkableGroundInfo(
      runner,
      sprite,
      tilesetCollision,
      tileMap,
      maxGroundUp,
      maxGroundDown,
      true,
      previousBottom,
      world,
    );
    if (snapInfo !== null) {
      sprite.y = snapInfo.y - bottomOffset - skin;
      sprite.vy = 0.0;
      sprite.onGround = true;
      result.onGround = true;
      supportInfo = snapInfo;
    } else {
      sprite.onGround = false;
      supportInfo = null;
    }
  }

  result.finalX = sprite.x;
  result.finalY = sprite.y;
  result.onGround = sprite.onGround ?? false;
  if (result.onGround && supportInfo !== null) {
    result.groundAngle = supportInfo.angle;
    result.groundNormal = supportInfo.normal;
  } else {
    result.groundAngle = null;
    result.groundNormal = null;
  }
  return result;
}
