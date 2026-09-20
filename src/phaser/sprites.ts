import type { CharacterShape } from "../core/index.js";
import type { ICollidableSprite } from "../core/index.js";

export interface GameObjectLike {
  x: number;
  y: number;
}

export class WrappedGameObject implements ICollidableSprite {
  collisionShape: CharacterShape;
  collisionLayer: number;
  collisionMask: number;
  vx = 0;
  vy = 0;
  onGround = false;

  constructor(
    private readonly target: GameObjectLike,
    shape: CharacterShape,
    layer = 1,
    mask = 0xffffffff,
  ) {
    this.collisionShape = shape;
    this.collisionLayer = layer;
    this.collisionMask = mask;
  }

  get x(): number {
    return this.target.x;
  }

  set x(value: number) {
    this.target.x = value;
  }

  get y(): number {
    return this.target.y;
  }

  set y(value: number) {
    this.target.y = value;
  }

  get gameObject(): GameObjectLike {
    return this.target;
  }
}

export function wrapGameObject(
  target: GameObjectLike,
  shape: CharacterShape,
  layer = 1,
  mask = 0xffffffff,
): WrappedGameObject {
  return new WrappedGameObject(target, shape, layer, mask);
}
