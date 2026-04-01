import { useState, useEffect, useCallback } from "react";
import { NarrativeView } from "@/screens/NarrativeView";
import InputBar from "@/components/InputBar";
import { PartyPanel } from "@/components/PartyPanel";
import { AudioStatus } from "@/components/AudioStatus";
import { OverlayManager, type OverlayType } from "@/components/OverlayManager";
import type { SettingsPanelProps } from "@/components/SettingsPanel";
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
import type { KnowledgeEntry } from "@/providers/GameStateProvider";
import { TurnStatusPanel, type TurnStatusEntry } from "@/components/TurnStatusPanel";
import type { GameMessage } from "@/types/protocol";

export interface GameLayoutProps {
  messages: GameMessage[];
  characters: CharacterSummary[];
  onSend: (text: string, aside: boolean) => void;
  onLeave?: () => void;
  disabled: boolean;
  thinking?: boolean;
  characterSheet?: CharacterSheetData | null;
  inventoryData?: InventoryData | null;
  mapData?: MapState | null;
  audio?: ReturnType<typeof useAudio>;
  nowPlaying?: NowPlaying | null;
  journalEntries?: JournalEntry[];
  knowledgeEntries?: KnowledgeEntry[];
  combatState?: CombatState | null;
  currentPlayerId?: string;
  activePlayerId?: string | null;
  activePlayerName?: string | null;
  waitingForPlayer?: string;
  turnStatusEntries?: TurnStatusEntry[];
  settingsProps?: SettingsPanelProps;
  activeOverlay: OverlayType;
  onOverlayChange: (overlay: OverlayType) => void;
}

export function GameLayout({
  messages,
  characters,
  onSend,
  onLeave,
  disabled,
  thinking,
  characterSheet = null,
  inventoryData = null,
  mapData = null,
  audio,
  nowPlaying = null,
  journalEntries,
  knowledgeEntries,
  combatState = null,
  currentPlayerId,
  activePlayerId,
  activePlayerName,
  waitingForPlayer,
  turnStatusEntries = [],
  settingsProps,
  activeOverlay,
  onOverlayChange,
}: GameLayoutProps) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const isTablet = breakpoint === "tablet";

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [partyVisible, setPartyVisible] = useState(true);

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

  // P key handler — toggles party panel on all breakpoints
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "p") return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      e.stopImmediatePropagation(); // prevent PartyPanel's own handler
      if (isMobile) {
        setOverlayOpen((prev) => !prev);
      } else {
        setPartyVisible((prev) => !prev);
      }
    };
    // Escape closes mobile overlay
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobile) {
        setOverlayOpen(false);
      }
    };
    // Use capture phase to fire before PartyPanel's handler
    document.addEventListener("keydown", handler, true);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("keydown", handler, true);
      document.removeEventListener("keydown", escHandler);
    };
  }, [isMobile]);

  // Close overlay when leaving mobile breakpoint
  useEffect(() => {
    if (!isMobile) {
      setOverlayOpen(false);
    }
  }, [isMobile]);

  // Toggle party sidebar visibility (desktop/tablet)
  const toggleParty = useCallback(() => setPartyVisible((prev) => !prev), []);

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
      knowledgeEntries={knowledgeEntries}
      settingsProps={settingsProps}
      activeOverlay={activeOverlay}
      onOverlayChange={onOverlayChange}
    >
      <div
        data-testid="game-layout"
        data-breakpoint={breakpoint}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="flex flex-1 min-h-0">
          {/* Sidebar — only in multiplayer, visible on desktop (expanded) and tablet (collapsed) */}
          {!isMobile && characters.length > 1 && partyVisible && (
            <PartyPanel
              characters={characters}
              collapsed={isTablet}
              onToggle={toggleParty}
              currentPlayerId={currentPlayerId}
              activePlayerId={activePlayerId}
            />
          )}

          {/* Main content area */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Top bar with leave button */}
            {onLeave && (
              <div className="flex items-center justify-end px-4 py-1 border-b border-border/30 bg-card/30 shrink-0">
                <button
                  onClick={onLeave}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/50"
                  title="Return to lobby"
                >
                  Leave Game
                </button>
              </div>
            )}
            <NarrativeView messages={messages} thinking={thinking} />

            {/* Character HUD — persistent single-player status bar */}
            {characters.length > 0 && characters.length <= 1 && (
              <div
                data-testid="character-hud"
                className="flex items-center gap-4 px-6 py-2 border-t border-border/30 bg-card/30 text-sm text-muted-foreground/70 shrink-0"
              >
                {characters.map((c) => (
                  <div key={c.player_id} className="flex items-center gap-3">
                    <span className="font-medium text-foreground/80">{c.name}</span>
                    <span>{c.class} Lv {c.level}</span>
                    <span className="flex items-center gap-1.5">
                      HP {c.hp}/{c.hp_max}
                      <span
                        data-testid="hp-bar"
                        className="inline-block w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden"
                      >
                        <span
                          className={`block h-full rounded-full transition-all ${
                            c.hp / c.hp_max > 0.66
                              ? "bg-emerald-500/80"
                              : c.hp / c.hp_max > 0.33
                                ? "bg-amber-500/80"
                                : "bg-red-500/80"
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, (c.hp / c.hp_max) * 100))}%` }}
                        />
                      </span>
                    </span>
                    {c.status_effects.length > 0 && (
                      <span className="text-accent-foreground/60">
                        {c.status_effects.join(", ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {characters.length > 1 && activePlayerName && (
              <div
                data-testid="turn-indicator"
                className="px-4 py-1.5 text-xs text-center text-muted-foreground/60 border-t border-border/30 bg-card/20 shrink-0 tracking-wide"
              >
                {turnStatusEntries.length > 0 ? (
                  <TurnStatusPanel
                    entries={turnStatusEntries}
                    localPlayerId={currentPlayerId}
                    gameMode="structured"
                  />
                ) : (
                  waitingForPlayer
                    ? `[ ${activePlayerName}'s turn ]`
                    : "[ Your turn ]"
                )}
              </div>
            )}
            <div className="border-t border-border/50 px-4 py-4 bg-card/50 shrink-0 max-w-5xl mx-auto w-full">
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
                waitingForPlayer={waitingForPlayer}
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
                  currentPlayerId={currentPlayerId}
                  activePlayerId={activePlayerId}
                />
              </div>
            </div>
          ) : (
            <div style={{ display: "none" }} aria-hidden="true">
              <PartyPanel
                characters={characters}
                collapsed={false}
                onToggle={toggleParty}
                currentPlayerId={currentPlayerId}
                activePlayerId={activePlayerId}
              />
            </div>
          )
        )}
      </div>
    </OverlayManager>
  );
}
