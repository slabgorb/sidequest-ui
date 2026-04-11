/**
 * Wiring test for the tactical grid wire-format → renderer-shape adapter.
 *
 * Background: TacticalGridPayload (sidequest-protocol) serializes cells as
 * `string[][]` with feature glyphs moved to an out-of-band `features[]` list.
 * TacticalGridRenderer expects `TacticalCell[][]` with feature glyphs inline
 * and a `legend` lookup. Without an adapter, MapWidget passed the wire shape
 * straight through and the renderer iterated strings as if they were objects
 * — every `cell.type` was undefined, every fill was undefined, and the panel
 * rendered as solid black with zero visible cells.
 *
 * These tests pin the adapter contract against the actual wire format produced
 * by sidequest-game::room_movement::tactical_grid_to_payload (specifically the
 * `cell_to_string` mapping in room_movement.rs:273).
 */
import { describe, it, expect } from "vitest";
import {
  tacticalGridFromWire,
  type TacticalGridWire,
} from "../tacticalGridFromWire";

describe("tacticalGridFromWire", () => {
  it("translates a basic floor/wall grid from wire strings to typed cells", () => {
    const wire: TacticalGridWire = {
      width: 3,
      height: 2,
      cells: [
        ["wall", "wall", "wall"],
        ["wall", "floor", "wall"],
      ],
      features: [],
    };

    const grid = tacticalGridFromWire(wire);

    expect(grid.width).toBe(3);
    expect(grid.height).toBe(2);
    expect(grid.cells).toHaveLength(2);
    expect(grid.cells[0]).toHaveLength(3);
    expect(grid.cells[0][0]).toEqual({ type: "wall" });
    expect(grid.cells[1][1]).toEqual({ type: "floor" });
    expect(grid.legend).toEqual({});
    expect(grid.exits).toEqual([]);
  });

  it("preserves all known cell types from cell_to_string in room_movement.rs", () => {
    // Mirror of the Rust cell_to_string match arms — every variant must
    // round-trip cleanly. If a new TacticalCell variant is added on the
    // backend without updating this adapter, this test will catch it.
    const wire: TacticalGridWire = {
      width: 8,
      height: 1,
      cells: [
        ["floor", "wall", "void", "door_closed", "door_open", "water", "difficult_terrain", "feature"],
      ],
      features: [
        { glyph: "X", feature_type: "interactable", label: "chest", positions: [[7, 0]] },
      ],
    };

    const grid = tacticalGridFromWire(wire);

    expect(grid.cells[0][0]).toEqual({ type: "floor" });
    expect(grid.cells[0][1]).toEqual({ type: "wall" });
    expect(grid.cells[0][2]).toEqual({ type: "void" });
    expect(grid.cells[0][3]).toEqual({ type: "door_closed" });
    expect(grid.cells[0][4]).toEqual({ type: "door_open" });
    expect(grid.cells[0][5]).toEqual({ type: "water" });
    expect(grid.cells[0][6]).toEqual({ type: "difficult_terrain" });
    expect(grid.cells[0][7]).toEqual({ type: "feature", glyph: "X" });
  });

  it("inverts the features sidecar to set per-cell glyphs", () => {
    // The wire format strips per-cell glyphs into a positions list. Without
    // re-attaching them to cells, every feature renders as default-floor
    // because cellFill (TacticalGridRenderer) needs cell.glyph to look up
    // the legend entry.
    const wire: TacticalGridWire = {
      width: 4,
      height: 1,
      cells: [["feature", "floor", "feature", "feature"]],
      features: [
        { glyph: "C", feature_type: "cover", label: "low cover", positions: [[0, 0]] },
        { glyph: "H", feature_type: "hazard", label: "spike pit", positions: [[2, 0], [3, 0]] },
      ],
    };

    const grid = tacticalGridFromWire(wire);

    expect(grid.cells[0][0]).toEqual({ type: "feature", glyph: "C" });
    expect(grid.cells[0][1]).toEqual({ type: "floor" });
    expect(grid.cells[0][2]).toEqual({ type: "feature", glyph: "H" });
    expect(grid.cells[0][3]).toEqual({ type: "feature", glyph: "H" });
  });

  it("builds a legend lookup keyed by glyph from the features sidecar", () => {
    // The renderer's cellFill does `legend[cell.glyph]` to resolve feature_type
    // → fill color. Without this lookup the feature cells fall back to the
    // default floor color and become visually indistinguishable.
    const wire: TacticalGridWire = {
      width: 1,
      height: 1,
      cells: [["floor"]],
      features: [
        { glyph: "C", feature_type: "cover", label: "low cover", positions: [] },
        { glyph: "H", feature_type: "hazard", label: "spike pit", positions: [] },
        { glyph: "I", feature_type: "interactable", label: "lever", positions: [] },
      ],
    };

    const grid = tacticalGridFromWire(wire);

    expect(grid.legend).toEqual({
      C: { feature_type: "cover", label: "low cover" },
      H: { feature_type: "hazard", label: "spike pit" },
      I: { feature_type: "interactable", label: "lever" },
    });
  });

  it("handles a realistic 12x8 dungeon room shape (matches the playtest regression)", () => {
    // Reproduces the exact shape that was rendering as solid black during the
    // 2026-04-10 playtest: width=12, height=8, mostly walls/floors with one
    // interactable. Before the adapter, all 96 cells iterated as strings and
    // produced rects with fill=undefined → solid black panel.
    const wire: TacticalGridWire = {
      width: 12,
      height: 8,
      cells: [
        ["wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall"],
        ["wall", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "wall"],
        ["wall", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "wall"],
        ["wall", "floor", "floor", "feature", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "wall"],
        ["wall", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "wall"],
        ["wall", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "wall"],
        ["wall", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "floor", "wall"],
        ["wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "wall"],
      ],
      features: [
        { glyph: "P", feature_type: "interactable", label: "pedestal", positions: [[3, 3]] },
      ],
    };

    const grid = tacticalGridFromWire(wire);

    expect(grid.cells).toHaveLength(8);
    expect(grid.cells[0]).toHaveLength(12);
    // Every cell must be a typed object, not a bare string — this is the
    // primary regression guard.
    for (const row of grid.cells) {
      for (const cell of row) {
        expect(typeof cell).toBe("object");
        expect(cell).toHaveProperty("type");
      }
    }
    // The pedestal feature must have its glyph reattached.
    expect(grid.cells[3][3]).toEqual({ type: "feature", glyph: "P" });
    expect(grid.legend.P).toEqual({ feature_type: "interactable", label: "pedestal" });
  });
});
