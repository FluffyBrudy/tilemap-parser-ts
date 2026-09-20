import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyCamera,
  collectAssetRefs,
  findSpawnMarkers,
  queueMapAssets,
  translateParticleConfig,
  worldBounds,
  wrapGameObject,
} from "../../src/phaser/index.js";
import {
  CollisionRunner,
  parseMapDict,
  ParticleSystemConfig,
  PhysicsWorld,
  RectangleShape,
  parseTilesetCollisionDict,
} from "../../src/core/index.js";
import type { ParsedMap } from "../../src/core/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENTRY_JSON = join(HERE, "../../../../sporeling/data/maps/entry.json");

function loadMap(): ParsedMap {
  return parseMapDict(JSON.parse(readFileSync(ENTRY_JSON, "utf-8")) as unknown);
}

describe("collectAssetRefs", () => {
  it("lists tilesets + image layers with stable keys", () => {
    const refs = collectAssetRefs(loadMap());
    expect(refs).toEqual([
      { key: "tileset:0", ref: "../../assets/Gothicvania Swamp files/Evironment/tileset.png", kind: "tileset" },
      { key: "tileset:1", ref: "../../assets/markers_2x2_c16.png", kind: "tileset" },
      { key: "image:0", ref: "../../assets/Gothicvania Swamp files/Evironment/background.png", kind: "image" },
      { key: "image:1", ref: "../../assets/Gothicvania Swamp files/Evironment/mid-layer-01.png", kind: "image" },
    ]);
  });
});

describe("queueMapAssets", () => {
  it("queues resolved image loads on a stub scene", () => {
    const queued: Array<[string, string]> = [];
    const scene = { load: { image: (k: string, u: string) => void queued.push([k, u]) } };
    const keys = queueMapAssets(scene as never, loadMap(), { mapUrl: "data/entry.json" });
    expect(keys).toEqual(["tileset:0", "tileset:1", "image:0", "image:1"]);
    expect(queued[0]?.[1]).toBe("assets/Gothicvania%20Swamp%20files/Evironment/tileset.png");
  });
});

describe("findSpawnMarkers", () => {
  it("finds player + ghosts in world px (rs applied)", () => {
    const { player, others } = findSpawnMarkers(loadMap());
    expect(player).toEqual([(81 + 8) * 3, (247 + 8) * 3]);
    expect(others.get("ghost")).toHaveLength(5);
  });
});

describe("applyCamera + worldBounds", () => {
  it("bounds the map and follows with deadzone", () => {
    const calls: string[] = [];
    const camera = {
      setBounds: (...a: unknown[]) => void calls.push(`bounds:${a.join(",")}`),
      setDeadzone: (...a: unknown[]) => void calls.push(`deadzone:${a.join(",")}`),
      startFollow: (...a: unknown[]) => void calls.push(`follow:${a.length}`),
    };
    const bounds = worldBounds(120, 20, 16, 16, 3);
    expect(bounds).toEqual({ x: 0, y: 0, w: 5760, h: 960 });
    applyCamera(camera, { x: 1, y: 2 }, { bounds, deadzone: [192, 64], lerp: 0.1 });
    expect(calls[0]).toBe("bounds:0,0,5760,960");
    expect(calls[1]).toBe("deadzone:192,64");
  });
});

describe("wrapGameObject + solver write-back", () => {
  it("solver probe-mutations act on the live object, then gravity lands it", () => {
    const map = loadMap();
    const collision = parseTilesetCollisionDict(
      JSON.parse(readFileSync(join(HERE, "../../../../sporeling/data/collision/tileset.collision.json"), "utf-8")) as unknown,
    );
    const world = PhysicsWorld.fromParsedMap(map, collision, { useGids: true });
    const runner = CollisionRunner.fromWorld(world, "platformer");
    const target = { x: 300, y: 100 };
    const body = wrapGameObject(target, new RectangleShape(15, 42), 2, 0xffffffff);
    let res = runner.movePlatformer(body, null, null, 0.016, { inputX: 0 });
    for (let i = 0; i < 300 && !res.onGround; i += 1) {
      res = runner.movePlatformer(body, null, null, 0.016, { inputX: 0 });
    }
    expect(target.y).toBe(body.y);
    expect(res.onGround).toBe(true);
    expect(target.y).toBeGreaterThan(100); // fell from spawn height
    expect(target.y).toBeLessThan(960); // inside world bounds
  });
});

describe("translateParticleConfig", () => {
  it("maps units (lifespan ms, alpha 0-1, frequency)", () => {
    const cfg = ParticleSystemConfig.fromDict({
      speed_min: 20,
      speed_max: 60,
      lifetime_min: 0.5,
      lifetime_max: 2.0,
      spawn_rate: 20,
      start_color_a: 255,
      end_color_a: 0,
    });
    const t = translateParticleConfig(cfg);
    expect(t.lifespan).toEqual({ min: 500, max: 2000 });
    expect(t.frequency).toBe(50);
    expect(t.alpha).toEqual({ start: 1, end: 0 });
    expect(t.blendMode).toBe("NORMAL");
    expect(translateParticleConfig(cfg, true).blendMode).toBe("ADD");
  });
});
