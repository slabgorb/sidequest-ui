import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  LocalTranscriber,
  type TranscriberStatus,
} from "@/audio/LocalTranscriber";

export interface UseWhisperResult {
  transcribe: (audio: Float32Array) => Promise<string>;
  status: TranscriberStatus;
  loadProgress: number;
  isWebGPU: boolean;
}

/**
 * React hook wrapping LocalTranscriber — initializes on mount, exposes transcribe().
 *
 * DISABLED: Voice/mic functionality is off until rethought. No mic access,
 * no transcriber initialization, no getUserMedia. The mic was capturing TTS
 * audio and feeding it back as player input, causing narration fragmentation.
 */
export function useWhisper(): UseWhisperResult {
  const transcribe = useCallback(async (_audio: Float32Array) => {
    return "";
  }, []);

  return useMemo(
    () => ({ transcribe, status: "unloaded" as TranscriberStatus, loadProgress: 0, isWebGPU: false }),
    [transcribe],
  );
}
