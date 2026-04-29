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
//   1. Behavioral RED→GREEN — under fake timers, advance only enough for
//      the WS handshake (well under 300ms) and assert SESSION_EVENT
//      arrived. Pre-fix: setTimeout(300) hasn't fired → no message →
//      fails. Post-fix: effect-on-OPEN dispatches → message present →
//      passes.
//   2. StrictMode no double-dispatch — regression guard for the ref-
//      clear correctness (SM Assessment risk).
//   3. Negative — readyState never reaches OPEN — uses a controlled
//      MockWebSocket stub stuck in CONNECTING, advances 5s of fake time,
//      asserts the underlying socket's send() was never called. Pre-fix:
//      setTimeout(300) fires inside the 5s window, calls sendRef →
//      send() invoked → fails. Post-fix: effect never fires (no OPEN
//      transition) → send() never invoked → passes.
//   4. Static — App.tsx contains no `setTimeout(..., 300)` literal in
//      the slug-connect path. Belt-and-suspenders against re-introduction.

import { readFileSync } from "fs";
import { resolve as resolvePath } from "path";
import { StrictMode } from "react";
import { render, act } from "@testing-library/react";
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
  vi.useRealTimers();
  localStorage.clear();
  document.documentElement.removeAttribute("data-archetype");
});

// ---------------------------------------------------------------------------
// Test 1 — Behavioral RED→GREEN
//
// The cleanest RED→GREEN distinction is timing: pre-fix the dispatch is
// scheduled by setTimeout(300); post-fix it's driven by a React effect on
// readyState=OPEN. Under fake timers, advancing only enough wall-time to
// let the mock-socket handshake complete (handshake uses setTimeout(0))
// fires the OPEN transition but NOT the 300ms timer. So:
//   - Pre-fix: setTimeout(300) is still pending → server.messages is empty
//   - Post-fix: effect fires on OPEN transition → server.messages has the
//     SESSION_EVENT
// ---------------------------------------------------------------------------

describe("45-25 — SESSION_EVENT dispatches via readyState=OPEN effect, not setTimeout", () => {
  it("sends SESSION_EVENT once the WS reaches OPEN, without firing a 300ms timer", async () => {
    vi.useFakeTimers();
    const slug = freshSlug();
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={[`/solo/${slug}`]}>
        <App />
      </MemoryRouter>,
    );

    // Advance only enough wall time to let:
    //   - the fetch promise resolve (microtasks)
    //   - mock-socket's setTimeout(0) handshake fire
    //   - useWebSocket's onopen / setReadyState re-render
    //   - the [readyState] effect run
    // The pre-fix 300ms setTimeout is well outside this window.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    // Post-fix: SESSION_EVENT was dispatched from the OPEN-transition
    // effect (no 300ms wait). Pre-fix: setTimeout(300) is still pending
    // and server.messages is empty.
    expect(server.messages).toHaveLength(1);
    const msg = server.messages[0] as {
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

  // ---------------------------------------------------------------------------
  // Test 2 — StrictMode regression guard (SM-flagged risk)
  //
  // The SM Assessment called out that the post-fix ref-stash pattern under
  // React 18 StrictMode could double-dispatch if the ref is not cleared
  // after the first send. The OPEN-transition useEffect runs once → its
  // cleanup runs → it runs again on remount; if the second run still sees
  // a non-null pendingPayloadRef, it fires SESSION_EVENT a second time.
  //
  // Pre-fix this test passes (the setTimeout fires once after 300ms, refs
  // and StrictMode notwithstanding). Post-fix it pins down the ref-clear
  // contract — Dev MUST clear the ref on first dispatch.
  // ---------------------------------------------------------------------------

  it("dispatches SESSION_EVENT exactly once under StrictMode (no double-fire from effect cleanup-rerun)", async () => {
    vi.useFakeTimers();
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

    // Advance well past handshake time and well past the old 300ms threshold
    // so any double-fire (from setTimeout, from effect cleanup-rerun, or
    // from the re-handshake-on-reconnect effect at App.tsx:1313–1338) has
    // had ample opportunity to occur. justConnectedRef.current at :1321
    // suppresses the re-handshake duplicate; this test guards against the
    // *new* duplicate hazard introduced by the post-fix ref pattern.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(server.messages).toHaveLength(1);
    const msg = server.messages[0] as {
      type: string;
      payload: { event: string; game_slug: string };
    };
    expect(msg.type).toBe("SESSION_EVENT");
    expect(msg.payload.event).toBe("connect");
    expect(msg.payload.game_slug).toBe(slug);
  });
});

// ---------------------------------------------------------------------------
// Test 3 — No 300ms setTimeout registered during slug-connect (AC-4)
//
// Why a setTimeout-spy and not a stuck-CONNECTING behavioral test:
//
// The story spec literally says "with a WS that stays in CONNECTING,
// advance fake timers by 5000ms and assert no SESSION_EVENT was sent."
// I started there. But under the current useGameSocket implementation
// (sidequest-ui/src/hooks/useWebSocket.ts:204–209), `send()` guards on
// `ws.readyState === WebSocket.OPEN` and silently drops if not OPEN.
// That means pre-fix and post-fix both produce "no socket-level send
// call" when the socket stays in CONNECTING — the 300ms timer fires
// pre-fix, but its dispatch is eaten by the readyState guard and never
// reaches a place we can observe from outside the hook. That makes the
// spec'd "advance 5000ms, assert no message" test tautological — it
// passes for the wrong reason pre-fix.
//
// The directly observable invariant for AC-4 ("No setTimeout fallback")
// is: during the slug-connect path, no setTimeout is registered with
// delay=300. Spying on globalThis.setTimeout catches it cleanly, and is
// strict RED→GREEN:
//   - Pre-fix: App.tsx:1249 schedules `setTimeout(..., 300)` → spy
//     records a call with delay=300 → assertion fails.
//   - Post-fix: dispatch is effect-driven; no 300ms timer registered
//     anywhere on the slug-connect path → spy records zero such calls →
//     assertion passes.
//
// The only legitimate ms-delay timer in App.tsx is the 3000ms offline
// detection at App.tsx:862 (out of scope per context-story-45-25.md);
// useWebSocket's reconnect timer uses 1000ms+ exponential backoff and
// only fires on close events (not in the happy-path slug-connect
// covered here). So the filter `delay === 300` is unambiguous.
// ---------------------------------------------------------------------------

describe("45-25 — slug-connect path registers no 300ms setTimeout (AC-4)", () => {
  it("does not register a setTimeout with delay=300 during slug-connect", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const slug = freshSlug();
    const wsUrl = `ws://${location.host}/ws`;
    const server = new WS(wsUrl, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={[`/solo/${slug}`]}>
        <App />
      </MemoryRouter>,
    );

    // Advance enough wall-time to fully exercise the slug-connect path:
    // fetch resolution, connect(), mock-socket handshake, OPEN
    // transition, and any post-OPEN effect runs. 5000ms is well past the
    // pre-fix 300ms threshold and lets the offline-detection 3000ms
    // timer also register (which is fine — we filter by delay).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Pre-fix: App.tsx:1249's `setTimeout(() => sendRef..., 300)` shows
    // up here. Post-fix: the slug-connect dispatch is effect-driven; no
    // 300ms timer is registered.
    const threeHundredMsCalls = setTimeoutSpy.mock.calls.filter(
      ([, delay]) => delay === 300,
    );
    expect(threeHundredMsCalls).toHaveLength(0);

    // Sanity check that the test fixture exercised the path it claims to:
    // server.connected resolves only after the WebSocket reaches OPEN. If
    // this assertion fails, the test isn't observing what it thinks it's
    // observing (e.g., the slug-connect effect short-circuited on the
    // trust gate or fetch fixture).
    await server.connected;

    setTimeoutSpy.mockRestore();
    // server is also tied to this test; the afterEach WS.clean covers it.
    expect(server).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Static source-level invariant
//
// Cheap, fast, and unambiguous: App.tsx must not contain a literal
// `setTimeout(..., 300)` anywhere. The only intentional ms-delay timers
// in App.tsx today (per context-story-45-25.md) are:
//   - App.tsx:862 — setTimeout(() => setOffline(true), 3000) — unrelated
//     offline detection, 3000ms (out of scope per spec)
//   - App.tsx:1249 — setTimeout(() => sendRef..., 300) — THE smell, must
//     be removed
//
// A grep for `300` in a setTimeout signature catches any re-introduction.
// ---------------------------------------------------------------------------

describe("45-25 — App.tsx static invariant", () => {
  it("contains no setTimeout(..., 300) literal anywhere in the file", () => {
    const appPath = resolvePath(__dirname, "..", "App.tsx");
    const src = readFileSync(appPath, "utf-8");
    // The smelly call spans multiple lines (App.tsx:1249–1266 today),
    // so a single-line regex won't match. Use the `s` (dotall) flag so
    // `.` matches newlines, and use non-greedy `.*?` so we stop at the
    // first `, 300)` boundary rather than swallowing the whole file.
    //
    // The 3000ms offline timer at App.tsx:862 (`, 3000)`) does not match
    // because `, 300)` requires the `)` immediately after `300`, not a
    // `0)`. (Tested manually: `, 3000)` -> '0)' -> no match.)
    //
    // The line-comment string "300ms" at App.tsx:1247 is not a
    // setTimeout call so the pattern (`setTimeout\(`...`, 300)`) skips
    // it.
    const matches = src.match(/setTimeout\(.*?,\s*300\s*\)/s);
    expect(matches).toBeNull();
  });
});
