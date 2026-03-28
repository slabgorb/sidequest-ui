import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import DOMPurify from "dompurify";
import { MessageType, type GameMessage } from "@/types/protocol";
import { toRoman } from "@/lib/utils";

export interface NarrativeViewProps {
  messages: GameMessage[];
  thinking?: boolean;
}

interface NarrativeSegment {
  kind: "text" | "image" | "separator" | "system" | "turn-status" | "error" | "player-action" | "player-aside" | "chapter-marker" | "portrait-group";
  html?: string;
  url?: string;
  alt?: string;
  caption?: string;
  text?: string;
  width?: number;
  height?: number;
  tier?: string;
  /** For portrait-group: the image segment */
  portraitImage?: NarrativeSegment;
  /** For portrait-group: the adjacent text segment */
  adjacentText?: NarrativeSegment;
}

/** Lightweight markdown→HTML for narrator prose. No external dependency.
 *  DOMPurify handles sanitization — we only convert markdown syntax to HTML. */
function markdownToHtml(text: string): string {
  return text
    // Strip leaked JSON footnote blocks (safety net — server should extract these)
    .replace(/```json\s*\{[\s\S]*?\}\s*```/g, "")
    .replace(/```json\s*\{[\s\S]*$/g, "")
    // Headers (### h3, ## h2, # h1) — must come before bold/italic
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Horizontal rules
    .replace(/^---+$/gm, "<hr>")
    // Bold (**text**)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic (*text*)
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Paragraphs — double newline becomes paragraph break
    .replace(/\n\n/g, "</p><p>")
    // Single newlines become line breaks
    .replace(/\n/g, "<br>")
    // Footnote markers [N] → subtle superscripts (pending full 9-12 implementation)
    .replace(/\[(\d+)\]/g, '<sup class="text-[0.6em] opacity-40 ml-0.5">$1</sup>');
}

function buildSegments(messages: GameMessage[]): NarrativeSegment[] {
  const segments: NarrativeSegment[] = [];
  let chunkBuffer = "";
  let hasChunksForTurn = false;

  // Pre-scan: find NARRATION messages that have corresponding NARRATION_CHUNKs
  // anywhere after them. This handles the case where the server sends full
  // NARRATION before TTS chunk streaming begins (message ordering from server
  // returns NARRATION in the direct response, then TTS streams chunks async).
  const skipNarrationAt = new Set<number>();
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].type !== MessageType.NARRATION) continue;
    for (let j = i + 1; j < messages.length; j++) {
      if (messages[j].type === MessageType.NARRATION_CHUNK) {
        skipNarrationAt.add(i);
        break;
      }
      // Stop scanning at a new player action (next turn boundary)
      if (messages[j].type === MessageType.PLAYER_ACTION) break;
    }
  }

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
        segments.push({ kind: "separator" });
        hasChunksForTurn = false;
        break;
      case MessageType.NARRATION:
        // Skip when chunks already delivered this turn's text (backwards compat)
        // or when look-ahead finds chunks will deliver it (server sends
        // NARRATION in the direct response before TTS streams chunks).
        if (hasChunksForTurn || skipNarrationAt.has(i)) break;
        flushChunks();
        segments.push({
          kind: "text",
          html: DOMPurify.sanitize(markdownToHtml(msg.payload.text as string)),
        });
        break;
      case MessageType.IMAGE:
        flushChunks();
        segments.push({
          kind: "image",
          url: msg.payload.url as string,
          alt: (msg.payload.alt ?? msg.payload.description) as string | undefined,
          caption: (msg.payload.caption ?? msg.payload.description) as string | undefined,
          width: msg.payload.width as number | undefined,
          height: msg.payload.height as number | undefined,
          tier: msg.payload.tier as string | undefined,
        });
        break;
      case MessageType.SESSION_EVENT: {
        const event = msg.payload.event as string | undefined;
        // Skip non-display events (theme, connect, ready are infrastructure)
        if (event === "theme_css" || event === "connected" || event === "ready") break;
        flushChunks();
        // Slash command results have a `text` field instead of event/player_name
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
        segments.push({
          kind: "error",
          text: msg.payload.message as string,
        });
        break;
      case MessageType.CHARACTER_SHEET: {
        flushChunks();
        const charName = msg.payload.name as string;
        const charClass = msg.payload.class as string | undefined;
        const level = msg.payload.level as number | undefined;
        const parts = [charName, charClass, level != null ? `Lv ${level}` : null]
          .filter(Boolean)
          .join(" — ");
        segments.push({ kind: "system", text: parts });
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
        if (location) {
          segments.push({ kind: "chapter-marker", text: location });
        }
        break;
      }
      default:
        break;
    }
  }

  // Flush any remaining chunks
  flushChunks();

  return segments;
}

/** Group portrait images with their adjacent text into flex-row pairs.
 *  Portrait images need to sit beside text, but the narrative container
 *  uses flex-col (where float is ignored). This merges them into a
 *  composite segment rendered as a flex-row wrapper. */
function groupPortraitSegments(segments: NarrativeSegment[]): NarrativeSegment[] {
  const result: NarrativeSegment[] = [];
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i];
    if (seg.kind === "image" && seg.tier === "portrait") {
      // Look for adjacent text segment (next)
      const next = segments[i + 1];
      if (next && next.kind === "text") {
        result.push({
          kind: "portrait-group",
          portraitImage: seg,
          adjacentText: next,
        });
        i += 2;
        continue;
      }
    }
    result.push(seg);
    i++;
  }
  return result;
}

/** Image component with skeleton loading and error fallback. */
function NarrativeImage({
  seg,
  onLightbox,
}: {
  seg: NarrativeSegment;
  onLightbox: (url: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const aspectRatio = seg.width && seg.height
    ? `${seg.width} / ${seg.height}`
    : undefined;

  return (
    <div
      className="overflow-hidden cursor-pointer transition-opacity hover:opacity-90 relative"
      style={aspectRatio ? { aspectRatio } : undefined}
      onClick={() => !errored && onLightbox(seg.url!)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" && !errored) onLightbox(seg.url!); }}
    >
      {!loaded && !errored && (
        <div className="absolute inset-0 bg-muted/20 animate-pulse rounded" />
      )}
      {errored ? (
        <div className="flex items-center justify-center h-full min-h-[4rem] bg-muted/10 rounded text-muted-foreground/40 text-xs italic">
          Image unavailable
        </div>
      ) : (
        <img
          src={seg.url}
          alt={seg.alt ?? ""}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}

function useDinkusGlyph(messages: GameMessage[]): string {
  const [glyph, setGlyph] = useState("◇");
  // Re-read when messages change — theme_css arrives as a message
  useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--dinkus-glyph").trim();
    const clean = raw.replace(/^['"]|['"]$/g, "");
    if (clean) setGlyph(clean);
  }, [messages]);
  return glyph;
}

function useRunningHeader(messages: GameMessage[]) {
  return useMemo(() => {
    let chapterTitle: string | null = null;
    let turnCount = 0;
    for (const msg of messages) {
      if (msg.type === MessageType.CHAPTER_MARKER) {
        const loc = msg.payload.location as string;
        if (loc) chapterTitle = loc;
      }
      if (msg.type === MessageType.PLAYER_ACTION) {
        turnCount++;
      }
    }
    return { chapterTitle, turnCount };
  }, [messages]);
}

export function NarrativeView({ messages, thinking }: NarrativeViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const dinkusGlyph = useDinkusGlyph(messages);
  const { chapterTitle, turnCount } = useRunningHeader(messages);

  const segments = useMemo(() => groupPortraitSegments(buildSegments(messages)), [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 50;
    autoScrollRef.current = atBottom;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && autoScrollRef.current) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
  }, [segments, thinking, messages.length]);

  // Escape closes lightbox
  useEffect(() => {
    if (!lightboxUrl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxUrl]);

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Running header — book page top */}
      {chapterTitle && (
        <div
          data-testid="running-header"
          className="sticky top-0 z-10 flex items-baseline justify-between
                     px-6 pt-3 pb-4
                     bg-gradient-to-b from-background via-background/95 to-transparent
                     pointer-events-none select-none"
        >
          <span className="text-xs tracking-widest uppercase text-muted-foreground/30 font-light">
            ◇ {chapterTitle}
          </span>
          {turnCount > 0 && (
            <span className="text-xs tracking-widest text-muted-foreground/25 font-light">
              {toRoman(turnCount)}
            </span>
          )}
        </div>
      )}
      <div
        ref={scrollRef}
        data-testid="narrative-view"
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-4 flex flex-col"
      >
      {segments.length === 0 && (
        <div className="flex-1 flex items-end justify-center pb-8">
          <p className="text-sm italic text-muted-foreground/50 animate-pulse">
            The narrator gathers their thoughts...
          </p>
        </div>
      )}
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case "text":
            return (
              <div
                key={i}
                className="prose dark:prose-invert text-xl leading-relaxed max-w-[65ch] mx-auto mb-6"
                dangerouslySetInnerHTML={{ __html: seg.html! }}
              />
            );
          case "portrait-group": {
            const img = seg.portraitImage!;
            const txt = seg.adjacentText!;
            return (
              <div key={i} className="flex gap-4 max-w-[65ch] mx-auto my-4">
                <div
                  className="prose dark:prose-invert text-xl leading-relaxed flex-1 min-w-0"
                  dangerouslySetInnerHTML={{ __html: txt.html! }}
                />
                <figure className="w-48 shrink-0">
                  <NarrativeImage seg={img} onLightbox={(url) => setLightboxUrl(url)} />
                  {img.caption && (
                    <figcaption className="text-xs text-muted-foreground/50 mt-2 italic text-center">
                      {img.caption}
                    </figcaption>
                  )}
                </figure>
              </div>
            );
          }
          case "image": {
            const tierClass = seg.tier === "portrait"
              ? "my-4 max-w-[12rem] mx-auto"
              : seg.tier === "landscape"
              ? "my-8 max-w-2xl mx-auto"
              : seg.tier === "scene"
              ? "my-8 max-w-full mx-auto"
              : "my-8 max-w-prose mx-auto";
            return (
              <figure key={i} className={tierClass}>
                <NarrativeImage seg={seg} onLightbox={(url) => setLightboxUrl(url)} />
                {seg.caption && (
                  <figcaption className="text-xs text-muted-foreground/50 mt-2 italic text-center max-w-[80%] mx-auto">
                    {seg.caption}
                  </figcaption>
                )}
              </figure>
            );
          }
          case "separator":
            return (
              <hr
                key={i}
                data-testid="segment-separator"
                className="border-0 border-t border-border/20 my-8 max-w-[8rem] mx-auto"
              />
            );
          case "system":
            return (
              <div
                key={i}
                data-testid="system-message"
                className="text-xs text-muted-foreground/60 italic py-1 text-center max-w-prose mx-auto"
              >
                {seg.text}
              </div>
            );
          case "turn-status":
            return (
              <div
                key={i}
                data-testid="turn-status"
                className="text-sm font-semibold text-accent-foreground py-1"
              >
                {seg.text}
              </div>
            );
          case "error":
            return (
              <div
                key={i}
                role="alert"
                className="text-sm text-destructive/80 bg-destructive/5 rounded-md px-3 py-2 max-w-prose mx-auto border border-destructive/10"
              >
                {seg.text}
              </div>
            );
          case "player-action":
            return (
              <div
                key={i}
                data-testid="player-action"
                className="text-base text-muted-foreground/70 italic max-w-prose mx-auto my-1"
              >
                {seg.text}
              </div>
            );
          case "player-aside":
            return (
              <div
                key={i}
                data-testid="player-aside"
                className="text-sm text-muted-foreground/50 italic max-w-prose mx-auto my-1"
              >
                {seg.text}
              </div>
            );
          case "chapter-marker":
            // Skip rendering inline if the running header already shows this location
            if (chapterTitle === seg.text) return null;
            return (
              <div
                key={i}
                data-testid="chapter-marker"
                className="my-12 max-w-prose mx-auto text-center"
              >
                <div className="text-muted-foreground/30 text-xs tracking-[0.5em] mb-2">◇ ◇ ◇</div>
                <span className="text-lg font-semibold tracking-widest uppercase text-muted-foreground/80">
                  {seg.text}
                </span>
              </div>
            );
        }
      })}

      {/* Thinking indicator */}
      {thinking && (
        <div
          data-testid="thinking-indicator"
          className="flex items-center justify-center gap-3 max-w-prose mx-auto py-2 text-muted-foreground/30"
        >
          <span className="text-sm animate-pulse [animation-delay:0ms]">{dinkusGlyph}</span>
          <span className="text-sm animate-pulse [animation-delay:200ms]">{dinkusGlyph}</span>
          <span className="text-sm animate-pulse [animation-delay:400ms]">{dinkusGlyph}</span>
        </div>
      )}

      {/* Lightbox overlay */}
      {lightboxUrl && (
        <div
          data-testid="image-lightbox"
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxUrl(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setLightboxUrl(null); }}
        >
          <img
            src={lightboxUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      </div>
    </div>
  );
}
