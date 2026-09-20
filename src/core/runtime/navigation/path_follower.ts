import type { TilesetCollision } from "../../parser/collision.js";
import type { Vec2 } from "../../vec.js";
import type { ICollidable } from "../protocols.js";
import type { CollisionRunner } from "../movement/runner.js";
import type { TileMap } from "../world.js";

export interface FollowResult {
  readonly waypointIndex: number;
  readonly done: boolean;
  readonly hitWallX: boolean;
  readonly hitWallY: boolean;
}

export class PathFollower {
  readonly arrivalDistance: number;
  private readonly effTw: number;
  private readonly effTh: number;

  constructor(effectiveTileSize: Vec2, arrivalDistance: number | null = null) {
    this.effTw = effectiveTileSize[0];
    this.effTh = effectiveTileSize[1];
    this.arrivalDistance =
      arrivalDistance ?? Math.hypot(this.effTw, this.effTh) * 0.2;
  }

  updateRpg(
    sprite: ICollidable,
    path: readonly Vec2[],
    waypointIndex: number,
    runner: CollisionRunner,
    tilesetCollision: TilesetCollision | null,
    tileMap: TileMap | null,
    speed = 200.0,
    dt = 0.016,
  ): FollowResult {
    if (path.length === 0 || waypointIndex >= path.length) {
      return { waypointIndex, done: true, hitWallX: false, hitWallY: false };
    }

    while (waypointIndex < path.length) {
      const wp = path[waypointIndex];
      if (wp === undefined) break;
      const tx = wp[0] * this.effTw + this.effTw * 0.5;
      const ty = wp[1] * this.effTh + this.effTh * 0.5;
      if (Math.hypot(tx - sprite.x, ty - sprite.y) < this.arrivalDistance) {
        waypointIndex += 1;
      } else {
        break;
      }
    }
    if (waypointIndex >= path.length) {
      return { waypointIndex, done: true, hitWallX: false, hitWallY: false };
    }

    const wp = path[waypointIndex];
    if (wp === undefined) {
      return { waypointIndex, done: true, hitWallX: false, hitWallY: false };
    }
    const tx = wp[0] * this.effTw + this.effTw * 0.5;
    const ty = wp[1] * this.effTh + this.effTh * 0.5;
    const dx = tx - sprite.x;
    const dy = ty - sprite.y;
    const dist = Math.hypot(dx, dy);
    let deltaX = 0.0;
    let deltaY = 0.0;
    if (dist >= 0.01) {
      const step = Math.min(speed * dt, dist);
      deltaX = (dx / dist) * step;
      deltaY = (dy / dist) * step;
    }

    const result = runner.moveRpg(
      sprite,
      tilesetCollision,
      tileMap,
      deltaX,
      deltaY,
    );
    if (Math.hypot(tx - sprite.x, ty - sprite.y) < this.arrivalDistance) {
      waypointIndex += 1;
    }
    return {
      waypointIndex,
      done: waypointIndex >= path.length,
      hitWallX: result.hitWallX,
      hitWallY: result.hitWallY,
    };
  }
}
