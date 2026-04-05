import { useMemo, useEffect, useRef, useCallback } from "react";
import { buildSegments, groupPortraitSegments, type NarrativeSegment } from "@/lib/narrativeSegments";
import type { GameMessage } from "@/types/protocol";
import { renderSegment } from "./narrativeRenderers";

export interface NarrationScrollProps {
  messages: GameMessage[];
  thinking?: boolean;
}

export function NarrationScroll({ messages, thinking }: NarrationScrollProps) {
  const segments = useMemo(
    () => groupPortraitSegments(buildSegments(messages)),
    [messages],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    autoScroll.current = el.scrollTop >= el.scrollHeight - el.clientHeight - 50;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && autoScroll.current) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
  }, [segments, thinking]);

  return (
    <div
      ref={scrollRef}
      data-testid="narration-scroll"
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto flex flex-col"
    >
      <div className="flex-1" />
      <div className="px-6 py-8 space-y-4">
        {segments.length === 0 ? (
          <div className="flex items-end justify-center pb-8">
            <p className="text-sm italic text-muted-foreground/50 animate-pulse">
              The narrator gathers their thoughts...
            </p>
          </div>
        ) : (
          segments.map((seg, i) =>
            renderSegment(seg, i, { maxTextWidth: "max-w-[85ch]" }),
          )
        )}
        {thinking && (
          <div
            data-testid="thinking-indicator"
            className="flex items-center justify-center gap-3 py-2 text-muted-foreground/30"
          >
            <span className="text-sm animate-pulse">◇</span>
            <span className="text-sm animate-pulse [animation-delay:200ms]">◇</span>
            <span className="text-sm animate-pulse [animation-delay:400ms]">◇</span>
          </div>
        )}
      </div>
    </div>
  );
}
