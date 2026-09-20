import type { ParticleSystemConfig } from "../core/index.js";

export interface PhaserEmitterConfig {
  readonly speed: { readonly min: number; readonly max: number };
  readonly lifespan: { readonly min: number; readonly max: number };
  readonly scale: { readonly start: number; readonly end: number };
  readonly alpha: { readonly start: number; readonly end: number };
  readonly rotate: { readonly min: number; readonly max: number };
  readonly gravityX: number;
  readonly gravityY: number;
  readonly frequency: number;
  readonly maxParticles: number;
  readonly tint: { readonly start: number; readonly end: number };
  readonly blendMode: "NORMAL" | "ADD";
}

function rgb(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export function translateParticleConfig(
  cfg: ParticleSystemConfig,
  fieldAdditive = false,
): PhaserEmitterConfig {
  const lifespanMin = cfg.lifetimeMin * 1000;
  const lifespanMax = cfg.lifetimeMax * 1000;
  return {
    speed: { min: cfg.speedMin, max: cfg.speedMax },
    lifespan: { min: lifespanMin, max: lifespanMax },
    scale: { start: cfg.startScale, end: cfg.endScale },
    alpha: { start: cfg.startColorA / 255, end: cfg.endColorA / 255 },
    rotate: { min: -cfg.rotationSpeed, max: cfg.rotationSpeed },
    gravityX: cfg.gravityX,
    gravityY: cfg.gravityY,
    frequency: cfg.spawnRate > 0 ? 1000 / cfg.spawnRate : -1,
    maxParticles: cfg.maxParticles,
    tint: {
      start: rgb(cfg.startColorR, cfg.startColorG, cfg.startColorB),
      end: rgb(cfg.endColorR, cfg.endColorG, cfg.endColorB),
    },
    blendMode: fieldAdditive ? "ADD" : "NORMAL",
  };
}
