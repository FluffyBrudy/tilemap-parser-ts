import Phaser from "phaser";
import {
  parseAnimationDict,
  parseMapDict,
  resolveResourceUrl,
} from "tilemap-parser/core";
import {
  animSheetKey,
  buildAnimations,
  queueMapAssets,
} from "tilemap-parser/phaser";
import { STATE_ANIM_KEYS } from "./assets.js";
import { World } from "./world.js";

const MAP_URL = "data/entry.json";

class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.json("entry", MAP_URL);
    for (const key of STATE_ANIM_KEYS) {
      this.load.json(`animdoc:${key}`, `data/animations/${key}.anim.json`);
    }
  }

  create(): void {
    const map = parseMapDict(this.cache.json.get("entry") as unknown);
    queueMapAssets(this, map, { mapUrl: MAP_URL });

    for (const key of STATE_ANIM_KEYS) {
      const lib = parseAnimationDict(
        this.cache.json.get(`animdoc:${key}`) as unknown,
      );
      const ref = lib.spritesheetPath ?? "";
      if (ref === "") continue;
      const [fw, fh] = lib.tileSize;
      const url = resolveResourceUrl(ref, {
        mapUrl: `data/animations/${key}.anim.json`,
      });
      this.load.spritesheet(animSheetKey(key), encodeURI(url), {
        frameWidth: fw,
        frameHeight: fh,
      });
    }
    this.load.image(
      "bullet",
      encodeURI("assets/Gothicvania Swamp files/Sprites/Fire/fire/fire2.png"),
    );

    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      for (const key of STATE_ANIM_KEYS) {
        const lib = parseAnimationDict(
          this.cache.json.get(`animdoc:${key}`) as unknown,
        );
        buildAnimations(this.anims, lib, animSheetKey(key), `${key}:`);
      }
      this.scene.start("game", { map });
    });
    this.load.start();
  }
}

class GameScene extends Phaser.Scene {
  private world?: World;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super("game");
  }

  create(data: { map: unknown }): void {
    const map = data.map;
    if (typeof map !== "object" || map === null) {
      throw new Error("game scene needs a parsed map");
    }
    this.world = new World(this);
    this.cursors = this.input.keyboard?.createCursorKeys();
    void this.world
      .loadLevel(map as import("tilemap-parser/core").ParsedMap)
      .catch((err: unknown) => {
        console.error("failed to load level", err);
        this.add.text(16, 16, "Failed to load level", { color: "#ff5555" });
      });
  }

  update(_time: number, delta: number): void {
    if (this.world === undefined || this.cursors === undefined) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.world.update(dt, {
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up: this.cursors.up.isDown,
      down: this.cursors.down.isDown,
      space: this.cursors.space.isDown,
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1280,
  height: 720,
  backgroundColor: "#1e1e1e",
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, GameScene],
});
