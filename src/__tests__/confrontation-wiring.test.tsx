import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ConfrontationWidget } from "@/components/GameBoard/widgets/ConfrontationWidget";
import { ConfrontationOverlay, type ConfrontationData } from "@/components/ConfrontationOverlay";

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

// ══════════════════════════════════════════════════════════════════════════════
// AC1: ConfrontationOverlay renders in ConfrontationWidget
// ══════════════════════════════════════════════════════════════════════════════

describe("AC1: ConfrontationOverlay renders in ConfrontationWidget", () => {
  it("renders confrontation overlay when data is provided", () => {
    render(<ConfrontationWidget data={STANDOFF_DATA} />);

    expect(screen.getByTestId("confrontation-overlay")).toBeInTheDocument();
    expect(screen.getByText("High Noon Standoff")).toBeInTheDocument();
  });

  it("does not render confrontation overlay when data is null (via ConfrontationOverlay)", () => {
    render(<ConfrontationOverlay data={null} />);

    expect(screen.queryByTestId("confrontation-overlay")).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC2: Correct confrontation type renders (standoff, chase, etc.)
// ══════════════════════════════════════════════════════════════════════════════

describe("AC2: Confrontation type rendering", () => {
  it("renders standoff with data-type attribute", () => {
    render(<ConfrontationWidget data={STANDOFF_DATA} />);

    const overlay = screen.getByTestId("confrontation-overlay");
    expect(overlay).toHaveAttribute("data-type", "standoff");
    expect(overlay).toHaveAttribute("data-genre", "spaghetti_western");
  });

  it("renders chase with secondary stats panel", () => {
    render(<ConfrontationWidget data={CHASE_DATA} />);

    const overlay = screen.getByTestId("confrontation-overlay");
    expect(overlay).toHaveAttribute("data-type", "chase");
    expect(screen.getByTestId("secondary-stats")).toBeInTheDocument();
  });

  it("renders actor portraits for all encounter participants", () => {
    render(<ConfrontationWidget data={STANDOFF_DATA} />);

    const portraits = screen.getAllByTestId("actor-portrait");
    expect(portraits.length).toBe(2);
    expect(screen.getByText("The Stranger")).toBeInTheDocument();
    expect(screen.getByText("Black Bart")).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC3: Metric bar renders correctly
// ══════════════════════════════════════════════════════════════════════════════

describe("AC3: Metric bar display", () => {
  it("renders the metric bar with correct name", () => {
    render(<ConfrontationWidget data={STANDOFF_DATA} />);

    expect(screen.getByTestId("metric-bar")).toBeInTheDocument();
    expect(screen.getByText("tension")).toBeInTheDocument();
  });

  it("renders the metric bar fill element", () => {
    render(<ConfrontationWidget data={STANDOFF_DATA} />);

    expect(screen.getByTestId("metric-bar-fill")).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC4: Beat buttons render and fire onBeatSelect callback
// ══════════════════════════════════════════════════════════════════════════════

describe("AC4: Beat action buttons", () => {
  it("renders all beat options as buttons", () => {
    render(<ConfrontationWidget data={STANDOFF_DATA} />);

    expect(screen.getByText("Stare Down")).toBeInTheDocument();
    expect(screen.getByText("Draw!")).toBeInTheDocument();
  });

  it("marks resolution beats with data-resolution attribute", () => {
    render(<ConfrontationWidget data={STANDOFF_DATA} />);

    const drawBtn = screen.getByText("Draw!").closest("button");
    expect(drawBtn).toHaveAttribute("data-resolution", "true");
  });

  it("calls onBeatSelect when a beat button is clicked", async () => {
    const user = userEvent.setup();
    const onBeatSelect = vi.fn();
    render(<ConfrontationWidget data={STANDOFF_DATA} onBeatSelect={onBeatSelect} />);

    await user.click(screen.getByText("Stare Down"));
    expect(onBeatSelect).toHaveBeenCalledWith("stare");
  });

  it("calls onBeatSelect for resolution beats on click", async () => {
    const user = userEvent.setup();
    const onBeatSelect = vi.fn();
    render(<ConfrontationWidget data={STANDOFF_DATA} onBeatSelect={onBeatSelect} />);

    await user.click(screen.getByText("Draw!"));
    expect(onBeatSelect).toHaveBeenCalledWith("draw");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC5: Overlay lifecycle — hides when confrontation resolves
// ══════════════════════════════════════════════════════════════════════════════

describe("AC5: Overlay lifecycle", () => {
  it("hides overlay when data transitions from present to null", () => {
    const { rerender } = render(<ConfrontationOverlay data={STANDOFF_DATA} />);

    expect(screen.getByTestId("confrontation-overlay")).toBeInTheDocument();

    rerender(<ConfrontationOverlay data={null} />);

    expect(screen.queryByTestId("confrontation-overlay")).not.toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Wiring tests — verify ConfrontationWidget and ConfrontationOverlay are connected
// ══════════════════════════════════════════════════════════════════════════════

describe("Wiring: ConfrontationWidget component", () => {
  it("ConfrontationWidget is importable", async () => {
    const mod = await import("@/components/GameBoard/widgets/ConfrontationWidget");
    expect(typeof mod.ConfrontationWidget).toBe("function");
  });

  it("ConfrontationOverlay is importable from @/components/ConfrontationOverlay", async () => {
    const mod = await import("@/components/ConfrontationOverlay");
    expect(typeof mod.ConfrontationOverlay).toBe("function");
  });

  it("ConfrontationWidget renders ConfrontationOverlay with data and callback", async () => {
    const onBeatSelect = vi.fn();
    render(<ConfrontationWidget data={STANDOFF_DATA} onBeatSelect={onBeatSelect} />);

    expect(screen.getByTestId("confrontation-overlay")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("Stare Down"));
    expect(onBeatSelect).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Production wiring test — verify App.tsx and GameBoard actually wire confrontations
// 
// The component-level tests above pass vi.fn() and only prove the callback plumbing
// inside ConfrontationWidget/ConfrontationOverlay. This test reads source files to
// assert the production wire-up is present: GameBoard accepts the props, GameBoard
// renders ConfrontationWidget when data is present, and App.tsx passes the data
// through to GameBoard.
// ══════════════════════════════════════════════════════════════════════════════

describe("Wiring: Production App.tsx → GameBoard → ConfrontationWidget", () => {
  it("GameBoard.tsx accepts confrontationData prop", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const gameBoardSrc = fs.readFileSync(
      path.resolve(__dirname, "../components/GameBoard/GameBoard.tsx"),
      "utf-8",
    );
    expect(gameBoardSrc).toMatch(/confrontationData/);
  });

  it("GameBoard.tsx accepts onBeatSelect prop", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const gameBoardSrc = fs.readFileSync(
      path.resolve(__dirname, "../components/GameBoard/GameBoard.tsx"),
      "utf-8",
    );
    expect(gameBoardSrc).toMatch(/onBeatSelect/);
  });

  it("GameBoard.tsx renders ConfrontationWidget when confrontationData is provided", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const gameBoardSrc = fs.readFileSync(
      path.resolve(__dirname, "../components/GameBoard/GameBoard.tsx"),
      "utf-8",
    );
    // Should import ConfrontationWidget
    expect(gameBoardSrc).toMatch(/import.*ConfrontationWidget/);
    // Should pass confrontationData and onBeatSelect to ConfrontationWidget
    expect(gameBoardSrc).toMatch(/ConfrontationWidget.*data=\{confrontationData\}/);
    expect(gameBoardSrc).toMatch(/ConfrontationWidget.*onBeatSelect=\{onBeatSelect\}/);
  });

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

  it("handleBeatSelect sends BEAT_SELECTION messages to the server", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, "../App.tsx"),
      "utf-8",
    );
    // The handler must:
    // 1. Call send() (not just define the handler)
    // 2. Use BEAT_SELECTION message type
    // 3. Have [confrontationData, send] in its dependency array
    expect(appSrc).toMatch(/const handleBeatSelect\s*=\s*useCallback/);
    expect(appSrc).toMatch(/type:\s*MessageType\.BEAT_SELECTION/);
    expect(appSrc).toMatch(/\[confrontationData,\s*send\]/);
  });
});
