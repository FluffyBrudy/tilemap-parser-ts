import type { ParsedMap } from "../core/index.js";
import type { Vec2 } from "../core/index.js";

export interface SpawnMarkers {
  readonly player: Vec2 | null;

  readonly others: ReadonlyMap<string, Vec2[]>;
}

const PLAYER_SPAWN_NAMES = new Set(["player_spwan", "player_spawn", "player"]);

export function findSpawnMarkers(
  map: ParsedMap,
  renderScale?: number,
): SpawnMarkers {
  const rs = renderScale ?? map.meta.renderScale;
  let player: Vec2 | null = null;
  const others = new Map<string, Vec2[]>();
  for (const layer of map.layers) {
    if (layer.layerType !== "object") continue;
    for (const obj of layer.objects.values()) {
      const rawName = obj.properties?.["name"];
      if (typeof rawName !== "string" || rawName === "") continue;
      const center: Vec2 = [
        (obj.area.x + obj.area.w / 2) * rs,
        (obj.area.y + obj.area.h / 2) * rs,
      ];
      if (PLAYER_SPAWN_NAMES.has(rawName)) {
        player = center;
      } else {
        const list = others.get(rawName) ?? [];
        list.push(center);
        others.set(rawName, list);
      }
    }
  }
  return { player, others };
}
