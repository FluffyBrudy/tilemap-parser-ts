import {
  parseAnimationDict,
  parseCharacterCollisionDict,
  type AnimationLibrary,
  type CharacterCollision,
} from "tilemap-parser-ts/core";

export const STATE_ANIM_KEYS = [
  "player",
  "ghost",
  "spider",
  "thing",
  "explosion",
] as const;
export const CHAR_COLLISION_KEYS = ["bullet", "ghost", "player"] as const;

export interface SharedAssets {
  readonly anims: ReadonlyMap<string, AnimationLibrary>;
  readonly collisions: ReadonlyMap<string, CharacterCollision>;
  readonly sheetKey: ReadonlyMap<string, string>;
}

export function sheetKeyFor(name: string): string {
  return `anim:${name}`;
}

export async function loadSharedAssets(
  renderScale: number,
): Promise<SharedAssets> {
  const anims = new Map<string, AnimationLibrary>();
  const sheetKey = new Map<string, string>();
  for (const key of STATE_ANIM_KEYS) {
    const res = await fetch(`data/animations/${key}.anim.json`);
    if (!res.ok) throw new Error(`missing anim json: ${key}`);
    const lib = parseAnimationDict((await res.json()) as unknown);
    anims.set(key, lib);
    sheetKey.set(key, sheetKeyFor(key));
  }
  const collisions = new Map<string, CharacterCollision>();
  for (const key of CHAR_COLLISION_KEYS) {
    const res = await fetch(`data/character_collision/${key}.collision.json`);
    if (!res.ok) throw new Error(`missing collision json: ${key}`);
    collisions.set(
      key,
      parseCharacterCollisionDict((await res.json()) as unknown, renderScale),
    );
  }
  return { anims, collisions, sheetKey };
}
