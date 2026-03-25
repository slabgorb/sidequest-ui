import { useEffect, useRef, useState } from "react";
import { MessageType, type GameMessage } from "@/types/protocol";
import type { AudioEngine } from "@/audio/AudioEngine";

const DEFAULT_FADE_MS = 3000;

export interface NowPlaying {
  title: string;
  mood: string;
}

/**
 * Listens for AUDIO_CUE messages and routes audio playback
 * through AudioEngine's unified mixer channels.
 *
 * Server payload format (from build_audio_cue_payload):
 *   { mood: string, music_track: string, sfx_triggers: string[] }
 *
 * Returns nowPlaying metadata for AudioStatus display.
 */
export function useAudioCue(
  messages: GameMessage[],
  engine: AudioEngine | null,
): NowPlaying | null {
  const processedCountRef = useRef(0);
  const currentMoodRef = useRef<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);

  useEffect(() => {
    if (!engine) return;

    const cues = messages.filter((m) => m.type === MessageType.AUDIO_CUE);

    // Only process new cues since last render
    const newCues = cues.slice(processedCountRef.current);
    processedCountRef.current = cues.length;

    for (const msg of newCues) {
      const { mood, music_track, sfx_triggers } = msg.payload as {
        mood?: string;
        music_track?: string;
        sfx_triggers?: string[];
      };

      // Music: play track if mood changed (avoid re-triggering same track)
      if (music_track && mood && mood !== currentMoodRef.current) {
        currentMoodRef.current = mood;
        engine.playMusic(music_track, DEFAULT_FADE_MS);

        // Extract filename for display
        const title = music_track.split("/").pop()?.replace(/\.\w+$/, "").replace(/[_-]/g, " ") ?? mood;
        setNowPlaying({ title, mood });
      }

      // SFX: fire each trigger
      if (sfx_triggers) {
        for (const trigger of sfx_triggers) {
          engine.playSfx(trigger);
        }
      }
    }
  }, [messages, engine]);

  return nowPlaying;
}
