export class TilemapParserError extends Error {
  override name = "TilemapParserError";
}

export class MapParseError extends TilemapParserError {
  override name = "MapParseError";
}

export class CollisionParseError extends TilemapParserError {
  override name = "CollisionParseError";
}

export class AnimationParseError extends TilemapParserError {
  override name = "AnimationParseError";
}
