/**
 * Story 27-9: Verify ADR-076 narration protocol collapse.
 *
 * RED phase tests asserting that the dead TTS-era narration plumbing has
 * been removed from the UI. These tests currently FAIL — Bicycle Repair Man
 * makes them pass in the GREEN phase by deleting:
 *
 *   1. The `NarrationChunkPayload` interface from `src/types/payloads.ts`
 *   2. The `buf.chunks` and `buf.watchdogTimer` fields from the narration
 *      buffer in `src/App.tsx`
 *   3. The `handleBinaryMessage` callback entirely from `src/App.tsx`
 *   4. Any lingering `NarrationChunk*` references in production code
 *
 * Pattern match: `combat-overlay-deletion-28-9.test.ts` (Epic 28 cleanup).
 * Both are deletion-driven TDD: the test asserts "X should NOT exist"
 * while X still exists, fails, then Dev removes X and the test passes.
 *
 * Out-of-scope for this story (do NOT add tests for these):
 *   - `useAudio`, `audio.engine.playVoicePCM`, `audio.engine.playVoice`
 *     (may have other callers via SFX/music — separate ADR if orphaned)
 *   - Genre pack voice mixer config (`voice_volume`, voice channel)
 *   - `isVoiceAudioFrame` / `decodeVoiceFrame` imports (audited by Dev;
 *     may be kept if non-binary-message consumers exist)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.resolve(__dirname, "..");
const APP_TSX = path.join(SRC_DIR, "App.tsx");
const PAYLOADS_TS = path.join(SRC_DIR, "types", "payloads.ts");

// ==========================================================================
// ADR-076 §Protocol Layer — NarrationChunkPayload removed from payloads.ts
// ==========================================================================

describe("Story 27-9: ADR-076 narration protocol collapse", () => {
  it("payloads.ts does not define NarrationChunkPayload interface", () => {
    const source = fs.readFileSync(PAYLOADS_TS, "utf-8");
    expect(
      source,
      "ADR-076 §Protocol Layer: `NarrationChunkPayload` interface must be " +
        "removed from src/types/payloads.ts — it is a dead type from the " +
        "deleted TTS streaming protocol.",
    ).not.toContain("NarrationChunkPayload");
  });

  it("payloads.ts does not define NarrationChunkMessage union member", () => {
    const source = fs.readFileSync(PAYLOADS_TS, "utf-8");
    expect(
      source,
      "ADR-076: `NarrationChunkMessage` must not appear in src/types/payloads.ts.",
    ).not.toContain("NarrationChunkMessage");
  });

  // ========================================================================
  // ADR-076 §UI Narration Buffer Cleanup — App.tsx buffer fields and handler
  // ========================================================================

  it("App.tsx narration buffer does not carry buf.chunks field", () => {
    const source = fs.readFileSync(APP_TSX, "utf-8");
    expect(
      source,
      "ADR-076 §UI Narration Buffer Cleanup (#1): the `chunks: GameMessage[]` " +
        "field of narrationBufferRef must be removed. It was filled in zero " +
        "places and drained in two — pure dead code from the TTS text/audio " +
        "sync that no longer happens.",
    ).not.toMatch(/buf\.chunks/);
  });

  it("App.tsx narration buffer does not carry watchdogTimer field", () => {
    const source = fs.readFileSync(APP_TSX, "utf-8");
    expect(
      source,
      "ADR-076 §UI Narration Buffer Cleanup (#2): the `watchdogTimer` field " +
        "of narrationBufferRef must be removed. It was armed only inside the " +
        "dead `handleBinaryMessage` path.",
    ).not.toContain("watchdogTimer");
  });

  it("App.tsx does not define handleBinaryMessage callback", () => {
    const source = fs.readFileSync(APP_TSX, "utf-8");
    expect(
      source,
      "ADR-076 §UI Narration Buffer Cleanup (#3): the `handleBinaryMessage` " +
        "useCallback must be deleted entirely and unregistered from the " +
        "WebSocket binary-handler hook. It listens for PCM voice frames " +
        "that the server cannot send.",
    ).not.toContain("handleBinaryMessage");
  });

  it("App.tsx does not reference NarrationChunk variant", () => {
    const source = fs.readFileSync(APP_TSX, "utf-8");
    expect(
      source,
      "ADR-076: App.tsx must not reference the removed `NarrationChunk` variant.",
    ).not.toContain("NarrationChunk");
  });

  // ========================================================================
  // ADR-076 Acceptance Gate — wiring check across production source
  // ==========================================================================

  it("no production file references NarrationChunk", () => {
    const productionFiles = findTsFiles(SRC_DIR).filter(
      (f) => !f.includes("__tests__") && !f.includes(".test."),
    );

    const violations: string[] = [];
    for (const file of productionFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("NarrationChunk")) {
        const relPath = path.relative(SRC_DIR, file);
        violations.push(relPath);
      }
    }

    expect(
      violations,
      "ADR-076 wiring check (ui): production files still reference " +
        `NarrationChunk: ${violations.join(", ")}`,
    ).toEqual([]);
  });

  it("no production file references handleBinaryMessage", () => {
    const productionFiles = findTsFiles(SRC_DIR).filter(
      (f) => !f.includes("__tests__") && !f.includes(".test."),
    );

    const violations: string[] = [];
    for (const file of productionFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("handleBinaryMessage")) {
        const relPath = path.relative(SRC_DIR, file);
        violations.push(relPath);
      }
    }

    expect(
      violations,
      "ADR-076 wiring check (ui): production files still reference " +
        `handleBinaryMessage: ${violations.join(", ")}`,
    ).toEqual([]);
  });
});

/** Recursively find .ts/.tsx files under a directory. */
function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}
