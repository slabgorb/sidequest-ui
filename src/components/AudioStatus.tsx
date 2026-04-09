import { useCallback, useEffect, type ChangeEvent } from "react";

const STORAGE_KEY = "sq-audio-volumes";

export interface AudioStatusProps {
  nowPlaying: { title: string; mood: string } | null;
  volumes: { music: number; sfx: number };
  muted: { music: boolean; sfx: boolean };
  onVolumeChange: (channel: string, value: number) => void;
  onMuteToggle: (channel: string) => void;
}

const CHANNELS = ["music", "sfx"] as const;
type Channel = (typeof CHANNELS)[number];

function persistToStorage(
  volumes: Record<Channel, number>,
  muted: Record<Channel, boolean>,
) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...volumes, muted }));
}

export function AudioStatus({
  nowPlaying,
  volumes,
  muted,
  onVolumeChange,
  onMuteToggle,
}: AudioStatusProps) {
  // Restore persisted volumes on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      for (const ch of CHANNELS) {
        if (typeof parsed[ch] === "number" && parsed[ch] !== volumes[ch]) {
          onVolumeChange(ch, parsed[ch]);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVolumeInput = useCallback(
    (channel: Channel, e: ChangeEvent<HTMLInputElement>) => {
      const normalized = Number(e.target.value) / 100;
      onVolumeChange(channel, normalized);
      const updated = { ...volumes, [channel]: normalized };
      persistToStorage(updated, muted);
    },
    [onVolumeChange, volumes, muted],
  );

  const handleMuteClick = useCallback(
    (channel: Channel) => {
      onMuteToggle(channel);
      persistToStorage(volumes, muted);
    },
    [onMuteToggle, volumes, muted],
  );

  return (
    <div data-testid="audio-status" className="p-4 flex flex-col gap-3">
      {nowPlaying && (
        <div data-testid="now-playing" className="text-xs text-muted-foreground/70 truncate">
          ♪{" "}
          <span className="font-semibold">{nowPlaying.title}</span>
          {" — "}
          <span data-testid="mood-badge" className="text-muted-foreground/50 capitalize">
            {nowPlaying.mood.replace(/_/g, " ")}
          </span>
        </div>
      )}

      {CHANNELS.map((ch) => (
        <div
          key={ch}
          data-testid={`volume-slider-${ch}`}
          className="flex items-center gap-2"
        >
          <span className="text-xs text-muted-foreground/60 w-12 capitalize">{ch}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(volumes[ch] * 100)}
            className="flex-1 h-1 accent-primary/60"
            aria-label={`${ch} volume`}
            onChange={(e) => handleVolumeInput(ch, e)}
            onInput={(e) =>
              handleVolumeInput(ch, e as ChangeEvent<HTMLInputElement>)
            }
          />
          <button
            data-testid={`mute-btn-${ch}`}
            data-muted={String(muted[ch])}
            className="text-muted-foreground/50 hover:text-muted-foreground text-sm w-5"
            aria-label={`Mute ${ch}`}
            onClick={() => handleMuteClick(ch)}
          >
            {muted[ch] ? "○" : "●"}
          </button>
        </div>
      ))}
    </div>
  );
}
