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
