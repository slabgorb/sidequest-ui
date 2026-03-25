import { useCallback, useRef, useState } from "react";
import type { GameMessage } from "@/types/protocol";

export interface UseGameSocketOptions {
  url: string;
  onMessage?: (message: GameMessage) => void;
  onBinaryMessage?: (data: ArrayBuffer) => void;
  onError?: (error: Event) => void;
}

export interface UseGameSocketReturn {
  readyState: number;
  connect: () => void;
  disconnect: () => void;
  send: (message: GameMessage) => void;
  error: Event | null;
}

const INITIAL_BACKOFF_MS = 1000;

export function useGameSocket({
  url,
  onMessage,
  onBinaryMessage,
  onError,
}: UseGameSocketOptions): UseGameSocketReturn {
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const [error, setError] = useState<Event | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const createSocket = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setReadyState(WebSocket.OPEN);
      setError(null);
    };

    ws.onmessage = (ev: MessageEvent) => {
      if (ev.data instanceof Blob) {
        // Binary frame — delegate to onBinaryMessage for AudioEngine routing
        ev.data.arrayBuffer().then((buf) => {
          onBinaryMessage?.(buf);
        }).catch((err) => {
          console.error("Binary frame decode failed:", err);
        });
        return;
      }
      const parsed = JSON.parse(ev.data as string) as GameMessage;
      onMessage?.(parsed);
    };

    ws.onerror = (ev: Event) => {
      setError(ev);
      onError?.(ev);
    };

    ws.onclose = (ev: CloseEvent) => {
      setReadyState(WebSocket.CLOSED);

      if (!intentionalCloseRef.current && ev.code !== 1000) {
        reconnectTimerRef.current = setTimeout(() => {
          createSocket();
        }, INITIAL_BACKOFF_MS);
      }
    };
  }, [url, onMessage, onBinaryMessage, onError]);

  const connect = useCallback(() => {
    cleanup();
    intentionalCloseRef.current = false;
    createSocket();
  }, [createSocket, cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
    intentionalCloseRef.current = true;
    wsRef.current?.close();
  }, [cleanup]);

  const send = useCallback((message: GameMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      // Queue the message and send when socket opens
      const check = setInterval(() => {
        const w = wsRef.current;
        if (w && w.readyState === WebSocket.OPEN) {
          clearInterval(check);
          w.send(JSON.stringify(message));
        }
      }, 50);
      // Give up after 5 seconds
      setTimeout(() => clearInterval(check), 5000);
    }
  }, []);

  return { connect, disconnect, send, readyState, error };
}
