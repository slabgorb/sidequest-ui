import { render, screen, within } from "@testing-library/react";
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

const SAMPLE_MESSAGES: GameMessage[] = [
  narration("The ancient door creaks open."),
  narration("A chill wind sweeps through the chamber."),
  narration("Torchlight flickers on weathered stone walls."),
];

const LAYOUT_PREFS_KEY = "sq-narrative-layout";

// ── Layout type definition ───────────────────────────────────────────────────

type LayoutMode = "scroll" | "focus" | "cards";

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
  it("renders only the current passage", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={SAMPLE_MESSAGES} />);

    // Focus mode shows the most recent segment by default
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

  it("navigates to previous passage when prev button is clicked", async () => {
    const user = userEvent.setup();
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={SAMPLE_MESSAGES} />);

    // Initially on last segment
    expect(screen.getByText(/Torchlight flickers/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /prev/i }));
    expect(screen.getByText(/chill wind sweeps/)).toBeInTheDocument();
  });

  it("navigates to next passage when next button is clicked", async () => {
    const user = userEvent.setup();
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={SAMPLE_MESSAGES} />);

    // Go back first
    await user.click(screen.getByRole("button", { name: /prev/i }));
    expect(screen.getByText(/chill wind sweeps/)).toBeInTheDocument();

    // Then forward
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/Torchlight flickers/)).toBeInTheDocument();
  });

  it("disables prev button on first passage", async () => {
    const user = userEvent.setup();
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={SAMPLE_MESSAGES} />);

    // Navigate to the first segment
    await user.click(screen.getByRole("button", { name: /prev/i }));
    await user.click(screen.getByRole("button", { name: /prev/i }));

    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
  });

  it("disables next button on last passage", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={SAMPLE_MESSAGES} />);

    // Already on last segment by default
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("shows thinking indicator when thinking prop is true", async () => {
    const { NarrationFocus } = await import("@/components/NarrationFocus");
    render(<NarrationFocus messages={SAMPLE_MESSAGES} thinking={true} />);

    expect(screen.getByTestId("thinking-indicator")).toBeInTheDocument();
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
// AC2: Settings UI includes a layout mode selector
// ══════════════════════════════════════════════════════════════════════════════

describe("LayoutModeSelector", () => {
  it("renders a selector with three layout options", async () => {
    const { LayoutModeSelector } = await import("@/components/LayoutModeSelector");
    render(
      <LayoutModeSelector value="scroll" onChange={() => {}} />,
    );

    // Should show all three options
    expect(screen.getByRole("button", { name: /scroll/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /focus/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cards/i })).toBeInTheDocument();
  });

  it("highlights the currently active layout", async () => {
    const { LayoutModeSelector } = await import("@/components/LayoutModeSelector");
    render(
      <LayoutModeSelector value="focus" onChange={() => {}} />,
    );

    const focusBtn = screen.getByRole("button", { name: /focus/i });
    expect(focusBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onChange when a different layout is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { LayoutModeSelector } = await import("@/components/LayoutModeSelector");
    render(
      <LayoutModeSelector value="scroll" onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: /cards/i }));
    expect(onChange).toHaveBeenCalledWith("cards");
  });

  it("does not call onChange when current layout is re-selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { LayoutModeSelector } = await import("@/components/LayoutModeSelector");
    render(
      <LayoutModeSelector value="scroll" onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: /scroll/i }));
    expect(onChange).not.toHaveBeenCalled();
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

  it("LayoutModeSelector is importable from @/components/LayoutModeSelector", async () => {
    const mod = await import("@/components/LayoutModeSelector");
    expect(typeof mod.LayoutModeSelector).toBe("function");
  });

  it("useLayoutMode is importable from @/hooks/useLayoutMode", async () => {
    const mod = await import("@/hooks/useLayoutMode");
    expect(typeof mod.useLayoutMode).toBe("function");
  });
});
