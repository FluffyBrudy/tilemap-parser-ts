import { getShapeAabb } from "../../utils/geometry.js";
import type { AABB } from "../../utils/geometry.js";
import type { ICollidable } from "../protocols.js";
import { checkCollision, type CollisionHit } from "./hit.js";
import { combinedAabb, getShapes } from "./shapes.js";

export class ObjectCollisionManager {
  readonly objects: ICollidable[] = [];
  readonly cellSize: number;

  constructor(objects: Iterable<ICollidable> | null = null, cellSize = 128.0) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) {
      throw new RangeError("cell_size must be a finite positive number");
    }
    this.cellSize = cellSize;
    if (objects !== null) {
      for (const obj of objects) this.addObject(obj);
    }
  }

  get size(): number {
    return this.objects.length;
  }

  has(obj: ICollidable): boolean {
    return this.objects.some((existing) => existing === obj);
  }

  addObject(obj: ICollidable): void {
    if (this.has(obj)) {
      console.warn("Object is already in the collision manager, skipping.");
      return;
    }
    if (getShapes(obj).length === 0) {
      console.warn(
        "Object has no collision shapes, not added: gate on has_collision before adding (render-only objects do not belong in the manager).",
      );
      return;
    }
    this.objects.push(obj);
  }

  removeObject(obj: ICollidable): void {
    const index = this.objects.findIndex((existing) => existing === obj);
    if (index === -1) {
      console.warn("Object is not in the collision manager, skipping.");
      return;
    }
    this.objects.splice(index, 1);
  }

  clear(): void {
    this.objects.length = 0;
  }

  private *cellsForAabb(aabb: AABB): Generator<[number, number]> {
    const [left, top, right, bottom] = aabb;
    const minX = Math.floor(left / this.cellSize);
    const maxX = Math.floor(right / this.cellSize);
    const minY = Math.floor(top / this.cellSize);
    const maxY = Math.floor(bottom / this.cellSize);
    for (let cy = minY; cy <= maxY; cy += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        yield [cx, cy];
      }
    }
  }

  private objectAabb(obj: ICollidable): AABB | null {
    const shapes = getShapes(obj);
    if (shapes.length === 0) return null;
    if (shapes.length === 1 && shapes[0] !== undefined) {
      return getShapeAabb(obj.x, obj.y, shapes[0]);
    }
    return combinedAabb(obj.x, obj.y, shapes);
  }

  private buildSpatialIndex(): {
    objects: ICollidable[];
    grid: Map<string, number[]>;
  } {
    const objects = [...this.objects];
    const grid = new Map<string, number[]>();
    objects.forEach((obj, index) => {
      const aabb = this.objectAabb(obj);
      if (aabb === null) return;
      for (const [cx, cy] of this.cellsForAabb(aabb)) {
        const key = `${cx},${cy}`;
        const list = grid.get(key) ?? [];
        list.push(index);
        grid.set(key, list);
      }
    });
    return { objects, grid };
  }

  private candidateIndices(
    obj: ICollidable,
    grid: Map<string, number[]>,
  ): Set<number> {
    const aabb = this.objectAabb(obj);
    if (aabb === null) return new Set();
    const candidates = new Set<number>();
    for (const [cx, cy] of this.cellsForAabb(aabb)) {
      for (const idx of grid.get(`${cx},${cy}`) ?? []) {
        candidates.add(idx);
      }
    }
    return candidates;
  }

  checkAllCollisions(): CollisionHit[] {
    const { objects, grid } = this.buildSpatialIndex();
    const hits: CollisionHit[] = [];
    objects.forEach((obj, i) => {
      const candidates = [...this.candidateIndices(obj, grid)].sort(
        (a, b) => a - b,
      );
      for (const j of candidates) {
        if (j <= i) continue;
        const other = objects[j];
        if (other === undefined) continue;
        const hit = checkCollision(obj, other);
        if (hit !== null) hits.push(hit);
      }
    });
    return hits;
  }

  checkObject(obj: ICollidable): CollisionHit[] {
    if (getShapes(obj).length === 0) {
      console.warn("Query object has no collision shapes, skipping query.");
      return [];
    }
    const hits: CollisionHit[] = [];
    for (const other of this.objects) {
      if (other === obj) continue;
      const hit = checkCollision(obj, other);
      if (hit !== null) hits.push(hit);
    }
    return hits;
  }

  checkObjectFirst(obj: ICollidable): CollisionHit | null {
    if (getShapes(obj).length === 0) {
      console.warn("Query object has no collision shapes, skipping query.");
      return null;
    }
    for (const other of this.objects) {
      if (other === obj) continue;
      const hit = checkCollision(obj, other);
      if (hit !== null) return hit;
    }
    return null;
  }
}
