export interface TextLoader {
  read(pathOrUrl: string): Promise<string>;
}

export interface ImageLoader {
  load(url: string): Promise<CanvasImageSource>;
}

export interface Clock {
  nowMs(): number;
}

export type Rng = () => number;

export const mathRandom: Rng = () => Math.random();

export const systemClock: Clock = {
  nowMs: () => Date.now(),
};

export const performanceClock: Clock = {
  nowMs: () =>
    typeof performance === "undefined" ? Date.now() : performance.now(),
};

export interface ResolveResourceOptions {
  readonly mapUrl?: string;
  readonly extraBaseUrls?: readonly string[] | undefined;
}

export function resolveResourceUrl(
  ref: string,
  options: ResolveResourceOptions = {},
): string {
  const trimmed = ref.trim();
  if (trimmed === "") return trimmed;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }
  const bases: string[] = [];
  if (options.mapUrl !== undefined && options.mapUrl !== "") {
    bases.push(options.mapUrl);
  }
  for (const extra of options.extraBaseUrls ?? []) {
    if (extra !== "") bases.push(extra);
  }
  for (const base of bases) {
    try {
      return new URL(trimmed, base).toString();
    } catch {
      const dir = base.includes("/")
        ? base.slice(0, base.lastIndexOf("/") + 1)
        : "";
      return normalizePath(`${dir}${trimmed}`);
    }
  }
  return trimmed;
}

function normalizePath(path: string): string {
  const absolute = path.startsWith("/");
  const out: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return (absolute ? "/" : "") + out.join("/");
}
