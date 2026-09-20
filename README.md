# tilemap-parser

TypeScript port of the `tilemap-parser` core, targeted at the web via
[Phaser](https://phaser.io/). Engine-agnostic parsing + runtime under
`tilemap-parser/core`, thin Phaser bindings under `tilemap-parser/phaser`.

> Fresh derivation from the unreleased `tilemap-parser` 6.0.0 line — not a
> port of legacy releases. Most of the Python API is mirrored where it makes
> sense on web/Phaser; engine-specific parts (pygame rendering) are replaced
> by Phaser helpers.

## Install

```sh
npm install tilemap-parser
```

Phaser is an optional peer (`>=3.60.0`). Install it only if you use the
`/phaser` entry:

```sh
npm install phaser
```

## Usage

```ts
import { parseMapDict } from "tilemap-parser/core";
import { buildTileLayers, queueMapAssets } from "tilemap-parser/phaser";

const map = parseMapDict(json);
queueMapAssets(scene, map, { mapUrl: "data/entry.json" });
buildTileLayers(scene, map);
```

- `tilemap-parser` / `tilemap-parser/core` — map, animation, collision,
  particle parsing plus the physics/navigation runtime (no engine deps).
- `tilemap-parser/phaser` — asset refs, tile/image/object layers, spawns,
  camera, animations, particles for Phaser scenes.

## Demo

`examples/swamp/` is a full playable Phaser demo (excluded from the npm
tarball). Run it from its own folder; see `examples/swamp/package.json`.

## Docs

`webdocs/` is reserved for a future standalone docs site (Vercel). It ships
no code and is excluded from the npm package.

## License

MIT — see [LICENSE](./LICENSE).
