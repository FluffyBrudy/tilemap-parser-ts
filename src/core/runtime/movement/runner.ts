import { CollisionPolygon, TilesetCollision } from "../../parser/collision.js";
import type { Vec2 } from "../../vec.js";
import { tileKey } from "../../vec.js";
import { getSpriteBounds } from "../polygon_query.js";
import type { ICollidable, ICollidableSprite } from "../protocols.js";
import { PhysicsWorld, type TileMap } from "../world.js";
import { moveGrounded, type GroundedOptions } from "./grounded.js";
import {
  movePlatformer,
  movePlatformerWithSlide,
  type PlatformerOptions,
} from "./platformer.js";
import { collidesAt, iterTileDatas } from "./queries.js";
import { moveRpg, type RpgOptions } from "./rpg.js";
import { moveAndSlide, type SlideOptions } from "./slide.js";
import {
  createCollisionResult,
  type CollisionResult,
  type MovementMode,
} from "./types.js";

export type GameType = "platformer" | "topdown" | "rpg";

export class CollisionRunner {
  tileSize: Vec2;
  mode: MovementMode;
  renderScale: number;
  effTw: number;
  effTh: number;

  gravity = 800.0;
  maxFallSpeed = 600.0;
  jumpStrength = -400.0;
  horizontalSpeed = 200.0;

  groundSnapTolerance = 2.0;
  stepHeight = 4.0;
  maxWalkAngle = 60.0;
  slideFriction = 0.1;
  rpgSnapToGrid = false;

  world: PhysicsWorld | null = null;
  private gameType: string | null = null;
  private strict = false;

  constructor(
    tileSize: Vec2 = [32, 32],
    mode: MovementMode = "slide",
    renderScale = 1.0,
  ) {
    if (renderScale <= 0) {
      throw new RangeError(`render_scale must be positive, got ${renderScale}`);
    }
    this.tileSize = tileSize;
    this.mode = mode;
    this.renderScale = renderScale;
    this.effTw = Math.max(1, Math.trunc(tileSize[0] * renderScale));
    this.effTh = Math.max(1, Math.trunc(tileSize[1] * renderScale));
  }

  attach(world: PhysicsWorld | null): void {
    this.world = world;
    if (world !== null) {
      this.tileSize = [world.tileSize[0], world.tileSize[1]];
      this.renderScale = world.renderScale;
      this.effTw = Math.max(1, Math.trunc(this.tileSize[0] * this.renderScale));
      this.effTh = Math.max(1, Math.trunc(this.tileSize[1] * this.renderScale));
    }
  }

  detach(): void {
    this.world = null;
  }

  resolveWorld(world: PhysicsWorld | null): PhysicsWorld | null {
    return world === null ? this.world : world;
  }

  static fromWorld(
    world: PhysicsWorld,
    gameType: GameType = "platformer",
    strict = false,
  ): CollisionRunner {
    const runner = CollisionRunner.fromGameType(
      gameType,
      world.tileSize,
      strict,
      world.renderScale,
    );
    runner.attach(world);
    return runner;
  }

  getTileAt(worldX: number, worldY: number): [number, number] {
    return [Math.floor(worldX / this.effTw), Math.floor(worldY / this.effTh)];
  }

  getTileShapes(
    tilesetCollision: TilesetCollision,
    tileMap: TileMap,
    worldX: number,
    worldY: number,
  ): CollisionPolygon[] {
    const [tileX, tileY] = this.getTileAt(worldX, worldY);
    const cell = tileMap.get(tileKey(tileX, tileY));
    const shapes: CollisionPolygon[] = [];
    for (const tileData of iterTileDatas(this.world, tilesetCollision, cell)) {
      const tileWorldX = tileX * this.effTw;
      const tileWorldY = tileY * this.effTh;
      for (const shape of tileData.shapes) {
        if (shape.isValid()) {
          shapes.push(
            shape.transform(tileWorldX, tileWorldY, this.renderScale),
          );
        }
      }
    }
    return shapes;
  }

  getNearbyTileShapes(
    tilesetCollision: TilesetCollision,
    tileMap: TileMap,
    sprite: ICollidable,
    margin = 1,
  ): CollisionPolygon[] {
    const [left, top, right, bottom] = getSpriteBounds(sprite);
    const tw = this.effTw;
    const th = this.effTh;
    const minTileX = Math.floor(left / tw) - margin;
    const maxTileX = Math.floor(right / tw) + margin;
    const minTileY = Math.floor(top / th) - margin;
    const maxTileY = Math.floor(bottom / th) + margin;
    const shapes: CollisionPolygon[] = [];
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const cell = tileMap.get(tileKey(tileX, tileY));
        if (cell === undefined) continue;
        for (const tileData of iterTileDatas(
          this.world,
          tilesetCollision,
          cell,
        )) {
          const tileWorldX = tileX * tw;
          const tileWorldY = tileY * th;
          for (const poly of tileData.shapes) {
            if (poly.isValid()) {
              shapes.push(
                poly.transform(tileWorldX, tileWorldY, this.renderScale),
              );
            }
          }
        }
      }
    }
    return shapes;
  }

  moveAndSlide(
    sprite: ICollidable,
    tilesetCollision: TilesetCollision | null = null,
    tileMap: TileMap | null = null,
    deltaX = 0.0,
    deltaY = 0.0,
    options: SlideOptions = {},
  ): CollisionResult {
    return moveAndSlide(
      this,
      sprite,
      tilesetCollision,
      tileMap,
      deltaX,
      deltaY,
      options,
    );
  }

  moveGrounded(
    sprite: ICollidableSprite,
    tilesetCollision: TilesetCollision | null = null,
    tileMap: TileMap | null = null,
    dt = 0.016,
    options: GroundedOptions = {},
  ): CollisionResult {
    return moveGrounded(this, sprite, tilesetCollision, tileMap, dt, options);
  }

  movePlatformer(
    sprite: ICollidableSprite,
    tilesetCollision: TilesetCollision | null = null,
    tileMap: TileMap | null = null,
    dt = 0.016,
    options: PlatformerOptions = {},
  ): CollisionResult {
    return movePlatformer(this, sprite, tilesetCollision, tileMap, dt, options);
  }

  movePlatformerWithSlide(
    sprite: ICollidableSprite,
    tilesetCollision: TilesetCollision | null = null,
    tileMap: TileMap | null = null,
    dt = 0.016,
    options: PlatformerOptions = {},
  ): CollisionResult {
    return movePlatformerWithSlide(
      this,
      sprite,
      tilesetCollision,
      tileMap,
      dt,
      options,
    );
  }

  moveRpg(
    sprite: ICollidable,
    tilesetCollision: TilesetCollision | null = null,
    tileMap: TileMap | null = null,
    deltaX = 0.0,
    deltaY = 0.0,
    options: RpgOptions = {},
  ): CollisionResult {
    return moveRpg(
      this,
      sprite,
      tilesetCollision,
      tileMap,
      deltaX,
      deltaY,
      options,
    );
  }

  move(
    sprite: ICollidableSprite,
    tilesetCollision: TilesetCollision | null = null,
    tileMap: TileMap | null = null,
    deltaX = 0.0,
    deltaY = 0.0,
    dt = 0.016,
    options: SlideOptions &
      PlatformerOptions &
      GroundedOptions &
      RpgOptions & {
        inputX?: number;
        jumpPressed?: boolean;
        velocity?: Vec2 | null;
        slopeSlide?: boolean;
      } = {},
  ): CollisionResult {
    switch (this.mode) {
      case "slide":
        return this.moveAndSlide(
          sprite,
          tilesetCollision,
          tileMap,
          deltaX,
          deltaY,
          options,
        );
      case "platformer":
        return this.movePlatformer(
          sprite,
          tilesetCollision,
          tileMap,
          dt,
          options,
        );
      case "grounded":
        return this.moveGrounded(
          sprite,
          tilesetCollision,
          tileMap,
          dt,
          options,
        );
      case "rpg":
        return this.moveRpg(
          sprite,
          tilesetCollision,
          tileMap,
          deltaX,
          deltaY,
          options,
        );
    }
  }

  collidesAt(
    sprite: ICollidable,
    tilesetCollision: TilesetCollision | null,
    tileMap: TileMap | null,
  ): boolean {
    return collidesAt(this, sprite, tilesetCollision, tileMap, 1, this.world);
  }

  static fromGameType(
    gameType: string,
    tileSize: Vec2 = [32, 32],
    strict = false,
    renderScale = 1.0,
  ): CollisionRunner {
    const normalized = gameType.toLowerCase();
    let runner: CollisionRunner;
    if (normalized === "platformer") {
      runner = new CollisionRunner(tileSize, "platformer", renderScale);
      runner.gravity = 800.0;
      runner.maxFallSpeed = 600.0;
      runner.jumpStrength = -400.0;
      runner.horizontalSpeed = 200.0;
      runner.slideFriction = 0.1;
      runner.gameType = "platformer";
      runner.strict = strict;
    } else if (normalized === "topdown") {
      runner = new CollisionRunner(tileSize, "slide", renderScale);
      runner.gravity = 0.0;
      runner.maxFallSpeed = 0.0;
      runner.jumpStrength = 0.0;
      runner.slideFriction = 0.1;
      runner.gameType = "topdown";
      runner.strict = strict;
    } else if (normalized === "rpg") {
      runner = new CollisionRunner(tileSize, "rpg", renderScale);
      runner.gravity = 0.0;
      runner.maxFallSpeed = 0.0;
      runner.jumpStrength = 0.0;
      runner.slideFriction = 0.0;
      runner.rpgSnapToGrid = false;
      runner.gameType = "rpg";
      runner.strict = strict;
    } else {
      throw new RangeError(
        `Unknown game_type: '${gameType}'. Valid options are: 'platformer', 'topdown', 'rpg'`,
      );
    }
    runner.validateConfig();
    return runner;
  }

  validateConfig(strict: boolean | null = null): void {
    const useStrict = strict ?? this.strict;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (this.gravity < 0)
      errors.push("gravity must be >= 0 (negative gravity not supported)");
    if (this.maxFallSpeed < 0) errors.push("max_fall_speed must be >= 0");
    if (this.jumpStrength > 0) {
      warnings.push(
        "jump_strength is positive (upward force should be negative). Did you mean a negative value?",
      );
    }
    if (this.slideFriction < 0.0 || this.slideFriction > 1.0) {
      warnings.push(
        `slide_friction=${this.slideFriction} is outside typical range [0.0, 1.0]`,
      );
    }

    if (this.mode === "platformer") {
      if (this.gravity === 0) {
        errors.push(
          "PLATFORMER mode requires gravity > 0 for jumping mechanics.\n" +
            "  Fix: Set runner.gravity = 800.0 (or another positive value)\n" +
            "  Or: Use game_type='topdown' or 'rpg' instead",
        );
      }
      if (this.maxFallSpeed === 0 && this.gravity > 0) {
        warnings.push(
          "PLATFORMER mode with gravity > 0 but max_fall_speed = 0. Falling speed will be unlimited.",
        );
      }
    } else if (this.mode === "slide") {
      if (this.gravity > 0) {
        warnings.push(
          `SLIDE mode (top-down) typically uses gravity = 0. Current gravity = ${this.gravity} will be ignored in move_and_slide().`,
        );
      }
    } else if (this.mode === "rpg") {
      if (this.gravity > 0) {
        errors.push(
          "RPG mode should not use gravity (set gravity = 0).\n" +
            "  Fix: Set runner.gravity = 0.0\n" +
            "  Or: Use game_type='platformer' if you need gravity",
        );
      }
    }

    if (errors.length > 0) {
      throw new RangeError(
        `Configuration validation failed:\n\n${errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`,
      );
    }
    if (warnings.length > 0) {
      const message = `Configuration warnings detected:\n\n${warnings.map((w, i) => `${i + 1}. ${w}`).join("\n")}`;
      if (useStrict) throw new RangeError(message);
      else console.warn(message);
    }
  }
}
