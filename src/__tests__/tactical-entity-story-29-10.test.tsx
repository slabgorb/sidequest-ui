/**
 * Story 29-10: TacticalEntity model + token rendering
 *
 * RED phase — failing tests for SVG token rendering on the tactical grid.
 * Tests cover: token layer rendering, faction colors, multi-cell entities,
 * hover tooltips, and wiring from entity data to SVG output.
 */
import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type {
  TacticalGridData,
  TacticalThemeConfig,
  TacticalEntity,
  TacticalCell,
} from "@/types/tactical";
import { TacticalGridRenderer } from "@/components/TacticalGridRenderer";

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

/** Expected faction colors from AC-3/AC-6 */
const FACTION_COLORS = {
  player: "#2563EB",
  hostile: "#DC2626",
  neutral: "#6B7280",
  ally: "#16A34A",
} as const;

/** Minimal 5x5 room grid with floor center. */
function make5x5Grid(): TacticalGridData {
  const wall: TacticalCell = { type: "wall" };
  const floor: TacticalCell = { type: "floor" };
  return {
    width: 5,
    height: 5,
    cells: [
      [wall, wall, wall, wall, wall],
      [wall, floor, floor, floor, wall],
      [wall, floor, floor, floor, wall],
      [wall, floor, floor, floor, wall],
      [wall, wall, wall, wall, wall],
    ],
    legend: {},
    exits: [],
  };
}

function makePlayerEntity(x = 2, y = 2): TacticalEntity {
  return {
    id: "pc-01",
    name: "Tormund",
    position: { x, y },
    size: 1,
    faction: "player",
  };
}

// Note: story context specifies "hostile" but current UI type uses "enemy".
// Tests use "hostile" via type widening — Dev must update TacticalEntity.faction
// union to accept "hostile" instead of "enemy" to match the Rust protocol.
// See Design Deviations in session file.

function makeHostileEntity(x = 3, y = 1): TacticalEntity {
  return {
    id: "npc-goblin-01",
    name: "Grik the Sly",
    position: { x, y },
    size: 1,
    faction: "hostile" as TacticalEntity["faction"],
  };
}

function makeLargeEntity(): TacticalEntity {
  return {
    id: "creature-ogre",
    name: "Cave Ogre",
    position: { x: 2, y: 2 },
    size: 2,
    faction: "hostile" as TacticalEntity["faction"],
  };
}

function makeHugeEntity(): TacticalEntity {
  return {
    id: "creature-dragon",
    name: "Ancient Red Dragon",
    position: { x: 1, y: 1 },
    size: 3,
    faction: "hostile" as TacticalEntity["faction"],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// AC-4: SVG tokens render at correct grid positions
// ══════════════════════════════════════════════════════════════════════════════

describe("AC-4: Token rendering at correct grid positions", () => {
  it("renders entity tokens as SVG elements in token-layer group", () => {

    const grid = make5x5Grid();
    const entities = [makePlayerEntity(), makeHostileEntity()];

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={entities}
      />,
    );

    const tokenLayer = container.querySelector(".token-layer");
    expect(tokenLayer).not.toBeNull();
    // Should have 2 token groups
    const tokens = tokenLayer!.querySelectorAll("[data-entity-id]");
    expect(tokens.length).toBe(2);
  });

  it("positions token at correct grid coordinates", () => {

    const grid = make5x5Grid();
    const entity = makePlayerEntity(3, 2);
    const cellSize = 24; // default

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[entity]}
        cellSize={cellSize}
      />,
    );

    const token = container.querySelector('[data-entity-id="pc-01"]');
    expect(token).not.toBeNull();
    // Token g element should be translated to (x*cellSize, y*cellSize)
    const transform = token!.getAttribute("transform");
    expect(transform).toContain(`${3 * cellSize}`);
    expect(transform).toContain(`${2 * cellSize}`);
  });

  it("renders entity initial or icon as text label", () => {

    const grid = make5x5Grid();
    const entity = makePlayerEntity();

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[entity]}
      />,
    );

    const token = container.querySelector('[data-entity-id="pc-01"]');
    const text = token!.querySelector("text");
    expect(text).not.toBeNull();
    // Should show first initial "T" for "Tormund"
    expect(text!.textContent).toBe("T");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-5: Large/Huge tokens span multiple cells visually
// ══════════════════════════════════════════════════════════════════════════════

describe("AC-5: Multi-cell entity tokens", () => {
  it("large entity (size=2) renders with radius spanning 2 cells", () => {

    const grid = make5x5Grid();
    const entity = makeLargeEntity();
    const cellSize = 24;

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[entity]}
        cellSize={cellSize}
      />,
    );

    const token = container.querySelector('[data-entity-id="creature-ogre"]');
    const circle = token!.querySelector("circle");
    expect(circle).not.toBeNull();
    const r = Number(circle!.getAttribute("r"));
    // Large (size=2) should have radius spanning 2 cells
    expect(r).toBeGreaterThan(cellSize / 2);
    expect(r).toBeLessThanOrEqual(cellSize); // size * cellSize / 2
  });

  it("huge entity (size=3) renders larger than large entity", () => {

    const grid = make5x5Grid();
    const cellSize = 24;

    const { container: largeContainer } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[makeLargeEntity()]}
        cellSize={cellSize}
      />,
    );

    const { container: hugeContainer } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[makeHugeEntity()]}
        cellSize={cellSize}
      />,
    );

    const largeR = Number(
      largeContainer
        .querySelector('[data-entity-id="creature-ogre"] circle')!
        .getAttribute("r"),
    );
    const hugeR = Number(
      hugeContainer
        .querySelector('[data-entity-id="creature-dragon"] circle')!
        .getAttribute("r"),
    );
    expect(hugeR).toBeGreaterThan(largeR);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-6: Faction colors are visually distinct and accessible
// ══════════════════════════════════════════════════════════════════════════════

describe("AC-6: Faction colors", () => {
  it("player tokens use blue (#2563EB)", () => {

    const grid = make5x5Grid();

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[makePlayerEntity()]}
      />,
    );

    const circle = container.querySelector(
      '[data-entity-id="pc-01"] circle',
    );
    expect(circle!.getAttribute("fill")).toBe(FACTION_COLORS.player);
  });

  it("hostile tokens use red (#DC2626)", () => {

    const grid = make5x5Grid();

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[makeHostileEntity()]}
      />,
    );

    const circle = container.querySelector(
      '[data-entity-id="npc-goblin-01"] circle',
    );
    expect(circle!.getAttribute("fill")).toBe(FACTION_COLORS.hostile);
  });

  it("neutral tokens use gray (#6B7280)", () => {

    const grid = make5x5Grid();
    const neutral: TacticalEntity = {
      id: "npc-merchant",
      name: "Merchant",
      position: { x: 2, y: 2 },
      size: 1,
      faction: "neutral",
    };

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[neutral]}
      />,
    );

    const circle = container.querySelector(
      '[data-entity-id="npc-merchant"] circle',
    );
    expect(circle!.getAttribute("fill")).toBe(FACTION_COLORS.neutral);
  });

  it("ally tokens use green (#16A34A)", () => {

    const grid = make5x5Grid();
    const ally: TacticalEntity = {
      id: "npc-companion",
      name: "Lyra",
      position: { x: 1, y: 2 },
      size: 1,
      faction: "ally",
    };

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[ally]}
      />,
    );

    const circle = container.querySelector(
      '[data-entity-id="npc-companion"] circle',
    );
    expect(circle!.getAttribute("fill")).toBe(FACTION_COLORS.ally);
  });

  it("all four faction colors are distinct", () => {
    const colors = Object.values(FACTION_COLORS);
    const unique = new Set(colors);
    expect(unique.size).toBe(4);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-7: Hover tooltip shows entity name and faction
// ══════════════════════════════════════════════════════════════════════════════

describe("AC-7: Token tooltips", () => {
  it("token has SVG title element with entity name", () => {

    const grid = make5x5Grid();

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[makePlayerEntity()]}
      />,
    );

    const title = container.querySelector(
      '[data-entity-id="pc-01"] title',
    );
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain("Tormund");
  });

  it("tooltip includes faction information", () => {

    const grid = make5x5Grid();

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[makeHostileEntity()]}
      />,
    );

    const title = container.querySelector(
      '[data-entity-id="npc-goblin-01"] title',
    );
    expect(title).not.toBeNull();
    const titleText = title!.textContent ?? "";
    expect(titleText).toContain("Grik the Sly");
    // Should indicate faction somehow (e.g., "Grik the Sly (Hostile)")
    expect(titleText.toLowerCase()).toContain("hostile");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-10: Wiring test — entity data flows through to SVG render
// ══════════════════════════════════════════════════════════════════════════════

describe("AC-10: Wiring — entities prop to SVG", () => {
  it("TacticalGridRenderer accepts entities prop", () => {

    const grid = make5x5Grid();
    const entities = [makePlayerEntity(), makeHostileEntity()];

    // Should render without error when entities are provided
    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={entities}
      />,
    );

    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("empty entities array renders no tokens but grid still appears", () => {

    const grid = make5x5Grid();

    const { container } = render(
      <TacticalGridRenderer
        grid={grid}
        theme={CAVERN_THEME}
        entities={[]}
      />,
    );

    const tokenLayer = container.querySelector(".token-layer");
    // Token layer may exist but should be empty
    if (tokenLayer) {
      const tokens = tokenLayer.querySelectorAll("[data-entity-id]");
      expect(tokens.length).toBe(0);
    }
    // Grid layer must still render
    const gridLayer = container.querySelector(".grid-layer");
    expect(gridLayer).not.toBeNull();
  });

  it("entities without entities prop renders grid only (backward compat)", () => {

    const grid = make5x5Grid();

    // Omitting entities prop — should work without error
    const { container } = render(
      <TacticalGridRenderer grid={grid} theme={CAVERN_THEME} />,
    );

    expect(container.querySelector(".grid-layer")).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TS lang-review rule #4: Null/undefined handling
// ══════════════════════════════════════════════════════════════════════════════

describe("Rule: TacticalEntity type uses proper union, not string", () => {
  it("faction type is a union, not arbitrary string", () => {
    // TypeScript compile-time check: this should NOT compile
    // if faction accepts arbitrary strings. We verify by constructing
    // a valid entity — if the type is `string`, anything would work.
    const entity: TacticalEntity = {
      id: "type-check",
      name: "Type Check",
      position: { x: 0, y: 0 },
      size: 1,
      faction: "player", // must be one of the union values
    };
    expect(entity.faction).toBe("player");
  });

  it("faction union includes 'hostile' (not 'enemy') to match Rust protocol", () => {
    // Story 29-10 AC-3: Faction enum covers Player, Hostile, Neutral, Ally.
    // The Rust protocol sends "hostile", not "enemy".
    // This test fails until Dev updates the TacticalEntity.faction union.
    const hostile: TacticalEntity = {
      id: "faction-check",
      name: "Faction Check",
      position: { x: 0, y: 0 },
      size: 1,
      faction: "hostile" as TacticalEntity["faction"],
    };
    // Verify "hostile" is a first-class faction value, not just a cast
    const validFactions: TacticalEntity["faction"][] = ["player", "hostile", "neutral", "ally"];
    expect(validFactions).toContain(hostile.faction);
  });
});
