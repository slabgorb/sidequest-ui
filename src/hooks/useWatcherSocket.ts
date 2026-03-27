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

function processEvent(
  state: WatcherState,
  event: WatcherEvent,
): WatcherState {
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
        const event = JSON.parse(e.data as string) as WatcherEvent;
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
