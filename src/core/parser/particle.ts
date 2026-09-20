import { MapParseError } from "../errors.js";

export type EmissionShape = "point" | "rect" | "circle" | "line";
export type ParticleShape =
  | "circle"
  | "square"
  | "diamond"
  | "star"
  | "sparkle"
  | "smoke"
  | "heart"
  | "line"
  | "fog";
export type AlphaFadeMode = "none" | "fade_out" | "fade_in" | "fade_both";
export type FieldQuality = "low" | "medium" | "high";
export type EmitterMode = "continuous" | "burst" | "field";

export const EMISSION_SHAPES: readonly EmissionShape[] = [
  "point",
  "rect",
  "circle",
  "line",
];
export const PARTICLE_SHAPES: readonly ParticleShape[] = [
  "circle",
  "square",
  "diamond",
  "star",
  "sparkle",
  "smoke",
  "heart",
  "line",
  "fog",
];
export const ALPHA_FADE_MODES: readonly AlphaFadeMode[] = [
  "none",
  "fade_out",
  "fade_in",
  "fade_both",
];
export const EMISSION_MODES: readonly EmitterMode[] = [
  "continuous",
  "burst",
  "field",
];
export const FIELD_QUALITIES: readonly FieldQuality[] = [
  "low",
  "medium",
  "high",
];

export const QUALITY_DENSITY: Record<FieldQuality, number> = {
  low: 0.72,
  medium: 1.0,
  high: 1.25,
};

type JsonDict = Record<string, unknown>;

function strictInt(raw: unknown): number {
  if (typeof raw === "boolean") return raw ? 1 : 0;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw new Error(`not an int: ${String(raw)}`);
    return Math.trunc(raw);
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (/^[+-]?\d+$/.test(t)) {
      const n = Number(t);
      if (Number.isSafeInteger(n)) return n;
    }
    throw new Error(`not an int: ${JSON.stringify(raw)}`);
  }
  throw new Error(`not an int: ${typeof raw}`);
}

function strictFloat(raw: unknown): number {
  if (typeof raw === "boolean") return raw ? 1 : 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    const lower = t.toLowerCase();
    if (lower === "nan" || lower === "+nan" || lower === "-nan") return NaN;
    if (
      lower === "inf" ||
      lower === "+inf" ||
      lower === "infinity" ||
      lower === "+infinity"
    ) {
      return Infinity;
    }
    if (lower === "-inf" || lower === "-infinity") return -Infinity;
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
      return Number(t);
    }
  }
  throw new Error(`not a number: ${JSON.stringify(raw)}`);
}

function toInt(raw: unknown, fallback: number): number {
  let value: number;
  try {
    value = strictInt(raw);
  } catch {
    return fallback;
  }
  if (typeof raw === "boolean" || !Number.isFinite(value)) return fallback;
  return value;
}

function toFloat(raw: unknown, fallback: number): number {
  let value: number;
  try {
    value = strictFloat(raw);
  } catch {
    return fallback;
  }
  if (typeof raw === "boolean" || !Number.isFinite(value)) return fallback;
  return value;
}

function gval(d: JsonDict, key: string, fallback: unknown): unknown {
  return Object.hasOwn(d, key) ? d[key] : fallback;
}

function isRecord(v: unknown): v is JsonDict {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export class EmitterTiming {
  emitterDuration = 0.0;
  startDelay = 0.0;
  loop = true;
  burstInterval = 0.0;

  private static num(raw: unknown, fallback: number): number {
    return Math.max(0.0, toFloat(raw, fallback));
  }

  static fromDict(raw: unknown): EmitterTiming {
    const t = new EmitterTiming();
    if (!isRecord(raw)) return t;
    const loopRaw = raw["loop"] ?? true;
    t.loop = typeof loopRaw === "boolean" ? loopRaw : true;
    t.emitterDuration = EmitterTiming.num(raw["emitter_duration"] ?? 0.0, 0.0);
    t.startDelay = EmitterTiming.num(raw["start_delay"] ?? 0.0, 0.0);
    t.burstInterval = EmitterTiming.num(raw["burst_interval"] ?? 0.0, 0.0);
    return t;
  }

  toDict(): JsonDict {
    return {
      emitter_duration: this.emitterDuration,
      start_delay: this.startDelay,
      loop: this.loop,
      burst_interval: this.burstInterval,
    };
  }
}

export class ParticleSystemConfig {
  name: string;
  emissionShape: EmissionShape = "point";
  particleShape: ParticleShape = "circle";
  particleSizeMin = 2;
  particleSizeMax = 6;
  spawnRate = 20;
  maxParticles = 100;
  lifetimeMin = 0.5;
  lifetimeMax = 2.0;
  speedMin = 20.0;
  speedMax = 60.0;
  direction = -1.0;
  spread = 45.0;
  gravityX = 0.0;
  gravityY = 30.0;
  startColorR = 255;
  startColorG = 200;
  startColorB = 100;
  startColorA = 255;
  endColorR = 255;
  endColorG = 100;
  endColorB = 50;
  endColorA = 0;
  startScale = 1.0;
  endScale = 0.3;
  rotationSpeed = 0.0;
  alphaFade: AlphaFadeMode = "fade_out";
  fadePeakAlpha: number | null = null;
  wrap = false;
  mode: EmitterMode = "continuous";
  burstCount = 30;
  coverage = 1.0;
  fieldQuality: FieldQuality = "medium";
  groundBias = false;
  timing: EmitterTiming = new EmitterTiming();

  constructor(name = "") {
    this.name = name;
  }

  applyRenderScale(scale: number): void {
    this.particleSizeMin = Math.max(
      1,
      Math.trunc(this.particleSizeMin * scale),
    );
    this.particleSizeMax = Math.max(
      1,
      Math.trunc(this.particleSizeMax * scale),
    );
    this.speedMin *= scale;
    this.speedMax *= scale;
    this.gravityX *= scale;
    this.gravityY *= scale;
  }

  fillArea(w: number, h: number): number {
    if (this.emissionShape === "circle") {
      const radius = Math.min(w, h) / 2;
      return Math.PI * radius * radius;
    }
    if (this.emissionShape === "point") {
      throw new RangeError(
        "emission_shape 'point' has no fill area; use rect/circle/line or a wider emission rect",
      );
    }
    return w * h;
  }

  countForCoverage(coverage: number, w: number, h: number): number {
    if (coverage <= 0) {
      throw new RangeError(`coverage must be > 0, got ${coverage}`);
    }
    const meanSize = (this.particleSizeMin + this.particleSizeMax) / 2;
    if (meanSize <= 0) return 0;
    const fill = this.particleShape === "circle" ? Math.PI / 4 : 1.0;
    const area = this.fillArea(w, h);
    return Math.max(
      0,
      Math.round((coverage * area) / (meanSize * meanSize * fill)),
    );
  }

  toDict(): JsonDict {
    const d: JsonDict = {
      emission_shape: this.emissionShape,
      particle_shape: this.particleShape,
      particle_size_min: this.particleSizeMin,
      particle_size_max: this.particleSizeMax,
      spawn_rate: this.spawnRate,
      max_particles: this.maxParticles,
      lifetime_min: this.lifetimeMin,
      lifetime_max: this.lifetimeMax,
      speed_min: this.speedMin,
      speed_max: this.speedMax,
      direction: this.direction,
      spread: this.spread,
      gravity_x: this.gravityX,
      gravity_y: this.gravityY,
      start_color_r: this.startColorR,
      start_color_g: this.startColorG,
      start_color_b: this.startColorB,
      start_color_a: this.startColorA,
      end_color_r: this.endColorR,
      end_color_g: this.endColorG,
      end_color_b: this.endColorB,
      end_color_a: this.endColorA,
      start_scale: this.startScale,
      end_scale: this.endScale,
      rotation_speed: this.rotationSpeed,
      alpha_fade: this.alphaFade,
      wrap: this.wrap,
      mode: this.mode,
      burst_count: this.burstCount,
      coverage: this.coverage,
      field_quality: this.fieldQuality,
      ground_bias: this.groundBias,
      timing: this.timing.toDict(),
    };
    if (this.fadePeakAlpha !== null) {
      d["fade_peak_alpha"] = this.fadePeakAlpha;
    }
    return d;
  }

  static fromDict(d: JsonDict, name = ""): ParticleSystemConfig {
    const cfg = new ParticleSystemConfig(name);
    const emission = String(gval(d, "emission_shape", "point"));
    cfg.emissionShape = (EMISSION_SHAPES as readonly string[]).includes(
      emission,
    )
      ? (emission as EmissionShape)
      : "point";
    const shape = String(gval(d, "particle_shape", "circle"));
    cfg.particleShape = (PARTICLE_SHAPES as readonly string[]).includes(shape)
      ? (shape as ParticleShape)
      : "circle";
    const fade = String(gval(d, "alpha_fade", "fade_out"));
    cfg.alphaFade = (ALPHA_FADE_MODES as readonly string[]).includes(fade)
      ? (fade as AlphaFadeMode)
      : "fade_out";
    cfg.particleSizeMin = Math.max(
      1,
      strictInt(gval(d, "particle_size_min", 2)),
    );
    cfg.particleSizeMax = Math.max(
      cfg.particleSizeMin,
      strictInt(gval(d, "particle_size_max", 6)),
    );
    cfg.spawnRate = Math.max(0, strictInt(gval(d, "spawn_rate", 20)));
    cfg.maxParticles = Math.max(1, strictInt(gval(d, "max_particles", 100)));
    cfg.lifetimeMin = Math.max(0.1, strictFloat(gval(d, "lifetime_min", 0.5)));
    cfg.lifetimeMax = Math.max(
      cfg.lifetimeMin,
      strictFloat(gval(d, "lifetime_max", 2.0)),
    );
    cfg.speedMin = Math.max(0.0, strictFloat(gval(d, "speed_min", 20)));
    cfg.speedMax = Math.max(
      cfg.speedMin,
      strictFloat(gval(d, "speed_max", 60)),
    );
    cfg.direction = strictFloat(gval(d, "direction", -1));
    cfg.spread = Math.max(
      0.0,
      Math.min(360.0, strictFloat(gval(d, "spread", 45))),
    );
    cfg.gravityX = strictFloat(gval(d, "gravity_x", 0));
    cfg.gravityY = strictFloat(gval(d, "gravity_y", 30));
    const channel = (key: string, fallback: number): number =>
      Math.max(0, Math.min(255, strictInt(gval(d, key, fallback))));
    cfg.startColorR = channel("start_color_r", 255);
    cfg.startColorG = channel("start_color_g", 200);
    cfg.startColorB = channel("start_color_b", 100);
    cfg.startColorA = channel("start_color_a", 255);
    cfg.endColorR = channel("end_color_r", 255);
    cfg.endColorG = channel("end_color_g", 100);
    cfg.endColorB = channel("end_color_b", 50);
    cfg.endColorA = channel("end_color_a", 0);
    cfg.startScale = Math.max(0.1, strictFloat(gval(d, "start_scale", 1.0)));
    cfg.endScale = Math.max(0.1, strictFloat(gval(d, "end_scale", 0.3)));
    cfg.rotationSpeed = strictFloat(gval(d, "rotation_speed", 0));
    cfg.wrap = Boolean(gval(d, "wrap", false));
    const rawPeak = Object.hasOwn(d, "fade_peak_alpha")
      ? d["fade_peak_alpha"]
      : null;
    cfg.fadePeakAlpha =
      rawPeak === null || rawPeak === undefined
        ? null
        : Math.max(0, Math.min(255, strictInt(rawPeak)));
    const rawMode = String(gval(d, "mode", "continuous"));
    cfg.mode = (EMISSION_MODES as readonly string[]).includes(rawMode)
      ? (rawMode as EmitterMode)
      : "continuous";
    cfg.burstCount = Math.max(0, toInt(gval(d, "burst_count", 30), 30));
    cfg.coverage = toFloat(gval(d, "coverage", 1.0), 1.0);
    if (cfg.coverage < 0.05) cfg.coverage = 0.05;
    const rawQuality = String(gval(d, "field_quality", "medium"));
    cfg.fieldQuality = (FIELD_QUALITIES as readonly string[]).includes(
      rawQuality,
    )
      ? (rawQuality as FieldQuality)
      : "medium";
    cfg.groundBias = Boolean(gval(d, "ground_bias", false));
    cfg.timing = EmitterTiming.fromDict(
      Object.hasOwn(d, "timing") ? d["timing"] : undefined,
    );
    return cfg;
  }
}

export function parseParticleDict(root: unknown): ParticleSystemConfig[] {
  if (!isRecord(root)) {
    throw new MapParseError("root: expected object");
  }
  const rawSystems = root["particle_systems"] ?? [];
  if (!Array.isArray(rawSystems)) {
    throw new MapParseError("root.particle_systems: expected array");
  }
  return rawSystems.map((item, i) => {
    if (!isRecord(item)) {
      throw new MapParseError(`root.particle_systems[${i}]: expected object`);
    }
    const name = String(item["name"] ?? "");
    const cfgRaw = item["config"];
    const cfgDict = isRecord(cfgRaw) ? cfgRaw : {};
    return ParticleSystemConfig.fromDict(cfgDict, name);
  });
}

export function parseParticleJson(text: string): ParticleSystemConfig[] {
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch (err) {
    throw new MapParseError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return parseParticleDict(payload);
}
