import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useDashboardSocket } from "../useDashboardSocket";

// ---------------------------------------------------------------------------
// Mock WebSocket (project pattern from useWatcherSocket.test.ts)
// ---------------------------------------------------------------------------
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(data) }),
    );
  }
}

function latestSocket(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

// ---------------------------------------------------------------------------
// Helper: create a well-formed watcher event
// ---------------------------------------------------------------------------
function makeWatcherEvent(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: "2026-03-31T12:00:00Z",
    component: "game",
    event_type: "agent_span_open",
    severity: "info",
    fields: { turn_number: 1 },
    ...overrides,
  };
}

const MOCK_SNAPSHOT = {
  characters: [{ name: "Kira", hp: 50, max_hp: 100 }],
  location: "The Rusted Saloon",
  npcs: [],
  turn_number: 1,
};

// ---------------------------------------------------------------------------
// Story 18-2: Fix State Tab — Wire GameStateSnapshot to Dashboard Listener
//
// Root cause: useDashboardSocket.ts:139 checks event_type === "state_transition"
// but the API emits WatcherEventType::GameStateSnapshot which serializes to
// "game_state_snapshot" via serde snake_case.
// ---------------------------------------------------------------------------

describe("useDashboardSocket — GameStateSnapshot wiring", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // =========================================================================
  // AC-1: State tab shows game state after completing a turn
  // The reducer must recognize "game_state_snapshot" events and populate snapshot
  // =========================================================================

  it("populates turn snapshot from game_state_snapshot event", () => {
    const { result } = renderHook(() => useDashboardSocket());
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    act(() => {
      ws.simulateMessage(
        makeWatcherEvent({
          event_type: "game_state_snapshot",
          component: "game",
          fields: {
            turn_number: 1,
            snapshot: MOCK_SNAPSHOT,
          },
        }),
      );
    });

    // The turn's snapshot should be populated with the game state
    expect(result.current.turns).toHaveLength(1);
    expect(result.current.turns[0].snapshot).not.toBeNull();
    expect(result.current.turns[0].snapshot).toEqual(MOCK_SNAPSHOT);
  });

  it("sets latestSnapshot at the dashboard level from game_state_snapshot", () => {
    const { result } = renderHook(() => useDashboardSocket());
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    act(() => {
      ws.simulateMessage(
        makeWatcherEvent({
          event_type: "game_state_snapshot",
          component: "game",
          fields: {
            turn_number: 1,
            snapshot: MOCK_SNAPSHOT,
          },
        }),
      );
    });

    expect(result.current.latestSnapshot).not.toBeNull();
    expect(result.current.latestSnapshot).toEqual(MOCK_SNAPSHOT);
  });

  // =========================================================================
  // Negative test: "state_transition" is NOT the correct event type
  // After the fix, state_transition should NOT populate snapshot
  // =========================================================================

  it("does NOT populate snapshot from state_transition events", () => {
    const { result } = renderHook(() => useDashboardSocket());
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    act(() => {
      ws.simulateMessage(
        makeWatcherEvent({
          event_type: "state_transition",
          component: "game",
          fields: {
            turn_number: 1,
            snapshot: MOCK_SNAPSHOT,
          },
        }),
      );
    });

    // state_transition is the wrong event type — snapshot must remain null
    expect(result.current.turns).toHaveLength(1);
    expect(result.current.turns[0].snapshot).toBeNull();
  });

  // =========================================================================
  // AC-3: Diff view — previousSnapshot chains correctly across turns
  // =========================================================================

  it("chains previousSnapshot from prior turn when new turn arrives", () => {
    const { result } = renderHook(() => useDashboardSocket());
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    const snapshot1 = { ...MOCK_SNAPSHOT, turn_number: 1 };
    const snapshot2 = {
      ...MOCK_SNAPSHOT,
      turn_number: 2,
      location: "The Dusty Trail",
    };

    // Turn 1 with snapshot
    act(() => {
      ws.simulateMessage(
        makeWatcherEvent({
          event_type: "game_state_snapshot",
          component: "game",
          fields: { turn_number: 1, snapshot: snapshot1 },
        }),
      );
    });

    // Turn 2 — creates a new TurnProfile which should capture turn 1's snapshot as previousSnapshot
    act(() => {
      ws.simulateMessage(
        makeWatcherEvent({
          event_type: "agent_span_open",
          component: "game",
          fields: { turn_number: 2 },
        }),
      );
    });

    // Then turn 2 gets its own snapshot
    act(() => {
      ws.simulateMessage(
        makeWatcherEvent({
          event_type: "game_state_snapshot",
          component: "game",
          fields: { turn_number: 2, snapshot: snapshot2 },
        }),
      );
    });

    expect(result.current.turns).toHaveLength(2);
    // Turn 2 should have turn 1's snapshot as previousSnapshot for diffing
    expect(result.current.turns[1].previousSnapshot).toEqual(snapshot1);
    expect(result.current.turns[1].snapshot).toEqual(snapshot2);
  });

  // =========================================================================
  // AC-4: Turn selector — snapshot event must not create duplicate turns
  // =========================================================================

  it("correlates snapshot to existing turn by turn_number", () => {
    const { result } = renderHook(() => useDashboardSocket());
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    // First, an agent_span_open creates the turn
    act(() => {
      ws.simulateMessage(
        makeWatcherEvent({
          event_type: "agent_span_open",
          component: "game",
          fields: { turn_number: 1, action: "look around" },
        }),
      );
    });

    // Then the snapshot arrives for the same turn
    act(() => {
      ws.simulateMessage(
        makeWatcherEvent({
          event_type: "game_state_snapshot",
          component: "game",
          fields: { turn_number: 1, snapshot: MOCK_SNAPSHOT },
        }),
      );
    });

    // Should be one turn, not two — the snapshot correlates to the existing turn
    expect(result.current.turns).toHaveLength(1);
    expect(result.current.turns[0].playerInput).toBe("look around");
    expect(result.current.turns[0].snapshot).toEqual(MOCK_SNAPSHOT);
  });

  // =========================================================================
  // Edge case: snapshot without fields.snapshot should not set null over existing
  // =========================================================================

  it("ignores game_state_snapshot events without a snapshot field", () => {
    const { result } = renderHook(() => useDashboardSocket());
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    act(() => {
      ws.simulateMessage(
        makeWatcherEvent({
          event_type: "game_state_snapshot",
          component: "game",
          fields: { turn_number: 1 },
          // Note: no snapshot field
        }),
      );
    });

    expect(result.current.turns).toHaveLength(1);
    expect(result.current.turns[0].snapshot).toBeNull();
  });
});
