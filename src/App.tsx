import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ConnectScreen } from "@/screens/ConnectScreen";
import { CharacterCreation, type CreationScene } from "@/components/CharacterCreation/CharacterCreation";
import { GameBoard } from "@/components/GameBoard/GameBoard";
import { ImageBusProvider } from "@/providers/ImageBusProvider";
import type { ResourcePool } from "@/components/CharacterPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GameStateProvider, useGameState } from "@/providers/GameStateProvider";
import { useGameSocket } from "@/hooks/useGameSocket";
import { useGenreTheme } from "@/hooks/useGenreTheme";
import { useChromeArchetype } from "@/hooks/useChromeArchetype";
import { useAudioCue } from "@/hooks/useAudioCue";
import { useAudio } from "@/hooks/useAudio";
import { useStateMirror } from "@/hooks/useStateMirror";
import { useSlashCommands } from "@/hooks/useSlashCommands";
import { useGameBoardLayout } from "@/hooks/useGameBoardLayout";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { MessageType, type GameMessage } from "@/types/protocol";
import type { CharacterSheetData } from "@/components/CharacterSheet";
import type { InventoryData } from "@/components/InventoryPanel";
import type { MapState } from "@/components/MapOverlay";
import type { CharacterSummary } from "@/types/party";
import type { ConfrontationData, BeatOption } from "@/components/ConfrontationOverlay";
import type { TurnStatusEntry } from "@/components/TurnStatusPanel";
import type { DiceRequestPayload, DiceResultPayload, DiceThrowParams } from "@/types/payloads";
import type { GenresResponse } from "@/types/genres";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import { PausedBanner } from "@/components/PausedBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useDisplayName } from "@/hooks/useDisplayName";
import { usePeerEventCache } from "@/hooks/usePeerEventCache";

const LazyDashboard = lazy(() =>
  import("@/components/Dashboard/DashboardApp").then((m) => ({ default: m.DashboardApp })),
);

// DiceOverlay overlay removed — dice now render inline in the Confrontation panel
// via InlineDiceTray. The DiceOverlay component and DiceSpikePage are retained
// for isolated testing.

type SessionPhase = "connect" | "creation" | "game";

const SESSION_KEY = "sidequest-session";

// SavedSession stores only the game_slug (MP-01 migration). The old
// playerName+genre+world shape is gone — use game_slug for all reconnect paths.
interface SavedSession {
  gameSlug: string;
}

function loadSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedSession;
    if (data.gameSlug) return data;
    return null;
  } catch {
    return null;
  }
}

function saveSession(gameSlug: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ gameSlug }));
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

// NamePrompt — shown in slug-mode when sq:display-name is not yet set.
// Extracted as a standalone component so AppInner's slug-arrival branch
// can render it without duplicating the ConnectScreen name field.
// Decision: we do NOT reuse ConnectScreen here because ConnectScreen
// requires genres data and the full lobby UI; at the slug-arrival point
// we only need a name. Keep it minimal.
function NamePrompt({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-screen gap-8">
      <div aria-hidden="true" className="text-muted-foreground/30 text-sm tracking-[0.5em]">
        ── ◇ ──
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim()) onSubmit(v.trim());
        }}
        className="flex flex-col items-center gap-4 w-full max-w-sm"
      >
        <label className="flex flex-col gap-2 w-full text-center">
          <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            What name shall be yours?
          </span>
          <input
            value={v}
            onChange={(e) => setV(e.target.value)}
            autoFocus
            aria-label="Player name"
            className="w-full rounded border border-border bg-background px-4 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
        </label>
        <button
          type="submit"
          disabled={!v.trim()}
          className="rounded bg-primary px-6 py-2 text-primary-foreground text-sm tracking-wide uppercase disabled:opacity-40"
        >
          Begin
        </button>
      </form>
    </div>
  );
}

function AppInner() {
  // Slug-mode: when mounted at /solo/:slug or /play/:slug, `slug` is present.
  // AppInner skips ConnectScreen and drives the session-phase state machine
  // directly from the slug-based connect SESSION_EVENT.
  const { slug } = useParams<{ slug?: string }>();

  // Display name — persisted via useDisplayName (localStorage-backed).
  // Set by ConnectScreen handleStart, or by NamePrompt in slug-mode.
  // The hook syncs across component instances in the same tab so
  // ConnectScreen's setName propagates to AppInner without a remount.
  const { name: displayName, setName: setDisplayName } = useDisplayName();
  const handleNameSubmit = useCallback(
    (name: string) => setDisplayName(name),
    [setDisplayName],
  );

  // Bug 2: Hydrate from sessionStorage on mount (HMR recovery)
  const hmrState = loadHmrState();
  // In slug-mode: don't restore "connect" phase from HMR — we drive phase
  // transitions from the server response to our slug-based connect.
  const initialPhase: SessionPhase = (() => {
    if (hmrState?.sessionPhase) return hmrState.sessionPhase;
    // In slug-mode we start at "connect" but skip the ConnectScreen — the
    // slug-connect effect below fires immediately on mount.
    return "connect";
  })();
  const [messages, setMessages] = useState<GameMessage[]>(hmrState?.messages ?? []);
  const [connected, setConnected] = useState(false);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>(initialPhase);
  const [creationScene, setCreationScene] = useState<CreationScene | null>(null);
  const [creationLoading, setCreationLoading] = useState(false);
  const [character, setCharacter] = useState<Record<string, unknown> | null>(hmrState?.character ?? null);
  const [genres, setGenres] = useState<GenresResponse>({});
  const [genreError, setGenreError] = useState(false);
  const [currentGenre, setCurrentGenre] = useState<string | null>(null);
  // Slug-mode: metadata fetched from GET /api/games/:slug before WS connect fires.
  // gameMetaError surfaces in the alert region; retryCount re-runs the fetch when
  // the user clicks Retry after a transient failure.
  const [gameMetaError, setGameMetaError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [thinking, setThinking] = useState(false);
  // Unified input lock: false after submit, true when narration arrives.
  // Replaces the old thinking/activePlayerName/isMyTurn three-lock system.
  const [canType, setCanType] = useState(true);
  const sessionPhaseRef = useRef<SessionPhase>("connect");
  const autoReconnectAttempted = useRef(false);
  // Latched when slug-connect fires so the mid-session reconnect effect
  // doesn't double-send SESSION_EVENT on the same WS OPEN transition.
  const justConnectedRef = useRef(false);
  // Latched AFTER the slug-connect fetch + connect() runs successfully.
  // Declared here (alongside the other session-lifecycle refs) rather than
  // inline next to the effect so `handleLeave` can reset it — AppInner is a
  // single persistent instance across "/" and "/solo/:slug" (react-router-dom
  // v6 reuses the LobbyRoot element across route matches), so this ref
  // survives navigate() and must be explicitly cleared on Leave or the
  // next game's slug-connect effect short-circuits and never opens the WS
  // (playtest 2026-04-24 "post-lobby hang" bug).
  const slugConnectFired = useRef(false);

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
  const [connectedPlayerName, setConnectedPlayerName] = useState<string>("");
  const [activePlayerName, setActivePlayerName] = useState<string | null>(null);
  const [turnStatusEntries, setTurnStatusEntries] = useState<TurnStatusEntry[]>([]);

  // Pause-on-drop (MP-02): server broadcasts GAME_PAUSED when any seated
  // player disconnects and GAME_RESUMED when all seated players are back.
  // `pauseWaitingFor` carries the player_ids the server is waiting on so
  // the PausedBanner can name them.
  const [paused, setPaused] = useState(false);
  const [pauseWaitingFor, setPauseWaitingFor] = useState<string[]>([]);

  // MP-03 event cache — per-(slug, player) IndexedDB durable log of
  // seq-carrying events. Populated as messages arrive; consulted at connect
  // time via `getLatestSeq()` so the SESSION_EVENT carries the right
  // `last_seen_seq` without the slug-connect effect needing to wait on
  // async IDB open.
  const { getLatestSeq: getCachedLatestSeq, appendEvent: appendCachedEvent } =
    usePeerEventCache(slug, displayName);
  // Seq-dedupe: MP-03 reconnect replays emit events we may already have in
  // `messages`. Drop any (kind, seq) pair we've processed before so the
  // narration log doesn't double-render on reconnect.
  const seenEventKeysRef = useRef<Set<string>>(new Set());

  // Confrontation state from CONFRONTATION messages (structured encounters)
  const [confrontationData, setConfrontationData] = useState<ConfrontationData | null>(null);
  // Tracks whether a CONFRONTATION message arrived this turn — used by
  // NARRATION_END to decide whether the encounter has resolved (fix: playtest-2026-04-12).
  const confrontationReceivedThisTurnRef = useRef(false);

  // Dice overlay state from DICE_REQUEST / DICE_RESULT messages (story 34-5)
  const [diceRequest, setDiceRequest] = useState<DiceRequestPayload | null>(null);
  const [diceResult, setDiceResult] = useState<DiceResultPayload | null>(null);
  // Beat ID pending a client-side dice roll — set when user picks a beat,
  // sent with DiceThrow so the server can apply beat + narrate in one tick.
  const pendingBeatIdRef = useRef<string | null>(null);

  // Dice overlay persists after result so the table can see "rolled N vs
  // target M → outcome" through the narrator's resolution. Cleared by:
  // (a) a new DiceRequest arriving (DICE_REQUEST handler below),
  // (b) a local beat click (handleBeatSelect sets a fresh request),
  // (c) the confrontation ending — handled by the effect below,
  // (d) NARRATION_END — the narrator has accepted the roll; holding the
  //     stale TARGET/result widget past the turn boundary makes players
  //     read it as the DC for the next click. Cleared in the NARRATION_END
  //     branch of handleMessage (playtest-pingpong 2026-04-24).
  useEffect(() => {
    if (confrontationData) return;
    setDiceRequest(null);
    setDiceResult(null);
  }, [confrontationData]);

  // Bug 2: Persist critical state to sessionStorage for HMR survival
  useEffect(() => {
    saveHmrState({ messages, sessionPhase, character });
  }, [messages, sessionPhase, character]);

  // Fetch available genres from the server — never hardcode.
  // Only needed in connect phase (for the lobby). In slug-mode we skip
  // ConnectScreen so the genres fetch is still run but not blocking.
  // Response shape is `GenresResponse` (rich metadata per genre + world);
  // see `sidequest-server::list_genres` and `@/types/genres`.
  const fetchGenres = useCallback(() => {
    setGenreError(false);
    fetch("/api/genres")
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json() as Promise<GenresResponse>;
      })
      .then((data) => {
        if (Object.keys(data).length === 0) throw new Error("no genres");
        setGenres(data);
      })
      .catch(() => {
        setGenres({});
        setGenreError(true);
      });
  }, []);

  useEffect(() => {
    fetchGenres();
  }, [fetchGenres]);

  // Metadata is fetched inline in the slug-connect effect below; no separate
  // effect needed. currentGenre is the only consumer — chrome archetype and
  // GameBoard key both read currentGenre.

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
    // MP-03 seq-dedupe + cache. Narrator-host tags durable events with
    // `payload.seq`. On reconnect the server replays events > last_seen_seq
    // which overlaps live events that arrived during the handshake — we
    // drop any (type, seq) pair we've already processed and persist the
    // first-seen copy to IndexedDB so future reconnects know our high-water
    // mark. THINKING et al. don't carry seq and fall through unchanged.
    const payloadSeq = (msg.payload as { seq?: number } | undefined)?.seq;
    if (typeof payloadSeq === "number" && payloadSeq > 0) {
      const key = `${msg.type}:${payloadSeq}`;
      if (seenEventKeysRef.current.has(key)) {
        return; // Replay duplicate — already rendered and cached
      }
      seenEventKeysRef.current.add(key);
      // Fire-and-forget: IndexedDB latency must not block the render path.
      // Errors here are non-fatal (we keep a stale high-water mark; next
      // reconnect sees more replay) — log instead of throw.
      void appendCachedEvent({ seq: payloadSeq, kind: msg.type, payload: msg.payload }).catch(
        (err) => console.warn("[mp-03] peer cache append failed", err),
      );
    }

    // Thinking indicator: show on THINKING, hide on first content
    if (msg.type === MessageType.THINKING) {
      setThinking(true);
      return;
    }

    if (msg.type === MessageType.NARRATION || msg.type === MessageType.NARRATION_END) {
      setThinking(false);
      setMessages((prev) => [...prev, msg]);
      // Turn-end signal: unlock input once the narrator has responded.
      // Paired with setCanType(false) in handleSend. Without this, the input
      // stays sealed after every turn until the player disconnects or leaves.
      if (msg.type === MessageType.NARRATION_END) {
        setCanType(true);
        // Fix: playtest-2026-04-12 — Confrontation panel stuck after encounter
        // resolution. The server clears the encounter snapshot BEFORE building
        // the response, so no CONFRONTATION { active: false } message arrives.
        // On NARRATION_END (turn boundary), if no CONFRONTATION message arrived
        // this turn, the encounter has resolved — clear the panel. The ref
        // avoids React batching issues (CONFRONTATION and NARRATION_END can
        // arrive in the same batch).
        if (!confrontationReceivedThisTurnRef.current) {
          setConfrontationData(null);
        }
        confrontationReceivedThisTurnRef.current = false;
        // Clear the dice TARGET banner and roll-result widget once the
        // narrator resolves the roll. Without this, the previous roll's
        // "TARGET 18 · need 17" + "Rolled 4 vs 18 Fail" stays pinned
        // beside the next set of beat buttons, and players read it as
        // the DC for the next click (playtest-pingpong 2026-04-24).
        setDiceRequest(null);
        setDiceResult(null);
      }
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
      if (event === "waiting") {
        // Server says barrier is active and this player already submitted —
        // lock input until narration arrives (NarrationEnd re-enables it).
        setCanType(false);
        setThinking(true);
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
          // MP-03: messages are about to be re-populated by the server's
          // last_seen_seq replay. Clear the seq-dedupe set in lockstep so
          // replayed events aren't dropped as duplicates of the (now-gone)
          // in-memory state.
          seenEventKeysRef.current.clear();
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
            race: (sheetFacet.race as string) || undefined,
            level: (rawLocal.level as number) ?? 1,
            hp: typeof rawLocal.current_hp === "number" ? (rawLocal.current_hp as number) : undefined,
            hp_max: typeof rawLocal.max_hp === "number" ? (rawLocal.max_hp as number) : undefined,
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

    // Pause-on-drop (MP-02) — server broadcasts these when seated-player
    // presence changes. The banner is advisory only; PLAYER_ACTION is
    // still blocked server-side while paused, so the UI just mirrors state.
    if (msg.type === MessageType.GAME_PAUSED) {
      const waitingFor = (msg.payload.waiting_for as string[] | undefined) ?? [];
      setPaused(true);
      setPauseWaitingFor(waitingFor);
      return;
    }
    if (msg.type === MessageType.GAME_RESUMED) {
      setPaused(false);
      setPauseWaitingFor([]);
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
      confrontationReceivedThisTurnRef.current = true;
      setConfrontationData(payload.active !== false ? payload : null);
      return;
    }

    // Dice overlay — driven by DICE_REQUEST and DICE_RESULT (story 34-5)
    if (msg.type === MessageType.DICE_REQUEST) {
      setDiceRequest(msg.payload as unknown as DiceRequestPayload);
      setDiceResult(null);
      return;
    }
    if (msg.type === MessageType.DICE_RESULT) {
      setDiceResult(msg.payload as unknown as DiceResultPayload);
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
          payload: {
            event: "connect",
            game_slug: saved.gameSlug,
            player_name: connectedPlayerName ?? undefined,
          },
          player_id: connectedPlayerName ?? "",
        });
      }
      return; // Don't show this error in the narrative
    }

    setMessages((prev) => [...prev, msg]);
  }, [connectedPlayerName, appendCachedEvent]);

  const sendRef = useRef<typeof send | null>(null);

  const { connect, disconnect, send, readyState, isReconnecting, error } = useGameSocket({
    url: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`,
    onMessage: handleMessage,
  });

  // MP-03 Task 8 — escalate from "reconnecting" to "offline" after 3s. The
  // ReconnectBanner covers the first few seconds of a dropped socket; if
  // recovery takes longer than that, we tell players the narrator is
  // unreachable and the view is cached/read-only. Clears instantly on
  // successful reconnect.
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (readyState === WebSocket.OPEN) {
      setOffline(false);
      return;
    }
    if (!isReconnecting) return;
    const timer = setTimeout(() => setOffline(true), 3000);
    return () => clearTimeout(timer);
  }, [readyState, isReconnecting]);
  // eslint-disable-next-line react-hooks/immutability
  sendRef.current = send;

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
      // Optimistic thinking indicator: show the three-dinkus pulse + themed
      // placeholder immediately on submit instead of waiting for the server's
      // THINKING message. The server will confirm via its own setThinking(true)
      // at line 201; setting it here just eliminates the blank-input-between-
      // submit-and-server-ack gap that made submits feel like they no-oped.
      setThinking(true);
    },
    [send, executeSlashCommand, toggleWidget],
  );

  const currentPlayerId = useMemo(
    () => partyMembers.find((m) => m.name === connectedPlayerName)?.player_id ?? null,
    [partyMembers, connectedPlayerName],
  );

  // Structured beat dispatch via BEAT_SELECTION protocol message.
  //
  // Sends the exact beat_id from ConfrontationDef — NO text synthesis, NO
  // natural-language label, NO dependency on narrator interpretation or
  // label_fallback fuzzy matching. The server validates the beat_id strictly
  // and applies the mechanical delta before the narrator runs.
  //
  // Replaces commit 05a3dfb which synthesized `"${beat.label} (${beat.stat_check})"`
  // as a PLAYER_ACTION text string — violating: no keyword matching (Zork Problem,
  // ADR-010/032), no silent fallbacks (CLAUDE.md × 4 repos), no half-wired features.
  const handleBeatSelect = useCallback(
    (beatId: string) => {
      if (thinking) {
        console.warn(
          `[beat-dispatch] onBeatSelect fired for "${beatId}" while thinking — duplicate suppressed.`,
        );
        return;
      }
      if (!confrontationData) {
        console.warn(
          `[beat-dispatch] onBeatSelect fired for "${beatId}" but no active confrontationData — dropping.`,
        );
        return;
      }
      // Validate client-side — the server also validates strictly.
      const beat: BeatOption | undefined = confrontationData.beats.find(
        (b) => b.id === beatId,
      );
      if (!beat) {
        console.warn(
          `[beat-dispatch] beat id "${beatId}" not found in active confrontation (${confrontationData.label}) — dropping.`,
        );
        return;
      }
      // Build DiceRequest locally — no server round-trip needed.
      // The server will receive beat_id + face + seed in one DiceThrow message.
      const statVal = characterSheet?.stats[beat.stat_check] ?? 10;
      const modifier = Math.floor((statVal - 10) / 2);
      const rawDc = Math.min(30, Math.max(10, 10 + Math.abs(beat.metric_delta) * 2));
      const charName = characterSheet?.name ?? character?.name ?? "Unknown";
      const localReq: DiceRequestPayload = {
        request_id: crypto.randomUUID(),
        rolling_player_id: currentPlayerId ?? "",
        character_name: charName,
        dice: [{ sides: "d20", count: 1 }],
        modifier,
        stat: beat.stat_check,
        difficulty: rawDc,
        context: `${beat.label} — ${beat.stat_check} check`,
      };
      pendingBeatIdRef.current = beatId;
      setDiceResult(null);
      setDiceRequest(localReq);
    },
    [confrontationData, thinking, characterSheet, character, currentPlayerId],
  );


  // Dice throw — sent after local physics settles with the client-reported
  // face values (physics-is-the-roll, story 34-12). The server treats `face`
  // as the authoritative roll result and echoes `throw_params` to spectators
  // for deterministic replay animation.
  const handleDiceThrow = useCallback(
    (params: DiceThrowParams, face: number[]) => {
      if (!diceRequest) return;
      const beatId = pendingBeatIdRef.current;
      pendingBeatIdRef.current = null;
      send({
        type: MessageType.DICE_THROW,
        payload: {
          request_id: diceRequest.request_id,
          throw_params: params,
          face,
          ...(beatId ? { beat_id: beatId } : {}),
        },
        player_id: "",
      });
      // If this was a beat roll, set thinking — narrator will run server-side
      if (beatId) {
        setCanType(false);
        setThinking(true);
      }
    },
    [diceRequest, send],
  );

  const navigate = useNavigate();

  // Bug 6: Leave game — disconnect, clear state, return to lobby.
  // Playtest 2026-04-23: must also navigate to "/" — at /solo/:slug, leaving
  // state-only causes the slug-connect effect to re-fire and immediately
  // reload the same session, making the button look broken.
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
    setDiceRequest(null);
    setDiceResult(null);
    setPaused(false);
    setPauseWaitingFor([]);
    setOffline(false);
    seenEventKeysRef.current.clear();
    sessionPhaseRef.current = "connect";
    setSessionPhase("connect");
    autoReconnectAttempted.current = false;
    // Reset slug-connect session state so the NEXT game's slug-connect
    // effect fetches GET /api/games/:new-slug and opens a fresh WebSocket.
    // Without this, `slugConnectFired.current` stays latched to `true` from
    // the prior session — the short-circuit at the top of the effect
    // (`if (slugConnectFired.current) return;`) fires, no fetch happens,
    // no WS opens, UI hangs on "The pages are turning…" forever. The user
    // can only escape by typing the URL manually (full page reload resets
    // all refs). Playtest 2026-04-24 "Post-lobby hang on new-genre first
    // game" bug — confirmed genre-agnostic (MW → C&C, C&C → SO).
    slugConnectFired.current = false;
    justConnectedRef.current = false;
    setGameMetaError(null);
    setCurrentGenre(null);
    // Route off the slug — otherwise the slug-connect effect re-fires.
    // disconnect() above already flushed the SESSION_EVENT outbound.
    navigate("/");
  }, [disconnect, navigate]);

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

  // Scene harness: if ?scene=NAME is in the URL, POST to /dev/scene/:name
  // to stage the save. Server returns { slug } (game_slug). Dev harness only —
  // requires the server running with DEV_SCENES=1. Navigates to /solo/:slug
  // so AppInner owns the WebSocket session via the slug-based flow.
  // Blocks the normal autoReconnect path by flipping `autoReconnectAttempted`
  // so the two don't race.
  //
  // Fail loud on any error: a broken scene harness load is a dev-side bug
  // that must be visible, not silently fall back to the manual ConnectScreen.
  const sceneHarnessAttempted = useRef(false);
  useEffect(() => {
    if (sceneHarnessAttempted.current) return;
    const params = new URLSearchParams(window.location.search);
    const sceneName = params.get("scene");
    if (!sceneName) return;
    sceneHarnessAttempted.current = true;
    autoReconnectAttempted.current = true;
    fetch(`/dev/scene/${encodeURIComponent(sceneName)}`, { method: "POST" })
      .then((r) => {
        if (!r.ok) {
          return r.text().then((body) => {
            throw new Error(`${r.status} ${body || r.statusText}`);
          });
        }
        return r.json() as Promise<{ slug: string }>;
      })
      .then(({ slug: sceneSlug }) => {
        console.info(`[scene-harness] loaded ${sceneName} → /solo/${sceneSlug}`);
        navigate(`/solo/${sceneSlug}`);
      })
      .catch((err: Error) => {
        console.error("[scene-harness] failed:", err);
        window.alert(`Scene harness '${sceneName}' failed: ${err.message}`);
      });
  }, [navigate]);

  // Auto-reconnect on page refresh if we have a saved session with a game_slug.
  // Navigates to /solo/:slug — AppInner owns the WebSocket session.
  // No fallback to the legacy genre+world+player path: if there is no slug,
  // the session is stale (pre-MP-01) and must not be reconnected silently.
  //
  // Playtest 2026-04-24: respect URL slug. If the user typed (or was
  // navigated to) /solo/:slug or /play/:slug — e.g. via a Past Journeys
  // click, a shared link, or manual URL entry — trust the URL and let
  // the slug-connect effect below run against it. Without this guard,
  // localStorage's last session unconditionally overrode the URL and
  // shareable/resumable links became inert.
  useEffect(() => {
    if (autoReconnectAttempted.current) return;
    autoReconnectAttempted.current = true;
    if (slug) return;
    const saved = loadSession();
    if (!saved) return;
    navigate(`/solo/${saved.gameSlug}`);
  }, [navigate, slug]);

  // Slug-mode connect: when AppInner mounts at /solo/:slug or /play/:slug,
  // fetch GET /api/games/:slug (metadata) and then fire SESSION_EVENT{connect}.
  //
  // The fetch is inlined here (rather than a separate effect) so that the
  // connect fires in the same async chain as the metadata resolution — this
  // avoids an extra React render cycle and keeps tests straightforward.
  //
  // Gate order:
  //   1. slug must be present.
  //   2. displayName must be set (NamePrompt may still be showing).
  //   3. Metadata fetch must succeed — seeds currentGenre before the WS
  //      connect fires so genre theming is already applied.
  //   If metadata fetch fails, gameMetaError is set and connect does NOT fire.
  //
  // The existing sessionPhase state machine takes over from the server response:
  //   connected + !has_character → "creation"
  //   ready                      → "game"
  //
  // Dependency on `displayName` means it re-fires after NamePrompt confirms —
  // which is the intended behavior (we need a name before connecting).
  // (`slugConnectFired` ref is declared above with the other
  //  session-lifecycle refs so `handleLeave` can reset it.)
  useEffect(() => {
    if (!slug) return;
    if (!displayName) return; // Wait for NamePrompt
    if (slugConnectFired.current) return;
    // Do NOT latch slugConnectFired here. In React 18 StrictMode the dev-mode
    // double-invoke runs effect → cleanup → effect on initial mount; latching
    // up-front would have the cleanup mark the in-flight fetch as `cancelled`,
    // and the second effect run would short-circuit on the already-true latch
    // — net result: fetch resolves into a cancelled closure, connect() never
    // fires, and the UI sticks on the "pages are turning…" loader forever.
    // Instead, latch *after* the success path runs connect(); cancelled-pass
    // returns are no-ops, and the surviving pass is the one that latches.
    // MP-03: snapshot the peer cache high-water mark at the moment the
    // effect fires. `getLatestSeq` is ref-backed so this is synchronous and
    // reflects whatever IDB has loaded by now. If IDB hasn't resolved yet,
    // we send 0 and accept an unnecessary replay (which dedupe handles).
    const lastSeenSeq = getCachedLatestSeq();
    let cancelled = false;
    fetch(`/api/games/${encodeURIComponent(slug)}`)
      .then(async (resp) => {
        if (!resp.ok) throw new Error(`failed to load game: ${resp.status}`);
        return resp.json() as Promise<{ genre_slug: string; world_slug: string; mode: string }>;
      })
      .then((body) => {
        if (cancelled) return;
        // Re-check the latch under the surviving closure: if a sibling
        // StrictMode pass already won the race and called connect(), bail
        // out so we don't double-fire the SESSION_EVENT connect handshake.
        if (slugConnectFired.current) return;
        slugConnectFired.current = true;
        // Seed genre state before WS connect fires so theming is applied
        // immediately — GameBoard key, chrome archetype, resource SFX all
        // depend on currentGenre being non-null on first game render.
        setCurrentGenre(body.genre_slug);
        saveSession(slug);
        setConnectedPlayerName(displayName);
        justConnectedRef.current = true;
        connect();
        setConnected(true);
        // Allow the WebSocket to open before sending the connect payload.
        // 300ms gives the socket one event-loop tick to transition to OPEN
        // before the SESSION_EVENT connect is sent.
        setTimeout(() => {
          sendRef.current?.({
            type: MessageType.SESSION_EVENT,
            // player_name carries the human-readable display name from
            // localStorage['sq:display-name']. Required: without it the
            // server falls back to the opaque player_id for the lobby
            // name, and any genre without a name-entry chargen scene
            // (mutant_wasteland etc.) ends up with a UUID on the
            // character sheet header. See playtest 2026-04-23 Bug 1.
            payload: {
              event: "connect",
              game_slug: slug,
              last_seen_seq: lastSeenSeq,
              player_name: displayName,
            },
            player_id: displayName,
          });
        }, 300);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Latch was never set (we only latch on the success path now), so
        // the retryCount increment will naturally re-fire the effect.
        setGameMetaError(err instanceof Error ? err.message : "Failed to load game metadata");
      });
    return () => { cancelled = true; };
  }, [slug, displayName, connect, retryCount, getCachedLatestSeq]);

  // WebSocket OPEN transitions — two separate concerns, split into two effects
  // so the cleanup path doesn't depend on App-level `connected` state.
  //
  // Playtest 2026-04-11: this used to be a single effect gated on
  // `readyState === OPEN && wasDisconnected && connected`. The `&& connected`
  // guard is a foot-gun on the initial page-reload path: when the WebSocket
  // first transitions to OPEN, App's `connected` state is still `false`
  // (the slug-connect effect hasn't completed yet). The effect's guard fails.
  // By the time `connected` flips to true, `prevReadyState.current` has already
  // been set to OPEN, so `wasDisconnected` is now false and the effect fails
  // the guard a second time. Net result: on a server-restart + page-reload cycle,
  // the cleanup never runs, and any state that gets stuck during restoration
  // (canType=false, thinking=true) stays stuck until the user leaves the
  // session. See ping-pong playtest 2026-04-11 "InputBar stuck disabled".
  const prevReadyState = useRef(readyState);

  // (1) Defensive state reset — fires on ANY OPEN transition regardless of
  // whether we were "already connected" in App state. Clearing `canType` to
  // `true` and `thinking` to `false` is always safe here: the only path that
  // sets them to "busy" is `handleSend`, which the user cannot call while the
  // input is disabled. Over-firing is intentional — stuck state is the bug,
  // clearing redundantly is not.
  useEffect(() => {
    if (readyState === WebSocket.OPEN && prevReadyState.current !== WebSocket.OPEN) {
      setThinking(false);
      // Do NOT set canType here — the server's "ready" or "waiting"
      // SessionEvent is authoritative. Blindly enabling input races
      // with barrier state on reconnect (see playtest 2026-04-12).
    }
  }, [readyState]);

  // (2) Re-handshake on reconnect — keeps the original conservative gate.
  // Only re-sends the SESSION_EVENT "connect" payload when the app was
  // previously `connected` (i.e. this is a genuine mid-session reconnect,
  // not the first page-load handshake which is handled by the slug-connect
  // effect above). Uses game_slug — no legacy genre+world+player fallback.
  useEffect(() => {
    const wasDisconnected = prevReadyState.current !== WebSocket.OPEN;
    prevReadyState.current = readyState;
    if (readyState === WebSocket.OPEN && wasDisconnected && connected) {
      // Suppress the duplicate connect on the initial handshake: the
      // slug-connect effect already scheduled a SESSION_EVENT{connect}
      // and sending another one here makes the server resolve the opening
      // hook twice.
      if (justConnectedRef.current) {
        justConnectedRef.current = false;
        return;
      }
      const saved = loadSession();
      if (saved) {
        send({
          type: MessageType.SESSION_EVENT,
          payload: {
            event: "connect",
            game_slug: saved.gameSlug,
            player_name: displayName ?? undefined,
          },
          player_id: displayName ?? "",
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
  // Unified alert string: surface both socket errors and game-metadata load failures.
  const alertError = [socketError, gameMetaError].filter(Boolean).join(" — ") || null;

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
  const activePlayerId = useMemo(
    () => activePlayerName ? (partyMembers.find((m) => m.name === activePlayerName)?.player_id ?? null) : null,
    [partyMembers, activePlayerName],
  );

  // In slug-mode, if no display name yet, show the name prompt before
  // connecting. Do not show ConnectScreen — the session already exists.
  if (slug && !displayName) {
    return <NamePrompt onSubmit={handleNameSubmit} />;
  }

  return (
    <div data-testid="app" className="min-h-screen flex flex-col bg-background text-foreground">
      <ReconnectBanner visible={isReconnecting} />
      <OfflineBanner offline={offline} />
      <PausedBanner paused={paused} waitingFor={pauseWaitingFor} />
      <main className="flex flex-col flex-1 min-h-0">
        {sessionPhase === "connect" && !slug && (
          <ErrorBoundary name="Connect">
            <ConnectScreen
              genres={genres}
              isConnecting={isConnecting}
              error={alertError}
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
                knowledgeEntries={gameState.knowledge}
                depletions={gameState.depletions}
                resourceAlerts={gameState.resourceAlerts}
                confrontationData={confrontationData}
                onBeatSelect={handleBeatSelect}
                diceRequest={diceRequest}
                diceResult={diceResult}
                onDiceThrow={handleDiceThrow}
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
            {/* Dice overlay removed — dice now roll inline in the Confrontation panel */}
          </ErrorBoundary>
        )}
        {/* In slug-mode while sessionPhase is still "connect" (waiting for server
            response after sending the slug-based SESSION_EVENT), show a connecting
            indicator rather than the ConnectScreen (which requires genre selection).
            If metadata load or socket connection failed, surface the error here. */}
        {sessionPhase === "connect" && slug && (
          <div className="flex flex-col items-center justify-center flex-1 min-h-screen gap-4">
            <span
              aria-hidden="true"
              className="text-muted-foreground/30 text-sm tracking-[0.5em]"
            >
              ── ◇ ──
            </span>
            {alertError ? (
              <>
                <p role="alert" className="text-sm text-destructive">
                  {alertError}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setGameMetaError(null);
                    slugConnectFired.current = false;
                    setRetryCount((c) => c + 1);
                  }}
                  className="rounded bg-primary px-6 py-2 text-primary-foreground text-sm tracking-wide uppercase"
                >
                  Retry
                </button>
              </>
            ) : (
              <p
                role="status"
                className="text-sm italic text-muted-foreground/50 animate-pulse"
              >
                The pages are turning…
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function LobbyRoot() {
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
    <div data-testid="lobby-root">
      <GameStateProvider>
        <AppInner />
      </GameStateProvider>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LobbyRoot />} />
      <Route path="/solo/:slug" element={<LobbyRoot />} />
      <Route path="/play/:slug" element={<LobbyRoot />} />
    </Routes>
  );
}

export default function App() {
  // In tests we wrap with MemoryRouter; in production the entry point (main.tsx) provides BrowserRouter.
  return <AppRoutes />;
}
