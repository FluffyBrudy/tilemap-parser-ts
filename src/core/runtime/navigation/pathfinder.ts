import type { Vec2 } from "../../vec.js";
import type { NavGrid } from "./nav_grid.js";

interface HeapEntry {
  f: number;
  x: number;
  y: number;
}

function heapPush(heap: HeapEntry[], entry: HeapEntry): void {
  heap.push(entry);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    const parentEntry = heap[parent];
    if (parentEntry === undefined || parentEntry.f <= entry.f) break;
    const current = heap[i];
    if (current === undefined) break;
    heap[i] = parentEntry;
    heap[parent] = current;
    i = parent;
  }
}

function heapPop(heap: HeapEntry[]): HeapEntry | null {
  const top = heap[0];
  if (top === undefined) return null;
  const last = heap.pop();
  if (heap.length > 0 && last !== undefined) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      const current = heap[i];
      const leftEntry = heap[left];
      const rightEntry = heap[right];
      if (
        leftEntry !== undefined &&
        current !== undefined &&
        leftEntry.f < current.f
      ) {
        smallest = left;
      }
      const smallestEntry = heap[smallest];
      if (
        rightEntry !== undefined &&
        smallestEntry !== undefined &&
        rightEntry.f < smallestEntry.f
      ) {
        smallest = right;
      }
      if (smallest === i) break;
      const a = heap[i];
      const b = heap[smallest];
      if (a === undefined || b === undefined) break;
      heap[i] = b;
      heap[smallest] = a;
      i = smallest;
    }
  }
  return top;
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export class Pathfinder {
  readonly navGrid: NavGrid;

  constructor(navGrid: NavGrid) {
    this.navGrid = navGrid;
  }

  findPath(start: Vec2, end: Vec2, maxSteps = 2000): Vec2[] | null {
    const [sx, sy] = start;
    const [ex, ey] = end;
    if (!this.navGrid.isWalkable(ex, ey)) return null;

    const key = (x: number, y: number): string => `${x},${y}`;
    const open: HeapEntry[] = [{ f: 0.0, x: sx, y: sy }];
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[key(sx, sy), 0.0]]);
    const closed = new Set<string>();
    let steps = 0;

    while (open.length > 0 && steps < maxSteps) {
      const current = heapPop(open);
      if (current === null) break;
      const currentKey = key(current.x, current.y);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      steps += 1;

      if (current.x === ex && current.y === ey) {
        const path: Vec2[] = [[current.x, current.y]];
        let cursor = currentKey;
        while (cameFrom.has(cursor)) {
          const prev = cameFrom.get(cursor);
          if (prev === undefined) break;
          cursor = prev;
          const [px, py] = prev.split(",").map(Number) as [number, number];
          path.push([px, py]);
        }
        return path.reverse();
      }

      for (const [nx, ny] of this.navGrid.getNeighbors(current.x, current.y)) {
        const tentative = (gScore.get(currentKey) ?? Infinity) + 1.0;
        const nKey = key(nx, ny);
        if (tentative < (gScore.get(nKey) ?? Infinity)) {
          cameFrom.set(nKey, currentKey);
          gScore.set(nKey, tentative);
          heapPush(open, {
            f: tentative + manhattan(nx, ny, ex, ey),
            x: nx,
            y: ny,
          });
        }
      }
    }
    return null;
  }
}
