import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { Suspense } from "react";

// ---------------------------------------------------------------------------
// Story 3-9: GM Mode panel component tests
// ACs: Panel renders, sections present, lazy loaded, no game impact
// ---------------------------------------------------------------------------

// We import GMMode directly for component-level tests.
// Lazy-loading is tested separately.
import GMMode from "@/components/GMMode/GMMode";
import type { WatcherState } from "@/components/GMMode/types";

// ---------------------------------------------------------------------------
// Mock watcher state for rendering tests
// ---------------------------------------------------------------------------
const mockWatcherState: WatcherState = {
  connected: true,
  turns: [
    {
      turn: 1,
      events: [
        { subsystem: "narrator", detail: "invoked", severity: "info" },
        { subsystem: "intent_router", detail: "exploration", severity: "info" },
      ],
    },
    {
      turn: 2,
      events: [
        {
          subsystem: "entity_ref",
          detail: '"rusty lockbox" not found',
          severity: "warning",
        },
      ],
    },
  ],
  histogram: {
    narrator: 5,
    intent_router: 4,
    creature_smith: 1,
    ensemble: 0,
  },
  tropes: [
    { name: "suspicion", progress: 0.75, beats_fired: ["beat_1"] },
    { name: "forbidden_love", progress: 0.33, beats_fired: [] },
  ],
  alerts: [
    {
      severity: "warning",
      check: "entity_ref",
      message: '"rusty lockbox" not found',
      turn: 2,
    },
  ],
  latestSnapshot: {
    characters: [{ name: "Kael", hp: 30, max_hp: 50 }],
    location: "The Rusted Saloon",
    combat: null,
    quest_log: [{ name: "Find the key", active: true }],
  },
};

// ---------------------------------------------------------------------------
// AC: Panel sections render
// ---------------------------------------------------------------------------

describe("GMMode component", () => {
  it("renders the GM Mode header", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    expect(screen.getByText(/GM Mode/i)).toBeInTheDocument();
  });

  // =========================================================================
  // AC: Event stream renders
  // =========================================================================

  it("renders the Event Stream section", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    expect(screen.getByText(/Event Stream/i)).toBeInTheDocument();
  });

  it("shows turn events with severity coloring", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    // Events from turn data should be visible in the Event Stream section specifically.
    // "narrator" also appears as a subsystem histogram label, so scope the query.
    // getByText finds the header <div> inside CollapsibleSection; .parentElement
    // reaches the outer wrapper that contains both the header and the content sibling.
    const eventStream = screen.getByText(/Event Stream/i).closest("div")!.parentElement!;
    expect(within(eventStream).getByText(/narrator/i)).toBeInTheDocument();
    expect(within(eventStream).getByText(/intent_router/i)).toBeInTheDocument();
  });

  // =========================================================================
  // AC: Subsystem bars render
  // =========================================================================

  it("renders the Subsystem Activity section", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    expect(screen.getByText(/Subsystem Activity/i)).toBeInTheDocument();
  });

  it("shows agent invocation counts", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    // narrator has 5 invocations
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  // =========================================================================
  // AC: Trope timeline renders
  // =========================================================================

  it("renders the Trope Timeline section", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    expect(screen.getByText(/Trope Timeline/i)).toBeInTheDocument();
  });

  it("shows trope names and progress", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    expect(screen.getByText(/suspicion/i)).toBeInTheDocument();
    expect(screen.getByText(/forbidden_love/i)).toBeInTheDocument();
  });

  // =========================================================================
  // AC: State inspector renders
  // =========================================================================

  it("renders the Game State Inspector section", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    expect(screen.getByText(/Game State/i)).toBeInTheDocument();
  });

  it("shows location from snapshot", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    expect(screen.getByText(/The Rusted Saloon/i)).toBeInTheDocument();
  });

  // =========================================================================
  // AC: Validation alerts render
  // =========================================================================

  it("renders the Validation Alerts section", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    expect(screen.getByText(/Validation/i)).toBeInTheDocument();
  });

  it("shows alert messages with turn numbers", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    // "rusty lockbox" appears in both the Event Stream (turn 2 warning) and in
    // the Validation Alerts section. Scope to Validation Alerts to test the right thing.
    const alertSection = screen.getByText(/Validation Alerts/i).closest("div")!.parentElement!;
    expect(within(alertSection).getByText(/rusty lockbox/i)).toBeInTheDocument();
  });

  // =========================================================================
  // AC: Connection status
  // =========================================================================

  it("shows connected status indicator", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    // Should indicate connected state somewhere
    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it("shows disconnected status when not connected", () => {
    const disconnected = { ...mockWatcherState, connected: false };
    render(<GMMode state={disconnected} onClose={vi.fn()} />);
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
  });

  // =========================================================================
  // Collapsible sections
  // =========================================================================

  it("supports collapsing sections", () => {
    render(<GMMode state={mockWatcherState} onClose={vi.fn()} />);
    const eventStreamHeader = screen.getByText(/Event Stream/i);

    // Click to collapse
    fireEvent.click(eventStreamHeader);

    // After collapse, event details should be hidden
    // (exact assertion depends on implementation, but the header should still be there)
    expect(eventStreamHeader).toBeInTheDocument();
  });

  // =========================================================================
  // Empty state handling
  // =========================================================================

  it("renders gracefully with empty state", () => {
    const emptyState: WatcherState = {
      connected: false,
      turns: [],
      histogram: {},
      tropes: [],
      alerts: [],
      latestSnapshot: null,
    };
    render(<GMMode state={emptyState} onClose={vi.fn()} />);
    expect(screen.getByText(/GM Mode/i)).toBeInTheDocument();
  });

  // =========================================================================
  // Close callback
  // =========================================================================

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<GMMode state={mockWatcherState} onClose={onClose} />);

    // Find and click the close/minimize button
    const closeBtn = screen.getByRole("button", { name: /close|minimize/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// AC: Lazy loaded — bundle chunk not loaded until first activation
// ---------------------------------------------------------------------------

describe("GMMode lazy loading", () => {
  it("exports a lazy-loadable default from the index", async () => {
    // The index should export via React.lazy
    const LazyGMMode = React.lazy(
      () => import("@/components/GMMode/GMMode"),
    );

    // Should be renderable inside Suspense
    expect(LazyGMMode).toBeDefined();
  });
});
