import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createMockAudioContext,
  createMockAudioBuffer,
  type MockAudioContext,
  type MockGainNode,
} from "./web-audio-mock";

// ---------------------------------------------------------------------------
// Module under test — does not exist yet (RED phase)
// ---------------------------------------------------------------------------
import { Crossfader } from "@/audio/Crossfader";

describe("Crossfader", () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    ctx = createMockAudioContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // AC-2: Music crossfade transitions smoothly
  // -----------------------------------------------------------------------

  describe("AC-2: crossfade transitions", () => {
    it("crossfade creates a new source node and starts playback", async () => {
      const crossfader = new Crossfader();
      const buffer = createMockAudioBuffer(10);
      const targetGain = ctx.createGain() as unknown as GainNode;

      await crossfader.crossfade(
        ctx as unknown as AudioContext,
        buffer as unknown as AudioBuffer,
        targetGain,
        1000,
      );

      expect(ctx._sourceNodes.length).toBeGreaterThanOrEqual(1);
      expect(ctx._sourceNodes[0].start).toHaveBeenCalled();
    });

    it("crossfade ramps old gain to 0", async () => {
      const crossfader = new Crossfader();
      const buffer1 = createMockAudioBuffer(10);
      const buffer2 = createMockAudioBuffer(10);
      const targetGain = ctx.createGain() as unknown as GainNode;

      // First track
      await crossfader.crossfade(
        ctx as unknown as AudioContext,
        buffer1 as unknown as AudioBuffer,
        targetGain,
        1000,
      );

      // Second track — should crossfade from first
      await crossfader.crossfade(
        ctx as unknown as AudioContext,
        buffer2 as unknown as AudioBuffer,
        targetGain,
        1000,
      );

      // At least one gain node should have been ramped to 0
      const allRamps = ctx._gainNodes.flatMap((n) =>
        (n.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls,
      );
      const rampedToZero = allRamps.some(([value]: [number]) => value === 0);
      expect(rampedToZero).toBe(true);
    });

    it("crossfade ramps new gain from 0 to 1", async () => {
      const crossfader = new Crossfader();
      const buffer = createMockAudioBuffer(10);
      const targetGain = ctx.createGain() as unknown as GainNode;

      await crossfader.crossfade(
        ctx as unknown as AudioContext,
        buffer as unknown as AudioBuffer,
        targetGain,
        1000,
      );

      // New gain should start at 0 and ramp to 1
      const allSetCalls = ctx._gainNodes.flatMap((n) =>
        (n.gain.setValueAtTime as ReturnType<typeof vi.fn>).mock.calls,
      );
      const allRamps = ctx._gainNodes.flatMap((n) =>
        (n.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls,
      );

      const startedAtZero = allSetCalls.some(([value]: [number]) => value === 0);
      const rampedToOne = allRamps.some(([value]: [number]) => value === 1);

      expect(startedAtZero).toBe(true);
      expect(rampedToOne).toBe(true);
    });

    it("uses specified fade duration in ramp scheduling", async () => {
      const crossfader = new Crossfader();
      const buffer = createMockAudioBuffer(10);
      const targetGain = ctx.createGain() as unknown as GainNode;

      const fadeMs = 2000;
      const fadeSec = fadeMs / 1000;

      await crossfader.crossfade(
        ctx as unknown as AudioContext,
        buffer as unknown as AudioBuffer,
        targetGain,
        fadeMs,
      );

      // The ramp target time should incorporate fadeMs (2 seconds from currentTime)
      const allRamps = ctx._gainNodes.flatMap((n) =>
        (n.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls,
      );
      const hasCorrectTiming = allRamps.some(
        ([_value, time]: [number, number]) =>
          Math.abs(time - (ctx.currentTime + fadeSec)) < 0.01,
      );
      expect(hasCorrectTiming).toBe(true);
    });

    it("defaults to 3000ms fade when no duration specified", async () => {
      const crossfader = new Crossfader();
      const buffer = createMockAudioBuffer(10);
      const targetGain = ctx.createGain() as unknown as GainNode;

      await crossfader.crossfade(
        ctx as unknown as AudioContext,
        buffer as unknown as AudioBuffer,
        targetGain,
      );

      const allRamps = ctx._gainNodes.flatMap((n) =>
        (n.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls,
      );
      const hasDefaultTiming = allRamps.some(
        ([_value, time]: [number, number]) =>
          Math.abs(time - (ctx.currentTime + 3)) < 0.01,
      );
      expect(hasDefaultTiming).toBe(true);
    });

    it("disconnects old source after crossfade", async () => {
      const crossfader = new Crossfader();
      const buffer1 = createMockAudioBuffer(10);
      const buffer2 = createMockAudioBuffer(10);
      const targetGain = ctx.createGain() as unknown as GainNode;

      await crossfader.crossfade(
        ctx as unknown as AudioContext,
        buffer1 as unknown as AudioBuffer,
        targetGain,
        100,
      );

      const firstSource = ctx._sourceNodes[0];

      await crossfader.crossfade(
        ctx as unknown as AudioContext,
        buffer2 as unknown as AudioBuffer,
        targetGain,
        100,
      );

      // Old source should eventually be stopped
      // Trigger the onended callback to simulate fade completion
      if (firstSource.onended) firstSource._triggerEnded();
      expect(firstSource.stop).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe("Edge cases", () => {
    it("first crossfade with no previous track does not error", async () => {
      const crossfader = new Crossfader();
      const buffer = createMockAudioBuffer(10);
      const targetGain = ctx.createGain() as unknown as GainNode;

      await expect(
        crossfader.crossfade(
          ctx as unknown as AudioContext,
          buffer as unknown as AudioBuffer,
          targetGain,
          1000,
        ),
      ).resolves.not.toThrow();
    });

    it("stop() without any playing track does not error", () => {
      const crossfader = new Crossfader();
      expect(() => crossfader.stop()).not.toThrow();
    });
  });
});
