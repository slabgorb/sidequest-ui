import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageType, type GameMessage } from "@/types/protocol";

/**
 * Tests for useMusicPlayer — AUDIO_CUE mood-driven music with crossfade.
 *
 * Story 57-8 AC mapping:
 *   AC-1: Mood change triggers music crossfade
 *   AC-3: Same mood does not re-trigger music
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
// Fixtures
// ---------------------------------------------------------------------------

function makeAudioCue(payload: Record<string, unknown>): GameMessage {
  return {
    type: MessageType.AUDIO_CUE,
    payload,
    player_id: "server",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useMusicPlayer", () => {
  let useMusicPlayer: typeof import("@/hooks/useMusicPlayer").useMusicPlayer;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/hooks/useMusicPlayer");
    useMusicPlayer = mod.useMusicPlayer;
  });

  it("calls playMusic on mood change with crossfade", () => {
    const engine = createMockEngine();
    const handler = vi.fn();

    renderHook(() =>
      useMusicPlayer(engine as any, "/genre/low_fantasy", handler),
    );

    // Simulate AUDIO_CUE message via the registered handler
    expect(handler).toHaveBeenCalled();
    const registeredHandler = handler.mock.calls[0][1];

    act(() => {
      registeredHandler({
        mood: "tense",
        music_track: "music/tense_01.mp3",
      });
    });

    expect(engine.playMusic).toHaveBeenCalledWith(
      "/genre/low_fantasy/music/tense_01.mp3",
      expect.any(Number),
    );
  });

  it("does not re-trigger music for the same mood", () => {
    const engine = createMockEngine();
    const handler = vi.fn();

    renderHook(() =>
      useMusicPlayer(engine as any, "/genre/low_fantasy", handler),
    );

    const registeredHandler = handler.mock.calls[0][1];

    act(() => {
      registeredHandler({ mood: "tense", music_track: "music/tense_01.mp3" });
    });

    act(() => {
      registeredHandler({ mood: "tense", music_track: "music/tense_01.mp3" });
    });

    // playMusic should only be called once — second cue is same mood
    expect(engine.playMusic).toHaveBeenCalledTimes(1);
  });

  it("triggers new music when mood changes", () => {
    const engine = createMockEngine();
    const handler = vi.fn();

    renderHook(() =>
      useMusicPlayer(engine as any, "/genre/low_fantasy", handler),
    );

    const registeredHandler = handler.mock.calls[0][1];

    act(() => {
      registeredHandler({
        mood: "exploration",
        music_track: "music/exploration_01.mp3",
      });
    });

    act(() => {
      registeredHandler({ mood: "tense", music_track: "music/tense_01.mp3" });
    });

    expect(engine.playMusic).toHaveBeenCalledTimes(2);
  });

  it("does nothing when engine is null", () => {
    const handler = vi.fn();

    // Should not throw
    expect(() => {
      renderHook(() => useMusicPlayer(null, "/genre/low_fantasy", handler));
    }).not.toThrow();
  });

  it("does nothing when AUDIO_CUE has no music_track", () => {
    const engine = createMockEngine();
    const handler = vi.fn();

    renderHook(() =>
      useMusicPlayer(engine as any, "/genre/low_fantasy", handler),
    );

    const registeredHandler = handler.mock.calls[0][1];

    act(() => {
      registeredHandler({ mood: "tense" }); // no music_track
    });

    expect(engine.playMusic).not.toHaveBeenCalled();
  });
});
