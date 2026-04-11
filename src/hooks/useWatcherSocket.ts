import type { WatcherEvent } from "@/types/watcher";
import { useWebSocket } from "@/hooks/useWebSocket";

export interface UseWatcherSocketOptions {
  /** Called for every parsed watcher event. */
  onEvent: (event: WatcherEvent) => void;
  /** Called on WebSocket error events. */
  onError?: (error: Event) => void;
  /** WebSocket URL. Defaults to ws://localhost:8765/ws/watcher. */
  url?: string;
}

export interface UseWatcherSocketResult {
  /** True when the WebSocket is open and receiving events. */
  connected: boolean;
}

/**
 * Watcher/telemetry WebSocket — thin wrapper around useWebSocket.
 *
 * Auto-connects on mount with exponential backoff (1s -> 2s -> 4s, max 8s).
 * Reconnects on all close codes (the watcher should always stay connected).
 */
export function useWatcherSocket({
  onEvent,
  onError,
  url,
}: UseWatcherSocketOptions): UseWatcherSocketResult {
  // Derive WebSocket URL from current page location if not provided
  const wsUrl =
    url ??
    (() => {
      const loc = window.location;
      const proto = loc.protocol === "https:" ? "wss:" : "ws:";
      const host =
        loc.hostname === "localhost" ? "localhost:8765" : loc.host;
      return `${proto}//${host}/ws/watcher`;
    })();

  const { connected } = useWebSocket<WatcherEvent>({
    url: wsUrl,
    onMessage: onEvent,
    onError,
    autoConnect: true,
    backoff: "exponential",
    maxBackoffMs: 8000,
    shouldReconnect: () => true,
  });

  return { connected };
}
