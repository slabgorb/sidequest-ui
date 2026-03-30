import { useEffect, useReducer } from "react";
import type {
  WatcherState,
  WatcherAction,
  WatcherEvent,
} from "@/components/GMMode/types";

const MAX_TURNS = 100;

const initialState: WatcherState = {
  connected: false,
  turns: [],
  histogram: {},
  tropes: [],
  alerts: [],
  latestSnapshot: null,
};

// Raw server event shape (WatcherEvent struct from Rust)
interface RawWatcherEvent {
  timestamp: string;
  component: string;
  event_type: string;
  severity: string;
  fields: Record<string, unknown>;
}

function isRawEvent(event: unknown): event is RawWatcherEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "component" in event &&
    "event_type" in event &&
    "fields" in event
  );
}

function processEvent(
  state: WatcherState,
  event: WatcherEvent | RawWatcherEvent,
): WatcherState {
  // Handle raw telemetry events from the server
  if (isRawEvent(event)) {
    const detail = Object.entries(event.fields)
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(", ");
    const item = {
      subsystem: event.component,
      detail: `${event.event_type}: ${detail}`,
      severity: event.severity,
    };

    // Append to the latest turn or create a new one
    const turns = [...state.turns];
    const turnNum = turns.length > 0 ? turns[turns.length - 1].turn : 1;
    if (
      turns.length > 0 &&
      turns[turns.length - 1].turn === turnNum
    ) {
      const last = turns[turns.length - 1];
      turns[turns.length - 1] = { ...last, events: [...last.events, item] };
    } else {
      turns.push({ turn: turnNum + 1, events: [item] });
    }

    const histogram = { ...state.histogram };
    histogram[event.component] = (histogram[event.component] ?? 0) + 1;

    // Extract trope status from trope events
    let tropes = state.tropes;
    if (event.component === "trope" && event.fields.trope_id) {
      const tropeId = String(event.fields.trope_id);
      const existing = tropes.find((t) => t.name === tropeId);
      if (!existing) {
        tropes = [...tropes, { name: tropeId, progress: 0, beats_fired: [] }];
      }
      if (event.event_type === "agent_span_open" && event.fields.trope) {
        const tropeName = String(event.fields.trope);
        tropes = tropes.map((t) =>
          t.name === tropeId ? { ...t, name: tropeName, beats_fired: [...t.beats_fired, tropeName] } : t,
        );
      }
    }

    // Build snapshot from game state transitions
    let latestSnapshot = state.latestSnapshot;
    if (event.component === "game" && event.fields.location) {
      latestSnapshot = {
        ...latestSnapshot,
        location: String(event.fields.location),
      };
    }

    // Validation warnings become alerts
    let alerts = state.alerts;
    if (event.event_type === "validation_warning") {
      alerts = [
        ...alerts,
        {
          severity: event.severity,
          check: event.component,
          message: detail,
          turn: turnNum,
        },
      ];
    }

    return { ...state, turns: turns.slice(-MAX_TURNS), histogram, tropes, latestSnapshot, alerts };
  }

  if (event.type === "turn_record") {
    const newTurn = { turn: event.turn, events: event.events };
    const turns = [...state.turns, newTurn].slice(-MAX_TURNS);

    const histogram = { ...state.histogram };
    for (const e of event.events) {
      histogram[e.subsystem] = (histogram[e.subsystem] ?? 0) + 1;
    }

    const alerts = event.validations
      ? [...state.alerts, ...event.validations]
      : state.alerts;

    const tropes = event.tropes ?? state.tropes;

    return { ...state, turns, histogram, alerts, tropes };
  }

  if (event.type === "snapshot") {
    return { ...state, latestSnapshot: event.data };
  }

  return state;
}

function watcherReducer(
  state: WatcherState,
  action: WatcherAction,
): WatcherState {
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

function buildWatcherUrl(port?: number): string {
  if (port !== undefined) {
    return `ws://localhost:${port}/ws/watcher`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/watcher`;
}

export function useWatcherSocket(
  portOrEnabled: number | boolean,
  maybeEnabled?: boolean,
): WatcherState {
  // Support both (port, enabled) and (enabled) signatures
  const port = typeof portOrEnabled === "number" ? portOrEnabled : undefined;
  const enabled = typeof portOrEnabled === "boolean" ? portOrEnabled : (maybeEnabled ?? false);

  const [state, dispatch] = useReducer(watcherReducer, initialState);

  useEffect(() => {
    if (!enabled) return;

    const ws = new WebSocket(buildWatcherUrl(port));

    ws.onopen = () => dispatch({ type: "CONNECTED" });

    ws.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string);
        dispatch({ type: "EVENT_RECEIVED", payload: event });
      } catch {
        // Ignore malformed JSON from watcher — debug panel should not crash
      }
    };

    ws.onclose = () => dispatch({ type: "DISCONNECTED" });

    return () => ws.close();
  }, [port, enabled]);

  return state;
}
