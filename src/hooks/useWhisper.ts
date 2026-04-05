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
    const transcriber = new LocalTranscriber();
    transcriberRef.current = transcriber;

    transcriber
      .initialize((progress) => setLoadProgress(progress))
      .then(() => {
        setStatus(transcriber.status);
        setIsWebGPU(transcriber.isWebGPU);
      })
      .catch(() => {
        setStatus("error");
      });

    return () => {
      transcriberRef.current = null;
    };
  }, []);

  const transcribe = useCallback(async (audio: Float32Array): Promise<string> => {
    const transcriber = transcriberRef.current;
    if (!transcriber || transcriber.status !== "ready") {
      throw new Error("Transcriber not ready");
    }
    return transcriber.transcribe(audio);
  }, []);

  return useMemo(
    () => ({ transcribe, status, loadProgress, isWebGPU }),
    [transcribe, status, loadProgress, isWebGPU],
  );
}
