import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  Body,
  FLIP_H,
  PhysicsWorld,
  RectangleShape,
  flipFlags,
  flipVertices,
  iterCellEntries,
  iterCellIds,
  parseMapDict,
  parseTilesetCollisionDict,
  type ParsedMap,
  type TilesetCollision,
} from "../../src/core/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENTRY_JSON = join(HERE, "../../../../sporeling/data/maps/entry.json");
const TILESET_JSON = join(HERE, "../../../../sporeling/data/collision/tileset.collision.json");

function loadEntry(): ParsedMap {
  return parseMapDict(JSON.parse(readFileSync(ENTRY_JSON, "utf-8")) as unknown);
}

function loadCollision(): TilesetCollision {
  return parseTilesetCollisionDict(JSON.parse(readFileSync(TILESET_JSON, "utf-8")) as unknown);
}

describe("flip helpers", () => {
  it("encodes flags and mirrors vertices Tiled-order", () => {
    expect(flipFlags(true, false, true)).toBe(FLIP_H | 4);
    expect(flipVertices([[2, 3]], 0, [16, 16])).toEqual([[2, 3]]);
    expect(flipVertices([[2, 3]], FLIP_H, [16, 16])).toEqual([[14, 3]]);
    expect(flipVertices([[2, 3]], 4, [16, 32])).toEqual([[3, 2]]);
  });
});

describe("iterCellEntries", () => {
  it("normalizes legacy cells and dedups", () => {
    expect(iterCellEntries(null)).toEqual([]);
    expect(iterCellEntries(true)).toEqual([]);
    expect(iterCellEntries(7)).toEqual([[7, 0]]);
    expect(iterCellEntries([[23, 1]])).toEqual([[23, 1]]);
    expect(iterCellEntries([23, 1])).toEqual([[23, 0], [1, 0]]); // flat = two tiles
    expect(iterCellEntries([[5, 0], [5, 0], [6, 0]])).toEqual([[5, 0], [6, 0]]);
    expect(iterCellIds([[5, 1], [6, 0]])).toEqual([5, 6]);
  });
});

describe("PhysicsWorld.fromParsedMap", () => {
  it("unions tile layers from the production map", () => {
    const world = PhysicsWorld.fromParsedMap(loadEntry(), loadCollision());
    expect(world.tileSize).toEqual([16, 16]);
    expect(world.renderScale).toBe(3);
    let cells = 0;
    let stacked = 0;
    for (const cell of world.tileMap.values()) {
      cells += 1;
      stacked += cell.length;
    }
    expect(stacked).toBe(540);
    expect(cells).toBeLessThanOrEqual(540);
    expect(world.hasCollisionGid(21)).toBe(true);
    expect(world.hasCollisionGid(9999)).toBe(false);
  });

  it("routes gids: deco grids never alias into the owner", () => {
    const world = PhysicsWorld.fromParsedMap(loadEntry(), loadCollision(), { useGids: true });
    expect(world.tileIdsAt(15, 17)).toEqual([114, 25]);
    expect(world.resolveCollision(21)).not.toBeNull(); // owner local 21
    expect(world.resolveCollision(147)).toBeNull(); // markers grid: deco, never solid
    expect(world.resolveCollision(5000)).toBeNull(); // outside every window
  });

  it("resolves flipped entries with cache + identity fast path", () => {
    const world = PhysicsWorld.fromParsedMap(loadEntry(), loadCollision());
    const base = world.resolveStackEntry([21, 0]);
    expect(world.resolveStackEntry([21, 0])).toBe(base); // shared, no copy
    const flipped = world.resolveStackEntry([21, FLIP_H]);
    expect(flipped).not.toBe(base);
    expect(world.resolveStackEntry([21, FLIP_H])).toBe(flipped); // cached
    const baseVerts = base?.shapes[0]?.vertices[0];
    const flipVerts = flipped?.shapes[0]?.vertices[0];
    expect(flipVerts?.[0]).toBeCloseTo(16 - (baseVerts?.[0] ?? 0), 10);
    expect(world.resolveStackEntry([9999, 0])).toBeNull();
  });

  it("excludes layers and enforces the collision-data contract", () => {
    const world = PhysicsWorld.fromParsedMap(loadEntry(), loadCollision(), {
      excludeLayers: ["tiles", "tileprops"],
    });
    expect(world.tileMap.size).toBe(0);
    expect(() => new PhysicsWorld(new Map([["0;0", [[1, 0]]]]), null)).toThrow(RangeError);
  });

  it("manages bodies with identity semantics", () => {
    const world = PhysicsWorld.fromParsedMap(loadEntry(), loadCollision());
    const crate = new Body(new RectangleShape(16, 16), 100, 100, { mode: "kinematic" });
    world.addBody(crate);
    world.addBody(crate);
    expect(world.bodyCount).toBe(1);
    expect(world.hasBody(crate)).toBe(true);
    const sprite = {
      x: 105, y: 105,
      collisionShape: new RectangleShape(16, 16),
      collisionLayer: 1, collisionMask: 0xffffffff,
    };
    expect(world.collidesWithBody(sprite)).toBe(crate);
    expect(world.collidesWithBody(crate)).toBeNull(); // never blocks itself
    expect(world.collidesWithBody({ x: 0, y: 0, collisionShape: new RectangleShape(4, 4), collisionLayer: 1, collisionMask: 0xffffffff })).toBeNull();
    world.removeBody(crate);
    expect(() => world.removeBody(crate)).toThrow();
    expect(world.bodyCount).toBe(0);
  });
});
