import { describe, expect, it } from "vitest";
import {
  aabbOverlap,
  capsuleVsCapsule,
  capsuleVsCircle,
  capsuleVsPolygon,
  capsuleVsRect,
  circleVsCircle,
  CollisionPolygon,
  CapsuleShape,
  CircleShape,
  getShapeAabb,
  polygonVsCircle,
  polygonVsPolygon,
  polygonVsRect,
  RectangleShape,
  rectVsCircle,
  rectVsRect,
} from "../../src/core/index.js";

const square: Array<[number, number]> = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

describe("aabbOverlap", () => {
  it("separates, touches, and overlaps", () => {
    expect(aabbOverlap([0, 0, 10, 10], [20, 0, 30, 10])).toBe(false);
    expect(aabbOverlap([0, 0, 10, 10], [10, 0, 20, 10])).toBe(true); // edge touch
    expect(aabbOverlap([0, 0, 10, 10], [10, 10, 20, 20])).toBe(true); // corner touch
    expect(aabbOverlap([0, 0, 10, 10], [5, 5, 15, 15])).toBe(true);
  });
});

describe("getShapeAabb", () => {
  it("bounds rect, circle, capsule, polygon", () => {
    expect(getShapeAabb(5, 5, new RectangleShape(10, 20, [1, 2]))).toEqual([6, 7, 16, 27]);
    expect(getShapeAabb(0, 0, new CircleShape(5, [10, 10]))).toEqual([5, 5, 15, 15]);
    expect(getShapeAabb(0, 0, new CapsuleShape(3, 10, [5, 5]))).toEqual([2, 2, 8, 18]);
    expect(
      getShapeAabb(100, 100, new CollisionPolygon([[0, 0], [4, 1], [2, 7]])),
    ).toEqual([100, 100, 104, 107]);
    expect(() => getShapeAabb(0, 0, { kind: "nope" } as never)).toThrow(TypeError);
  });
});

describe("circleVsCircle", () => {
  it("separates, touches, overlaps, coincides", () => {
    expect(circleVsCircle([0, 0], 5, [20, 0], 5)).toBeNull();
    expect(circleVsCircle([0, 0], 5, [10, 0], 5)).toMatchObject({
      normal: [1, 0],
      depth: 0,
    });
    const hit = circleVsCircle([0, 0], 5, [8, 0], 5);
    expect(hit?.normal).toEqual([1, 0]);
    expect(hit?.depth).toBeCloseTo(2, 10);
    expect(circleVsCircle([3, 3], 5, [3, 3], 5)).toMatchObject({
      normal: [1, 0],
      depth: 10,
    });
  });
});

describe("rectVsRect", () => {
  it("picks the minimum-penetration axis", () => {
    expect(rectVsRect([0, 0, 10, 10], [20, 20, 30, 30])).toBeNull();
    expect(rectVsRect([0, 0, 10, 10], [10, 0, 20, 10])).toMatchObject({
      normal: [1, 0],
      depth: 0,
    });
    expect(rectVsRect([0, 0, 10, 10], [8, -5, 18, 15])).toMatchObject({
      normal: [1, 0],
      depth: 2,
    });
    expect(rectVsRect([0, 0, 10, 10], [-5, -8, 15, 2])).toMatchObject({
      normal: [0, -1],
      depth: 2,
    });
  });
});

describe("rectVsCircle", () => {
  it("handles outside, touching, and center-inside", () => {
    expect(rectVsCircle([0, 0, 10, 10], [20, 5], 3)).toBeNull();
    expect(rectVsCircle([0, 0, 10, 10], [13, 5], 3)).toMatchObject({
      normal: [1, 0],
      depth: 0,
    });
    const inside = rectVsCircle([0, 0, 10, 10], [2, 5], 3);
    expect(inside?.normal).toEqual([-1, 0]);
    expect(inside?.depth).toBeCloseTo(5, 10);
  });
});

describe("polygonVsPolygon", () => {
  it("separates, touches, and reports MTV from p1 to p2", () => {
    expect(polygonVsPolygon(square, square.map(([x, y]) => [x + 20, y] as [number, number]))).toBeNull();
    const touch = polygonVsPolygon(
      square,
      square.map(([x, y]) => [x + 10, y] as [number, number]),
    );
    expect(touch?.normal[0]).toBeCloseTo(1, 10);
    expect(touch?.depth).toBeCloseTo(0, 10);
    const overlap = polygonVsPolygon(
      square,
      square.map(([x, y]) => [x + 6, y] as [number, number]),
    );
    expect(overlap?.normal[0]).toBeCloseTo(1, 10);
    expect(overlap?.depth).toBeCloseTo(4, 10);
  });
});

describe("polygonVsCircle / polygonVsRect", () => {
  it("detects circle overlap with outward normal", () => {
    expect(polygonVsCircle(square, [20, 5], 2)).toBeNull();
    const hit = polygonVsCircle(square, [11, 5], 2);
    expect(hit?.normal[0]).toBeCloseTo(1, 10);
    expect(hit?.depth).toBeCloseTo(1, 10);
  });

  it("delegates rect as a 4-gon", () => {
    expect(polygonVsRect(square, [20, 20, 30, 30])).toBeNull();
    expect(polygonVsRect(square, [5, 5, 15, 15])?.depth).toBeCloseTo(5, 10);
  });
});

describe("capsule pairs", () => {
  it("capsule-circle separates along the segment normal", () => {
    expect(capsuleVsCircle([0, 0], [0, 10], 2, [10, 5], 2)).toBeNull();
    const hit = capsuleVsCircle([0, 0], [0, 10], 2, [3, 5], 2);
    expect(hit?.normal[0]).toBeCloseTo(1, 10);
    expect(hit?.depth).toBeCloseTo(1, 10);
  });

  it("capsule-capsule uses closest-segment distance", () => {
    const hit = capsuleVsCapsule([0, 0], [0, 10], 2, [3, 0], [3, 10], 2);
    expect(hit?.normal[0]).toBeCloseTo(1, 10);
    expect(hit?.depth).toBeCloseTo(1, 10);
    expect(capsuleVsCapsule([0, 0], [0, 10], 1, [10, 0], [10, 10], 1)).toBeNull();
  });

  it("capsule-rect flips the rect normal", () => {
    const miss = capsuleVsRect([0, 0], [0, 10], 2, [3, 4, 9, 6]);
    expect(miss).toBeNull(); // reach 2 < gap 3
    const hit = capsuleVsRect([0, 0], [0, 10], 2, [1, 4, 9, 6]);
    expect(hit?.normal[0]).toBeCloseTo(1, 10); // points capsule -> rect
    expect(hit?.depth).toBeCloseTo(1, 10);
  });

  it("capsule-polygon detects and separates outward", () => {
    expect(capsuleVsPolygon([20, 0], [20, 10], 1, square)).toBeNull();
    const hit = capsuleVsPolygon([10.5, 0], [10.5, 10], 1, square);
    expect(hit).not.toBeNull();
    expect(hit?.normal[0]).toBeCloseTo(-1, 10); // capsule -> polygon
    expect(hit?.depth).toBeCloseTo(0.5, 10);
  });
});
