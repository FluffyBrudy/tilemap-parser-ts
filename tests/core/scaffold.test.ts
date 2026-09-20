import { describe, expect, it } from "vitest";
import {
  AnimationParseError,
  CollisionParseError,
  MapParseError,
  TilemapParserError,
  parseTileKey,
  pointInRect,
  rectsOverlap,
  resolveResourceUrl,
  tileKey,
} from "../../src/core/index.js";

describe("scaffold", () => {
  it("exposes error hierarchy", () => {
    expect(new MapParseError("m")).toBeInstanceOf(TilemapParserError);
    expect(new CollisionParseError("c")).toBeInstanceOf(TilemapParserError);
    expect(new AnimationParseError("a")).toBeInstanceOf(TilemapParserError);
  });

  it("round-trips tile keys", () => {
    expect(tileKey(3, -7)).toBe("3;-7");
    expect(parseTileKey("3;-7")).toEqual([3, -7]);
    expect(parseTileKey("nope")).toBeNull();
  });

  it("tests rect helpers", () => {
    expect(pointInRect({ x: 0, y: 0, w: 10, h: 10 }, 10, 10)).toBe(true);
    expect(pointInRect({ x: 0, y: 0, w: 10, h: 10 }, 11, 5)).toBe(false);
    expect(
      rectsOverlap(
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 10, y: 0, w: 10, h: 10 },
      ),
    ).toBe(true);
  });

  it("resolves resource urls without fs", () => {
    expect(resolveResourceUrl("tiles/a.png")).toBe("tiles/a.png");
    expect(resolveResourceUrl("https://cdn/x/a.png")).toBe(
      "https://cdn/x/a.png",
    );
    expect(
      resolveResourceUrl("tiles/a.png", {
        mapUrl: "https://cdn/game/maps/1.json",
      }),
    ).toBe("https://cdn/game/maps/tiles/a.png");
  });
});
