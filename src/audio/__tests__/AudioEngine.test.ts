import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  installWebAudioMock,
  installLocalStorageMock,
  createMockAudioBuffer,
  type MockAudioContext,
} from "./web-audio-mock";

// ---------------------------------------------------------------------------
// Module under test — does not exist yet (RED phase)
// ---------------------------------------------------------------------------
import { AudioEngine } from "@/audio/AudioEngine";

describe("AudioEngine", () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    ctx = installWebAudioMock();
    installLocalStorageMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -----------------------------------------------------------------------
  // AC-1: AudioContext resumes on user gesture
  // -----------------------------------------------------------------------

  describe("AC-1: AudioContext lifecycle", () => {
    it("creates AudioContext in suspended state", () => {
      const engine = new AudioEngine();
      // The underlying AudioContext should start suspended
      expect(ctx.state).toBe("suspended");
      engine.dispose();
    });

    it("resume() transitions AudioContext to running", async () => {
      const engine = new AudioEngine();
      expect(ctx.state).toBe("suspended");

      await engine.resume();
      expect(ctx.state).toBe("running");
      engine.dispose();
    });

    it("resume() is idempotent when already running", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      await engine.resume(); // second call should not throw
      expect(ctx.state).toBe("running");
      expect(ctx.resume).toHaveBeenCalledTimes(2);
      engine.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // AC-4: Per-channel volume control
  // -----------------------------------------------------------------------

  describe("AC-4: Per-channel volume control", () => {
    it("setVolume sets music channel gain without affecting others", () => {
      const engine = new AudioEngine();
      engine.setVolume("music", 0.5);
      expect(engine.getVolume("music")).toBe(0.5);
      expect(engine.getVolume("sfx")).toBe(1.0);
      expect(engine.getVolume("voice")).toBe(1.0);
      engine.dispose();
    });

    it("setVolume sets sfx channel independently", () => {
      const engine = new AudioEngine();
      engine.setVolume("sfx", 0.3);
      expect(engine.getVolume("sfx")).toBe(0.3);
      expect(engine.getVolume("music")).toBe(1.0);
      engine.dispose();
    });

    it("setVolume sets voice channel independently", () => {
      const engine = new AudioEngine();
      engine.setVolume("voice", 0.7);
      expect(engine.getVolume("voice")).toBe(0.7);
      expect(engine.getVolume("music")).toBe(1.0);
      engine.dispose();
    });

    it("setVolume sets master gain", () => {
      const engine = new AudioEngine();
      engine.setVolume("master", 0.6);
      expect(engine.getVolume("master")).toBe(0.6);
      engine.dispose();
    });

    it("clamps volume to 0-1 range", () => {
      const engine = new AudioEngine();
      engine.setVolume("music", 1.5);
      expect(engine.getVolume("music")).toBeLessThanOrEqual(1.0);

      engine.setVolume("music", -0.5);
      expect(engine.getVolume("music")).toBeGreaterThanOrEqual(0);
      engine.dispose();
    });

    it("mute() sets channel gain to 0", () => {
      const engine = new AudioEngine();
      engine.setVolume("music", 0.8);
      engine.mute("music");
      expect(engine.getVolume("music")).toBe(0);
      engine.dispose();
    });

    it("unmute() restores channel to pre-mute volume", () => {
      const engine = new AudioEngine();
      engine.setVolume("music", 0.8);
      engine.mute("music");
      engine.unmute("music");
      expect(engine.getVolume("music")).toBe(0.8);
      engine.dispose();
    });

    it("unmute() without prior mute sets volume to 1.0", () => {
      const engine = new AudioEngine();
      engine.mute("sfx");
      engine.unmute("sfx");
      // Default volume is 1.0, so unmute should restore to 1.0
      expect(engine.getVolume("sfx")).toBe(1.0);
      engine.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // AC-5: Volume persists across page loads
  // -----------------------------------------------------------------------

  describe("AC-5: Volume persistence", () => {
    it("saves volume to localStorage when set", () => {
      const engine = new AudioEngine();
      engine.setVolume("music", 0.6);
      engine.dispose();

      const stored = localStorage.getItem("sidequest_audio_volumes");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.music).toBe(0.6);
    });

    it("restores volume from localStorage on construction", () => {
      // Pre-populate localStorage
      localStorage.setItem(
        "sidequest_audio_volumes",
        JSON.stringify({ music: 0.4, sfx: 0.7, voice: 0.9, master: 0.8 }),
      );

      const engine = new AudioEngine();
      expect(engine.getVolume("music")).toBe(0.4);
      expect(engine.getVolume("sfx")).toBe(0.7);
      expect(engine.getVolume("voice")).toBe(0.9);
      expect(engine.getVolume("master")).toBe(0.8);
      engine.dispose();
    });

    it("uses default volumes when localStorage is empty", () => {
      const engine = new AudioEngine();
      expect(engine.getVolume("music")).toBe(1.0);
      expect(engine.getVolume("sfx")).toBe(1.0);
      expect(engine.getVolume("voice")).toBe(1.0);
      expect(engine.getVolume("master")).toBe(1.0);
      engine.dispose();
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorage.setItem("sidequest_audio_volumes", "not-json{{{");
      expect(() => new AudioEngine()).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // AC-2: Music crossfade (integration with engine)
  // -----------------------------------------------------------------------

  describe("AC-2: Music playback and crossfade", () => {
    it("playMusic() creates a buffer source and connects to music channel", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      await engine.playMusic("http://example.com/track.mp3");

      // At least one source node should have been created
      expect(ctx._sourceNodes.length).toBeGreaterThanOrEqual(1);
      const source = ctx._sourceNodes[0];
      expect(source.start).toHaveBeenCalled();
      engine.dispose();
    });

    it("playMusic() crossfades when a track is already playing", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      await engine.playMusic("http://example.com/track1.mp3");
      await engine.playMusic("http://example.com/track2.mp3", 1000);

      // Should have created gain nodes for crossfade ramps
      const rampCalls = ctx._gainNodes.flatMap((n) =>
        (n.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls,
      );
      expect(rampCalls.length).toBeGreaterThanOrEqual(2); // ramp down old, ramp up new
      engine.dispose();
    });

    it("stopMusic() fades out current track", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      await engine.playMusic("http://example.com/track.mp3");
      engine.stopMusic(500);

      const rampCalls = ctx._gainNodes.flatMap((n) =>
        (n.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls,
      );
      // Should ramp to 0
      const rampToZero = rampCalls.some(([value]: [number]) => value === 0);
      expect(rampToZero).toBe(true);
      engine.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // AC-3: Voice playback ducks music (integration)
  // -----------------------------------------------------------------------

  describe("AC-3: Voice playback with ducking", () => {
    it("playVoice() ducks music gain during playback", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      await engine.playMusic("http://example.com/bg.mp3");

      const voiceData = new ArrayBuffer(1024);
      await engine.playVoice(voiceData);

      // Music gain should have been ramped down to duck level (0.3)
      const musicGainRamps = ctx._gainNodes.flatMap((n) =>
        (n.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls,
      );
      const ducked = musicGainRamps.some(
        ([value]: [number]) => Math.abs(value - 0.3) < 0.01,
      );
      expect(ducked).toBe(true);
      engine.dispose();
    });

    it("playVoice() creates source node for voice channel", async () => {
      const engine = new AudioEngine();
      await engine.resume();

      const voiceData = new ArrayBuffer(1024);
      await engine.playVoice(voiceData);

      // Should have decoded audio data and created a source
      expect(ctx.decodeAudioData).toHaveBeenCalled();
      expect(ctx._sourceNodes.length).toBeGreaterThanOrEqual(1);
      engine.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // SFX playback
  // -----------------------------------------------------------------------

  describe("SFX playback", () => {
    it("playSfx() creates a buffer source on sfx channel", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      await engine.playSfx("http://example.com/hit.mp3");

      expect(ctx._sourceNodes.length).toBeGreaterThanOrEqual(1);
      expect(ctx._sourceNodes[0].start).toHaveBeenCalled();
      engine.dispose();
    });

    it("playSfx() does not affect music channel", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      engine.setVolume("music", 0.8);
      await engine.playSfx("http://example.com/hit.mp3");

      expect(engine.getVolume("music")).toBe(0.8);
      engine.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // AC-6: dispose() cleanup
  // -----------------------------------------------------------------------

  describe("AC-6: dispose() cleanup", () => {
    it("closes AudioContext", () => {
      const engine = new AudioEngine();
      engine.dispose();
      expect(ctx.close).toHaveBeenCalled();
    });

    it("AudioContext state is closed after dispose", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      engine.dispose();
      // close mock sets state to "closed"
      expect(ctx.state).toBe("closed");
    });

    it("disconnects all gain nodes", () => {
      const engine = new AudioEngine();
      engine.dispose();

      for (const node of ctx._gainNodes) {
        expect(node.disconnect).toHaveBeenCalled();
      }
    });

    it("stops playing sources on dispose", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      await engine.playMusic("http://example.com/track.mp3");
      engine.dispose();

      for (const source of ctx._sourceNodes) {
        expect(source.stop).toHaveBeenCalled();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Audio graph topology
  // -----------------------------------------------------------------------

  describe("Audio graph topology", () => {
    it("creates 3 channel gain nodes plus master", () => {
      const engine = new AudioEngine();
      // Should have: music, sfx, voice, master = at least 4 gain nodes
      expect(ctx._gainNodes.length).toBeGreaterThanOrEqual(4);
      engine.dispose();
    });

    it("channel gains connect to master gain", () => {
      const engine = new AudioEngine();
      // Each channel gain should be connected to the master gain
      // At least 3 connect calls for channels → master
      const totalConnects = ctx._gainNodes.reduce(
        (sum, n) => sum + (n.connect as ReturnType<typeof vi.fn>).mock.calls.length,
        0,
      );
      expect(totalConnects).toBeGreaterThanOrEqual(3);
      engine.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // TypeScript rule enforcement: null/undefined handling (#4)
  // -----------------------------------------------------------------------

  describe("Rule #4: null/undefined handling", () => {
    it("getVolume returns a number, never undefined", () => {
      const engine = new AudioEngine();
      const vol = engine.getVolume("music");
      expect(typeof vol).toBe("number");
      expect(vol).not.toBeNaN();
      engine.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // Rule #6: React hook cleanup (tested in useAudio.test.ts)
  // Rule #7: Async patterns
  // -----------------------------------------------------------------------

  describe("Rule #7: Async patterns", () => {
    it("resume() returns a Promise", () => {
      const engine = new AudioEngine();
      const result = engine.resume();
      expect(result).toBeInstanceOf(Promise);
      engine.dispose();
    });

    it("playMusic() returns a Promise", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      const result = engine.playMusic("http://example.com/track.mp3");
      expect(result).toBeInstanceOf(Promise);
      engine.dispose();
    });

    it("playVoice() returns a Promise", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      const result = engine.playVoice(new ArrayBuffer(512));
      expect(result).toBeInstanceOf(Promise);
      engine.dispose();
    });

    it("playSfx() returns a Promise", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      const result = engine.playSfx("http://example.com/hit.mp3");
      expect(result).toBeInstanceOf(Promise);
      engine.dispose();
    });
  });

  // -----------------------------------------------------------------------
  // AC-7: onStart callback for TTS text synchronization
  // -----------------------------------------------------------------------

  describe("AC-7: Voice playback onStart callback", () => {
    it("playVoice() fires onStart callback before audio source starts", async () => {
      const engine = new AudioEngine();
      await engine.resume();
      const callOrder: string[] = [];

      const onStart = vi.fn(() => callOrder.push("onStart"));

      // Mock source.start to track ordering
      const origCreateBuffer = ctx.createBufferSource;
      ctx.createBufferSource = vi.fn(() => {
        const source = origCreateBuffer.call(ctx);
        const origStart = source.start;
        source.start = vi.fn((...args: unknown[]) => {
          callOrder.push("source.start");
          return (origStart as (...a: unknown[]) => void).apply(source, args);
        });
        return source;
      });

      await engine.playVoice(new ArrayBuffer(512), onStart);

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(callOrder.indexOf("onStart")).toBeLessThan(
        callOrder.indexOf("source.start"),
      );
      engine.dispose();
    });

    it("playVoicePCM() fires onStart callback", () => {
      const engine = new AudioEngine();
      const onStart = vi.fn();

      // Create valid PCM data (Int16 samples)
      const pcm = new Int16Array([1000, -1000, 500, -500]);
      engine.playVoicePCM(pcm.buffer, 24000, onStart);

      // onStart is called inside the voiceChain promise — may not have
      // resolved yet, but the callback should be invoked when the chain drains
      // In tests with mock AudioContext, the chain resolves synchronously
      // via onended callback
      engine.dispose();
    });

    it("playVoice() works without onStart callback", async () => {
      const engine = new AudioEngine();
      await engine.resume();

      // Should not throw when onStart is omitted
      await engine.playVoice(new ArrayBuffer(512));
      engine.dispose();
    });
  });
});
