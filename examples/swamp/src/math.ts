import { getShapeAabb, type SpriteShape } from "tilemap-parser-ts/core";

export function midbottomToOrigin(
  x: number,
  y: number,
  shape: SpriteShape,
): [number, number] {
  const [l, , r, b] = getShapeAabb(0, 0, shape);
  return [x - (l + r) * 0.5, y - b];
}

export function moveTowards(
  source: number,
  target: number,
  dx: number,
): number {
  const step = Math.abs(dx);
  if (source < target) return Math.min(source + step, target);
  return Math.max(source - step, target);
}
