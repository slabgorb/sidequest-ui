import { useState, useCallback, useEffect, useRef, type ChangeEvent } from "react";

const STORAGE_KEY = "sq-audio-volumes";

export interface AudioStatusProps {
  nowPlaying: { title: string; mood: string } | null;
  volumes: { music: number; sfx: number; voice: number };
  muted: { music: boolean; sfx: boolean; voice: boolean };
  onVolumeChange: (channel: string, value: number) => void;
  onMuteToggle: (channel: string) => void;
}

const CHANNELS = ["music", "sfx", "voice"] as const;
type Channel = (typeof CHANNELS)[number];

function persistToStorage(
  volumes: Record<Channel, number>,
  muted: Record<Channel, boolean>,
) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...volumes, muted }));
}

function EqualizerBars() {
  return (
    <div className="flex items-end gap-[2px] h-3">
      <span className="w-[2px] bg-muted-foreground/50 animate-pulse h-2" />
      <span className="w-[2px] bg-muted-foreground/50 animate-pulse h-3 [animation-delay:150ms]" />
      <span className="w-[2px] bg-muted-foreground/50 animate-pulse h-1.5 [animation-delay:300ms]" />
    </div>
  );
}

export function AudioStatus({
  nowPlaying,
  volumes,
  muted,
  onVolumeChange,
  onMuteToggle,
}: AudioStatusProps) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Close on Escape or click outside
  useEffect(() => {
    if (!expanded) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [expanded]);

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

  if (!expanded) {
    return (
      <button
        data-testid="audio-toggle"
        className="fixed bottom-4 left-4 z-30 w-11 h-11 flex items-center justify-center
                   rounded-full bg-background/80 backdrop-blur-sm border border-border/20
                   text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
        onClick={() => setExpanded(true)}
        aria-label="Audio controls"
      >
        {nowPlaying ? <EqualizerBars /> : <span className="text-xs">♪</span>}
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      data-testid="audio-status"
      data-expanded="true"
      className="fixed bottom-4 left-4 z-30 w-56 rounded-lg bg-background/95 backdrop-blur-md
                 border border-border/20 shadow-lg p-3 flex flex-col gap-2"
    >
      {nowPlaying && (
        <div data-testid="now-playing" className="text-xs text-muted-foreground/60 truncate mb-1">
          ♪ {nowPlaying.title}
          <span data-testid="mood-badge" className="ml-1 text-muted-foreground/40">
            {nowPlaying.mood}
          </span>
        </div>
      )}

      {CHANNELS.map((ch) => (
        <div
          key={ch}
          data-testid={`volume-slider-${ch}`}
          className="flex items-center gap-2"
        >
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(volumes[ch] * 100)}
            className="flex-1 h-1 accent-muted-foreground/40"
            aria-label={`${ch} volume`}
            onChange={(e) => handleVolumeInput(ch, e)}
            onInput={(e) =>
              handleVolumeInput(ch, e as ChangeEvent<HTMLInputElement>)
            }
            onClick={(e) => e.stopPropagation()}
          />
          <button
            data-testid={`mute-btn-${ch}`}
            data-muted={String(muted[ch])}
            className="text-muted-foreground/40 hover:text-muted-foreground/70 text-xs w-4"
            aria-label={`Mute ${ch}`}
            onClick={(e) => {
              e.stopPropagation();
              handleMuteClick(ch);
            }}
          >
            {muted[ch] ? "○" : "●"}
          </button>
        </div>
      ))}
    </div>
  );
}
