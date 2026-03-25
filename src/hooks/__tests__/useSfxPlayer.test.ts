import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageType, type GameMessage } from "@/types/protocol";

/**
 * Tests for useSfxPlayer — AUDIO_CUE SFX trigger playback with delays.
 *
 * Story 57-8 AC mapping:
 *   AC-2: SFX triggers play with optional delay
 *   AC-5: Multiple SFX triggers in one cue play correctly
 */

// ---------------------------------------------------------------------------
// Mock AudioEngine
// ---------------------------------------------------------------------------

function createMockEngine() {
  return {
    playMusic: vi.fn().mockResolvedValue(undefined),
    playSfx: vi.fn().mockResolvedValue(undefined),
    playVoice: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSfxPlayer", () => {
  let useSfxPlayer: typeof import("@/hooks/useSfxPlayer").useSfxPlayer;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const mod = await import("@/hooks/useSfxPlayer");
    useSfxPlayer = mod.useSfxPlayer;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays SFX immediately when no delay_ms", () => {
    const engine = createMockEngine();
    const handler = vi.fn();

    renderHook(() =>
      useSfxPlayer(engine as any, "/genre/low_fantasy", handler),
    );

    const registeredHandler = handler.mock.calls[0][1];

    act(() => {
      registeredHandler({
        sfx_triggers: [{ sound: "sfx/sword_clash.mp3" }],
      });
    });

    expect(engine.playSfx).toHaveBeenCalledWith(
      "/genre/low_fantasy/sfx/sword_clash.mp3",
    );
  });

  it("plays SFX after delay_ms when specified", () => {
    const engine = createMockEngine();
    const handler = vi.fn();

    renderHook(() =>
      useSfxPlayer(engine as any, "/genre/low_fantasy", handler),
    );

    const registeredHandler = handler.mock.calls[0][1];

    act(() => {
      registeredHandler({
        sfx_triggers: [{ sound: "sfx/door_creak.mp3", delay_ms: 500 }],
      });
    });

    // Should NOT have played yet
    expect(engine.playSfx).not.toHaveBeenCalled();

    // Advance timer by 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(engine.playSfx).toHaveBeenCalledWith(
      "/genre/low_fantasy/sfx/door_creak.mp3",
    );
  });

  it("plays multiple SFX triggers from one cue", () => {
    const engine = createMockEngine();
    const handler = vi.fn();

    renderHook(() =>
      useSfxPlayer(engine as any, "/genre/low_fantasy", handler),
    );

    const registeredHandler = handler.mock.calls[0][1];

    act(() => {
      registeredHandler({
        sfx_triggers: [
          { sound: "sfx/sword_clash.mp3", delay_ms: 0 },
          { sound: "sfx/shield_bash.mp3", delay_ms: 200 },
          { sound: "sfx/heal.mp3", delay_ms: 500 },
        ],
      });
    });

    // First plays immediately (delay_ms: 0)
    expect(engine.playSfx).toHaveBeenCalledTimes(1);
    expect(engine.playSfx).toHaveBeenCalledWith(
      "/genre/low_fantasy/sfx/sword_clash.mp3",
    );

    // Advance 200ms — second trigger fires
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(engine.playSfx).toHaveBeenCalledTimes(2);

    // Advance 300ms more (total 500ms) — third trigger fires
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(engine.playSfx).toHaveBeenCalledTimes(3);
  });

  it("does nothing when engine is null", () => {
    const handler = vi.fn();

    expect(() => {
      renderHook(() => useSfxPlayer(null, "/genre/low_fantasy", handler));
    }).not.toThrow();
  });

  it("does nothing when no sfx_triggers in payload", () => {
    const engine = createMockEngine();
    const handler = vi.fn();

    renderHook(() =>
      useSfxPlayer(engine as any, "/genre/low_fantasy", handler),
    );

    const registeredHandler = handler.mock.calls[0][1];

    act(() => {
      registeredHandler({ mood: "tense", music_track: "music/tense.mp3" });
    });

    expect(engine.playSfx).not.toHaveBeenCalled();
  });
});
