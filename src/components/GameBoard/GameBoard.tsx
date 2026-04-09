import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
  type IDockviewPanelProps,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import "@/styles/dockview-theme.css";

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
import type { ResourcePool } from "@/components/CharacterPanel";
import type { CharacterSummary } from "@/components/PartyPanel";
import type { useAudio } from "@/hooks/useAudio";
import type { NowPlaying } from "@/hooks/useAudioCue";
import type { GameMessage } from "@/types/protocol";
import type { LayoutMode } from "@/hooks/useLayoutMode";

import { WIDGET_REGISTRY, type WidgetId } from "./widgetRegistry";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { MobileTabView } from "./MobileTabView";
import { NarrativeWidget } from "./widgets/NarrativeWidget";
import { CharacterWidget } from "./widgets/CharacterWidget";
import { MapWidget } from "./widgets/MapWidget";
import { InventoryWidget } from "./widgets/InventoryWidget";
import { JournalWidget } from "./widgets/JournalWidget";
import { KnowledgeWidget } from "./widgets/KnowledgeWidget";
import { ConfrontationWidget } from "./widgets/ConfrontationWidget";
import { AudioWidget } from "./widgets/AudioWidget";
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
  resources,
  genreSlug,
  worldSlug,
  depletions,
  resourceAlerts,
  onRequestJournal,
}: GameBoardProps) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  // Layout management — dockview handles its own layout state internally,
  // but we still use the show/hide tracking for data-gating widgets.
  const {
    visibleWidgets,
    showWidget,
    hideWidget,
    toggleWidget,
  } = useGameBoardLayout(genreSlug, worldSlug);

  const dockviewApiRef = useRef<DockviewApi | null>(null);

  // Build available widgets set (data-gated widgets only visible when data exists)
  const availableWidgets = useMemo(() => {
    const available = new Set<WidgetId>();
    available.add("narrative");
    available.add("gallery");
    available.add("audio");
    if (characterSheet) available.add("character");
    if (inventoryData) available.add("inventory");
    if (mapData) available.add("map");
    if (journalEntries && journalEntries.length > 0) available.add("journal");
    if (knowledgeEntries && knowledgeEntries.length > 0) available.add("knowledge");
    if (confrontationData) available.add("confrontation");
    return available;
  }, [characterSheet, inventoryData, mapData, journalEntries, knowledgeEntries, confrontationData]);

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
            inventory={inventoryData}
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
      case "gallery":
        return <ImageGalleryWidget />;
      default:
        return null;
    }
  }, [messages, thinking, characterSheet, inventoryData, mapData, journalEntries,
      knowledgeEntries, confrontationData, onBeatSelect, nowPlaying, volumes, muted,
      handleVolumeChange, handleMuteToggle, voicePlaybackRate, handlePlaybackRateChange,
      selectedVoice, handleVoiceChange, resources, genreSlug,
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

  // Dockview panel adapter — receives panelId from params, renders the widget
  const PanelAdapter = useCallback(
    ({ params }: IDockviewPanelProps<{ panelId: WidgetId }>) => {
      return (
        <div className="dockview-panel-content" data-widget={params.panelId}>
          {renderWidgetContent(params.panelId)}
        </div>
      );
    },
    [renderWidgetContent],
  );

  const dockviewComponents = useMemo(() => ({ PanelAdapter }), [PanelAdapter]);

  // Build the initial dockview layout when the API is ready.
  // Two-region default: narrative on the left, supporting panels (character/map/gallery/audio) tabbed on the right.
  const onDockviewReady = useCallback((event: DockviewReadyEvent) => {
    const api = event.api;
    dockviewApiRef.current = api;

    // Always-present panels
    const narrative = api.addPanel({
      id: "narrative",
      component: "PanelAdapter",
      params: { panelId: "narrative" as WidgetId },
      title: WIDGET_REGISTRY.narrative.label,
    });

    // Right-side group: stack supporting panels as tabs
    const rightGroupOrder: WidgetId[] = ["character", "map", "gallery", "audio"];
    let rightFirst: ReturnType<typeof api.addPanel> | null = null;
    for (const id of rightGroupOrder) {
      if (!availableWidgets.has(id)) continue;
      const def = WIDGET_REGISTRY[id];
      if (!rightFirst) {
        rightFirst = api.addPanel({
          id,
          component: "PanelAdapter",
          params: { panelId: id },
          position: { referencePanel: narrative.id, direction: "right" },
          title: def.label,
        });
      } else {
        api.addPanel({
          id,
          component: "PanelAdapter",
          params: { panelId: id },
          position: { referencePanel: rightFirst.id },
          title: def.label,
        });
      }
    }
  }, [availableWidgets]);

  // Sync widget visibility with dockview panels (add/remove as data-gates change).
  useEffect(() => {
    const api = dockviewApiRef.current;
    if (!api) return;

    const dockviewIds = new Set(api.panels.map((p) => p.id));

    // Remove panels that became unavailable
    for (const id of dockviewIds) {
      if (!availableWidgets.has(id as WidgetId)) {
        const panel = api.getPanel(id);
        if (panel) api.removePanel(panel);
      }
    }

    // Add panels that became available
    for (const id of availableWidgets) {
      if (!dockviewIds.has(id)) {
        const def = WIDGET_REGISTRY[id];
        api.addPanel({
          id,
          component: "PanelAdapter",
          params: { panelId: id },
          title: def.label,
        });
      }
    }
  }, [availableWidgets]);

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

      {/* Dockview workspace — tabbed groups, drag tabs between groups, no z-index */}
      <div className="sidequest-dockview flex-1 min-h-0">
        <DockviewReact
          className="dockview-container dockview-theme-abyss"
          onReady={onDockviewReady}
          components={dockviewComponents}
          watermarkComponent={() => null}
        />
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
