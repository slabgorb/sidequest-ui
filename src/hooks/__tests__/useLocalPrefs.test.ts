import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useLocalPrefs } from "@/hooks/useLocalPrefs";

const KEY = "sq-test-prefs";

interface TestPrefs {
  theme: string;
  fontSize: number;
  sidebar: boolean;
}

const DEFAULTS: TestPrefs = { theme: "dark", fontSize: 14, sidebar: true };

describe("useLocalPrefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // -- Core read/write -------------------------------------------------------

  it("returns defaults when localStorage is empty", () => {
    const { result } = renderHook(() => useLocalPrefs<TestPrefs>(KEY, DEFAULTS));
    expect(result.current[0]).toEqual(DEFAULTS);
  });

  it("restores saved prefs from localStorage", () => {
    localStorage.setItem(KEY, JSON.stringify({ theme: "light", fontSize: 18, sidebar: false }));
    const { result } = renderHook(() => useLocalPrefs<TestPrefs>(KEY, DEFAULTS));
    expect(result.current[0]).toEqual({ theme: "light", fontSize: 18, sidebar: false });
  });

  it("merges saved prefs with defaults for new fields", () => {
    // Simulate data saved before a new field was added to the shape
    localStorage.setItem(KEY, JSON.stringify({ theme: "retro" }));
    const { result } = renderHook(() => useLocalPrefs<TestPrefs>(KEY, DEFAULTS));
    expect(result.current[0]).toEqual({ theme: "retro", fontSize: 14, sidebar: true });
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem(KEY, "not-valid-json{{{");
    const { result } = renderHook(() => useLocalPrefs<TestPrefs>(KEY, DEFAULTS));
    expect(result.current[0]).toEqual(DEFAULTS);
  });

  // -- setPref ---------------------------------------------------------------

  it("updates a single preference via setPref", () => {
    const { result } = renderHook(() => useLocalPrefs<TestPrefs>(KEY, DEFAULTS));
    act(() => {
      result.current[1]({ theme: "light" });
    });
    expect(result.current[0].theme).toBe("light");
    // unchanged fields stay the same
    expect(result.current[0].fontSize).toBe(14);
  });

  it("persists changes to localStorage", () => {
    const { result } = renderHook(() => useLocalPrefs<TestPrefs>(KEY, DEFAULTS));
    act(() => {
      result.current[1]({ fontSize: 20 });
    });
    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored.fontSize).toBe(20);
    expect(stored.theme).toBe("dark");
  });

  // -- Cross-tab sync --------------------------------------------------------

  it("syncs state when another tab writes to the same key", () => {
    const { result } = renderHook(() => useLocalPrefs<TestPrefs>(KEY, DEFAULTS));
    // Simulate a storage event from another tab
    act(() => {
      const event = new StorageEvent("storage", {
        key: KEY,
        newValue: JSON.stringify({ theme: "solarized", fontSize: 16, sidebar: false }),
      });
      window.dispatchEvent(event);
    });
    expect(result.current[0]).toEqual({ theme: "solarized", fontSize: 16, sidebar: false });
  });

  it("ignores storage events for different keys", () => {
    const { result } = renderHook(() => useLocalPrefs<TestPrefs>(KEY, DEFAULTS));
    act(() => {
      const event = new StorageEvent("storage", {
        key: "some-other-key",
        newValue: JSON.stringify({ theme: "alien" }),
      });
      window.dispatchEvent(event);
    });
    expect(result.current[0].theme).toBe("dark");
  });

  // -- Wiring test -----------------------------------------------------------

  it("is importable from @/hooks/useLocalPrefs (wiring test)", async () => {
    const mod = await import("@/hooks/useLocalPrefs");
    expect(typeof mod.useLocalPrefs).toBe("function");
  });
});
