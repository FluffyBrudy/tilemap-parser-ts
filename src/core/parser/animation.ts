import { AnimationParseError } from "../errors.js";
import type { Vec2 } from "../vec.js";

type JsonDict = Record<string, unknown>;

function reqDict(v: unknown, context: string): JsonDict {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new AnimationParseError(`${context}: expected object`);
  }
  return v as JsonDict;
}

function reqList(v: unknown, context: string): unknown[] {
  if (!Array.isArray(v)) {
    throw new AnimationParseError(`${context}: expected array`);
  }
  return v;
}

function reqStr(v: unknown, context: string): string {
  if (typeof v !== "string") {
    throw new AnimationParseError(`${context}: expected string`);
  }
  return v;
}

function coerceInt(v: unknown, context: string): number {
  if (typeof v === "boolean") {
    throw new AnimationParseError(`${context}: expected int`);
  }
  if (typeof v === "number") {
    if (!Number.isInteger(v)) {
      throw new AnimationParseError(`${context}: expected int`);
    }
    return v;
  }
  if (typeof v === "string" && /^[+-]?\d+$/.test(v.trim())) {
    const n = Number(v.trim());
    if (Number.isSafeInteger(n)) return n;
  }
  throw new AnimationParseError(`${context}: expected int`);
}

function coerceFloat(v: unknown, context: string): number {
  if (typeof v === "boolean") {
    throw new AnimationParseError(`${context}: expected number`);
  }
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (v.trim() !== "" && Number.isFinite(n)) return n;
  }
  throw new AnimationParseError(`${context}: expected number`);
}

export interface AnimationMarker {
  name: string;
  frameIndex: number;
}

export interface AnimationFrame {
  variantId: number;
  durationMs: number;
}

export class AnimationClip {
  name: string;
  frames: AnimationFrame[];
  loop: boolean;
  fps: number;
  metadata: JsonDict;
  markers: AnimationMarker[];

  constructor(
    name: string,
    frames: AnimationFrame[] = [],
    loop = true,
    fps = 60.0,
    metadata: JsonDict = {},
    markers: AnimationMarker[] = [],
  ) {
    this.name = name;
    this.frames = frames;
    this.loop = loop;
    this.fps = fps;
    this.metadata = metadata;
    this.markers = markers;
  }

  frameCount(): number {
    return this.frames.length;
  }

  totalDurationMs(): number {
    return this.frames.reduce((acc, f) => acc + f.durationMs, 0);
  }

  clampMarkers(): void {
    const count = this.frames.length;
    if (count === 0) {
      this.markers.length = 0;
      return;
    }
    for (const marker of this.markers) {
      marker.frameIndex = Math.max(0, Math.min(marker.frameIndex, count - 1));
    }
  }
}

export class AnimationLibrary {
  animations: Map<string, AnimationClip>;
  spritesheetPath: string | null;
  tileSize: Vec2;
  gridOffset: Vec2;
  trimTransparent: boolean;

  constructor(
    animations: Map<string, AnimationClip> = new Map(),
    spritesheetPath: string | null = null,
    tileSize: Vec2 = [32, 32],
    gridOffset: Vec2 = [0, 0],
    trimTransparent = false,
  ) {
    this.animations = animations;
    this.spritesheetPath = spritesheetPath;
    this.tileSize = tileSize;
    this.gridOffset = gridOffset;
    this.trimTransparent = trimTransparent;
  }

  get(name: string): AnimationClip | null {
    return this.animations.get(name) ?? null;
  }
}

function parseMarker(d: JsonDict, context: string): AnimationMarker {
  return {
    name: reqStr(d["name"], `${context}.name`),
    frameIndex: coerceInt(d["frame_index"], `${context}.frame_index`),
  };
}

function parseFrame(d: JsonDict, context: string): AnimationFrame {
  return {
    variantId: coerceInt(d["variant_id"], `${context}.variant_id`),
    durationMs: coerceFloat(
      d["duration_ms"] ?? 100.0,
      `${context}.duration_ms`,
    ),
  };
}

function parseAnimation(
  name: string,
  d: JsonDict,
  context: string,
): AnimationClip {
  const framesRaw = reqList(d["frames"] ?? [], `${context}.frames`);
  const frames = framesRaw.map((f, i) =>
    parseFrame(
      reqDict(f, `${context}.frames[${i}]`),
      `${context}.frames[${i}]`,
    ),
  );

  const metadataRaw = d["metadata"];
  let metadata: JsonDict;
  if (metadataRaw === null || metadataRaw === undefined) {
    metadata = {};
  } else if (typeof metadataRaw === "object" && !Array.isArray(metadataRaw)) {
    metadata = { ...(metadataRaw as JsonDict) };
  } else {
    throw new AnimationParseError(
      `${context}.metadata: expected object or null`,
    );
  }

  const markers: AnimationMarker[] = [];
  const markersRaw = d["markers"];
  if (markersRaw !== null && markersRaw !== undefined) {
    reqList(markersRaw, `${context}.markers`).forEach((marker, i) => {
      markers.push(
        parseMarker(
          reqDict(marker, `${context}.markers[${i}]`),
          `${context}.markers[${i}]`,
        ),
      );
    });
  }

  const clip = new AnimationClip(
    reqStr(d["name"] ?? name, `${context}.name`),
    frames,
    Boolean(d["loop"] ?? true),
    coerceFloat(d["fps"] ?? 60.0, `${context}.fps`),
    metadata,
    markers,
  );
  clip.clampMarkers();
  return clip;
}

export function parseAnimationDict(data: unknown): AnimationLibrary {
  const root = reqDict(data, "root");
  const spritesheet = root["spritesheet_path"];
  const spritesheetPath =
    spritesheet === null || spritesheet === undefined
      ? null
      : reqStr(spritesheet, "spritesheet_path");

  const tileSizeRaw = reqList(root["tile_size"] ?? [32, 32], "tile_size");
  if (tileSizeRaw.length !== 2) {
    throw new AnimationParseError("tile_size: expected [w, h]");
  }
  const tw = coerceInt(tileSizeRaw[0], "tile_size[0]");
  const th = coerceInt(tileSizeRaw[1], "tile_size[1]");
  if (tw < 1 || th < 1) {
    throw new AnimationParseError("tile_size: width and height must be >= 1");
  }

  const gridOffsetRaw = root["grid_offset"] ?? [0, 0];
  if (!Array.isArray(gridOffsetRaw) || gridOffsetRaw.length !== 2) {
    throw new AnimationParseError("grid_offset: expected [x, y]");
  }
  const gox = coerceInt(gridOffsetRaw[0], "grid_offset[0]");
  const goy = coerceInt(gridOffsetRaw[1], "grid_offset[1]");
  if (gox < 0 || goy < 0) {
    throw new AnimationParseError("grid_offset: values must be >= 0");
  }

  const animationsRaw = reqDict(root["animations"] ?? {}, "animations");
  const animations = new Map<string, AnimationClip>();
  for (const [key, value] of Object.entries(animationsRaw)) {
    const k = String(key);
    animations.set(
      k,
      parseAnimation(
        k,
        reqDict(value, `animations[${JSON.stringify(k)}]`),
        `animations[${JSON.stringify(k)}]`,
      ),
    );
  }

  return new AnimationLibrary(
    animations,
    spritesheetPath,
    [tw, th],
    [gox, goy],
    Boolean(root["trim_transparent"] ?? false),
  );
}

export function parseAnimationJson(text: string): AnimationLibrary {
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch (err) {
    throw new AnimationParseError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return parseAnimationDict(payload);
}
