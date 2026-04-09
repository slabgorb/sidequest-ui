import { useState, useCallback, useEffect, type ChangeEvent } from "react";

const STORAGE_KEY = "sq-audio-volumes";

export interface AudioStatusProps {
  nowPlaying: { title: string; mood: string } | null;
  volumes: { music: number; sfx: number; voice: number };
  muted: { music: boolean; sfx: boolean; voice: boolean };
  onVolumeChange: (channel: string, value: number) => void;
  onMuteToggle: (channel: string) => void;
  voicePlaybackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  selectedVoice?: string;
  onVoiceChange?: (voice: string) => void;
}

const CHANNELS = ["music", "sfx", "voice"] as const;
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
  voicePlaybackRate = 1.0,
  onPlaybackRateChange,
  selectedVoice,
  onVoiceChange,
}: AudioStatusProps) {
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);

  // Fetch voice list from daemon (lazy load)
  useEffect(() => {
    if (!onVoiceChange || availableVoices.length > 0) return;
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.voices)) setAvailableVoices(data.voices);
      })
      .catch(() => {}); // daemon may be offline
  }, [onVoiceChange, availableVoices.length]);

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

      {onPlaybackRateChange && (
        <div data-testid="playback-rate-slider" className="flex items-center gap-2 pt-2 border-t border-border/20">
          <span className="text-xs text-muted-foreground/60 w-12">speed</span>
          <input
            type="range"
            min="50"
            max="200"
            step="10"
            value={Math.round(voicePlaybackRate * 100)}
            className="flex-1 h-1 accent-primary/60"
            aria-label="Voice playback speed"
            onChange={(e) => onPlaybackRateChange(Number(e.target.value) / 100)}
          />
          <span className="text-xs text-muted-foreground/50 w-8 text-right">{voicePlaybackRate.toFixed(1)}×</span>
        </div>
      )}

      {onVoiceChange && availableVoices.length > 0 && (
        <div data-testid="voice-selector" className="flex items-center gap-2 pt-2 border-t border-border/20">
          <span className="text-xs text-muted-foreground/60 w-12">voice</span>
          <select
            value={selectedVoice ?? ""}
            className="flex-1 text-xs bg-background/50 border border-border/30 rounded px-2 py-1 text-foreground"
            aria-label="Narrator voice"
            onChange={(e) => onVoiceChange(e.target.value)}
          >
            {availableVoices.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
