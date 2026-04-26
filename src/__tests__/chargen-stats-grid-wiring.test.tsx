/**
 * Wiring test (per CLAUDE.md "Every Test Suite Needs a Wiring Test"):
 * proves the new stats grid renders when a `CHARACTER_CREATION` confirmation
 * scene arrives through the *real* WebSocket → App → CharacterCreation
 * pipeline, not just when the component is rendered in isolation.
 *
 * Modeled on `lobby-start-ws-open.test.tsx` (the current canonical pattern
 * for App + WebSocket integration tests, using `jest-websocket-mock`).
 *
 * Bug provenance: playtest 2026-04-26 Mawdeep MP — Alex/Sebastien-axis
 * scannability finding. See `/Users/slabgorb/Projects/sq-playtest-pingpong.md`
 * `[UX] Stats line on the chargen sheet is dense horizontal text`.
 */
import { StrictMode } from "react";
import { render, screen, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { WS } from "jest-websocket-mock";
import {
  installWebAudioMock,
  installLocalStorageMock,
} from "@/audio/__tests__/web-audio-mock";
import { AudioEngine } from "@/audio/AudioEngine";
import App from "../App";

const LOBBY_STORAGE_KEY = "sidequest-connect";

const GENRES_RESPONSE = {
  low_fantasy: {
    name: "Low Fantasy",
    description: "Gritty medieval adventures.",
    worlds: [
      {
        slug: "greyhawk",
        name: "Greyhawk",
        description: "The Flanaess.",
        era: null,
        setting: null,
        inspirations: [],
        axis_snapshot: {},
        hero_image: null,
      },
    ],
  },
};

const SLUG = "2026-04-26-stats-grid-wiring";
const GAME_META = {
  genre_slug: "low_fantasy",
  world_slug: "greyhawk",
  mode: "solo",
};

function makeFetchMock() {
  return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (
      typeof url === "string" &&
      /\/api\/games\/[^?]+/.test(url) &&
      (!opts || opts.method !== "POST")
    ) {
      return Promise.resolve(
        new Response(JSON.stringify(GAME_META), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (typeof url === "string" && url === "/api/games" && opts?.method === "POST") {
      return Promise.resolve(
        new Response(JSON.stringify({ slug: SLUG, mode: "solo" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (typeof url === "string" && url.startsWith("/api/sessions")) {
      return Promise.resolve(
        new Response(JSON.stringify({ sessions: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    if (typeof url === "string" && url.includes("/api/genres")) {
      return Promise.resolve(
        new Response(JSON.stringify(GENRES_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
  });
}

beforeEach(() => {
  AudioEngine.resetInstance();
  installWebAudioMock();
  installLocalStorageMock();
  vi.stubGlobal("fetch", makeFetchMock());
});

afterEach(() => {
  WS.clean();
  AudioEngine.resetInstance();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute("data-archetype");
});

describe("chargen stats-grid wiring (App → WS → CharacterCreation confirmation)", () => {
  it("renders the stats grid when a CHARACTER_CREATION confirmation arrives over the live socket", async () => {
    // Pre-seed the lobby so the Start button is one-click reachable.
    localStorage.setItem(
      LOBBY_STORAGE_KEY,
      JSON.stringify({
        playerName: "Ralph",
        genre: "low_fantasy",
        world: "greyhawk",
      }),
    );
    localStorage.setItem("sq:display-name", "Ralph");

    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    const user = userEvent.setup();

    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      </StrictMode>,
    );

    const startBtn = await screen.findByTestId("lobby-start-button");
    await user.click(startBtn);

    // Wait for AppInner to send SESSION_EVENT{connect, game_slug:...}.
    await server.connected;
    const connectMsg = (await server.nextMessage) as {
      type: string;
      payload: Record<string, unknown>;
    };
    expect(connectMsg.type).toBe("SESSION_EVENT");
    expect(connectMsg.payload.event).toBe("connect");

    // Server tells client this is a brand-new player so chargen mounts.
    act(() => {
      server.send({
        type: "SESSION_EVENT",
        payload: {
          event: "connected",
          player_name: "Ralph",
          has_character: false,
        },
      });
    });

    // Drive the chargen confirmation scene directly. The unit suite
    // (`CharacterCreation.stats-grid.test.tsx`) covers intermediate steps;
    // this test's job is to prove the *wiring*: that a real
    // CHARACTER_CREATION{phase:"confirmation"} frame routes through
    // App → CharacterCreation and produces the grid in the live DOM.
    act(() => {
      server.send({
        type: "CHARACTER_CREATION",
        payload: {
          phase: "confirmation",
          scene_index: 3,
          total_scenes: 4,
          input_type: "confirm",
          message: "Confirm your character?",
          character_preview: {
            Name: "Ralph",
            Race: "Beastkin",
            Class: "Delver",
            // Verbatim shape from chargen_summary.py ~line 193.
            Stats: "STR 10  DEX 7  CON 12  INT 17  WIS 5  CHA 11",
          },
        },
      });
    });

    // Wiring assertion: the grid is reachable from the live App tree.
    const grid = await screen.findByTestId("review-stats-grid");
    expect(grid).toBeInTheDocument();
    expect(grid.className).toContain("grid-cols-3");

    // All six stat cells present with the right testids.
    const cellTestIds = [
      "review-stat-STR",
      "review-stat-DEX",
      "review-stat-CON",
      "review-stat-INT",
      "review-stat-WIS",
      "review-stat-CHA",
    ];
    for (const tid of cellTestIds) {
      expect(within(grid).getByTestId(tid)).toBeInTheDocument();
    }

    // Each cell exposes label + value as a definition-list pair so the
    // contract is screen-reader-meaningful, not just visually grouped.
    expect(within(grid).getAllByRole("term").map((n) => n.textContent)).toEqual(
      ["STR", "DEX", "CON", "INT", "WIS", "CHA"],
    );
    expect(
      within(grid).getAllByRole("definition").map((n) => n.textContent),
    ).toEqual(["10", "7", "12", "17", "5", "11"]);

    // The dense one-liner that motivated the bug must NOT be on screen.
    expect(
      screen.queryByText(/STR 10\s+DEX 7\s+CON 12\s+INT 17\s+WIS 5\s+CHA 11/),
    ).not.toBeInTheDocument();
  });
});
