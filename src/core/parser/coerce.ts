import { MapParseError } from "../errors.js";
import type { Vec2 } from "../vec.js";

export type JsonDict = Record<string, unknown>;

export function _ctx(path: string, detail: string): string {
  return `${path}: ${detail}`;
}

export function _requireDict(value: unknown, path: string): JsonDict {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MapParseError(_ctx(path, "expected object"));
  }
  return value as JsonDict;
}

export function _requireList(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new MapParseError(_ctx(path, "expected array"));
  }
  return value;
}

export function _requireStr(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new MapParseError(_ctx(path, "expected string"));
  }
  return value;
}

export function _coerceInt(value: unknown, path: string): number {
  if (typeof value === "boolean") {
    throw new MapParseError(_ctx(path, "expected int (got bool)"));
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new MapParseError(_ctx(path, "expected int"));
    }
    return value;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (/^[+-]?\d+$/.test(t)) {
      const n = Number(t);
      if (Number.isSafeInteger(n)) return n;
    }
    throw new MapParseError(_ctx(path, "expected int"));
  }
  throw new MapParseError(_ctx(path, "expected int"));
}

export function _coerceFloat(value: unknown, path: string): number {
  if (typeof value === "boolean") {
    throw new MapParseError(_ctx(path, "expected number (got bool)"));
  }
  if (typeof value === "number") {
    return value;
  }
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
    throw new MapParseError(_ctx(path, "expected number"));
  }
  throw new MapParseError(_ctx(path, "expected number"));
}

export function _coerceBool(value: unknown, path: string): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && (value === 0 || value === 1)) {
    return value === 1;
  }
  throw new MapParseError(_ctx(path, "expected bool"));
}

export function _optionalDict(value: unknown, path: string): JsonDict | null {
  if (value === null || value === undefined) return null;
  return _requireDict(value, path);
}

// Anchored at both ends so leading garbage is rejected. Fractional parts are
// accepted because production maps store float points (e.g. meta.scroll
// "1499.35;610.03"); integer inputs still parse as before.
const POINT_RE = /^(-?\d+(?:\.\d+)?)([!-/:-@[-`{-~])(-?\d+(?:\.\d+)?)$/;

export function _parsePoint(text: string, path: string): Vec2 {
  if (typeof text !== "string") {
    throw new MapParseError(_ctx(path, "expected point string"));
  }
  const matched = POINT_RE.exec(text.trim());
  if (
    matched === null ||
    matched[1] === undefined ||
    matched[3] === undefined
  ) {
    throw new MapParseError(
      _ctx(path, `invalid point ${JSON.stringify(text)}`),
    );
  }
  return [Number(matched[1]), Number(matched[3])];
}

export function _parsePointField(
  raw: unknown,
  path: string,
  fallback?: string,
): Vec2 {
  if ((raw === null || raw === undefined) && fallback !== undefined) {
    return _parsePoint(fallback, path);
  }
  if (typeof raw !== "string") {
    throw new MapParseError(_ctx(path, "expected serialized point string"));
  }
  return _parsePoint(raw, path);
}
