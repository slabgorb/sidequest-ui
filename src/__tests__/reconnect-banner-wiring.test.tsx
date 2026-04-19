import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import InputBar from "@/components/InputBar";

// Integration test for story 37-26 — drives a MockWebSocket through the real
// useWebSocket hook and asserts the prop contract between hook and banner:
//
//   - isReconnecting stays false on initial load (B1)
//   - isReconnecting flips true on unintentional drop (AC-1/AC-4)
//   - isReconnecting stays false on intentional disconnect (B2)
//   - InputBar disabled tracks readyState !== OPEN (AC-3)
//   - reconnect flips isReconnecting back to false

// ---------------------------------------------------------------------------
// MockWebSocket
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Host — minimal mirror of App's wiring
// ---------------------------------------------------------------------------
function Host({ onReady }: { onReady?: (disconnect: () => void) => void } = {}) {
  const { readyState, isReconnecting, disconnect } = useWebSocket<unknown>({
    url: "ws://test/socket",
    onMessage: () => {},
  });
  if (onReady) onReady(disconnect);
  return (
    <>
      <ReconnectBanner visible={isReconnecting} />
      <InputBar
        onSend={() => {}}
        disabled={readyState !== WebSocket.OPEN}
      />
    </>
  );
}

describe("Reconnect wiring integration (37-26)", () => {
  it("does NOT show banner on initial page load (B1 regression)", () => {
    render(<Host />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does NOT show banner through first-time connect (CLOSED → CONNECTING → OPEN)", () => {
    render(<Host />);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => openLatest());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hides banner and enables input when connected", () => {
    render(<Host />);
    act(() => openLatest());
    expect(screen.queryByRole("status")).toBeNull();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it("shows banner and disables input when socket drops unintentionally", () => {
    render(<Host />);
    act(() => openLatest());
    act(() => closeLatest(1006));
    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting/i);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("does NOT show banner on intentional disconnect (B2 regression)", () => {
    let disconnectFn: (() => void) | null = null;
    render(<Host onReady={(d) => (disconnectFn = d)} />);
    act(() => openLatest());
    expect(disconnectFn).not.toBeNull();
    act(() => disconnectFn!());
    // Intentional close: readyState will eventually be CLOSED, but banner
    // must stay hidden because the caller asked for it.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("re-enables input and hides banner on reconnect", () => {
    render(<Host />);
    act(() => openLatest());
    act(() => closeLatest(1006));
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Drain any pending reconnect timer regardless of backoff delay.
    act(() => {
      vi.runAllTimers();
    });
    act(() => openLatest());
    expect(screen.queryByRole("status")).toBeNull();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });
});
