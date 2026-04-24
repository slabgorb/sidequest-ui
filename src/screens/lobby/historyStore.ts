/**
 * Client-side journey history — a list of past lobby entries kept in
 * localStorage so the picker can offer one-click resume of (player_name,
 * genre, world) combinations the player has used before.
 *
 * This is a *prefill convenience*, not a save loader. Clicking a history
 * row populates the lobby fields; the player still hits Begin to start
 * the actual session. There is no server-side persistence and no
 * cross-machine sync.
 *
 * Stored under `sidequest-history` to keep it separate from the existing
 * `sidequest-connect` key (which only holds the most-recent prefill).
 */

const STORAGE_KEY = "sidequest-history";
const MAX_ENTRIES = 5;

export interface JourneyEntry {
  player_name: string;
  genre: string;
  world: string;
  /** ISO-8601 timestamp of the most recent connection with this combo. */
  last_played_iso: string;
  /**
   * Slug of the most recent game created for this (player, genre, world).
   * Optional because pre-2026-04-24 entries were prefill-only and don't
   * carry a slug — the lobby falls back to legacy prefill behavior for
   * those, while new entries get one-click resume.
   */
  game_slug?: string;
  /**
   * Mode the most recent game was started in. Used to pick the route
   * prefix (`/solo` vs `/play`) on resume. Optional for the same
   * backward-compat reason as `game_slug`.
   */
  mode?: "solo" | "multiplayer";
}

/**
 * Read the history list from localStorage. Always returns a sorted list
 * (newest first). Tolerates corrupt storage by returning `[]`.
 */
export function loadHistory(): JourneyEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Filter out any malformed entries (defensive — schema may evolve).
    // game_slug + mode are optional (added 2026-04-24); old entries lack them.
    const valid = parsed.filter((e): e is JourneyEntry => {
      if (!e || typeof e !== "object") return false;
      const obj = e as Record<string, unknown>;
      return (
        typeof obj.player_name === "string" &&
        typeof obj.genre === "string" &&
        typeof obj.world === "string" &&
        typeof obj.last_played_iso === "string"
      );
    });
    valid.sort((a, b) => b.last_played_iso.localeCompare(a.last_played_iso));
    return valid;
  } catch {
    return [];
  }
}

function saveHistory(entries: JourneyEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage full or unavailable — non-critical, history is best-effort.
  }
}

/**
 * Record a new connection in the history. Deduplicates by the
 * (player_name, genre, world) tuple — repeated visits update the
 * timestamp instead of accumulating duplicates. Caps the list at
 * `MAX_ENTRIES` newest entries.
 */
export function appendHistory(entry: Omit<JourneyEntry, "last_played_iso">): void {
  const now = new Date().toISOString();
  const existing = loadHistory().filter(
    (e) =>
      !(
        e.player_name === entry.player_name &&
        e.genre === entry.genre &&
        e.world === entry.world
      ),
  );
  // Spread last so callers can pass `game_slug`/`mode` (optional) without
  // having to construct a fully-typed object — and so a missing slug is
  // recorded as `undefined` rather than serialized as a stale value from
  // a previous tuple.
  existing.unshift({ ...entry, last_played_iso: now });
  saveHistory(existing.slice(0, MAX_ENTRIES));
}

/**
 * Remove a single history entry, identified by its full tuple. The
 * timestamp is intentionally not part of the key — players want to forget
 * a combination, not a specific session of it.
 */
export function removeHistory(target: Omit<JourneyEntry, "last_played_iso">): void {
  const remaining = loadHistory().filter(
    (e) =>
      !(
        e.player_name === target.player_name &&
        e.genre === target.genre &&
        e.world === target.world
      ),
  );
  saveHistory(remaining);
}

/**
 * Format an ISO timestamp as a short relative-time string suitable for
 * a journey-history row. Ranges roughly map to "just now", "5 minutes ago",
 * "2 hours ago", "yesterday", "3 days ago", "last week".
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
