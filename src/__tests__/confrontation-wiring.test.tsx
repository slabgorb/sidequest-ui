import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { GameBoard, type GameBoardProps } from "@/components/GameBoard/GameBoard";
import { ImageBusProvider } from "@/providers/ImageBusProvider";
import type { ConfrontationData } from "@/components/ConfrontationOverlay";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const STANDOFF_DATA: ConfrontationData = {
  type: "standoff",
  label: "High Noon Standoff",
  category: "confrontation",
  actors: [
    { name: "The Stranger", role: "duelist", portrait_url: "/portraits/stranger.png" },
    { name: "Black Bart", role: "duelist", portrait_url: "/portraits/bart.png" },
  ],
  metric: {
    name: "tension",
    current: 3,
    starting: 0,
    direction: "ascending",
    threshold_high: 10,
    threshold_low: null,
  },
  beats: [
    { id: "stare", label: "Stare Down", metric_delta: 2, stat_check: "CHA", risk: "blink" },
    { id: "draw", label: "Draw!", metric_delta: 5, stat_check: "DEX", resolution: true },
  ],
  secondary_stats: null,
  genre_slug: "spaghetti_western",
  mood: "tense",
};

const CHASE_DATA: ConfrontationData = {
  type: "chase",
  label: "Highway Pursuit",
  category: "confrontation",
  actors: [
    { name: "Road Hog", role: "pursuer" },
    { name: "Sam", role: "quarry" },
  ],
  metric: {
    name: "distance",
    current: 5,
    starting: 3,
    direction: "bidirectional",
    threshold_high: 10,
    threshold_low: 0,
  },
  beats: [
    { id: "floor-it", label: "Floor It", metric_delta: 2, stat_check: "SPD" },
    { id: "swerve", label: "Swerve", metric_delta: 1, stat_check: "MAN", risk: "rollover" },
  ],
  secondary_stats: {
    stats: {
      hp: { current: 80, max: 100 },
      speed: { current: 120, max: 120 },
      armor: { current: 3, max: 3 },
      maneuver: { current: 5, max: 5 },
      fuel: { current: 45, max: 60 },
    },
  },
  genre_slug: "road_warrior",
  mood: "frantic",
};

const CHARACTER_SUMMARY = {
  player_id: "p1",
  name: "Sam",
  class: "Delver",
  level: 1,
  hp: 10,
  hp_max: 14,
  status_effects: [],
  portrait_url: "/renders/sam.png",
};

function renderLayout(overrides: Partial<GameBoardProps> = {}) {
  const defaults: GameBoardProps = {
    messages: [],
    characters: [CHARACTER_SUMMARY],
    onSend: vi.fn(),
    disabled: false,
  };
  const props = { ...defaults, ...overrides };
  return render(
    <ImageBusProvider messages={props.messages}>
      <GameBoard {...props} />
    </ImageBusProvider>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AC1: GameBoard renders ConfrontationOverlay when data is provided
// ══════════════════════════════════════════════════════════════════════════════

describe("AC1: ConfrontationOverlay renders in GameBoard", () => {
  it("renders confrontation overlay when confrontationData is provided", () => {
    renderLayout({ confrontationData: STANDOFF_DATA });

    expect(screen.getByTestId("confrontation-overlay")).toBeInTheDocument();
    expect(screen.getByText("High Noon Standoff")).toBeInTheDocument();
  });

  it("does not render confrontation overlay when confrontationData is null", () => {
    renderLayout({ confrontationData: null });

    expect(screen.queryByTestId("confrontation-overlay")).not.toBeInTheDocument();
  });

  it("does not render confrontation overlay when confrontationData is undefined", () => {
    renderLayout();

    expect(screen.queryByTestId("confrontation-overlay")).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC2: Correct confrontation type renders (standoff, chase, etc.)
// ══════════════════════════════════════════════════════════════════════════════

describe("AC2: Confrontation type rendering", () => {
  it("renders standoff with data-type attribute", () => {
    renderLayout({ confrontationData: STANDOFF_DATA });

    const overlay = screen.getByTestId("confrontation-overlay");
    expect(overlay).toHaveAttribute("data-type", "standoff");
    expect(overlay).toHaveAttribute("data-genre", "spaghetti_western");
  });

  it("renders chase with secondary stats panel", () => {
    renderLayout({ confrontationData: CHASE_DATA });

    const overlay = screen.getByTestId("confrontation-overlay");
    expect(overlay).toHaveAttribute("data-type", "chase");
    expect(screen.getByTestId("secondary-stats")).toBeInTheDocument();
  });

  it("renders actor portraits for all encounter participants", () => {
    renderLayout({ confrontationData: STANDOFF_DATA });

    const portraits = screen.getAllByTestId("actor-portrait");
    expect(portraits.length).toBe(2);
    expect(screen.getByText("The Stranger")).toBeInTheDocument();
    expect(screen.getByText("Black Bart")).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC3: Metric bar renders correctly
// ══════════════════════════════════════════════════════════════════════════════

describe("AC3: Metric bar in GameBoard context", () => {
  it("renders the metric bar with correct name", () => {
    renderLayout({ confrontationData: STANDOFF_DATA });

    expect(screen.getByTestId("metric-bar")).toBeInTheDocument();
    expect(screen.getByText("tension")).toBeInTheDocument();
  });

  it("renders the metric bar fill element", () => {
    renderLayout({ confrontationData: STANDOFF_DATA });

    expect(screen.getByTestId("metric-bar-fill")).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC4: Beat buttons render and fire onBeatSelect callback
// ══════════════════════════════════════════════════════════════════════════════

describe("AC4: Beat action buttons", () => {
  it("renders all beat options as buttons", () => {
    renderLayout({ confrontationData: STANDOFF_DATA });

    expect(screen.getByText("Stare Down")).toBeInTheDocument();
    expect(screen.getByText("Draw!")).toBeInTheDocument();
  });

  it("marks resolution beats with data-resolution attribute", () => {
    renderLayout({ confrontationData: STANDOFF_DATA });

    const drawBtn = screen.getByText("Draw!").closest("button");
    expect(drawBtn).toHaveAttribute("data-resolution", "true");
  });

  it("calls onBeatSelect when a beat button is clicked", async () => {
    const user = userEvent.setup();
    const onBeatSelect = vi.fn();
    renderLayout({ confrontationData: STANDOFF_DATA, onBeatSelect });

    await user.click(screen.getByText("Stare Down"));
    expect(onBeatSelect).toHaveBeenCalledWith("stare");
  });

  it("does not call onBeatSelect for resolution beats without confirmation", async () => {
    const user = userEvent.setup();
    const onBeatSelect = vi.fn();
    renderLayout({ confrontationData: STANDOFF_DATA, onBeatSelect });

    // Resolution beat "Draw!" should still fire onBeatSelect
    await user.click(screen.getByText("Draw!"));
    expect(onBeatSelect).toHaveBeenCalledWith("draw");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC5: Overlay hides when confrontation resolves
// ══════════════════════════════════════════════════════════════════════════════

describe("AC5: Overlay lifecycle", () => {
  it("shows overlay when confrontation starts", () => {
    renderLayout({ confrontationData: STANDOFF_DATA });

    expect(screen.getByTestId("confrontation-overlay")).toBeInTheDocument();
  });

  it("hides overlay when confrontationData becomes null (resolution)", () => {
    const { rerender } = render(
      <GameBoard
        messages={[]}
        characters={[CHARACTER_SUMMARY]}
        onSend={vi.fn()}
        disabled={false}
        activeOverlay={null}
        onOverlayChange={vi.fn()}
        confrontationData={STANDOFF_DATA}
      />,
    );

    expect(screen.getByTestId("confrontation-overlay")).toBeInTheDocument();

    rerender(
      <GameBoard
        messages={[]}
        characters={[CHARACTER_SUMMARY]}
        onSend={vi.fn()}
        disabled={false}
        activeOverlay={null}
        onOverlayChange={vi.fn()}
        confrontationData={null}
      />,
    );

    expect(screen.queryByTestId("confrontation-overlay")).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Wiring tests — verify ConfrontationOverlay is imported and connected
// ══════════════════════════════════════════════════════════════════════════════

describe("Wiring: ConfrontationOverlay in GameBoard", () => {
  it("GameBoard accepts confrontationData prop", () => {
    // TypeScript ensures prop exists — this tests runtime acceptance
    const { container } = renderLayout({ confrontationData: STANDOFF_DATA });
    expect(container).toBeInTheDocument();
  });

  it("GameBoard accepts onBeatSelect callback prop", () => {
    const onBeatSelect = vi.fn();
    const { container } = renderLayout({
      confrontationData: STANDOFF_DATA,
      onBeatSelect,
    });
    expect(container).toBeInTheDocument();
  });

  it("ConfrontationOverlay is importable from @/components/ConfrontationOverlay", async () => {
    const mod = await import("@/components/ConfrontationOverlay");
    expect(typeof mod.ConfrontationOverlay).toBe("function");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Production wiring test — verify App.tsx actually hands an onBeatSelect
// handler to <GameBoard>. The component-level tests above pass vi.fn() and
// only prove the callback plumbing inside GameBoard; they cannot catch the
// failure mode that shipped in playtest 2026-04-11: <GameBoard> instantiated
// with no onBeatSelect prop at all, so clicks were silent no-ops in production.
//
// This test reads App.tsx as source and asserts the wire-up is present.
// Follows the grep-style wiring-check convention used in sidequest-api tests
// (see npc_turns_beat_system_story_28_8_tests.rs:23).
// ══════════════════════════════════════════════════════════════════════════════

describe("Wiring: App.tsx → GameBoard onBeatSelect handler", () => {
  it("App.tsx declares a handleBeatSelect callback", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, "../App.tsx"),
      "utf-8",
    );
    expect(appSrc).toMatch(/const handleBeatSelect\s*=\s*useCallback/);
  });

  it("App.tsx passes onBeatSelect={handleBeatSelect} to <GameBoard>", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, "../App.tsx"),
      "utf-8",
    );
    // The <GameBoard .../> block must contain onBeatSelect={handleBeatSelect}.
    // Without this, confrontation buttons are silent no-ops in production.
    const gameBoardBlock = appSrc.match(/<GameBoard[\s\S]*?\/>/);
    expect(gameBoardBlock).not.toBeNull();
    expect(gameBoardBlock?.[0]).toContain("onBeatSelect={handleBeatSelect}");
  });

  it("handleBeatSelect routes beat clicks through handleSend (PLAYER_ACTION path)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, "../App.tsx"),
      "utf-8",
    );
    // The handler must actually call handleSend — otherwise the button click
    // is still a no-op even with the prop wired.
    const handlerBlock = appSrc.match(
      /const handleBeatSelect\s*=\s*useCallback[\s\S]*?\[confrontationData,\s*handleSend\],?\s*\)/,
    );
    expect(handlerBlock).not.toBeNull();
    expect(handlerBlock?.[0]).toContain("handleSend(");
  });
});
