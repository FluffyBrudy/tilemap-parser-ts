import { describe, expect, it } from "vitest";
import { MapParseError, parseNodesDict, parseNodesJson } from "../../src/core/index.js";

describe("parseNodesDict", () => {
  it("parses nodes with defaults", () => {
    const nodes = parseNodesDict({
      version: 2,
      groups: [],
      nodes: [
        {
          node_id: "n1",
          name: "spawn",
          area: { x: 81, y: 247, w: 16, h: 16 },
          properties: { kind: "player_spwan" },
        },
        {
          node_id: "n2",
          name: "ghost den",
          node_type: "spawner",
          area: { x: 0, y: 0, w: 32, h: 32 },
          layer_name: "datalayer",
          properties: {},
          group: "g1",
        },
      ],
    });
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({
      nodeId: "n1",
      name: "spawn",
      nodeType: "area", // default
      layerName: "", // default
      group: null,
    });
    expect(nodes[0]?.area).toEqual({ x: 81, y: 247, w: 16, h: 16 });
    expect(nodes[1]).toMatchObject({
      nodeType: "spawner",
      layerName: "datalayer",
      group: "g1",
    });
  });

  it("parses the (empty) production nodes file", () => {
    expect(parseNodesDict({ version: 2, groups: [], nodes: [] })).toEqual([]);
  });

  it("rejects malformed nodes", () => {
    expect(() => parseNodesDict({ nodes: [{ name: "no-id" }] })).toThrow(MapParseError);
    expect(() => parseNodesDict({ nodes: "nope" })).toThrow(MapParseError);
  });

  it("parseNodesJson rejects invalid JSON", () => {
    expect(() => parseNodesJson("{nope")).toThrow(MapParseError);
  });
});
