import { describe, expect, it } from "vitest";
import { buildObjectStamps, sheetCols } from "../../src/phaser/index.js";
import type { ParsedObject } from "../../src/core/index.js";

function obj(partial: Partial<ParsedObject>): ParsedObject {
  return {
    area: { x: 10, y: 20, w: 80, h: 32 },
    ttype: 0,
    tilesetType: "tile",
    variant: 110,
    properties: null,
    animation: null,
    ...partial,
  };
}

function sceneStub() {
  const images: Array<Record<string, unknown>> = [];
  const crops: Array<[number, number, number, number]> = [];
  const scene = {
    textures: { exists: (key: string) => key === "tileset:0" },
    add: {
      image: (x: number, y: number, key: string) => {
        const record: Record<string, unknown> = { x, y, key };
        const chain = {
          setOrigin: () => chain,
          setCrop: (sx: number, sy: number, w: number, h: number) => {
            crops.push([sx, sy, w, h]);
            return chain;
          },
          setDisplaySize: (w: number, h: number) => {
            record["displayW"] = w;
            record["displayH"] = h;
            return chain;
          },
          setDepth: (d: number) => {
            record["depth"] = d;
            images.push(record);
            return chain;
          },
        };
        return chain;
      },
    },
  };
  return { scene, images, crops };
}

function mapStub(objects: ParsedObject[]) {
  const byId = new Map(objects.map((o, i) => [i + 1, o]));
  return {
    meta: { tileSize: [16, 16] as [number, number], renderScale: 3 },
    layers: [
      {
        id: 4, name: "objects", layerType: "object", visible: true, zIndex: 4,
        objects: byId,
      },
    ],
  } as never;
}

describe("sheetCols", () => {
  it("computes grid columns, null when degenerate", () => {
    expect(sheetCols(336, 112, 16, 16)).toBe(21);
    expect(sheetCols(100, 100, 0, 16)).toBeNull();
  });
});

describe("buildObjectStamps", () => {
  it("crops the variant rect and scales the area", () => {
    const { scene, images, crops } = sceneStub();
    const res = buildObjectStamps(scene as never, mapStub([obj({})]), {
      sheetSizes: new Map([[0, { w: 336, h: 112 }]]),
      textureKey: (t) => `tileset:${t}`,
    });
    expect(res.skipped).toBe(0);
    expect(images).toHaveLength(1);
    expect(crops).toEqual([[80, 80, 80, 32]]);
    expect(images[0]?.["displayW"]).toBe(240);
    expect(images[0]?.["displayH"]).toBe(96);
    expect(images[0]?.["x"]).toBe(30); // 10 * rs
  });

  it("skips row-wrapping stamps and missing sheets", () => {
    const { scene } = sceneStub();
    const wide = obj({ variant: 20, area: { x: 0, y: 0, w: 80, h: 32 } });
    const res = buildObjectStamps(scene as never, mapStub([wide]), {
      sheetSizes: new Map([[0, { w: 336, h: 112 }]]),
      textureKey: (t) => `tileset:${t}`,
    });
    expect(res.skipped).toBe(1);
    const res2 = buildObjectStamps(scene as never, mapStub([obj({ ttype: 9 })]), {
      sheetSizes: new Map([[0, { w: 336, h: 112 }]]),
      textureKey: (t) => `tileset:${t}`,
    });
    expect(res2.skipped).toBe(1);
  });
});
