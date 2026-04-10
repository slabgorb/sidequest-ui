/**
 * Wire-format → renderer-shape adapter for tactical grids.
 *
 * The wire payload (sidequest-protocol::TacticalGridPayload) serializes cells
 * as `string[][]` and moves feature glyph identity into an out-of-band
 * `features[]` list keyed by [x, y] positions. The renderer
 * (TacticalGridRenderer) needs `TacticalCell[][]` with feature glyphs inline
 * and a `legend: Record<glyph, FeatureDef>` lookup.
 *
 * Without this adapter, MapWidget passed the wire shape straight through and
 * the renderer iterated strings as if they were typed objects. Every
 * `cell.type` was undefined, every fill was undefined, and the panel rendered
 * as solid black with zero visible cells. See the 2026-04-10 playtest
 * regression for the bug history.
 */

import type {
  TacticalGridData,
  TacticalCell,
  TacticalCellType,
  FeatureDef,
  FeatureType,
} from "@/types/tactical";

/**
 * The shape produced by serializing the Rust `TacticalGridPayload` struct
 * (sidequest-protocol/src/message.rs::TacticalGridPayload). Mirrors the
 * `cell_to_string` mapping in sidequest-game::room_movement.
 */
export interface TacticalGridWire {
  width: number;
  height: number;
  /** Cell type slugs ("floor", "wall", "feature", ...). */
  cells: string[][];
  /** Features sidecar — the wire format strips per-cell glyphs into here. */
  features: TacticalFeatureWire[];
}

export interface TacticalFeatureWire {
  glyph: string;
  feature_type: string;
  label: string;
  /** [x, y] positions where this feature appears in the grid. */
  positions: number[][];
}

/**
 * Translate a wire-format tactical grid payload into the renderer's
 * `TacticalGridData` shape. Inverts the features sidecar back into per-cell
 * glyphs and builds the legend lookup the renderer needs.
 *
 * Note: the wire format does not carry exit-gap data — exits live in the
 * room-graph layer above the grid (RoomExitInfo on ExploredLocation), so we
 * return `exits: []` here.
 */
export function tacticalGridFromWire(wire: TacticalGridWire): TacticalGridData {
  // Index features by position so each feature cell can resolve its glyph
  // in O(1) without re-scanning features[] for every cell.
  const glyphAt = new Map<string, string>();
  for (const feature of wire.features) {
    for (const [x, y] of feature.positions) {
      glyphAt.set(`${x},${y}`, feature.glyph);
    }
  }

  // Build the legend the renderer's cellFill() reads to resolve feature_type
  // → fill color.
  const legend: Record<string, FeatureDef> = {};
  for (const feature of wire.features) {
    legend[feature.glyph] = {
      feature_type: feature.feature_type as FeatureType,
      label: feature.label,
    };
  }

  // Convert string cells → typed cells. Feature cells get their glyph
  // re-attached from the position index.
  const cells: TacticalCell[][] = wire.cells.map((row, y) =>
    row.map((cellStr, x) => {
      const type = cellStr as TacticalCellType;
      if (type === "feature") {
        const glyph = glyphAt.get(`${x},${y}`);
        return { type, glyph };
      }
      return { type };
    }),
  );

  return {
    width: wire.width,
    height: wire.height,
    cells,
    legend,
    exits: [],
  };
}
