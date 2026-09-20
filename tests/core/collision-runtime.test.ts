import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Body,
  CapsuleShape,
  CircleShape,
  CollisionPolygon,
  ObjectCollisionManager,
  RectangleShape,
  checkCollision,
  shouldCollide,
  type ICollidable,
} from "../../src/core/index.js";

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  layer = 1,
  mask = 0xffffffff,
): ICollidable {
  return { x, y, collisionShape: new RectangleShape(w, h), collisionLayer: layer, collisionMask: mask };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("shouldCollide", () => {
  it("requires mutual agreement", () => {
    const a = rect(0, 0, 10, 10, 1, 2);
    const b = rect(0, 0, 10, 10, 2, 1);
    expect(shouldCollide(a, b)).toBe(true);
    expect(shouldCollide(a, rect(0, 0, 10, 10, 2, 4))).toBe(false); // b ignores 1
  });

  it("raises loudly on missing members", () => {
    expect(() => shouldCollide({ x: 0, y: 0 } as ICollidable, rect(0, 0, 1, 1))).toThrow(
      TypeError,
    );
  });
});

describe("checkCollision", () => {
  it("hits overlapping rects with MTV and resolves", () => {
    const a = rect(0, 0, 10, 10);
    const b = rect(8, 0, 10, 10);
    const hit = checkCollision(a, b);
    expect(hit?.normal).toEqual([1, 0]);
    expect(hit?.depth).toBe(2);
    expect(hit?.involves(a)).toBe(true);
    expect(hit?.other(a)).toBe(b);
    expect(() => hit?.other(rect(99, 99, 1, 1))).toThrow();
    hit?.resolve();
    expect(a.x).toBe(-1);
    expect(b.x).toBe(9);
  });

  it("slides velocity along the surface", () => {
    const hit = checkCollision(rect(0, 0, 10, 10), rect(8, 0, 10, 10));
    expect(hit?.slideVelocity(5, 3)).toEqual([0, 3]);
    expect(hit?.slideVelocity(-5, 3)).toEqual([-5, 3]); // moving away: unchanged
  });

  it("returns null when separated or filtered", () => {
    expect(checkCollision(rect(0, 0, 10, 10), rect(50, 50, 10, 10))).toBeNull();
    expect(checkCollision(rect(0, 0, 10, 10, 1, 1), rect(5, 5, 10, 10, 2, 2))).toBeNull();
  });

  it("warns and skips shapeless pairs (with members present)", () => {
    const shapeless = { x: 0, y: 0, collisionLayer: 1, collisionMask: 0xffffffff } as never;
    expect(checkCollision(shapeless, rect(0, 0, 10, 10))).toBeNull();
  });
});

describe("ObjectCollisionManager", () => {
  it("adds once, refuses shapeless, pairs once", () => {
    const manager = new ObjectCollisionManager();
    const a = rect(0, 0, 10, 10);
    const b = rect(5, 5, 10, 10);
    const far = rect(100, 100, 10, 10);
    manager.addObject(a);
    manager.addObject(a); // dup: warned, skipped
    manager.addObject({ x: 0, y: 0 } as never); // shapeless: warned, skipped
    manager.addObject(b);
    manager.addObject(far);
    expect(manager.size).toBe(3);
    const hits = manager.checkAllCollisions();
    expect(hits).toHaveLength(1);
    expect(manager.checkObject(a)).toHaveLength(1);
    expect(manager.checkObject(far)).toHaveLength(0);
    expect(manager.checkObjectFirst(b)?.involves(a)).toBe(true);
    manager.removeObject(a);
    expect(manager.checkAllCollisions()).toHaveLength(0);
    manager.clear();
    expect(manager.size).toBe(0);
  });

  it("validates cell size", () => {
    expect(() => new ObjectCollisionManager(null, 0)).toThrow(RangeError);
  });
});

describe("Body", () => {
  it("validates shape and mode", () => {
    expect(
      () => new Body(new CollisionPolygon([[0, 0], [1, 0], [1, 1]]) as never),
    ).toThrow(TypeError);
    expect(() => new Body(new RectangleShape(1, 1), 0, 0, { mode: "flying" as never })).toThrow(
      RangeError,
    );
    const body = new Body(new CircleShape(5, [0, 0]), 10, 20, { mode: "kinematic", gameId: "c" });
    expect(body.onGround).toBe(false);
    expect(body.toString()).toContain("kinematic");
  });

  it("samples top surfaces and builds polygons", () => {
    const rectBody = new Body(new RectangleShape(10, 10), 0, 0);
    expect(rectBody.topYAt(5)).toBe(0);
    expect(rectBody.topYAt(50)).toBeNull();
    expect(rectBody.asPolygon().vertices).toHaveLength(4);

    const circle = new Body(new CircleShape(5, [5, 5]), 0, 0);
    expect(circle.topYAt(5)).toBeCloseTo(0, 10); // cy(5) - r(5)
    expect(circle.topYAt(99)).toBeNull();
    expect(circle.asPolygon().vertices).toHaveLength(16);

    const capsule = new Body(new CapsuleShape(2, 8), 0, 0);
    expect(capsule.asPolygon().vertices).toHaveLength(10);
  });
});
