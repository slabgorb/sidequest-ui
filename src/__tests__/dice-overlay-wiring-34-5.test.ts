/**
 * Story 34-5: Production wiring tests for dice overlay.
 *
 * Verifies that DiceOverlay is actually integrated into the production
 * code path — not just implemented in isolation. Source-reading tests
 * check App.tsx and message dispatch, following the pattern established
 * in confrontation-wiring.test.tsx.
 *
 * RED phase — all tests FAIL until Dev wires the overlay into App.tsx.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.resolve(SRC_ROOT, relativePath), "utf-8");
}

// ═══��══════════════════════════════════════════════════════════════════════════
// Wiring: App.tsx lazy-loads DiceOverlay
// ══════════════════════════════��═══════════════════════════════════════════════

describe("Wiring: App.tsx lazy-loads DiceOverlay", () => {
  it("App.tsx imports DiceOverlay via React.lazy()", () => {
    const appSrc = readSrc("App.tsx");
    // Must use React.lazy() or lazy() for code splitting
    expect(appSrc).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(['"].*dice.*DiceOverlay['"]\)/i);
  });

  it("App.tsx wraps DiceOverlay in Suspense", () => {
    const appSrc = readSrc("App.tsx");
    // Suspense boundary must exist around the lazy-loaded component
    expect(appSrc).toMatch(/Suspense/);
    // And the lazy dice overlay variable must be rendered somewhere
    expect(appSrc).toMatch(/DiceOverlay|LazyDiceOverlay/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Wiring: DICE_REQUEST triggers overlay display
// ════════════════════════════════════════════════════���═════════════════════════

describe("Wiring: DICE_REQUEST message handling in App.tsx", () => {
  it("App.tsx handles MessageType.DICE_REQUEST in message dispatch", () => {
    const appSrc = readSrc("App.tsx");
    // Must dispatch on DICE_REQUEST to show the overlay
    expect(appSrc).toMatch(/DICE_REQUEST/);
  });

  it("App.tsx handles MessageType.DICE_RESULT in message dispatch", () => {
    const appSrc = readSrc("App.tsx");
    // Must dispatch on DICE_RESULT to show the resolved roll
    expect(appSrc).toMatch(/DICE_RESULT/);
  });

  it("App.tsx maintains dice request state", () => {
    const appSrc = readSrc("App.tsx");
    // Must have state for the active dice request
    expect(appSrc).toMatch(/useState.*dice|diceRequest/i);
  });

  it("App.tsx passes diceRequest and diceResult to DiceOverlay", () => {
    const appSrc = readSrc("App.tsx");
    // The rendered DiceOverlay must receive both props
    expect(appSrc).toMatch(/diceRequest=\{/);
    expect(appSrc).toMatch(/diceResult=\{/);
  });
});

// ════════════════════════════════════════════���═════════════════════════════════
// Wiring: DICE_THROW sends message to server
// ══════════════════════════════════════════════════════��═══════════════════════

describe("Wiring: DICE_THROW message sending", () => {
  it("App.tsx has a handleDiceThrow callback that sends DICE_THROW", () => {
    const appSrc = readSrc("App.tsx");
    // Must have a handler that sends the throw gesture to the server
    expect(appSrc).toMatch(/handleDiceThrow|onDiceThrow|onThrow/);
    expect(appSrc).toMatch(/DICE_THROW/);
  });

  it("App.tsx passes onThrow handler to DiceOverlay", () => {
    const appSrc = readSrc("App.tsx");
    // DiceOverlay must receive the throw callback
    expect(appSrc).toMatch(/onThrow=\{/);
  });

  it("handleDiceThrow sends message via WebSocket send()", () => {
    const appSrc = readSrc("App.tsx");
    // The handler must call send() with a DICE_THROW message
    expect(appSrc).toMatch(/type:\s*MessageType\.DICE_THROW/);
  });
});

// ════════════════════════════════════════��═════════════════════════════════════
// Wiring: Protocol types are registered
// ══════════════════════════════════════════════════════════════════════════════

describe("Wiring: Protocol types exist in type system", () => {
  // Accept both the legacy enum form (`KEY = "VAL"`) and the current
  // const-object form (`KEY: "VAL"`). protocol.ts was converted to a
  // const object with `erasableSyntaxOnly` on the tsconfig.
  it("MessageType in protocol.ts includes DICE_REQUEST", () => {
    const protocolSrc = readSrc("types/protocol.ts");
    expect(protocolSrc).toMatch(/DICE_REQUEST\s*[:=]\s*["']DICE_REQUEST["']/);
  });

  it("MessageType in protocol.ts includes DICE_THROW", () => {
    const protocolSrc = readSrc("types/protocol.ts");
    expect(protocolSrc).toMatch(/DICE_THROW\s*[:=]\s*["']DICE_THROW["']/);
  });

  it("MessageType in protocol.ts includes DICE_RESULT", () => {
    const protocolSrc = readSrc("types/protocol.ts");
    expect(protocolSrc).toMatch(/DICE_RESULT\s*[:=]\s*["']DICE_RESULT["']/);
  });

  it("payloads.ts exports DiceRequestPayload interface", () => {
    const payloadsSrc = readSrc("types/payloads.ts");
    expect(payloadsSrc).toMatch(/export\s+interface\s+DiceRequestPayload/);
  });

  it("payloads.ts exports DiceResultPayload interface", () => {
    const payloadsSrc = readSrc("types/payloads.ts");
    expect(payloadsSrc).toMatch(/export\s+interface\s+DiceResultPayload/);
  });

  it("payloads.ts exports DiceThrowPayload interface", () => {
    const payloadsSrc = readSrc("types/payloads.ts");
    expect(payloadsSrc).toMatch(/export\s+interface\s+DiceThrowPayload/);
  });

  it("TypedGameMessage union includes DiceRequestMessage", () => {
    const payloadsSrc = readSrc("types/payloads.ts");
    expect(payloadsSrc).toMatch(/DiceRequestMessage/);
  });

  it("TypedGameMessage union includes DiceResultMessage", () => {
    const payloadsSrc = readSrc("types/payloads.ts");
    expect(payloadsSrc).toMatch(/DiceResultMessage/);
  });
});

// ═══════════════════════���══════════════════════════════════════════════════════
// Wiring: DiceOverlay accepts production props interface
// ═══════════════════════════════════════════════════��══════════════════════════

describe("Wiring: DiceOverlay production props", () => {
  it("DiceOverlay accepts diceRequest prop (nullable)", () => {
    const overlaySrc = readSrc("dice/DiceOverlay.tsx");
    expect(overlaySrc).toMatch(/diceRequest/);
  });

  it("DiceOverlay accepts diceResult prop (nullable)", () => {
    const overlaySrc = readSrc("dice/DiceOverlay.tsx");
    expect(overlaySrc).toMatch(/diceResult/);
  });

  it("DiceOverlay accepts playerId prop", () => {
    const overlaySrc = readSrc("dice/DiceOverlay.tsx");
    expect(overlaySrc).toMatch(/playerId/);
  });

  it("DiceOverlay accepts onThrow callback prop", () => {
    const overlaySrc = readSrc("dice/DiceOverlay.tsx");
    expect(overlaySrc).toMatch(/onThrow/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Wiring: Player ID passed to overlay for role determination
// ══════════════════════════════════════════════════════════════════════════════

describe("Wiring: Player ID flows through for role determination", () => {
  it("App.tsx passes playerId to DiceOverlay", () => {
    const appSrc = readSrc("App.tsx");
    expect(appSrc).toMatch(/playerId=\{/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Wiring: Physics-is-the-roll (story 34-12)
// ──────────────────────────────────────────────────────────────────────────────
// These assertions exist because the original implementation stubbed
// handleSettle as a no-op, left readD20Value with no production consumer,
// and shipped a DiceThrowPayload wire format with no face field. The composed
// system couldn't carry a rolled face from physics back to the server, but
// every individual story's internal wiring check passed. These regression
// guards look at the composed end-to-end path.
// ══════════════════════════════════════════════════════════════════════════════

describe("Wiring: Physics-is-the-roll (story 34-12)", () => {
  it("DiceOverlay.handleSettle is NOT a no-op stub", () => {
    const overlaySrc = readSrc("dice/DiceOverlay.tsx");
    // handleSettle must actually do something with the settled face.
    // The stub form was a useCallback body of only `// Settle is now
    // driven by DiceResult from server, not local physics`.
    const idx = overlaySrc.indexOf("const handleSettle");
    expect(idx).toBeGreaterThanOrEqual(0);
    // Take the 1500-char window starting at handleSettle — enough to cover
    // the callback body and deps array without being so large it collides
    // with other callbacks defined below.
    const body = overlaySrc.slice(idx, idx + 1500);
    // Must call onThrow (the wire-sending callback) — the old stub did not.
    expect(body).toMatch(/onThrow\s*\(/);
    // Must accept the settled face as a parameter. Old stub was `()`.
    expect(body).toMatch(/handleSettle\s*=\s*useCallback\(\s*\(\s*\w+\s*:\s*number\s*\)/);
  });

  it("readD20Value has a production consumer via onSettle", () => {
    const sceneSrc = readSrc("dice/DiceScene.tsx");
    // The producer exists and flows into onSettle.
    expect(sceneSrc).toMatch(/readD20Value/);
    expect(sceneSrc).toMatch(/onSettle\s*\(\s*value\s*\)/);
  });

  it("DiceThrowPayload wire type includes a face field", () => {
    const payloadsSrc = readSrc("types/payloads.ts");
    // Locate the DiceThrowPayload interface body and require `face` in it.
    const iface = payloadsSrc.match(
      /export\s+interface\s+DiceThrowPayload\s*\{[\s\S]*?\}/,
    );
    expect(iface).not.toBeNull();
    expect(iface![0]).toMatch(/face\s*:\s*number\[\]/);
  });

  it("App.tsx.handleDiceThrow forwards face to the wire DICE_THROW message", () => {
    const appSrc = readSrc("App.tsx");
    // The handler signature must accept face and the sent payload must
    // include it.
    expect(appSrc).toMatch(/handleDiceThrow\s*=\s*useCallback\s*\(\s*\(\s*params[^,)]*,\s*face/);
    const handlerMatch = appSrc.match(
      /handleDiceThrow\s*=\s*useCallback\([\s\S]*?\],\s*\)/,
    );
    expect(handlerMatch).not.toBeNull();
    expect(handlerMatch![0]).toMatch(/face\s*,?\s*\}/);
  });

  it("DiceOverlay.onThrow callback signature accepts face", () => {
    const overlaySrc = readSrc("dice/DiceOverlay.tsx");
    // The props type must declare onThrow as taking both params and face.
    expect(overlaySrc).toMatch(
      /onThrow\s*:\s*\(\s*params\s*:[^,]+,\s*face\s*:\s*number\[\]\s*\)\s*=>\s*void/,
    );
  });
});
