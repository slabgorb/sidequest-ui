import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { MessageType, type GameMessage } from "@/types/protocol";

// ── Test helpers ──────────────────────────────────────────────────────────────

function msg(
  type: MessageType,
  payload: Record<string, unknown> = {},
): GameMessage {
  return { type, payload, player_id: "narrator" };
}

function narration(text: string): GameMessage {
  return msg(MessageType.NARRATION, { text });
}

function narrationEnd(): GameMessage {
  return msg(MessageType.NARRATION_END, {});
}

function playerAction(action: string): GameMessage {
  return msg(MessageType.PLAYER_ACTION, { action });
}

const SAMPLE_MESSAGES: GameMessage[] = [
  narration("The ancient door creaks open."),
  narration("A chill wind sweeps through the chamber."),
  narration("Torchlight flickers on weathered stone walls."),
];

// Multi-turn data for testing Focus-mode turn-page navigation.
// Each player action + narrator response = one page. The opening narration
// (before any player action) collapses into a single first page.
const MULTI_TURN_MESSAGES: GameMessage[] = [
  narration("The ancient door creaks open."),
  narration("A chill wind sweeps through the chamber."),
  narrationEnd(),
  playerAction("I step inside, torch held high."),
  narration("Your boots echo on weathered stone."),
  narration("Something stirs in the darkness ahead."),
  narrationEnd(),
  playerAction("I ready my blade and advance."),
  narration("A skeletal figure rises from the shadow."),
  narrationEnd(),
];

const LAYOUT_PREFS_KEY = "sq-narrative-layout";


// ══════════════════════════════════════════════════════════════════════════════
// AC1: Three narrative layout implementations exist (Scroll, Focus, Cards)
// ══════════════════════════════════════════════════════════════════════════════

describe("NarrationScroll", () => {
  it("renders all narrative segments in a scrollable feed", async () => {
    const { NarrationScroll } = await import("@/components/NarrationScroll");
    render(<NarrationScroll messages={SAMPLE_MESSAGES} />);

    expect(screen.getByText(/ancient door creaks open/)).toBeInTheDocument();
    expect(screen.getByText(/chill wind sweeps/)).toBeInTheDocument();
    expect(screen.getByText(/Torchlight flickers/)).toBeInTheDocument();
  });

  it("has a scrollable container with data-testid='narration-scroll'", async () => {
    const { NarrationScroll } = await import("@/components/NarrationScroll");
    render(<NarrationScroll messages={SAMPLE_MESSAGES} />);

    const container = screen.getByTestId("narration-scroll");
    expect(container).toBeInTheDocument();
  });

  it("shows thinking indicator when thinking prop is true", async () => {
    const { NarrationScroll } = await import("@/components/NarrationScroll");
    render(<NarrationScroll messages={SAMPLE_MESSAGES} thinking={true} />);

    expect(screen.getByTestId("thinking-indicator")).toBeInTheDocument();
  });

  it("renders empty state when no messages", async () => {
    const { NarrationScroll } = await import("@/components/NarrationScroll");
    render(<NarrationScroll messages={[]} />);

    const container = screen.getByTestId("narration-scroll");
    expect(container).toBeInTheDocument();
  });
});

describe("NarrationFocus", () => {
  it("groups all narrator paragraphs of a turn onto a single page", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={SAMPLE_MESSAGES} />);

    // All three narration lines belong to the same opening turn (no player
    // action boundary between them), so they must all render on one page.
    expect(screen.getByText(/ancient door creaks open/)).toBeInTheDocument();
    expect(screen.getByText(/chill wind sweeps/)).toBeInTheDocument();
    expect(screen.getByText(/Torchlight flickers/)).toBeInTheDocument();
  });

  it("has a container with data-testid='narration-focus'", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={SAMPLE_MESSAGES} />);

    expect(screen.getByTestId("narration-focus")).toBeInTheDocument();
  });

  it("provides prev/next navigation controls", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={SAMPLE_MESSAGES} />);

    expect(screen.getByRole("button", { name: /prev/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("starts on the newest turn page", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={MULTI_TURN_MESSAGES} />);

    // Newest turn: the skeletal figure turn (started by "ready my blade")
    expect(screen.getByText(/skeletal figure rises/)).toBeInTheDocument();
    // Older turns' narrator text should not be visible from the newest page
    expect(screen.queryByText(/ancient door creaks open/)).not.toBeInTheDocument();
  });

  it("navigates to previous turn when prev button is clicked", async () => {
    const user = userEvent.setup();
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={MULTI_TURN_MESSAGES} />);

    // Start on newest turn
    expect(screen.getByText(/skeletal figure rises/)).toBeInTheDocument();

    // Back to previous turn (the "step inside" turn)
    await user.click(screen.getByRole("button", { name: /prev/i }));
    expect(screen.getByText(/boots echo on weathered stone/)).toBeInTheDocument();
    expect(screen.getByText(/Something stirs in the darkness/)).toBeInTheDocument();
  });

  it("navigates to next turn when next button is clicked", async () => {
    const user = userEvent.setup();
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={MULTI_TURN_MESSAGES} />);

    // Go back one turn
    await user.click(screen.getByRole("button", { name: /prev/i }));
    expect(screen.getByText(/boots echo on weathered stone/)).toBeInTheDocument();

    // Then forward to newest
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/skeletal figure rises/)).toBeInTheDocument();
  });

  it("disables prev button on first turn page", async () => {
    const user = userEvent.setup();
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={MULTI_TURN_MESSAGES} />);

    // Three pages: opening → step inside → ready blade. Navigate back twice.
    await user.click(screen.getByRole("button", { name: /prev/i }));
    await user.click(screen.getByRole("button", { name: /prev/i }));

    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
    // First page content visible
    expect(screen.getByText(/ancient door creaks open/)).toBeInTheDocument();
  });

  it("disables next button on newest turn page", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={MULTI_TURN_MESSAGES} />);

    // Already on newest page by default
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("shows thinking indicator when thinking prop is true", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={SAMPLE_MESSAGES} thinking={true} />);

    expect(screen.getByTestId("thinking-indicator")).toBeInTheDocument();
  });

  it("renders player action banner together with the narrator response", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={MULTI_TURN_MESSAGES} />);

    // Newest page must include BOTH the triggering player action and the
    // narrator response — they live on the same page, not separate pages.
    expect(screen.getByText(/ready my blade and advance/)).toBeInTheDocument();
    expect(screen.getByText(/skeletal figure rises/)).toBeInTheDocument();
  });
});

describe("NarrationCards", () => {
  it("renders each narrative segment as a card", async () => {
    const { NarrationCards } = await import("@/components/NarrationCards");
    render(<NarrationCards messages={SAMPLE_MESSAGES} />);

    const cards = screen.getAllByTestId("narration-card");
    expect(cards.length).toBe(3);
  });

  it("has a container with data-testid='narration-cards'", async () => {
    const { NarrationCards } = await import("@/components/NarrationCards");
    render(<NarrationCards messages={SAMPLE_MESSAGES} />);

    expect(screen.getByTestId("narration-cards")).toBeInTheDocument();
  });

  it("displays all segment content within cards", async () => {
    const { NarrationCards } = await import("@/components/NarrationCards");
    render(<NarrationCards messages={SAMPLE_MESSAGES} />);

    expect(screen.getByText(/ancient door creaks open/)).toBeInTheDocument();
    expect(screen.getByText(/chill wind sweeps/)).toBeInTheDocument();
    expect(screen.getByText(/Torchlight flickers/)).toBeInTheDocument();
  });

  it("shows thinking indicator when thinking prop is true", async () => {
    const { NarrationCards } = await import("@/components/NarrationCards");
    render(<NarrationCards messages={SAMPLE_MESSAGES} thinking={true} />);

    expect(screen.getByTestId("thinking-indicator")).toBeInTheDocument();
  });

  it("renders empty state when no messages", async () => {
    const { NarrationCards } = await import("@/components/NarrationCards");
    render(<NarrationCards messages={[]} />);

    const container = screen.getByTestId("narration-cards");
    expect(container).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC3: Layout preference is persisted to localStorage
// ══════════════════════════════════════════════════════════════════════════════

describe("Layout localStorage persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 'scroll' when no preference is saved", async () => {
    const { useLayoutMode } = await import("@/hooks/useLayoutMode");
    const { renderHook } = await import("@testing-library/react");

    const { result } = renderHook(() => useLayoutMode());
    expect(result.current.mode).toBe("scroll");
  });

  it("restores saved layout preference from localStorage", async () => {
    localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify({ mode: "cards" }));
    const { useLayoutMode } = await import("@/hooks/useLayoutMode");
    const { renderHook } = await import("@testing-library/react");

    const { result } = renderHook(() => useLayoutMode());
    expect(result.current.mode).toBe("cards");
  });

  it("persists layout changes to localStorage", async () => {
    const { useLayoutMode } = await import("@/hooks/useLayoutMode");
    const { renderHook, act } = await import("@testing-library/react");

    const { result } = renderHook(() => useLayoutMode());
    act(() => {
      result.current.setMode("focus");
    });

    const stored = JSON.parse(localStorage.getItem(LAYOUT_PREFS_KEY)!);
    expect(stored.mode).toBe("focus");
  });

  it("handles corrupted localStorage gracefully", async () => {
    localStorage.setItem(LAYOUT_PREFS_KEY, "not-valid-json{{{");
    const { useLayoutMode } = await import("@/hooks/useLayoutMode");
    const { renderHook } = await import("@testing-library/react");

    const { result } = renderHook(() => useLayoutMode());
    expect(result.current.mode).toBe("scroll");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC4: All three layouts display the same narrative content correctly
// ══════════════════════════════════════════════════════════════════════════════

describe("Layout content parity", () => {
  const textContent = "The dragon descends from the mountain.";
  const messages = [narration(textContent)];

  it("NarrationScroll displays narration text", async () => {
    const { NarrationScroll } = await import("@/components/NarrationScroll");
    render(<NarrationScroll messages={messages} />);
    expect(screen.getByText(textContent)).toBeInTheDocument();
  });

  it("NarrationFocus displays narration text", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={messages} />);
    expect(screen.getByText(textContent)).toBeInTheDocument();
  });

  it("NarrationCards displays narration text", async () => {
    const { NarrationCards } = await import("@/components/NarrationCards");
    render(<NarrationCards messages={messages} />);
    expect(screen.getByText(textContent)).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC6: Active layout is immediately applied on selection
// ══════════════════════════════════════════════════════════════════════════════

describe("NarrativeView layout dispatch", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders NarrationScroll when layout mode is 'scroll'", async () => {
    localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify({ mode: "scroll" }));
    const { NarrativeView } = await import("@/screens/NarrativeView");
    render(<NarrativeView messages={SAMPLE_MESSAGES} />);

    expect(screen.getByTestId("narration-scroll")).toBeInTheDocument();
  });

  it("renders NarrationFocus when layout mode is 'focus'", async () => {
    localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify({ mode: "focus" }));
    const { NarrativeView } = await import("@/screens/NarrativeView");
    render(<NarrativeView messages={SAMPLE_MESSAGES} />);

    expect(screen.getByTestId("narration-focus")).toBeInTheDocument();
  });

  it("renders NarrationCards when layout mode is 'cards'", async () => {
    localStorage.setItem(LAYOUT_PREFS_KEY, JSON.stringify({ mode: "cards" }));
    const { NarrativeView } = await import("@/screens/NarrativeView");
    render(<NarrativeView messages={SAMPLE_MESSAGES} />);

    expect(screen.getByTestId("narration-cards")).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Wiring tests — verify imports resolve and components are reachable
// ══════════════════════════════════════════════════════════════════════════════

describe("Layout modes wiring", () => {
  it("NarrationScroll is importable from @/components/NarrationScroll", async () => {
    const mod = await import("@/components/NarrationScroll");
    expect(typeof mod.NarrationScroll).toBe("function");
  });

  it("NarrationFocus is importable from @/components/NarrationFocus", async () => {
    const mod = await import("@/components/NarrationFocus");
    expect(typeof mod.NarrationFocus).toBe("function");
  });

  it("NarrationCards is importable from @/components/NarrationCards", async () => {
    const mod = await import("@/components/NarrationCards");
    expect(typeof mod.NarrationCards).toBe("function");
  });

  it("useLayoutMode is importable from @/hooks/useLayoutMode", async () => {
    const mod = await import("@/hooks/useLayoutMode");
    expect(typeof mod.useLayoutMode).toBe("function");
  });
});
