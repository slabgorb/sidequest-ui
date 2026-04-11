import { useCallback, useMemo, useState } from "react";
import { AudioEngine } from "@/audio/AudioEngine";

export function useAudio() {
  // Lazy `useState` initializer pulls the singleton on first render only.
  // Avoids the "cannot access refs during render" lint by reading state
  // (legal during render) instead of mutating a ref. Re-mounting the hook
  // reuses the same engine via getInstance().
  const [engine] = useState(() => AudioEngine.getInstance());

  // AudioEngine is a process-wide singleton — never dispose it on unmount.
  // Closing the AudioContext kills all audio and the ref can't recover.

  const resume = useCallback(async () => {
    await engine.resume();
  }, [engine]);

  const playMusic = useCallback(
    async (url: string, fadeMs?: number) => {
      await engine.playMusic(url, fadeMs);
    },
    [engine],
  );

  const playSfx = useCallback(
    async (url: string) => {
      await engine.playSfx(url);
    },
    [engine],
  );

  const setVolume = useCallback(
    (channel: "music" | "sfx" | "master", value: number) => {
      engine.setVolume(channel, value);
    },
    [engine],
  );

  const getVolume = useCallback(
    (channel: "music" | "sfx" | "master"): number => {
      return engine.getVolume(channel);
    },
    [engine],
  );

  const mute = useCallback(
    (channel: "music" | "sfx") => {
      engine.mute(channel);
    },
    [engine],
  );

  const unmute = useCallback(
    (channel: "music" | "sfx") => {
      engine.unmute(channel);
    },
    [engine],
  );

  return useMemo(
    () => ({
      engine,
      resume,
      playMusic,
      playSfx,
      setVolume,
      getVolume,
      mute,
      unmute,
    }),
    [engine, resume, playMusic, playSfx, setVolume, getVolume, mute, unmute],
  );
}
