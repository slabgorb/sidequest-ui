import DOMPurify from "dompurify";
import { MessageType, type GameMessage } from "@/types/protocol";

export interface FootnoteData {
  marker?: number;
  summary: string;
  category?: string;
  is_new?: boolean;
}

export interface ActionRevealEntry {
  character_name: string;
  player_id: string;
  action: string;
}

export interface NarrativeSegment {
  kind: "text" | "image" | "separator" | "system" | "turn-status" | "error" | "player-action" | "player-aside" | "chapter-marker" | "portrait-group" | "action-reveal" | "render-pending" | "gallery-notice";
  html?: string;
  url?: string;
  alt?: string;
  caption?: string;
  text?: string;
  width?: number;
  height?: number;
  tier?: string;
  render_id?: string;
  footnotes?: FootnoteData[];
  portraitImage?: NarrativeSegment;
  adjacentText?: NarrativeSegment;
  actions?: ActionRevealEntry[];
  autoResolved?: string[];
}

export function markdownToHtml(text: string): string {
  const result = text
    .replace(/```json\s*\{[\s\S]*?\}\s*```/g, "")
    .replace(/```json\s*\{[\s\S]*$/g, "")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^---+$/gm, "<hr>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "</p><p>")
    .replace(/\[\^?(\d+)\]/g, '<sup><a href="#footnote-$1">$1</a></sup>');
  return `<p>${result}</p>`;
}

export function buildSegments(messages: GameMessage[]): NarrativeSegment[] {
  const segments: NarrativeSegment[] = [];
  let chunkBuffer = "";
  let hasChunksForTurn = false;

  const skipNarrationAt = new Set<number>();
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].type !== MessageType.NARRATION) continue;
    for (let j = i + 1; j < messages.length; j++) {
      if (messages[j].type === MessageType.NARRATION_CHUNK) {
        skipNarrationAt.add(i);
        break;
      }
      if (messages[j].type === MessageType.PLAYER_ACTION || messages[j].type === MessageType.ACTION_REVEAL) break;
    }
  }

  const seenRevealTurns = new Set<number>();
  const seenNarrationTexts = new Set<string>();
  let lastChapterLocation = "";

  const flushChunks = () => {
    if (chunkBuffer) {
      segments.push({ kind: "text", html: DOMPurify.sanitize(markdownToHtml(chunkBuffer)) });
      chunkBuffer = "";
    }
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    switch (msg.type) {
      case MessageType.NARRATION_CHUNK:
        chunkBuffer += (chunkBuffer ? " " : "") + (msg.payload.text as string);
        hasChunksForTurn = true;
        break;
      case MessageType.NARRATION_END:
        flushChunks();
        if (segments.length > 0 && segments[segments.length - 1].kind !== "separator") {
          segments.push({ kind: "separator" });
        }
        hasChunksForTurn = false;
        break;
      case MessageType.NARRATION:
        if (hasChunksForTurn || skipNarrationAt.has(i)) break;
        {
          const narText = msg.payload.text as string;
          if (seenNarrationTexts.has(narText)) break;
          seenNarrationTexts.add(narText);
        }
        flushChunks();
        {
          const footnotes = (msg.payload.footnotes as FootnoteData[] | undefined) ?? [];
          segments.push({
            kind: "text",
            html: DOMPurify.sanitize(markdownToHtml(msg.payload.text as string)),
            footnotes: footnotes.length > 0 ? footnotes : undefined,
          });
        }
        break;
      case MessageType.RENDER_QUEUED:
        // Images are handled by ImageBusProvider — skip render placeholders
        break;
      case MessageType.IMAGE: {
        // Images routed to gallery widget via ImageBusProvider.
        // Emit a subtle gallery notice in the narrative stream.
        flushChunks();
        const renderId = msg.payload.render_id as string | undefined;
        // Remove any stale render-pending placeholder
        if (renderId) {
          const pendingIdx = segments.findIndex(s => s.kind === "render-pending" && s.render_id === renderId);
          if (pendingIdx >= 0) segments.splice(pendingIdx, 1);
        }
        segments.push({ kind: "gallery-notice", text: "New image in gallery" });
        break;
      }
      case MessageType.SESSION_EVENT: {
        const event = msg.payload.event as string | undefined;
        if (event === "theme_css" || event === "connected" || event === "ready") break;
        flushChunks();
        const sysText = msg.payload.text as string | undefined;
        if (sysText) {
          segments.push({ kind: "system", text: sysText });
          break;
        }
        const playerName = msg.payload.player_name as string;
        const label =
          event === "join"
            ? `${playerName} joined the session`
            : event === "leave"
              ? `${playerName} left the session`
              : `${playerName}: ${event}`;
        segments.push({ kind: "system", text: label });
        break;
      }
      case MessageType.TURN_STATUS: {
        flushChunks();
        const name = msg.payload.player_name as string;
        const status = msg.payload.status as string;
        segments.push({
          kind: "turn-status",
          text: status === "active" ? `${name}'s turn` : `${name}: ${status}`,
        });
        break;
      }
      case MessageType.ERROR:
        flushChunks();
        segments.push({ kind: "error", text: msg.payload.message as string });
        break;
      case MessageType.CHARACTER_SHEET: {
        flushChunks();
        const charName = msg.payload.name as string;
        const charClass = msg.payload.class as string | undefined;
        const race = msg.payload.race as string | undefined;
        const level = msg.payload.level as number | undefined;
        const personality = msg.payload.personality as string | undefined;
        const pronouns = msg.payload.pronouns as string | undefined;
        const equipment = (msg.payload.equipment as string[] | undefined) ?? [];
        const header = [charName, race, charClass, level != null ? `Lv ${level}` : null]
          .filter(Boolean)
          .join(" — ");
        const details = [
          personality ? `Personality: ${personality}` : null,
          pronouns ? `Pronouns: ${pronouns}` : null,
          equipment.length > 0 ? `Equipment: ${equipment.join(", ")}` : null,
        ].filter(Boolean).join(" | ");
        const text = details ? `${header}\n${details}` : header;
        segments.push({ kind: "system", text });
        break;
      }
      case MessageType.PLAYER_ACTION: {
        flushChunks();
        const action = msg.payload.action as string;
        const aside = msg.payload.aside as boolean | undefined;
        if (action) {
          segments.push({
            kind: aside ? "player-aside" : "player-action",
            text: aside ? `[aside] ${action}` : action,
          });
        }
        break;
      }
      case MessageType.CHAPTER_MARKER: {
        flushChunks();
        const location = msg.payload.location as string;
        if (location && location !== lastChapterLocation) {
          segments.push({ kind: "chapter-marker", text: location });
          lastChapterLocation = location;
        }
        break;
      }
      case MessageType.ACTION_REVEAL: {
        flushChunks();
        const turnNumber = msg.payload.turn_number as number;
        if (seenRevealTurns.has(turnNumber)) break;
        seenRevealTurns.add(turnNumber);
        const actions = (msg.payload.actions as ActionRevealEntry[] | undefined) ?? [];
        const autoResolved = (msg.payload.auto_resolved as string[] | undefined) ?? [];
        if (actions.length > 0 || autoResolved.length > 0) {
          segments.push({ kind: "action-reveal", actions, autoResolved });
        }
        break;
      }
      default:
        break;
    }
  }

  flushChunks();

  while (segments.length > 0 && segments[0].kind === "separator") {
    segments.shift();
  }
  while (segments.length > 0 && segments[segments.length - 1].kind === "separator") {
    segments.pop();
  }

  return segments;
}

/** @deprecated Images now route to gallery widget; portrait grouping is a no-op passthrough. */
export function groupPortraitSegments(segments: NarrativeSegment[]): NarrativeSegment[] {
  return segments;
}
