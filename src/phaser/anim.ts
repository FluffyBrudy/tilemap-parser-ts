import type Phaser from "phaser";
import type { AnimationLibrary } from "../core/index.js";

export interface AnimBuildResult {
  readonly created: string[];
  readonly skipped: string[];
}

export function buildAnimations(
  anims: Phaser.Animations.AnimationManager,
  library: AnimationLibrary,
  textureKey: string,
  prefix = "",
): AnimBuildResult {
  const created: string[] = [];
  const skipped: string[] = [];
  for (const clip of library.animations.values()) {
    const key = `${prefix}${clip.name}`;
    if (clip.frames.length === 0 || anims.exists(key)) {
      skipped.push(key);
      continue;
    }
    anims.create({
      key,
      frames: clip.frames.map((f) => ({
        key: textureKey,
        frame: f.variantId,
        duration: f.durationMs,
      })),
      frameRate: clip.fps,
      repeat: clip.loop ? -1 : 0,
    });
    created.push(key);
  }
  return { created, skipped };
}
