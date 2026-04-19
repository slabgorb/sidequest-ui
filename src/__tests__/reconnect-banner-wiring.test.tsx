import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useWebSocket } from "@/hooks/useWebSocket";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import InputBar from "@/components/InputBar";

// Integration RED test for story 37-26.
//
// Renders a minimal host that mirrors App's wiring:
//   - useWebSocket → readyState
//   - <ReconnectBanner readyState={readyState} />
//   - <InputBar disabled={readyState !== WebSocket.OPEN} ... />
//
// Drives a MockWebSocket through OPEN → CLOSE and asserts:
//   AC-1/AC-4: banner appears when socket closes
//   AC-3: input disabled during disconnect, re-enabled on reopen

// ---------------------------------------------------------------------------
// MockWebSocket — mirrors useWebSocket-teardown.test.ts shape
// ---------------------------------------------------------------------------
type MockInstance = {
  url: string;
  readyState: number;
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  send: (_: unknown) => void;
  close: (code?: number) => void;
};

const instances: MockInstance[] = [];

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
    const inst: MockInstance = {
      url,
      readyState: MockWebSocket.CONNECTING,
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      send: () => {},
      close: (code = 1006) => {
        this.readyState = MockWebSocket.CLOSED;
        inst.readyState = MockWebSocket.CLOSED;
        this.onclose?.({ code } as CloseEvent);
      },
    };
    Object.defineProperty(inst, "onopen", {
      get: () => this.onopen,
      set: (v) => (this.onopen = v),
    });
    Object.defineProperty(inst, "onclose", {
      get: () => this.onclose,
      set: (v) => (this.onclose = v),
    });
    instances.push(inst);
  }

  send() {}
  close(code = 1000) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code } as CloseEvent);
  }
}

function openLatest() {
  const ws = instances[instances.length - 1] as unknown as MockWebSocket;
  ws.readyState = MockWebSocket.OPEN;
  ws.onopen?.(new Event("open"));
}

function closeLatest(code = 1006) {
  const ws = instances[instances.length - 1] as unknown as MockWebSocket;
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
function Host() {
  const { readyState } = useWebSocket<unknown>({
    url: "ws://test/socket",
    onMessage: () => {},
  });
  return (
    <>
      <ReconnectBanner readyState={readyState} />
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
    // Before the first OPEN, readyState is CLOSED/CONNECTING. Banner must
    // stay hidden or we'll lie to first-load users.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hides banner and enables input when connected", () => {
    render(<Host />);
    act(() => openLatest());
    expect(screen.queryByRole("status")).toBeNull();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });

  it("shows banner and disables input when socket drops after first open", () => {
    render(<Host />);
    act(() => openLatest());
    act(() => closeLatest(1006));
    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting/i);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it("re-enables input and hides banner on reconnect", () => {
    render(<Host />);
    act(() => openLatest());
    act(() => closeLatest(1006));
    // useWebSocket schedules a reconnect timer (initial backoff = 1000ms).
    // Fast-forward fake timers, then open the new mock socket.
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    act(() => openLatest());
    expect(screen.queryByRole("status")).toBeNull();
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });
});
