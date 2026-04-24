import { useReducer, useCallback, useEffect } from "react";
import { useWatcherSocket } from "@/hooks/useWatcherSocket";
import type {
  WatcherEvent,
  TurnCompleteFields,
  SessionStateView,
} from "@/types/watcher";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardTabs } from "./DashboardTabs";
import { TimelineTab } from "./tabs/TimelineTab";
import { StateTab } from "./tabs/StateTab";
import { SubsystemsTab } from "./tabs/SubsystemsTab";
import { TimingTab } from "./tabs/TimingTab";
import { ConsoleTab } from "./tabs/ConsoleTab";
import { PromptTab } from "./tabs/PromptTab";
import { LoreTab } from "./tabs/LoreTab";
import { THEME } from "./shared/constants";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface DashboardState {
  activeTab: number;
  paused: boolean;
  turns: WatcherEvent[];
  allEvents: WatcherEvent[];
  componentMap: Record<string, WatcherEvent[]>;
  selectedTurn: number | null;
  promptEvents: WatcherEvent[];
  loreEvents: WatcherEvent[];
  debugState: SessionStateView[] | null;
  /** In-progress turn context accumulated from OTEL span closes between
   *  one `orchestrator.process_action` boundary and the next. Used to
   *  synthesize a `turn_complete` event when the server never emits a
   *  semantic one (playtest 2026-04-24 — the semantic path was missing
   *  from live traffic; only span closes reached the dashboard). */
  pendingTurn: PendingTurnContext;
  /** Server-provided turn identifiers we've already accounted for, so a
   *  real `turn_complete` following a synthesized one doesn't double-count. */
  seenTurnKeys: Set<string>;
}

interface PendingTurnContext {
  turnId: string | null;
  playerId: string | null;
  genre: string | null;
  world: string | null;
  inferenceDurationMs: number | null;
  model: string | null;
}

const emptyPending: PendingTurnContext = {
  turnId: null,
  playerId: null,
  genre: null,
  world: null,
  inferenceDurationMs: null,
  model: null,
};

const initialState: DashboardState = {
  activeTab: 0,
  paused: false,
  turns: [],
  allEvents: [],
  componentMap: {},
  selectedTurn: null,
  promptEvents: [],
  loreEvents: [],
  debugState: null,
  pendingTurn: { ...emptyPending },
  seenTurnKeys: new Set(),
};

type Action =
  | { type: "SET_TAB"; tab: number }
  | { type: "TOGGLE_PAUSE" }
  | { type: "CLEAR" }
  | { type: "EVENT"; event: WatcherEvent }
  | { type: "SET_DEBUG_STATE"; data: SessionStateView[] }
  | { type: "SELECT_TURN"; index: number | null };

/**
 * Turn aggregator — playtest 2026-04-24 regression.
 *
 * The dashboard originally gated the Turns counter + Timeline / Timing /
 * Prompt / Lore tabs on receiving a semantic `turn_complete` event.
 * Under production traffic, those events stopped reaching the stream
 * (the upstream publish never ran) but OTEL span closes kept flowing —
 * including `orchestrator.process_action`, which is the canonical top-level
 * span wrapping every turn. We now treat that span close as a turn
 * boundary: accumulate contextual attributes from intermediate spans
 * (`narrator.canonical_leak_audit` carries `turn_id`, `player_id`, genre,
 * world; `turn.agent_llm.inference` carries duration + model), and on
 * `orchestrator.process_action` close, synthesize a `turn_complete`
 * WatcherEvent from the accumulated context. If the server later emits
 * a real `turn_complete` for the same turn, dedupe via `seenTurnKeys`.
 */
function extractTurnKey(fields: Record<string, unknown>): string | null {
  const turnId = fields["turn_id"];
  if (typeof turnId === "string" && turnId.length > 0) return turnId;
  // Numeric turn_id (semantic event) → stringified key.
  if (typeof turnId === "number") return String(turnId);
  return null;
}

function synthesizeTurnComplete(
  closingEvent: WatcherEvent,
  pending: PendingTurnContext,
): WatcherEvent {
  const fields: Record<string, unknown> = {
    turn_id: pending.turnId,
    player_id: pending.playerId,
    genre: pending.genre,
    world: pending.world,
    agent_name: "narrator",
    agent_duration_ms:
      pending.inferenceDurationMs ??
      (typeof closingEvent.fields["duration_ms"] === "number"
        ? (closingEvent.fields["duration_ms"] as number)
        : null),
    total_duration_ms:
      typeof closingEvent.fields["duration_ms"] === "number"
        ? (closingEvent.fields["duration_ms"] as number)
        : pending.inferenceDurationMs,
    is_degraded: false,
    synthesized: true, // Breadcrumb for debugging: this came from span-close, not a semantic emit.
  };
  return {
    timestamp: closingEvent.timestamp,
    component: "orchestrator",
    event_type: "turn_complete",
    severity: "info",
    fields,
  };
}

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "TOGGLE_PAUSE":
      return { ...state, paused: !state.paused };
    case "CLEAR":
      return {
        ...initialState,
        activeTab: state.activeTab,
        debugState: state.debugState,
        pendingTurn: { ...emptyPending },
        seenTurnKeys: new Set(),
      };
    case "SELECT_TURN":
      return { ...state, selectedTurn: action.index };
    case "SET_DEBUG_STATE":
      return { ...state, debugState: action.data };
    case "EVENT": {
      if (state.paused) return state;
      const ev = action.event;
      const comp = ev.component || "unknown";
      const compEvents = state.componentMap[comp] ?? [];

      const next: DashboardState = {
        ...state,
        allEvents: [...state.allEvents, ev],
        componentMap: { ...state.componentMap, [comp]: [...compEvents, ev] },
      };

      // --- Semantic events — server-emitted ---
      if (ev.event_type === "turn_complete") {
        const key = extractTurnKey(ev.fields);
        if (key !== null && state.seenTurnKeys.has(key)) {
          // We already synthesized a turn for this key; keep the richer
          // semantic event by replacing the synthesized placeholder.
          const replaceIdx = state.turns.findIndex(
            (t) => extractTurnKey(t.fields) === key,
          );
          if (replaceIdx !== -1) {
            const nextTurns = [...state.turns];
            nextTurns[replaceIdx] = ev;
            next.turns = nextTurns;
          }
        } else {
          next.turns = [...state.turns, ev];
          if (key !== null) {
            next.seenTurnKeys = new Set(state.seenTurnKeys).add(key);
          }
          if (
            state.selectedTurn === null ||
            state.selectedTurn === state.turns.length - 1
          ) {
            next.selectedTurn = next.turns.length - 1;
          }
        }
        next.pendingTurn = { ...emptyPending };
      } else if (ev.event_type === "prompt_assembled") {
        next.promptEvents = [...state.promptEvents, ev];
      } else if (ev.event_type === "lore_retrieval") {
        next.loreEvents = [...state.loreEvents, ev];
      } else if (ev.event_type === "agent_span_close") {
        // --- Span-close turn-aggregator — playtest 2026-04-24 fallback ---
        const spanName = String(ev.fields["name"] ?? "");
        if (spanName === "narrator.canonical_leak_audit") {
          const turnId = ev.fields["turn_id"];
          if (typeof turnId === "string" && turnId.length > 0) {
            // turn_id shape: "<genre>:<world>:<player>:<N>"
            const parts = turnId.split(":");
            next.pendingTurn = {
              ...state.pendingTurn,
              turnId,
              genre: parts[0] ?? state.pendingTurn.genre,
              world: parts[1] ?? state.pendingTurn.world,
              playerId: parts[2] ?? state.pendingTurn.playerId,
            };
          }
        } else if (spanName === "turn.agent_llm.inference") {
          const dur = ev.fields["duration_ms"];
          const model = ev.fields["model"];
          next.pendingTurn = {
            ...state.pendingTurn,
            inferenceDurationMs:
              typeof dur === "number" ? dur : state.pendingTurn.inferenceDurationMs,
            model:
              typeof model === "string" ? model : state.pendingTurn.model,
          };
        } else if (spanName === "orchestrator.process_action") {
          const pending = next.pendingTurn; // includes any updates above in this dispatch
          const key = pending.turnId;
          if (key !== null && state.seenTurnKeys.has(key)) {
            // Already counted via semantic turn_complete; reset and skip.
            next.pendingTurn = { ...emptyPending };
          } else {
            const synthetic = synthesizeTurnComplete(ev, pending);
            next.turns = [...state.turns, synthetic];
            if (key !== null) {
              next.seenTurnKeys = new Set(state.seenTurnKeys).add(key);
            }
            if (
              state.selectedTurn === null ||
              state.selectedTurn === state.turns.length - 1
            ) {
              next.selectedTurn = next.turns.length - 1;
            }
            next.pendingTurn = { ...emptyPending };
          }
        }
      }
      return next;
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Debug state fetcher
// ---------------------------------------------------------------------------

const API_BASE = (() => {
  const loc = window.location;
  const host =
    loc.hostname === "localhost" ? "localhost:8765" : loc.host;
  return `${loc.protocol}//${host}`;
})();

async function fetchDebugState(): Promise<SessionStateView[]> {
  const res = await fetch(`${API_BASE}/api/debug/state`);
  if (!res.ok) throw new Error(`debug/state failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardApp() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const onEvent = useCallback(
    (event: WatcherEvent) => {
      dispatch({ type: "EVENT", event });
    },
    [],
  );

  const { connected } = useWatcherSocket({ onEvent });

  // Fetch debug state on mount and after each turn
  const loadDebugState = useCallback(async () => {
    try {
      const data = await fetchDebugState();
      dispatch({ type: "SET_DEBUG_STATE", data });
    } catch {
      // Dashboard is a dev tool — swallow fetch errors silently
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDebugState();
  }, [loadDebugState]);

  // Refresh debug state when turn count changes
  useEffect(() => {
    if (state.turns.length > 0) {
      loadDebugState();
    }
  }, [state.turns.length, loadDebugState]);

  const errorCount = state.allEvents.filter(
    (e) => e.severity === "error",
  ).length;

  const durations = state.turns
    .map((t) => (t.fields as TurnCompleteFields).agent_duration_ms ?? 0)
    .filter((d) => d > 0)
    .sort((a, b) => a - b);
  const p95 =
    durations.length > 0
      ? (durations[Math.floor(durations.length * 0.95)] / 1000).toFixed(1) +
        "s"
      : "—";

  return (
    <div
      style={{
        background: THEME.bg,
        color: THEME.text,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        minHeight: "100vh",
      }}
    >
      <DashboardHeader
        connected={connected}
        turnCount={state.turns.length}
        errorCount={errorCount}
        p95={p95}
        paused={state.paused}
        onTogglePause={() => dispatch({ type: "TOGGLE_PAUSE" })}
        onClear={() => dispatch({ type: "CLEAR" })}
        onRefreshState={loadDebugState}
      />
      <DashboardTabs
        activeTab={state.activeTab}
        onTabChange={(tab) => dispatch({ type: "SET_TAB", tab })}
        turnCount={state.turns.length}
        errorCount={errorCount}
      />
      <div style={{ height: "calc(100vh - 82px)", overflowY: "auto" }}>
        {state.activeTab === 0 && (
          <TimelineTab
            turns={state.turns}
            selectedTurn={state.selectedTurn}
            onSelectTurn={(i) => dispatch({ type: "SELECT_TURN", index: i })}
          />
        )}
        {state.activeTab === 1 && (
          <StateTab
            debugState={state.debugState}
            onRefresh={loadDebugState}
          />
        )}
        {state.activeTab === 2 && (
          <SubsystemsTab
            allEvents={state.allEvents}
            componentMap={state.componentMap}
            turnCount={state.turns.length}
          />
        )}
        {state.activeTab === 3 && <TimingTab turns={state.turns} />}
        {state.activeTab === 4 && (
          <ConsoleTab allEvents={state.allEvents} />
        )}
        {state.activeTab === 5 && (
          <PromptTab promptEvents={state.promptEvents} />
        )}
        {state.activeTab === 6 && (
          <LoreTab loreEvents={state.loreEvents} />
        )}
      </div>
    </div>
  );
}
