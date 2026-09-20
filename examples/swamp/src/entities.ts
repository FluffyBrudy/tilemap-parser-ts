import Phaser from "phaser";
import {
  CollisionRunner,
  flipCharacterShape,
  getShapeAabb,
  type CharacterCollision,
  type CollisionHit,
  type CollisionResult,
  type SpriteShape,
} from "tilemap-parser-ts/core";
import {
  wrapGameObject,
  type WrappedGameObject,
} from "tilemap-parser-ts/phaser";
import { midbottomToOrigin, moveTowards } from "./math.js";
import type { SharedAssets } from "./assets.js";

export type SpawnFn = (obj: Entity) => void;

export interface Entity {
  update(dt: number): void;
  readonly isDead: boolean;
}

export interface Hittable extends Entity {
  onObjectHit(hit: CollisionHit): void;
}

function isHittable(obj: Entity): obj is Hittable {
  return (
    "onObjectHit" in obj && typeof (obj as Hittable).onObjectHit === "function"
  );
}

export { isHittable };

export class Character implements Entity {
  static runner: CollisionRunner | null = null;

  name: string;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  onGround = false;
  flipped = false;
  isDead = false;
  currentState: string;
  readonly body: WrappedGameObject;
  readonly sprite: Phaser.GameObjects.Sprite;
  protected readonly assets: SharedAssets;
  protected readonly stateKey: string;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    collision: CharacterCollision,
    assets: SharedAssets,
    stateKey: string,
    depth = 20,
  ) {
    const runner = Character.runner;
    if (runner === null) throw new Error("collision runner is not initialized");
    this.assets = assets;
    this.stateKey = stateKey;
    this.name = collision.name;
    const shape = collision.shape as SpriteShape;
    const [ox, oy] = midbottomToOrigin(x, y, shape);
    this.x = ox;
    this.y = oy;
    this.body = wrapGameObject(
      this,
      shape,
      collision.collisionLayer,
      collision.collisionMask,
    );

    const sheetKey = assets.sheetKey.get(stateKey);
    if (sheetKey === undefined)
      throw new Error(`missing sheet key: ${stateKey}`);
    const rs = runner.renderScale;
    this.sprite = scene.add
      .sprite(ox, oy, sheetKey)
      .setOrigin(0, 0)
      .setScale(rs)
      .setDepth(depth);
    const lib = assets.anims.get(stateKey);
    const first = lib !== undefined ? [...lib.animations.keys()][0] : undefined;
    this.currentState = first ?? "idle";
    void runner;
  }

  get collisionShape(): SpriteShape {
    return this.body.collisionShape as SpriteShape;
  }

  get collisionLayer(): number {
    return this.body.collisionLayer;
  }

  get collisionMask(): number {
    return this.body.collisionMask;
  }

  setState(name: string): void {
    if (this.currentState === name) return;
    this.currentState = name;
    this.sprite.play(`${this.stateKey}:${name}`);
  }

  tickAnimation(): void {
    if (!this.sprite.anims.isPlaying) {
      this.sprite.play(`${this.stateKey}:${this.currentState}`);
    }
  }

  syncSprite(): void {
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setFlipX(this.flipped);
  }

  applyFacing(frameW: number, frameH: number): void {
    const shape = this.flipped
      ? (flipCharacterShape(this.body.collisionShape, [frameW, frameH], {
          flipH: true,
        }) as SpriteShape)
      : (this.body.collisionShape as SpriteShape);
    const [l, , r, b] = getShapeAabb(this.x, this.y, this.body.collisionShape);
    this.body.collisionShape = shape;
    const [nx, ny] = midbottomToOrigin((l + r) * 0.5, b, shape);
    this.x = nx;
    this.y = ny;
    this.body.x = nx;
    this.body.y = ny;
  }

  update(_dt: number): void {
    this.syncSprite();
  }
}

export const PLAYER_GRAVITY = 800;
export const MAX_FALL_SPEED = 1600;
export const HORIZONTAL_SPEED = 320;
export const JUMP_STRENGTH = -550;

const STATE_MODIFIERS: Record<string, { vxMult: number; vyMult: number }> = {
  idle: { vxMult: 1.0, vyMult: 1.0 },
  run: { vxMult: 1.0, vyMult: 1.0 },
  jump: { vxMult: 1.0, vyMult: 1.0 },
  fall: { vxMult: 0.5, vyMult: 1.03 },
  crouch: { vxMult: 0.0, vyMult: 0.0 },
  shoot: { vxMult: 0.0, vyMult: 0.0 },
  hurt: { vxMult: 1.0, vyMult: 1 },
};

const VISUAL_ADJUSTMENT: Record<string, [number, number]> = {
  shoot: [25, -12],
  crouch: [25, -2.5],
  jump: [25, -14],
  fall: [25, -7],
};

export class Player extends Character {
  inputX = 0;
  downPressed = false;
  shootPressed = true;
  jumpPressed = false;
  bulletCd = Bullet.BULLET_DEFAULT_CD;
  vulnerableTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, assets: SharedAssets) {
    const collision = assets.collisions.get("player");
    if (collision === undefined) throw new Error("player collision not found");
    super(scene, x, y, collision, assets, "player");
    this.name = "player";
    this.setState("idle");
  }

  get isVulnerable(): boolean {
    return this.vulnerableTime > 0.01;
  }

  makeVulnerable(): void {
    if (this.vulnerableTime > 0.01) return;
    this.vulnerableTime = 3.0;
  }

  knockback(direction: number): void {
    this.vx = Math.abs(JUMP_STRENGTH) * 1.5 * direction;
    this.vy = JUMP_STRENGTH;
    this.flipped = direction === 1;
  }

  update(dt: number, spawn?: SpawnFn, keys?: Record<string, boolean>): void {
    this.jumpPressed = false;
    if (keys !== undefined) {
      this.inputX =
        (keys["right"] === true ? 1 : 0) - (keys["left"] === true ? 1 : 0);
      this.jumpPressed = this.onGround && keys["up"] === true;
      this.downPressed = keys["down"] === true;
      this.shootPressed = keys["space"] === true;
      if (this.inputX !== 0) {
        const flipped = this.inputX === -1;
        if (flipped !== this.flipped) {
          this.flipped = flipped;
          this.applyFacing(
            this.sprite.width * this.sprite.scaleX,
            this.sprite.height * this.sprite.scaleY,
          );
        }
      }
      if (this.jumpPressed && this.onGround) {
        this.vy = JUMP_STRENGTH;
      }
    }
    const mod = STATE_MODIFIERS[this.currentState] ?? { vxMult: 1, vyMult: 1 };
    this.vy =
      Math.min(this.vy + PLAYER_GRAVITY * dt, MAX_FALL_SPEED) * mod.vyMult;
    const target = this.inputX * HORIZONTAL_SPEED;
    this.vx = moveTowards(this.vx, target, dt * 1000) * mod.vxMult;
    this.inputX *= mod.vxMult;

    const runner = Character.runner;
    if (runner === null) throw new Error("collision runner is not initialized");
    runner.movePlatformer(this.body, null, null, dt, {
      velocity: [this.vx, this.vy],
    });
    this.x = this.body.x;
    this.y = this.body.y;
    this.onGround = this.body.onGround;
    this.tickAnimation();
    this.setState(this.computeState());

    if (this.vulnerableTime !== 0) {
      this.vulnerableTime = Math.max(this.vulnerableTime - dt, 0);
    }
    if (this.bulletCd !== 0) {
      this.bulletCd = Math.max(this.bulletCd - dt, 0);
    } else if (
      (this.currentState === "shoot" ||
        ((this.currentState === "crouch" ||
          this.currentState === "jump" ||
          this.currentState === "fall") &&
          this.shootPressed)) &&
      spawn !== undefined
    ) {
      const [, t, r, b] = getShapeAabb(
        this.x,
        this.y,
        this.body.collisionShape,
      );
      const rs = runner.renderScale;
      const [vx, vy] = VISUAL_ADJUSTMENT[this.currentState] ?? [0, 0];
      const direction = this.flipped ? -1 : 1;
      spawn(
        new Bullet(
          r + direction * vx * rs,
          (t + b) * 0.5 + vy * rs,
          direction,
          this.sceneOf(),
        ),
      );
      this.bulletCd = Bullet.BULLET_DEFAULT_CD;
    }

    this.sprite.setBlendMode(
      this.vulnerableTime > 0.01
        ? Phaser.BlendModes.ADD
        : Phaser.BlendModes.NORMAL,
    );
    this.syncSprite();
  }

  private sceneOf(): Phaser.Scene {
    return this.sprite.scene;
  }

  private computeState(): string {
    if (this.vulnerableTime > 0.01 && this.vulnerableTime > 2.8) return "hurt";
    if (!this.onGround) {
      return this.vy > 0 ? "fall" : "jump";
    } else if (this.shootPressed && this.currentState !== "crouch") {
      return "shoot";
    } else if (this.downPressed) {
      return "crouch";
    }
    if (Math.abs(this.inputX) > 0.01) return "run";
    return "idle";
  }

  onObjectHit(_hit: CollisionHit): void {}
}

export class Enemy extends Character implements Hittable {
  target: unknown = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    collision: CharacterCollision,
    assets: SharedAssets,
    stateKey: string,
  ) {
    super(scene, x, y, collision, assets, stateKey);
  }

  update(dt: number): void {
    this.tickAnimation();
    const runner = Character.runner;
    if (runner === null) throw new Error("collision runner is not initialized");
    runner.moveGrounded(this.body, null, null, dt, {
      velocity: [this.vx, this.vy],
    });
    this.x = this.body.x;
    this.y = this.body.y;
    this.onGround = this.body.onGround;
    this.syncSprite();
  }

  onObjectHit(_hit: CollisionHit): void {
    throw new Error("not implemented");
  }
}

export class Ghost extends Enemy {
  cycleDistance = 300;
  distance = 0;
  private blendFlag = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    assets: SharedAssets,
    target?: unknown,
  ) {
    const collision = assets.collisions.get("ghost");
    if (collision === undefined) throw new Error("ghost collision not found");
    super(scene, x, y, collision, assets, "ghost");
    this.name = "ghost";
    this.target = target;
    this.vx = 100;
    this.vy = 0;
    this.setState("idle");
  }

  update(dt: number): void {
    if (this.distance >= this.cycleDistance) {
      this.vx *= -1;
      this.flipped = this.vx < 0;
      this.distance = 0;
    }
    const dx = this.vx * dt;
    this.distance += Math.abs(dx);
    this.x += dx;
    this.body.x = this.x;
    super.update(dt);
  }

  onObjectHit(hit: CollisionHit): void {
    const other = hit.other(
      this as unknown as import("tilemap-parser-ts/core").ICollidable,
    ) as unknown as {
      name?: unknown;
    };
    const name = (other as { name?: unknown }).name;
    if (name === "player") {
      const player = other as unknown as Player;
      if (!player.isVulnerable) {
        player.makeVulnerable();
        const [pl, , pr] = getShapeAabb(
          player.x,
          player.y,
          player.collisionShape,
        );
        const [gl, , gr] = getShapeAabb(this.x, this.y, this.collisionShape);
        player.knockback((pl + pr) * 0.5 > (gl + gr) * 0.5 ? 1.0 : -1.0);
      }
    }
    if (name === "bullet") {
      if (this.blendFlag) {
        this.isDead = true;
      }
      this.blendFlag = true;
      this.sprite.setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
  }
}

export class Bullet implements Entity, Hittable {
  static readonly BULLET_DEFAULT_CD = 0.25;
  static readonly SPEED = 1000;
  static readonly RANGE = 1000;
  static runner: CollisionRunner | null = null;

  name = "bullet";
  x: number;
  y: number;
  vx: number;
  readonly body: WrappedGameObject;
  readonly sprite: Phaser.GameObjects.Image;
  horizontalRange = Bullet.RANGE;
  private dead = false;

  constructor(x: number, y: number, direction: number, scene: Phaser.Scene) {
    const shared = Bullet.shared;
    if (shared === null) throw new Error("bullet collision not registered");
    const shape =
      direction < 0
        ? (flipCharacterShape(shared.shape, [shared.fireW, shared.fireH], {
            flipH: true,
          }) as SpriteShape)
        : shared.shape;
    const [l, t, r, b] = getShapeAabb(x, y, shape);
    this.x = x - (r - l);
    this.y = y - (b - t);
    this.vx = direction * Bullet.SPEED;
    this.body = wrapGameObject(this, shape, shared.layer, shared.mask);
    const fireRs = shared.fireW / 25;
    this.sprite = scene.add
      .image(this.x, this.y, "bullet")
      .setOrigin(0, 0)
      .setScale(fireRs)
      .setDepth(20);
    if (direction < 0) this.sprite.setFlipX(true);
  }

  private static shared: {
    shape: SpriteShape;
    layer: number;
    mask: number;
    fireW: number;
    fireH: number;
  } | null = null;

  static registerCollision(
    shape: SpriteShape,
    layer: number,
    mask: number,
    fireW: number,
    fireH: number,
  ): void {
    Bullet.shared = { shape, layer, mask, fireW, fireH };
  }

  get isDead(): boolean {
    return this.dead;
  }

  get collisionShape(): SpriteShape {
    return this.body.collisionShape as SpriteShape;
  }

  get collisionLayer(): number {
    return this.body.collisionLayer;
  }

  get collisionMask(): number {
    return this.body.collisionMask;
  }

  update(dt: number): void {
    const dx = this.vx * dt;
    const runner = Bullet.runner;
    if (runner !== null) {
      const res = runner.moveAndSlide(this.body, null, null, dx, 0);
      this.x = this.body.x;
      this.y = this.body.y;
      if (res.collided) this.onTileHit(res);
    } else {
      this.x += dx;
      this.body.x = this.x;
    }
    this.horizontalRange = Math.max(0, this.horizontalRange - Math.abs(dx));
    if (this.horizontalRange === 0) this.dead = true;
    this.sprite.setPosition(this.x, this.y);
  }

  onObjectHit(_hit: CollisionHit): void {
    this.dead = true;
  }

  onTileHit(_result: CollisionResult): void {
    this.dead = true;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

export class AnimatedFx implements Entity {
  x: number;
  y: number;
  readonly sprite: Phaser.GameObjects.Sprite;
  private dead = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    stateKey: string,
    state: string,
  ) {
    this.x = x;
    this.y = y;
    const key = `anim:${stateKey}`;
    const rs = Character.runner?.renderScale ?? 1;
    this.sprite = scene.add
      .sprite(x, y, key)
      .setOrigin(0.5, 0.5)
      .setScale(rs)
      .setDepth(21);
    this.sprite.play(`${stateKey}:${state}`);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.dead = true;
      this.sprite.destroy();
    });
  }

  get isDead(): boolean {
    return this.dead;
  }

  update(_dt: number): void {}
}
