import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createMockAudioContext,
  type MockAudioContext,
  type MockGainNode,
} from "./web-audio-mock";

// ---------------------------------------------------------------------------
// Module under test — does not exist yet (RED phase)
// ---------------------------------------------------------------------------
import { Ducker } from "@/audio/Ducker";

describe("Ducker", () => {
  let ctx: MockAudioContext;
  let musicGain: MockGainNode;

  beforeEach(() => {
    ctx = createMockAudioContext();
    musicGain = ctx.createGain();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // AC-3: Voice playback ducks music automatically
  // -----------------------------------------------------------------------

  describe("AC-3: duck/unduck behavior", () => {
    it("duck() ramps music gain to 0.3", () => {
      const ducker = new Ducker(musicGain as unknown as GainNode);
      ducker.duck();

      expect(musicGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0.3,
        expect.any(Number),
      );
    });

    it("duck() completes within 200ms", () => {
      const ducker = new Ducker(musicGain as unknown as GainNode);
      ducker.duck();

      const rampCalls = (
        musicGain.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>
      ).mock.calls;
      expect(rampCalls.length).toBeGreaterThanOrEqual(1);

      // The ramp target time should be currentTime + 0.2 (200ms)
      const [_value, time] = rampCalls[0];
      const expectedTime = ctx.currentTime + 0.2;
      expect(Math.abs(time - expectedTime)).toBeLessThan(0.01);
    });

    it("unduck() ramps music gain back to 1.0", () => {
      const ducker = new Ducker(musicGain as unknown as GainNode);
      ducker.duck();
      ducker.unduck();

      const rampCalls = (
        musicGain.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>
      ).mock.calls;

      // Should have at least 2 calls: duck (to 0.3) and unduck (to 1.0)
      expect(rampCalls.length).toBeGreaterThanOrEqual(2);

      // Last call should be ramping to 1.0
      const lastCall = rampCalls[rampCalls.length - 1];
      expect(lastCall[0]).toBe(1.0);
    });

    it("unduck() completes within 500ms", () => {
      const ducker = new Ducker(musicGain as unknown as GainNode);
      ducker.duck();
      ducker.unduck();

      const rampCalls = (
        musicGain.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>
      ).mock.calls;

      // The unduck ramp (last call) should target currentTime + 0.5
      const lastCall = rampCalls[rampCalls.length - 1];
      const expectedTime = ctx.currentTime + 0.5;
      expect(Math.abs(lastCall[1] - expectedTime)).toBeLessThan(0.01);
    });

    it("duck level defaults to 0.3", () => {
      const ducker = new Ducker(musicGain as unknown as GainNode);
      ducker.duck();

      const rampCalls = (
        musicGain.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>
      ).mock.calls;
      expect(rampCalls[0][0]).toBe(0.3);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe("Edge cases", () => {
    it("double duck() does not stack — gain stays at duck level", () => {
      const ducker = new Ducker(musicGain as unknown as GainNode);
      ducker.duck();
      ducker.duck();

      // The value should still be 0.3, not 0.3 * 0.3
      expect(musicGain.gain.value).toBeCloseTo(0.3, 1);
    });

    it("unduck() without prior duck() does not crash", () => {
      const ducker = new Ducker(musicGain as unknown as GainNode);
      expect(() => ducker.unduck()).not.toThrow();
    });

    it("duck cancels pending scheduled values before ramping", () => {
      const ducker = new Ducker(musicGain as unknown as GainNode);
      ducker.duck();

      expect(musicGain.gain.cancelScheduledValues).toHaveBeenCalled();
    });

    it("unduck cancels pending scheduled values before ramping", () => {
      const ducker = new Ducker(musicGain as unknown as GainNode);
      ducker.duck();

      // Reset to check unduck specifically
      (musicGain.gain.cancelScheduledValues as ReturnType<typeof vi.fn>).mockClear();

      ducker.unduck();
      expect(musicGain.gain.cancelScheduledValues).toHaveBeenCalled();
    });
  });
});
