import { useEffect, useRef } from "react";
import { MessageType } from "@/types/protocol";
import type { AudioEngine } from "@/audio/AudioEngine";

/**
 * Listens for AUDIO_CUE messages and drives music playback with crossfade.
 * Tracks current mood to avoid re-triggering the same track.
 */
export function useMusicPlayer(
  engine: AudioEngine | null,
  genreBaseUrl: string | null,
  onMessage: (type: MessageType, handler: (payload: any) => void) => void,
): void {
  const currentMoodRef = useRef<string | null>(null);

  useEffect(() => {
    if (!engine || !genreBaseUrl) return;

    onMessage(MessageType.AUDIO_CUE, (payload: any) => {
      const { mood, music_track } = payload;

      if (!mood || !music_track) return;
      if (mood === currentMoodRef.current) return;

      currentMoodRef.current = mood;
      const url = `${genreBaseUrl}/${music_track}`;
      engine.playMusic(url, 3000);
    });
  }, [engine, genreBaseUrl, onMessage]);
}
