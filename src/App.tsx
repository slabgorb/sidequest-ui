import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectScreen } from "@/screens/ConnectScreen";
import { CharacterCreation, type CreationScene } from "@/components/CharacterCreation/CharacterCreation";
import { GameBoard } from "@/components/GameBoard/GameBoard";
import { ImageBusProvider } from "@/providers/ImageBusProvider";
import type { ResourcePool } from "@/components/CharacterPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { GameStateProvider, useGameState } from "@/providers/GameStateProvider";
import { useGameSocket } from "@/hooks/useGameSocket";
import { useGenreTheme } from "@/hooks/useGenreTheme";
import { useChromeArchetype } from "@/hooks/useChromeArchetype";
import { useAudioCue } from "@/hooks/useAudioCue";
import { useAudio } from "@/hooks/useAudio";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { useStateMirror } from "@/hooks/useStateMirror";
import { useSlashCommands } from "@/hooks/useSlashCommands";
import { useGameBoardLayout } from "@/hooks/useGameBoardLayout";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { MessageType, type GameMessage } from "@/types/protocol";
import type { CharacterSheetData } from "@/components/CharacterSheet";
import type { InventoryData } from "@/components/InventoryPanel";
import type { MapState } from "@/components/MapOverlay";
import type { CharacterSummary } from "@/components/PartyPanel";
import type { ConfrontationData } from "@/components/ConfrontationOverlay";
import type { TurnStatusEntry } from "@/components/TurnStatusPanel";

const LazyDashboard = lazy(() =>
  import("@/components/Dashboard/DashboardApp").then((m) => ({ default: m.DashboardApp })),
);

type SessionPhase = "connect" | "creation" | "game";

const SESSION_KEY = "sidequest-session";

interface SavedSession {
  playerName: string;
  genre: string;
  world: string;
}

function loadSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedSession;
    if (data.playerName && data.genre && data.world) return data;
    return null;
  } catch {
    return null;
  }
}

function saveSession(playerName: string, genre: string, world: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ playerName, genre, world }));
  } catch {
    // non-critical
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // non-critical
  }
}

// Bug 2: HMR state persistence — survive Vite hot reload without losing game progress
const HMR_STATE_KEY = "sidequest-hmr-state";

interface HmrState {
  messages: GameMessage[];
  sessionPhase: SessionPhase;
  character: Record<string, unknown> | null;
}

function loadHmrState(): HmrState | null {
  try {
    const raw = sessionStorage.getItem(HMR_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HmrState;
  } catch {
    return null;
  }
}

function saveHmrState(state: HmrState): void {
  try {
    // Keep only the last 100 messages to avoid quota issues
    const trimmed = {
      ...state,
      messages: state.messages.slice(-100),
    };
    sessionStorage.setItem(HMR_STATE_KEY, JSON.stringify(trimmed));
  } catch {
    // non-critical — quota exceeded
  }
}

function AppInner() {
  // Bug 2: Hydrate from sessionStorage on mount (HMR recovery)
  const hmrState = loadHmrState();
  const [messages, setMessages] = useState<GameMessage[]>(hmrState?.messages ?? []);
  const [connected, setConnected] = useState(false);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>(hmrState?.sessionPhase ?? "connect");
  const [creationScene, setCreationScene] = useState<CreationScene | null>(null);
  const [creationLoading, setCreationLoading] = useState(false);
  const [character, setCharacter] = useState<Record<string, unknown> | null>(hmrState?.character ?? null);
  const [genres, setGenres] = useState<string[]>([]);
  const [genreError, setGenreError] = useState(false);
  const [currentGenre, setCurrentGenre] = useState<string | null>(hmrState ? loadSession()?.genre ?? null : null);
  const [thinking, setThinking] = useState(false);
  // Unified input lock: false after submit, true when narration arrives.
  // Replaces the old thinking/activePlayerName/isMyTurn three-lock system.
  const [canType, setCanType] = useState(true);
  const sessionPhaseRef = useRef<SessionPhase>("connect");
  const autoReconnectAttempted = useRef(false);

  // Overlay data from server messages
  const [characterSheet, setCharacterSheet] = useState<CharacterSheetData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [mapData, setMapData] = useState<MapState | null>(null);

  // GameBoard layout — widget visibility managed internally by useGameBoardLayout
  const { toggleWidget } = useGameBoardLayout(currentGenre ?? undefined);

  // Layout mode — client-only, persisted to localStorage
  const { mode: layoutMode } = useLayoutMode();


  // Party status — richer than state_delta (includes portrait_url)
  const [partyMembers, setPartyMembers] = useState<CharacterSummary[]>([]);

  // Genre resources extracted from PARTY_STATUS (e.g., Luck, Humanity, Fuel)
  const [partyResources, setPartyResources] = useState<Record<string, ResourcePool>>({});

  // Multiplayer identity — who this tab is and whose turn it is
  const [connectedPlayerName, setConnectedPlayerName] = useState<string>(
    () => loadSession()?.playerName ?? "",
  );
  const [activePlayerName, setActivePlayerName] = useState<string | null>(null);
  const [turnStatusEntries, setTurnStatusEntries] = useState<TurnStatusEntry[]>([]);

  // Confrontation state from CONFRONTATION messages (structured encounters)
  const [confrontationData, setConfrontationData] = useState<ConfrontationData | null>(null);

  // Bug 2: Persist critical state to sessionStorage for HMR survival
  useEffect(() => {
    saveHmrState({ messages, sessionPhase, character });
  }, [messages, sessionPhase, character]);

  // Fetch available genres from the server — never hardcode
  const fetchGenres = useCallback(() => {
    setGenreError(false);
    fetch("/api/genres")
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data) => {
        const keys = Object.keys(data).sort();
        if (keys.length === 0) throw new Error("no genres");
        setGenres(keys);
      })
      .catch(() => {
        setGenres([]);
        setGenreError(true);
      });
  }, []);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  // Audio engine — unified mixer for music, SFX, ambience
  const audio = useAudio();

  // Genre theme CSS must process in ALL phases, not just game view
  useGenreTheme(messages);

  // Chrome archetype: structural CSS (fonts, borders) based on genre family
  useChromeArchetype(currentGenre);

  // State mirror: process state_delta from server messages into GameStateContext
  useStateMirror(messages);

  // Audio cue processing — runs in all phases so cues aren't missed
  const nowPlaying = useAudioCue(messages, audio.engine);

  // Slash commands — resolve locally from cached state, zero round-trip
  const { execute: executeSlashCommand } = useSlashCommands();

  // Game state for mapping to UI components
  const { state: gameState } = useGameState();

  const handleMessage = useCallback((msg: GameMessage) => {
    // Thinking indicator: show on THINKING, hide on first content
    if (msg.type === MessageType.THINKING) {
      setThinking(true);
      return;
    }

    // Narration flows straight into the message feed now that TTS is gone.
    if (msg.type === MessageType.NARRATION || msg.type === MessageType.NARRATION_END) {
      setThinking(false);
      setMessages((prev) => [...prev, msg]);
      return;
    }

    if (msg.type === MessageType.SESSION_EVENT) {
      const event = msg.payload.event as string;
      // Reset pending narration state on reconnect — previous turn's request
      // is lost when the server restarts, so clear the spinner.
      if (event === "connected" || event === "ready") {
        setThinking(false);
        setCanType(true);
      }
      if (event === "connected" && !msg.payload.has_character) {
        sessionPhaseRef.current = "creation";
        setSessionPhase("creation");
      } else if (event === "ready") {
        // On reconnect (phase not yet "game"), clear stale messages to
        // avoid duplicates.  On first connect after chargen,
        // CHARACTER_CREATION "complete" already set phase to "game" —
        // DON'T clear, or the opening narration from the auto-first-turn
        // gets wiped.
        const isReconnect = sessionPhaseRef.current !== "game";
        sessionPhaseRef.current = "game";
        setSessionPhase("game");
        if (isReconnect) {
          setMessages((prev) =>
            prev.filter((m) => m.type === MessageType.SESSION_EVENT),
          );
        }
      }
      // Let theme_css events through to the messages array for useGenreTheme
      if (event !== "theme_css") return;
    }

    if (msg.type === MessageType.CHARACTER_CREATION) {
      // Ignore creation messages if already in game phase
      if (sessionPhaseRef.current === "game") return;

      const phase = msg.payload.phase as string;
      if (phase === "scene" || phase === "confirmation") {
        setCreationScene(msg.payload as unknown as CreationScene);
        setCreationLoading(false);
      } else if (phase === "complete") {
        const charData = msg.payload.character as Record<string, unknown>;
        setCharacter(charData);
        setCreationScene(null);
        setCreationLoading(false);
        sessionPhaseRef.current = "game";
        setSessionPhase("game");
      }
      return;
    }

    // Track whose turn it is — gates input in multiplayer.
    // TURN_STATUS is state-only, not rendered in narration feed.
    // The turn strip in GameBoard shows whose turn it is.
    if (msg.type === MessageType.TURN_STATUS) {
      const name = msg.payload.player_name as string | undefined;
      const status = msg.payload.status as string | undefined;
      const playerId = msg.payload.player_id as string | undefined;

      if (name && status === "active") {
        setActivePlayerName(name);
      } else if (status === "resolved") {
        setActivePlayerName(null);
        setTurnStatusEntries([]);
      }

      // Update per-player turn status entries for TurnStatusPanel
      if (playerId && name && status) {
        const mapped: TurnStatusEntry["status"] =
          status === "submitted" ? "submitted" :
          status === "auto_resolved" ? "auto_resolved" :
          "pending";
        setTurnStatusEntries((prev) => {
          const next = prev.filter((e) => e.player_id !== playerId);
          next.push({ player_id: playerId, character_name: name, status: mapped });
          return next;
        });
      }

      // Batch entries support (server may send full list)
      const entries = msg.payload.entries as Array<Record<string, unknown>> | undefined;
      if (entries) {
        setTurnStatusEntries(
          entries.map((e) => ({
            player_id: (e.player_id as string) ?? "",
            character_name: (e.character_name as string) ?? (e.player_name as string) ?? "",
            status: (e.status as TurnStatusEntry["status"]) ?? "pending",
          })),
        );
      }

      return;
    }

    // Capture party status — single source of truth for party + per-character
    // state. As of 2026-04 PartyMember also carries `sheet` (race/stats/
    // abilities/backstory/etc.) and `inventory` (items/gold) facets, replacing
    // the deleted CHARACTER_SHEET and INVENTORY message types. We fan out the
    // local player's slice into characterSheet / inventoryData here.
    if (msg.type === MessageType.PARTY_STATUS) {
      const members = (msg.payload.members as Array<Record<string, unknown>>) ?? [];
      const mapped = members.map((m) => ({
        player_id: (m.player_id as string) ?? "",
        name: (m.name as string) ?? "",
        character_name: (m.character_name as string) ?? (m.name as string) ?? "",
        hp: (m.current_hp as number) ?? 0,
        hp_max: (m.max_hp as number) ?? 0,
        status_effects: (m.statuses as string[]) ?? [],
        class: (m.class as string) ?? "",
        level: (m.level as number) ?? 1,
        portrait_url: (m.portrait_url as string) || undefined,
        current_location: (m.current_location as string) ?? "",
      }));
      // Deduplicate by player_id (HMR/reconnect can re-register players)
      const seen = new Set<string>();
      const deduped = mapped.filter((m) => {
        if (seen.has(m.player_id)) return false;
        seen.add(m.player_id);
        return true;
      });
      setPartyMembers(deduped);

      // Fan out the local player's sheet + inventory facets. The local
      // player is identified by matching `name` against connectedPlayerName,
      // then falling back to the first member (single-player case).
      const localName = connectedPlayerName;
      const rawLocal =
        (localName && members.find((m) => (m.name as string) === localName)) ||
        members[0];
      if (rawLocal) {
        const sheetFacet = rawLocal.sheet as Record<string, unknown> | undefined;
        if (sheetFacet) {
          // Assemble the UI-facing CharacterSheetData from the PartyMember
          // root fields (name/class/level/portrait_url/current_location) plus
          // the nested sheet facet (stats/abilities/backstory).
          const built: CharacterSheetData = {
            name: (rawLocal.character_name as string) ?? (rawLocal.name as string) ?? "",
            class: (rawLocal.class as string) ?? "",
            level: (rawLocal.level as number) ?? 1,
            stats: (sheetFacet.stats as Record<string, number>) ?? {},
            abilities: (sheetFacet.abilities as string[]) ?? [],
            backstory: (sheetFacet.backstory as string) ?? "",
            portrait_url: (rawLocal.portrait_url as string) || undefined,
            current_location: (rawLocal.current_location as string) ?? "",
          };
          setCharacterSheet(built);
        }
        const invFacet = rawLocal.inventory as Record<string, unknown> | undefined;
        if (invFacet) {
          setInventoryData(invFacet as unknown as InventoryData);
        }
      }

      // Extract genre resources from PARTY_STATUS (e.g., Luck, Humanity, Fuel)
      const resources = msg.payload.resources as Record<string, ResourcePool> | undefined;
      if (resources && typeof resources === "object") {
        setPartyResources(resources);
      }

      return;
    }

    // Capture overlay data from server — these update the panels/overlays
    if (msg.type === MessageType.MAP_UPDATE) {
      setMapData(msg.payload as unknown as MapState);
      return;
    }
    // COMBAT_EVENT handler removed in story 28-9
    if (msg.type === MessageType.CONFRONTATION) {
      const payload = msg.payload as unknown as ConfrontationData;
      setConfrontationData(payload.active !== false ? payload : null);
      return;
    }

    // Server says the session is gone — re-send the connect handshake so the
    // server can restore (or start fresh).  This happens after a server restart
    // when the client's WebSocket auto-reconnects but never re-sent the connect.
    if (msg.type === MessageType.ERROR && msg.payload.reconnect_required) {
      const saved = loadSession();
      if (saved && sendRef.current) {
        sendRef.current({
          type: MessageType.SESSION_EVENT,
          payload: { event: "connect", player_name: saved.playerName, genre: saved.genre, world: saved.world },
          player_id: "",
        });
      }
      return; // Don't show this error in the narrative
    }

    // WebRTC signaling — route to useVoiceChat, never display as narrative
    if (msg.type === MessageType.VOICE_SIGNAL) {
      const from = msg.payload.from as string | undefined;
      const signal = msg.payload.signal as Record<string, unknown> | undefined;
      if (from && signal) {
        voiceHandleSignalRef.current(from, signal);
      }
      return;
    }

    setMessages((prev) => [...prev, msg]);
  }, []);

  const voiceHandleSignalRef = useRef<(peerId: string, signal: Record<string, unknown>) => void>(() => {});
  const sendRef = useRef<typeof send | null>(null);

  const { connect, disconnect, send, readyState, error } = useGameSocket({
    url: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`,
    onMessage: handleMessage,
  });
  // eslint-disable-next-line react-hooks/immutability
  sendRef.current = send;

  // WebRTC voice chat — wire signaling through the game server
  const voiceChat = useVoiceChat({
    peers: [],
    onSignal: useCallback((peerId: string, signal: Record<string, unknown>) => {
      sendRef.current?.({
        type: MessageType.VOICE_SIGNAL,
        payload: { target: peerId, signal },
        player_id: "",
      });
    }, []),
  });
  // eslint-disable-next-line react-hooks/immutability
  voiceHandleSignalRef.current = voiceChat.handleSignal;

  const handleConnect = useCallback(
    (playerName: string, genre: string, world: string) => {
      saveSession(playerName, genre, world);
      setCurrentGenre(genre);
      setConnectedPlayerName(playerName);
      connect();
      setConnected(true);
      setTimeout(() => {
        send({
          type: MessageType.SESSION_EVENT,
          payload: { event: "connect", player_name: playerName, genre, world },
          player_id: "",
        });
      }, 300);
    },
    [connect, send, audio.engine],
  );

  const handleCreationRespond = useCallback(
    (payload: Record<string, unknown>) => {
      send({
        type: MessageType.CHARACTER_CREATION,
        payload,
        player_id: "",
      });
      setCreationLoading(true);
    },
    [send],
  );

  // Send handler with slash command interception
  const handleSend = useCallback(
    (text: string, aside: boolean) => {
      // Try slash commands first — overlay triggers resolve locally
      const slashResult = executeSlashCommand(text);
      if (slashResult.handled) {
        if (slashResult.widget) {
          toggleWidget(slashResult.widget);
        }
        if (slashResult.messages.length > 0) {
          setMessages((prev) => [...prev, ...slashResult.messages]);
        }
        return;
      }

      // Never send slash-prefixed text to the server as a game action.
      // Unrecognised commands are swallowed client-side to prevent
      // "Unexpected message in Playing state" errors from the backend.
      if (text.trimStart().startsWith('/')) {
        return;
      }

      const msg: GameMessage = {
        type: MessageType.PLAYER_ACTION,
        payload: { action: text, aside },
        player_id: "",
      };
      setMessages((prev) => [...prev, msg]);
      send(msg);
      setCanType(false); // Sealed — wait for narration before typing again
    },
    [send, executeSlashCommand],
  );

  const handleRequestJournal = useCallback(
    (category?: string) => {
      send({
        type: MessageType.JOURNAL_REQUEST,
        payload: {
          ...(category ? { category } : {}),
          sort_by: 'time',
        },
        player_id: '',
      });
    },
    [send],
  );

  // Bug 6: Leave game — disconnect, clear state, return to lobby
  const handleLeave = useCallback(() => {
    disconnect();
    clearSession();
    setConnected(false);
    setMessages([]);
    setCharacter(null);
    setCreationScene(null);
    setThinking(false);
    setCharacterSheet(null);
    setInventoryData(null);
    setMapData(null);
    setPartyMembers([]);
    setConnectedPlayerName("");
    setActivePlayerName(null);
    setCanType(true);
    setConfrontationData(null);
    sessionPhaseRef.current = "connect";
    setSessionPhase("connect");
    autoReconnectAttempted.current = false;
  }, [disconnect]);

  // Unlock AudioContext on first user gesture (click or keypress).
  // Chrome's autoplay policy blocks audio until a user interaction occurs.
  // We cannot call ensureResumed() eagerly or from auto-reconnect.
  useEffect(() => {
    const engine = audio.engine;
    if (!engine) return;

    const unlock = () => {
      engine.ensureResumed();
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };

    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });

    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [audio.engine]);

  // Auto-reconnect on page refresh if we have a saved session.
  // This must run regardless of sessionPhase — after a server restart the
  // client's HMR state may say "game" but the WebSocket is dead and the
  // server has no session.  Re-sending the connect handshake lets the server
  // restore the session (or route to character creation if there's nothing
  // saved in SQLite).
  useEffect(() => {
    if (autoReconnectAttempted.current) return;
    const saved = loadSession();
    if (!saved) return;
    autoReconnectAttempted.current = true;
    handleConnect(saved.playerName, saved.genre, saved.world);
  }, [handleConnect]);

  // WebSocket reconnect handler: when the socket transitions to OPEN after
  // being previously connected, clear stale state and re-handshake.
  // Without this, `thinking` gets stuck true after a server crash (the server
  // never sent the narration response that would clear it), and the connect
  // handshake is never re-sent so the server stays in AwaitingConnect.
  const prevReadyState = useRef(readyState);
  useEffect(() => {
    const wasDisconnected = prevReadyState.current !== WebSocket.OPEN;
    prevReadyState.current = readyState;
    if (readyState === WebSocket.OPEN && wasDisconnected && connected) {
      setThinking(false);
      setCanType(true);
      const saved = loadSession();
      if (saved) {
        send({
          type: MessageType.SESSION_EVENT,
          payload: { event: "connect", player_name: saved.playerName, genre: saved.genre, world: saved.world },
          player_id: "",
        });
      }
    }
  }, [readyState, connected, send]);

  // If connection fails, clear saved session so we don't loop
  useEffect(() => {
    if (error) {
      clearSession();
    }
  }, [error]);

  const isConnecting = connected && readyState !== WebSocket.OPEN;
  const socketError = error ? "Connection failed. Is the game server running?" : null;

  // Build game messages including character info
  const gameMessages = character
    ? [
        ...messages,
      ]
    : messages;

  // Map characters for PartyPanel — prefer PARTY_STATUS (has portrait_url), fall back to state_delta
  const characters: CharacterSummary[] = useMemo(
    () =>
      partyMembers.length > 0
        ? partyMembers
        : gameState.characters.map((c) => ({
            player_id: "",
            name: c.name,
            character_name: c.name,
            hp: c.hp,
            hp_max: c.max_hp,
            status_effects: c.statuses,
            class: "",
            level: 1,
            current_location: "",
          })),
    [partyMembers, gameState.characters],
  );

  // Turn gating — two multiplayer models:
  // 1. Sequential (FreePlay): server sends "active" for the acting player, others wait
  // 2. Sealed-letter (Structured): ALL players submit simultaneously, no "active" player
  //
  // In sealed-letter mode, activePlayerName stays null. Input is disabled only
  // when THIS player has already submitted (tracked via turnStatusEntries).
  const isMultiplayer = partyMembers.length > 1 || turnStatusEntries.length > 0 || activePlayerName !== null;
  const currentPlayerId = useMemo(
    () => partyMembers.find((m) => m.name === connectedPlayerName)?.player_id ?? null,
    [partyMembers, connectedPlayerName],
  );
  const activePlayerId = useMemo(
    () => activePlayerName ? (partyMembers.find((m) => m.name === activePlayerName)?.player_id ?? null) : null,
    [partyMembers, activePlayerName],
  );
  // Sealed-letter: have I already submitted this turn?
  const haveISubmitted = currentPlayerId
    ? turnStatusEntries.some((e) => e.player_id === currentPlayerId && e.status === "submitted")
    : false;
  // Sequential: is someone else active? Sealed-letter: have I submitted?
  const isMyTurn = !isMultiplayer
    || (!activePlayerName && !haveISubmitted)
    || activePlayerName === connectedPlayerName;
  const waitingForPlayer = isMultiplayer && !isMyTurn
    ? (activePlayerName ?? (haveISubmitted ? "other players" : undefined))
    : undefined;

  return (
    <div data-testid="app" className="min-h-screen flex flex-col bg-background text-foreground">
      <main className="flex flex-col flex-1 min-h-0">
        {sessionPhase === "connect" && (
          <ErrorBoundary name="Connect">
            <ConnectScreen
              onConnect={handleConnect}
              genres={genres}
              isConnecting={isConnecting}
              error={socketError}
              genreError={genreError}
              onRetryGenres={fetchGenres}
            />
          </ErrorBoundary>
        )}
        {sessionPhase === "creation" && (
          <ErrorBoundary name="Character Creation">
            <CharacterCreation
              scene={creationScene}
              loading={creationLoading}
              onRespond={handleCreationRespond}
            />
          </ErrorBoundary>
        )}
        {sessionPhase === "game" && (
          <ErrorBoundary name="Game">
            <ImageBusProvider messages={gameMessages}>
              <GameBoard
                // `key` forces React to unmount + remount GameBoard (and with
                // it the Dockview instance) on genre switch, so the canonical
                // layout built in onDockviewReady always runs fresh instead
                // of reusing a dragged/reordered in-memory state. Fixes tab
                // order drift between genres per sq-playtest 2026-04-09.
                key={currentGenre ?? "no-genre"}
                messages={gameMessages}
                characters={characters}
                onSend={handleSend}
                onLeave={handleLeave}
                disabled={readyState !== WebSocket.OPEN || !canType}
                thinking={thinking}
                characterSheet={characterSheet}
                inventoryData={inventoryData}
                mapData={mapData}
                audio={audio}
                nowPlaying={nowPlaying}
                journalEntries={gameState.journal}
                knowledgeEntries={gameState.knowledge}
                depletions={gameState.depletions}
                resourceAlerts={gameState.resourceAlerts}
                onRequestJournal={handleRequestJournal}
                confrontationData={confrontationData}
                currentPlayerId={currentPlayerId ?? undefined}
                activePlayerId={activePlayerId}
                activePlayerName={activePlayerName}
                waitingForPlayer={!canType && isMultiplayer ? "other players" : undefined}
                resources={partyResources}
                genreSlug={currentGenre ?? undefined}
                turnStatusEntries={turnStatusEntries}
                layoutMode={layoutMode}
              />
            </ImageBusProvider>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

function App() {
  const [isDashboard, setIsDashboard] = useState(
    () => window.location.hash === "#/dashboard",
  );

  useEffect(() => {
    const onHashChange = () => {
      setIsDashboard(window.location.hash === "#/dashboard");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (isDashboard) {
    return (
      <Suspense fallback={<div style={{ color: "#e0e0e0", background: "#1a1a2e", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading dashboard...</div>}>
        <LazyDashboard />
      </Suspense>
    );
  }

  return (
    <ThemeProvider>
      <GameStateProvider>
        <AppInner />
      </GameStateProvider>
    </ThemeProvider>
  );
}

export default App;
