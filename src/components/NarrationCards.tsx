import { useMemo } from "react";
import { buildSegments, groupPortraitSegments } from "@/lib/narrativeSegments";
import type { GameMessage } from "@/types/protocol";
import { renderSegment } from "./narrativeRenderers";
import { ThinkingIndicator, EmptyNarrationState } from "./NarrationShared";

export interface NarrationCardsProps {
  messages: GameMessage[];
  thinking?: boolean;
}

export function NarrationCards({ messages, thinking }: NarrationCardsProps) {
  const segments = useMemo(
    () => groupPortraitSegments(buildSegments(messages)).filter((s) => s.kind !== "separator"),
    [messages],
  );

  return (
    <div data-testid="narration-cards" className="flex-1 overflow-y-auto px-6 py-8">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((seg, i) => (
          <div
            key={i}
            data-testid="narration-card"
            className="rounded-lg border border-border/30 bg-card/50 p-4 shadow-sm"
          >
            {renderSegment(seg, i, { maxTextWidth: "" })}
          </div>
        ))}
      </div>

      {segments.length === 0 && <EmptyNarrationState />}

      {thinking && <ThinkingIndicator className="py-4" />}
    </div>
  );
}
