import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CircleShape,
  CollisionParseError,
  CollisionPolygon,
  RectangleShape,
  TileCollisionData,
  TilesetCollision,
  flipCharacterShape,
  parseCharacterCollisionDict,
  parseObjectCollisionDict,
  parseTilesetCollisionDict,
} from "../../src/core/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const TILESET_JSON = join(HERE, "../../../../sporeling/data/collision/tileset.collision.json");
const CHAR_DIR = join(HERE, "../../../../sporeling/data/character_collision");

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}

describe("parseTilesetCollisionDict: production file parity", () => {
  it("parses 33 tiles with exact spot values", () => {
    const coll = parseTilesetCollisionDict(loadJson(TILESET_JSON));
    expect(coll.tilesetName).toBe("tileset");
    expect(coll.tileSize).toEqual([16, 16]);
    expect(coll.tiles.size).toBe(33);

    const t21 = coll.getTileCollision(21);
    expect(t21?.shapes).toHaveLength(1);
    expect(t21?.shapes[0]?.vertices).toEqual([
      [2.5, 0.0],
      [16.0, 0.0],
      [16.0, 16.0],
      [2.5, 16.0],
    ]);
    expect(t21?.shapes[0]?.oneWay).toBe(false);
    expect(t21?.collisionLayer).toBe(1);
    expect([t21?.collisionMask, 0xffffffff]).toEqual([4294967295, 4294967295]);
    expect(coll.hasCollision(21)).toBe(true);
    expect(coll.hasCollision(999)).toBe(false);
  });

  it("transforms shapes to world space", () => {
    const coll = parseTilesetCollisionDict(loadJson(TILESET_JSON));
    const world = coll.getWorldShapes(21, 32, 48, 3.0);
    expect(world[0]?.vertices[0]).toEqual([32 + 2.5 * 3, 48 + 0 * 3]);
  });

  it("rejects non-object properties (strict contract)", () => {
    expect(() =>
      parseTilesetCollisionDict({
        tileset_name: "t",
        tile_size: [16, 16],
        tiles: { "1": { shapes: [], properties: null } },
      }),
    ).toThrow(CollisionParseError);
  });
});

describe("parseCharacterCollisionDict: production files parity", () => {
  it("parses player rect with layer/mask", () => {
    const c = parseCharacterCollisionDict(loadJson(join(CHAR_DIR, "player.collision.json")));
    expect(c.name).toBe("player");
    expect(c.shape).toBeInstanceOf(RectangleShape);
    const rect = c.shape as RectangleShape;
    expect(rect.width).toBeCloseTo(15.392436008796217, 12);
    expect(rect.height).toBeCloseTo(41.96371868724049, 12);
    expect(rect.offset[0]).toBeCloseTo(19.031166806219147, 12);
    expect(rect.offset[1]).toBeCloseTo(10.012653648833718, 12);
    expect(c.collisionLayer).toBe(2);
    expect(c.collisionMask).toBe(29);
  });

  it("scales by render_scale", () => {
    const c = parseCharacterCollisionDict(loadJson(join(CHAR_DIR, "bullet.collision.json")), 3.0);
    const rect = c.shape as RectangleShape;
    expect(rect.width).toBeCloseTo(24.0, 10);
    expect(rect.offset[0]).toBeCloseTo(15.916666666666664 * 3, 10);
  });

  it("rejects bad render_scale and unknown shapes", () => {
    const doc = loadJson(join(CHAR_DIR, "bullet.collision.json"));
    expect(() => parseCharacterCollisionDict(doc, 0)).toThrow(CollisionParseError);
    expect(() => parseCharacterCollisionDict(doc, Number.NaN)).toThrow(CollisionParseError);
    expect(() =>
      parseCharacterCollisionDict({ name: "x", shape: { type: "blob" } }),
    ).toThrow(/Unknown shape type/);
    expect(() =>
      parseCharacterCollisionDict({ name: "x", shape: { type: "polygon", vertices: [[0, 0]] } }),
    ).toThrow(/at least 3 vertices/);
  });
});

describe("flipCharacterShape", () => {
  it("mirrors rect offsets and is its own inverse", () => {
    const shape = new RectangleShape(10, 20, [5, 5]);
    const flipped = flipCharacterShape(shape, [100, 50]) as RectangleShape;
    expect(flipped.offset).toEqual([100 - (5 + 10), 5]);
    const back = flipCharacterShape(flipped, [100, 50]) as RectangleShape;
    expect(back.offset).toEqual([5, 5]);
    expect(shape.offset).toEqual([5, 5]); // input never mutated
  });

  it("mirrors polygon vertices per-vertex", () => {
    const poly = new CollisionPolygon([[1, 2], [3, 4], [5, 6]], true);
    const flipped = flipCharacterShape(poly, [10, 10]) as CollisionPolygon;
    expect(flipped.vertices).toEqual([[9, 2], [7, 4], [5, 6]]);
    expect(flipped.oneWay).toBe(true);
  });

  it("rejects bad sizes and unknown shapes", () => {
    expect(() => flipCharacterShape(new CircleShape(1), [0, 10])).toThrow(RangeError);
    expect(() =>
      flipCharacterShape({ kind: "nope" } as unknown as CircleShape, [10, 10]),
    ).toThrow(TypeError);
  });
});

describe("TilesetCollision.merge", () => {
  it("re-keys by firstgid and rejects length mismatch", () => {
    const a = new TilesetCollision("a", [16, 16]);
    a.tiles.set(
      3,
      new TileCollisionData(3, [new CollisionPolygon([[0, 0], [1, 0], [1, 1]])]),
    );
    const merged = TilesetCollision.merge([a], [100]);
    expect(merged.getTileCollision(103)?.tileId).toBe(103);
    expect(() => TilesetCollision.merge([a], [])).toThrow(CollisionParseError);
    expect(TilesetCollision.merge([], []).tiles.size).toBe(0);
  });
});

describe("parseObjectCollisionDict", () => {
  it("parses regions with rects and world shapes", () => {
    const data = parseObjectCollisionDict({
      tileset_name: "props",
      regions: {
        door: {
          name: "Door",
          region_rect: [10, 20, 30, 40],
          shapes: [{ vertices: [[0, 0], [8, 0], [8, 8]], one_way: true }],
          properties: { collision_layer: 2 },
        },
      },
    });
    expect(data.tilesetName).toBe("props");
    const region = data.getRegion("door");
    expect(region?.regionRect).toEqual([10, 20, 30, 40]);
    expect(region?.hasCollision()).toBe(true);
    expect(region?.collisionLayer).toBe(2);
    expect(region?.getWorldShapes(100, 100)[0]?.vertices[0]).toEqual([110, 120]);
    expect(data.hasCollision("missing")).toBe(false);
  });
});
