/**
 * Narration buffer flush repro — 2026-04-09 playtest bug.
 *
 * OQ-1 observed that NARRATION messages arrive on both the acting player
 * and the observer (confirmed via server logs showing observer_count: 1
 * and text_len: 794) but the Narrative panel stays empty. Suspect: the
 * `narrationBufferRef` in App.tsx holds messages until a flush timer or
 * audio-driven reveal fires — if something cancels the flush without
 * calling `flushNarrationBuffer`, NARRATION never lands in `messages`
 * state and never renders.
 *
 * This test walks a minimal path through App: connect, chargen complete,
 * send NARRATION + NARRATION_END (no TTS chunks, no binary audio), and
 * asserts the text appears in the DOM after the 500ms flush timer fires.
 */
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  installWebAudioMock,
  installLocalStorageMock,
} from "@/audio/__tests__/web-audio-mock";
import { AudioEngine } from "@/audio/AudioEngine";
import { MessageType, type GameMessage } from "@/types/protocol";

vi.mock("@/hooks/useWhisper", () => ({
  useWhisper: () => ({
    transcribe: vi.fn().mockResolvedValue(""),
    status: "ready" as const,
    loadProgress: 1,
    isWebGPU: false,
  }),
}));

import App from "../App";

// MockWebSocket minimal — same shape as character-creation-wiring.test.tsx.
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
  sent: GameMessage[] = [];

  send = vi.fn((data: string) => {
    this.sent.push(JSON.parse(data) as GameMessage);
  });
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
}

const originalWebSocket = globalThis.WebSocket;
const originalFetch = globalThis.fetch;

function latestSocket(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

beforeEach(() => {
  AudioEngine.resetInstance();
  installWebAudioMock();
  installLocalStorageMock();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  MockWebSocket.instances = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.WebSocket = MockWebSocket as any;
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      low_fantasy: { worlds: ["default"] },
    }),
  }) as unknown as typeof fetch;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  AudioEngine.resetInstance();
  globalThis.WebSocket = originalWebSocket;
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function connectAndEnterGame(user: ReturnType<typeof userEvent.setup>) {
  await act(async () => {
    vi.advanceTimersByTime(100);
  });
  const nameInput = screen.getByLabelText(/player name/i);
  await user.clear(nameInput);
  await user.type(nameInput, "Kael");
  const genreSelect = screen.queryByLabelText(/genre/i);
  if (genreSelect) {
    await user.selectOptions(genreSelect, "low_fantasy");
  }
  await act(async () => {
    vi.advanceTimersByTime(100);
  });
  const connectBtn = screen.getByRole("button", { name: /connect|join|play|begin/i });
  await user.click(connectBtn);
  await act(async () => {
    latestSocket().simulateOpen();
  });
  await act(async () => {
    vi.advanceTimersByTime(500);
  });

  // CHARACTER_CREATION phase=complete → sessionPhase=game
  await act(async () => {
    latestSocket().simulateMessage({
      type: MessageType.CHARACTER_CREATION,
      payload: {
        phase: "complete",
        character: { name: "Kael", class: "Ranger" },
      },
      player_id: "p1",
    });
  });

  // SESSION_EVENT ready to flip into "game" phase (not reconnect — initial)
  // Note: on first connect after chargen, sessionPhaseRef is already "game"
  // so isReconnect=false and buffer is NOT cleared.
}

describe("narration buffer flush (playtest regression)", () => {
  it("renders narration text when chunks arrive before NARRATION but no binary audio", async () => {
    // Realistic TTS path: server emits NARRATION_CHUNKs first (feeding TTS),
    // then NARRATION (the full text, dedup-skipped by buildSegments when
    // hasChunksForTurn), then NARRATION_END. If the AudioEngine is unhealthy
    // and binary frames never arrive, the watchdog must still flush the
    // buffer eventually so the player sees the text.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndEnterGame(user);

    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION_CHUNK,
        payload: { text: "The torch casts flickering shadows" },
        player_id: "p1",
      });
    });
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION_CHUNK,
        payload: { text: "across the chalk-warnings on the antechamber wall." },
        player_id: "p1",
      });
    });
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION,
        payload: {
          text: "The torch casts flickering shadows across the chalk-warnings on the antechamber wall.",
        },
        player_id: "p1",
      });
    });
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION_END,
        payload: {},
        player_id: "p1",
      });
    });

    // Advance past the 2000ms chunk watchdog fallback.
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(
      screen.getByText(/torch casts flickering shadows/i),
    ).toBeInTheDocument();
  });

  it("renders TWO consecutive turns with chunks — no stale-state bleeding", async () => {
    // Playtest scenario: existing session, player submits action, server
    // emits chunks + narration, then player submits another action.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndEnterGame(user);

    // Turn 1
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION_CHUNK,
        payload: { text: "First turn narration text appears here." },
        player_id: "p1",
      });
    });
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION,
        payload: { text: "First turn narration text appears here." },
        player_id: "p1",
      });
    });
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION_END,
        payload: {},
        player_id: "p1",
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByText(/first turn narration/i)).toBeInTheDocument();

    // Turn 2
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION_CHUNK,
        payload: { text: "Second turn completely different text." },
        player_id: "p1",
      });
    });
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION,
        payload: { text: "Second turn completely different text." },
        player_id: "p1",
      });
    });
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION_END,
        payload: {},
        player_id: "p1",
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByText(/second turn completely different/i)).toBeInTheDocument();
  });

  it("renders narration after a SESSION_EVENT ready arrives mid-session (reconnect)", async () => {
    // Mid-session reconnect: server sends SESSION_EVENT ready, which App.tsx
    // treats as a reconnect and CLEARS messages + narration buffer. Then the
    // server replays recent narration. The buffer must still flush.
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndEnterGame(user);

    // Simulate a reconnect: bump phase back, then SESSION_EVENT ready.
    // Rather than triggering a real reconnect, just send the ready event
    // and let App's handler run. The key is that the narration buffer gets
    // cleared on isReconnect=true, and subsequent NARRATION should still
    // make it through the pipeline.
    //
    // First, force sessionPhase back by sending SESSION_EVENT connected.
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.SESSION_EVENT,
        payload: { event: "connected", has_character: true },
        player_id: "p1",
      });
    });
    // Then ready — this will trigger the reconnect-clear code path.
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.SESSION_EVENT,
        payload: { event: "ready" },
        player_id: "p1",
      });
    });

    // Now send fresh narration.
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION,
        payload: { text: "Post-reconnect narration should render." },
        player_id: "p1",
      });
    });
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION_END,
        payload: {},
        player_id: "p1",
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(
      screen.getByText(/post-reconnect narration should render/i),
    ).toBeInTheDocument();
  });

  it("renders narration text after NARRATION + NARRATION_END with no TTS chunks", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndEnterGame(user);

    // Send a NARRATION message followed by NARRATION_END.
    // No NARRATION_CHUNK, no binary audio — the 500ms fallback flush timer
    // is the only thing that can move this into messages state.
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION,
        payload: {
          text: "The torch casts flickering shadows across the chalk-warnings on the antechamber wall.",
        },
        player_id: "p1",
      });
    });
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION_END,
        payload: {},
        player_id: "p1",
      });
    });

    // Advance past the 500ms flush fallback.
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // Narration text must be visible somewhere in the DOM.
    expect(
      screen.getByText(/torch casts flickering shadows/i),
    ).toBeInTheDocument();
  });
});
