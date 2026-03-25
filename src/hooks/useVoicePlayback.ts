/**
 * useVoicePlayback — VOICE_AUDIO binary frame decoding and voice queue.
 *
 * Decodes binary WebSocket frames containing TTS audio, converts PCM to
 * AudioBuffer, and queues segments for sequential playback with music ducking.
 *
 * Story 57-7.
 */

import { useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VoiceAudioHeader {
  type: string;
  segment_id: string;
  format: string;
  sample_rate: number;
}

// ---------------------------------------------------------------------------
// Binary frame decoding
// ---------------------------------------------------------------------------

/**
 * Decode a binary VOICE_AUDIO WebSocket frame.
 *
 * Frame format:
 *   [4 bytes: header length (uint32 big-endian)]
 *   [N bytes: JSON header]
 *   [remaining bytes: audio data]
 */
export function decodeVoiceFrame(data: ArrayBuffer): {
  header: VoiceAudioHeader;
  audioData: ArrayBuffer;
} {
  if (data.byteLength < 4) {
    throw new Error("Frame too short to contain header length");
  }

  const view = new DataView(data);
  const headerLen = view.getUint32(0, false); // big-endian

  if (4 + headerLen > data.byteLength) {
    throw new Error(
      `Header length ${headerLen} exceeds frame size ${data.byteLength}`,
    );
  }

  const headerBytes = new Uint8Array(data, 4, headerLen);
  const parsed: unknown = JSON.parse(new TextDecoder().decode(headerBytes));

  // Runtime validation — rule #10
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).type !== "string" ||
    typeof (parsed as Record<string, unknown>).segment_id !== "string" ||
    typeof (parsed as Record<string, unknown>).sample_rate !== "number"
  ) {
    throw new Error("Invalid VOICE_AUDIO header: missing or mistyped fields");
  }

  const header = parsed as VoiceAudioHeader;
  const audioData = data.slice(4 + headerLen);

  return { header, audioData };
}

// ---------------------------------------------------------------------------
// Frame type check (non-throwing)
// ---------------------------------------------------------------------------

/** Returns true if the binary frame is a VOICE_AUDIO message. */
export function isVoiceAudioFrame(data: ArrayBuffer): boolean {
  try {
    const { header } = decodeVoiceFrame(data);
    return header.type === "VOICE_AUDIO";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// PCM → AudioBuffer
// ---------------------------------------------------------------------------

/** Convert raw PCM float32 mono data to a Web Audio AudioBuffer. */
export function pcmToAudioBuffer(
  ctx: AudioContext,
  pcmData: ArrayBuffer,
  sampleRate: number,
): AudioBuffer {
  if (!ctx) {
    throw new Error("AudioContext is required");
  }

  const float32 = new Float32Array(pcmData);
  const buffer = ctx.createBuffer(1, float32.length, sampleRate);
  buffer.copyToChannel(float32, 0);
  return buffer;
}

// ---------------------------------------------------------------------------
// Voice queue — sequential segment playback with ducking
// ---------------------------------------------------------------------------

export class VoiceQueue {
  private queue: ArrayBuffer[] = [];
  private draining = false;

  constructor(
    private readonly playSegment: (data: ArrayBuffer) => Promise<void>,
    private readonly duck: () => void,
    private readonly unduck: () => void,
  ) {}

  async enqueue(data: ArrayBuffer): Promise<void> {
    this.queue.push(data);

    if (!this.draining) {
      await this.drain();
    } else {
      // Wait for drain to finish processing our segment
      await this.waitUntilDrained();
    }
  }

  private async drain(): Promise<void> {
    this.draining = true;
    this.duck();

    try {
      while (this.queue.length > 0) {
        const segment = this.queue.shift()!;
        try {
          await this.playSegment(segment);
        } catch {
          // Individual segment failure — continue draining
        }
      }
    } finally {
      this.unduck();
      this.draining = false;
    }
  }

  private waitUntilDrained(): Promise<void> {
    return new Promise<void>((resolve) => {
      const check = () => {
        if (!this.draining) {
          resolve();
        } else {
          setTimeout(check, 5);
        }
      };
      check();
    });
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook that listens for VOICE_AUDIO binary frames and plays them through
 * the AudioEngine's voice channel.
 *
 * @param audioEngine - AudioEngine instance (from useAudio / 57-6)
 * @param onBinaryMessage - Register a handler for binary WebSocket messages
 */
export function useVoicePlayback(
  audioEngine: { playVoice: (data: ArrayBuffer) => void } | null,
  onBinaryMessage: (handler: (data: ArrayBuffer) => void) => void,
): void {
  useEffect(() => {
    if (!audioEngine) return;

    const handler = (data: ArrayBuffer) => {
      if (!isVoiceAudioFrame(data)) return;

      const { audioData } = decodeVoiceFrame(data);
      audioEngine.playVoice(audioData);
    };

    onBinaryMessage(handler);
  }, [audioEngine, onBinaryMessage]);
}
