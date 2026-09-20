import type { CharacterShape } from "../parser/collision.js";

export interface ICollidable {
  x: number;
  y: number;
  collisionShape: CharacterShape;
  collisionLayer: number;
  collisionMask: number;
}

export interface ICollidableSprite extends ICollidable {
  vx: number;
  vy: number;
  onGround: boolean;
}

export type ICollidableObject = ICollidable;
