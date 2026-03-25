import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for LocalTranscriber — Whisper STT pipeline wrapper.
 *
 * Story 57-9 AC mapping:
 *   AC-1: Transcriber initializes and reports status
 *   AC-2: WebGPU detected when available
 *   AC-3: Falls back to WASM without WebGPU
 *   AC-5: Transcribe returns text from audio
 *   AC-6: Loading progress reported during model download
 */

// Mock @huggingface/transformers
vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn(),
}));

describe("LocalTranscriber", () => {
  let LocalTranscriber: typeof import("@/audio/LocalTranscriber").LocalTranscriber;
  let mockPipeline: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const hf = await import("@huggingface/transformers");
    mockPipeline = hf.pipeline as ReturnType<typeof vi.fn>;
    mockPipeline.mockResolvedValue(
      vi.fn().mockResolvedValue({ text: " Hello world " }),
    );

    const mod = await import("@/audio/LocalTranscriber");
    LocalTranscriber = mod.LocalTranscriber;
  });

  // AC-1: Status lifecycle
  it("starts with status 'unloaded'", () => {
    const t = new LocalTranscriber();
    expect(t.status).toBe("unloaded");
  });

  it("transitions to 'ready' after initialize()", async () => {
    const t = new LocalTranscriber();
    await t.initialize();
    expect(t.status).toBe("ready");
  });

  it("transitions to 'error' on initialization failure", async () => {
    mockPipeline.mockRejectedValueOnce(new Error("Model load failed"));

    const t = new LocalTranscriber();
    await expect(t.initialize()).rejects.toThrow("Model load failed");
    expect(t.status).toBe("error");
  });

  // AC-2: WebGPU detection
  it("uses webgpu device when navigator.gpu is available", async () => {
    vi.stubGlobal("navigator", { gpu: {} });

    const t = new LocalTranscriber();
    await t.initialize();

    expect(t.isWebGPU).toBe(true);
    expect(mockPipeline).toHaveBeenCalledWith(
      "automatic-speech-recognition",
      expect.any(String),
      expect.objectContaining({ device: "webgpu", dtype: "q4" }),
    );
  });

  // AC-3: WASM fallback
  it("uses wasm device when navigator.gpu is undefined", async () => {
    vi.stubGlobal("navigator", {});

    const t = new LocalTranscriber();
    await t.initialize();

    expect(t.isWebGPU).toBe(false);
    expect(mockPipeline).toHaveBeenCalledWith(
      "automatic-speech-recognition",
      expect.any(String),
      expect.objectContaining({ device: "wasm", dtype: "q8" }),
    );
  });

  // AC-5: Transcription
  it("transcribe returns trimmed text", async () => {
    const t = new LocalTranscriber();
    await t.initialize();

    const result = await t.transcribe(new Float32Array(16000));
    expect(result).toBe("Hello world");
  });

  it("transcribe throws if not initialized", async () => {
    const t = new LocalTranscriber();
    await expect(t.transcribe(new Float32Array(100))).rejects.toThrow(
      "not initialized",
    );
  });

  // AC-6: Progress reporting
  it("calls progress callback during initialization", async () => {
    const progressFn = vi.fn();
    mockPipeline.mockImplementation(async (_task, _model, opts) => {
      // Simulate progress callbacks
      if (opts?.progress_callback) {
        opts.progress_callback({ progress: 25 });
        opts.progress_callback({ progress: 50 });
        opts.progress_callback({ progress: 100 });
      }
      return vi.fn().mockResolvedValue({ text: "test" });
    });

    const t = new LocalTranscriber();
    await t.initialize(progressFn);

    expect(progressFn).toHaveBeenCalledWith(25);
    expect(progressFn).toHaveBeenCalledWith(50);
    expect(progressFn).toHaveBeenCalledWith(100);
  });
});
