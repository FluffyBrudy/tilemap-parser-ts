import { flippedData, iterCellEntries, type TileMap } from "../world.js";
import {
  TilesetCollision,
  type TileCollisionData,
} from "../../parser/collision.js";
import type { Vec2 } from "../../vec.js";
import { tileKey } from "../../vec.js";

export type GidResolver = (tileId: number) => TileCollisionData | null;

export interface NavGridOptions {
  readonly renderScale?: number;
  readonly mapSize?: Vec2 | null;
  readonly gidResolver?: GidResolver | null;
  readonly collisionMask?: number;
}

export class NavGrid {
  readonly tileMap: TileMap;
  readonly tilesetCollision: TilesetCollision;
  readonly tileSize: Vec2;
  readonly collisionMask: number;
  readonly effTw: number;
  readonly effTh: number;
  readonly width: number;
  readonly height: number;
  walkable: boolean[][];
  readonly gidResolver: GidResolver | null;

  constructor(
    tileMap: TileMap,
    tilesetCollision: TilesetCollision,
    tileSize: Vec2,
    options: NavGridOptions = {},
  ) {
    const renderScale = options.renderScale ?? 1.0;
    this.tileMap = tileMap;
    this.tilesetCollision = tilesetCollision;
    this.gidResolver = options.gidResolver ?? null;
    this.collisionMask = options.collisionMask ?? 0xffffffff;
    this.tileSize = tileSize;
    this.effTw = tileSize[0] * renderScale;
    this.effTh = tileSize[1] * renderScale;

    if (options.mapSize !== null && options.mapSize !== undefined) {
      this.width = options.mapSize[0];
      this.height = options.mapSize[1];
    } else {
      let w = 0;
      let h = 0;
      for (const key of tileMap.keys()) {
        const sep = key.indexOf(";");
        const tx = Number(key.slice(0, sep));
        const ty = Number(key.slice(sep + 1));
        if (tx >= w) w = tx + 1;
        if (ty >= h) h = ty + 1;
      }
      this.width = w;
      this.height = h;
    }

    this.walkable = [];
    for (let y = 0; y < this.height; y += 1) {
      const row: boolean[] = [];
      for (let x = 0; x < this.width; x += 1) {
        row.push(this.isTileWalkable(x, y));
      }
      this.walkable.push(row);
    }
  }

  private resolve(tileId: number): TileCollisionData | null {
    if (this.gidResolver !== null) return this.gidResolver(tileId);
    return this.tilesetCollision.tiles.get(tileId) ?? null;
  }

  private *iterDatas(cell: unknown): Generator<TileCollisionData> {
    for (const [gid, flags] of iterCellEntries(cell)) {
      let data = this.resolve(gid);
      if (data === null) continue;
      if (flags !== 0) data = flippedData(data, flags, this.tileSize);
      if ((this.collisionMask & data.collisionLayer) === 0) continue;
      yield data;
    }
  }

  private isTileWalkable(tx: number, ty: number): boolean {
    for (const tileData of this.iterDatas(this.tileMap.get(tileKey(tx, ty)))) {
      for (const poly of tileData.shapes) {
        if (poly.isValid() && !poly.oneWay) return false;
      }
    }
    return true;
  }

  private inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && tx < this.width && ty >= 0 && ty < this.height;
  }

  isSolid(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return true;
    return !(this.walkable[ty]?.[tx] ?? false);
  }

  isWalkable(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return false;
    return this.walkable[ty]?.[tx] ?? false;
  }

  isOneWay(tx: number, ty: number): boolean {
    let hasOneWay = false;
    for (const tileData of this.iterDatas(this.tileMap.get(tileKey(tx, ty)))) {
      for (const poly of tileData.shapes) {
        if (!poly.isValid()) continue;
        if (poly.oneWay) hasOneWay = true;
        else return false;
      }
    }
    return hasOneWay;
  }

  copy(): NavGrid {
    const clone = Object.create(NavGrid.prototype) as NavGrid;
    (clone as { tileMap: TileMap }).tileMap = this.tileMap;
    (clone as { tilesetCollision: TilesetCollision }).tilesetCollision =
      this.tilesetCollision;
    (clone as { tileSize: Vec2 }).tileSize = this.tileSize;
    (clone as { effTw: number }).effTw = this.effTw;
    (clone as { effTh: number }).effTh = this.effTh;
    (clone as { width: number }).width = this.width;
    (clone as { height: number }).height = this.height;
    (clone as { walkable: boolean[][] }).walkable = this.walkable.map((row) => [
      ...row,
    ]);
    (clone as { gidResolver: GidResolver | null }).gidResolver =
      this.gidResolver;
    (clone as { collisionMask: number }).collisionMask = this.collisionMask;
    return clone;
  }

  erode(margin: number): NavGrid {
    const next = this.copy();
    next.erodeInPlace(margin);
    return next;
  }

  private erodeInPlace(margin: number): void {
    const original = this.walkable.map((row) => [...row]);
    const r = Math.ceil(margin + 0.5);
    for (let sy = 0; sy < this.height; sy += 1) {
      for (let sx = 0; sx < this.width; sx += 1) {
        if (!original[sy]?.[sx]) continue;
        const minTx = Math.max(0, sx - r);
        const maxTx = Math.min(this.width - 1, sx + r);
        const minTy = Math.max(0, sy - r);
        const maxTy = Math.min(this.height - 1, sy + r);
        for (
          let ty = minTy;
          ty <= maxTy && (this.walkable[sy]?.[sx] ?? false);
          ty += 1
        ) {
          for (let tx = minTx; tx <= maxTx; tx += 1) {
            if (original[ty]?.[tx]) continue;
            const dx = Math.abs(tx - sx);
            const dy = Math.abs(ty - sy);
            const distX = Math.max(0.0, dx - 0.5);
            const distY = Math.max(0.0, dy - 0.5);
            let dist: number;
            if (distX === 0 && distY === 0) dist = 0.0;
            else if (distX === 0) dist = distY;
            else if (distY === 0) dist = distX;
            else dist = Math.hypot(distX, distY);
            if (dist <= margin) {
              const row = this.walkable[sy];
              if (row !== undefined) row[sx] = false;
              break;
            }
          }
        }
      }
    }
  }

  static forEntity(
    tileMap: TileMap,
    tilesetCollision: TilesetCollision,
    tileSize: Vec2,
    spriteWidth: number,
    spriteHeight: number | null = null,
    renderScale = 1.0,
    mapSize: Vec2 | null = null,
    cache: Map<string, NavGrid> | null = null,
    gidResolver: GidResolver | null = null,
    collisionMask = 0xffffffff,
  ): NavGrid {
    const tw = tileSize[0] * renderScale;
    const size = Math.max(spriteWidth, spriteHeight ?? spriteWidth);
    const margin = size / 2.0 / tw;
    const key = `${margin}|${gidResolver === null}|${collisionMask}`;
    if (cache !== null) {
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
    }
    const nav = new NavGrid(tileMap, tilesetCollision, tileSize, {
      renderScale,
      mapSize,
      gidResolver,
      collisionMask,
    }).erode(margin);
    if (cache !== null) cache.set(key, nav);
    return nav;
  }

  getNeighbors(tx: number, ty: number, diagonals = false): Vec2[] {
    const neighbors: Vec2[] = [];
    const orthogonal: ReadonlyArray<readonly [number, number]> = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    for (const [dx, dy] of orthogonal) {
      if (this.isWalkable(tx + dx, ty + dy)) neighbors.push([tx + dx, ty + dy]);
    }
    if (diagonals) {
      const diagonal: ReadonlyArray<readonly [number, number]> = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ];
      for (const [dx, dy] of diagonal) {
        if (!this.isWalkable(tx + dx, ty + dy)) continue;
        if (!this.isWalkable(tx + dx, ty) || !this.isWalkable(tx, ty + dy))
          continue;
        neighbors.push([tx + dx, ty + dy]);
      }
    }
    return neighbors;
  }
}
