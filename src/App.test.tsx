import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  installWebAudioMock,
  installLocalStorageMock,
} from "@/audio/__tests__/web-audio-mock";
import { AudioEngine } from "@/audio/AudioEngine";

import App from "./App";

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
    render(<App />);
    // App should produce *something* in the DOM.
    expect(document.body.querySelector("#root, [data-testid='app']") ?? document.body.firstElementChild).toBeTruthy();
  });

  it("shows ConnectScreen when not connected", () => {
    render(<App />);
    // ConnectScreen should be visible by default (not connected yet).
    expect(screen.getByLabelText(/player name/i)).toBeInTheDocument();
  });

  it("has a main content area", () => {
    render(<App />);
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
});
