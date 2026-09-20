import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MapParseError,
  parseMapDict,
  parseMapJson,
} from "../../src/core/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "../../examples/swamp/public/data");
const ENTRY_JSON = join(DATA_DIR, "entry.json");

function loadEntry(): unknown {
  return JSON.parse(readFileSync(ENTRY_JSON, "utf-8")) as unknown;
}

describe("parseMapDict: swamp entry.json parity", () => {
  it("parses layers with exact counts", () => {
    const map = parseMapDict(loadEntry());
    expect(map.layers.map((l) => [l.name, l.layerType, l.tiles.size, l.objects.size])).toEqual([
      ["Image Layer 2", "image", 0, 0],
      ["Image Layer 3", "image", 0, 0],
      ["tileprops", "tile", 65, 0],
      ["tiles", "tile", 475, 0],
      ["objects", "object", 0, 12],
      ["datalayer", "object", 0, 6],
    ]);
    expect(map.layers.every((l) => l.visible && l.collisionEnabled)).toBe(true);
  });

  it("parses meta with tolerant fallbacks", () => {
    const map = parseMapDict(loadEntry());
    expect(map.meta.tileSize).toEqual([16, 16]);
    expect(map.meta.mapSize).toEqual([120, 20]);
    expect(map.meta.initialMapSize).toEqual([120, 20]); // absent -> map_size
    expect(map.meta.zoomLevel).toBeCloseTo(1.4, 10);
    expect(map.meta.scroll).toEqual([1499.3514546169345, 610.0394312429912]);
    expect(map.meta.version).toBe("1.1");
    expect(map.meta.renderScale).toBe(3.0);
  });

  it("parses tilesets, spot tile, spot object, placements", () => {
    const map = parseMapDict(loadEntry());
    expect(map.tilesets.map((t) => [t.path, t.type, t.tileCount, t.firstgid])).toEqual([
      ["../../assets/Gothicvania Swamp files/Evironment/tileset.png", "tile", 147, 0],
      ["../../assets/markers_2x2_c16.png", "tile", 4, 147],
    ]);

    const tile = map.layers[3]?.tiles.get("15;17");
    expect(tile).toMatchObject({ ttype: 0, variant: 25, gid: 25 });
    expect(tile?.pos).toEqual([15, 17]);
    expect([tile?.flipH, tile?.flipV, tile?.flipD]).toEqual([false, false, false]);

    const obj = map.layers[4]?.objects.get(2);
    expect(obj?.area).toEqual({ x: 193, y: 239, w: 80, h: 32 });
    expect(obj).toMatchObject({ ttype: 0, tilesetType: "tile", variant: 110 });

    const layer2 = map.layers[0];
    expect(layer2?.imagePath).toBe(
      "../../assets/Gothicvania Swamp files/Evironment/background.png",
    );
    expect(layer2?.imageRect).toEqual([1715, 0, 204, 320]);
    expect(
      layer2?.imagePlacements.slice(0, 3).map((p) => [p.pid, p.x, p.y, p.w, p.h, p.mode]),
    ).toEqual([
      [1, 762, 0, 197, 320, "stretch"],
      [2, 0, 1, 188, 320, "stretch"],
      [3, 184, 0, 201, 320, "stretch"],
    ]);
    expect(layer2?.nextPlacementId).toBe(10);

    expect(map.projectState.rules).toHaveLength(9);
    expect(map.projectState.groups).toHaveLength(2);
  });
});

describe("parseMapDict: strictness", () => {
  const base = () =>
    ({
      meta: { tile_size: "16;16", map_size: "4;4", version: "1.1" },
      data: { layers: [] },
      project_state: {},
      resources: {},
    }) as unknown;

  it("rejects bools as ints and bad points", () => {
    const doc = base() as Record<string, unknown>;
    const data = doc["data"] as Record<string, unknown>;
    data["layers"] = [
      { name: "t", type: "tile", tiles: { "0;0": { pos: "0;0", variant: true } } },
    ];
    expect(() => parseMapDict(doc)).toThrow(MapParseError);
    data["layers"] = [
      { name: "t", type: "tile", tiles: { "0;0": { pos: "nope", variant: 1 } } },
    ];
    expect(() => parseMapDict(doc)).toThrow(MapParseError);
  });

  it("keys tiles by parsed pos, not the JSON key", () => {
    const doc = base() as Record<string, unknown>;
    const data = doc["data"] as Record<string, unknown>;
    data["layers"] = [
      { name: "t", type: "tile", tiles: { "WRONG": { pos: "2;3", variant: 7 } } },
    ];
    const map = parseMapDict(doc);
    expect([...(map.layers[0]?.tiles.keys() ?? [])]).toEqual(["2;3"]);
  });

  it("validates object animation frames", () => {
    const anim = { frame_count: 2, frame_duration_ms: 100, frames: [0] };
    const doc = base() as Record<string, unknown>;
    const data = doc["data"] as Record<string, unknown>;
    data["layers"] = [
      {
        name: "o",
        type: "object",
        objects: { "1": { area: { x: 0, y: 0, w: 8, h: 8 }, ttype: 0, variant: 0, animation: anim } },
      },
    ];
    expect(() => parseMapDict(doc)).toThrow(/exactly 2 entries/);
  });
});

describe("parseMapDict: tolerance", () => {
  const base = () =>
    ({
      meta: { tile_size: "16;16", map_size: "4;4", version: "1.1" },
      data: { layers: [] },
      project_state: {},
      resources: {},
    }) as unknown;

  it("skips bad placements, clamps mode, maxes next id", () => {
    const doc = base() as Record<string, unknown>;
    const data = doc["data"] as Record<string, unknown>;
    data["layers"] = [
      {
        name: "bg",
        type: "image",
        image_path: "a.png",
        image_placements: [
          { pid: 1, x: 0, y: 0, w: 10, h: 10, mode: "weird" },
          { pid: "bad", x: 0, y: 0, w: 1, h: 1 },
          "garbage",
          { pid: 4, x: 5, y: 5, w: 5, h: 5 },
        ],
        next_placement_id: 2,
      },
    ];
    const map = parseMapDict(doc);
    const layer = map.layers[0];
    expect(layer?.imagePlacements.map((p) => [p.pid, p.mode])).toEqual([
      [1, "stretch"],
      [4, "stretch"],
    ]);
    expect(layer?.nextPlacementId).toBe(5); // max(computed 5, stored 2)
  });

  it("expands legacy ongrid maps to a Terrain layer", () => {
    const doc = base() as Record<string, unknown>;
    const data = doc["data"] as Record<string, unknown>;
    data["ongrid"] = { "1;2": { ttype: 0, variant: 3 } };
    const map = parseMapDict(doc);
    expect(map.layers).toHaveLength(1);
    expect(map.layers[0]?.name).toBe("Terrain");
    expect(map.layers[0]?.tiles.get("1;2")?.variant).toBe(3);
  });

  it("accepts tileset shorthand, list-form resources, string ttype", () => {
    const doc = {
      meta: { tile_size: "16;16", map_size: "4;4", version: "1.1" },
      data: {
        layers: [
          { name: "t", type: "tile", tiles: { "0;0": { pos: "0;0", ttype: "custom", variant: 0 } } },
        ],
      },
      project_state: {},
      resources: [{ path: "a.png", type: "tile" }, "b.png"],
    } as unknown;
    const map = parseMapDict(doc);
    expect(map.tilesets.map((t) => [t.path, t.type])).toEqual([
      ["a.png", "tile"],
      ["b.png", "tile"],
    ]);
    expect(map.layers[0]?.tiles.get("0;0")?.ttype).toBe("custom");
  });

  it("reads collision_enabled from properties fallback, normalizes bg types", () => {
    const doc = {
      meta: { tile_size: "16;16", map_size: "4;4", version: "1.1" },
      data: {
        layers: [
          { name: "a", type: "tile", properties: { collision_enabled: 0 }, tiles: {} },
          { name: "b", type: "background", image_path: "bg.png", tiles: {} },
        ],
      },
      project_state: {},
      resources: {},
    } as unknown;
    const map = parseMapDict(doc);
    expect(map.layers[0]?.collisionEnabled).toBe(false);
    expect(map.layers[1]?.layerType).toBe("image");
  });
});

describe("parseMapJson", () => {
  it("rejects invalid JSON with MapParseError", () => {
    expect(() => parseMapJson("{nope")).toThrow(MapParseError);
  });

  it("round-trips the production map", () => {
    const text = readFileSync(ENTRY_JSON, "utf-8");
    const map = parseMapJson(text);
    expect(map.layers).toHaveLength(6);
    expect(map.layers[3]?.tiles.size).toBe(475);
  });
});
