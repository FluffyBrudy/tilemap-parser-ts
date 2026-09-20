import type Phaser from "phaser";
import { parseTileKey, tileKey, type ParsedMap } from "../core/index.js";
import { tilesetKey } from "./keys.js";

export interface TileBuildOptions {
  readonly renderScale?: number;

  readonly layerTypes?: readonly string[];

  readonly skipCull?: boolean;

  readonly includeHidden?: boolean;
}

export interface TileBuildResult {
  readonly tilemap: Phaser.Tilemaps.Tilemap;
  readonly layers: Phaser.Tilemaps.TilemapLayer[];

  readonly skipped: number;
  readonly stamped: number;
}

export function buildTileLayers(
  scene: Phaser.Scene,
  map: ParsedMap,
  options: TileBuildOptions = {},
): TileBuildResult {
  const rs = options.renderScale ?? map.meta.renderScale;
  const wanted = new Set(options.layerTypes ?? ["tile"]);
  const [tw, th] = map.meta.tileSize;
  const [mw, mh] = map.meta.mapSize;

  const tilemap = scene.make.tilemap({
    tileWidth: tw,
    tileHeight: th,
    width: Math.max(1, mw),
    height: Math.max(1, mh),
  });

  const sets = new Map<number, Phaser.Tilemaps.Tileset>();
  map.tilesets.forEach((_ts, i) => {
    if (!scene.textures.exists(tilesetKey(i))) return;
    const set = tilemap.addTilesetImage(`ts${i}`, tilesetKey(i), tw, th, 0, 0);
    if (set !== null) sets.set(i, set);
  });

  const layers: Phaser.Tilemaps.TilemapLayer[] = [];
  let stamped = 0;
  let skipped = 0;
  const ordered = [...map.layers].sort(
    (a, b) => a.zIndex - b.zIndex || a.id - b.id,
  );
  for (const layer of ordered) {
    if (!wanted.has(layer.layerType)) continue;
    if (layer.visible === false && options.includeHidden !== true) continue;
    if (sets.size === 0) {
      skipped += layer.tiles.size;
      continue;
    }
    const phaserLayer = tilemap.createBlankLayer(layer.name, [
      ...sets.values(),
    ]);
    if (phaserLayer === null) {
      skipped += layer.tiles.size;
      continue;
    }
    phaserLayer.setScale(rs).setDepth(layer.zIndex);
    if (options.skipCull === true) {
      phaserLayer.skipCull = true;
    }
    for (const [key, tile] of layer.tiles) {
      const pos = parseTileKey(key);
      if (pos === null || tileKey(pos[0], pos[1]) !== key) {
        skipped += 1;
        continue;
      }
      if (typeof tile.ttype !== "number" || tile.variant < 0) {
        skipped += 1;
        continue;
      }
      const set = sets.get(tile.ttype);
      if (set === undefined) {
        skipped += 1;
        continue;
      }
      const t = phaserLayer.putTileAt(tile.variant, pos[0], pos[1]);
      if (t === null) {
        skipped += 1;
        continue;
      }
      if (tile.flipH) t.flipX = true;
      if (tile.flipV) t.flipY = true;
      stamped += 1;
    }
    layers.push(phaserLayer);
  }
  return { tilemap, layers, skipped, stamped };
}
