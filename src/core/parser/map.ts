import { MapParseError } from "../errors.js";
import { tileKey, type Vec2 } from "../vec.js";
import {
  _coerceBool as coerceBool,
  _coerceFloat as coerceFloat,
  _coerceInt as coerceInt,
  _ctx as ctx,
  _optionalDict as optionalDict,
  _parsePoint as parsePoint,
  _parsePointField as parsePointField,
  _requireDict as requireDict,
  _requireList as requireList,
  _requireStr as requireStr,
  type JsonDict,
} from "./coerce.js";

export type { JsonDict };
export type TilesetRef = number | string;

export interface ParsedTile {
  readonly pos: Vec2;
  readonly ttype: TilesetRef;
  readonly variant: number;
  readonly gid: number | null;
  readonly properties: JsonDict | null;
  readonly flipH: boolean;
  readonly flipV: boolean;
  readonly flipD: boolean;
  readonly rotatedHex120: boolean;
}

export interface ParsedObjectArea {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface ObjectAnimation {
  readonly frameCount: number;
  readonly frameDurationMs: number;
  readonly speed: number;
  readonly loop: boolean;
  readonly animationMode: string;
  readonly randomPhase: boolean;
  readonly frames: readonly number[];
  readonly frameStride: number;
  readonly frameW: number | null;
  readonly frameH: number | null;
}

export interface ParsedObject {
  readonly area: ParsedObjectArea;
  readonly ttype: number;
  readonly tilesetType: string;
  readonly variant: number;
  readonly properties: JsonDict | null;
  readonly animation: ObjectAnimation | null;
}

export interface TilesetAnimation {
  readonly frameCount: number;
  readonly frameDurationMs: number;
  readonly frameStride: number;
  readonly loop: boolean;
  readonly animationMode: string;
  readonly frameW: number | null;
  readonly frameH: number | null;
}

export interface ParsedTileset {
  readonly path: string;
  readonly type: string;
  readonly tileCount: number;
  readonly firstgid: number;
  readonly properties: JsonDict;
  readonly tileProperties: Record<string, JsonDict>;
  readonly animation: TilesetAnimation | null;
}

export interface ParsedImagePlacement {
  readonly pid: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly mode: string;
}

export interface ParsedLayer {
  readonly id: number;
  readonly name: string;
  readonly layerType: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly opacity: number;
  readonly zIndex: number;
  readonly ySort: boolean;
  readonly ySortOrigin: unknown;
  readonly collisionEnabled: boolean;
  readonly properties: JsonDict;
  readonly tiles: Map<string, ParsedTile>;
  readonly objects: Map<number, ParsedObject>;
  readonly nextObjectId: number | null;
  readonly ttypes: Set<number>;
  readonly imagePath: string | null;
  readonly imageRect: readonly [number, number, number, number] | null;
  readonly imagePlacements: ParsedImagePlacement[];
  readonly nextPlacementId: number | null;
}

export interface ParsedAutotileRule {
  readonly name: string;
  readonly neighbors: readonly Vec2[];
  readonly tilesetPath: string;
  readonly tilesetIndex: number | null;
  readonly variantIds: readonly number[];
  readonly groupId: unknown;
  readonly raw: JsonDict;
}

export interface ParsedAutotileGroup {
  readonly name: string;
  readonly rules: ParsedAutotileRule[];
}

export interface ParsedMeta {
  readonly tileSize: Vec2;
  readonly mapSize: Vec2;
  readonly initialMapSize: Vec2;
  readonly zoomLevel: number;
  readonly scroll: Vec2;
  readonly version: string;
  readonly renderScale: number;
}

export interface ParsedProjectState {
  readonly rules: ParsedAutotileRule[];
  readonly groups: ParsedAutotileGroup[];
  readonly automapRules: unknown;
}

export interface ParsedNodeRef {
  readonly nodeId: unknown;
  readonly area: ParsedObjectArea;
  readonly properties: JsonDict;
}

export interface ParsedMap {
  readonly meta: ParsedMeta;
  readonly layers: ParsedLayer[];
  readonly tilesets: ParsedTileset[];
  readonly projectState: ParsedProjectState;
  readonly raw: JsonDict;
  readonly nodes: ParsedNodeRef[];
  readonly nodeGroups: string[];
}

function parseTile(tileData: JsonDict, context: string): ParsedTile {
  const pos = parsePoint(
    requireStr(tileData["pos"], `${context}.pos`),
    `${context}.pos`,
  );
  const variant = coerceInt(tileData["variant"], `${context}.variant`);
  const ttypeRaw = tileData["ttype"] ?? 0;
  const ttype: TilesetRef =
    typeof ttypeRaw === "string"
      ? ttypeRaw
      : coerceInt(ttypeRaw, `${context}.ttype`);
  const props = optionalDict(tileData["properties"], `${context}.properties`);
  const gidRaw = tileData["gid"];
  const gid =
    gidRaw === null || gidRaw === undefined
      ? null
      : coerceInt(gidRaw, `${context}.gid`);
  return {
    pos,
    ttype,
    variant,
    gid,
    properties: props,
    flipH: tileData["flip_h"] === true,
    flipV: tileData["flip_v"] === true,
    flipD: tileData["flip_d"] === true,
    rotatedHex120: tileData["rotated_hex120"] === true,
  };
}

function parseTiles(
  tilesObj: JsonDict,
  context: string,
): Map<string, ParsedTile> {
  const result = new Map<string, ParsedTile>();
  for (const [key, value] of Object.entries(tilesObj)) {
    const tileDict = requireDict(value, `${context}[${JSON.stringify(key)}]`);
    const tile = parseTile(tileDict, `${context}[${JSON.stringify(key)}]`);
    result.set(tileKey(tile.pos[0], tile.pos[1]), tile);
  }
  return result;
}

function parseObjectArea(areaObj: JsonDict, context: string): ParsedObjectArea {
  return {
    x: coerceInt(areaObj["x"], `${context}.x`),
    y: coerceInt(areaObj["y"], `${context}.y`),
    w: coerceInt(areaObj["w"], `${context}.w`),
    h: coerceInt(areaObj["h"], `${context}.h`),
  };
}

function parseObjectAnimation(
  animObj: JsonDict,
  context: string,
): ObjectAnimation {
  const frameCount = coerceInt(
    animObj["frame_count"],
    `${context}.frame_count`,
  );
  if (frameCount < 1) {
    throw new MapParseError(ctx(`${context}.frame_count`, "must be >= 1"));
  }
  const frameDurationMs = coerceFloat(
    animObj["frame_duration_ms"],
    `${context}.frame_duration_ms`,
  );
  if (!Number.isFinite(frameDurationMs) || frameDurationMs <= 0) {
    throw new MapParseError(
      ctx(`${context}.frame_duration_ms`, "must be > 0 and finite"),
    );
  }
  const framesRaw = animObj["frames"];
  let frames: number[] = [];
  if (framesRaw !== null && framesRaw !== undefined) {
    const framesList = requireList(framesRaw, `${context}.frames`);
    if (framesList.length !== frameCount) {
      throw new MapParseError(
        ctx(
          `${context}.frames`,
          `must contain exactly ${frameCount} entries (got ${framesList.length})`,
        ),
      );
    }
    frames = framesList.map((f, i) => coerceInt(f, `${context}.frames[${i}]`));
    frames.forEach((frameIdx, i) => {
      if (frameIdx < 0) {
        throw new MapParseError(
          ctx(
            `${context}.frames[${i}]`,
            `must be non-negative (got ${frameIdx})`,
          ),
        );
      }
    });
  }
  return {
    frameCount,
    frameDurationMs,
    speed: coerceFloat(animObj["speed"] ?? 1.0, `${context}.speed`),
    loop: coerceBool(animObj["loop"] ?? true, `${context}.loop`),
    animationMode: requireStr(
      animObj["animation_mode"] ?? "default",
      `${context}.animation_mode`,
    ),
    randomPhase: coerceBool(
      animObj["random_phase"] ?? false,
      `${context}.random_phase`,
    ),
    frames,
    frameStride: 1,
    frameW: null,
    frameH: null,
  };
}

function parseObjects(
  objsObj: JsonDict,
  context: string,
): Map<number, ParsedObject> {
  const result = new Map<number, ParsedObject>();
  for (const [key, value] of Object.entries(objsObj)) {
    const oid = coerceInt(key, `${context}.<id>`);
    const objDict = requireDict(value, `${context}.${key}`);
    const area = parseObjectArea(
      requireDict(objDict["area"], `${context}.${key}.area`),
      `${context}.${key}.area`,
    );
    const animationRaw = objDict["animation"];
    const animation =
      animationRaw === null || animationRaw === undefined
        ? null
        : parseObjectAnimation(
            requireDict(animationRaw, `${context}.${key}.animation`),
            `${context}.${key}.animation`,
          );
    result.set(oid, {
      area,
      ttype: coerceInt(objDict["ttype"], `${context}.${key}.ttype`),
      tilesetType: requireStr(
        objDict["tileset_type"] ?? "object",
        `${context}.${key}.tileset_type`,
      ),
      variant: coerceInt(objDict["variant"], `${context}.${key}.variant`),
      properties: optionalDict(
        objDict["properties"],
        `${context}.${key}.properties`,
      ),
      animation,
    });
  }
  return result;
}

function parseLayer(
  layerObj: JsonDict,
  layerId: number,
  context: string,
): ParsedLayer {
  const props =
    optionalDict(layerObj["properties"], `${context}.properties`) ?? {};
  let collisionEnabled = true;
  if ("collision_enabled" in layerObj) {
    collisionEnabled = coerceBool(
      layerObj["collision_enabled"],
      `${context}.collision_enabled`,
    );
  } else if ("collision_enabled" in props) {
    collisionEnabled = coerceBool(
      props["collision_enabled"],
      `${context}.properties.collision_enabled`,
    );
  }

  const tiles = parseTiles(
    requireDict(layerObj["tiles"] ?? {}, `${context}.tiles`),
    `${context}.tiles`,
  );

  const objects = new Map<number, ParsedObject>();
  const ttypes = new Set<number>();
  let nextObjectId: number | null = null;
  let layerType = requireStr(layerObj["type"], `${context}.type`);
  if (layerType === "object") {
    const parsed = parseObjects(
      requireDict(layerObj["objects"] ?? {}, `${context}.objects`),
      `${context}.objects`,
    );
    for (const [oid, obj] of parsed) {
      objects.set(oid, obj);
      ttypes.add(obj.ttype);
    }
    const nextRaw = layerObj["next_object_id"];
    if (
      "next_object_id" in layerObj &&
      nextRaw !== null &&
      nextRaw !== undefined
    ) {
      nextObjectId = coerceInt(nextRaw, `${context}.next_object_id`);
    }
  }

  const imagePathRaw = layerObj["image_path"];
  let imagePath: string | null = null;
  if (imagePathRaw !== null && imagePathRaw !== undefined) {
    imagePath = requireStr(imagePathRaw, `${context}.image_path`);
    if (layerType === "background" || layerType === "background_layer") {
      layerType = "image";
    }
  }

  const imageRectRaw = layerObj["image_rect"];
  let imageRect: readonly [number, number, number, number] | null = null;
  if (imageRectRaw !== null && imageRectRaw !== undefined) {
    const rectObj = requireDict(imageRectRaw, `${context}.image_rect`);
    imageRect = [
      coerceInt(rectObj["x"], `${context}.image_rect.x`),
      coerceInt(rectObj["y"], `${context}.image_rect.y`),
      coerceInt(rectObj["w"], `${context}.image_rect.w`),
      coerceInt(rectObj["h"], `${context}.image_rect.h`),
    ];
  }

  const imagePlacements: ParsedImagePlacement[] = [];
  let nextPlacementId: number | null = null;
  const placementsRaw = layerObj["image_placements"];
  if (placementsRaw !== null && placementsRaw !== undefined) {
    const placementsList = requireList(
      placementsRaw,
      `${context}.image_placements`,
    );
    placementsList.forEach((raw, idx) => {
      try {
        const entry = requireDict(raw, `${context}.image_placements[${idx}]`);
        const pidRaw = entry["pid"];
        const pid =
          typeof pidRaw === "number" && Number.isInteger(pidRaw)
            ? pidRaw
            : coerceInt(pidRaw, `${context}.image_placements[${idx}].pid`);
        let mode = String(entry["mode"] ?? "stretch");
        if (mode !== "stretch" && mode !== "repeat") mode = "stretch";
        imagePlacements.push({
          pid,
          x: coerceInt(entry["x"], `${context}.image_placements[${idx}].x`),
          y: coerceInt(entry["y"], `${context}.image_placements[${idx}].y`),
          w: coerceInt(entry["w"], `${context}.image_placements[${idx}].w`),
          h: coerceInt(entry["h"], `${context}.image_placements[${idx}].h`),
          mode,
        });
        if (nextPlacementId === null || pid >= nextPlacementId) {
          nextPlacementId = pid + 1;
        }
      } catch (err) {
        if (!(err instanceof MapParseError || err instanceof TypeError))
          throw err;
      }
    });
  }
  const nextPidRaw = layerObj["next_placement_id"];
  if (nextPidRaw !== null && nextPidRaw !== undefined) {
    let stored: number;
    try {
      const n =
        typeof nextPidRaw === "number"
          ? nextPidRaw
          : coerceInt(nextPidRaw, `${context}.next_placement_id`);
      stored = Number.isInteger(n) ? n : 1;
    } catch {
      stored = 1;
    }
    const current = nextPlacementId ?? 1;
    nextPlacementId = Math.max(current, Math.max(1, stored));
  }

  return {
    id: layerId,
    name: requireStr(layerObj["name"], `${context}.name`),
    layerType,
    visible: coerceBool(layerObj["visible"] ?? true, `${context}.visible`),
    locked: coerceBool(layerObj["locked"] ?? false, `${context}.locked`),
    opacity: coerceFloat(layerObj["opacity"] ?? 1.0, `${context}.opacity`),
    zIndex: coerceInt(layerObj["z_index"] ?? layerId, `${context}.z_index`),
    ySort: coerceBool(layerObj["y_sort"] ?? false, `${context}.y_sort`),
    ySortOrigin: layerObj["y_sort_origin"] ?? 0,
    collisionEnabled,
    properties: { ...props },
    tiles,
    objects,
    nextObjectId,
    ttypes,
    imagePath,
    imageRect,
    imagePlacements,
    nextPlacementId,
  };
}

function parseRule(ruleObj: JsonDict, context: string): ParsedAutotileRule {
  const neighborsRaw = requireList(
    ruleObj["neighbors"] ?? [],
    `${context}.neighbors`,
  );
  const neighbors: Vec2[] = neighborsRaw.map((pair, idx) => {
    const pairList = requireList(pair, `${context}.neighbors[${idx}]`);
    if (pairList.length !== 2) {
      throw new MapParseError(
        ctx(`${context}.neighbors[${idx}]`, "expected [x, y]"),
      );
    }
    return [
      coerceInt(pairList[0], `${context}.neighbors[${idx}][0]`),
      coerceInt(pairList[1], `${context}.neighbors[${idx}][1]`),
    ] as Vec2;
  });
  const variantsRaw = requireList(
    ruleObj["variant_ids"] ?? [],
    `${context}.variant_ids`,
  );
  const variantIds = variantsRaw.map((v, i) =>
    coerceInt(v, `${context}.variant_ids[${i}]`),
  );
  const tilesetIndexRaw = ruleObj["tileset_index"];
  return {
    name: requireStr(ruleObj["name"], `${context}.name`),
    neighbors,
    tilesetPath: requireStr(
      ruleObj["tileset_path"] ?? "",
      `${context}.tileset_path`,
    ),
    tilesetIndex:
      tilesetIndexRaw === null || tilesetIndexRaw === undefined
        ? null
        : coerceInt(tilesetIndexRaw, `${context}.tileset_index`),
    variantIds,
    groupId: ruleObj["group_id"] ?? null,
    raw: { ...ruleObj },
  };
}

function parseGroup(groupObj: JsonDict, context: string): ParsedAutotileGroup {
  const rulesRaw = requireList(groupObj["rules"] ?? [], `${context}.rules`);
  return {
    name: requireStr(groupObj["name"], `${context}.name`),
    rules: rulesRaw.map((r, i) =>
      parseRule(
        requireDict(r, `${context}.rules[${i}]`),
        `${context}.rules[${i}]`,
      ),
    ),
  };
}

function parseTilesetsList(
  tilesetsRaw: unknown[],
  context: string,
): ParsedTileset[] {
  return tilesetsRaw.map((ts, i) => {
    if (typeof ts === "string") {
      return {
        path: ts,
        type: "tile",
        tileCount: 0,
        firstgid: 0,
        properties: {},
        tileProperties: {},
        animation: null,
      } satisfies ParsedTileset;
    }
    const tsObj = requireDict(ts, `${context}[${i}]`);
    const props =
      optionalDict(tsObj["properties"], `${context}[${i}].properties`) ?? {};
    const tileProperties: Record<string, JsonDict> = {};
    const rawTileProps = tsObj["tile_properties"];
    if (rawTileProps !== null && rawTileProps !== undefined) {
      const tpObj = requireDict(
        rawTileProps,
        `${context}[${i}].tile_properties`,
      );
      for (const [k, v] of Object.entries(tpObj)) {
        tileProperties[String(k)] = requireDict(
          v,
          `${context}[${i}].tile_properties[${JSON.stringify(k)}]`,
        );
      }
    }
    let animation: TilesetAnimation | null = null;
    const animationRaw = tsObj["animation"];
    if (animationRaw !== null && animationRaw !== undefined) {
      const animObj = requireDict(animationRaw, `${context}[${i}].animation`);
      const frameStrideRaw = animObj["frame_stride"];
      const frameWRaw = animObj["frame_w"];
      const frameHRaw = animObj["frame_h"];
      const frameCount = coerceInt(
        animObj["frame_count"],
        `${context}[${i}].animation.frame_count`,
      );
      const frameDurationMs = coerceFloat(
        animObj["frame_duration_ms"],
        `${context}[${i}].animation.frame_duration_ms`,
      );
      if (frameCount < 1) {
        throw new MapParseError(
          ctx(`${context}[${i}].animation.frame_count`, "must be >= 1"),
        );
      }
      if (!Number.isFinite(frameDurationMs) || frameDurationMs <= 0) {
        throw new MapParseError(
          ctx(
            `${context}[${i}].animation.frame_duration_ms`,
            "must be > 0 and finite",
          ),
        );
      }
      animation = {
        frameCount,
        frameDurationMs,
        frameStride:
          frameStrideRaw === null || frameStrideRaw === undefined
            ? 1
            : coerceInt(
                frameStrideRaw,
                `${context}[${i}].animation.frame_stride`,
              ),
        loop: coerceBool(
          animObj["loop"] ?? true,
          `${context}[${i}].animation.loop`,
        ),
        animationMode: requireStr(
          animObj["animation_mode"] ?? "default",
          `${context}[${i}].animation.animation_mode`,
        ),
        frameW:
          frameWRaw === null || frameWRaw === undefined
            ? null
            : coerceInt(frameWRaw, `${context}[${i}].animation.frame_w`),
        frameH:
          frameHRaw === null || frameHRaw === undefined
            ? null
            : coerceInt(frameHRaw, `${context}[${i}].animation.frame_h`),
      };
    }
    return {
      path: requireStr(tsObj["path"], `${context}[${i}].path`),
      type: requireStr(tsObj["type"] ?? "tile", `${context}[${i}].type`),
      tileCount: coerceInt(
        tsObj["tile_count"] ?? 0,
        `${context}[${i}].tile_count`,
      ),
      firstgid: coerceInt(tsObj["firstgid"] ?? 0, `${context}[${i}].firstgid`),
      properties: { ...props },
      tileProperties,
      animation,
    } satisfies ParsedTileset;
  });
}

function parseResources(
  resourcesRaw: unknown,
  context: string,
): ParsedTileset[] {
  if (Array.isArray(resourcesRaw)) {
    return parseTilesetsList(resourcesRaw, `${context} (list form)`);
  }
  const resourcesObj = requireDict(resourcesRaw, context);
  return parseTilesetsList(
    requireList(resourcesObj["tilesets"] ?? [], `${context}.tilesets`),
    `${context}.tilesets`,
  );
}

function expandOngridToLayer(
  dataObj: JsonDict,
  context: string,
): ParsedLayer[] {
  const rawOngrid = requireDict(dataObj["ongrid"] ?? {}, `${context}.ongrid`);
  const tiles = new Map<string, ParsedTile>();
  for (const [locStr, tileData] of Object.entries(rawOngrid)) {
    const tileDict = requireDict(
      tileData,
      `${context}.ongrid[${JSON.stringify(locStr)}]`,
    );
    const withPos: JsonDict =
      "pos" in tileDict ? tileDict : { ...tileDict, pos: String(locStr) };
    const tile = parseTile(
      withPos,
      `${context}.ongrid[${JSON.stringify(locStr)}]`,
    );
    tiles.set(tileKey(tile.pos[0], tile.pos[1]), tile);
  }
  return [
    {
      id: 0,
      name: "Terrain",
      layerType: "tile",
      visible: true,
      locked: false,
      opacity: 1.0,
      zIndex: 0,
      ySort: false,
      ySortOrigin: 0,
      collisionEnabled: true,
      properties: {},
      tiles,
      objects: new Map(),
      nextObjectId: null,
      ttypes: new Set(),
      imagePath: null,
      imageRect: null,
      imagePlacements: [],
      nextPlacementId: null,
    },
  ];
}

export function parseMapDict(root: unknown): ParsedMap {
  const rootObj = requireDict(root, "root");
  const metaObj = requireDict(rootObj["meta"], "meta");
  const tileSize = parsePointField(metaObj["tile_size"], "meta.tile_size");
  const mapSize = parsePointField(
    metaObj["map_size"],
    "meta.map_size",
    `${tileSize[0]};${tileSize[1]}`,
  );
  const initRaw = metaObj["initial_map_size"];
  const initialMapSize =
    initRaw === null || initRaw === undefined
      ? mapSize
      : parsePointField(initRaw, "meta.initial_map_size");

  const meta: ParsedMeta = {
    tileSize,
    mapSize,
    initialMapSize,
    zoomLevel: coerceFloat(metaObj["zoom_level"] ?? 1.0, "meta.zoom_level"),
    scroll: parsePointField(metaObj["scroll"], "meta.scroll", "0;0"),
    version: requireStr(metaObj["version"] ?? "1.1", "meta.version"),
    renderScale: coerceFloat(
      metaObj["render_scale"] ?? 1.0,
      "meta.render_scale",
    ),
  };

  const dataObj = requireDict(rootObj["data"], "data");
  const layersRaw = dataObj["layers"];
  let layers: ParsedLayer[];
  if (layersRaw === null || layersRaw === undefined) {
    layers = [];
  } else {
    const list = requireList(layersRaw, "data.layers");
    layers = list.map((layer, i) =>
      parseLayer(
        requireDict(layer, `data.layers[${i}]`),
        i,
        `data.layers[${i}]`,
      ),
    );
  }
  if (layers.length === 0) {
    layers = expandOngridToLayer(dataObj, "data");
  }

  const projectObj = requireDict(
    rootObj["project_state"] ?? {},
    "project_state",
  );
  const rulesRaw = requireList(
    projectObj["rules"] ?? [],
    "project_state.rules",
  );
  const groupsRaw = requireList(
    projectObj["groups"] ?? [],
    "project_state.groups",
  );
  const projectState: ParsedProjectState = {
    rules: rulesRaw.map((rule, i) =>
      parseRule(
        requireDict(rule, `project_state.rules[${i}]`),
        `project_state.rules[${i}]`,
      ),
    ),
    groups: groupsRaw.map((group, i) =>
      parseGroup(
        requireDict(group, `project_state.groups[${i}]`),
        `project_state.groups[${i}]`,
      ),
    ),
    automapRules: projectObj["automap_rules"] ?? null,
  };

  return {
    meta,
    layers,
    tilesets: parseResources(rootObj["resources"] ?? {}, "resources"),
    projectState,
    raw: rootObj,
    nodes: [],
    nodeGroups: [],
  };
}

export function parseMapJson(text: string): ParsedMap {
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch (err) {
    throw new MapParseError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return parseMapDict(payload);
}
