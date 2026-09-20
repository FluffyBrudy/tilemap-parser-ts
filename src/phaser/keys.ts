import type { ParsedMap } from "../core/index.js";

export interface AssetRef {
  readonly key: string;

  readonly ref: string;
  readonly kind: "tileset" | "image" | "anim";
}

export function tilesetKey(index: number): string {
  return `tileset:${index}`;
}

export function imageLayerKey(layerId: number): string {
  return `image:${layerId}`;
}

export function animSheetKey(name: string): string {
  return `anim:${name}`;
}

export function collectAssetRefs(map: ParsedMap): AssetRef[] {
  const out: AssetRef[] = [];
  map.tilesets.forEach((ts, i) => {
    const ref = ts.path;
    if (ref !== "") {
      out.push({ key: tilesetKey(i), ref, kind: "tileset" });
    }
  });
  for (const layer of map.layers) {
    if (layer.imagePath !== null) {
      out.push({
        key: imageLayerKey(layer.id),
        ref: layer.imagePath,
        kind: "image",
      });
    }
  }
  return out;
}
