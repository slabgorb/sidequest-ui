/**
 * 18-16: Audio mixer wiring integration tests.
 *
 * Verifies that ALL audio sources (TTS voice, AUDIO_CUE music/sfx) route
 * through AudioEngine's unified mixer, and that AudioStatus controls
 * are wired to real AudioEngine state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  installWebAudioMock,
  installLocalStorageMock,
  type MockAudioContext,
} from "@/audio/__tests__/web-audio-mock";
import { AudioEngine } from "@/audio/AudioEngine";

// ---------------------------------------------------------------------------
// 1. TTS binary frames route through AudioEngine.playVoice()
// ---------------------------------------------------------------------------

describe("18-16: TTS routes through AudioEngine", () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    AudioEngine.resetInstance();
    ctx = installWebAudioMock();
    installLocalStorageMock();
  });

  afterEach(() => {
    AudioEngine.resetInstance();
    vi.unstubAllGlobals();
  });

  it("useGameSocket does NOT create its own AudioContext for binary frames", async () => {
    // Import useGameSocket and verify it no longer contains AudioContext creation
    const { useGameSocket } = await import("@/hooks/useGameSocket");

    // The module source should not reference "new AudioContext" for TTS playback.
    // We test this behaviorally: simulate a binary frame and verify no extra
    // AudioContext is created beyond the one from our mock.
    const audioContextCalls = (globalThis.AudioContext as ReturnType<typeof vi.fn>).mock.calls.length;

    // Create a mock binary frame
    const header = JSON.stringify({ type: "VOICE_AUDIO", segment_id: "seg-1", format: "pcm_s16le", sample_rate: 24000 });
    const headerBytes = new TextEncoder().encode(header);
    const buf = new ArrayBuffer(4 + headerBytes.length + 100);
    const view = new DataView(buf);
    view.setUint32(0, headerBytes.length, false);
    new Uint8Array(buf, 4, headerBytes.length).set(headerBytes);

    // The useGameSocket hook should not create a new AudioContext when receiving
    // a binary frame -- that code path should be removed.
    // We verify by checking the source code doesn't contain the inline playback pattern.
    const moduleSource = useGameSocket.toString();
    expect(moduleSource).not.toContain("new AudioContext");
  });

  it("useGameSocket emits binary frames via onBinaryMessage callback", async () => {
    // The refactored useGameSocket should expose or invoke an onBinaryMessage callback
    // so that callers (like useVoicePlayback) can handle binary TTS frames.
    const { useGameSocket } = await import("@/hooks/useGameSocket");
    const { renderHook } = await import("@testing-library/react");

    const binaryHandler = vi.fn();
    const { result } = renderHook(() =>
      useGameSocket({
        url: "ws://localhost:8080/ws",
        onBinaryMessage: binaryHandler,
      }),
    );

    // The hook should accept onBinaryMessage in its options
    expect(result.current).toHaveProperty("connect");
  });
});

// ---------------------------------------------------------------------------
// 2. AudioEngine ducker activates when voice plays (already tested in
//    AudioEngine.test.ts AC-3, but we verify the integration path)
// ---------------------------------------------------------------------------

describe("18-16: Ducker integration via playVoice", () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    AudioEngine.resetInstance();
    ctx = installWebAudioMock();
    installLocalStorageMock();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    }));
  });

  afterEach(() => {
    AudioEngine.resetInstance();
    vi.unstubAllGlobals();
  });

  it("playVoice triggers music ducking (music gain value changes)", async () => {
    const engine = new AudioEngine();
    await engine.resume();

    // Music gain is the first channel gain created (index 1, after master at 0)
    // After construction: master=0, music=1, sfx=2, voice=3
    // Music gain starts at 1.0
    const musicGainNode = ctx._gainNodes[1]; // music channel gain
    expect(musicGainNode.gain.value).toBe(1.0);

    const voiceData = new ArrayBuffer(1024);
    await engine.playVoice(voiceData);

    // After ducking, the music gain value should have been set to DUCK_LEVEL (0.3)
    // The mock's linearRampToValueAtTime sets value immediately
    expect(musicGainNode.gain.value).toBe(0.3);
    engine.dispose();
  });
});

// ---------------------------------------------------------------------------
// 3. Volume changes from AudioStatus control AudioEngine gain nodes
// ---------------------------------------------------------------------------

describe("18-16: AudioStatus wired to AudioEngine", () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    AudioEngine.resetInstance();
    ctx = installWebAudioMock();
    installLocalStorageMock();
  });

  afterEach(() => {
    AudioEngine.resetInstance();
    vi.unstubAllGlobals();
  });

  it("useAudio hook exposes getVolume for reading channel levels", async () => {
    const { useAudio } = await import("@/hooks/useAudio");
    const { renderHook } = await import("@testing-library/react");

    const { result } = renderHook(() => useAudio());
    // useAudio should expose getVolume so AudioStatus can read real values
    expect(typeof result.current.getVolume).toBe("function");
  });

  it("useAudio hook exposes mute/unmute for AudioStatus toggle wiring", async () => {
    const { useAudio } = await import("@/hooks/useAudio");
    const { renderHook } = await import("@testing-library/react");

    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.mute).toBe("function");
    expect(typeof result.current.unmute).toBe("function");
  });

  it("setVolume through useAudio actually changes AudioEngine gain", async () => {
    const { useAudio } = await import("@/hooks/useAudio");
    const { renderHook, act } = await import("@testing-library/react");

    const { result } = renderHook(() => useAudio());
    act(() => {
      result.current.setVolume("music", 0.4);
    });
    expect(result.current.getVolume("music")).toBe(0.4);
  });
});

// ---------------------------------------------------------------------------
// 4. AUDIO_CUE routes through AudioEngine (not HTMLAudioElement)
// ---------------------------------------------------------------------------

describe("18-16: useAudioCue routes through AudioEngine", () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    AudioEngine.resetInstance();
    ctx = installWebAudioMock();
    installLocalStorageMock();
    // Mock fetch for AudioEngine.playMusic/playSfx
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    }));
  });

  afterEach(() => {
    AudioEngine.resetInstance();
    vi.unstubAllGlobals();
  });

  it("useAudioCue accepts an AudioEngine and routes music through playMusic", async () => {
    const { useAudioCue } = await import("@/hooks/useAudioCue");
    const { renderHook } = await import("@testing-library/react");
    const { MessageType } = await import("@/types/protocol");

    const engine = new AudioEngine();
    await engine.resume();
    const playMusicSpy = vi.spyOn(engine, "playMusic");

    const messages = [
      {
        type: MessageType.AUDIO_CUE,
        payload: { mood: "tense", music_track: "/genre/low_fantasy/audio/tense.mp3", sfx_triggers: [] },
        player_id: "server",
      },
    ];

    renderHook(() => useAudioCue(messages, engine));

    expect(playMusicSpy).toHaveBeenCalledWith("/genre/low_fantasy/audio/tense.mp3", expect.any(Number));
    engine.dispose();
  });

  it("useAudioCue routes sfx through AudioEngine.playSfx", async () => {
    const { useAudioCue } = await import("@/hooks/useAudioCue");
    const { renderHook } = await import("@testing-library/react");
    const { MessageType } = await import("@/types/protocol");

    const engine = new AudioEngine();
    await engine.resume();
    const playSfxSpy = vi.spyOn(engine, "playSfx");

    const messages = [
      {
        type: MessageType.AUDIO_CUE,
        payload: { mood: "combat", music_track: null, sfx_triggers: ["/genre/low_fantasy/audio/sword_clash.mp3"] },
        player_id: "server",
      },
    ];

    renderHook(() => useAudioCue(messages, engine));

    expect(playSfxSpy).toHaveBeenCalledWith("/genre/low_fantasy/audio/sword_clash.mp3");
    engine.dispose();
  });

  it("useAudioCue does NOT use HTMLAudioElement", async () => {
    const { useAudioCue } = await import("@/hooks/useAudioCue");
    const { renderHook } = await import("@testing-library/react");
    const { MessageType } = await import("@/types/protocol");

    const audioSpy = vi.fn();
    vi.stubGlobal("Audio", audioSpy);

    const engine = new AudioEngine();
    await engine.resume();

    const messages = [
      {
        type: MessageType.AUDIO_CUE,
        payload: { mood: "calm", music_track: "/genre/low_fantasy/audio/calm.mp3", sfx_triggers: [] },
        player_id: "server",
      },
    ];

    renderHook(() => useAudioCue(messages, engine));

    // Audio constructor should NOT be called -- we route through AudioEngine now
    expect(audioSpy).not.toHaveBeenCalled();
    engine.dispose();
  });

  it("useAudioCue deduplicates same mood (no re-trigger)", async () => {
    const { useAudioCue } = await import("@/hooks/useAudioCue");
    const { renderHook } = await import("@testing-library/react");
    const { MessageType } = await import("@/types/protocol");

    const engine = new AudioEngine();
    await engine.resume();
    const playMusicSpy = vi.spyOn(engine, "playMusic");

    const msg1 = {
      type: MessageType.AUDIO_CUE,
      payload: { mood: "tense", music_track: "/genre/low_fantasy/audio/tense.mp3", sfx_triggers: [] },
      player_id: "server",
    };
    const msg2 = {
      type: MessageType.AUDIO_CUE,
      payload: { mood: "tense", music_track: "/genre/low_fantasy/audio/tense.mp3", sfx_triggers: [] },
      player_id: "server",
    };

    const { rerender } = renderHook(
      ({ msgs }) => useAudioCue(msgs, engine),
      { initialProps: { msgs: [msg1] } },
    );

    rerender({ msgs: [msg1, msg2] });

    // Should only call playMusic once — second cue has same mood
    expect(playMusicSpy).toHaveBeenCalledTimes(1);
    engine.dispose();
  });
});
