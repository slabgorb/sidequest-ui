/**
 * Story 28-9: Verify CombatOverlay deletion.
 *
 * RED phase tests asserting that the old CombatOverlay component has been
 * removed and ConfrontationOverlay is the sole encounter UI. These tests
 * currently FAIL because CombatOverlay.tsx still exists.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.resolve(__dirname, "..");
const COMPONENTS_DIR = path.join(SRC_DIR, "components");

// ==========================================================================
// AC-5: CombatOverlay/ChaseOverlay deleted, ConfrontationOverlay is sole UI
// ==========================================================================

describe("Story 28-9: CombatOverlay deletion", () => {
  it("CombatOverlay.tsx should not exist", () => {
    const combatOverlayPath = path.join(COMPONENTS_DIR, "CombatOverlay.tsx");
    expect(
      fs.existsSync(combatOverlayPath),
      "CombatOverlay.tsx must be deleted — ConfrontationOverlay is the sole encounter UI (28-9)",
    ).toBe(false);
  });

  it("ChaseOverlay.tsx should not exist", () => {
    const chaseOverlayPath = path.join(COMPONENTS_DIR, "ChaseOverlay.tsx");
    expect(
      fs.existsSync(chaseOverlayPath),
      "ChaseOverlay.tsx must be deleted — ConfrontationOverlay is the sole encounter UI (28-9)",
    ).toBe(false);
  });

  it("ConfrontationOverlay.tsx must exist as the sole encounter UI", () => {
    const confrontationPath = path.join(
      COMPONENTS_DIR,
      "ConfrontationOverlay.tsx",
    );
    expect(
      fs.existsSync(confrontationPath),
      "ConfrontationOverlay.tsx must exist — it is the sole encounter overlay after 28-9",
    ).toBe(true);
  });

  it("no production imports of CombatOverlay remain", () => {
    // Scan production source files (not tests) for CombatOverlay imports
    const productionFiles = findTsFiles(SRC_DIR).filter(
      (f) => !f.includes("__tests__") && !f.includes(".test."),
    );

    const violations: string[] = [];
    for (const file of productionFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (
        content.includes("CombatOverlay") ||
        content.includes("CombatState")
      ) {
        const relPath = path.relative(SRC_DIR, file);
        violations.push(relPath);
      }
    }

    expect(
      violations,
      `Production files still reference CombatOverlay or CombatState: ${violations.join(", ")}`,
    ).toEqual([]);
  });

  it("no production imports of ChaseOverlay remain", () => {
    const productionFiles = findTsFiles(SRC_DIR).filter(
      (f) => !f.includes("__tests__") && !f.includes(".test."),
    );

    const violations: string[] = [];
    for (const file of productionFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("ChaseOverlay")) {
        const relPath = path.relative(SRC_DIR, file);
        violations.push(relPath);
      }
    }

    expect(
      violations,
      `Production files still reference ChaseOverlay: ${violations.join(", ")}`,
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
