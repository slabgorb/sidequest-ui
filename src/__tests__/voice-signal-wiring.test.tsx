/**
 * 57-32: VOICE_SIGNAL wiring through App.tsx.
 *
 * Tests the integration layer that connects incoming VOICE_SIGNAL WebSocket
 * messages to useVoiceChat.handleSignal(), and outgoing signals from
 * useVoiceChat.onSignal() to WebSocket VOICE_SIGNAL messages.
 *
 * Acceptance criteria covered:
 *   AC-1: Server relays SDP offer to target peer (client receives it)
 *   AC-2: Server relays SDP answer back to originator (client receives it)
 *   AC-3: ICE candidates relayed between peers (client receives it)
 *   AC-4: Missing/disconnected target handled gracefully (no client crash)
 *   AC-5: End-to-end peer connection negotiation through server relay
 */
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  installWebAudioMock,
  installLocalStorageMock,
} from "@/audio/__tests__/web-audio-mock";
import { AudioEngine } from "@/audio/AudioEngine";

// Mock useWhisper to avoid @huggingface/transformers dependency in tests
vi.mock("@/hooks/useWhisper", () => ({
  useWhisper: () => ({
    transcribe: vi.fn().mockResolvedValue(""),
    status: "ready" as const,
    loadProgress: 1,
    isWebGPU: false,
  }),
}));

// Mock useVoiceChat — we spy on handleSignal and capture onSignal callback
const mockHandleSignal = vi.fn();
let capturedOnSignal: ((peerId: string, signal: Record<string, unknown>) => void) | null = null;

vi.mock("@/hooks/useVoiceChat", () => ({
  useVoiceChat: (opts: { onSignal: (peerId: string, signal: Record<string, unknown>) => void }) => {
    capturedOnSignal = opts.onSignal;
    return {
      localStream: null,
      peerStreams: new Map(),
      handleSignal: mockHandleSignal,
      muted: false,
      setMuted: vi.fn(),
      muteOutgoing: vi.fn(),
      unmuteOutgoing: vi.fn(),
    };
  },
}));

import App from "../App";
import { MessageType, type GameMessage } from "@/types/protocol";

// ---------------------------------------------------------------------------
// MockWebSocket — same pattern as character-creation-wiring.test.tsx
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const originalWebSocket = globalThis.WebSocket;

function latestSocket(): MockWebSocket {
  return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

/** Connect a player and advance to game phase. */
async function connectAndReady(
  user: ReturnType<typeof userEvent.setup>,
  playerName = "TestHero",
) {
  const nameInput = screen.getByLabelText(/player name/i);
  await user.clear(nameInput);
  await user.type(nameInput, playerName);

  // Select genre
  const genreSelect = screen.queryByLabelText(/genre/i);
  if (genreSelect) {
    await user.selectOptions(genreSelect, "low_fantasy");
  }

  await act(async () => {
    vi.advanceTimersByTime(100);
  });

  // Select world if needed
  const worldSelect = screen.queryByLabelText(/world/i);
  if (worldSelect && !(worldSelect as HTMLSelectElement).value) {
    const options = (worldSelect as HTMLSelectElement).options;
    if (options.length > 1) {
      await user.selectOptions(worldSelect, options[1].value);
    }
  }

  const connectBtn = screen.getByRole("button", { name: /connect|join|play/i });
  await user.click(connectBtn);

  await act(async () => {
    latestSocket().simulateOpen();
  });

  await act(async () => {
    vi.advanceTimersByTime(500);
  });

  // Server says: ready (returning player with character)
  await act(async () => {
    latestSocket().simulateMessage({
      type: MessageType.SESSION_EVENT,
      payload: { event: "ready", message: "Welcome back." },
      player_id: "server",
    });
  });
}

/** Build a VOICE_SIGNAL message from the server (relayed from another peer). */
function voiceSignalMessage(overrides: {
  from?: string;
  signal?: Record<string, unknown>;
} = {}): GameMessage {
  return {
    type: MessageType.VOICE_SIGNAL,
    payload: {
      from: "player_2",
      signal: { type: "offer", sdp: "remote-offer-sdp" },
      ...overrides,
    },
    player_id: "server",
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
const originalFetch = globalThis.fetch;

beforeEach(() => {
  AudioEngine.resetInstance();
  installWebAudioMock();
  installLocalStorageMock();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
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
    json: async () => ({
      low_fantasy: { worlds: ["default"] },
    }),
  }) as unknown as typeof fetch;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockHandleSignal.mockClear();
  capturedOnSignal = null;
});

afterEach(() => {
  AudioEngine.resetInstance();
  globalThis.WebSocket = originalWebSocket;
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// AC-1: Incoming SDP offer routed to handleSignal
// ---------------------------------------------------------------------------
describe("AC-1: incoming SDP offer wiring", () => {
  it("routes incoming VOICE_SIGNAL offer to useVoiceChat.handleSignal", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndReady(user);

    await act(async () => {
      latestSocket().simulateMessage(
        voiceSignalMessage({
          from: "player_2",
          signal: { type: "offer", sdp: "sdp-offer-from-2" },
        }),
      );
    });

    expect(mockHandleSignal).toHaveBeenCalledWith(
      "player_2",
      { type: "offer", sdp: "sdp-offer-from-2" },
    );
  });

  it("does NOT leak VOICE_SIGNAL into the narrative message list", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndReady(user);

    await act(async () => {
      latestSocket().simulateMessage(
        voiceSignalMessage({ from: "player_2" }),
      );
    });

    // VOICE_SIGNAL is signaling data, not narrative — should not appear as text
    const narrative = screen.queryByText(/remote-offer-sdp/);
    expect(narrative).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Incoming SDP answer routed to handleSignal
// ---------------------------------------------------------------------------
describe("AC-2: incoming SDP answer wiring", () => {
  it("routes incoming VOICE_SIGNAL answer to useVoiceChat.handleSignal", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndReady(user);

    await act(async () => {
      latestSocket().simulateMessage(
        voiceSignalMessage({
          from: "player_3",
          signal: { type: "answer", sdp: "sdp-answer-from-3" },
        }),
      );
    });

    expect(mockHandleSignal).toHaveBeenCalledWith(
      "player_3",
      { type: "answer", sdp: "sdp-answer-from-3" },
    );
  });
});

// ---------------------------------------------------------------------------
// AC-3: Incoming ICE candidate routed to handleSignal
// ---------------------------------------------------------------------------
describe("AC-3: incoming ICE candidate wiring", () => {
  it("routes incoming VOICE_SIGNAL candidate to useVoiceChat.handleSignal", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndReady(user);

    const iceCandidate = {
      type: "candidate",
      candidate: { candidate: "candidate-string", sdpMid: "0" },
    };

    await act(async () => {
      latestSocket().simulateMessage(
        voiceSignalMessage({
          from: "player_2",
          signal: iceCandidate,
        }),
      );
    });

    expect(mockHandleSignal).toHaveBeenCalledWith("player_2", iceCandidate);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Graceful handling of edge cases
// ---------------------------------------------------------------------------
describe("AC-4: graceful handling", () => {
  it("does not crash when VOICE_SIGNAL has no 'from' field", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndReady(user);

    // Should not throw
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.VOICE_SIGNAL,
        payload: { signal: { type: "offer", sdp: "test" } },
        player_id: "server",
      });
    });

    // No crash — component still renders
    expect(screen.getByTestId("game-board")).toBeInTheDocument();
  });

  it("does not crash when VOICE_SIGNAL has empty signal payload", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndReady(user);

    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.VOICE_SIGNAL,
        payload: { from: "player_2" },
        player_id: "server",
      });
    });

    expect(screen.getByTestId("game-board")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Outgoing signals sent via WebSocket
// ---------------------------------------------------------------------------
describe("AC-5: outgoing signal wiring", () => {
  it("sends VOICE_SIGNAL via WebSocket when onSignal fires", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndReady(user);

    // The onSignal callback should have been captured from useVoiceChat mock
    expect(capturedOnSignal).not.toBeNull();

    // Simulate useVoiceChat emitting a signal (e.g., SDP offer to player_2)
    await act(async () => {
      capturedOnSignal!("player_2", { type: "offer", sdp: "local-offer-sdp" });
    });

    const ws = latestSocket();
    const voiceMessages = ws.sent.filter(
      (m) => m.type === MessageType.VOICE_SIGNAL,
    );
    expect(voiceMessages).toHaveLength(1);
    expect(voiceMessages[0].payload).toEqual(
      expect.objectContaining({
        target: "player_2",
        signal: { type: "offer", sdp: "local-offer-sdp" },
      }),
    );
  });

  it("sends VOICE_SIGNAL answer via WebSocket", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndReady(user);

    expect(capturedOnSignal).not.toBeNull();

    await act(async () => {
      capturedOnSignal!("player_3", { type: "answer", sdp: "local-answer-sdp" });
    });

    const ws = latestSocket();
    const voiceMessages = ws.sent.filter(
      (m) => m.type === MessageType.VOICE_SIGNAL,
    );
    expect(voiceMessages).toHaveLength(1);
    expect(voiceMessages[0].payload).toEqual(
      expect.objectContaining({
        target: "player_3",
        signal: { type: "answer", sdp: "local-answer-sdp" },
      }),
    );
  });

  it("sends ICE candidate via WebSocket", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    await connectAndReady(user);

    expect(capturedOnSignal).not.toBeNull();

    const ice = { type: "candidate", candidate: { candidate: "ice-1", sdpMid: "0" } };

    await act(async () => {
      capturedOnSignal!("player_2", ice);
    });

    const ws = latestSocket();
    const voiceMessages = ws.sent.filter(
      (m) => m.type === MessageType.VOICE_SIGNAL,
    );
    expect(voiceMessages).toHaveLength(1);
    expect(voiceMessages[0].payload).toEqual(
      expect.objectContaining({
        target: "player_2",
        signal: ice,
      }),
    );
  });
});
