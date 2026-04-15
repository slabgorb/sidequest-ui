/**
 * ImageBusProvider — scrapbook-field enrichment tests.
 *
 * Story 33-17: the provider must surface optional scrapbook metadata fields
 * (turn_number, scene_name, scene_type, narrative_beat, chapter, location,
 * world_facts, npcs) when the IMAGE message payload carries them, and must
 * LEAVE THEM UNDEFINED when absent — per CLAUDE.md "no silent fallbacks".
 *
 * The server does not yet emit these fields (33-18 ships the bundled payload).
 * This test locks in the shape so that whenever the server starts emitting
 * them, the provider passes them through without code change.
 */
import { renderHook } from "@testing-library/react";
import { describe, it, expect, type ReactNode } from "vitest";
import {
  ImageBusProvider,
  useImageBus,
  type GalleryImage,
} from "@/providers/ImageBusProvider";
import { MessageType, type GameMessage } from "@/types/protocol";

function renderBus(messages: GameMessage[]): GalleryImage[] {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ImageBusProvider messages={messages}>{children}</ImageBusProvider>
  );
  const { result } = renderHook(() => useImageBus(), { wrapper });
  return result.current;
}

function imageMessage(payload: Record<string, unknown>): GameMessage {
  return {
    type: MessageType.IMAGE,
    payload,
  } as GameMessage;
}

describe("ImageBusProvider — scrapbook field passthrough", () => {
  it("extracts turn_number, scene_name, scene_type, narrative_beat, chapter, location when present", () => {
    const images = renderBus([
      imageMessage({
        url: "https://example.invalid/a.webp",
        render_id: "r-1",
        turn_number: 7,
        scene_name: "The Throat",
        scene_type: "establishing",
        narrative_beat: "Moss pulses faintly on the wall.",
        chapter: "Into the Dark",
        location: "Mawdeep Entrance",
      }),
    ]);
    expect(images).toHaveLength(1);
    const [entry] = images;
    expect(entry.turn_number).toBe(7);
    expect(entry.scene_name).toBe("The Throat");
    expect(entry.scene_type).toBe("establishing");
    expect(entry.narrative_beat).toBe("Moss pulses faintly on the wall.");
    expect(entry.chapter).toBe("Into the Dark");
    expect(entry.location).toBe("Mawdeep Entrance");
  });

  it("extracts world_facts array when present", () => {
    const images = renderBus([
      imageMessage({
        url: "https://example.invalid/a.webp",
        render_id: "r-1",
        world_facts: ["glowing moss", "rusted winch"],
      }),
    ]);
    expect(images[0].world_facts).toEqual(["glowing moss", "rusted winch"]);
  });

  it("extracts npcs array with name+role when present", () => {
    const images = renderBus([
      imageMessage({
        url: "https://example.invalid/a.webp",
        render_id: "r-1",
        npcs: [
          { name: "Grell", role: "hostile" },
          { name: "Aster", role: "friendly" },
        ],
      }),
    ]);
    expect(images[0].npcs).toEqual([
      { name: "Grell", role: "hostile" },
      { name: "Aster", role: "friendly" },
    ]);
  });

  it("leaves scrapbook fields undefined when payload omits them (no silent defaults)", () => {
    const images = renderBus([
      imageMessage({
        url: "https://example.invalid/a.webp",
        render_id: "r-1",
      }),
    ]);
    expect(images).toHaveLength(1);
    const [entry] = images;
    expect(entry.turn_number).toBeUndefined();
    expect(entry.scene_name).toBeUndefined();
    expect(entry.scene_type).toBeUndefined();
    expect(entry.narrative_beat).toBeUndefined();
    expect(entry.chapter).toBeUndefined();
    expect(entry.location).toBeUndefined();
    expect(entry.world_facts).toBeUndefined();
    expect(entry.npcs).toBeUndefined();
  });

  it("treats isHandout as strict boolean — non-boolean truthy values are rejected (rework 2026-04-15)", () => {
    // Rework driver: Reviewer flagged `isHandout: (payload.handout as boolean) ?? false`
    // as ineffective — the cast coerces before `??`, so a string "true" or the
    // number 1 is silently accepted as `isHandout=true`. After fix, only a
    // literal boolean true produces isHandout=true; everything else (strings,
    // numbers, undefined) produces false.
    const images = renderBus([
      imageMessage({
        url: "https://example.invalid/a.webp",
        render_id: "r-string-true",
        // @ts-expect-error — deliberately malformed payload
        handout: "true",
      }),
      imageMessage({
        url: "https://example.invalid/b.webp",
        render_id: "r-number-one",
        // @ts-expect-error — deliberately malformed payload
        handout: 1,
      }),
      imageMessage({
        url: "https://example.invalid/c.webp",
        render_id: "r-bool-true",
        handout: true,
      }),
      imageMessage({
        url: "https://example.invalid/d.webp",
        render_id: "r-absent",
      }),
    ]);
    // Order reversed inside provider — map by render_id for assertion clarity.
    const byId = Object.fromEntries(
      images.map((img) => [img.render_id, img]),
    );
    expect(byId["r-string-true"].isHandout).toBe(false);
    expect(byId["r-number-one"].isHandout).toBe(false);
    expect(byId["r-bool-true"].isHandout).toBe(true);
    expect(byId["r-absent"].isHandout).toBe(false);
  });

  it("preserves existing fields (url, render_id, timestamp, isHandout) alongside enrichment", () => {
    const images = renderBus([
      imageMessage({
        url: "https://example.invalid/a.webp",
        render_id: "r-1",
        handout: true,
        turn_number: 3,
      }),
    ]);
    const [entry] = images;
    expect(entry.url).toBe("https://example.invalid/a.webp");
    expect(entry.render_id).toBe("r-1");
    expect(entry.isHandout).toBe(true);
    expect(entry.turn_number).toBe(3);
  });
});
