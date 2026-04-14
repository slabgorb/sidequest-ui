import { useEffect, useRef, useState } from "react";

/**
 * Active multiplayer sessions as returned by `GET /api/sessions`.
 * Mirrors the Rust `SessionResponse` / `SessionPlayerResponse` structs in
 * `sidequest-server::list_sessions`.
 */
export interface SessionPlayer {
  player_id: string;
  display_name: string;
}

export interface ActiveSession {
  session_key: string;
  genre: string;
  world: string;
  session_id: string;
  players: SessionPlayer[];
  current_turn: number;
  current_location: string;
  /** Stable label: "free_play" | "structured" | "cinematic" | "unknown". */
  turn_mode: string;
}

interface SessionsResponse {
  sessions: ActiveSession[];
}

export interface UseSessionsOptions {
  /** Poll interval in ms. Default 15000 (15 s). Set to 0 to disable polling. */
  pollMs?: number;
  /** Optional genre filter passed to the endpoint as `?genre=...`. */
  genre?: string | null;
  /** Optional world filter passed to the endpoint as `?world=...`. */
  world?: string | null;
}

export interface UseSessionsResult {
  sessions: ActiveSession[];
  isLoading: boolean;
  error: string | null;
  /** Trigger a manual refresh, bypassing the next scheduled tick. */
  refresh: () => void;
}

/**
 * Polls `/api/sessions` for the lobby's social-presence panel.
 *
 * Default cadence is 15 seconds — the lobby is a low-stakes view, not a
 * realtime channel. Pass `pollMs: 0` for tests or to opt out of polling
 * entirely (the initial fetch still runs once on mount).
 *
 * Filter params change-tracking: when `genre` or `world` change, the hook
 * re-fetches immediately rather than waiting for the next tick.
 */
export function useSessions({
  pollMs = 15000,
  genre = null,
  world = null,
}: UseSessionsOptions = {}): UseSessionsResult {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight request from a previous render (filter change).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Note: we do NOT toggle isLoading here. The initial state is true,
    // it flips to false after the first response, and subsequent polls
    // refresh data silently — flickering a loading state on every 15s
    // poll would make the lobby feel jittery. Consumers that need a
    // "currently refreshing" indicator can derive it from the data.

    const params = new URLSearchParams();
    if (genre) params.set("genre", genre);
    if (world) params.set("world", world);
    const url = `/api/sessions${params.toString() ? `?${params}` : ""}`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SessionsResponse>;
      })
      .then((data) => {
        setSessions(data.sessions);
        setError(null);
        setIsLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(String(e?.message ?? e));
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [tick, genre, world]);

  // Polling tick — drives the effect above on the configured cadence.
  useEffect(() => {
    if (pollMs <= 0) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, pollMs);
    return () => window.clearInterval(id);
  }, [pollMs]);

  return {
    sessions,
    isLoading,
    error,
    refresh: () => setTick((t) => t + 1),
  };
}
