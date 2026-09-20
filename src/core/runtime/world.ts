import {
  CollisionPolygon,
  TileCollisionData,
  TilesetCollision,
} from "../parser/collision.js";
import type { ParsedMap } from "../parser/map.js";
import type { Vec2 } from "../vec.js";
import { tileKey } from "../vec.js";
import { Body } from "./body.js";
import { checkCollision } from "./collision/hit.js";
import type { ICollidable } from "./protocols.js";

export const FLIP_H = 1;
export const FLIP_V = 2;

export const FLIP_D = 4;

export type StackEntry = readonly [gid: number, flipbits: number];

export type TileCell = readonly StackEntry[];

export type TileMap = Map<string, TileCell>;

export function flipFlags(flipH = false, flipV = false, flipD = false): number {
  return (flipH ? FLIP_H : 0) | (flipV ? FLIP_V : 0) | (flipD ? FLIP_D : 0);
}

export function flipVertices(
  vertices: readonly Vec2[],
  flags: number,
  tileSize: Vec2,
): Vec2[] {
  if (flags === 0) return vertices.map((v) => [v[0], v[1]] as Vec2);
  const tw = Number(tileSize[0]);
  const th = Number(tileSize[1]);
  const w = flags & FLIP_D ? th : tw;
  const h = flags & FLIP_D ? tw : th;
  return vertices.map(([x0, y0]) => {
    let x = x0;
    let y = y0;
    if (flags & FLIP_D) {
      const t = x;
      x = y;
      y = t;
    }
    if (flags & FLIP_H) x = w - x;
    if (flags & FLIP_V) y = h - y;
    return [x, y] as Vec2;
  });
}

export function flippedData(
  base: TileCollisionData,
  flags: number,
  tileSize: Vec2,
): TileCollisionData {
  if (flags === 0) return base;
  return new TileCollisionData(
    base.tileId,
    base.shapes.map(
      (poly) =>
        new CollisionPolygon(
          flipVertices(poly.vertices, flags, tileSize),
          poly.oneWay,
        ),
    ),
    base.collisionLayer,
    base.collisionMask,
  );
}

function asEntry(value: unknown): StackEntry | null {
  if (typeof value === "boolean") return null;
  if (typeof value === "number") {
    return Number.isInteger(value) ? [value, 0] : null;
  }
  if (Array.isArray(value) && value.length === 2) {
    const [gid, flags] = value as [unknown, unknown];
    if (
      typeof gid === "number" &&
      Number.isInteger(gid) &&
      typeof flags === "number" &&
      Number.isInteger(flags)
    ) {
      return [gid, flags];
    }
  }
  return null;
}

export function iterCellEntries(cell: unknown): TileCell {
  if (cell === null || cell === undefined) return [];
  if (typeof cell === "boolean") return [];
  if (typeof cell === "number") {
    return Number.isInteger(cell) ? [[cell, 0]] : [];
  }
  if (Array.isArray(cell)) {
    const out: StackEntry[] = [];
    for (const v of cell) {
      let parsed = asEntry(v);
      if (parsed === null) {
        if (typeof v === "number" && Number.isInteger(v)) {
          parsed = [v, 0];
        } else {
          continue;
        }
      }
      const entry: StackEntry = parsed;
      if (!out.some((e) => e[0] === entry[0] && e[1] === entry[1])) {
        out.push(entry);
      }
    }
    return out;
  }
  return [];
}

export function iterCellIds(cell: unknown): number[] {
  return iterCellEntries(cell).map(([gid]) => gid);
}

function stemOf(path: string): string {
  const slash = path.replace(/\\/g, "/");
  const name = slash.slice(slash.lastIndexOf("/") + 1);
  if (name.startsWith(".") && name.indexOf(".", 1) < 0) return name;
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? name : name.slice(0, dot);
}

export interface FromParsedMapOptions {
  readonly excludeLayers?: ReadonlySet<string> | readonly string[];
  readonly useGids?: boolean;
}

export class PhysicsWorld {
  tileMap: TileMap;
  tilesetCollision: TilesetCollision | null;
  tileSize: Vec2;
  renderScale: number;
  bodies: Body[] = [];
  private flippedCache = new Map<string, TileCollisionData>();
  private gridRanges: Array<{ firstgid: number; count: number; stem: string }> =
    [];
  private collisionOwnerStem: string | null = null;

  constructor(
    tileMap: TileMap | null = null,
    tilesetCollision: TilesetCollision | null = null,
    tileSize: Vec2 = [32, 32],
    renderScale = 1.0,
  ) {
    this.tileMap = new Map();
    if (tileMap !== null) {
      for (const [pos, cell] of tileMap) {
        const entries = iterCellEntries(cell);
        if (entries.length > 0) this.tileMap.set(pos, entries);
      }
    }
    this.tilesetCollision = tilesetCollision;
    this.tileSize = tileSize;
    this.renderScale = renderScale;
    if (this.tileMap.size > 0 && this.tilesetCollision === null) {
      throw new RangeError(
        "tile_map requires tileset_collision: a world with solid tiles cannot resolve movement without collision data",
      );
    }
  }

  static fromParsedMap(
    parsed: ParsedMap,
    tilesetCollision: TilesetCollision | null,
    options: FromParsedMapOptions = {},
  ): PhysicsWorld {
    const excluded = new Set(options.excludeLayers ?? []);
    const useGids = options.useGids ?? false;
    const tileMap: TileMap = new Map();
    const ordered = [...parsed.layers].sort(
      (a, b) => a.zIndex - b.zIndex || a.id - b.id,
    );
    for (const layer of ordered) {
      if (layer.layerType !== "tile") continue;
      if (excluded.has(layer.name)) continue;
      if (!layer.collisionEnabled) continue;
      for (const [key, tile] of layer.tiles) {
        if (typeof tile.ttype !== "number") continue;
        let gid: number;
        if (useGids) {
          if (tile.gid !== null && tile.gid !== undefined) {
            gid = tile.gid;
          } else {
            const ts = parsed.tilesets[tile.ttype];
            gid =
              ts !== undefined && ts.firstgid !== 0
                ? ts.firstgid + tile.variant
                : tile.variant;
          }
        } else {
          gid = tile.variant;
        }
        const entry: StackEntry = [
          gid,
          flipFlags(tile.flipH, tile.flipV, tile.flipD),
        ];
        const existing = tileMap.get(key);
        if (existing === undefined) {
          tileMap.set(key, [entry]);
        } else if (
          !existing.some((e) => e[0] === entry[0] && e[1] === entry[1])
        ) {
          tileMap.set(key, [...existing, entry]);
        }
      }
    }
    const world = new PhysicsWorld(
      tileMap,
      tilesetCollision,
      [
        Math.trunc(parsed.meta.tileSize[0]),
        Math.trunc(parsed.meta.tileSize[1]),
      ],
      parsed.meta.renderScale,
    );
    if (useGids && tilesetCollision !== null) {
      world.captureGridOwnership(parsed, tilesetCollision);
    }
    return world;
  }

  private captureGridOwnership(
    parsed: ParsedMap,
    collision: TilesetCollision,
  ): void {
    const owner = collision.tilesetName;
    const ranges: Array<{ firstgid: number; count: number; stem: string }> = [];
    let matched: string | null = null;
    for (const ts of parsed.tilesets) {
      if (ts.type !== "tile") continue;
      const stem = stemOf(ts.path);
      ranges.push({ firstgid: ts.firstgid, count: ts.tileCount, stem });
      if (stem === owner && matched === null) matched = stem;
    }
    if (matched !== null) {
      this.gridRanges = ranges;
      this.collisionOwnerStem = matched;
    }
  }

  resolveCollision(tileId: number): TileCollisionData | null {
    if (this.gridRanges.length > 0 && this.tilesetCollision !== null) {
      for (const range of this.gridRanges) {
        if (tileId >= range.firstgid && tileId < range.firstgid + range.count) {
          if (range.stem !== this.collisionOwnerStem) return null;
          return (
            this.tilesetCollision.tiles.get(tileId - range.firstgid) ?? null
          );
        }
      }
      return null;
    }
    if (this.tilesetCollision === null) return null;
    return this.tilesetCollision.tiles.get(tileId) ?? null;
  }

  hasCollisionGid(tileId: number): boolean {
    const data = this.resolveCollision(tileId);
    return data !== null && data.hasCollision();
  }

  tileIdsAt(x: number, y: number): number[] {
    return iterCellIds(this.tileMap.get(tileKey(x, y)));
  }

  tileEntriesAt(x: number, y: number): TileCell {
    return iterCellEntries(this.tileMap.get(tileKey(x, y)));
  }

  resolveStackEntry(entry: StackEntry): TileCollisionData | null {
    const [gid, flags] = entry;
    const data = this.resolveCollision(gid);
    if (data === null) return null;
    if (flags === 0) return data;
    const key = `${gid},${flags}`;
    let cached = this.flippedCache.get(key);
    if (cached === undefined) {
      cached = flippedData(data, flags, this.tileSize);
      this.flippedCache.set(key, cached);
    }
    return cached;
  }

  iterCellData(cell: unknown): TileCollisionData[] {
    const datas: TileCollisionData[] = [];
    for (const entry of iterCellEntries(cell)) {
      const data = this.resolveStackEntry(entry);
      if (data !== null) datas.push(data);
    }
    return datas;
  }

  cellHasCollision(x: number, y: number): boolean {
    return this.iterCellData(this.tileMap.get(tileKey(x, y))).some((d) =>
      d.hasCollision(),
    );
  }

  addBody(body: Body): void {
    if (!this.bodies.includes(body)) this.bodies.push(body);
  }

  removeBody(body: Body): void {
    const index = this.bodies.indexOf(body);
    if (index === -1) {
      throw new Error(`${body.toString()} is not in this world`);
    }
    this.bodies.splice(index, 1);
  }

  clearBodies(): void {
    this.bodies.length = 0;
  }

  hasBody(body: Body): boolean {
    return this.bodies.includes(body);
  }

  get bodyCount(): number {
    return this.bodies.length;
  }

  collidesWithBody(sprite: ICollidable): Body | null {
    for (const body of this.bodies) {
      if (body === (sprite as unknown)) continue;
      if (checkCollision(sprite, body) !== null) return body;
    }
    return null;
  }
}
