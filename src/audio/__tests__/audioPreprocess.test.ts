import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for audioToFloat32 — audio preprocessing for Whisper.
 *
 * Story 57-9 AC mapping:
 *   AC-4: Audio preprocessed to 16kHz Float32Array
 */

describe("audioToFloat32", () => {
  let audioToFloat32: typeof import("@/audio/audioPreprocess").audioToFloat32;

  beforeEach(async () => {
    vi.resetModules();

    // Mock OfflineAudioContext
    const mockChannelData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const mockRenderedBuffer = {
      getChannelData: vi.fn().mockReturnValue(mockChannelData),
      duration: 0.00025, // ~4 samples at 16kHz
    };
    const mockDecodedBuffer = {
      duration: 0.00025,
      sampleRate: 48000,
    };

    const MockOfflineAudioContext = vi.fn().mockImplementation(function () {
      return {
        decodeAudioData: vi.fn().mockResolvedValue(mockDecodedBuffer),
        createBufferSource: vi.fn().mockReturnValue({
          buffer: null,
          connect: vi.fn(),
          start: vi.fn(),
        }),
        destination: {},
        startRendering: vi.fn().mockResolvedValue(mockRenderedBuffer),
      };
    });

    vi.stubGlobal("OfflineAudioContext", MockOfflineAudioContext);

    const mod = await import("@/audio/audioPreprocess");
    audioToFloat32 = mod.audioToFloat32;
  });

  it("converts audio Blob to Float32Array", async () => {
    const blob = new Blob([new ArrayBuffer(100)], { type: "audio/webm" });
    const result = await audioToFloat32(blob);

    expect(result).toBeInstanceOf(Float32Array);
  });

  it("returns non-empty Float32Array for valid input", async () => {
    const blob = new Blob([new ArrayBuffer(100)], { type: "audio/webm" });
    const result = await audioToFloat32(blob);

    expect(result.length).toBeGreaterThan(0);
  });

  it("uses 16kHz target sample rate by default", async () => {
    const blob = new Blob([new ArrayBuffer(100)], { type: "audio/webm" });
    await audioToFloat32(blob);

    // OfflineAudioContext should have been called with 16000
    const calls = (globalThis.OfflineAudioContext as any).mock.calls;
    const sampleRates = calls.map((c: any[]) => c[2]);
    expect(sampleRates).toContain(16000);
  });
});
