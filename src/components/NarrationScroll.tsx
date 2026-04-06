import { useMemo, useEffect, useRef, useCallback } from "react";
import { buildSegments, groupPortraitSegments } from "@/lib/narrativeSegments";
import type { GameMessage } from "@/types/protocol";
import { renderSegment } from "./narrativeRenderers";
import { ThinkingIndicator, EmptyNarrationState } from "./NarrationShared";

export interface NarrationScrollProps {
  messages: GameMessage[];
  thinking?: boolean;
  setLightboxUrl?: (url: string | null) => void;
}

export function NarrationScroll({ messages, thinking, setLightboxUrl }: NarrationScrollProps) {
  const segments = useMemo(
    () => groupPortraitSegments(buildSegments(messages)),
    [messages],
  );

  // Find the last separator index to split history from current turn
  const lastSeparatorIdx = useMemo(() => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].kind === "separator") return i;
    }
    return -1;
  }, [segments]);

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

  const hasHistory = lastSeparatorIdx >= 0;
  const historySegments = hasHistory ? segments.slice(0, lastSeparatorIdx) : [];
  const currentSegments = hasHistory ? segments.slice(lastSeparatorIdx + 1) : segments;

  return (
    <div
      ref={scrollRef}
      data-testid="narration-scroll"
      onScroll={handleScroll}
      className="narrative-scroll flex-1 min-h-0 overflow-y-auto flex flex-col"
    >
      <div className="flex-1" />
      <div className="px-6 py-8 space-y-4">
        {segments.length === 0 ? (
          <EmptyNarrationState />
        ) : (
          <>
            {/* History — dimmed at 0.4 opacity */}
            {hasHistory && historySegments.length > 0 && (
              <div className="opacity-40 space-y-4 pb-6 mb-6 border-b-2 border-border/50">
                {historySegments.map((seg, i) =>
                  renderSegment(seg, i, { maxTextWidth: "max-w-[85ch]", setLightboxUrl }),
                )}
              </div>
            )}
            {/* Current turn — full opacity */}
            {currentSegments.map((seg, i) =>
              renderSegment(seg, historySegments.length + 1 + i, { maxTextWidth: "max-w-[85ch]", setLightboxUrl }),
            )}
          </>
        )}
        {thinking && <ThinkingIndicator />}
      </div>
    </div>
  );
}
