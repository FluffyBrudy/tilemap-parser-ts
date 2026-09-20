import Phaser from "phaser";
import {
  CollisionHit,
  CollisionRunner,
  ObjectCollisionManager,
  PhysicsWorld,
  getShapeAabb,
  parseMapDict,
  parseTilesetCollisionDict,
  type ICollidable,
  type ParsedMap,
  type SpriteShape,
} from "tilemap-parser-ts/core";
import {
  applyCamera,
  buildImageLayers,
  buildObjectStamps,
  buildTileLayers,
  worldBounds,
} from "tilemap-parser-ts/phaser";
import { loadSharedAssets, type SharedAssets } from "./assets.js";
import {
  AnimatedFx,
  Bullet,
  Character,
  Ghost,
  Player,
  isHittable,
  type Entity,
  type SpawnFn,
} from "./entities.js";

const PLAYER_SPAWN_NAMES = new Set(["player_spwan", "player_spawn", "player"]);

function spawnPoints(
  map: ParsedMap,
  rs: number,
): { player: [number, number]; ghosts: Array<[number, number]> } {
  let player: [number, number] = [100 * rs, 100 * rs];
  const ghosts: Array<[number, number]> = [];
  for (const layer of map.layers) {
    if (layer.name !== "datalayer") continue;
    for (const obj of layer.objects.values()) {
      const name = obj.properties?.["name"];
      if (typeof name !== "string") continue;
      const mx = (obj.area.x + obj.area.w / 2) * rs;
      const my = (obj.area.y + obj.area.h) * rs;
      if (PLAYER_SPAWN_NAMES.has(name)) player = [mx, my];
      else if (name === "ghost") ghosts.push([mx, my]);
    }
  }
  return { player, ghosts };
}

export class World {
  player!: Player;
  objects: Entity[] = [];
  ready = false;
  private manager = new ObjectCollisionManager();
  private assets!: SharedAssets;

  constructor(private readonly scene: Phaser.Scene) {}

  async loadLevel(map: ParsedMap): Promise<void> {
    const rs = map.meta.renderScale;
    const collision = parseTilesetCollisionDict(
      (await (
        await fetch("data/collision/tileset.collision.json")
      ).json()) as unknown,
    );
    const physics = PhysicsWorld.fromParsedMap(map, collision, {
      useGids: true,
    });
    const runner = CollisionRunner.fromWorld(physics, "platformer");
    Character.runner = runner;
    Bullet.runner = runner;

    this.assets = await loadSharedAssets(rs);
    const bulletCollision = this.assets.collisions.get("bullet");
    if (bulletCollision === undefined)
      throw new Error("bullet collision missing");
    Bullet.registerCollision(
      bulletCollision.shape as SpriteShape,
      bulletCollision.collisionLayer,
      bulletCollision.collisionMask,
      25 * rs,
      6 * rs,
    );

    buildImageLayers(this.scene, map);
    buildTileLayers(this.scene, map, { skipCull: true });
    buildObjectStamps(this.scene, map, {
      sheetSizes: this.sheetSizes(map),
      textureKey: (t: number) => `tileset:${t}`,
    });

    const spawns = spawnPoints(map, rs);
    this.player = new Player(
      this.scene,
      spawns.player[0],
      spawns.player[1],
      this.assets,
    );
    for (const [gx, gy] of spawns.ghosts) {
      const ghost = new Ghost(this.scene, gx, gy, this.assets);
      this.objects.push(ghost);
      this.manager.addObject(ghost.body);
    }
    this.manager.addObject(this.player.body);

    const [tw, th] = map.meta.tileSize;
    const [mw, mh] = map.meta.mapSize;
    applyCamera(this.scene.cameras.main, this.player, {
      bounds: worldBounds(mw, mh, tw, th, rs),
      deadzone: [256, 144],
      lerp: 0.12,
      roundPixels: true,
    });
    this.ready = true;
  }

  private sheetSizes(map: ParsedMap): Map<number, { w: number; h: number }> {
    const sizes = new Map<number, { w: number; h: number }>();
    map.tilesets.forEach((_ts, i) => {
      const img = this.scene.textures.get(`tileset:${i}`).getSourceImage() as {
        width?: number;
        height?: number;
      };
      sizes.set(i, { w: img.width ?? 0, h: img.height ?? 0 });
    });
    return sizes;
  }

  spawnObject: SpawnFn = (obj) => {
    this.objects.push(obj);
    const body = (obj as { body?: unknown }).body;
    if (typeof body === "object" && body !== null) {
      this.manager.addObject(body as ICollidable);
    }
  };

  private entityOf(body: unknown): Entity | null {
    if (body === this.player.body) return this.player;
    for (const obj of this.objects) {
      if ((obj as { body?: unknown }).body === body) return obj;
    }
    return null;
  }

  private handleCollisions(): void {
    for (const hit of this.manager.checkAllCollisions()) {
      const ea = this.entityOf(hit.objectA);
      const eb = this.entityOf(hit.objectB);
      if (ea === null || eb === null) continue;
      if (ea === this.player || eb === this.player) continue;
      const entityHit = new CollisionHit(
        ea as unknown as ICollidable,
        eb as unknown as ICollidable,
        hit.normal,
        hit.depth,
      );
      for (const entity of [ea, eb]) {
        if (isHittable(entity)) entity.onObjectHit(entityHit);
      }
    }
  }

  private reapDead(): void {
    for (let i = this.objects.length - 1; i >= 0; i -= 1) {
      const obj = this.objects[i];
      if (obj === undefined || !obj.isDead) continue;
      if (obj instanceof Ghost) {
        const [l, t, r, b] = getShapeAabb(obj.x, obj.y, obj.collisionShape);
        const lib = this.assets.anims.get("explosion");
        if (lib?.animations.has("enemy_death") === true) {
          this.spawnObject(
            new AnimatedFx(
              this.scene,
              (l + r) * 0.5,
              (t + b) * 0.5,
              "explosion",
              "enemy_death",
            ),
          );
        }
      }
      const body = (obj as { body?: unknown }).body;
      if (typeof body === "object" && body !== null) {
        this.manager.removeObject(body as ICollidable);
      }
      if (obj instanceof Bullet) obj.destroy();
      else if (obj instanceof Ghost) obj.sprite.destroy();
      this.objects.splice(i, 1);
    }
  }

  update(dt: number, keys: Record<string, boolean>): void {
    if (!this.ready) return;
    this.player.update(dt, this.spawnObject, keys);
    for (const obj of this.objects) obj.update(dt);
    this.handleCollisions();
    this.reapDead();
  }
}

export { parseMapDict };
