import { describe, expect, it } from "vitest";
import {
  TileAnimClip,
  TileAnimFile,
  TileClipFrame,
  clipFrameAt,
  resolveClipSheet,
} from "../../src/core/index.js";

const clip = (loop = true) =>
  new TileAnimClip(
    "flow",
    [new TileClipFrame("a.png", 0, 100), new TileClipFrame("a.png", 1, 200)],
    loop,
    "default",
  );

describe("clipFrameAt timing", () => {
  it("walks frames by accumulated duration", () => {
    expect(clipFrameAt(clip(), 0)?.variant).toBe(0);
    expect(clipFrameAt(clip(), 99)?.variant).toBe(0);
    expect(clipFrameAt(clip(), 100)?.variant).toBe(1);
    expect(clipFrameAt(clip(), 299)?.variant).toBe(1);
    expect(clipFrameAt(clip(), 300)?.variant).toBe(0); // loop wrap
  });

  it("clamps non-looping clips at the last frame", () => {
    expect(clipFrameAt(clip(false), 999)?.variant).toBe(1);
  });

  it("rotates phase and returns null when empty", () => {
    expect(clipFrameAt(clip(), 0, 1)?.variant).toBe(1);
    expect(clipFrameAt(new TileAnimClip("e"), 50)).toBeNull();
  });
});

describe("TileAnimFile.fromDict tolerance", () => {
  it("drops invalid clips/frames, clamps mode, strict loop", () => {
    const file = TileAnimFile.fromDict({
      tileset: "t.png",
      clips: {
        good: {
          loop: true,
          mode: "random_start_times",
          frames: [
            { sheet: "t.png", variant: 0, duration_ms: 50 },
            { sheet: "", variant: 1 },
            { sheet: "t.png", variant: -1 },
            { sheet: "t.png", variant: 2, duration_ms: 0 },
          ],
        },
        bad: { frames: [] },
        alsobad: "nope",
      },
    });
    expect(file.tileset).toBe("t.png");
    expect(file.clips.map((c) => c.name)).toEqual(["good"]);
    const good = file.byName("good");
    expect(good?.frames.map((f) => f.variant)).toEqual([0]);
    expect(good?.mode).toBe("random_start_times");
    expect(TileAnimFile.fromDict({ clips: { x: { loop: 1, frames: [{ sheet: "s", variant: 0 }] } } }).byName("x")?.loop).toBe(false);
    expect(file.byName("missing")).toBeNull();
    expect(TileAnimFile.fromDict("garbage").clips).toEqual([]);
  });

  it("round-trips toDict", () => {
    const file = TileAnimFile.fromDict({
      tileset: "t.png",
      clips: { w: { loop: false, frames: [{ sheet: "s", variant: 3, duration_ms: 40 }] } },
    });
    const d = file.toDict() as { clips: Record<string, { loop: boolean }> };
    expect(d["clips"]?.["w"]?.loop).toBe(false);
    expect(TileAnimFile.fromDict(d).byName("w")?.frames).toHaveLength(1);
  });
});

describe("resolveClipSheet tiers", () => {
  const paths = ["env/tileset.png", "chars/player.png", "env/water.png"];
  it("matches exact, basename, then stem", () => {
    expect(resolveClipSheet(paths, "env/tileset.png")).toBe(0);
    expect(resolveClipSheet(paths, "other/player.png")).toBe(1); // basename
    expect(resolveClipSheet(paths, "anywhere/water_v2.png")).toBeNull(); // stem clash-free miss
    expect(resolveClipSheet(["a/water.png", "b/water.png"], "c/water.png")).toBeNull(); // ambiguous
    expect(resolveClipSheet(paths, "")).toBeNull();
    expect(resolveClipSheet(paths, "env\\tileset.png")).toBe(0); // backslash norm
  });
});
