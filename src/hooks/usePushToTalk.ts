import { useCallback, useEffect, useRef, useState } from "react";
import { audioToFloat32 } from "@/audio/audioPreprocess";

export type PTTState = "idle" | "recording" | "transcribing" | "preview";

export interface VoiceChatHandle {
  muteOutgoing: () => void;
  unmuteOutgoing: () => void;
}

export interface UsePushToTalkOptions {
  transcribe: (audio: Float32Array) => Promise<string>;
  onConfirm: (text: string) => void;
  pttKey?: string;
  voiceChat?: VoiceChatHandle;
  enabled?: boolean;
}

export interface UsePushToTalkResult {
  state: PTTState;
  transcript: string | null;
  duration: number;
  confirm: () => void;
  discard: () => void;
  editTranscript: (text: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
}

export function usePushToTalk(options: UsePushToTalkOptions): UsePushToTalkResult {
  const { transcribe, onConfirm, pttKey = "ControlLeft", voiceChat, enabled = true } = options;

  // Fix 3: Stable refs for voiceChat methods to avoid effect re-registration
  const muteOutgoingRef = useRef(voiceChat?.muteOutgoing);
  const unmuteOutgoingRef = useRef(voiceChat?.unmuteOutgoing);
  muteOutgoingRef.current = voiceChat?.muteOutgoing;
  unmuteOutgoingRef.current = voiceChat?.unmuteOutgoing;

  const [state, setState] = useState<PTTState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Fix 1: Cancellation ref to handle keyup-before-getUserMedia race
  const cancelledRef = useRef(false);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Async media setup — called after state is already set to "recording"
  const setupRecording = useCallback(async () => {
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Fix 1: If keyup fired while getUserMedia was pending, tear down immediately
      if (cancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        setState("idle");
        return;
      }

      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopDurationTimer();
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        setState("transcribing");

        try {
          const float32 = await audioToFloat32(audioBlob);
          const STT_TIMEOUT_MS = 30_000;
          const text = await Promise.race([
            transcribe(float32),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("STT timeout")), STT_TIMEOUT_MS),
            ),
          ]);
          setTranscript(text);
          setState("preview");
        } catch (e: unknown) {
          console.warn("PTT transcription error:", e);
          setState("idle");
        }
      };

      recorder.start(250);

      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setDuration((Date.now() - startTime) / 1000);
      }, 100);
    } catch (e: unknown) {
      console.warn("PTT mic setup error:", e);
      setState("idle");
    }
  }, [transcribe, stopDurationTimer]);

  const stopRecording = useCallback(() => {
    // Fix 1: Signal cancellation so in-flight getUserMedia is cleaned up
    cancelledRef.current = true;
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const confirm = useCallback(() => {
    if (transcript) {
      onConfirm(transcript);
    }
    setTranscript(null);
    setState("idle");
  }, [transcript, onConfirm]);

  const discard = useCallback(() => {
    setTranscript(null);
    setState("idle");
  }, []);

  const editTranscript = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  const startRecording = useCallback(() => {
    if (state !== "idle") return;
    muteOutgoingRef.current?.();
    setState("recording");
    setupRecording();
  }, [state, setupRecording]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled) return;
      if (e.code !== pttKey) return;
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      e.preventDefault();
      if (state === "idle") {
        muteOutgoingRef.current?.();
        setState("recording");
        setupRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== pttKey) return;
      if (state === "recording") {
        stopRecording();
        unmuteOutgoingRef.current?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [pttKey, state, setupRecording, stopRecording, enabled]);

  return { state, transcript, duration, confirm, discard, editTranscript, startRecording, stopRecording };
}
