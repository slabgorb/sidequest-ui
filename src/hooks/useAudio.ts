import { useRef, useCallback, useMemo } from "react";
import { AudioEngine } from "@/audio/AudioEngine";

export function useAudio() {
  const engineRef = useRef<AudioEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = AudioEngine.getInstance();
  }

  // AudioEngine is a singleton — never dispose it.
  // Closing the AudioContext kills all audio and the ref can't recover.

  const resume = useCallback(async () => {
    await engineRef.current?.resume();
  }, []);

  const playMusic = useCallback(async (url: string, fadeMs?: number) => {
    await engineRef.current?.playMusic(url, fadeMs);
  }, []);

  const playSfx = useCallback(async (url: string) => {
    await engineRef.current?.playSfx(url);
  }, []);

  const setVolume = useCallback(
    (channel: "music" | "sfx" | "master", value: number) => {
      engineRef.current?.setVolume(channel, value);
    },
    [],
  );

  const getVolume = useCallback(
    (channel: "music" | "sfx" | "master"): number => {
      return engineRef.current?.getVolume(channel) ?? 1.0;
    },
    [],
  );

  const mute = useCallback((channel: "music" | "sfx") => {
    engineRef.current?.mute(channel);
  }, []);

  const unmute = useCallback((channel: "music" | "sfx") => {
    engineRef.current?.unmute(channel);
  }, []);

  return useMemo(
    () => ({
      engine: engineRef.current,
      resume,
      playMusic,
      playSfx,
      setVolume,
      getVolume,
      mute,
      unmute,
    }),
    [resume, playMusic, playSfx, setVolume, getVolume, mute, unmute],
  );
}
