export type Vec2 = readonly [x: number, y: number];

export type MutableVec2 = [x: number, y: number];

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function tileKey(x: number, y: number): string {
  return `${x};${y}`;
}

export function parseTileKey(key: string): Vec2 | null {
  const sep = key.indexOf(";");
  if (sep < 0) return null;
  const x = Number(key.slice(0, sep));
  const y = Number(key.slice(sep + 1));
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return [x, y];
}

export function pointInRect(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y
  );
}
