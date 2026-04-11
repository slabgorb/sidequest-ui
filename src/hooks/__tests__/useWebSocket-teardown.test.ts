import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWebSocket } from "@/hooks/useWebSocket";

// ══════════════════════════════════════════════════════════════════════════════
// Teardown regression tests — playtest 2026-04-11 "OTEL dashboard 2×/4× ingest"
//
// Root cause: React 18 StrictMode runs effect → cleanup → effect in rapid
// succession during dev mounts. The previous cleanup path relied on a ref-
// based `intentionalCloseRef` flag to suppress reconnection in the async
// `onclose` handler. But `close()` is async — the browser fires `onclose`
// AFTER the cleanup returns, and by then the re-running effect has already
// flipped the ref flag back to `false`. The stale `onclose` handler saw
// `intentionalCloseRef.current === false` and scheduled a reconnect,
// producing a ghost WebSocket that ran in parallel with the StrictMode-
// remounted socket. Both connections received the server's history replay
// and piped events into the dashboard reducer → 2× duplication per open
// cycle, 4× after an API restart forced a reconnect of BOTH ghosts.
//
// The fix (in useWebSocket.ts): null out the handlers
// (`ws.onclose = null`, etc.) BEFORE calling close() on teardown paths.
// Null handlers are unconditionally safe — any async close event is a
// no-op regardless of ref-flag state.
//
// These tests pin the fix by exercising:
//   (1) after cleanup, the previous socket cannot schedule a reconnect
//   (2) after cleanup, late `onclose` on the torn-down socket is a no-op
//   (3) a StrictMode-style mount → cleanup → mount does NOT leave a ghost
// ══════════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// Minimal WebSocket mock — modeled on useGameSocket.test.ts's MockWebSocket
// but with a helper for "delayed close after handlers are detached" so we
// can simulate the race condition directly.
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
    // Simulate the real-world async behavior: close() returns immediately,
    // onclose fires asynchronously. We capture the intent and rely on the
    // test to drive `simulateLateClose()` when it wants to model the race.
    this.readyState = MockWebSocket.CLOSING;
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  /**
   * Fire the async onclose that would arrive AFTER a close() call completes.
   * Used to simulate the StrictMode race: cleanup calls close(), effect
   * re-runs and resets the ref flag, then the delayed onclose fires on
   * the torn-down socket.
   */
  simulateLateClose(code = 1006) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code }));
  }
}

const originalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.WebSocket = MockWebSocket as any;
  vi.useFakeTimers();
});

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("useWebSocket — teardown handler detach (playtest 2026-04-11 regression)", () => {
  const URL = "ws://localhost:8765/ws/watcher";

  it("nulls onclose on the previous socket when createSocket replaces it", () => {
    // Render with autoConnect:true to match the useWatcherSocket pattern
    // that exhibited the OTEL dupe bug.
    const onMessage = vi.fn();
    const { unmount } = renderHook(() =>
      useWebSocket({ url: URL, onMessage, autoConnect: true }),
    );

    // First mount created one socket.
    expect(MockWebSocket.instances).toHaveLength(1);
    const first = MockWebSocket.instances[0]!;
    first.simulateOpen();

    // Unmount triggers cleanup — this is the StrictMode / real-unmount path.
    unmount();

    // After cleanup, the previous socket's onclose MUST have been nulled.
    // If onclose is non-null, the fix has regressed — late close events
    // can still run the reconnect logic.
    expect(first.onclose).toBeNull();
    expect(first.onmessage).toBeNull();
    expect(first.onopen).toBeNull();
    expect(first.onerror).toBeNull();
  });

  it("does NOT schedule a reconnect when a late close fires after cleanup", () => {
    // This is the exact StrictMode race:
    //   1. Effect runs → WS1 created → autoconnect
    //   2. Cleanup runs → WS1.close() called, handlers detached
    //   3. (React re-runs effect in StrictMode but we simulate unmount here
    //      because testing-library's renderHook doesn't double-mount by
    //      default; the detach behavior is what matters)
    //   4. WS1's async onclose fires LATE
    //   5. Without the fix: onclose sees stale flag → schedules reconnect →
    //      new socket created → ghost connection
    //   6. With the fix: onclose is null → late close is a no-op → no ghost
    const { unmount } = renderHook(() =>
      useWebSocket({ url: URL, onMessage: () => {}, autoConnect: true }),
    );

    const first = MockWebSocket.instances[0]!;
    first.simulateOpen();

    unmount();

    const socketsBeforeLateClose = MockWebSocket.instances.length;

    // Simulate the browser firing onclose AFTER cleanup has already
    // detached handlers. With the fix this should be a no-op.
    act(() => {
      first.simulateLateClose(1006);
    });

    // Advance past any reconnect backoff window.
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // No new socket should have been created by the late close.
    expect(MockWebSocket.instances.length).toBe(socketsBeforeLateClose);
  });

  it("still reconnects on genuine mid-session close (not torn down)", () => {
    // Regression guard the other way: the fix should not break real
    // reconnects. A genuine server-side drop on a LIVE socket (no cleanup
    // called) must still reach the reconnect path.
    renderHook(() =>
      useWebSocket({
        url: URL,
        onMessage: () => {},
        autoConnect: true,
        shouldReconnect: () => true,
      }),
    );

    const first = MockWebSocket.instances[0]!;
    first.simulateOpen();

    // Server drops the connection — handlers are still attached because
    // no cleanup has run.
    act(() => {
      first.simulateLateClose(1006);
    });

    // Advance past the first backoff interval.
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // A new socket should have been created by the reconnect timer.
    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
  });
});
