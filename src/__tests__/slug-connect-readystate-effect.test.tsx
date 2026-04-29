// Story 45-25 — slug-connect SESSION_EVENT must dispatch from a
// readyState=OPEN effect, not from a 300ms setTimeout.
//
// Pre-fix code (App.tsx ~1240–1266):
//   connect();
//   setConnected(true);
//   setTimeout(() => sendRef.current?.({SESSION_EVENT...}), 300);
//
// The 300ms is an empirical guess that the WebSocket has reached OPEN.
// On flaky networks (slow Wi-Fi, hibernate-resume — exactly what Alex's
// home Wi-Fi looks like on a Sunday session) the timer can fire while the
// socket is still CONNECTING; the send no-ops and the session never
// registers with the server.
//
// Post-fix flow (per context-story-45-25.md):
//   1. Stash the SESSION_EVENT payload in a ref on the slug-connect path
//   2. A useEffect keyed on [readyState] dispatches the stashed payload
//      when readyState transitions to OPEN, then clears the ref
//
// The ref-clear is load-bearing: under React 18 StrictMode the OPEN-
// transition effect can run twice (cleanup + re-run). Without clearing
// the ref after dispatch, the payload would be re-sent on the second run
// → server sees two SESSION_EVENT{connect} messages and resolves the
// opening hook twice (the same bug the existing justConnectedRef guard
// at App.tsx:1321 was added to prevent in the re-handshake effect).
//
// Test surface:
//   1. Behavioral RED→GREEN — use real timers and await server.connected to
//      let the WS handshake complete naturally. Pre-fix: setTimeout(300)
//      fires after the handshake is already done, and SESSION_EVENT arrives
//      fine. Post-fix: effect-on-OPEN dispatches immediately when ready.
//      The distinction is timing-invisible without mocking, but the test
//      still validates the dispatch happens.
//   2. StrictMode no double-dispatch — regression guard for the ref-
//      clear correctness (SM Assessment risk).
//   3. Negative — spying on setTimeout to verify the 300ms timer doesn't
//      exist in the code at all.

import { StrictMode } from "react";
import { render } from "@testing-library/react";
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
  mode: "solo",
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

let slugCounter = 0;
function freshSlug(): string {
  slugCounter += 1;
  const slug = `slug-connect-${Date.now()}-${slugCounter}`;
  // Seed journey history so AppInner's slug-mode trust gate (silent-rebind
  // protection added 2026-04-26) recognizes the player as the creator of
  // this slug. Mirrors the helper in mp-03-event-sync-wiring.test.tsx.
  const existing = JSON.parse(
    localStorage.getItem("sidequest-history") ?? "[]",
  ) as Array<Record<string, unknown>>;
  existing.push({
    player_name: "alice",
    genre: "low_fantasy",
    world: "greyhawk",
    last_played_iso: new Date().toISOString(),
    game_slug: slug,
    mode: "solo",
  });
  localStorage.setItem("sidequest-history", JSON.stringify(existing));
  return slug;
}

beforeEach(() => {
  AudioEngine.resetInstance();
  installWebAudioMock();
  installLocalStorageMock();
  localStorage.setItem("sq:display-name", "alice");
  vi.stubGlobal("fetch", makeFetchMock());
});

afterEach(() => {
  WS.clean();
  AudioEngine.resetInstance();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute("data-archetype");
});

describe("45-25 — SESSION_EVENT dispatches via readyState=OPEN effect, not setTimeout", () => {
  it("sends SESSION_EVENT once the WS reaches OPEN", async () => {
    const slug = freshSlug();
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={[`/solo/${slug}`]}>
        <App />
      </MemoryRouter>,
    );

    // Wait for the WebSocket to connect. jest-websocket-mock will
    // complete the handshake and transition readyState to OPEN, which
    // triggers the effect that dispatches the SESSION_EVENT payload.
    await server.connected;

    const msg = (await server.nextMessage) as {
      type: string;
      payload: {
        event: string;
        game_slug: string;
        player_name: string;
        last_seen_seq: number;
      };
    };
    expect(msg.type).toBe("SESSION_EVENT");
    expect(msg.payload.event).toBe("connect");
    expect(msg.payload.game_slug).toBe(slug);
    expect(msg.payload.player_name).toBe("alice");
    expect(msg.payload.last_seen_seq).toBe(0);
  });

  it("dispatches SESSION_EVENT exactly once under StrictMode", async () => {
    const slug = freshSlug();
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <StrictMode>
        <MemoryRouter initialEntries={[`/solo/${slug}`]}>
          <App />
        </MemoryRouter>
      </StrictMode>,
    );

    await server.connected;

    const msg = (await server.nextMessage) as {
      type: string;
      payload: { event: string; game_slug: string };
    };
    expect(msg.type).toBe("SESSION_EVENT");
    expect(msg.payload.event).toBe("connect");
    expect(msg.payload.game_slug).toBe(slug);

    // Under React StrictMode, if the ref isn't cleared after dispatch,
    // the effect cleanup-rerun would fire SESSION_EVENT a second time.
    // Assert exactly one message arrived.
    expect(server.messages).toHaveLength(1);
  });

  it("does not register a setTimeout with delay=300 during slug-connect", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const slug = freshSlug();
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={[`/solo/${slug}`]}>
        <App />
      </MemoryRouter>,
    );

    // Let the slug-connect path fully execute.
    await server.connected;
    await server.nextMessage;

    // Pre-fix: App.tsx would have a setTimeout(..., 300) in the slug-connect
    // effect's success path. Post-fix: the dispatch is driven by the
    // readyState effect, no 300ms timer is registered.
    const threeHundredMsCalls = setTimeoutSpy.mock.calls.filter(
      ([, delay]) => delay === 300,
    );
    expect(threeHundredMsCalls).toHaveLength(0);

    setTimeoutSpy.mockRestore();
  });
});
