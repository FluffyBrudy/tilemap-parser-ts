import type { Vec2 } from "../core/index.js";

export interface CameraLike {
  setBounds(x: number, y: number, width: number, height: number): unknown;
  setDeadzone(width: number, height: number): unknown;
  startFollow(
    target: object,
    roundPixels?: boolean,
    lerpX?: number,
    lerpY?: number,
  ): unknown;
}

export interface FollowTarget {
  readonly x: number;
  readonly y: number;
}

export interface CameraOptions {
  readonly bounds?: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };

  readonly deadzone?: Vec2;

  readonly lerp?: number;
  readonly roundPixels?: boolean;
}

export function worldBounds(
  mapTilesW: number,
  mapTilesH: number,
  tileW: number,
  tileH: number,
  renderScale: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: 0,
    y: 0,
    w: mapTilesW * tileW * renderScale,
    h: mapTilesH * tileH * renderScale,
  };
}

export function applyCamera(
  camera: CameraLike,
  target: FollowTarget,
  options: CameraOptions = {},
): void {
  if (options.bounds !== undefined) {
    camera.setBounds(
      options.bounds.x,
      options.bounds.y,
      options.bounds.w,
      options.bounds.h,
    );
  }
  if (options.deadzone !== undefined) {
    camera.setDeadzone(options.deadzone[0], options.deadzone[1]);
  }
  const lerp = options.lerp ?? 1;
  camera.startFollow(target, options.roundPixels ?? true, lerp, lerp);
}
