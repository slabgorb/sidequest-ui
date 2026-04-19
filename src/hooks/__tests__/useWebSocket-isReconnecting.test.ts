import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWebSocket } from "@/hooks/useWebSocket";

// Story 37-26 — isReconnecting derived flag on useWebSocket.
// Covers B1 (initial load false), B2 (intentional disconnect false),
// and the happy-path OPEN → CLOSED → reconnect transitions.

const instances: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }
  send() {}
  close(code = 1000) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  }
}

function latest() {
  return instances[instances.length - 1];
}
function openLatest() {
  const ws = latest();
  ws.readyState = MockWebSocket.OPEN;
  ws.onopen?.(new Event("open"));
}
function closeLatest(code = 1006) {
  const ws = latest();
  ws.readyState = MockWebSocket.CLOSED;
  ws.onclose?.({ code } as CloseEvent);
}

beforeEach(() => {
  instances.length = 0;
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useWebSocket isReconnecting (37-26)", () => {
  it("is false on mount before any open", () => {
    const { result } = renderHook(() =>
      useWebSocket<unknown>({ url: "ws://test", onMessage: () => {} }),
    );
    expect(result.current.isReconnecting).toBe(false);
  });

  it("stays false through first-time connect CLOSED → CONNECTING → OPEN", () => {
    const { result } = renderHook(() =>
      useWebSocket<unknown>({ url: "ws://test", onMessage: () => {} }),
    );
    expect(result.current.isReconnecting).toBe(false);
    act(() => openLatest());
    expect(result.current.isReconnecting).toBe(false);
  });

  it("flips true when socket drops after first open (AC-1)", () => {
    const { result } = renderHook(() =>
      useWebSocket<unknown>({ url: "ws://test", onMessage: () => {} }),
    );
    act(() => openLatest());
    act(() => closeLatest(1006));
    expect(result.current.isReconnecting).toBe(true);
  });

  it("stays false after intentional disconnect (B2)", () => {
    const { result } = renderHook(() =>
      useWebSocket<unknown>({ url: "ws://test", onMessage: () => {} }),
    );
    act(() => openLatest());
    expect(result.current.connected).toBe(true);
    act(() => result.current.disconnect());
    expect(result.current.isReconnecting).toBe(false);
  });

  it("flips back to false after successful reconnect", () => {
    const { result } = renderHook(() =>
      useWebSocket<unknown>({ url: "ws://test", onMessage: () => {} }),
    );
    act(() => openLatest());
    act(() => closeLatest(1006));
    expect(result.current.isReconnecting).toBe(true);
    act(() => {
      vi.runAllTimers();
    });
    act(() => openLatest());
    expect(result.current.isReconnecting).toBe(false);
  });

  it("connect() after intentional disconnect clears the intentional flag (next OPEN → not reconnecting)", () => {
    const { result } = renderHook(() =>
      useWebSocket<unknown>({
        url: "ws://test",
        onMessage: () => {},
        autoConnect: false,
      }),
    );
    act(() => result.current.connect());
    act(() => openLatest());
    act(() => result.current.disconnect());
    expect(result.current.isReconnecting).toBe(false);
    act(() => result.current.connect());
    // During CONNECTING after an explicit reconnect, banner SHOULD show — the
    // user requested the reconnect, so labeling it as such is honest.
    expect(result.current.isReconnecting).toBe(true);
    act(() => openLatest());
    expect(result.current.isReconnecting).toBe(false);
  });
});
