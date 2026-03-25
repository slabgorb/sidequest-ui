import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for AudioCache — decoded AudioBuffer caching.
 *
 * Story 57-8 AC mapping:
 *   AC-4: Audio cache avoids redundant fetches
 */

describe("AudioCache", () => {
  let AudioCache: typeof import("@/audio/AudioCache").AudioCache;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/audio/AudioCache");
    AudioCache = mod.AudioCache;
  });

  it("fetches and decodes audio on first request", async () => {
    const mockBuffer = {} as AudioBuffer;
    const mockCtx = {
      decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
    } as unknown as AudioContext;

    const mockResponse = {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const cache = new AudioCache();
    const result = await cache.getBuffer(mockCtx, "/audio/tense_01.mp3");

    expect(result).toBe(mockBuffer);
    expect(fetch).toHaveBeenCalledWith("/audio/tense_01.mp3");
    expect(mockCtx.decodeAudioData).toHaveBeenCalled();
  });

  it("returns cached buffer on second request without re-fetching", async () => {
    const mockBuffer = {} as AudioBuffer;
    const mockCtx = {
      decodeAudioData: vi.fn().mockResolvedValue(mockBuffer),
    } as unknown as AudioContext;

    const mockResponse = {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const cache = new AudioCache();

    const result1 = await cache.getBuffer(mockCtx, "/audio/tense_01.mp3");
    const result2 = await cache.getBuffer(mockCtx, "/audio/tense_01.mp3");

    // Same buffer returned
    expect(result1).toBe(result2);

    // fetch called only once
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fetches different URLs independently", async () => {
    const buffer1 = { id: 1 } as unknown as AudioBuffer;
    const buffer2 = { id: 2 } as unknown as AudioBuffer;
    const mockCtx = {
      decodeAudioData: vi
        .fn()
        .mockResolvedValueOnce(buffer1)
        .mockResolvedValueOnce(buffer2),
    } as unknown as AudioContext;

    const mockResponse = {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const cache = new AudioCache();

    const r1 = await cache.getBuffer(mockCtx, "/audio/tense_01.mp3");
    const r2 = await cache.getBuffer(mockCtx, "/audio/exploration_01.mp3");

    expect(r1).toBe(buffer1);
    expect(r2).toBe(buffer2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
