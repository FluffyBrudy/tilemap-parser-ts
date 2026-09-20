import {
  CapsuleShape,
  CircleShape,
  CollisionPolygon,
  RectangleShape,
  type CharacterShape,
} from "../../parser/collision.js";
import {
  capsuleVsCapsule,
  capsuleVsCircle,
  capsuleVsPolygon,
  capsuleVsRect,
  circleVsCircle,
  getShapeAabb,
  polygonVsCircle,
  polygonVsPolygon,
  polygonVsRect,
  rectVsCircle,
  rectVsRect,
  type AABB,
  type CollisionInfo,
} from "../../utils/geometry.js";
import type { ICollidable } from "../protocols.js";

export type MultiShape = ICollidable & { collisionShapes?: CharacterShape[] };

export function getShapes(obj: ICollidable): CharacterShape[] {
  const multi = (obj as MultiShape).collisionShapes;
  if (multi !== undefined && multi !== null && multi.length > 0) {
    return [...multi];
  }
  const single = (obj as Partial<ICollidable>).collisionShape;
  if (single === undefined || single === null) return [];
  return [single];
}

export function combinedAabb(
  x: number,
  y: number,
  shapes: CharacterShape[],
): AABB {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const shape of shapes) {
    const [sx0, sy0, sx1, sy1] = getShapeAabb(x, y, shape);
    if (sx0 < left) left = sx0;
    if (sy0 < top) top = sy0;
    if (sx1 > right) right = sx1;
    if (sy1 > bottom) bottom = sy1;
  }
  return [left, top, right, bottom];
}

function flipResult(info: CollisionInfo | null): CollisionInfo | null {
  if (info === null) return null;
  return { normal: [-info.normal[0], -info.normal[1]], depth: info.depth };
}

export function checkPair(
  objA: ICollidable,
  objB: ICollidable,
  shapeA: CharacterShape,
  shapeB: CharacterShape,
  aabbA: AABB,
  aabbB: AABB,
): CollisionInfo | null {
  if (shapeA instanceof CircleShape && shapeB instanceof CircleShape) {
    const ca: [number, number] = [
      objA.x + shapeA.offset[0],
      objA.y + shapeA.offset[1],
    ];
    const cb: [number, number] = [
      objB.x + shapeB.offset[0],
      objB.y + shapeB.offset[1],
    ];
    return circleVsCircle(ca, shapeA.radius, cb, shapeB.radius);
  }
  if (shapeA instanceof RectangleShape && shapeB instanceof RectangleShape) {
    return rectVsRect(aabbA, aabbB);
  }
  if (shapeA instanceof RectangleShape && shapeB instanceof CircleShape) {
    const cb: [number, number] = [
      objB.x + shapeB.offset[0],
      objB.y + shapeB.offset[1],
    ];
    return rectVsCircle(aabbA, cb, shapeB.radius);
  }
  if (shapeA instanceof CircleShape && shapeB instanceof RectangleShape) {
    const ca: [number, number] = [
      objA.x + shapeA.offset[0],
      objA.y + shapeA.offset[1],
    ];
    return flipResult(rectVsCircle(aabbB, ca, shapeA.radius));
  }
  if (
    shapeA instanceof CollisionPolygon &&
    shapeB instanceof CollisionPolygon
  ) {
    const vertsA = shapeA.vertices.map((v): [number, number] => [
      objA.x + v[0],
      objA.y + v[1],
    ]);
    const vertsB = shapeB.vertices.map((v): [number, number] => [
      objB.x + v[0],
      objB.y + v[1],
    ]);
    return polygonVsPolygon(vertsA, vertsB);
  }
  if (shapeA instanceof CollisionPolygon && shapeB instanceof CircleShape) {
    const vertsA = shapeA.vertices.map((v): [number, number] => [
      objA.x + v[0],
      objA.y + v[1],
    ]);
    const centerB: [number, number] = [
      objB.x + shapeB.offset[0],
      objB.y + shapeB.offset[1],
    ];
    return polygonVsCircle(vertsA, centerB, shapeB.radius);
  }
  if (shapeA instanceof CircleShape && shapeB instanceof CollisionPolygon) {
    const vertsB = shapeB.vertices.map((v): [number, number] => [
      objB.x + v[0],
      objB.y + v[1],
    ]);
    const centerA: [number, number] = [
      objA.x + shapeA.offset[0],
      objA.y + shapeA.offset[1],
    ];
    return flipResult(polygonVsCircle(vertsB, centerA, shapeA.radius));
  }
  if (shapeA instanceof CollisionPolygon && shapeB instanceof RectangleShape) {
    const vertsA = shapeA.vertices.map((v): [number, number] => [
      objA.x + v[0],
      objA.y + v[1],
    ]);
    return polygonVsRect(vertsA, aabbB);
  }
  if (shapeA instanceof RectangleShape && shapeB instanceof CollisionPolygon) {
    const vertsB = shapeB.vertices.map((v): [number, number] => [
      objB.x + v[0],
      objB.y + v[1],
    ]);
    return flipResult(polygonVsRect(vertsB, aabbA));
  }
  if (shapeA instanceof CapsuleShape && shapeB instanceof CapsuleShape) {
    const p1: [number, number] = [
      objA.x + shapeA.offset[0],
      objA.y + shapeA.offset[1],
    ];
    const p2: [number, number] = [p1[0], p1[1] + shapeA.height];
    const q1: [number, number] = [
      objB.x + shapeB.offset[0],
      objB.y + shapeB.offset[1],
    ];
    const q2: [number, number] = [q1[0], q1[1] + shapeB.height];
    return capsuleVsCapsule(p1, p2, shapeA.radius, q1, q2, shapeB.radius);
  }
  if (shapeA instanceof CapsuleShape && shapeB instanceof CircleShape) {
    const p1: [number, number] = [
      objA.x + shapeA.offset[0],
      objA.y + shapeA.offset[1],
    ];
    const p2: [number, number] = [p1[0], p1[1] + shapeA.height];
    const cb: [number, number] = [
      objB.x + shapeB.offset[0],
      objB.y + shapeB.offset[1],
    ];
    return capsuleVsCircle(p1, p2, shapeA.radius, cb, shapeB.radius);
  }
  if (shapeA instanceof CircleShape && shapeB instanceof CapsuleShape) {
    const ca: [number, number] = [
      objA.x + shapeA.offset[0],
      objA.y + shapeA.offset[1],
    ];
    const q1: [number, number] = [
      objB.x + shapeB.offset[0],
      objB.y + shapeB.offset[1],
    ];
    const q2: [number, number] = [q1[0], q1[1] + shapeB.height];
    return flipResult(
      capsuleVsCircle(q1, q2, shapeB.radius, ca, shapeA.radius),
    );
  }
  if (shapeA instanceof CapsuleShape && shapeB instanceof RectangleShape) {
    const p1: [number, number] = [
      objA.x + shapeA.offset[0],
      objA.y + shapeA.offset[1],
    ];
    const p2: [number, number] = [p1[0], p1[1] + shapeA.height];
    return capsuleVsRect(p1, p2, shapeA.radius, aabbB);
  }
  if (shapeA instanceof RectangleShape && shapeB instanceof CapsuleShape) {
    const q1: [number, number] = [
      objB.x + shapeB.offset[0],
      objB.y + shapeB.offset[1],
    ];
    const q2: [number, number] = [q1[0], q1[1] + shapeB.height];
    return flipResult(capsuleVsRect(q1, q2, shapeB.radius, aabbA));
  }
  if (shapeA instanceof CapsuleShape && shapeB instanceof CollisionPolygon) {
    const p1: [number, number] = [
      objA.x + shapeA.offset[0],
      objA.y + shapeA.offset[1],
    ];
    const p2: [number, number] = [p1[0], p1[1] + shapeA.height];
    const vertsB = shapeB.vertices.map((v): [number, number] => [
      objB.x + v[0],
      objB.y + v[1],
    ]);
    return capsuleVsPolygon(p1, p2, shapeA.radius, vertsB);
  }
  if (shapeA instanceof CollisionPolygon && shapeB instanceof CapsuleShape) {
    const vertsA = shapeA.vertices.map((v): [number, number] => [
      objA.x + v[0],
      objA.y + v[1],
    ]);
    const q1: [number, number] = [
      objB.x + shapeB.offset[0],
      objB.y + shapeB.offset[1],
    ];
    const q2: [number, number] = [q1[0], q1[1] + shapeB.height];
    return flipResult(capsuleVsPolygon(q1, q2, shapeB.radius, vertsA));
  }
  console.warn(
    `Unhandled collision shape pair: ${shapeA.kind} vs ${shapeB.kind}`,
  );
  return null;
}
