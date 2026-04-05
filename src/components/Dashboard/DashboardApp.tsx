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
}

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
};

type Action =
  | { type: "SET_TAB"; tab: number }
  | { type: "TOGGLE_PAUSE" }
  | { type: "CLEAR" }
  | { type: "EVENT"; event: WatcherEvent }
  | { type: "SET_DEBUG_STATE"; data: SessionStateView[] }
  | { type: "SELECT_TURN"; index: number | null };

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

      if (ev.event_type === "turn_complete") {
        next.turns = [...state.turns, ev];
        // Auto-select latest turn if none selected or following latest
        if (
          state.selectedTurn === null ||
          state.selectedTurn === state.turns.length - 1
        ) {
          next.selectedTurn = next.turns.length - 1;
        }
      }
      if (ev.event_type === "prompt_assembled") {
        next.promptEvents = [...state.promptEvents, ev];
      }
      if (ev.event_type === "lore_retrieval") {
        next.loreEvents = [...state.loreEvents, ev];
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
