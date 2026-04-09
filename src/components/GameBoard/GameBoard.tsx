import { useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { ResponsiveGridLayout } from "react-grid-layout";
import { Settings, Lock, Unlock } from "lucide-react";
import "react-grid-layout/css/styles.css";

import { useRunningHeader } from "@/screens/NarrativeView";
import InputBar from "@/components/InputBar";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { useWhisper } from "@/hooks/useWhisper";
import { useGameBoardLayout } from "@/hooks/useGameBoardLayout";
import { useGameBoardHotkeys } from "@/hooks/useGameBoardHotkeys";
import { TurnStatusPanel, type TurnStatusEntry } from "@/components/TurnStatusPanel";
import type { ResourceThreshold } from "@/components/GenericResourceBar";
import type { CharacterSheetData } from "@/components/CharacterSheet";
import type { InventoryData } from "@/components/InventoryPanel";
import type { MapState } from "@/components/MapOverlay";
import type { ConfrontationData } from "@/components/ConfrontationOverlay";
import type { JournalEntry } from "@/components/JournalView";
import type { KnowledgeEntry, ItemDepletion, ResourceAlert } from "@/providers/GameStateProvider";
import type { SettingsPanelProps } from "@/components/SettingsPanel";
import type { ResourcePool } from "@/components/CharacterPanel";
import type { CharacterSummary } from "@/components/PartyPanel";
import type { useAudio } from "@/hooks/useAudio";
import type { NowPlaying } from "@/hooks/useAudioCue";
import type { GameMessage } from "@/types/protocol";
import type { LayoutMode } from "@/hooks/useLayoutMode";

import { WidgetWrapper } from "./WidgetWrapper";
import { WIDGET_REGISTRY, type WidgetId } from "./widgetRegistry";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { MobileTabView } from "./MobileTabView";
import { NarrativeWidget } from "./widgets/NarrativeWidget";
import { CharacterWidget } from "./widgets/CharacterWidget";
import { LoreWidget } from "./widgets/LoreWidget";
import { MapWidget } from "./widgets/MapWidget";
import { InventoryWidget } from "./widgets/InventoryWidget";
import { JournalWidget } from "./widgets/JournalWidget";
import { KnowledgeWidget } from "./widgets/KnowledgeWidget";
import { ConfrontationWidget } from "./widgets/ConfrontationWidget";
import { AudioWidget } from "./widgets/AudioWidget";
import { SettingsWidget } from "./widgets/SettingsWidget";
import { ImageGalleryWidget } from "./widgets/ImageGalleryWidget";

// react-grid-layout v2 exports ResponsiveGridLayout directly (no WidthProvider)

export interface GameBoardProps {
  messages: GameMessage[];
  characters: CharacterSummary[];
  onSend: (text: string, aside: boolean) => void;
  onLeave?: () => void;
  disabled: boolean;
  thinking?: boolean;
  layoutMode?: LayoutMode;
  characterSheet?: CharacterSheetData | null;
  inventoryData?: InventoryData | null;
  mapData?: MapState | null;
  audio?: ReturnType<typeof useAudio>;
  nowPlaying?: NowPlaying | null;
  journalEntries?: JournalEntry[];
  knowledgeEntries?: KnowledgeEntry[];
  confrontationData?: ConfrontationData | null;
  onBeatSelect?: (beatId: string) => void;
  currentPlayerId?: string;
  activePlayerId?: string | null;
  activePlayerName?: string | null;
  waitingForPlayer?: string;
  turnStatusEntries?: TurnStatusEntry[];
  settingsProps?: SettingsPanelProps;
  resources?: Record<string, ResourcePool> | null;
  genreSlug?: string;
  worldSlug?: string;
  depletions?: ItemDepletion[];
  resourceAlerts?: ResourceAlert[];
  onRequestJournal?: (category?: string) => void;
}

export function GameBoard({
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
  confrontationData,
  onBeatSelect,
  currentPlayerId,
  activePlayerId,
  activePlayerName,
  waitingForPlayer,
  turnStatusEntries = [],
  settingsProps,
  resources,
  genreSlug,
  worldSlug,
  depletions,
  resourceAlerts,
  onRequestJournal,
}: GameBoardProps) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // Layout management
  const {
    visibleWidgets,
    visibleLayouts,
    showWidget,
    hideWidget,
    toggleWidget,
    onLayoutChange,
  } = useGameBoardLayout(genreSlug, worldSlug);

  const [editMode, setEditMode] = useState(false);

  // Build available widgets set. Tabs are deterministic per-session — they
  // appear once the game is loaded (we're already past chargen by the time
  // GameBoard mounts), regardless of whether the player has accumulated any
  // entries yet. Per-player gating caused inconsistent panel sets between
  // players in the same session (e.g. Kael had Knowledge but Mira did not
  // because Mira had not yet had her first turn).
  const availableWidgets = useMemo(() => {
    const available = new Set<WidgetId>();
    available.add("narrative");
    available.add("settings");
    available.add("gallery");
    available.add("audio");
    available.add("knowledge");
    available.add("journal");
    available.add("lore");
    if (characterSheet) available.add("character");
    if (inventoryData) available.add("inventory");
    if (mapData) available.add("map");
    if (confrontationData) available.add("confrontation");
    return available;
  }, [characterSheet, inventoryData, mapData, confrontationData]);

  // Hotkeys
  useGameBoardHotkeys(toggleWidget, availableWidgets);

  // Confrontation auto-promote
  useEffect(() => {
    if (confrontationData && !visibleWidgets.has("confrontation")) {
      showWidget("confrontation");
    }
    if (!confrontationData && visibleWidgets.has("confrontation")) {
      hideWidget("confrontation");
    }
  }, [confrontationData, visibleWidgets, showWidget, hideWidget]);

  // Audio state (migrated from GameLayout)
  const [volumes, setVolumes] = useState({ music: 0.5, sfx: 0.5, voice: 0.5 });
  const [muted, setMuted] = useState({ music: false, sfx: false, voice: false });
  const [voicePlaybackRate, setVoicePlaybackRate] = useState(1.0);
  const [selectedVoice, setSelectedVoice] = useState(() =>
    localStorage.getItem("sq-selected-voice") ?? ""
  );

  const handleVoiceChange = useCallback((voice: string) => {
    setSelectedVoice(voice);
    localStorage.setItem("sq-selected-voice", voice);
  }, []);

  const handleVolumeChange = useCallback(
    (channel: string, value: number) => {
      setVolumes((prev) => ({ ...prev, [channel]: value }));
      audio?.setVolume(channel as "music" | "sfx" | "voice", value);
    },
    [audio],
  );

  const handlePlaybackRateChange = useCallback(
    (rate: number) => {
      setVoicePlaybackRate(rate);
      if (audio) audio.voicePlaybackRate = rate;
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

  const handleResourceThresholdCrossed = useCallback(
    (info: { resource: string; threshold: ResourceThreshold }) => {
      if (!genreSlug) {
        console.warn("[GameBoard] Resource threshold crossed but genreSlug is missing — cannot route SFX");
        return;
      }
      const sfxKey = `${genreSlug}_${info.resource.toLowerCase()}_threshold`;
      audio?.playSfx(sfxKey);
    },
    [audio, genreSlug],
  );

  // Mic & PTT
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
  const { transcribe } = useWhisper({ enabled: micEnabled });
  const ptt = usePushToTalk({
    transcribe,
    onConfirm: (text: string) => onSend(text, false),
    enabled: micEnabled,
  });
  useEffect(() => {
    if (!micEnabled) ptt.discard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micEnabled]);

  const { chapterTitle } = useRunningHeader(messages);

  // Render a widget by ID
  const renderWidgetContent = useCallback((id: WidgetId): ReactNode => {
    switch (id) {
      case "narrative":
        return <NarrativeWidget messages={messages} thinking={thinking} />;
      case "character":
        return characterSheet ? (
          <CharacterWidget
            character={characterSheet}
            resources={resources}
            genreSlug={genreSlug}
            knowledgeEntries={knowledgeEntries}
            onRequestJournal={onRequestJournal}
            onResourceThresholdCrossed={handleResourceThresholdCrossed}
            characters={characters}
            currentPlayerId={currentPlayerId}
            activePlayerId={activePlayerId}
          />
        ) : null;
      case "inventory":
        return inventoryData ? <InventoryWidget data={inventoryData} /> : null;
      case "lore":
        return (
          <LoreWidget
            character={characterSheet ?? null}
            knowledgeEntries={knowledgeEntries ?? []}
          />
        );
      case "map":
        return mapData ? <MapWidget mapData={mapData} /> : null;
      case "journal":
        return journalEntries ? <JournalWidget entries={journalEntries} /> : null;
      case "knowledge":
        return knowledgeEntries ? <KnowledgeWidget entries={knowledgeEntries} /> : null;
      case "confrontation":
        return confrontationData ? (
          <ConfrontationWidget data={confrontationData} onBeatSelect={onBeatSelect} />
        ) : null;
      case "audio":
        return (
          <AudioWidget
            nowPlaying={nowPlaying}
            volumes={volumes}
            muted={muted}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            voicePlaybackRate={voicePlaybackRate}
            onPlaybackRateChange={handlePlaybackRateChange}
            selectedVoice={selectedVoice}
            onVoiceChange={handleVoiceChange}
          />
        );
      case "settings":
        return settingsProps ? <SettingsWidget {...settingsProps} /> : null;
      case "gallery":
        return <ImageGalleryWidget />;
      default:
        return null;
    }
  }, [messages, thinking, characterSheet, inventoryData, mapData, journalEntries,
      knowledgeEntries, confrontationData, onBeatSelect, nowPlaying, volumes, muted,
      handleVolumeChange, handleMuteToggle, voicePlaybackRate, handlePlaybackRateChange,
      selectedVoice, handleVoiceChange, settingsProps, resources, genreSlug,
      onRequestJournal, handleResourceThresholdCrossed, characters, currentPlayerId,
      activePlayerId]);

  // InputBar component (shared between desktop grid and mobile tab view)
  const inputBar = (
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
  );

  // Mobile fallback
  if (isMobile) {
    return (
      <MobileTabView
        renderWidget={renderWidgetContent}
        availableWidgets={availableWidgets}
      >
        {inputBar}
      </MobileTabView>
    );
  }

  // Desktop/tablet grid layout
  const visibleWidgetIds = Array.from(visibleWidgets).filter(id => availableWidgets.has(id));

  return (
    <div data-testid="game-board" className="flex flex-col h-screen overflow-hidden">
      <BackgroundCanvas />

      {/* Running header */}
      <div
        data-testid="running-header"
        className="flex items-baseline justify-between px-6 py-2 border-b border-border/50 bg-[var(--surface,theme(colors.card))] shrink-0 z-10"
      >
        <span className="text-xs tracking-widest uppercase text-muted-foreground/50 font-light">
          {chapterTitle ?? "\u00A0"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditMode(prev => !prev)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted/50"
            title={editMode ? "Lock layout" : "Unlock layout"}
            aria-label={editMode ? "Lock layout" : "Unlock layout"}
          >
            {editMode ? <Unlock className="size-4" /> : <Lock className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => toggleWidget("settings")}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted/50"
            title="Settings (S)"
            aria-label="Settings"
          >
            <Settings className="size-4" />
          </button>
          {onLeave && (
            <button
              type="button"
              onClick={onLeave}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/50"
              title="Return to lobby"
            >
              Leave
            </button>
          )}
        </div>
      </div>

      {/* Depletion/resource alerts */}
      {depletions && depletions.length > 0 && (
        <div data-testid="depletion-alerts" className="px-4 py-2 space-y-1 shrink-0">
          {depletions.map((d, i) => (
            <div key={`depletion-${i}`} data-testid={`depletion-${d.item_name}`} className="text-sm px-3 py-1.5 rounded bg-destructive/15 text-destructive border border-destructive/30">
              <span className="font-medium">{d.item_name}</span> depleted
            </div>
          ))}
        </div>
      )}
      {resourceAlerts && resourceAlerts.length > 0 && (
        <div data-testid="resource-alerts" className="px-4 py-2 space-y-1 shrink-0">
          {resourceAlerts.map((r, i) => (
            <div key={`resource-${i}`} data-testid={`resource-alert-${r.resource_name}`} className="text-sm px-3 py-1.5 rounded bg-warning/15 text-warning border border-warning/30">
              <span className="font-medium">{r.resource_name}</span> at minimum ({r.min_value})
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-auto px-2">
        <ResponsiveGridLayout
          layouts={visibleLayouts}
          breakpoints={{ lg: 1200, md: 768, sm: 480 }}
          cols={{ lg: 12, md: 8, sm: 6 }}
          rowHeight={60}
          margin={[12, 12]}
          containerPadding={[8, 8]}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".widget-drag-handle"
          onLayoutChange={onLayoutChange}
          compactType="vertical"
        >
          {visibleWidgetIds.map((id) => {
            const def = WIDGET_REGISTRY[id];
            return (
              <div key={id}>
                <WidgetWrapper
                  widgetId={id}
                  title={def.label}
                  closable={def.closable}
                  onClose={() => hideWidget(id)}
                >
                  {renderWidgetContent(id)}
                </WidgetWrapper>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </div>

      {/* Turn status */}
      {characters.length > 1 && activePlayerName && (
        <div
          data-testid="turn-indicator"
          className="px-4 py-1.5 text-xs text-center text-muted-foreground/60 border-t border-border/30 bg-card/20 shrink-0"
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

      {/* InputBar — pinned to bottom */}
      <div className="input-area border-t border-border/50 px-4 py-4 bg-card/50 shrink-0 max-w-5xl mx-auto w-full">
        {inputBar}
      </div>
    </div>
  );
}
