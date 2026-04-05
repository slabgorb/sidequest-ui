import { useEffect, useMemo, useState } from "react";
import { MessageType, type GameMessage } from "@/types/protocol";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { NarrationScroll } from "@/components/NarrationScroll";
import { NarrationFocus } from "@/components/NarrationFocus";
import { NarrationCards } from "@/components/NarrationCards";

export interface NarrativeViewProps {
  messages: GameMessage[];
  thinking?: boolean;
}

function useRunningHeader(messages: GameMessage[]) {
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

export function NarrativeView({ messages, thinking }: NarrativeViewProps) {
  const { mode } = useLayoutMode();
  const { chapterTitle } = useRunningHeader(messages);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Escape closes lightbox
  useEffect(() => {
    if (!lightboxUrl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxUrl]);

  const LayoutComponent =
    mode === "focus" ? NarrationFocus :
    mode === "cards" ? NarrationCards :
    NarrationScroll;

  return (
    <div data-testid="narrative-view" className="flex flex-col flex-1 min-h-0 relative">
      {/* Running header */}
      {chapterTitle && (
        <div
          data-testid="running-header"
          className="running-header sticky top-0 z-10 flex items-baseline justify-between
                     px-6 pt-3 pb-4
                     bg-gradient-to-b from-background via-background/95 to-transparent
                     pointer-events-none select-none"
        >
          <span className="location text-xs tracking-widest uppercase text-muted-foreground/30 font-light">
            {chapterTitle}
          </span>
        </div>
      )}

      <LayoutComponent messages={messages} thinking={thinking} />

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
