import type { GameMessage } from "@/types/protocol";
import { useWebSocket, type UseWebSocketReturn } from "@/hooks/useWebSocket";

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

/**
 * Game WebSocket — thin wrapper around useWebSocket with GameMessage typing.
 *
 * Uses manual connect (autoConnect: false) because App.tsx calls connect()
 * explicitly after setting up state. Reconnects on all non-clean close codes.
 */
export function useGameSocket({
  url,
  onMessage,
  onBinaryMessage,
  onError,
}: UseGameSocketOptions): UseGameSocketReturn {
  const noop = () => {};
  const ws: UseWebSocketReturn = useWebSocket<GameMessage>({
    url,
    onMessage: onMessage ?? noop,
    onBinaryMessage,
    onError,
    autoConnect: false,
    backoff: "fixed",
    shouldReconnect: (code) => code !== 1000,
  });

  return {
    readyState: ws.readyState,
    connect: ws.connect,
    disconnect: ws.disconnect,
    send: ws.send as (message: GameMessage) => void,
    error: ws.error,
  };
}
