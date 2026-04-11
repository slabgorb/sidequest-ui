import { useEffect, useRef, useState } from "react";
import { MessageType, type GameMessage } from "@/types/protocol";
import type { AudioEngine } from "@/audio/AudioEngine";

let crossfadeMs = 3000;

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
  const currentTrackRef = useRef<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);

  useEffect(() => {
    if (!engine) return;

    const cues = messages.filter((m) => m.type === MessageType.AUDIO_CUE);

    // Only process new cues since last render
    const newCues = cues.slice(processedCountRef.current);
    processedCountRef.current = cues.length;

    for (const msg of newCues) {
      const {
        mood,
        music_track,
        sfx_triggers,
        action,
        music_volume,
        sfx_volume,
        crossfade_ms,
      } = msg.payload as {
        mood?: string;
        music_track?: string;
        sfx_triggers?: string[];
        action?: string;
        music_volume?: number;
        sfx_volume?: number;
        crossfade_ms?: number;
      };

      // Route based on action field
      if (action === "configure") {
        // Genre-pack mixer config — set initial channel volumes
        if (music_volume != null) engine.setVolume("music", music_volume);
        if (sfx_volume != null) engine.setVolume("sfx", sfx_volume);
        if (crossfade_ms != null) crossfadeMs = crossfade_ms;
        continue;
      } else if (action === "duck") {
        engine.duckMusic();
      } else if (action === "restore") {
        engine.restoreMusic();
      } else if (action === "fade_out" || action === "stop") {
        engine.stopMusic(action === "fade_out" ? crossfadeMs : undefined);
      } else {
        // action is "play", "fade_in", or absent — play the track
        // Play when mood changes OR when a different track is selected within
        // the same mood (ThemeRotator anti-repetition produces new tracks
        // at high intensity even when mood is unchanged).
        if (
          music_track &&
          mood &&
          (mood !== currentMoodRef.current ||
            music_track !== currentTrackRef.current)
        ) {
          currentMoodRef.current = mood;
          currentTrackRef.current = music_track;
          engine.playMusic(music_track, crossfadeMs);

          // Extract filename for display
          const title = music_track.split("/").pop()?.replace(/\.\w+$/, "").replace(/[_-]/g, " ") ?? mood;
          setNowPlaying({ title, mood });
        }
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
