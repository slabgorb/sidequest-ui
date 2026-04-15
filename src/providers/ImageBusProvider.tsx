import { createContext, useContext, useMemo, type ReactNode } from "react";
import { MessageType, type GameMessage } from "@/types/protocol";

export type NpcRole = "hostile" | "friendly" | "neutral";

export interface ScrapbookNpc {
  name: string;
  role: NpcRole;
}

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
  // Scrapbook metadata (story 33-17). Optional — server payloads without
  // these fields surface as `undefined` rather than defaults; ScrapbookGallery
  // degrades gracefully per the CLAUDE.md "no silent fallbacks" rule. The
  // bundled payload from 33-18 is the source once it ships; until then, only
  // fields the server already happens to emit will be present.
  turn_number?: number;
  scene_name?: string;
  scene_type?: string;
  narrative_beat?: string;
  chapter?: string;
  location?: string;
  world_facts?: string[];
  npcs?: ScrapbookNpc[];
}

interface ImageBusContextValue {
  images: GalleryImage[];
}

const ImageBusContext = createContext<ImageBusContextValue>({ images: [] });

interface ImageBusProviderProps {
  messages: GameMessage[];
  children: ReactNode;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") out.push(entry);
  }
  return out.length > 0 ? out : undefined;
}

function readNpcArray(value: unknown): ScrapbookNpc[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: ScrapbookNpc[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const name = rec.name;
    const role = rec.role;
    if (typeof name !== "string") continue;
    if (role !== "hostile" && role !== "friendly" && role !== "neutral") continue;
    out.push({ name, role });
  }
  return out.length > 0 ? out : undefined;
}

export function ImageBusProvider({ messages, children }: ImageBusProviderProps) {
  const images = useMemo(() => {
    const result: GalleryImage[] = [];
    const seenRenderIds = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type !== MessageType.IMAGE) continue;

      const payload = msg.payload as Record<string, unknown>;
      const renderId = payload.render_id as string | undefined;
      if (renderId) {
        if (seenRenderIds.has(renderId)) continue;
        seenRenderIds.add(renderId);
      }

      const turnNumber =
        typeof payload.turn_number === "number" ? payload.turn_number : undefined;

      result.push({
        url: payload.url as string,
        alt: (payload.alt ?? payload.description) as string | undefined,
        caption: (payload.caption ?? payload.description) as string | undefined,
        render_id: renderId,
        tier: payload.tier as string | undefined,
        width: payload.width as number | undefined,
        height: payload.height as number | undefined,
        timestamp: i,
        isHandout: (payload.handout as boolean) ?? false,
        turn_number: turnNumber,
        scene_name:
          typeof payload.scene_name === "string" ? payload.scene_name : undefined,
        scene_type:
          typeof payload.scene_type === "string" ? payload.scene_type : undefined,
        narrative_beat:
          typeof payload.narrative_beat === "string"
            ? payload.narrative_beat
            : undefined,
        chapter: typeof payload.chapter === "string" ? payload.chapter : undefined,
        location:
          typeof payload.location === "string" ? payload.location : undefined,
        world_facts: readStringArray(payload.world_facts),
        npcs: readNpcArray(payload.npcs),
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
