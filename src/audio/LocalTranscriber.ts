import { pipeline } from "@huggingface/transformers";

export type TranscriberStatus = "unloaded" | "loading" | "ready" | "error";

/**
 * Whisper STT pipeline wrapper with WebGPU detection and WASM fallback.
 */
export class LocalTranscriber {
  private transcriber: any = null;
  status: TranscriberStatus = "unloaded";
  private device: "webgpu" | "wasm" = "wasm";

  async initialize(onProgress?: (progress: number) => void): Promise<void> {
    this.status = "loading";

    // Suppress ONNX runtime WASM warnings during initialization — these are
    // informational messages about operator support that clutter the console.
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      const msg = String(args[0] ?? "");
      if (msg.includes("onnx") || msg.includes("ONNX") || msg.includes("ort-wasm")) return;
      originalWarn.apply(console, args);
    };

    try {
      this.device = navigator.gpu ? "webgpu" : "wasm";

      this.transcriber = await pipeline(
        "automatic-speech-recognition",
        "onnx-community/whisper-tiny.en",
        {
          device: this.device,
          dtype: this.device === "webgpu" ? "q4" : "q8",
          progress_callback: onProgress
            ? (p: any) => onProgress(p.progress ?? 0)
            : undefined,
        },
      );
      this.status = "ready";
    } catch (err) {
      this.status = "error";
      throw err;
    } finally {
      console.warn = originalWarn;
    }
  }

  async transcribe(audioBuffer: Float32Array): Promise<string> {
    if (this.status !== "ready" || !this.transcriber) {
      throw new Error("Transcriber not initialized");
    }
    const result = await this.transcriber(audioBuffer);
    return result.text.trim();
  }

  get isWebGPU(): boolean {
    return this.device === "webgpu";
  }
}
