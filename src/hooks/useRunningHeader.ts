import { useMemo } from "react";
import { MessageType, type GameMessage } from "@/types/protocol";
import type { CharacterSummary } from "@/types/party";

/**
 * Derive the most recent chapter/location title for the running header.
 *
 * Source preference (most fresh → least fresh):
 *   1. Local player's `current_location` from PARTY_STATUS — pushed every turn,
 *      so this is the canonical "where is my PC right now" signal. Fixes the
 *      cache-invalidation bug (S2-UX (c), 2026-04-26) where the chip showed a
 *      stale location because no CHAPTER_MARKER had fired yet.
 *   2. Most recent `CHAPTER_MARKER.location` in the message stream — useful as
 *      a fallback before the first PARTY_STATUS arrives or for solo sessions
 *      that emit chapter markers without a party update.
 *
 * If neither source has a value, returns `chapterTitle: null` so the caller
 * can render a non-breaking-space placeholder.
 */
export function useRunningHeader(
  messages: GameMessage[],
  characters: CharacterSummary[] = [],
  currentPlayerId?: string,
) {
  return useMemo(() => {
    // Prefer the local player's current_location from PARTY_STATUS.
    if (currentPlayerId) {
      const me = characters.find((c) => c.player_id === currentPlayerId);
      if (me && me.current_location) {
        return { chapterTitle: me.current_location };
      }
    }
    // Solo / pre-PARTY_STATUS fallback: walk the message stream for the
    // most recent CHAPTER_MARKER.
    let chapterTitle: string | null = null;
    for (const msg of messages) {
      if (msg.type === MessageType.CHAPTER_MARKER) {
        const loc = msg.payload.location as string;
        if (loc) chapterTitle = loc;
      }
    }
    return { chapterTitle };
  }, [messages, characters, currentPlayerId]);
}
