import { useEffect } from "react";
import { MessageType } from "@/types/protocol";
import type { AudioEngine } from "@/audio/AudioEngine";

interface SfxTrigger {
  sound: string;
  delay_ms?: number;
}

/**
 * Listens for AUDIO_CUE messages and plays SFX triggers with optional delays.
 */
export function useSfxPlayer(
  engine: AudioEngine | null,
  genreBaseUrl: string | null,
  onMessage: (type: MessageType, handler: (payload: any) => void) => void,
): void {
  useEffect(() => {
    if (!engine || !genreBaseUrl) return;

    onMessage(MessageType.AUDIO_CUE, (payload: any) => {
      const triggers: SfxTrigger[] | undefined = payload.sfx_triggers;
      if (!triggers || triggers.length === 0) return;

      for (const trigger of triggers) {
        const url = `${genreBaseUrl}/${trigger.sound}`;
        const delay = trigger.delay_ms ?? 0;

        if (delay > 0) {
          setTimeout(() => engine.playSfx(url), delay);
        } else {
          engine.playSfx(url);
        }
      }
    });
  }, [engine, genreBaseUrl, onMessage]);
}
