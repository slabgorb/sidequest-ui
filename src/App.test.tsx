import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  installWebAudioMock,
  installLocalStorageMock,
} from "@/audio/__tests__/web-audio-mock";
import { AudioEngine } from "@/audio/AudioEngine";

import App from "./App";

function renderApp() {
  return render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
}

beforeEach(() => {
  AudioEngine.resetInstance();
  installWebAudioMock();
  installLocalStorageMock();
});

afterEach(() => {
  AudioEngine.resetInstance();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders without crashing", () => {
    renderApp();
    // App should produce *something* in the DOM.
    expect(document.body.querySelector("#root, [data-testid='app']") ?? document.body.firstElementChild).toBeTruthy();
  });

  it("shows ConnectScreen when not connected", () => {
    renderApp();
    // ConnectScreen should be visible by default (not connected yet).
    expect(screen.getByLabelText(/player name/i)).toBeInTheDocument();
  });

  it("has a main content area", () => {
    renderApp();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// WebSocket OPEN-transition wiring tests — playtest 2026-04-11 regression guard
//
// Context: InputBar was reported stuck in [disabled] state after an API-server
// restart + page reload. Root cause: the reconnect cleanup effect was a single
// useEffect gated on `readyState === OPEN && wasDisconnected && connected`. On
// page reload, `connected` is false when the WebSocket first transitions to
// OPEN, so the cleanup never fired — stale canType/thinking state could stick.
//
// The fix splits the effect into two:
//   (1) a defensive state reset that fires on ANY OPEN transition (no gate)
//   (2) a handshake re-send that keeps the `connected` gate (only real reconnects)
//
// These grep-style source tests pin the structural shape of the fix so a
// future refactor can't silently re-introduce the guard bug. Follows the same
// source-level wiring convention used in confrontation-wiring.test.tsx.
// ══════════════════════════════════════════════════════════════════════════════

describe("Wiring: App.tsx WebSocket OPEN-transition cleanup (playtest 2026-04-11)", () => {
  const readAppSrc = async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    return fs.readFileSync(path.resolve(__dirname, "./App.tsx"), "utf-8");
  };

  it("has a defensive cleanup effect that clears thinking on OPEN without a connected gate", async () => {
    const src = await readAppSrc();
    // Effect (1): must set setThinking(false) inside the OPEN-transition block.
    // Does NOT set canType — server "ready"/"waiting" event is authoritative
    // (playtest 2026-04-12 barrier reconnect fix). Must NOT reference `connected`.
    const defensiveBlock = src.match(
      /if\s*\(\s*readyState\s*===\s*WebSocket\.OPEN\s*&&\s*prevReadyState\.current\s*!==\s*WebSocket\.OPEN\s*\)\s*\{[\s\S]*?\}/,
    );
    expect(
      defensiveBlock,
      "App.tsx must contain a defensive OPEN-transition cleanup block that clears thinking without a `connected` gate.",
    ).not.toBeNull();
    const body = defensiveBlock![0];
    expect(body).toContain("setThinking(false)");
    expect(
      body.includes("setCanType(true)"),
      "Defensive cleanup must NOT set canType — server barrier state is authoritative on reconnect (playtest 2026-04-12).",
    ).toBe(false);
    expect(
      body.includes("connected"),
      "Defensive cleanup block must NOT reference `connected` — that guard is the exact bug we're fixing.",
    ).toBe(false);
  });

  it("keeps the reconnect handshake gated on `connected && wasDisconnected`", async () => {
    const src = await readAppSrc();
    // Effect (2): must still guard the re-handshake on `connected` so the
    // first-mount path (which has its own handshake via handleConnect) doesn't
    // double-fire.
    expect(src).toMatch(
      /readyState\s*===\s*WebSocket\.OPEN\s*&&\s*wasDisconnected\s*&&\s*connected/,
    );
  });

  it("only sends SESSION_EVENT connect handshake when we have a saved session", async () => {
    const src = await readAppSrc();
    // The re-handshake effect must loadSession() and guard on its result,
    // otherwise we'd send connect payloads with empty fields on fresh visits.
    expect(src).toMatch(/const\s+saved\s*=\s*loadSession\(\)[\s\S]*?if\s*\(\s*saved\s*\)/);
  });

  it("re-handshake sends game_slug, not the legacy genre+world+player_name shape", async () => {
    const src = await readAppSrc();
    // Effect (2) must send game_slug in the SESSION_EVENT payload, not the
    // legacy genre+world+player_name shape (MP-01 Task 4 slug migration).
    expect(src).toContain("game_slug: saved.gameSlug");
    expect(src).not.toMatch(/genre:\s*saved\.(genre|world)/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Slug-based auto-reconnect wiring tests — MP-01 follow-up migration
//
// Context: scene-harness and auto-reconnect were the last callers of the
// legacy handleConnect(name, genre, world) path. Both are now migrated to
// navigate to /solo/:slug instead, matching the GameScreen slug-based flow.
// These source-level tests pin the structural shape of the migration so a
// future refactor can't silently re-introduce the legacy path.
// ══════════════════════════════════════════════════════════════════════════════

describe("Wiring: App.tsx slug-based auto-reconnect and scene-harness (MP-01 follow-up)", () => {
  const readAppSrc = async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    return fs.readFileSync(path.resolve(__dirname, "./App.tsx"), "utf-8");
  };

  it("auto-reconnect navigates to /solo/:slug using the saved gameSlug", async () => {
    const src = await readAppSrc();
    // The auto-reconnect effect must call navigate(`/solo/${saved.gameSlug}`)
    // and must NOT call handleConnect with the legacy playerName+genre+world.
    expect(src).toMatch(/navigate\(\s*`\/solo\/\$\{saved\.gameSlug\}`\s*\)/);
  });

  it("auto-reconnect has no fallback to legacy genre+world+player_name", async () => {
    const src = await readAppSrc();
    // The auto-reconnect block must not contain saved.genre, saved.world, or
    // saved.playerName — those fields were the legacy connect shape (pre-MP-01).
    // Extract the auto-reconnect effect body (between the two autoReconnect comments).
    const autoReconnectBlock = src.match(
      /\/\/ Auto-reconnect[\s\S]*?autoReconnectAttempted\.current\s*=\s*true[\s\S]*?navigate[\s\S]*?\}\s*,\s*\[navigate\]\s*\)/,
    );
    expect(
      autoReconnectBlock,
      "Could not find the auto-reconnect effect block in App.tsx",
    ).not.toBeNull();
    const body = autoReconnectBlock![0];
    expect(body, "auto-reconnect must not reference saved.genre").not.toContain("saved.genre");
    expect(body, "auto-reconnect must not reference saved.world").not.toContain("saved.world");
    expect(body, "auto-reconnect must not reference saved.playerName").not.toContain("saved.playerName");
  });

  it("scene-harness navigates to /solo/:slug from the server response", async () => {
    const src = await readAppSrc();
    // Scene harness must: (a) expect { slug } back from /dev/scene/:name,
    // and (b) navigate to /solo/:slug — not call handleConnect with legacy fields.
    expect(src).toMatch(/r\.json\(\)\s*as\s*Promise<\s*\{\s*slug:\s*string\s*\}/);
    expect(src).toMatch(/navigate\(\s*`\/solo\/\$\{slug\}`\s*\)/);
  });

  it("scene-harness has no fallback to legacy player_name+genre+world shape", async () => {
    const src = await readAppSrc();
    // The scene harness block must not destructure or reference player_name,
    // genre, or world from the /dev/scene response.
    const harnessBlock = src.match(
      /\/\/ Scene harness[\s\S]*?sceneHarnessAttempted\.current\s*=\s*true[\s\S]*?navigate[\s\S]*?\}\s*,\s*\[navigate\]\s*\)/,
    );
    expect(
      harnessBlock,
      "Could not find the scene-harness effect block in App.tsx",
    ).not.toBeNull();
    const body = harnessBlock![0];
    expect(body, "scene-harness must not reference player_name").not.toContain("player_name");
    expect(body, "scene-harness must not reference genre in response").not.toMatch(/then\s*\(\s*\{[\s\S]*?genre[\s\S]*?\}\s*\)/);
  });

  it("SavedSession uses gameSlug, not the legacy playerName+genre+world fields", async () => {
    const src = await readAppSrc();
    // SavedSession interface must have gameSlug field, not playerName/genre/world.
    expect(src).toMatch(/interface\s+SavedSession\s*\{[\s\S]*?gameSlug:\s*string[\s\S]*?\}/);
    const sessionInterface = src.match(/interface\s+SavedSession\s*\{[\s\S]*?\}/);
    expect(
      sessionInterface,
      "Could not find SavedSession interface in App.tsx",
    ).not.toBeNull();
    const body = sessionInterface![0];
    expect(body, "SavedSession must not have playerName field").not.toContain("playerName");
    expect(body, "SavedSession must not have genre field").not.toContain("genre:");
    expect(body, "SavedSession must not have world field").not.toContain("world:");
  });
});
