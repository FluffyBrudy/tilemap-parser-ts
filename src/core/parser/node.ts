import { MapParseError } from "../errors.js";
import {
  _coerceInt,
  _optionalDict,
  _requireDict,
  _requireList,
  _requireStr,
  type JsonDict,
} from "./coerce.js";
import type { ParsedObjectArea } from "./map.js";

export interface ParsedNode {
  readonly nodeId: string;
  readonly name: string;
  readonly nodeType: string;
  readonly area: ParsedObjectArea;
  readonly layerName: string;
  readonly properties: JsonDict;
  readonly group: string | null;
}

function parseArea(raw: unknown, context: string): ParsedObjectArea {
  const d = _requireDict(raw, context);
  return {
    x: _coerceInt(d["x"], `${context}.x`),
    y: _coerceInt(d["y"], `${context}.y`),
    w: _coerceInt(d["w"], `${context}.w`),
    h: _coerceInt(d["h"], `${context}.h`),
  };
}

function parseNode(raw: unknown, context: string): ParsedNode {
  const d = _requireDict(raw, context);
  const groupRaw = d["group"];
  return {
    nodeId: _requireStr(d["node_id"], `${context}.node_id`),
    name: _requireStr(d["name"], `${context}.name`),
    nodeType: _requireStr(d["node_type"] ?? "area", `${context}.node_type`),
    area: parseArea(d["area"], `${context}.area`),
    layerName: _requireStr(d["layer_name"] ?? "", `${context}.layer_name`),
    properties: _optionalDict(d["properties"], `${context}.properties`) ?? {},
    group:
      groupRaw === null || groupRaw === undefined ? null : String(groupRaw),
  };
}

export function parseNodesDict(root: unknown): ParsedNode[] {
  const rootObj = _requireDict(root, "root");
  const rawNodes = _requireList(rootObj["nodes"] ?? [], "root.nodes");
  return rawNodes.map((item, i) => parseNode(item, `root.nodes[${i}]`));
}

export function parseNodesJson(text: string): ParsedNode[] {
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch (err) {
    throw new MapParseError(
      `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return parseNodesDict(payload);
}
