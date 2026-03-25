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
 */
export function useWhisper(): UseWhisperResult {
  const transcriberRef = useRef<LocalTranscriber | null>(null);
  const [status, setStatus] = useState<TranscriberStatus>("unloaded");
  const [loadProgress, setLoadProgress] = useState(0);
  const [isWebGPU, setIsWebGPU] = useState(false);

  useEffect(() => {
    const t = new LocalTranscriber();
    transcriberRef.current = t;

    t.initialize((progress) => {
      setLoadProgress(progress);
    })
      .then(() => {
        setStatus(t.status);
        setIsWebGPU(t.isWebGPU);
      })
      .catch(() => {
        setStatus("error");
      });
  }, []);

  const transcribe = useCallback(async (audio: Float32Array) => {
    if (!transcriberRef.current) {
      throw new Error("Transcriber not initialized");
    }
    return transcriberRef.current.transcribe(audio);
  }, []);

  return useMemo(
    () => ({ transcribe, status, loadProgress, isWebGPU }),
    [transcribe, status, loadProgress, isWebGPU],
  );
}
