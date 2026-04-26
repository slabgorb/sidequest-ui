import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useRunningHeader } from "@/hooks/useRunningHeader";
import { MessageType, type GameMessage } from "@/types/protocol";
import type { CharacterSummary } from "@/types/party";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function chapterMarker(location: string, ts = "2026-04-26T12:00:00Z"): GameMessage {
  return {
    type: MessageType.CHAPTER_MARKER,
    timestamp: ts,
    payload: { location },
  } as unknown as GameMessage;
}

function character(id: string, current_location: string): CharacterSummary {
  return {
    player_id: id,
    name: id,
    character_name: id,
    portrait_url: "",
    hp: 10,
    hp_max: 10,
    status_effects: [],
    class: "",
    level: 1,
    current_location,
  };
}

// ---------------------------------------------------------------------------
// S2-UX (c): location chip prefers PARTY_STATUS over stale CHAPTER_MARKER
// ---------------------------------------------------------------------------

describe("useRunningHeader — S2-UX (c) location chip cache invalidation", () => {
  it("falls back to most recent CHAPTER_MARKER when no party data is provided", () => {
    const messages = [
      chapterMarker("Bridge — Outer Coyote Reach"),
      chapterMarker("Docking Crescent"),
    ];
    const { result } = renderHook(() => useRunningHeader(messages));
    expect(result.current.chapterTitle).toBe("Docking Crescent");
  });

  it("returns null when no chapter markers and no party data", () => {
    const { result } = renderHook(() => useRunningHeader([]));
    expect(result.current.chapterTitle).toBeNull();
  });

  it("PREFERS local player's current_location over a stale CHAPTER_MARKER", () => {
    // The cache-invalidation bug: chapter marker says BRIDGE but the prose
    // (and the party state) has moved to Docking Crescent. The chip should
    // follow PARTY_STATUS, not the stale marker.
    const messages = [chapterMarker("Bridge — Outer Coyote Reach")];
    const characters = [character("p1", "Docking Crescent")];
    const { result } = renderHook(() =>
      useRunningHeader(messages, characters, "p1"),
    );
    expect(result.current.chapterTitle).toBe("Docking Crescent");
  });

  it("uses local player's location even when no chapter marker has fired", () => {
    const characters = [character("p1", "Engine Room")];
    const { result } = renderHook(() =>
      useRunningHeader([], characters, "p1"),
    );
    expect(result.current.chapterTitle).toBe("Engine Room");
  });

  it("ignores non-local party members (the chip is per-PC, not party-wide)", () => {
    // Split party: I'm at Docking Crescent, my peer is on the Bridge.
    // The chip must reflect MY location, not a peer's.
    const characters = [
      character("p1", "Docking Crescent"),
      character("p2", "Bridge — Outer Coyote Reach"),
    ];
    const { result } = renderHook(() =>
      useRunningHeader([], characters, "p1"),
    );
    expect(result.current.chapterTitle).toBe("Docking Crescent");
  });

  it("falls back to chapter marker when local player's current_location is empty", () => {
    const messages = [chapterMarker("Bridge")];
    const characters = [character("p1", "")];
    const { result } = renderHook(() =>
      useRunningHeader(messages, characters, "p1"),
    );
    expect(result.current.chapterTitle).toBe("Bridge");
  });

  it("updates the chip when party state moves to a new location (no remount, no refresh)", () => {
    // The cross-turn refresh case. Mount with one location, then re-render
    // with a new one — the chip must update without a page refresh.
    const initialChars = [character("p1", "Bridge")];
    const { result, rerender } = renderHook(
      ({ chars }: { chars: CharacterSummary[] }) =>
        useRunningHeader([], chars, "p1"),
      { initialProps: { chars: initialChars } },
    );
    expect(result.current.chapterTitle).toBe("Bridge");

    rerender({ chars: [character("p1", "Docking Crescent")] });
    expect(result.current.chapterTitle).toBe("Docking Crescent");
  });
});
