import type { Vec2 } from "../../vec.js";

export type MovementMode = "slide" | "grounded" | "platformer" | "rpg";
export const MOVEMENT_MODES: readonly MovementMode[] = [
  "slide",
  "grounded",
  "platformer",
  "rpg",
];

export interface GroundInfo {
  y: number;
  normal: Vec2;
  angle: number;
}

export interface CollisionResult {
  collided: boolean;
  finalX: number;
  finalY: number;
  hitWallX: boolean;
  hitWallY: boolean;
  hitCeiling: boolean;
  onGround: boolean;
  slideVector: Vec2 | null;
  groundAngle: number | null;
  groundNormal: Vec2 | null;
}

export function createCollisionResult(
  finalX: number,
  finalY: number,
): CollisionResult {
  return {
    collided: false,
    finalX,
    finalY,
    hitWallX: false,
    hitWallY: false,
    hitCeiling: false,
    onGround: false,
    slideVector: null,
    groundAngle: null,
    groundNormal: null,
  };
}
