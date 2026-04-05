import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageType, type GameMessage } from "@/types/protocol";
import { useLayoutMode, type LayoutMode } from "@/hooks/useLayoutMode";
import { NarrationScroll } from "@/components/NarrationScroll";
import { NarrationFocus } from "@/components/NarrationFocus";
import { NarrationCards } from "@/components/NarrationCards";

export interface NarrativeViewProps {
  messages: GameMessage[];
  thinking?: boolean;
  /** When provided, overrides the hook-based layout mode (single source of truth from parent). */
  layoutMode?: LayoutMode;
}

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

export function NarrativeView({ messages, thinking, layoutMode }: NarrativeViewProps) {
  const { mode: hookMode } = useLayoutMode();
  const mode = layoutMode ?? hookMode;
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
      <LayoutComponent messages={messages} thinking={thinking} setLightboxUrl={setLightboxUrl} />

      {/* Lightbox overlay — portal to body to escape overflow-hidden ancestors */}
      {lightboxUrl && createPortal(
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
        </div>,
        document.body,
      )}
    </div>
  );
}
