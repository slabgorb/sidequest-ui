import { useState } from "react";
import type { NarrativeSegment } from "@/lib/narrativeSegments";

function NarrativeImage({
  seg,
  onLightbox,
}: {
  seg: NarrativeSegment;
  onLightbox?: (url: string) => void;
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
      onClick={() => !errored && onLightbox?.(seg.url!)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" && !errored) onLightbox?.(seg.url!); }}
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

function FootnoteList({ footnotes }: { footnotes: NarrativeSegment["footnotes"] }) {
  if (!footnotes || footnotes.length === 0) return null;
  return (
    <div className="mt-3 pt-2 border-t border-border/20 space-y-1">
      {footnotes.map((fn, fi) => (
        <div
          key={fi}
          id={fn.marker != null ? `footnote-${fn.marker}` : undefined}
          data-footnote-id={fn.marker != null ? fn.marker : undefined}
          className="text-xs text-muted-foreground/60 leading-snug flex gap-2 target:bg-accent/20 scroll-mt-4 rounded px-1 transition-colors"
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
  );
}

export interface RenderSegmentOpts {
  maxTextWidth?: string;
  chapterTitle?: string | null;
  dinkusGlyph?: string;
  setLightboxUrl?: (url: string | null) => void;
}

export function renderSegment(
  seg: NarrativeSegment,
  i: number,
  opts: RenderSegmentOpts = {},
) {
  const {
    maxTextWidth = "",
    chapterTitle = null,
    dinkusGlyph = "◇",
    setLightboxUrl,
  } = opts;

  switch (seg.kind) {
    case "text":
      return (
        <div key={i} className={`${maxTextWidth} mx-auto mb-6`}>
          <div
            className="prose dark:prose-invert text-xl leading-[1.45]"
            dangerouslySetInnerHTML={{ __html: seg.html! }}
          />
          <FootnoteList footnotes={seg.footnotes} />
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
              <NarrativeImage seg={img} onLightbox={setLightboxUrl ? (url) => setLightboxUrl(url) : undefined} />
              {img.caption && (
                <figcaption className="text-xs text-muted-foreground/50 mt-2 italic text-center">
                  {img.caption}
                </figcaption>
              )}
            </figure>
          </div>
          <FootnoteList footnotes={txt.footnotes} />
        </div>
      );
    }
    case "image": {
      const isPortrait = seg.tier === "portrait";
      const tierClass = isPortrait
        ? "my-4 max-w-[12rem] mx-auto"
        : "my-4 max-w-sm mx-auto rounded-sm";
      return (
        <figure key={i} className={tierClass}>
          <NarrativeImage seg={seg} onLightbox={setLightboxUrl ? (url) => setLightboxUrl(url) : undefined} />
          {seg.caption && (
            <figcaption className="text-xs text-muted-foreground/50 mt-2 italic text-center">
              {seg.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "render-pending": {
      const isPortrait = seg.tier === "portrait";
      const pendingClass = isPortrait
        ? "my-4 max-w-[12rem] mx-auto"
        : "my-4 max-w-sm mx-auto rounded-sm";
      const aspectRatio = seg.width && seg.height
        ? `${seg.width} / ${seg.height}`
        : undefined;
      return (
        <div
          key={i}
          className={`${pendingClass} overflow-hidden rounded-sm`}
          style={aspectRatio ? { aspectRatio } : undefined}
        >
          <div className="w-full h-full min-h-[8rem] bg-muted/20 animate-pulse rounded" />
        </div>
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
          className="text-xs text-muted-foreground/60 italic py-1 text-center max-w-[85ch] mx-auto"
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
          className="text-sm text-destructive/80 bg-destructive/5 rounded-md px-3 py-2 max-w-[85ch] mx-auto border border-destructive/10"
        >
          {seg.text}
        </div>
      );
    case "player-action":
      return (
        <div
          key={i}
          data-testid="player-action"
          className="text-base text-muted-foreground/70 italic max-w-[85ch] mx-auto my-2 pl-6 border-l-2 border-primary/20"
        >
          {seg.text}
        </div>
      );
    case "player-aside":
      return (
        <div
          key={i}
          data-testid="player-aside"
          className="text-sm text-muted-foreground/50 italic max-w-[85ch] mx-auto my-1"
        >
          {seg.text}
        </div>
      );
    case "chapter-marker":
      if (chapterTitle === seg.text) return null;
      return (
        <div
          key={i}
          data-testid="chapter-marker"
          className="my-12 max-w-[85ch] mx-auto text-center"
        >
          <div className="text-muted-foreground/30 text-xs tracking-[0.5em] mb-2">
            {dinkusGlyph} {dinkusGlyph} {dinkusGlyph}
          </div>
          <span className="text-lg font-semibold tracking-widest uppercase text-muted-foreground/80">
            {seg.text}
          </span>
        </div>
      );
    case "action-reveal":
      return (
        <div
          key={i}
          data-testid="action-reveal"
          className="max-w-[85ch] mx-auto my-4 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 space-y-2"
        >
          {seg.actions?.map((entry, ai) => (
            <div key={ai} className="flex gap-2 text-sm" data-auto-resolved="false">
              <span className="font-semibold text-primary/80 shrink-0">
                {entry.character_name}:
              </span>
              <span className="text-foreground/80 italic">{entry.action}</span>
            </div>
          ))}
          {seg.autoResolved?.map((name, ri) => (
            <div key={`auto-${ri}`} className="flex gap-2 text-sm text-muted-foreground/60 italic" data-auto-resolved="true">
              <span className="font-semibold shrink-0">{name}</span>
              <span>hesitated...</span>
              <span className="text-amber-500 text-xs ml-1">timed out</span>
            </div>
          ))}
        </div>
      );
  }
}
