import { describe, expect, it } from "vitest";
import { PHASER_LAYER_VERSION } from "../../src/phaser/index.js";

describe("phaser scaffold", () => {
  it("exposes the layer version without requiring phaser at runtime", () => {
    expect(PHASER_LAYER_VERSION).toBe("0.1.0");
  });
});
