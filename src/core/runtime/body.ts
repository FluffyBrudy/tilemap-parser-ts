import {
  CapsuleShape,
  CircleShape,
  CollisionPolygon,
  RectangleShape,
  type SpriteShape,
} from "../parser/collision.js";
import type { Vec2 } from "../vec.js";

export type BodyMode = "static" | "kinematic";
export const BODY_MODES: readonly BodyMode[] = ["static", "kinematic"];

export class Body {
  collisionShape: SpriteShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mode: BodyMode;
  collisionLayer: number;
  collisionMask: number;
  gameId: string;
  onGround: boolean;

  constructor(
    collisionShape: SpriteShape,
    x = 0.0,
    y = 0.0,
    options: {
      vx?: number;
      vy?: number;
      mode?: BodyMode;
      collisionLayer?: number;
      collisionMask?: number;
      gameId?: string;
    } = {},
  ) {
    if (
      !(collisionShape instanceof RectangleShape) &&
      !(collisionShape instanceof CircleShape) &&
      !(collisionShape instanceof CapsuleShape)
    ) {
      throw new TypeError(
        "Body requires a primitive shape (RectangleShape, CircleShape, " +
          `or CapsuleShape), got ${(collisionShape as { kind?: unknown }).kind ?? typeof collisionShape}`,
      );
    }
    const mode = options.mode ?? "static";
    if (mode !== "static" && mode !== "kinematic") {
      throw new RangeError(
        `mode must be one of ${BODY_MODES.join(", ")}, got ${JSON.stringify(mode)}`,
      );
    }
    this.collisionShape = collisionShape;
    this.x = x;
    this.y = y;
    this.vx = options.vx ?? 0.0;
    this.vy = options.vy ?? 0.0;
    this.mode = mode;
    this.collisionLayer = options.collisionLayer ?? 1;
    this.collisionMask = options.collisionMask ?? 0xffffffff;
    this.gameId = options.gameId ?? "";
    this.onGround = false;
  }

  toString(): string {
    return (
      `Body(shape=${this.collisionShape.kind}, x=${this.x}, ` +
      `y=${this.y}, mode=${JSON.stringify(this.mode)}, game_id=${JSON.stringify(this.gameId)})`
    );
  }

  topYAt(worldX: number): number | null {
    const shape = this.collisionShape;
    if (shape instanceof RectangleShape) {
      const left = this.x + shape.offset[0];
      if (left <= worldX && worldX <= left + shape.width) {
        return this.y + shape.offset[1];
      }
      return null;
    }
    if (shape instanceof CircleShape) {
      return circleTopY(
        this.x + shape.offset[0],
        this.y + shape.offset[1],
        shape.radius,
        worldX,
      );
    }
    const px = this.x + shape.offset[0];
    const py = this.y + shape.offset[1];
    return circleTopY(px, py, shape.radius, worldX);
  }

  asPolygon(): CollisionPolygon {
    const shape = this.collisionShape;
    if (shape instanceof RectangleShape) {
      const left = this.x + shape.offset[0];
      const top = this.y + shape.offset[1];
      return new CollisionPolygon([
        [left, top],
        [left + shape.width, top],
        [left + shape.width, top + shape.height],
        [left, top + shape.height],
      ]);
    }
    if (shape instanceof CircleShape) {
      return new CollisionPolygon(
        ngon(
          this.x + shape.offset[0],
          this.y + shape.offset[1],
          shape.radius,
          16,
        ),
      );
    }
    const px = this.x + shape.offset[0];
    const py = this.y + shape.offset[1];
    const bx = px;
    const by = py + shape.height;
    const r = shape.radius;
    const steps = 4;
    const verts: Vec2[] = [];
    for (let k = 0; k <= steps; k += 1) {
      const a = Math.PI + (Math.PI * k) / steps;
      verts.push([px + r * Math.cos(a), py + r * Math.sin(a)]);
    }
    for (let k = 0; k <= steps; k += 1) {
      const a = (Math.PI * k) / steps;
      verts.push([bx + r * Math.cos(a), by + r * Math.sin(a)]);
    }
    return new CollisionPolygon(verts);
  }
}

function circleTopY(
  cx: number,
  cy: number,
  radius: number,
  worldX: number,
): number | null {
  const dx = worldX - cx;
  if (Math.abs(dx) > radius) return null;
  return cy - Math.sqrt(radius * radius - dx * dx);
}

function ngon(cx: number, cy: number, radius: number, edges: number): Vec2[] {
  const verts: Vec2[] = [];
  for (let i = 0; i < edges; i += 1) {
    verts.push([
      cx + radius * Math.cos((2 * Math.PI * i) / edges),
      cy + radius * Math.sin((2 * Math.PI * i) / edges),
    ]);
  }
  return verts;
}
