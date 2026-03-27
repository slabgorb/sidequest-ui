import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWatcherSocket } from "@/hooks/useWatcherSocket";
import type { WatcherState } from "@/components/GMMode/types";

// ---------------------------------------------------------------------------
// Minimal WebSocket mock (matches project pattern from useGameSocket.test.ts)
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
    this.onclose?.(new CloseEvent("close"));
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

  simulateClose(code = 1000) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code }));
  }
}

function latestSocket(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

// ---------------------------------------------------------------------------
// Story 3-9: Watcher WebSocket hook
// ACs: WebSocket connects, WebSocket disconnects, Buffer bounded
// ---------------------------------------------------------------------------

describe("useWatcherSocket", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // AC: WebSocket connects when activated
  // =========================================================================

  it("connects to /ws/watcher when enabled", () => {
    renderHook(() => useWatcherSocket(3000, true));

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(latestSocket().url).toBe("ws://localhost:3000/ws/watcher");
  });

  it("does not connect when disabled", () => {
    renderHook(() => useWatcherSocket(3000, false));

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("reports connected state after socket opens", () => {
    const { result } = renderHook(() => useWatcherSocket(3000, true));

    expect(result.current.connected).toBe(false);

    act(() => {
      latestSocket().simulateOpen();
    });

    expect(result.current.connected).toBe(true);
  });

  // =========================================================================
  // AC: WebSocket disconnects when deactivated
  // =========================================================================

  it("closes socket when toggled from enabled to disabled", () => {
    const { rerender } = renderHook(
      ({ port, enabled }) => useWatcherSocket(port, enabled),
      { initialProps: { port: 3000, enabled: true } },
    );

    const ws = latestSocket();
    act(() => ws.simulateOpen());

    rerender({ port: 3000, enabled: false });

    expect(ws.close).toHaveBeenCalled();
  });

  it("reports disconnected after server-side close", () => {
    const { result } = renderHook(() => useWatcherSocket(3000, true));
    const ws = latestSocket();

    act(() => ws.simulateOpen());
    expect(result.current.connected).toBe(true);

    act(() => ws.simulateClose());
    expect(result.current.connected).toBe(false);
  });

  // =========================================================================
  // AC: Event stream — processes incoming telemetry events
  // =========================================================================

  it("accumulates turn events from messages", () => {
    const { result } = renderHook(() => useWatcherSocket(3000, true));
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    act(() => {
      ws.simulateMessage({
        type: "turn_record",
        turn: 1,
        events: [{ subsystem: "narrator", detail: "invoked" }],
      });
    });

    expect(result.current.turns).toHaveLength(1);
    expect(result.current.turns[0].turn).toBe(1);
  });

  it("updates histogram from events", () => {
    const { result } = renderHook(() => useWatcherSocket(3000, true));
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    act(() => {
      ws.simulateMessage({
        type: "turn_record",
        turn: 1,
        events: [{ subsystem: "narrator", detail: "invoked" }],
      });
    });

    expect(result.current.histogram).toHaveProperty("narrator");
    expect(result.current.histogram["narrator"]).toBeGreaterThan(0);
  });

  // =========================================================================
  // AC: Buffer bounded — 100 turn cap
  // =========================================================================

  it("caps turns buffer at 100 entries", () => {
    const { result } = renderHook(() => useWatcherSocket(3000, true));
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    // Send 110 turns
    act(() => {
      for (let i = 1; i <= 110; i++) {
        ws.simulateMessage({
          type: "turn_record",
          turn: i,
          events: [{ subsystem: "narrator", detail: `turn ${i}` }],
        });
      }
    });

    expect(result.current.turns.length).toBeLessThanOrEqual(100);
  });

  it("keeps the most recent turns when buffer overflows", () => {
    const { result } = renderHook(() => useWatcherSocket(3000, true));
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    act(() => {
      for (let i = 1; i <= 110; i++) {
        ws.simulateMessage({
          type: "turn_record",
          turn: i,
          events: [],
        });
      }
    });

    // The oldest turn should have been evicted
    const turns = result.current.turns;
    expect(turns[turns.length - 1].turn).toBe(110);
    expect(turns[0].turn).toBeGreaterThan(1);
  });

  // =========================================================================
  // Validation alerts
  // =========================================================================

  it("accumulates validation alerts", () => {
    const { result } = renderHook(() => useWatcherSocket(3000, true));
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    act(() => {
      ws.simulateMessage({
        type: "turn_record",
        turn: 1,
        events: [],
        validations: [
          {
            severity: "warning",
            check: "entity_ref",
            message: '"rusty lockbox" not found',
            turn: 1,
          },
        ],
      });
    });

    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].severity).toBe("warning");
  });

  // =========================================================================
  // Trope status updates
  // =========================================================================

  it("tracks trope lifecycle status", () => {
    const { result } = renderHook(() => useWatcherSocket(3000, true));
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    act(() => {
      ws.simulateMessage({
        type: "turn_record",
        turn: 1,
        events: [],
        tropes: [
          { name: "suspicion", progress: 0.75, beats_fired: ["beat_1"] },
        ],
      });
    });

    expect(result.current.tropes).toHaveLength(1);
    expect(result.current.tropes[0].name).toBe("suspicion");
    expect(result.current.tropes[0].progress).toBe(0.75);
  });

  // =========================================================================
  // Game snapshot updates
  // =========================================================================

  it("stores latest game snapshot", () => {
    const { result } = renderHook(() => useWatcherSocket(3000, true));
    const ws = latestSocket();
    act(() => ws.simulateOpen());

    act(() => {
      ws.simulateMessage({
        type: "snapshot",
        data: { characters: [], location: "The Rusted Saloon" },
      });
    });

    expect(result.current.latestSnapshot).not.toBeNull();
    expect(result.current.latestSnapshot?.location).toBe("The Rusted Saloon");
  });
});
