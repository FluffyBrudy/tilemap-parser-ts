import type Phaser from "phaser";
import { resolveResourceUrl, type ParsedMap } from "../core/index.js";
import { collectAssetRefs } from "./keys.js";

export interface QueueOptions {
  readonly mapUrl: string;

  readonly extraBaseUrls?: readonly string[];
}

export function queueMapAssets(
  scene: Phaser.Scene,
  map: ParsedMap,
  options: QueueOptions,
): string[] {
  const keys: string[] = [];
  for (const asset of collectAssetRefs(map)) {
    const url = resolveResourceUrl(asset.ref, {
      mapUrl: options.mapUrl,
      extraBaseUrls: options.extraBaseUrls,
    });
    scene.load.image(asset.key, encodeURI(url));
    keys.push(asset.key);
  }
  return keys;
}

export function queueAnimSheet(
  scene: Phaser.Scene,
  key: string,
  ref: string,
  frameWidth: number,
  frameHeight: number,
  options: QueueOptions,
): string {
  const url = resolveResourceUrl(ref, {
    mapUrl: options.mapUrl,
    extraBaseUrls: options.extraBaseUrls,
  });
  scene.load.spritesheet(key, encodeURI(url), { frameWidth, frameHeight });
  return key;
}
