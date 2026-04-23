// MP-03 event-sync wiring — end-to-end verification that AppInner is
// actually using usePeerEventCache + PeerEventStore, not just that the
// hook and store pass unit tests in isolation.
//
// What this proves:
//   1. On slug-route mount, AppInner sends SESSION_EVENT with
//      last_seen_seq=0 when the peer cache is empty.
//   2. After receiving seq-carrying NARRATION events, those events are
//      persisted to IndexedDB under `sq:<slug>:<playerId>`.
//   3. On a warm-start (localStorage hint present) AppInner sends
//      SESSION_EVENT with last_seen_seq=N synchronously.
//   4. Replay of a seq already in the in-memory narration list is not
//      duplicated in the store (idempotent put on the seq-keyed object
//      store; AppInner's seq-dedupe prevents re-append).
//   5. NamePrompt path still gates the connect when no display name is set.
//
// Per CLAUDE.md "Verify Wiring, Not Just Existence" — these assertions
// only hold if AppInner is wired to the cache in production code.

import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { WS } from "jest-websocket-mock";
import {
  installWebAudioMock,
  installLocalStorageMock,
} from "@/audio/__tests__/web-audio-mock";
import { AudioEngine } from "@/audio/AudioEngine";
import { PeerEventStore } from "@/lib/peerEventStore";
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

let slugCounter = 0;
function freshSlug(): string {
  slugCounter += 1;
  return `mp03-test-${Date.now()}-${slugCounter}`;
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

describe("MP-03 event sync — AppInner ↔ PeerEventStore wiring", () => {
  it("sends SESSION_EVENT with last_seen_seq=0 when peer cache is empty", async () => {
    const slug = freshSlug();
    const server = new WS(`ws://${location.host}/ws`, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={[`/play/${slug}`]}>
        <App />
      </MemoryRouter>,
    );

    await server.connected;
    const msg = (await server.nextMessage) as {
      type: string;
      payload: Record<string, unknown>;
    };
    expect(msg.type).toBe("SESSION_EVENT");
    expect(msg.payload.event).toBe("connect");
    expect(msg.payload.game_slug).toBe(slug);
    expect(msg.payload.last_seen_seq).toBe(0);
  });

  it("persists seq-carrying events to IndexedDB under the (slug, player) key", async () => {
    const slug = freshSlug();
    const server = new WS(`ws://${location.host}/ws`, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={[`/play/${slug}`]}>
        <App />
      </MemoryRouter>,
    );

    await server.connected;
    await server.nextMessage; // drain SESSION_EVENT connect

    act(() => {
      server.send({
        type: "NARRATION",
        payload: { seq: 1, text: "A hall yawns ahead." },
      });
      server.send({
        type: "NARRATION",
        payload: { seq: 2, text: "Torchlight flickers." },
      });
    });

    await waitFor(async () => {
      const store = await PeerEventStore.open(slug, "alice");
      const all = await store.readAll();
      expect(all.map((e) => e.seq)).toEqual([1, 2]);
    });
  });

  it("sends last_seen_seq=N synchronously on warm start via localStorage hint", async () => {
    const slug = freshSlug();
    // Seed the high-water mark hint the way AppInner's own appendEvent
    // would have on a prior session. PeerEventStore is authoritative for
    // durability; localStorage carries the synchronous read AppInner
    // needs at connect time before the async IDB open resolves.
    const seed = await PeerEventStore.open(slug, "alice");
    await seed.append({ seq: 7, kind: "NARRATION", payload: { text: "cached" } });
    localStorage.setItem(`sq:${slug}:alice:lastSeq`, "7");

    const server = new WS(`ws://${location.host}/ws`, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={[`/play/${slug}`]}>
        <App />
      </MemoryRouter>,
    );

    await server.connected;
    const msg = (await server.nextMessage) as {
      type: string;
      payload: Record<string, unknown>;
    };
    expect(msg.type).toBe("SESSION_EVENT");
    expect(msg.payload.last_seen_seq).toBe(7);
  });

  it("deduplicates replayed events by (type, seq) in the cache", async () => {
    const slug = freshSlug();
    const server = new WS(`ws://${location.host}/ws`, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={[`/play/${slug}`]}>
        <App />
      </MemoryRouter>,
    );

    await server.connected;
    await server.nextMessage; // drain SESSION_EVENT connect

    act(() => {
      server.send({
        type: "NARRATION",
        payload: { seq: 1, text: "once" },
      });
    });

    await waitFor(async () => {
      const store = await PeerEventStore.open(slug, "alice");
      const all = await store.readAll();
      expect(all.filter((e) => e.seq === 1)).toHaveLength(1);
    });

    // Simulate a replay overlap: server re-sends the same seq.
    act(() => {
      server.send({
        type: "NARRATION",
        payload: { seq: 1, text: "once" },
      });
    });

    // Give React + IDB a tick to process. AppInner's seq-dedupe short-
    // circuits the second append, and IDB's keyPath-based put is
    // idempotent; either way there should still be exactly one row.
    await new Promise((r) => setTimeout(r, 50));
    const store = await PeerEventStore.open(slug, "alice");
    const all = await store.readAll();
    expect(all.filter((e) => e.seq === 1)).toHaveLength(1);
  });

  it("does not fire WS connect without a display name (NamePrompt gate)", async () => {
    localStorage.removeItem("sq:display-name");
    const slug = freshSlug();
    const server = new WS(`ws://${location.host}/ws`, { jsonProtocol: true });

    render(
      <MemoryRouter initialEntries={[`/play/${slug}`]}>
        <App />
      </MemoryRouter>,
    );

    // NamePrompt is shown — no SESSION_EVENT fires until a name is entered.
    await screen.findByText(/what name shall be yours/i);
    expect(server.messages).toHaveLength(0);
  });
});
