import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AnimationClip,
  AnimationParseError,
  parseAnimationDict,
} from "../../src/core/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "../../examples/swamp/public/data");
const PLAYER_ANIM = join(DATA_DIR, "animations/player.anim.json");

describe("parseAnimationDict: production file parity", () => {
  it("parses swamp player.anim.json field-for-field", () => {
    const lib = parseAnimationDict(
      JSON.parse(readFileSync(PLAYER_ANIM, "utf-8")) as unknown,
    );
    expect([...lib.animations.keys()].sort()).toEqual([
      "crouch",
      "crouch_shoot",
      "fall",
      "hurt",
      "idle",
      "jump",
      "run",
      "shoot",
      "stand",
    ]);
    expect(lib.spritesheetPath).toBe(
      "../../assets/Gothicvania Swamp files/Sprites/Player/spritesheet.png",
    );
    expect(lib.tileSize).toEqual([62, 54]);
    expect(lib.trimTransparent).toBe(false);

    const idle = lib.get("idle");
    expect(idle?.frames.slice(0, 4).map((f) => [f.variantId, f.durationMs])).toEqual([
      [68, 100.0],
      [69, 100.0],
      [70, 100.0],
      [71, 100.0],
    ]);
    expect(idle?.loop).toBe(true);
    expect(idle?.totalDurationMs()).toBe(600);
    expect(lib.get("missing")).toBeNull();
  });
});

describe("parseAnimationDict: strictness", () => {
  it("rejects bad frames, sizes, and metadata", () => {
    const clip = (frames: unknown) => ({
      animations: { a: { frames } },
    });
    expect(() => parseAnimationDict(clip([{ variant_id: true }]))).toThrow(AnimationParseError);
    expect(() => parseAnimationDict({ tile_size: [0, 16], animations: {} })).toThrow(/width/);
    expect(() => parseAnimationDict({ grid_offset: [-1, 0], animations: {} })).toThrow(/offset/);
    expect(() =>
      parseAnimationDict({ animations: { a: { frames: [], metadata: 5 } } }),
    ).toThrow(/metadata/);
  });

  it("clamps markers into range and clears when empty", () => {
    const lib = parseAnimationDict({
      animations: {
        a: {
          frames: [{ variant_id: 1 }, { variant_id: 2 }],
          markers: [{ name: "hit", frame_index: 99 }],
        },
        b: { frames: [], markers: [{ name: "x", frame_index: 0 }] },
      },
    });
    expect(lib.get("a")?.markers[0]?.frameIndex).toBe(1);
    expect(lib.get("b")?.markers).toEqual([]);
  });

  it("uses truthiness for loop (0 is false, other values true)", () => {
    const lib = parseAnimationDict({
      animations: { a: { frames: [{ variant_id: 1 }], loop: 0 } },
    });
    expect(lib.get("a")?.loop).toBe(false);
  });
});

describe("AnimationClip", () => {
  it("counts frames and durations", () => {
    const clip = new AnimationClip("x", [
      { variantId: 1, durationMs: 50 },
      { variantId: 2, durationMs: 150 },
    ]);
    expect(clip.frameCount()).toBe(2);
    expect(clip.totalDurationMs()).toBe(200);
  });
});
