/**
 * Story 15-3: AudioEngine voice playback lifecycle hooks.
 *
 * AudioEngine needs to expose voice playback state so external consumers
 * (mic gating, UI indicators) can react to TTS start/end events.
 *
 * Currently missing: isVoicePlaying, onVoicePlaybackChange callback.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "../AudioEngine";
import {
  installWebAudioMock,
  installLocalStorageMock,
  type MockAudioContext,
} from "./web-audio-mock";

describe("AudioEngine voice playback lifecycle (Story 15-3)", () => {
  let ctx: MockAudioContext;
  let engine: AudioEngine;

  beforeEach(() => {
    ctx = installWebAudioMock();
    installLocalStorageMock();
    AudioEngine.resetInstance();
    engine = AudioEngine.getInstance();
  });

  afterEach(() => {
    engine.dispose();
    AudioEngine.resetInstance();
    vi.restoreAllMocks();
  });

  it("isVoicePlaying is false when no voice is playing", () => {
    expect(engine.isVoicePlaying).toBe(false);
  });

  it("isVoicePlaying becomes true during voice playback", async () => {
    const pcm = new ArrayBuffer(4800); // 100ms at 24kHz, 16-bit
    const s16 = new Int16Array(pcm);
    for (let i = 0; i < s16.length; i++) s16[i] = 1000; // non-empty audio

    engine.playVoicePCM(pcm, 24000);
    // After queueing, voice should be playing
    // Need to tick the microtask queue for the promise chain
    await vi.waitFor(() => {
      expect(engine.isVoicePlaying).toBe(true);
    });
  });

  it("isVoicePlaying returns false after voice segment ends", async () => {
    const pcm = new ArrayBuffer(4800);
    const s16 = new Int16Array(pcm);
    for (let i = 0; i < s16.length; i++) s16[i] = 1000;

    engine.playVoicePCM(pcm, 24000);

    // Simulate the source ending
    const source = ctx._sourceNodes[ctx._sourceNodes.length - 1];
    source._triggerEnded();

    await vi.waitFor(() => {
      expect(engine.isVoicePlaying).toBe(false);
    });
  });

  it("isVoicePlaying stays true across sequential segments", async () => {
    const pcm = new ArrayBuffer(4800);
    const s16 = new Int16Array(pcm);
    for (let i = 0; i < s16.length; i++) s16[i] = 1000;

    // Queue two segments
    engine.playVoicePCM(pcm, 24000);
    engine.playVoicePCM(pcm, 24000);

    // After first segment starts, still playing
    await vi.waitFor(() => {
      expect(engine.isVoicePlaying).toBe(true);
    });

    // End first segment — still playing because second is queued
    const firstSource = ctx._sourceNodes[ctx._sourceNodes.length - 2];
    if (firstSource) firstSource._triggerEnded();

    // Should still be playing (second segment)
    expect(engine.isVoicePlaying).toBe(true);
  });

  it("fires onVoicePlaybackChange callback on start and end", async () => {
    const onChange = vi.fn();
    engine.onVoicePlaybackChange = onChange;

    const pcm = new ArrayBuffer(4800);
    const s16 = new Int16Array(pcm);
    for (let i = 0; i < s16.length; i++) s16[i] = 1000;

    engine.playVoicePCM(pcm, 24000);

    // Should fire with true when voice starts
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(true);
    });

    // End playback
    const source = ctx._sourceNodes[ctx._sourceNodes.length - 1];
    source._triggerEnded();

    // Should fire with false when voice ends
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(false);
    });

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("does not fire onVoicePlaybackChange between sequential segments", async () => {
    const onChange = vi.fn();
    engine.onVoicePlaybackChange = onChange;

    const pcm = new ArrayBuffer(4800);
    const s16 = new Int16Array(pcm);
    for (let i = 0; i < s16.length; i++) s16[i] = 1000;

    // Queue two segments
    engine.playVoicePCM(pcm, 24000);
    engine.playVoicePCM(pcm, 24000);

    // Should fire true once at start
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(true);
    });

    // End first segment — second starts immediately, no false→true bounce
    const firstSource = ctx._sourceNodes[0];
    if (firstSource) firstSource._triggerEnded();

    // End second segment
    await new Promise((r) => setTimeout(r, 10));
    const secondSource = ctx._sourceNodes[1];
    if (secondSource) secondSource._triggerEnded();

    // Should fire false only once at the very end
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(false);
    });

    // Exactly 2 calls: true at start, false at end — no bouncing
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
