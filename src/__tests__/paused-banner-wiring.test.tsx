// PausedBanner wiring test — MP-02 Task 8 integration verification.
//
// Task 8 of the MP-02 plan says "wire PausedBanner into the game screen."
// Unit tests in components/__tests__/PausedBanner.test.tsx prove the
// component renders correctly in isolation; this test proves AppInner
// actually listens for GAME_PAUSED / GAME_RESUMED messages from the
// WebSocket and renders the banner in response.
//
// Per CLAUDE.md "Verify Wiring, Not Just Existence" — unit tests passing
// on unimported components are worthless. This test hits the real AppInner
// through a mocked WebSocket server to confirm the message → state →
// banner pipeline is connected end-to-end.

import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { WS } from "jest-websocket-mock";
import {
  installWebAudioMock,
  installLocalStorageMock,
} from "@/audio/__tests__/web-audio-mock";
import { AudioEngine } from "@/audio/AudioEngine";
import App from "../App";

const GAME_META = {
  genre_slug: "low_fantasy",
  world_slug: "greyhawk",
  mode: "multiplayer",
};

function makeFetchMock() {
  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === "string" && /\/api\/games\/[^?]+/.test(url)) {
      return Promise.resolve(
        new Response(JSON.stringify(GAME_META), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (typeof url === "string" && url.includes("/api/genres")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ low_fantasy: { name: "Low Fantasy", worlds: [] } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  });
}

beforeEach(() => {
  AudioEngine.resetInstance();
  installWebAudioMock();
  installLocalStorageMock();
  localStorage.setItem("sq:display-name", "alice");
  // Seed journey history for the slug used below so AppInner's slug-mode
  // trust gate (silent-rebind protection added 2026-04-26) treats this as
  // an existing identity. Without this entry the direct mount would render
  // the NamePrompt and the WS connect would never fire.
  localStorage.setItem(
    "sidequest-history",
    JSON.stringify([
      {
        player_name: "alice",
        genre: "low_fantasy",
        world: "greyhawk",
        last_played_iso: new Date().toISOString(),
        game_slug: "2026-04-22-moldharrow-keep",
        mode: "multiplayer",
      },
    ]),
  );
  vi.stubGlobal("fetch", makeFetchMock());
});

afterEach(() => {
  WS.clean();
  AudioEngine.resetInstance();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute("data-archetype");
});

describe("PausedBanner wiring (MP-02 Task 8)", () => {
  it("renders the banner when the server sends GAME_PAUSED", async () => {
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={["/play/2026-04-22-moldharrow-keep"]}>
        <App />
      </MemoryRouter>,
    );

    await server.connected;
    await server.nextMessage; // consume SESSION_EVENT connect

    // No banner before the server pauses.
    expect(screen.queryByText(/paused/i)).toBeNull();

    act(() => {
      server.send({
        type: "GAME_PAUSED",
        payload: { waiting_for: ["bob", "carol"] },
      });
    });

    // Banner appears with both absent player names.
    await waitFor(() => {
      const banner = screen.getByText(/paused/i);
      expect(banner).toBeInTheDocument();
      expect(banner.textContent).toMatch(/bob/);
      expect(banner.textContent).toMatch(/carol/);
    });
  });

  it("hides the banner when the server sends GAME_RESUMED", async () => {
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={["/play/2026-04-22-moldharrow-keep"]}>
        <App />
      </MemoryRouter>,
    );

    await server.connected;
    await server.nextMessage; // consume SESSION_EVENT connect

    act(() => {
      server.send({
        type: "GAME_PAUSED",
        payload: { waiting_for: ["bob"] },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/paused/i)).toBeInTheDocument();
    });

    act(() => {
      server.send({ type: "GAME_RESUMED", payload: {} });
    });

    await waitFor(() => {
      expect(screen.queryByText(/paused/i)).toBeNull();
    });
  });
});
