import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useSlashCommands } from "@/hooks/useSlashCommands";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSlashCommands() {
  return renderHook(() => useSlashCommands());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSlashCommands", () => {
  it("returns handled=false for regular text input", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("attack the goblin");

    expect(out.handled).toBe(false);
    expect(out.messages).toEqual([]);
    expect(out.widget).toBeUndefined();
  });

  it("/inventory returns overlay trigger, no messages", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/inventory");

    expect(out.handled).toBe(true);
    expect(out.widget).toBe("inventory");
    expect(out.messages).toEqual([]);
  });

  it("/character returns overlay trigger", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/character");

    expect(out.handled).toBe(true);
    expect(out.widget).toBe("character");
    expect(out.messages).toEqual([]);
  });

  it("/map returns overlay trigger", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/map");

    expect(out.handled).toBe(true);
    expect(out.widget).toBe("map");
    expect(out.messages).toEqual([]);
  });

  // /journal slash command was removed playtest 2026-04-11 — the Handouts
  // tab it toggled was removed from the right-panel tab strip. When the
  // feature is revived this test should be restored alongside the case in
  // useSlashCommands.ts.
  it("/journal is now an unknown command (handled silently, no widget)", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/journal");

    // Unknown slash commands are swallowed client-side (handled: true,
    // empty messages, no widget) per the default branch of the switch.
    expect(out.handled).toBe(true);
    expect(out.widget).toBeUndefined();
    expect(out.messages).toEqual([]);
  });

  it("/knowledge returns overlay trigger", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/knowledge");

    expect(out.handled).toBe(true);
    expect(out.widget).toBe("knowledge");
    expect(out.messages).toEqual([]);
  });

  it("commands are case-insensitive (/INVENTORY works)", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/INVENTORY");

    expect(out.handled).toBe(true);
    expect(out.widget).toBe("inventory");
  });

  it("unknown slash commands are swallowed client-side (handled=true, no overlay)", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/status");

    expect(out.handled).toBe(true);
    expect(out.messages).toEqual([]);
    expect(out.widget).toBeUndefined();
  });

  it("/help is swallowed client-side", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/help");

    expect(out.handled).toBe(true);
  });

  it("/quests is swallowed client-side", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/quests");

    expect(out.handled).toBe(true);
  });

  it("/gm commands are swallowed client-side", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/gm set location tavern");

    expect(out.handled).toBe(true);
  });

  it("/tone commands are swallowed client-side", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/tone humor 0.8");

    expect(out.handled).toBe(true);
  });

  it("/yield returns handled=true and a single YIELD-typed message", () => {
    const { result } = renderSlashCommands();
    const out = result.current.execute("/yield");

    expect(out.handled).toBe(true);
    expect(out.widget).toBeUndefined();
    expect(out.messages).toHaveLength(1);
    expect(out.messages[0].type).toBe("YIELD");
    expect(out.messages[0].player_id).toBe("");
  });
});
