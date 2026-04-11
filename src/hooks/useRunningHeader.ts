import { useMemo } from "react";
import { MessageType, type GameMessage } from "@/types/protocol";

/**
 * Derive the most recent chapter/location title from the message stream.
 * Used for the running header at the top of the game board so the player
 * always knows where they are.
 */
export function useRunningHeader(messages: GameMessage[]) {
  return useMemo(() => {
    let chapterTitle: string | null = null;
    for (const msg of messages) {
      if (msg.type === MessageType.CHAPTER_MARKER) {
        const loc = msg.payload.location as string;
        if (loc) chapterTitle = loc;
      }
    }
    return { chapterTitle };
  }, [messages]);
}
