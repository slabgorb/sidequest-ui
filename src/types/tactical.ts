// TypeScript equivalents of Rust tactical grid types (ADR-071).
// Mirrors: sidequest-api/crates/sidequest-game/src/tactical/grid.rs

/**
 * A single cell in a tactical grid.
 * Matches the Rust TacticalCell enum variants.
 */
export type TacticalCellType =
  | "floor"
  | "wall"
  | "void"
  | "door_closed"
  | "door_open"
  | "water"
  | "difficult_terrain"
  | "feature";

/**
 * A cell in the grid with its type and optional feature glyph.
 * Feature cells carry the uppercase letter glyph (A-Z) for legend lookup.
 */
export interface TacticalCell {
  readonly type: TacticalCellType;
  /** Uppercase letter glyph for feature cells, undefined otherwise. */
  readonly glyph?: string;
}

/** Grid coordinate (x=column, y=row). */
export interface GridPos {
  readonly x: number;
  readonly y: number;
}

/** The type of a feature placed in the grid via legend. */
export type FeatureType =
  | "cover"
  | "hazard"
  | "difficult_terrain"
  | "atmosphere"
  | "interactable"
  | "door";

/** A resolved feature definition from the legend. */
export interface FeatureDef {
  readonly feature_type: FeatureType;
  readonly label: string;
}

/** Cardinal direction for exit gap identification. */
export type CardinalDirection = "north" | "east" | "south" | "west";

/** A gap in the wall perimeter where an exit connects to another room. */
export interface ExitGap {
  readonly wall: CardinalDirection;
  readonly cells: readonly number[];
  readonly width: number;
}

/**
 * A parsed tactical grid — the data contract from the server.
 * Until TACTICAL_STATE protocol message (29-5), this is constructed
 * from parsed room data.
 */
export interface TacticalGridData {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly (readonly TacticalCell[])[];
  readonly legend: Record<string, FeatureDef>;
  readonly exits: readonly ExitGap[];
}

/**
 * An entity positioned on the tactical grid (player, NPC, creature).
 * Mirrors: sidequest-api/crates/sidequest-game/src/tactical/entity.rs
 */
export interface TacticalEntity {
  readonly id: string;
  readonly name: string;
  readonly position: GridPos;
  readonly size: number;
  readonly faction: "player" | "ally" | "hostile" | "neutral";
}

/**
 * A room placed in global dungeon coordinates by the layout engine.
 * Mirrors: sidequest-api/crates/sidequest-game/src/tactical/layout.rs PlacedRoom
 */
export interface PlacedRoomData {
  readonly roomId: string;
  readonly roomName: string;
  readonly grid: TacticalGridData;
  readonly globalOffsetX: number;
  readonly globalOffsetY: number;
}

/**
 * Complete dungeon layout — all rooms positioned in a global coordinate system.
 * Mirrors: sidequest-api/crates/sidequest-game/src/tactical/layout.rs DungeonLayout
 */
export interface DungeonLayoutData {
  readonly rooms: readonly PlacedRoomData[];
  readonly globalWidth: number;
  readonly globalHeight: number;
}

/**
 * Genre-themed palette for tactical grid rendering.
 * Maps cell types to visual styles. Derived from theme.yaml colors section.
 */
export interface TacticalThemeConfig {
  /** Color for walkable floor cells. */
  readonly floor: string;
  /** Color for impassable wall cells. */
  readonly wall: string;
  /** Color for water cells. */
  readonly water: string;
  /** Color for difficult terrain cells. */
  readonly difficultTerrain: string;
  /** Color for door cells. */
  readonly door: string;
  /** Color for grid lines on floor cells. */
  readonly gridLine: string;
  /** Feature type -> color mapping. */
  readonly features: Readonly<Record<FeatureType, string>>;
}
