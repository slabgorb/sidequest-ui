import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Group A Task 7 — classified_intent retirement (UI)", () => {
  it("watcher.ts type no longer declares classified_intent", () => {
    const source = readFileSync(
      resolve(__dirname, "../types/watcher.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/classified_intent/);
  });

  it("TimelineTab.tsx no longer references classified_intent", () => {
    const source = readFileSync(
      resolve(__dirname, "../components/Dashboard/tabs/TimelineTab.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/classified_intent/);
  });
});
