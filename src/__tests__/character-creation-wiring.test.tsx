/**
 * 57-31: Character creation wiring over WebSocket.
 *
 * Tests the integration layer that connects the CharacterCreation component
 * to the WebSocket transport. Verifies:
 *  - Session phase routing (connect → creation → game)
 *  - CHARACTER_CREATION messages render the creation UI
 *  - Player responses (choice, freeform, name, confirm) are sent over WS
 *  - Loading state while waiting for server response
 *  - Completion transitions to game view
 *  - Returning players skip creation
 */
import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
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

import App from "../App";
import { MessageType, type GameMessage } from "@/types/protocol";

// ---------------------------------------------------------------------------
// MockWebSocket — reusable from useGameSocket tests
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

/** Connect a player: fill name, select genre + world, click connect, open socket. */
async function connectPlayer(
  user: ReturnType<typeof userEvent.setup>,
  playerName = "TestHero",
  genre = "low_fantasy",
) {
  const nameInput = screen.getByLabelText(/player name/i);
  await user.clear(nameInput);
  await user.type(nameInput, playerName);

  // Select genre
  const genreSelect = screen.queryByLabelText(/genre/i);
  if (genreSelect) {
    await user.selectOptions(genreSelect, genre);
  }

  // Wait for fetch to resolve and world dropdown to appear
  await act(async () => {
    vi.advanceTimersByTime(100);
  });

  // Select world (auto-selected for single-world genres like low_fantasy)
  const worldSelect = screen.queryByLabelText(/world/i);
  if (worldSelect && !(worldSelect as HTMLSelectElement).value) {
    const options = (worldSelect as HTMLSelectElement).options;
    if (options.length > 1) {
      await user.selectOptions(worldSelect, options[1].value);
    }
  }

  const connectBtn = screen.getByRole("button", { name: /connect|join|play|begin/i });
  await user.click(connectBtn);

  // Let the WebSocket handshake complete
  await act(async () => {
    latestSocket().simulateOpen();
  });

  // Advance past the join timeout in App.tsx
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
}

/** Build a CHARACTER_CREATION scene message from the server. */
function sceneMessage(overrides: {
  phase?: string;
  scene_index?: number;
  total_scenes?: number;
  prompt?: string;
  choices?: Array<{ label: string; description: string }>;
  allows_freeform?: boolean;
  input_type?: string;
  character_preview?: Record<string, unknown>;
}): GameMessage {
  return {
    type: MessageType.CHARACTER_CREATION,
    payload: {
      phase: "scene",
      scene_index: 0,
      total_scenes: 3,
      prompt: "The mists part to reveal your origin...",
      choices: [],
      input_type: "choice",
      character_preview: {},
      ...overrides,
    },
    player_id: "test-player",
  };
}

/** Build a CHARACTER_CREATION complete message. */
function completeMessage(character: Record<string, unknown> = {}): GameMessage {
  return {
    type: MessageType.CHARACTER_CREATION,
    payload: {
      phase: "complete",
      character: {
        name: "TestHero",
        class: "warrior",
        ...character,
      },
    },
    player_id: "test-player",
  };
}

/** Build a SESSION_EVENT message for returning players. */
function sessionReadyMessage(): GameMessage {
  return {
    type: MessageType.SESSION_EVENT,
    payload: {
      event: "ready",
      player_name: "TestHero",
      has_character: true,
    },
    player_id: "test-player",
  };
}

/** Build a SESSION_EVENT message for new players. */
function sessionConnectedMessage(): GameMessage {
  return {
    type: MessageType.SESSION_EVENT,
    payload: {
      event: "connected",
      player_name: "TestHero",
      has_character: false,
    },
    player_id: "test-player",
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
const originalFetch = globalThis.fetch;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  AudioEngine.resetInstance();
  installWebAudioMock();
  installLocalStorageMock();
  // Mock matchMedia for useBreakpoint (GameLayout uses it)
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
  // Mock /api/genres so ConnectScreen can fetch worlds
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      low_fantasy: { worlds: ["default"] },
      road_warrior: { worlds: ["wasteland"] },
      elemental_harmony: { worlds: ["burning_peace", "shattered_accord"] },
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

// ---------------------------------------------------------------------------
// AC-1: New player enters character creation
// ---------------------------------------------------------------------------
describe("AC-1: new player enters character creation", () => {
  it("renders CharacterCreation when server signals new player", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    // Server says: new player, no character
    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    // Server sends first creation scene
    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          scene_index: 0,
          prompt: "The mists part to reveal your origin...",
          choices: [{ label: "Noble birth", description: "" }, { label: "Street orphan", description: "" }, { label: "Foreign traveler", description: "" }],
          input_type: "choice",
        }),
      );
    });

    // CharacterCreation should be visible, NOT GameView
    expect(
      screen.getByTestId("character-creation"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("game-layout")).not.toBeInTheDocument();
  });

  it("displays the first scene narration text", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          prompt: "You stand at the crossroads of fate.",
          choices: [{ label: "Path of honor", description: "" }, { label: "Path of shadow", description: "" }],
          input_type: "choice",
        }),
      );
    });

    expect(
      screen.getByText(/crossroads of fate/i),
    ).toBeInTheDocument();
  });

  it("displays scene progress (e.g. 1 of 3)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({ scene_index: 0, total_scenes: 3 }),
      );
    });

    // Progress indicator should be visible
    // Progress indicator renders as Roman numeral in absolute positioned span
    const progressSpan = screen.getByText("i", { selector: "span.absolute" });
    expect(progressSpan).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-2: Choice response advances builder
// ---------------------------------------------------------------------------
describe("AC-2: choice response advances builder", () => {
  it("sends CHARACTER_CREATION choice response when player clicks a choice", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          choices: [{ label: "Noble birth", description: "" }, { label: "Street orphan", description: "" }, { label: "Foreign traveler", description: "" }],
          input_type: "choice",
        }),
      );
    });

    // Click first choice
    const choiceBtn = screen.getByRole("button", { name: /noble birth/i });
    await user.click(choiceBtn);

    // Verify the WebSocket message sent
    const ws = latestSocket();
    const creationMsgs = ws.sent.filter(
      (m) => m.type === MessageType.CHARACTER_CREATION,
    );
    expect(creationMsgs.length).toBeGreaterThanOrEqual(1);

    const choiceMsg = creationMsgs.find(
      (m) => (m.payload as Record<string, unknown>).choice === "1",
    );
    expect(choiceMsg).toBeDefined();
    expect(choiceMsg!.payload).toMatchObject({
      phase: "scene",
      choice: "1",
    });
  });

  it("renders the next scene after server responds to choice", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    // Scene 1
    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          scene_index: 0,
          prompt: "Choose your origin.",
          choices: [{ label: "Noble", description: "" }, { label: "Commoner", description: "" }],
          input_type: "choice",
        }),
      );
    });

    const choiceBtn = screen.getByRole("button", { name: /noble/i });
    await user.click(choiceBtn);

    // Server sends scene 2
    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          scene_index: 1,
          prompt: "Now choose your calling.",
          choices: [{ label: "Warrior", description: "" }, { label: "Mage", description: "" }],
          input_type: "choice",
        }),
      );
    });

    expect(screen.getByText(/choose your calling/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Freeform and name input work
// ---------------------------------------------------------------------------
describe("AC-3: freeform and name input", () => {
  it("sends freeform response for text input scenes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          prompt: "Describe your character's greatest fear.",
          input_type: "freeform",
          choices: [],
        }),
      );
    });

    // Type in the freeform field and submit
    const input = screen.getByRole("textbox");
    await user.type(input, "The darkness beneath the mountain");
    const submitBtn = screen.getByRole("button", { name: /submit|send|continue/i });
    await user.click(submitBtn);

    const ws = latestSocket();
    const freeformMsg = ws.sent.find(
      (m) =>
        m.type === MessageType.CHARACTER_CREATION &&
        (m.payload as Record<string, unknown>).phase === "scene" &&
        typeof (m.payload as Record<string, unknown>).choice === "string",
    );
    expect(freeformMsg).toBeDefined();
    expect(freeformMsg!.payload).toMatchObject({
      phase: "scene",
      choice: "The darkness beneath the mountain",
    });
  });

  it("sends name response for name input scenes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          prompt: "What name do you carry?",
          input_type: "name",
          choices: [],
        }),
      );
    });

    const input = screen.getByRole("textbox");
    await user.type(input, "Aldric Stormborn");
    const submitBtn = screen.getByRole("button", { name: /submit|send|continue|confirm/i });
    await user.click(submitBtn);

    const ws = latestSocket();
    const nameMsg = ws.sent.find(
      (m) =>
        m.type === MessageType.CHARACTER_CREATION &&
        (m.payload as Record<string, unknown>).phase === "scene" &&
        (m.payload as Record<string, unknown>).choice === "Aldric Stormborn",
    );
    expect(nameMsg).toBeDefined();
    expect(nameMsg!.payload).toMatchObject({
      phase: "scene",
      choice: "Aldric Stormborn",
    });
  });
});

// ---------------------------------------------------------------------------
// AC-4: Complete transitions to game view
// ---------------------------------------------------------------------------
describe("AC-4: complete transitions to game view", () => {
  it("sends confirm action after final scene", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    // Final scene with character preview
    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          scene_index: 2,
          total_scenes: 3,
          prompt: "Your character is ready. Confirm?",
          input_type: "confirm",
          character_preview: { name: "TestHero", class: "warrior" },
        }),
      );
    });

    const confirmBtn = screen.getByRole("button", { name: /confirm|accept|begin/i });
    await user.click(confirmBtn);

    const ws = latestSocket();
    const confirmMsg = ws.sent.find(
      (m) =>
        m.type === MessageType.CHARACTER_CREATION &&
        (m.payload as Record<string, unknown>).phase === "confirmation" &&
        (m.payload as Record<string, unknown>).choice === "1",
    );
    expect(confirmMsg).toBeDefined();
  });

  it("transitions to game view when server sends complete", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    // Go through a scene first
    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({ input_type: "choice", choices: [{ label: "A", description: "" }, { label: "B", description: "" }] }),
      );
    });

    // Server sends complete
    await act(async () => {
      latestSocket().simulateMessage(completeMessage({ name: "TestHero" }));
    });

    // GameView should now be rendered, creation should be gone
    expect(screen.queryByTestId("character-creation")).not.toBeInTheDocument();
    expect(screen.getByTestId("game-layout")).toBeInTheDocument();
  });

  it("integrates character into GameState after completion", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({ input_type: "choice", choices: [{ label: "A", description: "" }] }),
      );
    });

    // Complete with character data
    await act(async () => {
      latestSocket().simulateMessage(
        completeMessage({
          name: "TestHero",
          class: "warrior",
          hp: 20,
          max_hp: 20,
        }),
      );
    });

    // After a NARRATION arrives, the game view should show character info
    await act(async () => {
      latestSocket().simulateMessage({
        type: MessageType.NARRATION,
        payload: {
          text: "Welcome to the world, TestHero.",
        },
        player_id: "test-player",
      });
    });

    // Advance past the 500ms narration buffer flush timer
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // The character name should appear somewhere in the game view
    expect(screen.getByText(/TestHero/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Returning player skips creation
// ---------------------------------------------------------------------------
describe("AC-5: returning player skips creation", () => {
  it("renders GameView directly when server signals existing character", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    // Server says: returning player, has character
    await act(async () => {
      latestSocket().simulateMessage(sessionReadyMessage());
    });

    // Should go straight to game view — no creation
    expect(screen.queryByTestId("character-creation")).not.toBeInTheDocument();
    expect(screen.getByTestId("game-layout")).toBeInTheDocument();
  });

  it("does not receive CHARACTER_CREATION messages for returning player", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionReadyMessage());
    });

    // Even if a rogue CHARACTER_CREATION arrives, game view stays
    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({ prompt: "Should not render" }),
      );
    });

    expect(screen.queryByTestId("character-creation")).not.toBeInTheDocument();
    expect(screen.getByTestId("game-layout")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
describe("loading state during creation", () => {
  it("shows loading indicator after player sends response", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          choices: [{ label: "Warrior", description: "" }, { label: "Mage", description: "" }],
          input_type: "choice",
        }),
      );
    });

    // Make a choice
    const choiceBtn = screen.getByRole("button", { name: /warrior/i });
    await user.click(choiceBtn);

    // Loading should be visible while waiting for next scene
    expect(
      screen.getByTestId("creation-loading") ??
        screen.getByRole("status"),
    ).toBeInTheDocument();
  });

  it("hides loading indicator when next scene arrives", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          choices: [{ label: "Warrior", description: "" }, { label: "Mage", description: "" }],
          input_type: "choice",
        }),
      );
    });

    const choiceBtn = screen.getByRole("button", { name: /warrior/i });
    await user.click(choiceBtn);

    // Next scene arrives
    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          scene_index: 1,
          prompt: "Choose your weapon.",
          choices: [{ label: "Sword", description: "" }, { label: "Staff", description: "" }],
          input_type: "choice",
        }),
      );
    });

    expect(screen.queryByTestId("creation-loading")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Edge cases — paranoid TEA coverage
// ---------------------------------------------------------------------------
describe("edge cases", () => {
  it("does not crash if CHARACTER_CREATION arrives before session event", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    // Scene arrives before session event — should not crash
    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({ prompt: "Early scene" }),
      );
    });

    // App should still be functional
    expect(screen.getByTestId("app")).toBeInTheDocument();
  });

  it("handles empty choices array gracefully on choice scene", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<App />);
    // Wait for ConnectScreen to render after App mounts
    // Advance timers to let App initialize
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await connectPlayer(user);

    await act(async () => {
      latestSocket().simulateMessage(sessionConnectedMessage());
    });

    // Malformed scene: choice type but no choices
    await act(async () => {
      latestSocket().simulateMessage(
        sceneMessage({
          input_type: "choice",
          choices: [],
          prompt: "A moment of silence.",
        }),
      );
    });

    // Should render narration without crashing
    expect(screen.getByText(/moment of silence/i)).toBeInTheDocument();
  });
});
