import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BackoffStrategy = "fixed" | "exponential";

export interface UseWebSocketOptions<T> {
  /** WebSocket URL to connect to. */
  url: string;
  /** Called for each parsed JSON message. */
  onMessage: (message: T) => void;
  /** Called for binary (Blob) frames. */
  onBinaryMessage?: (data: ArrayBuffer) => void;
  /** Called on WebSocket error events. */
  onError?: (error: Event) => void;
  /** Connect immediately on mount (default: true). */
  autoConnect?: boolean;
  /** Backoff strategy for reconnection (default: "exponential"). */
  backoff?: BackoffStrategy;
  /** Maximum backoff delay in ms (default: 8000). */
  maxBackoffMs?: number;
  /**
   * Whether to reconnect for a given close code (default: reconnect on all
   * codes except 1000). Return false to suppress reconnection.
   */
  shouldReconnect?: (code: number) => boolean;
  /** Custom JSON parser. Default: JSON.parse. */
  parse?: (data: string) => T;
}

export interface UseWebSocketReturn {
  /** True when the WebSocket is open. */
  connected: boolean;
  /** Raw WebSocket readyState value. */
  readyState: number;
  /** Open a connection (no-op if already connected). */
  connect: () => void;
  /** Close the connection intentionally (suppresses reconnect). */
  disconnect: () => void;
  /** Send a JSON-serializable message. Drops if socket not OPEN. */
  send: (message: unknown) => void;
  /** Last error event, or null. */
  error: Event | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_BACKOFF_MS = 1000;
const DEFAULT_MAX_BACKOFF_MS = 8000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Generic WebSocket hook with reconnection, binary frame support, and
 * callback-ref stability. Consolidates useGameSocket and useWatcherSocket.
 */
export function useWebSocket<T>({
  url,
  onMessage,
  onBinaryMessage,
  onError,
  autoConnect = true,
  backoff = "exponential",
  maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
  shouldReconnect = (code) => code !== 1000,
  parse = JSON.parse as (data: string) => T,
}: UseWebSocketOptions<T>): UseWebSocketReturn {
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const [error, setError] = useState<Event | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const retryDelayRef = useRef(INITIAL_BACKOFF_MS);

  // Callback refs — prevent stale closures without re-running effects
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onBinaryMessageRef = useRef(onBinaryMessage);
  onBinaryMessageRef.current = onBinaryMessage;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const parseRef = useRef(parse);
  parseRef.current = parse;
  const shouldReconnectRef = useRef(shouldReconnect);
  shouldReconnectRef.current = shouldReconnect;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const nextBackoff = useCallback(() => {
    const current = retryDelayRef.current;
    if (backoff === "exponential") {
      retryDelayRef.current = Math.min(current * 2, maxBackoffMs);
    }
    return current;
  }, [backoff, maxBackoffMs]);

  const createSocket = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setReadyState(WebSocket.OPEN);
      setError(null);
      retryDelayRef.current = INITIAL_BACKOFF_MS; // reset on success
    };

    ws.onmessage = (ev: MessageEvent) => {
      // Binary frame — delegate to onBinaryMessage if a handler is set.
      if (ev.data instanceof Blob) {
        ev.data
          .arrayBuffer()
          .then((buf) => onBinaryMessageRef.current?.(buf))
          .catch((err) => console.error("Binary frame decode failed:", err));
        return;
      }

      try {
        const parsed = parseRef.current(ev.data as string);
        onMessageRef.current(parsed);
      } catch {
        // Non-JSON message — ignore
      }
    };

    ws.onerror = (ev: Event) => {
      setError(ev);
      onErrorRef.current?.(ev);
    };

    ws.onclose = (ev: CloseEvent) => {
      setReadyState(WebSocket.CLOSED);

      if (!intentionalCloseRef.current && shouldReconnectRef.current(ev.code)) {
        const delay = nextBackoff();
        reconnectTimerRef.current = setTimeout(() => {
          createSocket();
        }, delay);
      }
    };
  }, [url, nextBackoff]);

  const connect = useCallback(() => {
    clearReconnectTimer();
    intentionalCloseRef.current = false;
    retryDelayRef.current = INITIAL_BACKOFF_MS;
    createSocket();
  }, [createSocket, clearReconnectTimer]);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    intentionalCloseRef.current = true;
    wsRef.current?.close();
  }, [clearReconnectTimer]);

  const send = useCallback((message: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  // Auto-connect on mount + cleanup on unmount
  useEffect(() => {
    if (autoConnect) {
      intentionalCloseRef.current = false;
      createSocket();
    }

    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      wsRef.current?.close();
    };
  }, [url, autoConnect, createSocket, clearReconnectTimer]);

  const connected = readyState === WebSocket.OPEN;

  return { connected, readyState, connect, disconnect, send, error };
}
