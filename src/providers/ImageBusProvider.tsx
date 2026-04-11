import { createContext, useContext, useMemo, type ReactNode } from "react";
import { MessageType, type GameMessage } from "@/types/protocol";

export interface GalleryImage {
  url: string;
  alt?: string;
  caption?: string;
  render_id?: string;
  tier?: string;
  width?: number;
  height?: number;
  timestamp: number;
  isHandout: boolean;
}

interface ImageBusContextValue {
  images: GalleryImage[];
}

const ImageBusContext = createContext<ImageBusContextValue>({ images: [] });

interface ImageBusProviderProps {
  messages: GameMessage[];
  children: ReactNode;
}

export function ImageBusProvider({ messages, children }: ImageBusProviderProps) {
  const images = useMemo(() => {
    const result: GalleryImage[] = [];
    const seenRenderIds = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type !== MessageType.IMAGE) continue;

      const renderId = msg.payload.render_id as string | undefined;
      if (renderId) {
        if (seenRenderIds.has(renderId)) continue;
        seenRenderIds.add(renderId);
      }

      result.push({
        url: msg.payload.url as string,
        alt: (msg.payload.alt ?? msg.payload.description) as string | undefined,
        caption: (msg.payload.caption ?? msg.payload.description) as string | undefined,
        render_id: renderId,
        tier: msg.payload.tier as string | undefined,
        width: msg.payload.width as number | undefined,
        height: msg.payload.height as number | undefined,
        timestamp: i,
        isHandout: (msg.payload.handout as boolean) ?? false,
      });
    }

    return result.reverse();
  }, [messages]);

  return (
    <ImageBusContext.Provider value={{ images }}>
      {children}
    </ImageBusContext.Provider>
  );
}

// Co-located hook for the same reason as GameStateProvider — splitting one
// context+hook+component into 3 files for HMR is more churn than it's worth.
// eslint-disable-next-line react-refresh/only-export-components
export function useImageBus(): GalleryImage[] {
  return useContext(ImageBusContext).images;
}
