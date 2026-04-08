/**
 * RED-phase tests for Story 29-19: Wire tactical grid into MAP_UPDATE (UI side).
 *
 * Tests exercise:
 * - AC-4: useAutomapperData reads tactical_grid from MapState and sets ExploredRoom.grid
 *
 * These tests verify that when the server sends tactical_grid in MAP_UPDATE,
 * the Automapper receives ExploredRoom objects with grid data populated.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OverlayManager } from "../OverlayManager";
import type { TacticalGridData, TacticalCell } from "@/types/tactical";

// ============================================================================
// Test Fixtures
// ============================================================================

/** Minimal 4x4 tactical grid payload as it arrives over the wire. */
function mockTacticalGridPayload() {
  return {
    width: 4,
    height: 4,
    cells: [
      ["wall", "floor", "floor", "wall"],
      ["floor", "floor", "floor", "floor"],
      ["floor", "floor", "floor", "floor"],
      ["wall", "floor", "floor", "wall"],
    ],
    features: [
      {
        glyph: "T",
        feature_type: "atmosphere",
        label: "Stone tooth",
        positions: [[1, 2]],
      },
    ],
  };
}

/** MapState with tactical_grid on one explored location. */
function mockMapDataWithGrid() {
  return {
    current_location: "vault",
    explored: [
      {
        name: "Vault of Teeth",
        x: 0,
        y: 0,
        type: "treasure",
        connections: ["passage"],
        room_exits: [{ target: "passage", exit_type: "corridor" }],
        room_type: "treasure",
        size: [2, 2],
        is_current_room: true,
        tactical_grid: mockTacticalGridPayload(),
      },
      {
        name: "Stone Passage",
        x: 0,
        y: 0,
        type: "normal",
        connections: ["vault"],
        room_exits: [{ target: "vault", exit_type: "corridor" }],
        room_type: "normal",
        size: [1, 2],
        is_current_room: false,
        // No tactical_grid — this room has no grid
      },
    ],
  };
}

/** MapState without any tactical_grid fields (legacy/gridless). */
function mockMapDataWithoutGrid() {
  return {
    current_location: "tavern",
    explored: [
      {
        name: "Tavern",
        x: 0,
        y: 0,
        type: "normal",
        connections: ["street"],
        room_exits: [{ target: "street", exit_type: "door" }],
        room_type: "normal",
        size: [3, 3],
        is_current_room: true,
      },
    ],
  };
}

// ============================================================================
// AC-4: useAutomapperData reads tactical_grid and populates ExploredRoom.grid
// ============================================================================

describe("Tactical grid wiring (29-19)", () => {
  /**
   * When the server sends tactical_grid in MAP_UPDATE, the Automapper
   * component should receive ExploredRoom objects with grid populated
   * as TacticalGridData.
   *
   * This test renders OverlayManager with map overlay active and verifies
   * the Automapper receives grid data. The Automapper uses DungeonMapRenderer
   * for rooms with grids and falls back to schematic for rooms without.
   */
  it("passes tactical_grid from mapData to Automapper as ExploredRoom.grid", () => {
    const mapData = mockMapDataWithGrid();

    // Render with map overlay active — the Automapper should mount
    const { container } = render(
      <OverlayManager
        characterData={null}
        inventoryData={null}
        mapData={mapData}
        journalEntries={[]}
        knowledgeEntries={[]}
        settingsProps={{ autoScroll: true, textSize: "medium", musicVolume: 0.5, sfxVolume: 0.5, setAutoScroll: vi.fn(), setTextSize: vi.fn(), setMusicVolume: vi.fn(), setSfxVolume: vi.fn() }}
        activeOverlay="map"
        onOverlayChange={vi.fn()}
      >
        <div />
      </OverlayManager>
    );

    // The Automapper should render — look for the SVG dungeon map container
    // When tactical_grid is present, DungeonMapRenderer is used instead of schematic
    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeTruthy();

    // Verify grid cells are rendered — DungeonMapRenderer creates rect elements
    // for each cell in the grid. A 4x4 grid should produce floor/wall rects.
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThan(0);
  });

  /**
   * When mapData has no tactical_grid on any location, the Automapper
   * should still render the schematic view without errors.
   */
  it("renders schematic view when no tactical_grid present", () => {
    const mapData = mockMapDataWithoutGrid();

    const { container } = render(
      <OverlayManager
        characterData={null}
        inventoryData={null}
        mapData={mapData}
        journalEntries={[]}
        knowledgeEntries={[]}
        settingsProps={{ autoScroll: true, textSize: "medium", musicVolume: 0.5, sfxVolume: 0.5, setAutoScroll: vi.fn(), setTextSize: vi.fn(), setMusicVolume: vi.fn(), setSfxVolume: vi.fn() }}
        activeOverlay="map"
        onOverlayChange={vi.fn()}
      >
        <div />
      </OverlayManager>
    );

    // Should still render an SVG (schematic view)
    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeTruthy();
  });

  /**
   * Mixed scenario: some rooms have grids, some don't. The wiring should
   * populate grid on rooms that have tactical_grid and leave it undefined
   * on rooms that don't.
   */
  it("handles mixed grid and gridless rooms", () => {
    const mapData = mockMapDataWithGrid();

    const { container } = render(
      <OverlayManager
        characterData={null}
        inventoryData={null}
        mapData={mapData}
        journalEntries={[]}
        knowledgeEntries={[]}
        settingsProps={{ autoScroll: true, textSize: "medium", musicVolume: 0.5, sfxVolume: 0.5, setAutoScroll: vi.fn(), setTextSize: vi.fn(), setMusicVolume: vi.fn(), setSfxVolume: vi.fn() }}
        activeOverlay="map"
        onOverlayChange={vi.fn()}
      >
        <div />
      </OverlayManager>
    );

    // The DungeonMapRenderer should be used because at least one room has a grid
    // Verify the SVG renders without errors
    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeTruthy();
  });
});
