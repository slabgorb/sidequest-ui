import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAudioCue } from "@/hooks/useAudioCue";
import { MessageType, type GameMessage } from "@/types/protocol";
import {
  installWebAudioMock,
  installLocalStorageMock,
  type MockAudioContext,
} from "@/audio/__tests__/web-audio-mock";
import { AudioEngine } from "@/audio/AudioEngine";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let ctx: MockAudioContext;

beforeEach(() => {
  AudioEngine.resetInstance();
  ctx = installWebAudioMock();
  installLocalStorageMock();
  // Mock fetch for AudioEngine.playMusic/playSfx which call fetch(url)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
  }));
});

afterEach(() => {
  AudioEngine.resetInstance();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Fixtures — match server's build_audio_cue_payload format
// ---------------------------------------------------------------------------

function makeAudioCue(
  mood: string | null,
  musicTrack: string | null = null,
  sfxTriggers: string[] = [],
  action?: string,
): GameMessage {
  return {
    type: MessageType.AUDIO_CUE,
    payload: { mood, music_track: musicTrack, sfx_triggers: sfxTriggers, action },
    player_id: "server",
  };
}

function makeNarration(text: string): GameMessage {
  return {
    type: MessageType.NARRATION,
    payload: { text },
    player_id: "server",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAudioCue", () => {
  it("does nothing when messages array is empty", () => {
    const engine = new AudioEngine();
    const playMusicSpy = vi.spyOn(engine, "playMusic");
    const playSfxSpy = vi.spyOn(engine, "playSfx");

    renderHook(() => useAudioCue([], engine));

    expect(playMusicSpy).not.toHaveBeenCalled();
    expect(playSfxSpy).not.toHaveBeenCalled();
    engine.dispose();
  });

  it("plays music when AUDIO_CUE has mood + music_track", () => {
    const engine = new AudioEngine();
    const playMusicSpy = vi.spyOn(engine, "playMusic");

    const msg = makeAudioCue("tense", "/genre/low_fantasy/audio/tense.mp3");

    renderHook(() => useAudioCue([msg], engine));

    expect(playMusicSpy).toHaveBeenCalledWith(
      "/genre/low_fantasy/audio/tense.mp3",
      expect.any(Number),
    );
    engine.dispose();
  });

  it("deduplicates same mood — no re-trigger", () => {
    const engine = new AudioEngine();
    const playMusicSpy = vi.spyOn(engine, "playMusic");

    const msg1 = makeAudioCue("tense", "/genre/low_fantasy/audio/tense.mp3");
    const msg2 = makeAudioCue("tense", "/genre/low_fantasy/audio/tense.mp3");

    const { rerender } = renderHook(
      ({ msgs }) => useAudioCue(msgs, engine),
      { initialProps: { msgs: [msg1] } },
    );

    rerender({ msgs: [msg1, msg2] });

    expect(playMusicSpy).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it("plays new track when mood changes", () => {
    const engine = new AudioEngine();
    const playMusicSpy = vi.spyOn(engine, "playMusic");

    const msg1 = makeAudioCue("tense", "/genre/low_fantasy/audio/tense.mp3");
    const msg2 = makeAudioCue("calm", "/genre/low_fantasy/audio/calm.mp3");

    const { rerender } = renderHook(
      ({ msgs }) => useAudioCue(msgs, engine),
      { initialProps: { msgs: [msg1] } },
    );

    rerender({ msgs: [msg1, msg2] });

    expect(playMusicSpy).toHaveBeenCalledTimes(2);
    expect(playMusicSpy).toHaveBeenLastCalledWith("/genre/low_fantasy/audio/calm.mp3", expect.any(Number));
    engine.dispose();
  });

  it("plays SFX triggers", () => {
    const engine = new AudioEngine();
    const playSfxSpy = vi.spyOn(engine, "playSfx");

    const msg = makeAudioCue(null, null, ["/genre/low_fantasy/audio/sword_clash.mp3"]);

    renderHook(() => useAudioCue([msg], engine));

    expect(playSfxSpy).toHaveBeenCalledWith("/genre/low_fantasy/audio/sword_clash.mp3");
    engine.dispose();
  });

  it("handles music and sfx in same cue", () => {
    const engine = new AudioEngine();
    const playMusicSpy = vi.spyOn(engine, "playMusic");
    const playSfxSpy = vi.spyOn(engine, "playSfx");

    const msg = makeAudioCue("combat", "/genre/low_fantasy/audio/battle.mp3", ["/genre/low_fantasy/audio/clash.mp3"]);

    renderHook(() => useAudioCue([msg], engine));

    expect(playMusicSpy).toHaveBeenCalledWith("/genre/low_fantasy/audio/battle.mp3", expect.any(Number));
    expect(playSfxSpy).toHaveBeenCalledWith("/genre/low_fantasy/audio/clash.mp3");
    engine.dispose();
  });

  it("ignores non-AUDIO_CUE messages", () => {
    const engine = new AudioEngine();
    const playMusicSpy = vi.spyOn(engine, "playMusic");

    const narration = makeNarration("The wind howls.");

    renderHook(() => useAudioCue([narration], engine));

    expect(playMusicSpy).not.toHaveBeenCalled();
    engine.dispose();
  });

  it("handles missing music_track gracefully (no crash)", () => {
    const engine = new AudioEngine();
    const msg = makeAudioCue("ambient", null);

    // Should not throw
    expect(() => {
      renderHook(() => useAudioCue([msg], engine));
    }).not.toThrow();
    engine.dispose();
  });

  it("does nothing when engine is null", () => {
    const msg = makeAudioCue("tense", "/genre/low_fantasy/audio/track.mp3");

    // Should not throw when engine is null
    expect(() => {
      renderHook(() => useAudioCue([msg], null));
    }).not.toThrow();
  });

  it("returns nowPlaying with mood and title", () => {
    const engine = new AudioEngine();
    const msg = makeAudioCue("tense", "/genre/low_fantasy/audio/tense_exploration.mp3");

    const { result } = renderHook(() => useAudioCue([msg], engine));

    expect(result.current).toEqual({
      title: "tense exploration",
      mood: "tense",
    });
    engine.dispose();
  });

  it("returns null when no cues processed", () => {
    const engine = new AudioEngine();

    const { result } = renderHook(() => useAudioCue([], engine));

    expect(result.current).toBeNull();
    engine.dispose();
  });

  it("ducks music on action=duck instead of playing new track", () => {
    const engine = new AudioEngine();
    const playMusicSpy = vi.spyOn(engine, "playMusic");
    const duckSpy = vi.spyOn(engine, "duckMusic");

    const msg = makeAudioCue("tense", "/genre/low_fantasy/audio/tense.mp3", [], "duck");

    renderHook(() => useAudioCue([msg], engine));

    expect(duckSpy).toHaveBeenCalledTimes(1);
    expect(playMusicSpy).not.toHaveBeenCalled();
    engine.dispose();
  });

  it("restores music on action=restore instead of playing new track", () => {
    const engine = new AudioEngine();
    const playMusicSpy = vi.spyOn(engine, "playMusic");
    const restoreSpy = vi.spyOn(engine, "restoreMusic");

    const msg = makeAudioCue("tense", "/genre/low_fantasy/audio/tense.mp3", [], "restore");

    renderHook(() => useAudioCue([msg], engine));

    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(playMusicSpy).not.toHaveBeenCalled();
    engine.dispose();
  });

  it("stops music on action=stop", () => {
    const engine = new AudioEngine();
    const stopSpy = vi.spyOn(engine, "stopMusic");

    const msg = makeAudioCue("tense", "/genre/low_fantasy/audio/tense.mp3", [], "stop");

    renderHook(() => useAudioCue([msg], engine));

    expect(stopSpy).toHaveBeenCalledWith(undefined);
    engine.dispose();
  });

  it("fades out music on action=fade_out", () => {
    const engine = new AudioEngine();
    const stopSpy = vi.spyOn(engine, "stopMusic");

    const msg = makeAudioCue("tense", "/genre/low_fantasy/audio/tense.mp3", [], "fade_out");

    renderHook(() => useAudioCue([msg], engine));

    expect(stopSpy).toHaveBeenCalledWith(3000);
    engine.dispose();
  });

  it("still fires SFX triggers on duck/restore actions", () => {
    const engine = new AudioEngine();
    const playSfxSpy = vi.spyOn(engine, "playSfx");

    const msg = makeAudioCue(null, null, ["/genre/low_fantasy/audio/whoosh.mp3"], "duck");

    renderHook(() => useAudioCue([msg], engine));

    expect(playSfxSpy).toHaveBeenCalledWith("/genre/low_fantasy/audio/whoosh.mp3");
    engine.dispose();
  });

  it("plays music normally when action=play", () => {
    const engine = new AudioEngine();
    const playMusicSpy = vi.spyOn(engine, "playMusic");

    const msg = makeAudioCue("tense", "/genre/low_fantasy/audio/tense.mp3", [], "play");

    renderHook(() => useAudioCue([msg], engine));

    expect(playMusicSpy).toHaveBeenCalledWith(
      "/genre/low_fantasy/audio/tense.mp3",
      expect.any(Number),
    );
    engine.dispose();
  });
});
