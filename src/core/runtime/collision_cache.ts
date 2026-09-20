import {
  CharacterCollision,
  ObjectCollisionData,
  TilesetCollision,
  parseCharacterCollisionDict,
  parseObjectCollisionDict,
  parseTilesetCollisionDict,
} from "../parser/collision.js";
import { CollisionParseError } from "../errors.js";

export type TextReader = (path: string) => Promise<string>;

async function readJson(reader: TextReader, path: string): Promise<unknown> {
  const text = await reader(path);
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    throw new CollisionParseError(
      `Invalid JSON in ${path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export class CollisionCache {
  private readonly tilesetCache = new Map<string, TilesetCollision | null>();
  private readonly characterCache = new Map<
    string,
    CharacterCollision | null
  >();
  private readonly objectCache = new Map<string, ObjectCollisionData | null>();

  constructor(private readonly readText: TextReader) {}

  async getTilesetCollision(path: string): Promise<TilesetCollision | null> {
    const hit = this.tilesetCache.get(path);
    if (hit !== undefined) return hit;
    let value: TilesetCollision | null;
    try {
      value = parseTilesetCollisionDict(await readJson(this.readText, path));
    } catch {
      value = null;
    }
    this.tilesetCache.set(path, value);
    return value;
  }

  async getCharacterCollision(
    path: string,
    renderScale = 1.0,
  ): Promise<CharacterCollision | null> {
    const key = `${path}::${renderScale}`;
    const hit = this.characterCache.get(key);
    if (hit !== undefined) return hit;
    let value: CharacterCollision | null;
    try {
      value = parseCharacterCollisionDict(
        await readJson(this.readText, path),
        renderScale,
      );
    } catch {
      value = null;
    }
    this.characterCache.set(key, value);
    return value;
  }

  async getObjectCollision(path: string): Promise<ObjectCollisionData | null> {
    const hit = this.objectCache.get(path);
    if (hit !== undefined) return hit;
    let value: ObjectCollisionData | null;
    try {
      value = parseObjectCollisionDict(await readJson(this.readText, path));
    } catch {
      value = null;
    }
    this.objectCache.set(path, value);
    return value;
  }

  clear(): void {
    this.tilesetCache.clear();
    this.characterCache.clear();
    this.objectCache.clear();
  }

  async preloadTileset(path: string): Promise<void> {
    await this.getTilesetCollision(path);
  }

  async preloadCharacter(path: string, renderScale = 1.0): Promise<void> {
    await this.getCharacterCollision(path, renderScale);
  }

  async preloadObject(path: string): Promise<void> {
    await this.getObjectCollision(path);
  }
}
