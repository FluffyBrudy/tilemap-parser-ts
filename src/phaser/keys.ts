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
  const seen = new Set<string>();
  map.tilesets.forEach((ts, i) => {
    const ref = ts.path;
    if (ref !== "" && !seen.has(`t:${ref}`)) {
      seen.add(`t:${ref}`);
      out.push({ key: tilesetKey(i), ref, kind: "tileset" });
    }
  });
  for (const layer of map.layers) {
    if (layer.imagePath !== null && !seen.has(`i:${layer.imagePath}`)) {
      seen.add(`i:${layer.imagePath}`);
      out.push({
        key: imageLayerKey(layer.id),
        ref: layer.imagePath,
        kind: "image",
      });
    }
  }
  return out;
}
