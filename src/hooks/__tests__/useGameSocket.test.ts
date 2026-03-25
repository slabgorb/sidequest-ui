import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useGameSocket } from "@/hooks/useGameSocket";
import { MessageType, type GameMessage } from "@/types/protocol";

// ---------------------------------------------------------------------------
// Minimal WebSocket mock
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

  /** Test helper — simulate the server accepting the connection. */
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  /** Test helper — simulate an incoming message. */
  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  /** Test helper — simulate an error. */
  simulateError() {
    const err = new Event("error");
    this.onerror?.(err);
  }

  /** Test helper — simulate server-side close. */
  simulateClose(code = 1000) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code }));
  }
}

// ---------------------------------------------------------------------------
// Install / tear-down
// ---------------------------------------------------------------------------
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
// Helpers
// ---------------------------------------------------------------------------
function latestSocket(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("useGameSocket", () => {
  const URL = "ws://localhost:8080/ws";

  // -- connect ---------------------------------------------------------------
  describe("connect", () => {
    it("creates a WebSocket to the given URL", () => {
      const { result } = renderHook(() =>
        useGameSocket({ url: URL }),
      );

      act(() => result.current.connect());

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(latestSocket().url).toBe(URL);
    });

    it("sets readyState to OPEN after connection", () => {
      const { result } = renderHook(() =>
        useGameSocket({ url: URL }),
      );

      act(() => result.current.connect());
      act(() => latestSocket().simulateOpen());

      expect(result.current.readyState).toBe(WebSocket.OPEN);
    });
  });

  // -- disconnect ------------------------------------------------------------
  describe("disconnect", () => {
    it("closes the WebSocket cleanly", () => {
      const { result } = renderHook(() =>
        useGameSocket({ url: URL }),
      );

      act(() => result.current.connect());
      act(() => latestSocket().simulateOpen());
      act(() => result.current.disconnect());

      expect(latestSocket().close).toHaveBeenCalled();
      expect(result.current.readyState).toBe(WebSocket.CLOSED);
    });
  });

  // -- message parsing -------------------------------------------------------
  describe("message parsing", () => {
    it("parses incoming JSON matching GameMessage format", () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useGameSocket({ url: URL, onMessage }),
      );

      act(() => result.current.connect());
      act(() => latestSocket().simulateOpen());

      const incoming: GameMessage = {
        type: MessageType.NARRATION,
        payload: { text: "You enter a dimly lit tavern." },
        player_id: "player-1",
      };

      act(() => latestSocket().simulateMessage(incoming));

      expect(onMessage).toHaveBeenCalledWith(incoming);
    });
  });

  // -- reconnect -------------------------------------------------------------
  describe("reconnect", () => {
    it("auto-reconnects on unexpected close with backoff", () => {
      const { result } = renderHook(() =>
        useGameSocket({ url: URL }),
      );

      act(() => result.current.connect());
      act(() => latestSocket().simulateOpen());

      // Server drops the connection unexpectedly (code !== 1000).
      act(() => latestSocket().simulateClose(1006));

      const socketsBeforeTimer = MockWebSocket.instances.length;

      // Advance past the first backoff interval (expect ≤ 2 s).
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(MockWebSocket.instances.length).toBeGreaterThan(socketsBeforeTimer);
    });

    it("does NOT reconnect on clean close (1000)", () => {
      const { result } = renderHook(() =>
        useGameSocket({ url: URL }),
      );

      act(() => result.current.connect());
      act(() => latestSocket().simulateOpen());
      act(() => latestSocket().simulateClose(1000));

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Only the original socket should exist.
      expect(MockWebSocket.instances).toHaveLength(1);
    });
  });

  // -- send ------------------------------------------------------------------
  describe("send", () => {
    it("sends PLAYER_ACTION messages as JSON", () => {
      const { result } = renderHook(() =>
        useGameSocket({ url: URL }),
      );

      act(() => result.current.connect());
      act(() => latestSocket().simulateOpen());

      const action: GameMessage = {
        type: MessageType.PLAYER_ACTION,
        payload: { action: "look around" },
        player_id: "player-1",
      };

      act(() => result.current.send(action));

      expect(latestSocket().send).toHaveBeenCalledWith(JSON.stringify(action));
    });
  });

  // -- error handling --------------------------------------------------------
  describe("error handling", () => {
    it("exposes connection errors in state", () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useGameSocket({ url: URL, onError }),
      );

      act(() => result.current.connect());
      act(() => latestSocket().simulateError());

      expect(result.current.error).not.toBeNull();
      expect(onError).toHaveBeenCalled();
    });
  });
});
