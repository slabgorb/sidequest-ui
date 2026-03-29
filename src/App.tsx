import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectScreen } from "@/screens/ConnectScreen";
import { CharacterCreation, type CreationScene } from "@/components/CharacterCreation/CharacterCreation";
import { GameLayout } from "@/components/GameLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { GameStateProvider, useGameState } from "@/providers/GameStateProvider";
import { useGameSocket } from "@/hooks/useGameSocket";
import { useGenreTheme } from "@/hooks/useGenreTheme";
import { useAudioCue } from "@/hooks/useAudioCue";
import { useAudio } from "@/hooks/useAudio";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { useStateMirror } from "@/hooks/useStateMirror";
import { useSlashCommands } from "@/hooks/useSlashCommands";
import { decodeVoiceFrame, isVoiceAudioFrame } from "@/hooks/useVoicePlayback";
import { MessageType, type GameMessage } from "@/types/protocol";
import type { CharacterSheetData } from "@/components/CharacterSheet";
import type { InventoryData } from "@/components/InventoryPanel";
import type { MapState } from "@/components/MapOverlay";
import type { CharacterSummary } from "@/components/PartyPanel";
import type { CombatState } from "@/components/CombatOverlay";

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
  const [thinking, setThinking] = useState(false);
  const sessionPhaseRef = useRef<SessionPhase>("connect");
  const autoReconnectAttempted = useRef(false);

  // Overlay data from server messages
  const [characterSheet, setCharacterSheet] = useState<CharacterSheetData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [mapData, setMapData] = useState<MapState | null>(null);

  // Party status — richer than state_delta (includes portrait_url)
  const [partyMembers, setPartyMembers] = useState<CharacterSummary[]>([]);

  // Multiplayer identity — who this tab is and whose turn it is
  const [connectedPlayerName, setConnectedPlayerName] = useState<string>(
    () => loadSession()?.playerName ?? "",
  );
  const [activePlayerName, setActivePlayerName] = useState<string | null>(null);

  // Combat state from COMBAT_EVENT messages
  const [combatState, setCombatState] = useState<CombatState | null>(null);

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

  // Audio engine — unified mixer for TTS, music, SFX
  const audio = useAudio();

  // Narration buffer — holds NARRATION, NARRATION_END, and NARRATION_CHUNK messages
  // so text reveals sentence-by-sentence in sync with TTS audio playback.
  // Without this, the server sends full NARRATION text before TTS starts streaming,
  // and prefetch causes multiple chunks to arrive before the first audio finishes.
  const narrationBufferRef = useRef<{
    narration: GameMessage | null;
    narrationEnd: GameMessage | null;
    chunks: GameMessage[];
    flushTimer: ReturnType<typeof setTimeout> | null;
    watchdogTimer: ReturnType<typeof setTimeout> | null;
  }>({ narration: null, narrationEnd: null, chunks: [], flushTimer: null, watchdogTimer: null });

  const flushNarrationBuffer = useCallback(() => {
    const buf = narrationBufferRef.current;
    if (buf.flushTimer) {
      clearTimeout(buf.flushTimer);
      buf.flushTimer = null;
    }
    if (buf.watchdogTimer) {
      clearTimeout(buf.watchdogTimer);
      buf.watchdogTimer = null;
    }

    const toFlush: GameMessage[] = [];
    // Chunks first so buildSegments sets hasChunksForTurn before seeing NARRATION
    toFlush.push(...buf.chunks);
    buf.chunks = [];
    if (buf.narration) {
      toFlush.push(buf.narration);
      buf.narration = null;
    }
    if (buf.narrationEnd) {
      toFlush.push(buf.narrationEnd);
      buf.narrationEnd = null;
    }

    if (toFlush.length > 0) {
      setThinking(false);
      setMessages(prev => [...prev, ...toFlush]);
    }
  }, []);

  // Route binary WebSocket frames (TTS voice) through AudioEngine,
  // synchronized with narration text reveal.
  const handleBinaryMessage = useCallback(
    (data: ArrayBuffer) => {
      if (!audio.engine) return;
      if (!isVoiceAudioFrame(data)) return;

      const { header, audioData } = decodeVoiceFrame(data);
      if (audioData.byteLength === 0) return;

      // Pop the next buffered narration chunk — reveal its text when this
      // audio segment actually starts playing (not when it's queued).
      const buf = narrationBufferRef.current;
      // Reset watchdog — audio is arriving, TTS pipeline is healthy
      if (buf.watchdogTimer) {
        clearTimeout(buf.watchdogTimer);
        buf.watchdogTimer = null;
      }
      const nextChunk = buf.chunks.shift();

      const onStart = () => {
        if (nextChunk) {
          setThinking(false);
          setMessages(prev => [...prev, nextChunk]);
        }
      };

      if (header.format === 'pcm_s16le') {
        audio.engine.playVoicePCM(audioData, header.sample_rate || 24000, onStart);
      } else {
        audio.engine.playVoice(audioData, onStart);
      }

      // When all chunks have been revealed and NARRATION is waiting, flush it
      // (adds state_delta to messages; buildSegments skips its text via dedup)
      if (buf.chunks.length === 0 && buf.narration) {
        setTimeout(flushNarrationBuffer, 100);
      } else if (buf.chunks.length > 0) {
        // Re-arm watchdog for remaining chunks
        buf.watchdogTimer = setTimeout(flushNarrationBuffer, 2000);
      }
    },
    [audio.engine, flushNarrationBuffer],
  );

  // Genre theme CSS must process in ALL phases, not just game view
  useGenreTheme(messages);

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

    // --- Narration buffer: hold messages for TTS-synchronized reveal ---
    if (msg.type === MessageType.NARRATION) {
      const buf = narrationBufferRef.current;
      buf.narration = msg;
      // Fallback: if no NARRATION_CHUNK arrives within 500ms, flush immediately.
      // This handles the no-TTS case where only NARRATION + NARRATION_END are sent.
      if (!buf.flushTimer && buf.chunks.length === 0) {
        buf.flushTimer = setTimeout(flushNarrationBuffer, 500);
      }
      return;
    }
    if (msg.type === MessageType.NARRATION_END) {
      const buf = narrationBufferRef.current;
      buf.narrationEnd = msg;
      // Belt-and-suspenders: if buffer still has unflushed content, schedule a 1s flush.
      // This catches edge cases where audio sync and watchdog both miss.
      if (buf.chunks.length > 0 || buf.narration) {
        if (!buf.watchdogTimer) {
          buf.watchdogTimer = setTimeout(flushNarrationBuffer, 1000);
        }
      }
      return;
    }
    if (msg.type === MessageType.NARRATION_CHUNK) {
      const buf = narrationBufferRef.current;
      // Cancel no-TTS flush timer — chunks confirm TTS is active
      if (buf.flushTimer) {
        clearTimeout(buf.flushTimer);
        buf.flushTimer = null;
      }
      buf.chunks.push(msg);
      // Watchdog: if TTS audio never arrives after chunks, flush after 2s.
      // Started on first chunk; reset on each audio frame in handleBinaryMessage.
      if (buf.chunks.length === 1 && !buf.watchdogTimer) {
        buf.watchdogTimer = setTimeout(flushNarrationBuffer, 2000);
      }
      return;
    }
    // --- End narration buffer ---

    if (msg.type === MessageType.SESSION_EVENT) {
      const event = msg.payload.event as string;
      // Reset pending narration state on reconnect — previous turn's request
      // is lost when the server restarts, so clear the spinner.
      if (event === "connected" || event === "ready") {
        setThinking(false);
      }
      if (event === "connected" && !msg.payload.has_character) {
        sessionPhaseRef.current = "creation";
        setSessionPhase("creation");
      } else if (event === "ready") {
        sessionPhaseRef.current = "game";
        setSessionPhase("game");
        // Clear HMR-restored messages on reconnect — the server replays
        // the last narration, so keeping old messages causes duplicates.
        setMessages((prev) =>
          prev.filter((m) => m.type === MessageType.SESSION_EVENT),
        );
        // Clear narration buffer to avoid stale chunks leaking into new session
        const buf = narrationBufferRef.current;
        if (buf.flushTimer) clearTimeout(buf.flushTimer);
        if (buf.watchdogTimer) clearTimeout(buf.watchdogTimer);
        buf.narration = null;
        buf.narrationEnd = null;
        buf.chunks = [];
        buf.flushTimer = null;
        buf.watchdogTimer = null;
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

    // Track whose turn it is — gates input in multiplayer
    if (msg.type === MessageType.TURN_STATUS) {
      const name = msg.payload.player_name as string | undefined;
      const status = msg.payload.status as string | undefined;
      if (name && status === "active") {
        setActivePlayerName(name);
      } else if (status === "resolved") {
        setActivePlayerName(null);
      }
      // fall-through: TURN_STATUS may also carry state we want in messages
    }

    // Capture party status — richer data with portrait_url for PartyPanel
    if (msg.type === MessageType.PARTY_STATUS) {
      const members = (msg.payload.members as Array<Record<string, unknown>>) ?? [];
      setPartyMembers(
        members.map((m) => ({
          player_id: (m.player_id as string) ?? "",
          name: (m.name as string) ?? "",
          character_name: (m.character_name as string) ?? (m.name as string) ?? "",
          hp: (m.current_hp as number) ?? 0,
          hp_max: (m.max_hp as number) ?? 0,
          status_effects: (m.statuses as string[]) ?? [],
          class: (m.class as string) ?? "",
          level: (m.level as number) ?? 1,
          portrait_url: (m.portrait_url as string) || undefined,
        })),
      );
      return;
    }

    // Capture overlay data from server — these update the panels/overlays
    if (msg.type === MessageType.CHARACTER_SHEET) {
      setCharacterSheet(msg.payload as unknown as CharacterSheetData);
      return;
    }
    if (msg.type === MessageType.INVENTORY) {
      setInventoryData(msg.payload as unknown as InventoryData);
      return;
    }
    if (msg.type === MessageType.MAP_UPDATE) {
      setMapData(msg.payload as unknown as MapState);
      return;
    }
    if (msg.type === MessageType.COMBAT_EVENT) {
      const payload = msg.payload as unknown as CombatState;
      setCombatState(payload.in_combat ? payload : null);
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
  }, [flushNarrationBuffer]);

  const voiceHandleSignalRef = useRef<(peerId: string, signal: Record<string, unknown>) => void>(() => {});
  const sendRef = useRef<typeof send | null>(null);

  const { connect, disconnect, send, readyState, error } = useGameSocket({
    url: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`,
    onMessage: handleMessage,
    onBinaryMessage: handleBinaryMessage,
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
      // Try slash commands first — resolve locally, no server round-trip
      const slashResult = executeSlashCommand(text);
      if (slashResult.handled) {
        setMessages((prev) => [...prev, ...slashResult.messages]);
        return;
      }

      const msg: GameMessage = {
        type: MessageType.PLAYER_ACTION,
        payload: { action: text, aside },
        player_id: "",
      };
      setMessages((prev) => [...prev, msg]);
      send(msg);
    },
    [send, executeSlashCommand],
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
    setCombatState(null);
    sessionPhaseRef.current = "connect";
    setSessionPhase("connect");
    autoReconnectAttempted.current = false;
    // Clear narration buffer
    const buf = narrationBufferRef.current;
    if (buf.flushTimer) clearTimeout(buf.flushTimer);
    if (buf.watchdogTimer) clearTimeout(buf.watchdogTimer);
    buf.narration = null;
    buf.narrationEnd = null;
    buf.chunks = [];
    buf.flushTimer = null;
    buf.watchdogTimer = null;
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
            hp: c.hp,
            hp_max: c.max_hp,
            status_effects: c.statuses,
            class: "",
            level: 1,
          })),
    [partyMembers, gameState.characters],
  );

  // Turn gating — only meaningful in multiplayer (partyMembers only populated from PARTY_STATUS)
  const isMultiplayer = partyMembers.length > 1;
  const currentPlayerId = useMemo(
    () => partyMembers.find((m) => m.name === connectedPlayerName)?.player_id ?? null,
    [partyMembers, connectedPlayerName],
  );
  const activePlayerId = useMemo(
    () => activePlayerName ? (partyMembers.find((m) => m.name === activePlayerName)?.player_id ?? null) : null,
    [partyMembers, activePlayerName],
  );
  const isMyTurn = !isMultiplayer || !activePlayerName || activePlayerName === connectedPlayerName;
  const waitingForPlayer = isMultiplayer && !isMyTurn ? (activePlayerName ?? undefined) : undefined;

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
            <GameLayout
              messages={gameMessages}
              characters={characters}
              onSend={handleSend}
              onLeave={handleLeave}
              disabled={readyState !== WebSocket.OPEN || thinking || (isMultiplayer && !isMyTurn)}
              thinking={thinking}
              characterSheet={characterSheet}
              inventoryData={inventoryData}
              mapData={mapData}
              audio={audio}
              nowPlaying={nowPlaying}
              journalEntries={gameState.journal}
              combatState={combatState}
              currentPlayerId={currentPlayerId ?? undefined}
              activePlayerId={activePlayerId}
              activePlayerName={activePlayerName}
              waitingForPlayer={waitingForPlayer}
            />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <GameStateProvider>
        <AppInner />
      </GameStateProvider>
    </ThemeProvider>
  );
}

export default App;
