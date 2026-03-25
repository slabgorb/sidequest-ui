import { useState, useEffect, useCallback } from "react";
import { NarrativeView } from "@/screens/NarrativeView";
import InputBar from "@/components/InputBar";
import { PartyPanel } from "@/components/PartyPanel";
import { AudioStatus } from "@/components/AudioStatus";
import { OverlayManager } from "@/components/OverlayManager";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { useWhisper } from "@/hooks/useWhisper";
import type { useAudio } from "@/hooks/useAudio";
import type { NowPlaying } from "@/hooks/useAudioCue";
import type { CharacterSummary } from "@/components/PartyPanel";
import type { CharacterSheetData } from "@/components/CharacterSheet";
import type { InventoryData } from "@/components/InventoryPanel";
import type { MapState } from "@/components/MapOverlay";
import { CombatOverlay, type CombatState } from "@/components/CombatOverlay";
import type { JournalEntry } from "@/components/JournalView";
import type { GameMessage } from "@/types/protocol";

export interface GameLayoutProps {
  messages: GameMessage[];
  characters: CharacterSummary[];
  onSend: (text: string, aside: boolean) => void;
  disabled: boolean;
  thinking?: boolean;
  characterSheet?: CharacterSheetData | null;
  inventoryData?: InventoryData | null;
  mapData?: MapState | null;
  audio?: ReturnType<typeof useAudio>;
  nowPlaying?: NowPlaying | null;
  journalEntries?: JournalEntry[];
  combatState?: CombatState | null;
}

export function GameLayout({
  messages,
  characters,
  onSend,
  disabled,
  thinking,
  characterSheet = null,
  inventoryData = null,
  mapData = null,
  audio,
  nowPlaying = null,
  journalEntries,
  combatState = null,
}: GameLayoutProps) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const isTablet = breakpoint === "tablet";

  const [overlayOpen, setOverlayOpen] = useState(false);

  // Audio state — tracked locally, synced to AudioEngine
  const [volumes, setVolumes] = useState({ music: 0.5, sfx: 0.5, voice: 0.5 });
  const [muted, setMuted] = useState({ music: false, sfx: false, voice: false });

  // Mic on/off toggle — persisted to localStorage
  const [micEnabled, setMicEnabled] = useState(() =>
    localStorage.getItem("sq-mic-enabled") === "true"
  );

  const toggleMic = useCallback(() => {
    setMicEnabled(prev => {
      const next = !prev;
      localStorage.setItem("sq-mic-enabled", String(next));
      return next;
    });
  }, []);

  // PTT pipeline: Whisper STT + push-to-talk state machine
  const { transcribe } = useWhisper();
  const ptt = usePushToTalk({
    transcribe,
    onConfirm: (text: string) => onSend(text, false),
    enabled: micEnabled,
  });

  // Stop any in-progress recording when mic is disabled
  useEffect(() => {
    if (!micEnabled) {
      ptt.discard();
    }
    // Only trigger on micEnabled changes, not ptt reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled]);

  // P key and Escape handlers for mobile overlay
  useEffect(() => {
    if (!isMobile) return;

    const handler = (e: KeyboardEvent) => {
      // Escape closes overlay
      if (e.key === "Escape") {
        setOverlayOpen(false);
        return;
      }

      // P toggles overlay (skip when in input fields)
      if (e.key === "p") {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        if ((e.target as HTMLElement)?.isContentEditable) return;
        e.stopImmediatePropagation(); // prevent PartyPanel's own handler
        setOverlayOpen((prev) => !prev);
      }
    };
    // Use capture phase to fire before PartyPanel's handler
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [isMobile]);

  // Close overlay when leaving mobile breakpoint
  useEffect(() => {
    if (!isMobile) {
      setOverlayOpen(false);
    }
  }, [isMobile]);

  // No-op toggle for non-mobile (PartyPanel requires onToggle prop)
  const noopToggle = useCallback(() => {}, []);

  const handleVolumeChange = useCallback(
    (channel: string, value: number) => {
      setVolumes((prev) => ({ ...prev, [channel]: value }));
      audio?.setVolume(channel as "music" | "sfx" | "voice", value);
    },
    [audio],
  );

  const handleMuteToggle = useCallback(
    (channel: string) => {
      setMuted((prev) => {
        const next = { ...prev, [channel]: !prev[channel as keyof typeof prev] };
        if (next[channel as keyof typeof next]) {
          audio?.mute(channel as "music" | "sfx" | "voice");
        } else {
          audio?.unmute(channel as "music" | "sfx" | "voice");
        }
        return next;
      });
    },
    [audio],
  );

  return (
    <OverlayManager
      characterData={characterSheet}
      inventoryData={inventoryData}
      mapData={mapData}
      journalEntries={journalEntries}
    >
      <div
        data-testid="game-layout"
        data-breakpoint={breakpoint}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="flex flex-1 min-h-0">
          {/* Sidebar — only in multiplayer, visible on desktop (expanded) and tablet (collapsed) */}
          {!isMobile && characters.length > 1 && (
            <PartyPanel
              characters={characters}
              collapsed={isTablet}
              onToggle={noopToggle}
            />
          )}

          {/* Main content area */}
          <div className="flex flex-col flex-1 min-h-0">
            <NarrativeView messages={messages} thinking={thinking} />
            <div className="border-t border-border/50 px-4 py-4 bg-card/50">
              <InputBar
                onSend={onSend}
                disabled={disabled}
                mobile={isMobile}
                thinking={thinking}
                micEnabled={micEnabled}
                onMicToggle={toggleMic}
                pttState={ptt.state}
                onPttStart={ptt.startRecording}
                onPttStop={ptt.stopRecording}
                transcript={ptt.transcript}
                onTranscriptEdit={ptt.editTranscript}
                onTranscriptConfirm={ptt.confirm}
                onTranscriptDiscard={ptt.discard}
                duration={ptt.duration}
              />
            </div>
          </div>
        </div>

        {/* Combat overlay — visible only during combat */}
        {combatState && <CombatOverlay combat={combatState} />}

        {/* AudioStatus — always visible */}
        <AudioStatus
          nowPlaying={nowPlaying}
          volumes={volumes}
          muted={muted}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
        />

        {/* Mobile: PartyPanel as overlay — only in multiplayer */}
        {isMobile && characters.length > 1 && (
          overlayOpen ? (
            <div
              data-testid="party-overlay"
              className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
              onClick={() => setOverlayOpen(false)}
            >
              <div
                className="bg-background w-full h-full overflow-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <PartyPanel
                  characters={characters}
                  collapsed={false}
                  onToggle={() => setOverlayOpen(false)}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "none" }} aria-hidden="true">
              <PartyPanel
                characters={characters}
                collapsed={false}
                onToggle={noopToggle}
              />
            </div>
          )
        )}
      </div>
    </OverlayManager>
  );
}
