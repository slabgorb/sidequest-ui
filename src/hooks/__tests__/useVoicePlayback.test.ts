import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  decodeVoiceFrame,
  pcmToAudioBuffer,
  type VoiceAudioHeader,
} from "@/hooks/useVoicePlayback";

// ---------------------------------------------------------------------------
// Helpers: build binary VOICE_AUDIO frames
// ---------------------------------------------------------------------------

function buildVoiceFrame(
  header: VoiceAudioHeader,
  audioData: Float32Array,
): ArrayBuffer {
  const headerJson = JSON.stringify(header);
  const headerBytes = new TextEncoder().encode(headerJson);
  const headerLen = headerBytes.byteLength;

  // 4 bytes for header length (uint32 big-endian) + header + audio
  const frame = new ArrayBuffer(4 + headerLen + audioData.byteLength);
  const view = new DataView(frame);
  view.setUint32(0, headerLen, false); // big-endian

  const frameBytes = new Uint8Array(frame);
  frameBytes.set(headerBytes, 4);
  frameBytes.set(new Uint8Array(audioData.buffer), 4 + headerLen);

  return frame;
}

function makeVoiceHeader(overrides: Partial<VoiceAudioHeader> = {}): VoiceAudioHeader {
  return {
    type: "VOICE_AUDIO",
    segment_id: "seg-001",
    format: "pcm_f32le",
    sample_rate: 24000,
    ...overrides,
  };
}

/** Generate a short sine wave as Float32Array (mono PCM). */
function makeSineWave(samples: number = 480, frequency: number = 440, sampleRate: number = 24000): Float32Array {
  const data = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    data[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Mock AudioContext for pcmToAudioBuffer tests
// ---------------------------------------------------------------------------

class MockAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  channelData: Float32Array[];

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channelData = Array.from({ length: channels }, () => new Float32Array(length));
  }

  copyToChannel(source: Float32Array, channel: number): void {
    this.channelData[channel].set(source);
  }

  getChannelData(channel: number): Float32Array {
    return this.channelData[channel];
  }
}

function createMockAudioContext(): AudioContext {
  return {
    createBuffer(channels: number, length: number, sampleRate: number) {
      return new MockAudioBuffer(channels, length, sampleRate);
    },
  } as unknown as AudioContext;
}

// ---------------------------------------------------------------------------
// AC-1: Binary VOICE_AUDIO frame decodes correctly
// ---------------------------------------------------------------------------

describe("decodeVoiceFrame", () => {
  it("decodes header fields from a valid binary frame", () => {
    const header = makeVoiceHeader({ segment_id: "seg-042" });
    const audio = makeSineWave(100);
    const frame = buildVoiceFrame(header, audio);

    const result = decodeVoiceFrame(frame);

    expect(result.header.type).toBe("VOICE_AUDIO");
    expect(result.header.segment_id).toBe("seg-042");
    expect(result.header.format).toBe("pcm_f32le");
    expect(result.header.sample_rate).toBe(24000);
  });

  it("extracts audio data with correct byte length", () => {
    const audio = makeSineWave(256);
    const frame = buildVoiceFrame(makeVoiceHeader(), audio);

    const result = decodeVoiceFrame(frame);

    // Float32Array: 4 bytes per sample
    expect(result.audioData.byteLength).toBe(256 * 4);
  });

  it("preserves audio sample values through decode", () => {
    const audio = makeSineWave(10);
    const frame = buildVoiceFrame(makeVoiceHeader(), audio);

    const result = decodeVoiceFrame(frame);
    const decoded = new Float32Array(result.audioData);

    for (let i = 0; i < audio.length; i++) {
      expect(decoded[i]).toBeCloseTo(audio[i], 5);
    }
  });

  it("handles empty audio data (header-only frame)", () => {
    const emptyAudio = new Float32Array(0);
    const frame = buildVoiceFrame(makeVoiceHeader(), emptyAudio);

    const result = decodeVoiceFrame(frame);

    expect(result.header.type).toBe("VOICE_AUDIO");
    expect(result.audioData.byteLength).toBe(0);
  });

  it("handles large header with extra fields gracefully", () => {
    const header = {
      ...makeVoiceHeader(),
      extra_field: "some-extra-data",
      another: 12345,
    } as VoiceAudioHeader;
    const audio = makeSineWave(10);
    const frame = buildVoiceFrame(header, audio);

    const result = decodeVoiceFrame(frame);

    expect(result.header.type).toBe("VOICE_AUDIO");
    expect(result.header.sample_rate).toBe(24000);
  });

  // Rule #10: type-level input validation — malformed frames must not crash
  it("throws on frame too short to contain header length", () => {
    const truncated = new ArrayBuffer(2); // Less than 4 bytes

    expect(() => decodeVoiceFrame(truncated)).toThrow();
  });

  it("throws when header length exceeds frame size", () => {
    const frame = new ArrayBuffer(8);
    const view = new DataView(frame);
    view.setUint32(0, 9999, false); // header claims 9999 bytes, frame is only 8

    expect(() => decodeVoiceFrame(frame)).toThrow();
  });

  it("throws on invalid JSON in header", () => {
    // Build a frame with garbage bytes where JSON should be
    const garbage = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc, 0xfb]);
    const frame = new ArrayBuffer(4 + garbage.length);
    const view = new DataView(frame);
    view.setUint32(0, garbage.length, false);
    new Uint8Array(frame).set(garbage, 4);

    expect(() => decodeVoiceFrame(frame)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-2: PCM audio plays through voice channel (AudioBuffer conversion)
// ---------------------------------------------------------------------------

describe("pcmToAudioBuffer", () => {
  let ctx: AudioContext;

  beforeEach(() => {
    ctx = createMockAudioContext();
  });

  it("creates an AudioBuffer with correct sample rate", () => {
    const pcm = makeSineWave(480);
    const buffer = pcmToAudioBuffer(ctx, pcm.buffer as ArrayBuffer, 24000);

    expect(buffer.sampleRate).toBe(24000);
  });

  it("creates a mono AudioBuffer (1 channel)", () => {
    const pcm = makeSineWave(480);
    const buffer = pcmToAudioBuffer(ctx, pcm.buffer as ArrayBuffer, 24000);

    expect(buffer.numberOfChannels).toBe(1);
  });

  it("creates buffer with correct sample count", () => {
    const pcm = makeSineWave(1024);
    const buffer = pcmToAudioBuffer(ctx, pcm.buffer as ArrayBuffer, 24000);

    expect(buffer.length).toBe(1024);
  });

  it("copies PCM samples to channel 0", () => {
    const pcm = makeSineWave(10);
    const buffer = pcmToAudioBuffer(ctx, pcm.buffer as ArrayBuffer, 24000);

    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) {
      expect(channelData[i]).toBeCloseTo(pcm[i], 5);
    }
  });

  it("handles different sample rates", () => {
    const pcm = makeSineWave(100);
    const buffer = pcmToAudioBuffer(ctx, pcm.buffer as ArrayBuffer, 48000);

    expect(buffer.sampleRate).toBe(48000);
    expect(buffer.length).toBe(100);
  });

  it("handles empty PCM data", () => {
    const empty = new Float32Array(0);
    const buffer = pcmToAudioBuffer(ctx, empty.buffer as ArrayBuffer, 24000);

    expect(buffer.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Music ducks during voice playback
// AC-4: Multiple segments queue and play sequentially
// These test the AudioEngine's voice queue behavior.
// Since AudioEngine is from 57-6 (not yet built), we test the queue logic
// that THIS story adds: VoiceQueue class.
// ---------------------------------------------------------------------------

import { VoiceQueue } from "@/hooks/useVoicePlayback";

describe("VoiceQueue", () => {
  let playedSegments: ArrayBuffer[];
  let duckCalls: string[];
  let playFn: (data: ArrayBuffer) => Promise<void>;
  let duckFn: () => void;
  let unduckFn: () => void;
  let queue: InstanceType<typeof VoiceQueue>;

  beforeEach(() => {
    playedSegments = [];
    duckCalls = [];

    playFn = vi.fn(async (data: ArrayBuffer) => {
      playedSegments.push(data);
      // Simulate playback duration
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    duckFn = vi.fn(() => duckCalls.push("duck"));
    unduckFn = vi.fn(() => duckCalls.push("unduck"));

    queue = new VoiceQueue(playFn, duckFn, unduckFn);
  });

  // AC-4: segments queue sequentially
  it("plays segments in FIFO order", async () => {
    const seg1 = makeSineWave(100).buffer as ArrayBuffer;
    const seg2 = makeSineWave(200).buffer as ArrayBuffer;
    const seg3 = makeSineWave(300).buffer as ArrayBuffer;

    // Enqueue all three rapidly
    const p1 = queue.enqueue(seg1);
    const p2 = queue.enqueue(seg2);
    const p3 = queue.enqueue(seg3);

    await Promise.all([p1, p2, p3]);

    expect(playedSegments).toHaveLength(3);
    expect(playedSegments[0].byteLength).toBe(100 * 4);
    expect(playedSegments[1].byteLength).toBe(200 * 4);
    expect(playedSegments[2].byteLength).toBe(300 * 4);
  });

  // AC-4: no overlapping playback
  it("does not start segment N+1 until segment N finishes", async () => {
    const order: string[] = [];

    const slowPlayFn = vi.fn(async () => {
      order.push("start");
      await new Promise((resolve) => setTimeout(resolve, 50));
      order.push("end");
    });

    const slowQueue = new VoiceQueue(slowPlayFn, duckFn, unduckFn);

    const seg1 = makeSineWave(10).buffer as ArrayBuffer;
    const seg2 = makeSineWave(10).buffer as ArrayBuffer;

    const p1 = slowQueue.enqueue(seg1);
    const p2 = slowQueue.enqueue(seg2);

    await Promise.all([p1, p2]);

    // Pattern must be: start, end, start, end — never start, start
    expect(order).toEqual(["start", "end", "start", "end"]);
  });

  // AC-3: duck at start, unduck at end
  it("ducks music when first segment starts and unducks after last finishes", async () => {
    const seg1 = makeSineWave(10).buffer as ArrayBuffer;
    const seg2 = makeSineWave(10).buffer as ArrayBuffer;

    const p1 = queue.enqueue(seg1);
    const p2 = queue.enqueue(seg2);

    await Promise.all([p1, p2]);

    // Should duck once at start, unduck once at end — not duck-unduck-duck-unduck
    expect(duckCalls).toEqual(["duck", "unduck"]);
  });

  // AC-3: stays ducked across multi-segment sequence
  it("stays ducked for entire multi-segment sequence", async () => {
    const segments = Array.from({ length: 5 }, (_, i) =>
      makeSineWave(10 + i).buffer as ArrayBuffer,
    );

    const promises = segments.map((seg) => queue.enqueue(seg));
    await Promise.all(promises);

    // Exactly one duck at start and one unduck at end
    const ducks = duckCalls.filter((c) => c === "duck");
    const unducks = duckCalls.filter((c) => c === "unduck");
    expect(ducks).toHaveLength(1);
    expect(unducks).toHaveLength(1);
  });

  it("unducks even if a segment playback throws", async () => {
    const failPlayFn = vi.fn(async () => {
      throw new Error("playback failed");
    });

    const failQueue = new VoiceQueue(failPlayFn, duckFn, unduckFn);
    const seg = makeSineWave(10).buffer as ArrayBuffer;

    // Should not throw out of enqueue
    await failQueue.enqueue(seg);

    // Unduck must still be called for cleanup
    expect(duckCalls).toContain("unduck");
  });

  it("handles single segment without queueing issues", async () => {
    const seg = makeSineWave(100).buffer as ArrayBuffer;

    await queue.enqueue(seg);

    expect(playedSegments).toHaveLength(1);
    expect(duckCalls).toEqual(["duck", "unduck"]);
  });

  it("resets to idle after queue drains completely", async () => {
    const seg = makeSineWave(10).buffer as ArrayBuffer;
    await queue.enqueue(seg);

    // Queue should be idle now — enqueuing another should start fresh duck cycle
    duckCalls.length = 0;
    playedSegments.length = 0;

    const seg2 = makeSineWave(20).buffer as ArrayBuffer;
    await queue.enqueue(seg2);

    expect(duckCalls).toEqual(["duck", "unduck"]);
    expect(playedSegments).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Non-VOICE_AUDIO binary frames are ignored
// ---------------------------------------------------------------------------

import { isVoiceAudioFrame } from "@/hooks/useVoicePlayback";

describe("isVoiceAudioFrame", () => {
  it("returns true for VOICE_AUDIO frames", () => {
    const header = makeVoiceHeader();
    const frame = buildVoiceFrame(header, makeSineWave(10));

    expect(isVoiceAudioFrame(frame)).toBe(true);
  });

  it("returns false for frames with different type", () => {
    const header = makeVoiceHeader({ type: "OTHER_TYPE" });
    const frame = buildVoiceFrame(header, makeSineWave(10));

    expect(isVoiceAudioFrame(frame)).toBe(false);
  });

  it("returns false for frames with empty type", () => {
    const header = makeVoiceHeader({ type: "" });
    const frame = buildVoiceFrame(header, makeSineWave(10));

    expect(isVoiceAudioFrame(frame)).toBe(false);
  });

  it("returns false for truncated frames", () => {
    const truncated = new ArrayBuffer(2);

    expect(isVoiceAudioFrame(truncated)).toBe(false);
  });

  it("returns false for frames with invalid JSON header", () => {
    const garbage = new Uint8Array([0x7b, 0x7b, 0x7b]); // "{{{"
    const frame = new ArrayBuffer(4 + garbage.length);
    const view = new DataView(frame);
    view.setUint32(0, garbage.length, false);
    new Uint8Array(frame).set(garbage, 4);

    expect(isVoiceAudioFrame(frame)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule enforcement: TypeScript-specific checks
// ---------------------------------------------------------------------------

describe("rule enforcement", () => {
  // Rule #4: null/undefined handling — functions must handle null AudioContext
  it("pcmToAudioBuffer requires a valid AudioContext (not null)", () => {
    const pcm = makeSineWave(10);
    // If implementation accepts null, this test catches it
    expect(() =>
      pcmToAudioBuffer(null as unknown as AudioContext, pcm.buffer as ArrayBuffer, 24000),
    ).toThrow();
  });

  // Rule #10: JSON.parse without validation — decodeVoiceFrame must validate header shape
  it("decodeVoiceFrame rejects header missing required type field", () => {
    const badHeader = { segment_id: "seg-1", format: "pcm_f32le", sample_rate: 24000 };
    const headerJson = JSON.stringify(badHeader);
    const headerBytes = new TextEncoder().encode(headerJson);
    const frame = new ArrayBuffer(4 + headerBytes.length);
    const view = new DataView(frame);
    view.setUint32(0, headerBytes.length, false);
    new Uint8Array(frame).set(headerBytes, 4);

    expect(() => decodeVoiceFrame(frame)).toThrow();
  });

  it("decodeVoiceFrame rejects header missing segment_id", () => {
    const badHeader = { type: "VOICE_AUDIO", format: "pcm_f32le", sample_rate: 24000 };
    const headerJson = JSON.stringify(badHeader);
    const headerBytes = new TextEncoder().encode(headerJson);
    const frame = new ArrayBuffer(4 + headerBytes.length);
    const view = new DataView(frame);
    view.setUint32(0, headerBytes.length, false);
    new Uint8Array(frame).set(headerBytes, 4);

    expect(() => decodeVoiceFrame(frame)).toThrow();
  });

  it("decodeVoiceFrame rejects header with non-number sample_rate", () => {
    const badHeader = { type: "VOICE_AUDIO", segment_id: "s1", format: "pcm_f32le", sample_rate: "not-a-number" };
    const headerJson = JSON.stringify(badHeader);
    const headerBytes = new TextEncoder().encode(headerJson);
    const frame = new ArrayBuffer(4 + headerBytes.length);
    const view = new DataView(frame);
    view.setUint32(0, headerBytes.length, false);
    new Uint8Array(frame).set(headerBytes, 4);

    expect(() => decodeVoiceFrame(frame)).toThrow();
  });
});
