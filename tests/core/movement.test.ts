import { describe, expect, it } from "vitest";
import {
  Body,
  CollisionPolygon,
  CollisionRunner,
  NavGrid,
  PathFollower,
  Pathfinder,
  PhysicsWorld,
  RectangleShape,
  TileCollisionData,
  TilesetCollision,
  rectVsTilemap,
  type ICollidableSprite,
  type TileMap,
} from "../../src/core/index.js";

function solidSet(): TilesetCollision {
  const full = new CollisionPolygon([[0, 0], [16, 0], [16, 16], [0, 16]]);
  const oneWay = new CollisionPolygon([[0, 0], [16, 0], [16, 8], [0, 8]], true);
  const tiles = new Map([
    [1, new TileCollisionData(1, [full])],
    [2, new TileCollisionData(2, [oneWay])],
  ]);
  return new TilesetCollision("test", [16, 16], tiles);
}

function roomMap(): TileMap {
  const map: TileMap = new Map();
  for (let x = 0; x < 10; x += 1) {
    map.set(`${x};5`, [[1, 0]]);
  }
  for (let y = 0; y < 5; y += 1) {
    map.set(`0;${y}`, [[1, 0]]);
    map.set(`9;${y}`, [[1, 0]]);
  }
  return map;
}

function makeWorld(): PhysicsWorld {
  const world = new PhysicsWorld(roomMap(), solidSet(), [16, 16], 1.0);
  return world;
}

function sprite(x: number, y: number, w = 10, h = 10): ICollidableSprite {
  return {
    x, y, vx: 0, vy: 0, onGround: false,
    collisionShape: new RectangleShape(w, h),
    collisionLayer: 1, collisionMask: 0xffffffff,
  };
}

describe("moveAndSlide (topdown)", () => {
  it("slides along walls and flags axes", () => {
    const runner = CollisionRunner.fromGameType("topdown", [16, 16]);
    runner.attach(makeWorld());
    const s = sprite(130, 4 * 16, 10, 10);
    const res = runner.moveAndSlide(s, null, null, 20, 0);
    expect(res.collided).toBe(true);
    expect(res.hitWallX).toBe(true);
    expect(s.x).toBe(130); // backed out, no tunneling
    const s2 = sprite(4 * 16, 2 * 16, 10, 10);
    const res2 = runner.moveAndSlide(s2, null, null, 0, 16);
    expect(res2.collided).toBe(false);
    expect(s2.y).toBe(2 * 16 + 16);
  });
});

describe("moveRpg", () => {
  it("blocks fully with per-axis flags", () => {
    const runner = CollisionRunner.fromGameType("rpg", [16, 16]);
    runner.attach(makeWorld());
    const s = sprite(130, 4 * 16, 10, 10);
    const res = runner.moveRpg(s, null, null, 20, 0);
    expect(res.collided).toBe(true);
    expect(res.hitWallX).toBe(true);
    expect(res.hitWallY).toBe(false);
    expect(s.x).toBe(130);
  });
});

describe("moveGrounded", () => {
  it("falls, lands exactly, and walls stop X", () => {
    const runner = CollisionRunner.fromGameType("platformer", [16, 16]);
    runner.attach(makeWorld());
    const s = sprite(4 * 16 + 3, 2 * 16, 10, 10);
    let res = runner.moveGrounded(s, null, null, 0.016);
    for (let i = 0; i < 120 && !res.onGround; i += 1) {
      res = runner.moveGrounded(s, null, null, 0.016);
    }
    expect(res.onGround).toBe(true);
    expect(s.vy).toBe(0);
    expect(s.y).toBeCloseTo(70, 6);
    s.x = 18;
    s.vx = -500;
    runner.moveGrounded(s, null, null, 0.016);
    expect(s.vx).toBe(0);
  });
});

describe("movePlatformer", () => {
  it("lands from a fall and jumps", () => {
    const runner = CollisionRunner.fromGameType("platformer", [16, 16]);
    runner.attach(makeWorld());
    const s = sprite(4 * 16 + 3, 2 * 16, 10, 10);
    let res = runner.movePlatformer(s, null, null, 0.016);
    for (let i = 0; i < 180 && !res.onGround; i += 1) {
      res = runner.movePlatformer(s, null, null, 0.016);
    }
    expect(res.onGround).toBe(true);
    expect(s.y).toBeCloseTo(70, 6);
    const jump = runner.movePlatformer(s, null, null, 0.016, { inputX: 0, jumpPressed: true });
    expect(s.vy).toBe(runner.jumpStrength);
    expect(jump.onGround).toBe(false);
  });

  it("treats one-way as solid falling, passable rising", () => {
    const map: TileMap = new Map([["4;3", [[2, 0]]]]);
    const collision = solidSet();
    const runner = CollisionRunner.fromGameType("platformer", [16, 16]);
    const fall = sprite(4 * 16 + 3, 30, 10, 10);
    fall.vy = 200;
    const res = runner.movePlatformer(fall, collision, map, 0.05);
    expect(res.onGround).toBe(true);
    const rise = sprite(4 * 16 + 3, 60, 10, 10);
    rise.vy = -300;
    const res2 = runner.movePlatformer(rise, collision, map, 0.016);
    expect(res2.hitCeiling).toBe(false);
  });
});

describe("movePlatformerWithSlide", () => {
  it("reports flat ground normal on landing", () => {
    const runner = CollisionRunner.fromGameType("platformer", [16, 16]);
    runner.attach(makeWorld());
    const s = sprite(4 * 16 + 3, 2 * 16, 10, 10);
    let res = runner.movePlatformerWithSlide(s, null, null, 0.016);
    for (let i = 0; i < 180 && !res.onGround; i += 1) {
      res = runner.movePlatformerWithSlide(s, null, null, 0.016);
    }
    expect(res.onGround).toBe(true);
    expect(res.groundAngle).toBeCloseTo(0, 6);
    expect(res.groundNormal?.[1]).toBeCloseTo(-1, 6);
  });
});

describe("CollisionRunner config", () => {
  it("presets, attach geometry, dispatch, validation", () => {
    const runner = CollisionRunner.fromGameType("topdown", [16, 16]);
    expect(runner.mode).toBe("slide");
    expect(runner.gravity).toBe(0);
    const world = makeWorld();
    runner.attach(world);
    expect(runner.effTw).toBe(16);
    const s = sprite(4 * 16, 2 * 16, 10, 10);
    const res = runner.move(s, null, null, 5, 0, 0.016);
    expect(res.finalX).toBe(4 * 16 + 5);
    runner.detach();
    expect(runner.world).toBeNull();
    expect(() => CollisionRunner.fromGameType("nope")).toThrow(RangeError);
    const bad = CollisionRunner.fromGameType("topdown", [16, 16]);
    bad.gravity = 5;
    expect(() => bad.validateConfig(true)).toThrow(RangeError);
  });
});

describe("rectVsTilemap", () => {
  it("hits solid cells with union + mask filtering", () => {
    const collision = solidSet();
    const map = roomMap();
    expect(rectVsTilemap(4 * 16, 4 * 16 + 8, 4 * 16 + 10, 5 * 16 + 1, map, collision, [16, 16])).toBe(true);
    expect(rectVsTilemap(4 * 16, 2 * 16, 4 * 16 + 10, 3 * 16, map, collision, [16, 16])).toBe(false);
    expect(rectVsTilemap(4 * 16, 4 * 16 + 8, 4 * 16 + 10, 5 * 16, map, collision, [16, 16], 1.0, 2)).toBe(false);
  });
});

describe("navigation", () => {
  function navWorld(): { grid: NavGrid; collision: TilesetCollision; map: TileMap } {
    const collision = solidSet();
    const map = roomMap();
    for (let x = 1; x < 9; x += 1) {
      if (x !== 5) map.set(`${x};2`, [[1, 0]]);
    }
    const grid = new NavGrid(map, collision, [16, 16], { mapSize: [10, 6] });
    return { grid, collision, map };
  }

  it("marks solid/walkable and erodes clearance", () => {
    const { grid } = navWorld();
    expect(grid.isSolid(0, 0)).toBe(true);
    expect(grid.isWalkable(4, 1)).toBe(true);
    expect(grid.isWalkable(3, 2)).toBe(false);
    const eroded = grid.erode(1.0);
    expect(eroded.isWalkable(4, 1)).toBe(false); // directly above wall (4,2): in margin
    expect(eroded.isWalkable(5, 1)).toBe(false); // adjacent to the gap walls
  });

  it("finds the straight walkable path", () => {
    const { grid } = navWorld();
    const path = new Pathfinder(grid).findPath([1, 1], [8, 1]);
    expect(path).not.toBeNull();
    expect(path?.[0]).toEqual([1, 1]);
    expect(path?.[path.length - 1]).toEqual([8, 1]);
    expect(path).toHaveLength(8); // straight along clear row 1
    expect(path?.every(([x, y]) => grid.isWalkable(x, y))).toBe(true);
    expect(new Pathfinder(grid).findPath([1, 1], [3, 2])).toBeNull(); // into a wall
  });

  it("follows waypoints with the runner", () => {
    const { collision, map } = navWorld();
    const runner = CollisionRunner.fromGameType("rpg", [16, 16]);
    const follower = new PathFollower([16, 16]);
    const s = sprite(1 * 16 + 3, 1 * 16 + 3, 8, 8);
    const path: Array<[number, number]> = [[2, 1], [3, 1]];
    let idx = 0;
    let done = false;
    for (let i = 0; i < 200 && !done; i += 1) {
      const r = follower.updateRpg(s, path, idx, runner, collision, map, 200, 0.016);
      idx = r.waypointIndex;
      done = r.done;
    }
    expect(done).toBe(true);
  });

  it("caches entity grids by size", () => {
    const { collision, map } = navWorld();
    const cache = new Map<string, NavGrid>();
    const a = NavGrid.forEntity(map, collision, [16, 16], 16, 16, 1.0, [10, 6], cache);
    const b = NavGrid.forEntity(map, collision, [16, 16], 16, 16, 1.0, [10, 6], cache);
    expect(a).toBe(b);
  });
});

describe("reference vectors: identical scenarios must reproduce these outputs", () => {
  it("reproduces reference outputs bit-for-bit", () => {
    const rs = CollisionRunner.fromGameType("topdown", [16, 16]);
    rs.attach(makeWorld());
    const s = sprite(130, 64);
    const rSlide = rs.moveAndSlide(s, null, null, 20, 0);
    expect([s.x, s.y]).toEqual([130, 64]);
    expect([rSlide.collided, rSlide.hitWallX]).toEqual([true, true]);
    expect(rSlide.slideVector).toEqual([0, 0]);

    const rp = CollisionRunner.fromGameType("platformer", [16, 16]);
    rp.attach(makeWorld());
    const p = sprite(67, 32);
    let pr = rp.movePlatformer(p, null, null, 0.016);
    for (let i = 0; i < 199; i += 1) pr = rp.movePlatformer(p, null, null, 0.016);
    expect([p.x, p.y]).toEqual([67, 70]);
    expect(pr.onGround).toBe(true);

    const g = sprite(67, 32);
    let gr = rp.moveGrounded(g, null, null, 0.016);
    for (let i = 0; i < 199; i += 1) gr = rp.moveGrounded(g, null, null, 0.016);
    expect([g.x, g.y]).toEqual([67, 70]);
    expect(gr.onGround).toBe(true);

    const sp = sprite(67, 32);
    let sr = rp.movePlatformerWithSlide(sp, null, null, 0.016);
    for (let i = 0; i < 199; i += 1) sr = rp.movePlatformerWithSlide(sp, null, null, 0.016);
    expect(sp.x).toBe(67);
    expect(sp.y).toBeCloseTo(69.99, 6);
    expect(sr.groundAngle).toBe(0);
    expect(sr.groundNormal).toEqual([0, -1]);

    const rr = CollisionRunner.fromGameType("rpg", [16, 16]);
    rr.attach(makeWorld());
    const q = sprite(130, 64);
    const qr = rr.moveRpg(q, null, null, 20, 0);
    expect([q.x, q.y]).toEqual([130, 64]);
    expect([qr.collided, qr.hitWallX]).toEqual([true, true]);
  });
});

describe("bodies in the world", () => {
  it("crates land on tiles and block sprites", () => {
    const world = makeWorld();
    const runner = CollisionRunner.fromWorld(world, "platformer");
    const crate = new Body(new RectangleShape(16, 16), 4 * 16, 2 * 16, { mode: "kinematic" });
    world.addBody(crate);
    let res = runner.moveGrounded(crate, null, null, 0.05, { velocity: [0, 400] });
    for (let i = 0; i < 30 && !res.onGround; i += 1) {
      res = runner.moveGrounded(crate, null, null, 0.05, { velocity: [0, 400] });
    }
    expect(res.onGround).toBe(true);
  });
});
