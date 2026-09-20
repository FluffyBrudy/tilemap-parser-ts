import { CollisionParseError } from "../errors.js";
import type { Vec2 } from "../vec.js";

export type ShapeKind = "rectangle" | "circle" | "capsule" | "polygon";

function toInt(value: unknown): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError(`not an int: ${String(value)}`);
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (/^[+-]?\d+$/.test(t)) {
      const n = Number(t);
      if (Number.isSafeInteger(n)) return n;
    }
    throw new TypeError(`not an int: ${JSON.stringify(value)}`);
  }
  throw new TypeError(`not an int: ${typeof value}`);
}

function toPair(raw: unknown): Vec2 {
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new TypeError("expected [x, y] pair");
  }
  return [Number(raw[0]), Number(raw[1])];
}

function toFloat(value: unknown): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const t = value.trim();
    const lower = t.toLowerCase();
    if (lower === "nan" || lower === "+nan" || lower === "-nan") return NaN;
    if (
      lower === "inf" ||
      lower === "+inf" ||
      lower === "infinity" ||
      lower === "+infinity"
    ) {
      return Infinity;
    }
    if (lower === "-inf" || lower === "-infinity") return -Infinity;
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
      return Number(t);
    }
  }
  throw new TypeError(`not a number: ${JSON.stringify(value)}`);
}

function parsePolygonVertices(raw: unknown): Vec2[] {
  if (!Array.isArray(raw)) throw new TypeError("vertices must be an array");
  return raw.map((v) => toPair(v));
}

export class CollisionPolygon {
  readonly kind = "polygon" as const;
  readonly vertices: Vec2[];
  readonly oneWay: boolean;

  constructor(vertices: Vec2[], oneWay = false) {
    this.vertices = vertices;
    this.oneWay = oneWay;
  }

  transform(tileX: number, tileY: number, scale = 1.0): CollisionPolygon {
    return new CollisionPolygon(
      this.vertices.map(
        ([vx, vy]) => [tileX + vx * scale, tileY + vy * scale] as Vec2,
      ),
      this.oneWay,
    );
  }

  scaled(scale: number): CollisionPolygon {
    return new CollisionPolygon(
      this.vertices.map(([vx, vy]) => [vx * scale, vy * scale] as Vec2),
      this.oneWay,
    );
  }

  isValid(): boolean {
    return this.vertices.length >= 3;
  }
}

export class RectangleShape {
  readonly kind = "rectangle" as const;
  readonly width: number;
  readonly height: number;
  readonly offset: Vec2;

  constructor(width: number, height: number, offset: Vec2 = [0.0, 0.0]) {
    this.width = width;
    this.height = height;
    this.offset = offset;
  }

  getBounds(x: number, y: number): readonly [number, number, number, number] {
    const left = x + this.offset[0];
    const top = y + this.offset[1];
    return [left, top, left + this.width, top + this.height];
  }

  scaled(scale: number): RectangleShape {
    return new RectangleShape(this.width * scale, this.height * scale, [
      this.offset[0] * scale,
      this.offset[1] * scale,
    ]);
  }
}

export class CircleShape {
  readonly kind = "circle" as const;
  readonly radius: number;
  readonly offset: Vec2;

  constructor(radius: number, offset: Vec2 = [0.0, 0.0]) {
    this.radius = radius;
    this.offset = offset;
  }

  getCenter(x: number, y: number): Vec2 {
    return [x + this.offset[0], y + this.offset[1]];
  }

  scaled(scale: number): CircleShape {
    return new CircleShape(this.radius * scale, [
      this.offset[0] * scale,
      this.offset[1] * scale,
    ]);
  }
}

export class CapsuleShape {
  readonly kind = "capsule" as const;
  readonly radius: number;
  readonly height: number;
  readonly offset: Vec2;

  constructor(radius: number, height: number, offset: Vec2 = [0.0, 0.0]) {
    this.radius = radius;
    this.height = height;
    this.offset = offset;
  }

  getTopCenter(x: number, y: number): Vec2 {
    return [x + this.offset[0], y + this.offset[1]];
  }

  getBottomCenter(x: number, y: number): Vec2 {
    return [x + this.offset[0], y + this.offset[1] + this.height];
  }

  scaled(scale: number): CapsuleShape {
    return new CapsuleShape(this.radius * scale, this.height * scale, [
      this.offset[0] * scale,
      this.offset[1] * scale,
    ]);
  }
}

export type CharacterShape =
  | RectangleShape
  | CircleShape
  | CapsuleShape
  | CollisionPolygon;

export type SpriteShape = RectangleShape | CircleShape | CapsuleShape;

export function isSpriteShape(shape: CharacterShape): shape is SpriteShape {
  return shape.kind !== "polygon";
}

export function flipCharacterShape(
  shape: CharacterShape,
  spriteSize: readonly [number, number],
  options: { flipH?: boolean; flipV?: boolean } = {},
): CharacterShape {
  const { flipH = true, flipV = false } = options;
  const w = Number(spriteSize[0]);
  const h = Number(spriteSize[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new RangeError(
      `sprite_size must be finite and positive, got ${JSON.stringify(spriteSize)}`,
    );
  }
  if (shape instanceof RectangleShape) {
    const [ox, oy] = shape.offset;
    return new RectangleShape(shape.width, shape.height, [
      flipH && ox !== undefined ? w - (ox + shape.width) : (ox as number),
      flipV && oy !== undefined ? h - (oy + shape.height) : (oy as number),
    ]);
  }
  if (shape instanceof CircleShape) {
    const [ox, oy] = shape.offset;
    return new CircleShape(shape.radius, [
      flipH ? w - (ox as number) : (ox as number),
      flipV ? h - (oy as number) : (oy as number),
    ]);
  }
  if (shape instanceof CapsuleShape) {
    const [ox, oy] = shape.offset;
    return new CapsuleShape(shape.radius, shape.height, [
      flipH ? w - (ox as number) : (ox as number),
      flipV ? h - ((oy as number) + shape.height) : (oy as number),
    ]);
  }
  if (shape instanceof CollisionPolygon) {
    let verts = shape.vertices.map(
      ([x, y]) => [(flipH ? w - (x as number) : x) as number, y] as Vec2,
    );
    verts = verts.map(
      ([x, y]) => [x, (flipV ? h - (y as number) : y) as number] as Vec2,
    );
    return new CollisionPolygon(verts, shape.oneWay);
  }
  throw new TypeError(
    `Cannot flip unknown shape type: ${(shape as { kind?: unknown }).kind ?? typeof shape}`,
  );
}

export class TileCollisionData {
  readonly tileId: number;
  readonly shapes: CollisionPolygon[];
  readonly collisionLayer: number;
  readonly collisionMask: number;

  constructor(
    tileId: number,
    shapes: CollisionPolygon[] = [],
    collisionLayer = 1,
    collisionMask = 0xffffffff,
  ) {
    this.tileId = tileId;
    this.shapes = shapes;
    this.collisionLayer = collisionLayer;
    this.collisionMask = collisionMask;
  }

  hasCollision(): boolean {
    return this.shapes.some((s) => s.isValid());
  }
}

export class TilesetCollision {
  readonly tilesetName: string;
  readonly tileSize: Vec2;
  readonly tiles: Map<number, TileCollisionData>;

  constructor(
    tilesetName: string,
    tileSize: Vec2,
    tiles: Map<number, TileCollisionData> = new Map(),
  ) {
    this.tilesetName = tilesetName;
    this.tileSize = tileSize;
    this.tiles = tiles;
  }

  getTileCollision(tileId: number): TileCollisionData | null {
    return this.tiles.get(tileId) ?? null;
  }

  hasCollision(tileId: number): boolean {
    const data = this.getTileCollision(tileId);
    return data !== null && data.hasCollision();
  }

  getWorldShapes(
    tileId: number,
    tileX: number,
    tileY: number,
    scale = 1.0,
  ): CollisionPolygon[] {
    const data = this.getTileCollision(tileId);
    if (!data) return [];
    return data.shapes.map((s) => s.transform(tileX, tileY, scale));
  }

  static merge(
    collisions: TilesetCollision[],
    firstgids: number[],
  ): TilesetCollision {
    if (collisions.length === 0) {
      return new TilesetCollision("merged", [0, 0]);
    }
    if (collisions.length !== firstgids.length) {
      throw new CollisionParseError(
        `merge needs one firstgid per collision (got ${collisions.length} collisions, ${firstgids.length} firstgids)`,
      );
    }
    const first = collisions[0];
    if (first === undefined) {
      return new TilesetCollision("merged", [0, 0]);
    }
    const merged = new Map<number, TileCollisionData>();
    collisions.forEach((coll, i) => {
      const offset = firstgids[i];
      if (offset === undefined) {
        throw new CollisionParseError(`missing firstgid at index ${i}`);
      }
      for (const [localId, data] of coll.tiles) {
        const gid = offset + localId;
        merged.set(
          gid,
          new TileCollisionData(
            gid,
            [...data.shapes],
            data.collisionLayer,
            data.collisionMask,
          ),
        );
      }
    });
    return new TilesetCollision("merged", first.tileSize, merged);
  }
}

export class CharacterCollision {
  readonly name: string;
  readonly shape: CharacterShape;
  readonly properties: Record<string, unknown>;
  readonly collisionLayer: number;
  readonly collisionMask: number;

  constructor(
    name: string,
    shape: CharacterShape,
    properties: Record<string, unknown> = {},
    collisionLayer = 1,
    collisionMask = 0xffffffff,
  ) {
    this.name = name;
    this.shape = shape;
    this.properties = properties;
    this.collisionLayer = collisionLayer;
    this.collisionMask = collisionMask;
  }

  scaled(scale: number): CharacterCollision {
    return new CharacterCollision(
      this.name,
      this.shape.scaled(scale),
      { ...this.properties },
      this.collisionLayer,
      this.collisionMask,
    );
  }
}

export class ObjectCollisionRegionData {
  readonly regionId: string;
  readonly name: string;
  readonly regionRect: readonly [number, number, number, number];
  readonly shapes: CollisionPolygon[];
  readonly collisionLayer: number;
  readonly collisionMask: number;
  readonly properties: Record<string, unknown>;

  constructor(
    regionId: string,
    name: string,
    regionRect: readonly [number, number, number, number],
    shapes: CollisionPolygon[] = [],
    collisionLayer = 1,
    collisionMask = 0xffffffff,
    properties: Record<string, unknown> = {},
  ) {
    this.regionId = regionId;
    this.name = name;
    this.regionRect = regionRect;
    this.shapes = shapes;
    this.collisionLayer = collisionLayer;
    this.collisionMask = collisionMask;
    this.properties = properties;
  }

  hasCollision(): boolean {
    return this.shapes.some((s) => s.isValid());
  }

  getWorldShapes(worldX: number, worldY: number): CollisionPolygon[] {
    const ox = worldX + this.regionRect[0];
    const oy = worldY + this.regionRect[1];
    return this.shapes.map((s) => s.transform(ox, oy));
  }
}

export class ObjectCollisionData {
  readonly tilesetName: string;
  readonly regions: Map<string, ObjectCollisionRegionData>;

  constructor(
    tilesetName: string,
    regions: Map<string, ObjectCollisionRegionData> = new Map(),
  ) {
    this.tilesetName = tilesetName;
    this.regions = regions;
  }

  getRegion(regionId: string): ObjectCollisionRegionData | null {
    return this.regions.get(regionId) ?? null;
  }

  hasCollision(regionId: string): boolean {
    const region = this.getRegion(regionId);
    return region !== null && region.hasCollision();
  }
}

function parsePolygonShape(
  shapeData: Record<string, unknown>,
): CollisionPolygon {
  return new CollisionPolygon(
    parsePolygonVertices(shapeData["vertices"]),
    Boolean(shapeData["one_way"] ?? false),
  );
}

function parseTilesetCollisionRecord(
  data: Record<string, unknown>,
): TilesetCollision {
  try {
    const tilesetName = data["tileset_name"];
    if (typeof tilesetName !== "string")
      throw new TypeError("tileset_name must be a string");
    const tileSizeRaw = data["tile_size"];
    if (!Array.isArray(tileSizeRaw))
      throw new TypeError("tile_size must be a pair");
    const tileSize: Vec2 = [toInt(tileSizeRaw[0]), toInt(tileSizeRaw[1])];

    const tiles = new Map<number, TileCollisionData>();
    const tilesData = (data["tiles"] ?? {}) as Record<string, unknown>;
    if (
      typeof tilesData !== "object" ||
      tilesData === null ||
      Array.isArray(tilesData)
    ) {
      throw new TypeError("tiles must be an object");
    }
    for (const [tileIdStr, tileDataRaw] of Object.entries(tilesData)) {
      const tileId = toInt(tileIdStr);
      const tileData = tileDataRaw as Record<string, unknown>;
      const shapesRaw = tileData["shapes"] ?? [];
      if (!Array.isArray(shapesRaw))
        throw new TypeError(`tile ${tileId} shapes must be an array`);
      const shapes = shapesRaw.map((s) =>
        parsePolygonShape(s as Record<string, unknown>),
      );
      const propsRaw = tileData["properties"];
      const props = propsRaw === undefined ? {} : propsRaw;
      if (typeof props !== "object" || props === null || Array.isArray(props)) {
        throw new TypeError(`tile ${tileId} properties must be an object`);
      }
      const propsRecord = props as Record<string, unknown>;
      tiles.set(
        tileId,
        new TileCollisionData(
          tileId,
          shapes,
          toInt(propsRecord["collision_layer"] ?? 1),
          toInt(propsRecord["collision_mask"] ?? 0xffffffff),
        ),
      );
    }
    return new TilesetCollision(tilesetName, tileSize, tiles);
  } catch (err) {
    if (err instanceof CollisionParseError) {
      throw new CollisionParseError(
        `Invalid tileset collision data: ${err.message}`,
      );
    }
    throw new CollisionParseError(
      `Invalid tileset collision data: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function parseTilesetCollisionDict(data: unknown): TilesetCollision {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new CollisionParseError(
      "Invalid tileset collision data: expected object",
    );
  }
  return parseTilesetCollisionRecord(data as Record<string, unknown>);
}

export function parseTilesetCollisionJson(text: string): TilesetCollision {
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch (err) {
    throw new CollisionParseError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return parseTilesetCollisionDict(payload);
}

function parseShapeRecord(shapeData: Record<string, unknown>): CharacterShape {
  const shapeType = shapeData["type"];
  const offsetRaw = shapeData["offset"] ?? [0.0, 0.0];
  const offset = toPair(offsetRaw);
  if (shapeType === "rectangle") {
    return new RectangleShape(
      toFloat(shapeData["width"]),
      toFloat(shapeData["height"]),
      offset,
    );
  }
  if (shapeType === "circle") {
    return new CircleShape(toFloat(shapeData["radius"]), offset);
  }
  if (shapeType === "capsule") {
    return new CapsuleShape(
      toFloat(shapeData["radius"]),
      toFloat(shapeData["height"]),
      offset,
    );
  }
  if (shapeType === "polygon") {
    const verticesRaw = shapeData["vertices"];
    if (verticesRaw === null || verticesRaw === undefined) {
      throw new CollisionParseError("Polygon shape missing 'vertices' field");
    }
    const vertices = parsePolygonVertices(verticesRaw);
    if (vertices.length < 3) {
      throw new CollisionParseError(
        `Polygon must have at least 3 vertices, got ${vertices.length}`,
      );
    }
    return new CollisionPolygon(
      vertices,
      Boolean(shapeData["one_way"] ?? false),
    );
  }
  throw new CollisionParseError(`Unknown shape type: ${String(shapeType)}`);
}

export function parseCharacterCollisionDict(
  data: unknown,
  renderScale = 1.0,
): CharacterCollision {
  if (
    typeof renderScale !== "number" ||
    !Number.isFinite(renderScale) ||
    renderScale <= 0
  ) {
    throw new CollisionParseError(
      `render_scale must be finite and > 0, got ${JSON.stringify(renderScale)}`,
    );
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new CollisionParseError(
      "Invalid character collision data: expected object",
    );
  }
  try {
    const record = data as Record<string, unknown>;
    const name = record["name"];
    if (typeof name !== "string") throw new TypeError("name must be a string");
    const shapeRaw = record["shape"];
    if (
      typeof shapeRaw !== "object" ||
      shapeRaw === null ||
      Array.isArray(shapeRaw)
    ) {
      throw new TypeError("shape must be an object");
    }
    const shape = parseShapeRecord(shapeRaw as Record<string, unknown>);
    const propertiesRaw = record["properties"] ?? {};
    const properties =
      typeof propertiesRaw === "object" &&
      propertiesRaw !== null &&
      !Array.isArray(propertiesRaw)
        ? (propertiesRaw as Record<string, unknown>)
        : {};
    return new CharacterCollision(
      name,
      shape,
      properties,
      toInt(properties["collision_layer"] ?? 1),
      toInt(properties["collision_mask"] ?? 0xffffffff),
    ).scaled(renderScale);
  } catch (err) {
    if (err instanceof CollisionParseError) {
      throw new CollisionParseError(
        `Invalid character collision data: ${err.message}`,
      );
    }
    throw new CollisionParseError(
      `Invalid character collision data: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function parseCharacterCollisionJson(
  text: string,
  renderScale = 1.0,
): CharacterCollision {
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch (err) {
    throw new CollisionParseError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return parseCharacterCollisionDict(payload, renderScale);
}

export function parseObjectCollisionDict(data: unknown): ObjectCollisionData {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new CollisionParseError(
      "Invalid object collision data: expected object",
    );
  }
  try {
    const record = data as Record<string, unknown>;
    const tilesetName = record["tileset_name"];
    if (typeof tilesetName !== "string")
      throw new TypeError("tileset_name must be a string");
    const regions = new Map<string, ObjectCollisionRegionData>();
    const regionsData = (record["regions"] ?? {}) as Record<string, unknown>;
    if (
      typeof regionsData !== "object" ||
      regionsData === null ||
      Array.isArray(regionsData)
    ) {
      throw new TypeError("regions must be an object");
    }
    for (const [regionId, regionRaw] of Object.entries(regionsData)) {
      const regionData = regionRaw as Record<string, unknown>;
      const rectRaw = regionData["region_rect"];
      if (!Array.isArray(rectRaw))
        throw new TypeError(`region ${regionId} region_rect must be an array`);
      const regionRect: readonly [number, number, number, number] = [
        toInt(rectRaw[0]),
        toInt(rectRaw[1]),
        toInt(rectRaw[2]),
        toInt(rectRaw[3]),
      ];
      const shapesRaw = regionData["shapes"] ?? [];
      if (!Array.isArray(shapesRaw))
        throw new TypeError(`region ${regionId} shapes must be an array`);
      const shapes = shapesRaw.map((s) =>
        parsePolygonShape(s as Record<string, unknown>),
      );
      const propsRaw = regionData["properties"] ?? {};
      const props =
        typeof propsRaw === "object" &&
        propsRaw !== null &&
        !Array.isArray(propsRaw)
          ? (propsRaw as Record<string, unknown>)
          : {};
      regions.set(
        regionId,
        new ObjectCollisionRegionData(
          regionId,
          typeof regionData["name"] === "string"
            ? (regionData["name"] as string)
            : "",
          regionRect,
          shapes,
          toInt(props["collision_layer"] ?? 1),
          toInt(props["collision_mask"] ?? 0xffffffff),
          props,
        ),
      );
    }
    return new ObjectCollisionData(tilesetName, regions);
  } catch (err) {
    if (err instanceof CollisionParseError) {
      throw new CollisionParseError(
        `Invalid object collision data: ${err.message}`,
      );
    }
    throw new CollisionParseError(
      `Invalid object collision data: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function parseObjectCollisionJson(text: string): ObjectCollisionData {
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch (err) {
    throw new CollisionParseError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return parseObjectCollisionDict(payload);
}
