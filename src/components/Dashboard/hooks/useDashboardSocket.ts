import { useEffect, useReducer } from "react";
import type {
  DashboardState,
  DashboardAction,
  RawWatcherEvent,
  TurnProfile,
  SpanRecord,
} from "../types";

const MAX_TURNS = 500;
const MAX_RAW_EVENTS = 2000;

const initialState: DashboardState = {
  connected: false,
  turns: [],
  histogram: {},
  tropes: [],
  alerts: [],
  latestSnapshot: null,
  rawEvents: [],
};

function parseTimestamp(ts: string): number {
  return new Date(ts).getTime();
}

function findOrCreateTurn(
  turns: TurnProfile[],
  turnNumber: number,
  timestamp: string,
): { turns: TurnProfile[]; turn: TurnProfile; index: number } {
  const idx = turns.findIndex((t) => t.turnNumber === turnNumber);
  if (idx >= 0) {
    return { turns, turn: turns[idx], index: idx };
  }
  const previousSnapshot =
    turns.length > 0 ? turns[turns.length - 1].snapshot : null;
  const newTurn: TurnProfile = {
    turnNumber,
    timestamp,
    playerInput: "",
    spans: [],
    totalDurationMs: 0,
    isDegraded: false,
    snapshot: null,
    previousSnapshot,
    alerts: [],
  };
  const newTurns = [...turns, newTurn];
  return { turns: newTurns, turn: newTurn, index: newTurns.length - 1 };
}

function processEvent(
  state: DashboardState,
  event: RawWatcherEvent,
): DashboardState {
  const rawEvents = [...state.rawEvents, event].slice(-MAX_RAW_EVENTS);
  const histogram = { ...state.histogram };
  histogram[event.component] = (histogram[event.component] ?? 0) + 1;

  const turnNumber = event.fields.turn_number as number | undefined;

  // Events without turn_number — just accumulate in raw stream and histogram
  if (turnNumber === undefined) {
    let alerts = state.alerts;
    if (event.event_type === "validation_warning") {
      const detail = Object.entries(event.fields)
        .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
        .join(", ");
      alerts = [
        ...alerts,
        {
          severity: event.severity,
          check: event.component,
          message: detail,
          turn: state.turns.length > 0 ? state.turns[state.turns.length - 1].turnNumber : 0,
        },
      ];
    }
    return { ...state, rawEvents, histogram, alerts };
  }

  // Correlate into TurnProfile by turn_number
  const { turns: turnsWithNew, turn, index } = findOrCreateTurn(
    state.turns,
    turnNumber,
    event.timestamp,
  );

  const turnStartMs = parseTimestamp(turn.timestamp);
  const eventMs = parseTimestamp(event.timestamp);
  const offsetMs = Math.max(0, eventMs - turnStartMs);

  const span: SpanRecord = {
    component: event.component,
    eventType: event.event_type,
    startOffsetMs: offsetMs,
    durationMs: null,
    fields: event.fields,
  };

  let updatedTurn = { ...turn, spans: [...turn.spans, span] };

  // Extract data from AgentSpanOpen
  if (event.event_type === "agent_span_open" && event.component === "game") {
    if (event.fields.action) {
      updatedTurn.playerInput = String(event.fields.action);
    }
  }

  // Extract data from AgentSpanClose
  if (event.event_type === "agent_span_close" && event.component === "game") {
    if (event.fields.classified_intent) {
      updatedTurn.classifiedIntent = String(event.fields.classified_intent);
    }
    if (event.fields.agent_routed_to) {
      updatedTurn.agentName = String(event.fields.agent_routed_to);
    }
    if (event.fields.is_degraded !== undefined) {
      updatedTurn.isDegraded = Boolean(event.fields.is_degraded);
    }
    if (event.fields.agent_duration_ms !== undefined) {
      updatedTurn.agentDurationMs = Number(event.fields.agent_duration_ms);
    }
    if (event.fields.token_count_in !== undefined) {
      updatedTurn.tokenCountIn = Number(event.fields.token_count_in);
    }
    if (event.fields.token_count_out !== undefined) {
      updatedTurn.tokenCountOut = Number(event.fields.token_count_out);
    }
    if (event.fields.extraction_tier !== undefined) {
      updatedTurn.extractionTier = Number(event.fields.extraction_tier);
    }
    // Compute total duration as offset of last close event
    updatedTurn.totalDurationMs = Math.max(updatedTurn.totalDurationMs, offsetMs);
  }

  // Extract snapshot from state transitions
  if (event.event_type === "game_state_snapshot" && event.fields.snapshot) {
    updatedTurn.snapshot = event.fields.snapshot as DashboardState["latestSnapshot"];
  }

  // Validation warnings become alerts on this turn
  if (event.event_type === "validation_warning") {
    const detail = Object.entries(event.fields)
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(", ");
    updatedTurn.alerts = [
      ...updatedTurn.alerts,
      {
        severity: event.severity,
        check: event.component,
        message: detail,
        turn: turnNumber,
      },
    ];
  }

  // Extract trope status
  let tropes = state.tropes;
  if (event.component === "trope" && event.fields.trope_id) {
    const tropeId = String(event.fields.trope_id);
    const existing = tropes.find((t) => t.name === tropeId);
    if (!existing) {
      tropes = [...tropes, { name: tropeId, progress: 0, beats_fired: [] }];
    }
    if (event.fields.progress !== undefined) {
      tropes = tropes.map((t) =>
        t.name === tropeId ? { ...t, progress: Number(event.fields.progress) } : t,
      );
    }
    if (event.event_type === "agent_span_open" && event.fields.trope) {
      const tropeName = String(event.fields.trope);
      tropes = tropes.map((t) =>
        t.name === tropeId
          ? { ...t, name: tropeName, beats_fired: [...t.beats_fired, tropeName] }
          : t,
      );
    }
  }

  const turns = [...turnsWithNew];
  turns[index] = updatedTurn;

  const latestSnapshot = updatedTurn.snapshot ?? state.latestSnapshot;
  const alerts = [
    ...state.alerts,
    ...updatedTurn.alerts.slice(turn.alerts.length),
  ];

  return {
    ...state,
    turns: turns.slice(-MAX_TURNS),
    histogram,
    tropes,
    alerts,
    latestSnapshot,
    rawEvents,
  };
}

function dashboardReducer(
  state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case "EVENT_RECEIVED":
      return processEvent(state, action.payload);
    case "CONNECTED":
      return { ...state, connected: true };
    case "DISCONNECTED":
      return { ...state, connected: false };
    case "CLEAR_ALERTS":
      return { ...state, alerts: [] };
  }
}

function buildWatcherUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/watcher`;
}

export function useDashboardSocket(): DashboardState {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      ws = new WebSocket(buildWatcherUrl());

      ws.onopen = () => dispatch({ type: "CONNECTED" });

      ws.onmessage = (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data as string) as RawWatcherEvent;
          if (event.component && event.event_type) {
            dispatch({ type: "EVENT_RECEIVED", payload: event });
          }
        } catch {
          // Ignore malformed JSON
        }
      };

      ws.onclose = () => {
        dispatch({ type: "DISCONNECTED" });
        // Auto-reconnect after 2s
        reconnectTimer = setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return state;
}
