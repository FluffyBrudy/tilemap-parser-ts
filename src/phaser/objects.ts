import type Phaser from "phaser";
import type { ParsedMap, ParsedObject } from "../core/index.js";

export interface StampOptions {
  readonly renderScale?: number;
  readonly baseDepth?: number;
  readonly includeHidden?: boolean;

  readonly layerNames?: readonly string[];

  readonly sheetSizes: ReadonlyMap<
    number,
    { readonly w: number; readonly h: number }
  >;

  readonly textureKey: (ttype: number) => string;
}

export interface StampBuildResult {
  readonly images: Phaser.GameObjects.Image[];

  readonly skipped: number;
}

export function sheetCols(
  sheetW: number,
  sheetH: number,
  tileW: number,
  tileH: number,
): number | null {
  if (tileW <= 0 || tileH <= 0 || sheetW <= 0 || sheetH <= 0) return null;
  const cols = Math.floor(sheetW / tileW);
  return cols > 0 ? cols : null;
}

export function buildObjectStamps(
  scene: Phaser.Scene,
  map: ParsedMap,
  options: StampOptions,
): StampBuildResult {
  const rs = options.renderScale ?? map.meta.renderScale;
  const baseDepth = options.baseDepth ?? 5;
  const images: Phaser.GameObjects.Image[] = [];
  let skipped = 0;
  const [tw, th] = map.meta.tileSize;

  const ordered = [...map.layers].sort(
    (a, b) => a.zIndex - b.zIndex || a.id - b.id,
  );
  const wanted = options.layerNames ?? ["objects"];
  for (const layer of ordered) {
    if (layer.layerType !== "object") continue;
    if (!wanted.includes(layer.name)) continue;
    if (!layer.visible && options.includeHidden !== true) continue;
    for (const obj of layer.objects.values()) {
      const img = buildStamp(
        scene,
        obj,
        tw,
        th,
        rs,
        baseDepth + layer.zIndex,
        options,
      );
      if (img === null) skipped += 1;
      else images.push(img);
    }
  }
  return { images, skipped };
}

function buildStamp(
  scene: Phaser.Scene,
  obj: ParsedObject,
  tw: number,
  th: number,
  rs: number,
  depth: number,
  options: StampOptions,
): Phaser.GameObjects.Image | null {
  const size = options.sheetSizes.get(obj.ttype);
  if (size === undefined) return null;
  const key = options.textureKey(obj.ttype);
  if (!scene.textures.exists(key)) return null;
  const { w: areaW, h: areaH } = obj.area;
  if (areaW <= 0 || areaH <= 0) return null;
  const cols = sheetCols(size.w, size.h, tw, th);
  if (cols === null) return null;
  const srcX = (obj.variant % cols) * tw;
  const srcY = Math.floor(obj.variant / cols) * th;
  if (srcX + areaW > size.w || srcY + areaH > size.h) return null;
  return scene.add
    .image(obj.area.x * rs, obj.area.y * rs, key)
    .setOrigin(0)
    .setCrop(srcX, srcY, areaW, areaH)
    .setDisplaySize(areaW * rs, areaH * rs)
    .setDepth(depth);
}
