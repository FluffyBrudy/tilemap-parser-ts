export const TANIM_VERSION = 1;
export const TANIM_SUFFIX = ".tanim.json";
export const ANIM_CLIP_KEY = "anim_clip";
export const MODE_DEFAULT = "default";
export const MODE_RANDOM_START = "random_start_times";

export class TileClipFrame {
  readonly sheet: string;
  readonly variant: number;
  readonly durationMs: number;

  constructor(sheet = "", variant = 0, durationMs = 100.0) {
    this.sheet = sheet;
    this.variant = variant;
    this.durationMs = durationMs;
  }
}

export class TileAnimClip {
  readonly name: string;
  readonly frames: readonly TileClipFrame[];
  readonly loop: boolean;
  readonly mode: string;

  constructor(
    name = "",
    frames: readonly TileClipFrame[] = [],
    loop = true,
    mode: string = MODE_DEFAULT,
  ) {
    this.name = name;
    this.frames = frames;
    this.loop = loop;
    this.mode = mode;
  }

  totalDurationMs(): number {
    return this.frames.reduce((acc, f) => acc + f.durationMs, 0);
  }
}

function isFrame(
  frame: unknown,
): frame is { sheet: string; variant: number; duration_ms: number } {
  if (typeof frame !== "object" || frame === null || Array.isArray(frame))
    return false;
  const f = frame as Record<string, unknown>;
  if (typeof f["sheet"] !== "string" || f["sheet"] === "") return false;
  if (
    typeof f["variant"] !== "number" ||
    !Number.isInteger(f["variant"]) ||
    (f["variant"] as number) < 0
  ) {
    return false;
  }
  const dur = f["duration_ms"] ?? 100.0;
  return typeof dur === "number" && Number.isFinite(dur) && dur > 0;
}

function parseClip(name: unknown, data: unknown): TileAnimClip | null {
  if (
    typeof name !== "string" ||
    name === "" ||
    typeof data !== "object" ||
    data === null ||
    Array.isArray(data)
  ) {
    return null;
  }
  const d = data as Record<string, unknown>;
  const rawFrames = d["frames"];
  if (!Array.isArray(rawFrames) || rawFrames.length === 0) return null;
  const frames = rawFrames
    .filter(isFrame)
    .map(
      (f) =>
        new TileClipFrame(f.sheet, f.variant, Number(f.duration_ms ?? 100.0)),
    );
  if (frames.length === 0) return null;
  const modeRaw = d["mode"] ?? MODE_DEFAULT;
  const mode =
    modeRaw === MODE_DEFAULT || modeRaw === MODE_RANDOM_START
      ? modeRaw
      : MODE_DEFAULT;
  return new TileAnimClip(name, frames, d["loop"] === true, mode);
}

export class TileAnimFile {
  readonly tileset: string;
  readonly clips: TileAnimClip[];

  constructor(tileset = "", clips: TileAnimClip[] = []) {
    this.tileset = tileset;
    this.clips = clips;
  }

  byName(name: string): TileAnimClip | null {
    return this.clips.find((c) => c.name === name) ?? null;
  }

  toDict(): Record<string, unknown> {
    const clips: Record<string, unknown> = {};
    for (const c of this.clips) {
      clips[c.name] = {
        loop: c.loop,
        mode: c.mode,
        frames: c.frames.map((f) => ({
          sheet: f.sheet,
          variant: f.variant,
          duration_ms: f.durationMs,
        })),
      };
    }
    return { version: TANIM_VERSION, tileset: this.tileset, clips };
  }

  static fromDict(data: unknown): TileAnimFile {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return new TileAnimFile();
    }
    const d = data as Record<string, unknown>;
    const tileset = d["tileset"];
    const raw = d["clips"] ?? {};
    const clips: TileAnimClip[] = [];
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      for (const [name, entry] of Object.entries(
        raw as Record<string, unknown>,
      )) {
        const clip = parseClip(name, entry);
        if (clip === null) continue;
        clips.push(clip);
      }
    }
    return new TileAnimFile(typeof tileset === "string" ? tileset : "", clips);
  }

  static fromJson(text: string): TileAnimFile {
    return TileAnimFile.fromDict(JSON.parse(text) as unknown);
  }
}

function frameIndexAt(clip: TileAnimClip, timeMs: number, phase = 0): number {
  const n = clip.frames.length;
  const total = clip.totalDurationMs();
  if (n === 0 || total <= 0) return 0;
  const normPhase = ((phase % n) + n) % n;
  if (!clip.loop && timeMs >= total) return n - 1;
  const t = clip.loop ? timeMs % total : timeMs;
  let acc = 0.0;
  for (let i = 0; i < n; i += 1) {
    const idx = (normPhase + i) % n;
    const frame = clip.frames[idx];
    acc += frame?.durationMs ?? 0;
    if (t < acc) return idx;
  }
  return (normPhase + n - 1) % n;
}

export function clipFrameAt(
  clip: TileAnimClip,
  timeMs: number,
  phase = 0,
): TileClipFrame | null {
  if (clip.frames.length === 0) return null;
  return clip.frames[frameIndexAt(clip, timeMs, phase)] ?? null;
}

function posixNorm(p: string): string {
  let out = p.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  out = out.replace(/\/\.\//g, "/");
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

function posixName(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx < 0 ? p : p.slice(idx + 1);
}

function posixStem(p: string): string {
  const name = posixName(p);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? name : name.slice(0, dot);
}

export function resolveClipSheet(
  paths: readonly string[],
  sheetRef: string,
): number | null {
  const norm = (p: string): string => posixNorm(p);
  const ref = norm(sheetRef ?? "");
  if (ref === "") return null;
  for (let i = 0; i < paths.length; i += 1) {
    if (norm(paths[i] ?? "") === ref) return i;
  }
  const refName = posixName(ref);
  const nameHits: number[] = [];
  paths.forEach((p, i) => {
    if (posixName(norm(p ?? "")) === refName) nameHits.push(i);
  });
  if (nameHits.length === 1) return nameHits[0] ?? null;
  const refStem = posixStem(ref);
  const stemHits: number[] = [];
  paths.forEach((p, i) => {
    if (posixStem(norm(p ?? "")) === refStem) stemHits.push(i);
  });
  if (stemHits.length === 1) return stemHits[0] ?? null;
  return null;
}
