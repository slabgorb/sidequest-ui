import { useEffect, useRef } from "react";
import { AudioEngine } from "@/audio/AudioEngine";
import type { VoiceChatHandle } from "./usePushToTalk";

/**
 * Mutes outgoing mic audio during TTS voice playback to prevent feedback loops.
 *
 * Subscribes to AudioEngine.onVoicePlaybackChange and calls
 * muteOutgoing/unmuteOutgoing on the provided VoiceChatHandle.
 */
export function useTtsMicGating(voiceChat: VoiceChatHandle | undefined): void {
  const handleRef = useRef(voiceChat);
  handleRef.current = voiceChat;

  useEffect(() => {
    const engine = AudioEngine.getInstance();

    const listener = (playing: boolean) => {
      if (playing) {
        handleRef.current?.muteOutgoing();
      } else {
        handleRef.current?.unmuteOutgoing();
      }
    };

    engine.onVoicePlaybackChange = listener;

    return () => {
      // Only clear if we're still the registered listener
      if (engine.onVoicePlaybackChange === listener) {
        engine.onVoicePlaybackChange = undefined;
      }
    };
  }, []);
}
