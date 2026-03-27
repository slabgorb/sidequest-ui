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

export function useWatcherSocket(
  port: number,
  enabled: boolean,
): WatcherState {
  const [state, dispatch] = useReducer(watcherReducer, initialState);

  useEffect(() => {
    if (!enabled) return;

    const ws = new WebSocket(`ws://localhost:${port}/ws/watcher`);

    ws.onopen = () => dispatch({ type: "CONNECTED" });

    ws.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data as string) as WatcherEvent;
      dispatch({ type: "EVENT_RECEIVED", payload: event });
    };

    ws.onclose = () => dispatch({ type: "DISCONNECTED" });

    return () => ws.close();
  }, [port, enabled]);

  return state;
}
