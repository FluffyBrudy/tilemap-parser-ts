import {
  aabbOverlap,
  getShapeAabb,
  type CollisionInfo,
} from "../../utils/geometry.js";
import type { ICollidable } from "../protocols.js";
import { checkPair, combinedAabb, getShapes } from "./shapes.js";

export class CollisionHit {
  readonly objectA: ICollidable;
  readonly objectB: ICollidable;
  readonly normal: readonly [number, number];
  readonly depth: number;

  constructor(
    objectA: ICollidable,
    objectB: ICollidable,
    normal: readonly [number, number],
    depth: number,
  ) {
    this.objectA = objectA;
    this.objectB = objectB;
    this.normal = normal;
    this.depth = depth;
  }

  resolve(): void {
    const sepX = this.normal[0] * this.depth * 0.5;
    const sepY = this.normal[1] * this.depth * 0.5;
    this.objectA.x -= sepX;
    this.objectA.y -= sepY;
    this.objectB.x += sepX;
    this.objectB.y += sepY;
  }

  slideVelocity(vx: number, vy: number): [number, number] {
    const dot = vx * this.normal[0] + vy * this.normal[1];
    if (dot > 0) {
      return [vx - this.normal[0] * dot, vy - this.normal[1] * dot];
    }
    return [vx, vy];
  }

  involves(obj: ICollidable): boolean {
    return this.objectA === obj || this.objectB === obj;
  }

  other(obj: ICollidable): ICollidable {
    if (this.objectA === obj) return this.objectB;
    if (this.objectB === obj) return this.objectA;
    throw new Error("Object is not part of this collision hit");
  }
}

function layerMask(obj: Layered): [number, number] {
  if (obj.collisionLayer === undefined || obj.collisionMask === undefined) {
    const kind =
      (obj as { constructor?: { name?: string } }).constructor?.name ??
      "Object";
    throw new TypeError(
      `${kind} is missing required collision members: set collision_layer and collision_mask explicitly (no implicit defaults).`,
    );
  }
  return [obj.collisionLayer, obj.collisionMask];
}

export interface Layered {
  readonly collisionLayer: number;
  readonly collisionMask: number;
}

export function shouldCollide(objA: Layered, objB: Layered): boolean {
  const [aLayer, aMask] = layerMask(objA);
  const [bLayer, bMask] = layerMask(objB);
  return (aMask & bLayer) !== 0 && (bMask & aLayer) !== 0;
}

export function checkCollision(
  objA: ICollidable,
  objB: ICollidable,
): CollisionHit | null {
  if (!shouldCollide(objA, objB)) return null;

  const shapesA = getShapes(objA);
  const shapesB = getShapes(objB);
  if (shapesA.length === 0 || shapesB.length === 0) {
    console.warn(
      `Skipping collision query for shapeless ${
        shapesA.length === 0 ? "first" : "second"
      } object: no collision shapes (gate on has_collision before querying).`,
    );
    return null;
  }

  const aabbA =
    shapesA.length === 1 && shapesA[0] !== undefined
      ? getShapeAabb(objA.x, objA.y, shapesA[0])
      : combinedAabb(objA.x, objA.y, shapesA);
  const aabbB =
    shapesB.length === 1 && shapesB[0] !== undefined
      ? getShapeAabb(objB.x, objB.y, shapesB[0])
      : combinedAabb(objB.x, objB.y, shapesB);
  if (!aabbOverlap(aabbA, aabbB)) return null;

  let deepest: CollisionInfo | null = null;
  for (const shapeA of shapesA) {
    for (const shapeB of shapesB) {
      const pairA = getShapeAabb(objA.x, objA.y, shapeA);
      const pairB = getShapeAabb(objB.x, objB.y, shapeB);
      if (!aabbOverlap(pairA, pairB)) continue;
      const info = checkPair(objA, objB, shapeA, shapeB, pairA, pairB);
      if (info !== null && (deepest === null || info.depth > deepest.depth)) {
        deepest = info;
      }
    }
  }
  if (deepest === null) return null;
  return new CollisionHit(objA, objB, deepest.normal, deepest.depth);
}
