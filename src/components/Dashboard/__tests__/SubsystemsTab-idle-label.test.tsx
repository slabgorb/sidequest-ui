import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SubsystemsTab } from "../tabs/SubsystemsTab";
import type { WatcherEvent } from "@/types/watcher";

// ══════════════════════════════════════════════════════════════════════════════
// Playtest 2026-04-11 regression — SubsystemsTab "SILENT" label was confusing
//
// Bug: Subsystems Component Summary marked rows like `chargen` (8 events),
// `inventory` (4), `mood_image` (4), `render` (4), `session_restore` (4),
// `world_materialization` (6) as "⚠ SILENT" because they hadn't fired in
// the last 5 turns. Keith reported: "A subsystem with 16 events labeled
// SILENT is confusing." The label implies a subsystem is BROKEN, but most
// of the time it just means the subsystem only fires in specific phases
// (chargen, world setup) and is naturally idle during ordinary turns.
//
// Fix: rename SILENT → IDLE and add a hover tooltip explaining the
// semantics ("idle, not failed"). Both the inline Activity Grid label and
// the Component Summary status column carry the new label and tooltip.
//
// These tests cover the rendered labels at the DOM level so a future
// refactor can't silently revert to "SILENT" without warning.
// ══════════════════════════════════════════════════════════════════════════════

function turnComplete(component: string): WatcherEvent {
  return {
    timestamp: "2026-04-11T12:00:00.000Z",
    component,
    event_type: "turn_complete",
    severity: "info",
    fields: {},
  };
}

function event(
  component: string,
  event_type: WatcherEvent["event_type"],
): WatcherEvent {
  return {
    timestamp: "2026-04-11T12:00:00.000Z",
    component,
    event_type,
    severity: "info",
    fields: {},
  };
}

describe("SubsystemsTab IDLE label (playtest 2026-04-11)", () => {
  it("uses IDLE (not SILENT) for subsystems with no events in the last 5 turns", () => {
    // Build at least 5 turn buckets so the silentComponents detection runs.
    // chargen has events early but never in the last 5 turns → should be IDLE.
    // narrator has events in every turn → should be OK.
    const allEvents: WatcherEvent[] = [
      event("chargen", "state_transition"),
      event("chargen", "state_transition"),
      turnComplete("game"),
      event("narrator", "agent_span_close"),
      turnComplete("game"),
      event("narrator", "agent_span_close"),
      turnComplete("game"),
      event("narrator", "agent_span_close"),
      turnComplete("game"),
      event("narrator", "agent_span_close"),
      turnComplete("game"),
      event("narrator", "agent_span_close"),
      turnComplete("game"),
    ];

    const componentMap = {
      chargen: allEvents.filter((e) => e.component === "chargen"),
      narrator: allEvents.filter((e) => e.component === "narrator"),
      game: allEvents.filter((e) => e.component === "game"),
    };

    render(
      <SubsystemsTab
        allEvents={allEvents}
        componentMap={componentMap}
        turnCount={6}
      />,
    );

    // The Component Summary status column shows IDLE for chargen.
    // (Use a regex because the cell also contains an icon.)
    expect(screen.getByText(/⊘ IDLE/)).toBeInTheDocument();

    // At least one row must be marked OK (the non-idle subsystems).
    // Multiple OK rows expected because narrator AND game both fired.
    expect(screen.getAllByText(/✓ OK/).length).toBeGreaterThanOrEqual(1);
  });

  it("does not render the legacy 'SILENT' label anywhere in the DOM", () => {
    const allEvents: WatcherEvent[] = [
      event("chargen", "state_transition"),
      turnComplete("game"),
      turnComplete("game"),
      turnComplete("game"),
      turnComplete("game"),
      turnComplete("game"),
      turnComplete("game"),
    ];
    const componentMap = {
      chargen: allEvents.filter((e) => e.component === "chargen"),
      game: allEvents.filter((e) => e.component === "game"),
    };

    render(
      <SubsystemsTab
        allEvents={allEvents}
        componentMap={componentMap}
        turnCount={6}
      />,
    );

    // Regression guard: SILENT must not reappear (case-sensitive — the
    // word "silent" appearing in lowercase in a code comment elsewhere
    // is fine, we only care about the rendered uppercase label).
    expect(screen.queryByText(/SILENT/)).toBeNull();
  });

  it("provides a hover tooltip explaining what IDLE means", () => {
    const allEvents: WatcherEvent[] = [
      event("session_restore", "state_transition"),
      turnComplete("game"),
      turnComplete("game"),
      turnComplete("game"),
      turnComplete("game"),
      turnComplete("game"),
      turnComplete("game"),
    ];
    const componentMap = {
      session_restore: allEvents.filter((e) => e.component === "session_restore"),
      game: allEvents.filter((e) => e.component === "game"),
    };

    const { container } = render(
      <SubsystemsTab
        allEvents={allEvents}
        componentMap={componentMap}
        turnCount={6}
      />,
    );

    // Find any element with a title attribute mentioning "idle, not broken"
    // semantics. We use a substring check rather than full text match so
    // future copy edits don't break the test.
    const tooltipped = container.querySelectorAll("[title]");
    const hasIdleTooltip = Array.from(tooltipped).some((el) => {
      const t = el.getAttribute("title") ?? "";
      return t.includes("idle") && t.includes("NOT");
    });
    expect(
      hasIdleTooltip,
      "Expected at least one element with a tooltip explaining IDLE means 'idle, not broken'.",
    ).toBe(true);
  });
});
