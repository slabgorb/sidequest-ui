import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { createElement, type ReactNode } from "react";
import { useSlashCommands } from "@/hooks/useSlashCommands";
import {
  GameStateProvider,
  type ClientGameState,
} from "@/providers/GameStateProvider";
import { useGameState } from "@/providers/GameStateProvider";
import { MessageType } from "@/types/protocol";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a wrapper that seeds GameStateProvider with the given state. */
function makeWrapper(initialState: ClientGameState) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(GameStateProvider, null, createElement(StateSetter, { state: initialState, children }));
  };
}

/** Injects state into the context on first render. */
function StateSetter({ state, children }: { state: ClientGameState; children: ReactNode }) {
  const { setState } = useGameState();
  // Set state synchronously on mount via a layout-like trick:
  // renderHook runs in act(), so this is safe.
  setState(state);
  return children;
}

function renderSlashCommands(state: ClientGameState) {
  const wrapper = makeWrapper(state);
  return renderHook(() => useSlashCommands(), { wrapper });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_STATE: ClientGameState = {
  characters: [
    {
      name: "Aberu Kisu",
      hp: 18,
      max_hp: 24,
      statuses: ["poisoned"],
      inventory: ["iron sword", "health potion", "torch"],
    },
  ],
  location: "Darkwood Forest",
  quests: {
    "Find the Lost Shrine": "active",
    "Deliver the Letter": "completed",
  },
};

const EMPTY_STATE: ClientGameState = {
  characters: [
    {
      name: "Aberu Kisu",
      hp: 24,
      max_hp: 24,
      statuses: [],
      inventory: [],
    },
  ],
  location: "Town Square",
  quests: {},
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSlashCommands", () => {
  it("returns handled=false for regular text input", () => {
    const { result } = renderSlashCommands(FULL_STATE);
    const out = result.current.execute("attack the goblin");

    expect(out.handled).toBe(false);
    expect(out.messages).toEqual([]);
  });

  it("returns handled=true for /inventory", () => {
    const { result } = renderSlashCommands(FULL_STATE);
    const out = result.current.execute("/inventory");

    expect(out.handled).toBe(true);
  });

  it("/inventory lists character inventory items from state", () => {
    const { result } = renderSlashCommands(FULL_STATE);
    const out = result.current.execute("/inventory");

    expect(out.messages).toHaveLength(1);
    const msg = out.messages[0];
    expect(msg.type).toBe(MessageType.SESSION_EVENT);

    const text = String(msg.payload.text ?? "");
    expect(text).toContain("iron sword");
    expect(text).toContain("health potion");
    expect(text).toContain("torch");
  });

  it("/inventory shows 'No items' when inventory is empty", () => {
    const { result } = renderSlashCommands(EMPTY_STATE);
    const out = result.current.execute("/inventory");

    expect(out.handled).toBe(true);
    expect(out.messages).toHaveLength(1);
    const text = String(out.messages[0].payload.text ?? "");
    expect(text).toMatch(/no items/i);
  });

  it("/character shows character name, class/race, HP", () => {
    const { result } = renderSlashCommands(FULL_STATE);
    const out = result.current.execute("/character");

    expect(out.handled).toBe(true);
    expect(out.messages).toHaveLength(1);
    const text = String(out.messages[0].payload.text ?? "");
    expect(text).toContain("Aberu Kisu");
    expect(text).toMatch(/18.*\/.*24|HP/);
  });

  it("/quests shows quest log entries with status", () => {
    const { result } = renderSlashCommands(FULL_STATE);
    const out = result.current.execute("/quests");

    expect(out.handled).toBe(true);
    expect(out.messages).toHaveLength(1);
    const text = String(out.messages[0].payload.text ?? "");
    expect(text).toContain("Find the Lost Shrine");
    expect(text).toContain("active");
    expect(text).toContain("Deliver the Letter");
    expect(text).toContain("completed");
  });

  it("/quests shows 'No active quests' when empty", () => {
    const { result } = renderSlashCommands(EMPTY_STATE);
    const out = result.current.execute("/quests");

    expect(out.handled).toBe(true);
    expect(out.messages).toHaveLength(1);
    const text = String(out.messages[0].payload.text ?? "");
    expect(text).toMatch(/no active quests/i);
  });

  it("/help lists available commands", () => {
    const { result } = renderSlashCommands(FULL_STATE);
    const out = result.current.execute("/help");

    expect(out.handled).toBe(true);
    expect(out.messages).toHaveLength(1);
    const text = String(out.messages[0].payload.text ?? "");
    expect(text).toContain("/inventory");
    expect(text).toContain("/character");
    expect(text).toContain("/quests");
    expect(text).toContain("/help");
  });

  it("unknown command (/foo) returns error message suggesting /help", () => {
    const { result } = renderSlashCommands(FULL_STATE);
    const out = result.current.execute("/foo");

    expect(out.handled).toBe(true);
    expect(out.messages).toHaveLength(1);
    const text = String(out.messages[0].payload.text ?? "");
    expect(text).toMatch(/unknown/i);
    expect(text).toContain("/help");
  });

  it("commands are case-insensitive (/INVENTORY works)", () => {
    const { result } = renderSlashCommands(FULL_STATE);
    const out = result.current.execute("/INVENTORY");

    expect(out.handled).toBe(true);
    expect(out.messages).toHaveLength(1);
    const text = String(out.messages[0].payload.text ?? "");
    expect(text).toContain("iron sword");
  });
});
