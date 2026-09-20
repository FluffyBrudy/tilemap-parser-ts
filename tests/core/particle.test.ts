import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  EmitterTiming,
  MapParseError,
  ParticleSystemConfig,
  parseParticleDict,
} from "../../src/core/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));

describe("ParticleSystemConfig.fromDict: tolerance", () => {
  it("loads defaults and clamps values", () => {
    const cfg = ParticleSystemConfig.fromDict({});
    expect(cfg.emissionShape).toBe("point");
    expect(cfg.particleShape).toBe("circle");
    expect(cfg.particleSizeMin).toBe(2);
    expect(cfg.mode).toBe("continuous");

    const clamped = ParticleSystemConfig.fromDict({
      emission_shape: "blob",
      particle_shape: "blob",
      particle_size_min: -5,
      particle_size_max: 2,
      spawn_rate: -1,
      spread: 999,
      start_color_r: 300,
      start_scale: 0,
      mode: "nope",
      coverage: 0,
      field_quality: "ultra",
    });
    expect(clamped.emissionShape).toBe("point");
    expect(clamped.particleShape).toBe("circle");
    expect(clamped.particleSizeMin).toBe(1);
    expect(clamped.particleSizeMax).toBe(2); // max(clamped min 1, raw 2)
    expect(clamped.spawnRate).toBe(0);
    expect(clamped.spread).toBe(360);
    expect(clamped.startColorR).toBe(255);
    expect(clamped.startScale).toBe(0.1);
    expect(clamped.mode).toBe("continuous");
    expect(clamped.coverage).toBe(0.05); // floored
    expect(clamped.fieldQuality).toBe("medium");
  });

  it("throws on explicit-null numerics (only absent keys take defaults)", () => {
    expect(() => ParticleSystemConfig.fromDict({ spawn_rate: null })).toThrow();
  });

  it("round-trips toDict key names", () => {
    const cfg = ParticleSystemConfig.fromDict({ particle_shape: "fog" }, "mist");
    const d = cfg.toDict();
    expect(d["particle_shape"]).toBe("fog");
    expect(d["timing"]).toMatchObject({ loop: true });
    expect("fade_peak_alpha" in d).toBe(false);
    cfg.fadePeakAlpha = 300;
    expect(ParticleSystemConfig.fromDict(cfg.toDict()).fadePeakAlpha).toBe(255);
  });

  it("applies render scale to dimensionful fields only", () => {
    const cfg = ParticleSystemConfig.fromDict({});
    cfg.applyRenderScale(3);
    expect(cfg.particleSizeMin).toBe(6);
    expect(cfg.speedMax).toBe(180);
    expect(cfg.gravityY).toBe(90);
    expect(cfg.lifetimeMax).toBe(2.0);
    expect(cfg.startScale).toBe(1.0);
  });
});

describe("EmitterTiming", () => {
  it("falls back on malformed blocks, normalizes loop", () => {
    expect(EmitterTiming.fromDict(null).loop).toBe(true);
    expect(EmitterTiming.fromDict({ loop: "yes" }).loop).toBe(true);
    const t = EmitterTiming.fromDict({ emitter_duration: -5, loop: false });
    expect(t.emitterDuration).toBe(0);
    expect(t.loop).toBe(false);
  });
});

describe("fillArea / countForCoverage math", () => {
  it("computes shape-aware areas", () => {
    const rect = ParticleSystemConfig.fromDict({ emission_shape: "rect" });
    expect(rect.fillArea(10, 20)).toBe(200);
    const circle = ParticleSystemConfig.fromDict({ emission_shape: "circle" });
    expect(circle.fillArea(10, 10)).toBeCloseTo(Math.PI * 25, 10);
    expect(() => ParticleSystemConfig.fromDict({}).fillArea(10, 10)).toThrow(RangeError);
    expect(() => rect.countForCoverage(0, 10, 10)).toThrow(RangeError);
  });

  it("counts coverage with circle fill factor", () => {
    const cfg = ParticleSystemConfig.fromDict({
      emission_shape: "rect",
      particle_shape: "circle",
      particle_size_min: 4,
      particle_size_max: 4,
    });
    expect(cfg.countForCoverage(1.0, 10, 10)).toBe(8);
  });
});

describe("parseParticleDict: strict frame", () => {
  it("parses systems and rejects bad frames", () => {
    const cfgs = parseParticleDict({
      particle_systems: [{ name: "fire", config: { particle_shape: "smoke" } }, { name: "bare" }],
    });
    expect(cfgs.map((c) => [c.name, c.particleShape])).toEqual([
      ["fire", "smoke"],
      ["bare", "circle"],
    ]);
    expect(() => parseParticleDict({ particle_systems: "nope" })).toThrow(MapParseError);
    expect(() => parseParticleDict("nope")).toThrow(MapParseError);
  });
});

void HERE;
