import { useEffect, useRef, useCallback, useState } from "react";
import type { WatcherEvent } from "@/types/watcher";

export interface UseWatcherSocketOptions {
  /** Called for every parsed watcher event. */
  onEvent: (event: WatcherEvent) => void;
  /** WebSocket URL. Defaults to ws://localhost:8765/ws/watcher. */
  url?: string;
}

export interface UseWatcherSocketResult {
  /** True when the WebSocket is open and receiving events. */
  connected: boolean;
}

/**
 * Connects to the Rust API's /ws/watcher endpoint for telemetry events.
 * Auto-reconnects on disconnect with exponential backoff (1s → 2s → 4s, max 8s).
 */
export function useWatcherSocket({
  onEvent,
  url,
}: UseWatcherSocketOptions): UseWatcherSocketResult {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Derive WebSocket URL from current page location if not provided
  const wsUrl = url ?? (() => {
    const loc = window.location;
    const proto = loc.protocol === "https:" ? "wss:" : "ws:";
    // In dev, the API runs on port 8765
    const host = loc.hostname === "localhost" ? "localhost:8765" : loc.host;
    return `${proto}//${host}/ws/watcher`;
  })();

  useEffect(() => {
    let retryDelay = 1000;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryDelay = 1000; // reset backoff on successful connect
      };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as WatcherEvent;
          onEventRef.current(event);
        } catch {
          // Non-JSON message — ignore
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!destroyed) {
          retryTimeout = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 8000);
            connect();
          }, retryDelay);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror — reconnect handled there
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      wsRef.current?.close();
    };
  }, [wsUrl]);

  return { connected };
}
