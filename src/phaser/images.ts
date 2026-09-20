import type Phaser from "phaser";
import type { ParsedMap } from "../core/index.js";
import { imageLayerKey } from "./keys.js";

export interface ImageBuildOptions {
  readonly renderScale?: number;

  readonly baseDepth?: number;
  readonly includeHidden?: boolean;
}

export interface ImageBuildResult {
  readonly images: Phaser.GameObjects.Image[];
  readonly skippedLayers: string[];
}

export function buildImageLayers(
  scene: Phaser.Scene,
  map: ParsedMap,
  options: ImageBuildOptions = {},
): ImageBuildResult {
  const rs = options.renderScale ?? map.meta.renderScale;
  const baseDepth = options.baseDepth ?? -10;
  const images: Phaser.GameObjects.Image[] = [];
  const skippedLayers: string[] = [];

  const ordered = [...map.layers].sort(
    (a, b) => a.zIndex - b.zIndex || a.id - b.id,
  );
  ordered.forEach((layer) => {
    if (layer.layerType !== "image" || layer.imagePath === null) return;
    if (!layer.visible && options.includeHidden !== true) {
      skippedLayers.push(layer.name);
      return;
    }
    const key = imageLayerKey(layer.id);
    if (!scene.textures.exists(key)) {
      skippedLayers.push(layer.name);
      return;
    }
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    if (layer.imageRect !== null) {
      const [x, y, w, h] = layer.imageRect;
      if (w > 0 && h > 0) rects.push({ x, y, w, h });
    }
    for (const p of layer.imagePlacements) {
      if (p.w > 0 && p.h > 0) rects.push({ x: p.x, y: p.y, w: p.w, h: p.h });
    }
    for (const rc of rects) {
      images.push(
        scene.add
          .image(rc.x * rs, rc.y * rs, key)
          .setOrigin(0)
          .setDisplaySize(rc.w * rs, rc.h * rs)
          .setDepth(baseDepth + layer.zIndex),
      );
    }
  });
  return { images, skippedLayers };
}
