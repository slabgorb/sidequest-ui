import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import DOMPurify from "dompurify";
import { MessageType, type GameMessage } from "@/types/protocol";
import { toRoman } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/useBreakpoint";

export interface NarrativeViewProps {
  messages: GameMessage[];
  thinking?: boolean;
}

interface FootnoteData {
  marker?: number;
  summary: string;
  category?: string;
  is_new?: boolean;
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
  /** Footnotes from NARRATION payload for knowledge display */
  footnotes?: FootnoteData[];
  /** For portrait-group: the image segment */
  portraitImage?: NarrativeSegment;
  /** For portrait-group: the adjacent text segment */
  adjacentText?: NarrativeSegment;
}

/** Lightweight markdown→HTML for narrator prose. No external dependency.
 *  DOMPurify handles sanitization — we only convert markdown syntax to HTML. */
function markdownToHtml(text: string): string {
  const result = text
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
    // Strip footnote markers [N] and [^N] from prose — structured footnote data comes in payload
    .replace(/\[\^?\d+\]/g, "");
  return `<p>${result}</p>`;
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
        // Only add a separator if the previous segment isn't already one
        // (avoids excessive dividers between consecutive narration blocks)
        if (segments.length > 0 && segments[segments.length - 1].kind !== "separator") {
          segments.push({ kind: "separator" });
        }
        hasChunksForTurn = false;
        break;
      case MessageType.NARRATION:
        // Skip when chunks already delivered this turn's text (backwards compat)
        // or when look-ahead finds chunks will deliver it (server sends
        // NARRATION in the direct response before TTS streams chunks).
        if (hasChunksForTurn || skipNarrationAt.has(i)) break;
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

  // Strip leading and trailing separators (they look orphaned)
  while (segments.length > 0 && segments[0].kind === "separator") {
    segments.shift();
  }
  while (segments.length > 0 && segments[segments.length - 1].kind === "separator") {
    segments.pop();
  }

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

/** Split segments into history (left column) and current (right column).
 *  The last separator marks the boundary — everything after it is "current". */
function splitSegments(segments: NarrativeSegment[]): {
  history: NarrativeSegment[];
  current: NarrativeSegment[];
} {
  let splitIndex = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].kind === "separator") {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex <= 0) {
    return { history: [], current: segments };
  }

  return {
    history: segments.slice(0, splitIndex + 1),
    current: segments.slice(splitIndex + 1),
  };
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
      className="overflow-hidden cursor-pointer transition-opacity hover:opacity-90 relative rounded-sm shadow-md shadow-black/20"
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

/** Render a single narrative segment. Shared by both columns and single-column mode. */
function renderSegment(
  seg: NarrativeSegment,
  i: number,
  opts: {
    maxTextWidth: string;
    chapterTitle: string | null;
    dinkusGlyph: string;
    setLightboxUrl: (url: string | null) => void;
  },
) {
  const { maxTextWidth, chapterTitle, dinkusGlyph, setLightboxUrl } = opts;
  switch (seg.kind) {
    case "text":
      return (
        <div key={i} className={`${maxTextWidth} mx-auto mb-6`}>
          <div
            className="prose dark:prose-invert text-xl leading-[1.45]"
            dangerouslySetInnerHTML={{ __html: seg.html! }}
          />
          {seg.footnotes && seg.footnotes.length > 0 && (
            <div className="mt-3 pt-2 border-t border-border/20 space-y-1">
              {seg.footnotes.map((fn, fi) => (
                <div
                  key={fi}
                  className="text-xs text-muted-foreground/60 leading-snug flex gap-2"
                >
                  {fn.marker != null && (
                    <span className="text-muted-foreground/40 shrink-0">[{fn.marker}]</span>
                  )}
                  <span>{fn.summary}</span>
                  {fn.is_new && (
                    <span className="text-accent-foreground/40 italic shrink-0">new</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case "portrait-group": {
      const img = seg.portraitImage!;
      const txt = seg.adjacentText!;
      return (
        <div key={i} className={`${maxTextWidth} mx-auto my-4`}>
          <div className="flex gap-4">
            <div
              className="prose dark:prose-invert text-xl leading-[1.45] flex-1 min-w-0"
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
          {txt.footnotes && txt.footnotes.length > 0 && (
            <div className="mt-3 pt-2 border-t border-border/20 space-y-1">
              {txt.footnotes.map((fn, fi) => (
                <div
                  key={fi}
                  className="text-xs text-muted-foreground/60 leading-snug flex gap-2"
                >
                  {fn.marker != null && (
                    <span className="text-muted-foreground/40 shrink-0">[{fn.marker}]</span>
                  )}
                  <span>{fn.summary}</span>
                  {fn.is_new && (
                    <span className="text-accent-foreground/40 italic shrink-0">new</span>
                  )}
                </div>
              ))}
            </div>
          )}
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
          className="text-base text-muted-foreground/70 italic max-w-prose mx-auto my-2 pl-6 border-l-2 border-primary/20"
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
          <div className="text-muted-foreground/30 text-xs tracking-[0.5em] mb-2">
            {dinkusGlyph} {dinkusGlyph} {dinkusGlyph}
          </div>
          <span className="text-lg font-semibold tracking-widest uppercase text-muted-foreground/80">
            {seg.text}
          </span>
        </div>
      );
  }
}

/** Group segments into "pages" split at separators.
 *  Each page becomes a scroll-snap target for the book feel. */
function groupIntoPages(segments: NarrativeSegment[]): NarrativeSegment[][] {
  const pages: NarrativeSegment[][] = [];
  let current: NarrativeSegment[] = [];

  for (const seg of segments) {
    if (seg.kind === "separator") {
      if (current.length > 0) {
        pages.push(current);
        current = [];
      }
    } else {
      current.push(seg);
    }
  }
  if (current.length > 0) {
    pages.push(current);
  }

  return pages;
}

/** Hook for independent scroll tracking on a column. */
function useColumnScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop >= el.scrollHeight - el.clientHeight - 50;
    autoScrollRef.current = atBottom;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el && autoScrollRef.current) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
  }, []);

  return { scrollRef, handleScroll, scrollToBottom };
}

export function NarrativeView({ messages, thinking }: NarrativeViewProps) {
  const breakpoint = useBreakpoint();
  const isSpread = breakpoint === "desktop";

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const dinkusGlyph = useDinkusGlyph(messages);
  const { chapterTitle, turnCount } = useRunningHeader(messages);

  const segments = useMemo(() => groupPortraitSegments(buildSegments(messages)), [messages]);

  // Split into history (left) and current (right) for spread layout
  const { history, current } = useMemo(() => splitSegments(segments), [segments]);

  // Independent scroll tracking for each column (spread mode)
  const historyScroll = useColumnScroll();
  const currentScroll = useColumnScroll();
  // Single scroll ref for mobile/tablet
  const singleScroll = useColumnScroll();

  // Auto-scroll triggers
  useEffect(() => {
    if (isSpread) {
      currentScroll.scrollToBottom();
      historyScroll.scrollToBottom();
    } else {
      singleScroll.scrollToBottom();
    }
  }, [segments, thinking, messages.length, isSpread]);

  // Escape closes lightbox
  useEffect(() => {
    if (!lightboxUrl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxUrl]);

  const segmentOpts = {
    chapterTitle,
    dinkusGlyph,
    setLightboxUrl,
  };

  const thinkingIndicator = thinking && (
    <div
      data-testid="thinking-indicator"
      className="flex items-center justify-center gap-3 py-2 text-muted-foreground/30"
    >
      <span className="text-sm animate-pulse [animation-delay:0ms]">{dinkusGlyph}</span>
      <span className="text-sm animate-pulse [animation-delay:200ms]">{dinkusGlyph}</span>
      <span className="text-sm animate-pulse [animation-delay:400ms]">{dinkusGlyph}</span>
    </div>
  );

  const emptyState = segments.length === 0 && (
    <div className="flex items-end justify-center pb-8">
      <p className="text-sm italic text-muted-foreground/50 animate-pulse">
        The narrator gathers their thoughts...
      </p>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Running header */}
      {chapterTitle && (
        <div
          data-testid="running-header"
          className="sticky top-0 z-10 flex items-baseline justify-between
                     px-6 pt-3 pb-4
                     bg-gradient-to-b from-background via-background/95 to-transparent
                     pointer-events-none select-none"
        >
          <span className="text-xs tracking-widest uppercase text-muted-foreground/30 font-light">
            {chapterTitle}
          </span>
          {turnCount > 0 && (
            <span className="text-xs tracking-widest text-muted-foreground/25 font-light tabular-nums">
              {toRoman(turnCount)}
            </span>
          )}
        </div>
      )}

      {isSpread ? (
        /* ── Two-column book spread (desktop ≥1200px) ── */
        <div className="flex flex-1 min-h-0">
          {/* Left column: history */}
          <div
            ref={historyScroll.scrollRef}
            onScroll={historyScroll.handleScroll}
            className="flex-1 overflow-y-auto scroll-snap-y-proximity"
            role="log"
            aria-label="Narrative history"
          >
            {(() => {
              const pages = groupIntoPages(history);
              if (pages.length === 0 && segments.length > 0) {
                return <div className="min-h-full" />;
              }
              return pages.map((page, pi) => (
                <div
                  key={pi}
                  className="min-h-full flex flex-col justify-end pl-12 pr-6 pt-10 pb-16 gap-4 snap-start"
                >
                  {page.map((seg, si) =>
                    renderSegment(seg, pi * 1000 + si, { ...segmentOpts, maxTextWidth: "max-w-[55ch]" })
                  )}
                </div>
              ));
            })()}
          </div>

          {/* Gutter — the spine */}
          <div className="w-6 shrink-0 flex items-stretch justify-center">
            <div className="w-px bg-border/15 bg-gradient-to-b from-transparent via-border/20 to-transparent" />
          </div>

          {/* Right column: current narration */}
          <div
            ref={currentScroll.scrollRef}
            data-testid="narrative-view"
            onScroll={currentScroll.handleScroll}
            className="flex-1 overflow-y-auto scroll-snap-y-proximity"
            role="log"
            aria-label="Current narration"
            aria-live="polite"
          >
            {(() => {
              const pages = groupIntoPages(current);
              if (pages.length === 0) {
                return (
                  <div className="min-h-full flex flex-col justify-end pl-6 pr-12 pt-10 pb-16 gap-4 snap-start">
                    {emptyState}
                    {thinkingIndicator}
                  </div>
                );
              }
              return pages.map((page, pi) => (
                <div
                  key={pi}
                  className="min-h-full flex flex-col justify-end pl-6 pr-12 pt-10 pb-16 gap-4 snap-start"
                >
                  {page.map((seg, si) =>
                    renderSegment(seg, pi * 1000 + si, { ...segmentOpts, maxTextWidth: "max-w-[55ch]" })
                  )}
                  {pi === pages.length - 1 && thinkingIndicator}
                </div>
              ));
            })()}
          </div>
        </div>
      ) : (
        /* ── Single column (tablet + mobile) ── */
        <div
          ref={singleScroll.scrollRef}
          data-testid="narrative-view"
          onScroll={singleScroll.handleScroll}
          className="flex-1 overflow-y-auto scroll-snap-y-proximity"
        >
          {(() => {
            const pages = groupIntoPages(segments);
            if (pages.length === 0) {
              return (
                <div className="min-h-full flex flex-col justify-end px-6 py-8 gap-4 snap-start">
                  {emptyState}
                  {thinkingIndicator}
                </div>
              );
            }
            return pages.map((page, pi) => (
              <div
                key={pi}
                className="min-h-full flex flex-col justify-end px-6 py-8 gap-4 snap-start"
              >
                {page.map((seg, si) =>
                  renderSegment(seg, pi * 1000 + si, { ...segmentOpts, maxTextWidth: "max-w-[65ch]" })
                )}
                {pi === pages.length - 1 && thinkingIndicator}
              </div>
            ));
          })()}
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
  );
}
