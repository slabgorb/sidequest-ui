import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useGenreTheme } from "@/hooks/useGenreTheme";
import { MessageType, type GameMessage } from "@/types/protocol";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSessionEvent(
  event: string,
  extra?: Record<string, unknown>,
): GameMessage {
  return {
    type: MessageType.SESSION_EVENT,
    payload: { event, ...extra },
    player_id: "server",
  };
}

const SAMPLE_CSS = ":root { --primary: 210 40% 30%; font-family: Cinzel; }";
const OTHER_CSS = ":root { --primary: 30 80% 50%; font-family: Rajdhani; }";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useGenreTheme", () => {
  beforeEach(() => {
    // Clean up any injected style tags
    document.getElementById("genre-theme-css")?.remove();
  });

  afterEach(() => {
    document.getElementById("genre-theme-css")?.remove();
    document.documentElement.removeAttribute("data-genre");
  });

  it("does nothing when messages array is empty", () => {
    renderHook(() => useGenreTheme([]));
    expect(document.getElementById("genre-theme-css")).toBeNull();
  });

  it("injects CSS from theme_css event into a style tag", () => {
    const msg = makeSessionEvent("theme_css", { css: SAMPLE_CSS });
    renderHook(() => useGenreTheme([msg]));

    const styleEl = document.getElementById("genre-theme-css") as HTMLStyleElement;
    expect(styleEl).not.toBeNull();
    expect(styleEl.textContent).toBe(SAMPLE_CSS);
  });

  it("ignores SESSION_EVENT with non-theme_css events", () => {
    const leaveMsg = makeSessionEvent("leave");
    renderHook(() => useGenreTheme([leaveMsg]));
    expect(document.getElementById("genre-theme-css")).toBeNull();
  });

  it("ignores non-SESSION_EVENT messages", () => {
    const narration: GameMessage = {
      type: MessageType.NARRATION,
      payload: { text: "The wind howls." },
      player_id: "server",
    };
    renderHook(() => useGenreTheme([narration]));
    expect(document.getElementById("genre-theme-css")).toBeNull();
  });

  it("handles theme_css event with missing css gracefully", () => {
    const noCSS = makeSessionEvent("theme_css");
    renderHook(() => useGenreTheme([noCSS]));
    expect(document.getElementById("genre-theme-css")).toBeNull();
  });

  it("sets data-genre attribute on documentElement when theme_css is applied", () => {
    const msg = makeSessionEvent("theme_css", { css: SAMPLE_CSS });
    renderHook(() => useGenreTheme([msg]));
    expect(document.documentElement.getAttribute("data-genre")).toBe("active");
  });

  it("removes data-genre attribute on cleanup", () => {
    const msg = makeSessionEvent("theme_css", { css: SAMPLE_CSS });
    const { unmount } = renderHook(() => useGenreTheme([msg]));
    expect(document.documentElement.getAttribute("data-genre")).toBe("active");
    unmount();
    expect(document.documentElement.getAttribute("data-genre")).toBeNull();
  });

  it("updates CSS when a new theme_css event arrives", () => {
    const first = makeSessionEvent("theme_css", { css: SAMPLE_CSS });
    const { rerender } = renderHook(
      ({ msgs }: { msgs: GameMessage[] }) => useGenreTheme(msgs),
      { initialProps: { msgs: [first] } },
    );

    expect(
      (document.getElementById("genre-theme-css") as HTMLStyleElement).textContent,
    ).toBe(SAMPLE_CSS);

    const second = makeSessionEvent("theme_css", { css: OTHER_CSS });
    rerender({ msgs: [first, second] });

    expect(
      (document.getElementById("genre-theme-css") as HTMLStyleElement).textContent,
    ).toBe(OTHER_CSS);
  });
});
