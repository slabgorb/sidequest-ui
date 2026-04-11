import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type {
  TacticalGridData,
  TacticalThemeConfig,
  TacticalCell,
  GridPos,
} from "@/types/tactical";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const CAVERN_THEME: TacticalThemeConfig = {
  floor: "#8B7355",
  wall: "#3C3024",
  water: "#1A3A5C",
  difficultTerrain: "#A08050",
  door: "#6B5B3A",
  gridLine: "#5A4A3A",
  features: {
    cover: "#9E8B6E",
    hazard: "#8B2500",
    difficult_terrain: "#A08050",
    atmosphere: "#7A6A5A",
    interactable: "#C9A84C",
    door: "#6B5B3A",
  },
};

/** Minimal 3x3 grid: floor center, walls around, one feature. */
function makeSimple3x3Grid(): TacticalGridData {
  const wall: TacticalCell = { type: "wall" };
  const floor: TacticalCell = { type: "floor" };
  const feature: TacticalCell = { type: "feature", glyph: "A" };
  return {
    width: 3,
    height: 3,
    cells: [
      [wall, wall, wall],
      [wall, floor, feature],
      [wall, wall, wall],
    ],
    legend: {
      A: { feature_type: "cover", label: "Stalagmite" },
    },
    exits: [],
  };
}

/** 5x5 grid with all 8 cell types for visual distinction testing. */
function makeAllCellTypesGrid(): TacticalGridData {
  return {
    width: 5,
    height: 5,
    cells: [
      [
        { type: "wall" },
        { type: "wall" },
        { type: "door_closed" },
        { type: "wall" },
        { type: "wall" },
      ],
      [
        { type: "wall" },
        { type: "floor" },
        { type: "floor" },
        { type: "water" },
        { type: "wall" },
      ],
      [
        { type: "door_open" },
        { type: "floor" },
        { type: "feature", glyph: "A" },
        { type: "difficult_terrain" },
        { type: "wall" },
      ],
      [
        { type: "wall" },
        { type: "floor" },
        { type: "floor" },
        { type: "floor" },
        { type: "wall" },
      ],
      [
        { type: "wall" },
        { type: "wall" },
        { type: "void" },
        { type: "wall" },
        { type: "wall" },
      ],
    ],
    legend: {
      A: { feature_type: "hazard", label: "Spike Trap" },
    },
    exits: [
      { wall: "north", cells: [2], width: 1 },
      { wall: "west", cells: [2], width: 1 },
    ],
  };
}

// ── Lazy imports — component doesn't exist yet (RED phase) ────────────────────

// These imports will fail until Dev implements the component.
// That's the point: RED means red.
async function importRenderer() {
  const mod = await import("@/components/TacticalGridRenderer");
  return mod.TacticalGridRenderer;
}

// ── AC-1: SVG renders all 8 cell types with visually distinct styles ──────────

describe("TacticalGridRenderer — cell type rendering (AC-1)", () => {
  it("renders all 8 cell types as distinct SVG elements", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeAllCellTypesGrid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    // Each cell type should produce an element with a data-cell-type attribute
    const cellTypes = [
      "floor",
      "wall",
      "void",
      "door_closed",
      "door_open",
      "water",
      "difficult_terrain",
      "feature",
    ];
    for (const cellType of cellTypes) {
      const cells = container.querySelectorAll(`[data-cell-type="${cellType}"]`);
      expect(cells.length).toBeGreaterThan(
        0,
        `Expected at least one cell of type "${cellType}"`
      );
    }
  });

  it("applies different fill colors per cell type", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeAllCellTypesGrid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    // Floor and wall must have different fill colors from theme
    const floorCell = container.querySelector('[data-cell-type="floor"]');
    const wallCell = container.querySelector('[data-cell-type="wall"]');
    expect(floorCell).not.toBeNull();
    expect(wallCell).not.toBeNull();

    // The fills should come from theme, not be identical
    const floorFill = floorCell!.getAttribute("fill");
    const wallFill = wallCell!.getAttribute("fill");
    expect(floorFill).toBe(CAVERN_THEME.floor);
    expect(wallFill).toBe(CAVERN_THEME.wall);
    expect(floorFill).not.toBe(wallFill);
  });
});

// ── AC-2: Void cells render as transparent ────────────────────────────────────

describe("TacticalGridRenderer — void cells (AC-2)", () => {
  it("void cells have no visible fill or are transparent", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeAllCellTypesGrid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const voidCells = container.querySelectorAll('[data-cell-type="void"]');
    expect(voidCells.length).toBeGreaterThan(0);

    for (const cell of voidCells) {
      const fill = cell.getAttribute("fill");
      // Void cells should be transparent: "none", "transparent", or absent
      expect(
        fill === null || fill === "none" || fill === "transparent"
      ).toBe(true);
    }
  });

  it("void cells have no stroke or border", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeAllCellTypesGrid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const voidCells = container.querySelectorAll('[data-cell-type="void"]');
    for (const cell of voidCells) {
      const stroke = cell.getAttribute("stroke");
      expect(
        stroke === null || stroke === "none" || stroke === "transparent"
      ).toBe(true);
    }
  });
});

// ── AC-3: Feature cells show type-appropriate visual marker + tooltip ─────────

describe("TacticalGridRenderer — feature markers (AC-3)", () => {
  it("feature cells display a visual marker element", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    // Feature cell at (2,1) should have a marker
    const featureMarkers = container.querySelectorAll(
      '[data-cell-type="feature"]'
    );
    expect(featureMarkers.length).toBe(1);

    // The feature group should contain a marker element (text, path, or use)
    const featureGroup = featureMarkers[0].closest("g") ?? featureMarkers[0];
    const marker =
      featureGroup.querySelector("text") ??
      featureGroup.querySelector("path") ??
      featureGroup.querySelector("use");
    expect(marker).not.toBeNull();
  });

  it("feature cells show tooltip with label on hover", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    // SVG title element provides native tooltip behavior
    const featureCell = container.querySelector('[data-cell-type="feature"]');
    expect(featureCell).not.toBeNull();

    const titleEl =
      featureCell!.querySelector("title") ??
      featureCell!.closest("g")?.querySelector("title");
    expect(titleEl).not.toBeNull();
    expect(titleEl!.textContent).toContain("Stalagmite");
  });

  it("feature colors come from theme.features by type", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const featureCell = container.querySelector('[data-cell-type="feature"]');
    expect(featureCell).not.toBeNull();
    // Feature of type "cover" should use theme.features.cover color
    const fill = featureCell!.getAttribute("fill");
    expect(fill).toBe(CAVERN_THEME.features.cover);
  });
});

// ── AC-4: cellSize prop scales the entire grid proportionally ─────────────────

describe("TacticalGridRenderer — cellSize scaling (AC-4)", () => {
  it("default cellSize produces a viewBox matching grid dimensions", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const viewBox = svg!.getAttribute("viewBox");
    expect(viewBox).not.toBeNull();
    // Default cellSize=24, 3x3 grid → viewBox should encompass 72x72
    expect(viewBox).toContain("72");
  });

  it("custom cellSize scales viewBox proportionally", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} cellSize={48} />
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const viewBox = svg!.getAttribute("viewBox");
    expect(viewBox).not.toBeNull();
    // cellSize=48, 3x3 grid → viewBox should encompass 144x144
    expect(viewBox).toContain("144");
  });

  it("cell elements are positioned at cellSize intervals", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const cellSize = 32;
    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        cellSize={cellSize}
      />
    );

    // Cell at (1,1) should be at x=32, y=32
    const floorCell = container.querySelector(
      '[data-cell-type="floor"][data-x="1"][data-y="1"]'
    );
    expect(floorCell).not.toBeNull();
    const x = Number(floorCell!.getAttribute("x"));
    const y = Number(floorCell!.getAttribute("y"));
    expect(x).toBe(cellSize * 1);
    expect(y).toBe(cellSize * 1);
  });
});

// ── AC-5: onCellClick fires with correct GridPos ──────────────────────────────

describe("TacticalGridRenderer — cell click (AC-5)", () => {
  it("onCellClick fires with correct GridPos on floor cell click", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const handleClick = vi.fn<(pos: GridPos) => void>();
    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        onCellClick={handleClick}
      />
    );

    // Click the floor cell at (1,1)
    const floorCell = container.querySelector(
      '[data-cell-type="floor"][data-x="1"][data-y="1"]'
    );
    expect(floorCell).not.toBeNull();
    fireEvent.click(floorCell!);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith({ x: 1, y: 1 });
  });

  it("onCellClick fires with correct GridPos on feature cell click", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const handleClick = vi.fn<(pos: GridPos) => void>();
    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        onCellClick={handleClick}
      />
    );

    // Feature cell at (2,1)
    const featureCell = container.querySelector(
      '[data-cell-type="feature"][data-x="2"][data-y="1"]'
    );
    expect(featureCell).not.toBeNull();
    fireEvent.click(featureCell!);

    expect(handleClick).toHaveBeenCalledWith({ x: 2, y: 1 });
  });

  it("onCellClick fires on wall cells too (for inspection)", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const handleClick = vi.fn<(pos: GridPos) => void>();
    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        onCellClick={handleClick}
      />
    );

    const wallCell = container.querySelector('[data-cell-type="wall"]');
    expect(wallCell).not.toBeNull();
    fireEvent.click(wallCell!);

    expect(handleClick).toHaveBeenCalledTimes(1);
    // Should report the wall cell's position
    const pos = handleClick.mock.calls[0][0];
    expect(typeof pos.x).toBe("number");
    expect(typeof pos.y).toBe("number");
  });

  it("does not throw when onCellClick is not provided", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const floorCell = container.querySelector('[data-cell-type="floor"]');
    expect(floorCell).not.toBeNull();
    // Should not throw
    expect(() => fireEvent.click(floorCell!)).not.toThrow();
  });
});

// ── AC-6: Genre theme palette applies (not hardcoded colors) ──────────────────

describe("TacticalGridRenderer — theme application (AC-6)", () => {
  const NEON_THEME: TacticalThemeConfig = {
    floor: "#1A0A2E",
    wall: "#0D0D0D",
    water: "#00FFFF",
    difficultTerrain: "#FF00FF",
    door: "#00FF00",
    gridLine: "#333333",
    features: {
      cover: "#FFFF00",
      hazard: "#FF0000",
      difficult_terrain: "#FF00FF",
      atmosphere: "#8800FF",
      interactable: "#00FF00",
      door: "#00FF00",
    },
  };

  it("renders with neon theme colors, not cavern defaults", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeAllCellTypesGrid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={NEON_THEME} />
    );

    const floorCell = container.querySelector('[data-cell-type="floor"]');
    expect(floorCell!.getAttribute("fill")).toBe(NEON_THEME.floor);

    const wallCell = container.querySelector('[data-cell-type="wall"]');
    expect(wallCell!.getAttribute("fill")).toBe(NEON_THEME.wall);

    const waterCell = container.querySelector('[data-cell-type="water"]');
    expect(waterCell!.getAttribute("fill")).toBe(NEON_THEME.water);
  });

  it("different themes produce different fills for the same grid", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();

    const { container: c1 } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );
    const { container: c2 } = render(
      <TacticalGridRenderer grid={grid} theme={NEON_THEME} />
    );

    const floor1 = c1.querySelector('[data-cell-type="floor"]');
    const floor2 = c2.querySelector('[data-cell-type="floor"]');
    expect(floor1!.getAttribute("fill")).not.toBe(
      floor2!.getAttribute("fill")
    );
  });
});

// ── AC-7 & AC-8: Automapper delegation ────────────────────────────────────────

describe("Automapper — tactical grid delegation (AC-7, AC-8)", () => {
  it("renders TacticalGridRenderer when current room has grid data (AC-7)", async () => {
    const { Automapper } = await import("@/components/Automapper");
    const rooms = [
      {
        id: "r1",
        name: "Entrance Hall",
        room_type: "chamber",
        size: "medium",
        is_current: true,
        exits: [],
        grid: makeSimple3x3Grid(),
      },
    ];
    const { container } = render(
      <Automapper rooms={rooms} currentRoomId="r1" />
    );

    // Should find tactical grid SVG elements, not schematic rectangles
    const tacticalCells = container.querySelectorAll("[data-cell-type]");
    expect(tacticalCells.length).toBeGreaterThan(0);
  });

  it("renders schematic view when current room has no grid data (AC-8)", async () => {
    const { Automapper } = await import("@/components/Automapper");
    const rooms = [
      {
        id: "r1",
        name: "Entrance Hall",
        room_type: "chamber",
        size: "medium",
        is_current: true,
        exits: [],
      },
    ];
    const { container } = render(
      <Automapper rooms={rooms} currentRoomId="r1" />
    );

    // Schematic view uses data-room-id on rect elements
    const roomRects = container.querySelectorAll("[data-room-id]");
    expect(roomRects.length).toBeGreaterThan(0);

    // Should NOT have tactical cell elements
    const tacticalCells = container.querySelectorAll("[data-cell-type]");
    expect(tacticalCells.length).toBe(0);
  });

  it("switches between views as current room changes", async () => {
    const { Automapper } = await import("@/components/Automapper");
    const rooms = [
      {
        id: "r1",
        name: "Grid Room",
        room_type: "chamber",
        size: "medium",
        is_current: true,
        exits: [
          { direction: "south", exit_type: "corridor", to_room_id: "r2" },
        ],
        grid: makeSimple3x3Grid(),
      },
      {
        id: "r2",
        name: "Plain Room",
        room_type: "passage",
        size: "small",
        is_current: false,
        exits: [
          { direction: "north", exit_type: "corridor", to_room_id: "r1" },
        ],
      },
    ];

    // First render: current room has grid → tactical renderer
    const { container, rerender } = render(
      <Automapper rooms={rooms} currentRoomId="r1" />
    );
    expect(
      container.querySelectorAll("[data-cell-type]").length
    ).toBeGreaterThan(0);

    // Rerender with different current room (no grid) → schematic
    const updatedRooms = rooms.map((r) => ({
      ...r,
      is_current: r.id === "r2",
    }));
    rerender(<Automapper rooms={updatedRooms} currentRoomId="r2" />);
    expect(container.querySelectorAll("[data-cell-type]").length).toBe(0);
    expect(
      container.querySelectorAll("[data-room-id]").length
    ).toBeGreaterThan(0);
  });
});

// ── AC-9: Component vitest tests (meta — this file IS the test) ───────────────
// AC-9 is satisfied by the existence of this file with tests for rendering,
// cell click, and theme application. No separate test needed.

// ── AC-10: Wiring test — Automapper imports TacticalGridRenderer ──────────────

describe("Automapper — wiring test (AC-10)", () => {
  it("TacticalGridRenderer is importable from components", async () => {
    const mod = await import("@/components/TacticalGridRenderer");
    expect(mod.TacticalGridRenderer).toBeDefined();
    expect(typeof mod.TacticalGridRenderer).toBe("function");
  });

  it("Automapper module exists and exports Automapper", async () => {
    const mod = await import("@/components/Automapper");
    expect(mod.Automapper).toBeDefined();
    expect(typeof mod.Automapper).toBe("function");
  });
});

// ── TypeScript lang-review rule enforcement ───────────────────────────────────

describe("TacticalGridRenderer — TypeScript rule compliance", () => {
  // Rule #4: Null/undefined handling — onCellHover with null
  it("onCellHover fires with null when mouse leaves cell", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const handleHover = vi.fn<(pos: GridPos | null) => void>();
    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        onCellHover={handleHover}
      />
    );

    const floorCell = container.querySelector('[data-cell-type="floor"]');
    expect(floorCell).not.toBeNull();

    fireEvent.mouseEnter(floorCell!);
    expect(handleHover).toHaveBeenCalledWith({ x: 1, y: 1 });

    fireEvent.mouseLeave(floorCell!);
    expect(handleHover).toHaveBeenCalledWith(null);
  });

  // Rule #6: React/JSX — no key={index} on cell list
  it("rendered cells have stable keys based on position, not array index", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    // Every cell element should have both data-x and data-y for identification
    const allCells = container.querySelectorAll("[data-cell-type]");
    for (const cell of allCells) {
      expect(cell.getAttribute("data-x")).not.toBeNull();
      expect(cell.getAttribute("data-y")).not.toBeNull();
    }
  });

  // Rule #6: React/JSX — SVG preserveAspectRatio for responsive scaling
  it("SVG has proper viewBox and preserveAspectRatio", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeSimple3x3Grid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("viewBox")).not.toBeNull();
    expect(svg!.getAttribute("preserveAspectRatio")).not.toBeNull();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("TacticalGridRenderer — edge cases", () => {
  it("renders a 1x1 grid without crashing", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid: TacticalGridData = {
      width: 1,
      height: 1,
      cells: [[{ type: "floor" }]],
      legend: {},
      exits: [],
    };
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const cells = container.querySelectorAll("[data-cell-type]");
    expect(cells.length).toBe(1);
  });

  it("renders grid with all void cells (non-rectangular room shape)", async () => {
    const TacticalGridRenderer = await importRenderer();
    const v: TacticalCell = { type: "void" };
    const f: TacticalCell = { type: "floor" };
    const w: TacticalCell = { type: "wall" };
    // L-shaped room via void cells
    const grid: TacticalGridData = {
      width: 4,
      height: 4,
      cells: [
        [w, w, w, v],
        [w, f, w, v],
        [w, f, w, w],
        [w, w, f, w],
      ],
      legend: {},
      exits: [],
    };
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const voidCells = container.querySelectorAll('[data-cell-type="void"]');
    expect(voidCells.length).toBe(2);

    const floorCells = container.querySelectorAll('[data-cell-type="floor"]');
    expect(floorCells.length).toBe(3);
  });

  it("renders grid with multiple features from legend", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid: TacticalGridData = {
      width: 3,
      height: 1,
      cells: [
        [
          { type: "feature", glyph: "A" },
          { type: "feature", glyph: "B" },
          { type: "feature", glyph: "C" },
        ],
      ],
      legend: {
        A: { feature_type: "cover", label: "Pillar" },
        B: { feature_type: "hazard", label: "Pit Trap" },
        C: { feature_type: "interactable", label: "Lever" },
      },
      exits: [],
    };
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const features = container.querySelectorAll('[data-cell-type="feature"]');
    expect(features.length).toBe(3);

    // Each feature should have its legend label as tooltip
    const titles = container.querySelectorAll("title");
    const titleTexts = Array.from(titles).map((t) => t.textContent);
    expect(titleTexts).toContain("Pillar");
    expect(titleTexts).toContain("Pit Trap");
    expect(titleTexts).toContain("Lever");
  });

  it("SVG uses <defs>/<symbol>/<use> pattern for efficient DOM", async () => {
    const TacticalGridRenderer = await importRenderer();
    const grid = makeAllCellTypesGrid();
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />
    );

    const defs = container.querySelector("svg defs");
    expect(defs).not.toBeNull();

    // Should have symbol definitions for cell types
    const symbols = defs!.querySelectorAll("symbol");
    expect(symbols.length).toBeGreaterThan(0);
  });
});
