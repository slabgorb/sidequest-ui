import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Wiring test: slash-command messages reach the server send pipeline ────────
//
// The bug (Task 26 code review): handleSend in App.tsx intercepted slash
// commands, appended their messages to local state, but never called send().
// The result: /yield appended a YIELD entry to the narrative log client-side
// but transmitted nothing to the server — _handle_yield never fired.
//
// This test reads App.tsx source to assert that the fix is present and wired:
// send(msg) must appear inside the slashResult.messages.length > 0 block,
// not just setMessages.
// ─────────────────────────────────────────────────────────────────────────────

const appSrc = fs.readFileSync(
  path.resolve(__dirname, "../App.tsx"),
  "utf-8",
);

describe("Wiring: slash-command messages forwarded to server via send()", () => {
  it("App.tsx calls send(msg) for each slash-command message", () => {
    // The fix block must contain both setMessages and send(msg) inside the
    // slashResult.messages.length > 0 branch. We verify by asserting the
    // for-loop pattern is present immediately after setMessages.
    expect(appSrc).toMatch(
      /slashResult\.messages\.length > 0[\s\S]*?send\(msg\)/,
    );
  });

  it("App.tsx iterates slashResult.messages and calls send for each", () => {
    // The for-loop construct must be present: `for (const msg of slashResult.messages)`
    expect(appSrc).toMatch(/for\s*\(\s*const\s+msg\s+of\s+slashResult\.messages\s*\)/);
  });

  it("send(msg) appears in the slashResult.handled branch (not only the PLAYER_ACTION path)", () => {
    // Capture everything from `if (slashResult.handled)` to its closing `return;`
    // and assert send(msg) appears inside it.
    const handledBranch = appSrc.match(
      /if\s*\(slashResult\.handled\)\s*\{([\s\S]*?)\n\s+return;/,
    );
    expect(handledBranch).not.toBeNull();
    expect(handledBranch?.[1]).toMatch(/send\(msg\)/);
  });

  it("the slash-command send path does NOT call setCanType or setThinking", () => {
    // Per spec: slash commands must not seal the input bar or show a thinking
    // indicator — that lifecycle only applies to PLAYER_ACTION narration turns.
    const handledBranch = appSrc.match(
      /if\s*\(slashResult\.handled\)\s*\{([\s\S]*?)\n\s+return;/,
    );
    expect(handledBranch).not.toBeNull();
    expect(handledBranch?.[1]).not.toMatch(/setCanType/);
    expect(handledBranch?.[1]).not.toMatch(/setThinking/);
  });
});
